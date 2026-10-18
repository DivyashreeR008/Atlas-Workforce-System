"""Static gateway-to-service contract parsing (stdlib only).

The API gateway (services/api-gateway-node/index.js) proxies a set of public
prefixes to partner services. This module derives that proxy map from the
gateway source and derives each service's declared routes from its own
source files, without installing any service dependency and without running
the stack.

The parsers are intentionally narrow: they understand the route declaration
styles actually used in this repository (Express, FastAPI, Go fiber, Go
net/http mux, Spring MVC). A service that stops matching its known style
fails the contract check instead of silently reporting zero routes.

Run ``python tests/contracts/check_contracts.py`` for the full verification.
"""

import pathlib
import re

GATEWAY_PATH = "services/api-gateway-node/index.js"

# Gateway service keys that map to a directory whose name differs from the
# docker-compose hostname used in the upstream URL.
HOST_DIR_OVERRIDES = {
    "employee-service": "employee-python-service",
    "payroll-service": "payroll-java-service",
    "analytics-service": "analytics-python-service",
    "notification-service": "notification-go-service",
}

# Route declarations that are not part of the public API contract.
IGNORED_ROUTE_PATHS = {"/metrics"}


class ContractError(Exception):
    """Raised when the gateway or a service source cannot be parsed."""


def _first_string_literal(text):
    match = re.search(r"\"([^\"]*)\"|'([^']*)'", text)
    if not match:
        return None
    return match.group(1) if match.group(1) is not None else match.group(2)


def _all_string_literals(text):
    literals = []
    for match in re.finditer(r"\"([^\"]*)\"|'([^']*)'", text):
        literals.append(match.group(1) if match.group(1) is not None else match.group(2))
    return literals


def _join(*parts):
    """Join URL path fragments, collapsing duplicate slashes."""
    pieces = [p.strip("/") for p in parts if p and p.strip("/")]
    if not pieces:
        return "/"
    return "/" + "/".join(pieces)


def read_gateway(root):
    path = pathlib.Path(root) / GATEWAY_PATH
    if not path.exists():
        raise ContractError("gateway source not found: %s" % GATEWAY_PATH)
    return path.read_text(encoding="utf-8")


def parse_services_map(text):
    """Return {service key: upstream URL} from the gateway ``services`` map."""
    block = re.search(r"const services = \{(.*?)\n\};", text, re.S)
    if not block:
        raise ContractError("could not locate the services map in the gateway")
    services = {}
    for match in re.finditer(
        r"(\w+):\s*\n?\s*process\.env\.\w+\s*\|\|\s*'([^']+)'", block.group(1)
    ):
        services[match.group(1)] = match.group(2)
    if not services:
        raise ContractError("services map parsed to zero entries")
    return services


def parse_string_array(text, variable):
    """Extract the string literals of a JS array constant such as PUBLIC_PREFIXES."""
    block = re.search(r"const %s = \[(.*?)\];" % re.escape(variable), text, re.S)
    if not block:
        raise ContractError("could not locate %s array in the gateway" % variable)
    return re.findall(r"'([^']*)'", block.group(1))


def parse_proxy_registrations(text):
    """Return the list of ``app.use(<prefix>, proxyService(...))`` registrations."""
    pattern = re.compile(
        r"app\.use\(\s*'(?P<prefix>/[^']+)'\s*,\s*proxyService\(\s*services\.(?P<service>\w+)"
        r"\s*,\s*'(?P<mount>[^']*)'\s*,\s*\{\s*'(?P<rewrite_from>[^']+)'\s*:\s*'(?P<rewrite_to>[^']*)'\s*\}"
        r"\s*\)\s*\)\s*;"
    )
    proxies = []
    for match in pattern.finditer(text):
        proxy = match.groupdict()
        if proxy["prefix"] != proxy["mount"]:
            raise ContractError(
                "proxy %s mounts at %s but re-adds %s before the rewrite; the contract "
                "checker only models identical mount and rewrite prefixes"
                % (proxy["prefix"], proxy["prefix"], proxy["mount"])
            )
        proxies.append(proxy)
    if not proxies:
        raise ContractError("no proxy registrations found in the gateway")
    return proxies


def parse_proxy_timeout_ms(text):
    match = re.search(r"timeout:\s*(\d+)\s*,\s*\n\s*proxyTimeout:\s*(\d+)\s*,", text)
    if not match:
        raise ContractError("could not locate the proxy timeout settings")
    if match.group(1) != match.group(2):
        raise ContractError(
            "proxy timeout and proxyTimeout differ (%s vs %s)" % (match.group(1), match.group(2))
        )
    return int(match.group(1))


def resolve_service_dir(root, service_key, upstream_url):
    """Map a gateway service key to its directory under services/."""
    root = pathlib.Path(root)
    host = upstream_url.split("//", 1)[-1].split(":", 1)[0]
    candidates = [HOST_DIR_OVERRIDES.get(host, host), host, service_key]
    for candidate in candidates:
        directory = root / "services" / candidate
        if directory.is_dir():
            return "services/%s" % candidate
    raise ContractError(
        "no service directory found for gateway service '%s' (upstream %s)"
        % (service_key, upstream_url)
    )


def rewrite_downstream_path(gateway_path, rewrite_from, rewrite_to):
    """Apply the gateway pathRewrite rule to a gateway-visible path."""
    if not gateway_path.startswith(rewrite_from.replace("^", "").replace("$", "")):
        raise ContractError(
            "path %s does not start with rewrite prefix %s" % (gateway_path, rewrite_from)
        )
    rewritten = re.sub(rewrite_from, rewrite_to, gateway_path, count=1)
    return rewritten or "/"


# ---------------------------------------------------------------------------
# Service route parsers
# ---------------------------------------------------------------------------


def _parse_python_routes(service_dir):
    """Declared FastAPI routes of a service.

    main.py decorators (``@app.get(...)``) are taken verbatim: those paths
    already carry their full public prefix. Router-module decorators
    (``@router.get(...)`` in routers/*.py) are mounted with the prefix used by
    ``include_router`` in main.py plus any prefix on the APIRouter itself.
    """
    routes = []

    def add(method, path, source):
        if path not in IGNORED_ROUTE_PATHS:
            routes.append({"method": method, "path": path, "source": str(source)})

    main = service_dir / "main.py"
    if not main.exists():
        return routes
    main_text = main.read_text(encoding="utf-8", errors="replace")

    include_map = {}
    for match in re.finditer(
        r"include_router\(\s*([\w.]+)\s*,\s*prefix\s*=\s*[\"']([^\"']*)[\"']", main_text
    ):
        module = match.group(1).split(".")[0]
        include_map.setdefault(module, []).append(match.group(2))

    def collect(text, source, include_prefixes, router_prefix):
        for match in re.finditer(r"@(\w+)\.(get|post|put|patch|delete)\(", text):
            args = _read_call_arguments(text, match.end() - 1)
            declared = _first_string_literal(args)
            if declared is None:
                continue
            method = match.group(2).upper()
            if include_prefixes is None:
                add(method, declared, source)
                continue
            if router_prefix and not (
                declared == router_prefix or declared.startswith(router_prefix + "/")
            ):
                merged = _join(router_prefix, declared)
            else:
                merged = declared
            for prefix in include_prefixes or [""]:
                if prefix and (merged == prefix or merged.startswith(prefix + "/")):
                    full = merged
                else:
                    full = _join(prefix, merged)
                add(method, full, source)

    collect(main_text, main, None, "")
    routers_dir = service_dir / "routers"
    if routers_dir.is_dir():
        for path in sorted(routers_dir.glob("*.py")):
            if path.name == "__init__.py":
                continue
            text = path.read_text(encoding="utf-8", errors="replace")
            prefix_match = re.search(
                r"\w+\s*=\s*APIRouter\([^)]*prefix\s*=\s*[\"']([^\"']*)[\"']",
                text,
                re.S,
            )
            router_prefix = prefix_match.group(1) if prefix_match else ""
            collect(text, path, include_map.get(path.stem, []), router_prefix)
    return routes


def _read_call_arguments(text, open_paren_index, limit=600):
    """Read the argument text of a call, balancing parentheses."""
    depth = 0
    for offset in range(open_paren_index, min(len(text), open_paren_index + limit)):
        char = text[offset]
        if char == "(":
            depth += 1
        elif char == ")":
            depth -= 1
            if depth == 0:
                return text[open_paren_index + 1 : offset]
    return text[open_paren_index + 1 : open_paren_index + limit]


def _parse_go_routes(service_dir):
    routes = []
    files = [p for p in sorted(service_dir.glob("*.go")) if not p.name.endswith("_test.go")]
    text = "\n".join(p.read_text(encoding="utf-8", errors="replace") for p in files)
    if "fiber." in text or "gofiber" in text or re.search(r"\.Group\(\"", text):
        groups = {}
        for match in re.finditer(r"(\w+)\s*:?=\s*(\w+)\.Group\(\s*\"([^\"]*)\"\s*\)", text):
            groups[match.group(1)] = (match.group(2), match.group(3))

        def group_prefix(var):
            seen = set()
            prefix = ""
            while var in groups and var not in seen:
                seen.add(var)
                parent, path = groups[var]
                prefix = _join(path, prefix)
                var = parent
            return prefix

        for match in re.finditer(r"(\w+)\.(Get|Post|Put|Delete|Patch|Head|Options)\(\s*\"([^\"]*)\"", text):
            var, method, path = match.groups()
            if var == "app":
                prefix = ""
            elif var in groups:
                prefix = group_prefix(var)
            else:
                continue
            full = _join(prefix, path)
            if full not in IGNORED_ROUTE_PATHS:
                routes.append({"method": method.upper(), "path": full, "source": "*.go"})
    else:
        for match in re.finditer(r"mux\.Handle(?:Func)?\(\s*\"([^\"]*)\"", text):
            path = match.group(1)
            if path not in IGNORED_ROUTE_PATHS:
                routes.append({"method": "ANY", "path": path, "source": "*.go"})
    return routes


def _parse_spring_routes(service_dir):
    routes = []
    source_root = service_dir / "src" / "main" / "java"
    if not source_root.is_dir():
        return routes
    for path in sorted(source_root.rglob("*.java")):
        text = path.read_text(encoding="utf-8", errors="replace")
        class_index = text.find(" class ")
        base = ""
        for match in re.finditer(r"@RequestMapping\((.*?)\)", text, re.S):
            if match.start() > class_index and class_index != -1:
                continue
            literal = _first_string_literal(match.group(1))
            if literal and literal.startswith("/"):
                base = literal
                break
        for match in re.finditer(
            r"@(GetMapping|PostMapping|PutMapping|DeleteMapping|PatchMapping|RequestMapping)"
            r"(\s*\(([^)]*)\))?",
            text,
        ):
            if class_index != -1 and match.start() < class_index:
                # Class-level annotation; it defines the base path only.
                continue
            if match.group(1) == "RequestMapping" and class_index == -1:
                continue
            args = match.group(3) or ""
            paths = [lit for lit in _all_string_literals(args) if lit.startswith("/")]
            if not paths:
                paths = [""]
            if match.group(1) == "RequestMapping":
                method_match = re.search(r"RequestMethod\.(GET|POST|PUT|DELETE|PATCH)", args)
                method = method_match.group(1) if method_match else "ANY"
            else:
                method = match.group(1).replace("Mapping", "").upper()
            for declared in paths:
                full = _join(base, declared)
                if full not in IGNORED_ROUTE_PATHS:
                    routes.append({"method": method, "path": full, "source": str(path)})
    return routes


def _parse_express_routes(service_dir):
    routes = []
    index = service_dir / "index.js"
    if not index.exists():
        return routes
    text = index.read_text(encoding="utf-8", errors="replace")
    for match in re.finditer(
        r"app\.(get|post|put|patch|delete)\(\s*['\"]([^'\"]+)['\"]", text
    ):
        method, path = match.groups()
        if path not in IGNORED_ROUTE_PATHS:
            routes.append({"method": method.upper(), "path": path, "source": "index.js"})
    return routes


def parse_service_routes(root, service_dir_rel):
    """Parse every declared route of one service without installing dependencies."""
    service_dir = pathlib.Path(root) / service_dir_rel
    if not service_dir.is_dir():
        raise ContractError("service directory not found: %s" % service_dir_rel)
    if (service_dir / "main.py").exists():
        routes = _parse_python_routes(service_dir)
    elif (service_dir / "go.mod").exists():
        routes = _parse_go_routes(service_dir)
    elif (service_dir / "pom.xml").exists():
        routes = _parse_spring_routes(service_dir)
    elif (service_dir / "index.js").exists():
        routes = _parse_express_routes(service_dir)
    else:
        raise ContractError(
            "no parser for %s (expected main.py, go.mod, pom.xml or index.js)" % service_dir_rel
        )
    deduped = []
    seen = set()
    for route in routes:
        key = (route["method"], route["path"])
        if key not in seen:
            seen.add(key)
            deduped.append(route)
    return deduped


def route_covers_base(route_path, base):
    """True when a declared route path sits under the proxy's downstream base."""
    if base in ("", "/"):
        return True
    base = base.rstrip("/")
    return route_path == base or route_path.startswith(base + "/")


def auth_classification(gateway_path, public_prefixes, protected_prefixes):
    """Classify the gateway-level auth requirement of a proxied path."""
    for prefix in public_prefixes:
        if gateway_path == prefix or gateway_path.startswith(prefix + "/"):
            return "public"
    for prefix in protected_prefixes:
        if gateway_path == prefix or gateway_path.startswith(prefix + "/"):
            return "gateway-jwt"
    return "downstream"
