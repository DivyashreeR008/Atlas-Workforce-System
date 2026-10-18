import json
import logging
import uuid
import random
import hmac
from contextvars import ContextVar
from fastapi import FastAPI, HTTPException, Body, Query, Header, Depends, Request
from pydantic import BaseModel, Field
from typing import List, Optional
import os
import math
import re
import asyncio
import uvicorn
# pyrefly: ignore [missing-import]
from motor.motor_asyncio import AsyncIOMotorClient
import pymongo.errors
from contextlib import asynccontextmanager
import pika
from fastapi.responses import JSONResponse

from atlas_observability import AtlasMetricsMiddleware, SecurityHeadersMiddleware, sanitize_url, verify_internal_auth

# ------------------------------------------------
# Structured Logger
# ------------------------------------------------
SERVICE_NAME = "employee-service"
SERVICE_VERSION = "2.0.0"

logger = logging.getLogger(SERVICE_NAME)
logger.setLevel(logging.INFO)
handler = logging.StreamHandler()
handler.setFormatter(logging.Formatter("%(message)s"))
logger.handlers.clear()
logger.addHandler(handler)

correlation_id_ctx: ContextVar[str] = ContextVar("correlation_id", default="")


def log_event(level: str, event: str, **kwargs):
    record = {
        "service": SERVICE_NAME,
        "version": SERVICE_VERSION,
        "level": level,
        "event": event,
    }
    cid = correlation_id_ctx.get()
    if cid:
        record["correlation_id"] = cid
    record.update(kwargs)
    logger.log(getattr(logging, level.upper(), logging.INFO), json.dumps(record))


# ------------------------------------------------
# Configuration
# ------------------------------------------------
MONGO_USER = os.environ.get("MONGO_USER", "")
MONGO_PASSWORD = os.environ.get("MONGO_PASSWORD", "")
MONGO_HOST = os.environ.get("MONGO_HOST", "localhost")
MONGO_DB = os.environ.get("MONGO_DB", "atlas_db")
MONGO_URL = os.environ.get(
    "MONGO_URL",
    f"mongodb://{MONGO_USER}:{MONGO_PASSWORD}@{MONGO_HOST}:27017/{MONGO_DB}?authSource=admin",
)
DB_NAME = "atlas_db"

INTERNAL_JWT_SECRET = os.environ.get("INTERNAL_JWT_SECRET", "")

RABBITMQ_URL = os.environ.get("RABBITMQ_URL", "")
RABBITMQ_HOST = os.environ.get("RABBITMQ_HOST", "localhost")


def _get_rabbitmq_port():
    try:
        return int(os.environ.get("RABBITMQ_PORT", "5672"))
    except ValueError as e:
        log_event("warning", "config.invalid_rabbitmq_port", error=str(e), fallback=5672)
        return 5672


RABBITMQ_PORT = _get_rabbitmq_port()
RABBITMQ_USER = os.environ.get("RABBITMQ_USER", "guest")
RABBITMQ_PASSWORD = os.environ.get("RABBITMQ_PASSWORD", "guest")

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]
employees_collection = db["employees"]

# ------------------------------------------------
# Security Constants
# ------------------------------------------------
ALLOWED_SEARCH_FIELDS = {"name", "email", "department", "position"}
SEARCH_MAX_LENGTH = 200
SEARCH_ALLOWED_CHARS = re.compile(r"^[a-zA-Z0-9 @._\-]+$")

# Reporting-line safety rails: cycles are rejected on write and broken on
# read, so dirty data can never hang the hierarchy assembly.
MAX_REPORTING_CHAIN = 50
MAX_HIERARCHY_NODES = 5000
PRIVILEGED_HIERARCHY_ROLES = {"admin", "hr"}


@asynccontextmanager
async def lifespan(app: FastAPI):
    log_event("info", "service.starting", mongo_url=sanitize_url(MONGO_URL))
    try:
        # Migration: email used to be globally unique, but identity is per
        # tenant, so the unique key is (tenant_id, email). Drop the old
        # global index first (missing on fresh installs - ignore that case).
        try:
            await employees_collection.drop_index("email_1")
            log_event("info", "indexes.dropped_legacy_email_index")
        except Exception:
            pass
        await employees_collection.create_index([("tenant_id", 1), ("email", 1)], unique=True)
        await employees_collection.create_index("name")
        await employees_collection.create_index("department")
        await employees_collection.create_index([("tenant_id", 1), ("name", 1)])
        await employees_collection.create_index([("tenant_id", 1), ("department", 1), ("position", 1)])
        log_event("info", "indexes.created")
    except pymongo.errors.PyMongoError as e:
        log_event("warning", "indexes.failed", error=str(e), error_type=type(e).__name__)
    except Exception:
        logger.exception("indexes.failed_unexpected")
    yield
    client.close()
    log_event("info", "service.stopped")


app = FastAPI(title="Employee Service API", version=SERVICE_VERSION, lifespan=lifespan)


@app.middleware("http")
async def add_correlation_id(request: Request, call_next):
    correlation_id = request.headers.get("X-Correlation-Id", str(uuid.uuid4()))
    correlation_id_ctx.set(correlation_id)
    response = await call_next(request)
    response.headers["X-Correlation-Id"] = correlation_id
    return response


app.add_middleware(AtlasMetricsMiddleware)
app.add_middleware(SecurityHeadersMiddleware)


@app.middleware("http")
async def internal_auth_middleware(request: Request, call_next):
    if request.url.path in ("/health", "/metrics"):
        return await call_next(request)

    auth_header = request.headers.get("x-internal-auth")
    if not auth_header:
        return JSONResponse(status_code=401, content={"detail": "Missing internal authentication"})

    try:
        claims = verify_internal_auth(request, INTERNAL_JWT_SECRET)
        request.state.tenant_id = claims.get("tenant_id", "default")
        request.state.user_id = claims.get("user_id", "")
        request.state.user_role = claims.get("user_role", "employee")
        # Verified caller email, used by the self-service endpoints and to
        # scope the reporting hierarchy. The
        # gateway mints this claim from the authenticated session, so it can
        # never be supplied (or overridden) by the client.
        request.state.user_email = str(claims.get("email") or "").strip().lower()
    except HTTPException as e:
        return JSONResponse(status_code=e.status_code, content={"detail": e.detail})
    except (ValueError, KeyError, AttributeError, TypeError, UnicodeError) as e:
        log_event("warning", "auth.unexpected_claims_shape", error=str(e), error_type=type(e).__name__)
        return JSONResponse(status_code=401, content={"detail": "Invalid internal authentication"})
    except Exception:
        logger.exception("auth.middleware_unexpected_error")
        return JSONResponse(status_code=401, content={"detail": "Invalid internal authentication"})

    return await call_next(request)


# ------------------------------------------------
# Input Validation
# ------------------------------------------------
EMAIL_PATTERN = re.compile(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$")
EMAIL_MAX_LENGTH = 200


def validate_email_param(email: str) -> str:
    if len(email) > EMAIL_MAX_LENGTH or not EMAIL_PATTERN.match(email):
        raise HTTPException(status_code=400, detail="Invalid email address")
    return email


def validate_search_param(search: Optional[str]) -> Optional[str]:
    if not search:
        return search
    if len(search) > SEARCH_MAX_LENGTH:
        log_event("warning", "search.too_long", length=len(search))
        raise HTTPException(status_code=400, detail="Search query too long")
    if not SEARCH_ALLOWED_CHARS.match(search):
        log_event("warning", "search.invalid_chars", search=search)
        raise HTTPException(status_code=400, detail="Search contains invalid characters")
    return search


# ------------------------------------------------
# Reporting Hierarchy Helpers
# ------------------------------------------------
async def resolve_manager_reference(
    tenant_id: str,
    manager_id: str,
    employee_email: Optional[str] = None,
) -> str:
    """Validate a manager reference and return its normalized email.

    A manager must be a real employee in the same tenant, must not be the
    employee themselves, and must not already report (directly or indirectly)
    to the employee - which would close a reporting cycle.
    """
    manager_id = (manager_id or "").strip().lower()
    if not manager_id or len(manager_id) > EMAIL_MAX_LENGTH or not EMAIL_PATTERN.match(manager_id):
        raise HTTPException(status_code=400, detail="manager_id must be a valid employee email")

    employee_key = (employee_email or "").strip().lower()
    if employee_key and manager_id == employee_key:
        raise HTTPException(status_code=400, detail="An employee cannot report to themselves")

    manager = await employees_collection.find_one({"email": manager_id, "tenant_id": tenant_id})
    if not manager:
        raise HTTPException(status_code=400, detail="manager_id does not match an employee in this tenant")

    cursor_email = str(manager.get("manager_id") or "").strip().lower()
    seen = {manager_id}
    depth = 0
    while cursor_email and depth < MAX_REPORTING_CHAIN:
        if employee_key and cursor_email == employee_key:
            raise HTTPException(status_code=400, detail="manager_id would create a reporting cycle")
        if cursor_email in seen:
            break  # pre-existing cycle in stored data; not introduced by this change
        seen.add(cursor_email)
        parent = await employees_collection.find_one(
            {"email": cursor_email, "tenant_id": tenant_id},
            {"manager_id": 1},
        )
        if not parent:
            break
        cursor_email = str(parent.get("manager_id") or "").strip().lower()
        depth += 1
    if depth >= MAX_REPORTING_CHAIN:
        raise HTTPException(status_code=400, detail="Reporting chain is too deep")
    return manager_id


def build_hierarchy(records: List[dict]):
    """Assemble flat employee rows into a forest of reporting trees.

    Returns (nodes_by_email, roots). Records whose manager is missing from the
    tenant, or is themselves, become roots so dirty data still renders; any
    manager cycles are broken by promoting one node per cycle to a root.
    """
    nodes = {}
    for record in records:
        email = str(record.get("email") or "").strip().lower()
        if not email or email in nodes:
            continue
        nodes[email] = {
            "email": email,
            "name": record.get("name", ""),
            "department": record.get("department", ""),
            "position": record.get("position", ""),
            "manager_id": str(record.get("manager_id") or "").strip().lower() or None,
            "direct_reports": 0,
            "total_reports": 0,
            "children": [],
        }

    roots = []
    for email, node in nodes.items():
        manager_id = node["manager_id"]
        if manager_id and manager_id != email and manager_id in nodes:
            nodes[manager_id]["children"].append(node)
        else:
            roots.append(node)

    visited = set()

    def visit(start_nodes):
        stack = list(start_nodes)
        while stack:
            node = stack.pop()
            if node["email"] in visited:
                continue
            visited.add(node["email"])
            stack.extend(node["children"])

    visit(roots)
    remaining = [node for email, node in nodes.items() if email not in visited]
    while remaining:
        promoted = remaining[0]
        log_event("warning", "hierarchy.cycle_detected", node=promoted["email"])
        manager_id = promoted["manager_id"]
        if manager_id and manager_id in nodes:
            parent = nodes[manager_id]
            parent["children"] = [child for child in parent["children"] if child is not promoted]
        promoted["manager_id"] = None
        roots.append(promoted)
        visit([promoted])
        remaining = [node for email, node in nodes.items() if email not in visited]

    for root in roots:
        _sort_hierarchy(root)
    return nodes, roots


def _sort_hierarchy(root: dict) -> None:
    stack = [root]
    while stack:
        node = stack.pop()
        node["children"].sort(key=lambda child: (child["name"].lower(), child["email"]))
        stack.extend(node["children"])


def compute_report_counts(root: dict) -> None:
    """Fill direct_reports/total_reports for the subtree rooted at root."""
    stack = [(root, False)]
    while stack:
        node, expanded = stack.pop()
        if expanded:
            total = 0
            for child in node["children"]:
                total += 1 + child["total_reports"]
            node["direct_reports"] = len(node["children"])
            node["total_reports"] = total
        else:
            stack.append((node, True))
            stack.extend((child, False) for child in node["children"])


async def load_hierarchy_records(tenant_id: str) -> List[dict]:
    """Load the flat reporting rows for a tenant, capped for safety."""
    records = []
    cursor = employees_collection.find(
        {"tenant_id": tenant_id},
        {"_id": 0, "email": 1, "name": 1, "department": 1, "position": 1, "manager_id": 1},
    ).limit(MAX_HIERARCHY_NODES)
    async for record in cursor:
        records.append(record)
    if len(records) >= MAX_HIERARCHY_NODES:
        log_event("warning", "hierarchy.truncated", tenant_id=tenant_id, limit=MAX_HIERARCHY_NODES)
    return records


# ------------------------------------------------
# Auth Helpers
# ------------------------------------------------
# verify_internal_key removed - all endpoints now require x-internal-auth JWT
# tenant is bound from verified claims (request.state.tenant_id) instead of X-Tenant-Id header


def require_self_identity(request: Request) -> str:
    """Return the verified caller email for self-service endpoints.

    Self-service reads and writes are bound to the identity in the verified
    internal token; the request body/path/query is never consulted for it.
    Calls without an email claim (service-to-service tokens) fail closed.
    """
    email = getattr(request.state, "user_email", "")
    if not email:
        raise HTTPException(status_code=401, detail="Missing verified identity claim")
    return email


# ------------------------------------------------
# RabbitMQ Helpers
# ------------------------------------------------
async def publish_delete_event(email: str, tenant_id: str):
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, _publish_delete_event_sync, email, tenant_id)


def _publish_delete_event_sync(email: str, tenant_id: str):
    try:
        if RABBITMQ_URL:
            params = pika.URLParameters(RABBITMQ_URL)
        else:
            credentials = pika.PlainCredentials(RABBITMQ_USER, RABBITMQ_PASSWORD)
            params = pika.ConnectionParameters(
                host=RABBITMQ_HOST,
                port=RABBITMQ_PORT,
                credentials=credentials,
            )
        connection = pika.BlockingConnection(params)
        channel = connection.channel()
        channel.exchange_declare(exchange="notifications_exchange", exchange_type="fanout", durable=True)
        message = json.dumps({
            "event": "employee.deleted",
            "email": email,
            "tenant_id": tenant_id,
            "service": SERVICE_NAME,
        })
        channel.basic_publish(
            exchange="notifications_exchange",
            routing_key="",
            body=message,
            properties=pika.BasicProperties(delivery_mode=2),
        )
        connection.close()
        log_event("info", "employee.delete.published", email=email, tenant_id=tenant_id)
    except Exception as e:
        log_event("error", "employee.delete.publish.failed", email=email, tenant_id=tenant_id, error=str(e), error_type=type(e).__name__)


# ------------------------------------------------
# Pydantic Schemas
# ------------------------------------------------
class EmployeeSchema(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    name: str = Field(..., min_length=1, max_length=200, description="Full name of the employee")
    department: str = Field(..., min_length=1, max_length=200, description="Department name")
    position: str = Field(..., min_length=1, max_length=200, description="Job position/title")
    email: str = Field(
        ...,
        min_length=5,
        max_length=254,
        pattern=r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$",
        description="Employee email address (unique per tenant)",
    )
    phone: Optional[str] = Field(
        None,
        min_length=7,
        max_length=20,
        pattern=r"^\+?[0-9 ()\-]+$",
        description="Contact phone number",
    )
    location: Optional[str] = Field(None, min_length=1, max_length=200, description="Work location")
    manager_id: Optional[str] = Field(
        None,
        max_length=254,
        description="Email of the employee's manager (validated against the tenant)",
    )
    tenant_id: Optional[str] = Field(None, description="Multi-tenant identifier")

    class Config:
        populate_by_name = True
        json_schema_extra = {
            "example": {
                "name": "John Doe",
                "department": "Engineering",
                "position": "Software Engineer",
                "email": "john.doe@atlas.io",
            }
        }


class PaginatedEmployees(BaseModel):
    items: List[EmployeeSchema]
    total: int
    page: int
    page_size: int
    total_pages: int


def serialize_employee(employee: dict) -> dict:
    employee["_id"] = str(employee["_id"])
    return employee


class EmployeeUpdateSchema(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200, description="Updated full name")
    department: Optional[str] = Field(None, min_length=1, max_length=200, description="Updated department")
    position: Optional[str] = Field(None, min_length=1, max_length=200, description="Updated position")
    email: Optional[str] = Field(
        None,
        min_length=5,
        max_length=254,
        pattern=r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$",
        description="Updated email",
    )
    manager_id: Optional[str] = Field(
        None,
        max_length=254,
        description="Updated manager email; send an empty string to clear the reporting line",
    )


class HierarchyNode(BaseModel):
    """One employee in the reporting tree, with span-of-control counts."""

    email: str
    name: str
    department: str = ""
    position: str = ""
    manager_id: Optional[str] = None
    direct_reports: int = 0
    total_reports: int = 0
    children: List["HierarchyNode"] = Field(default_factory=list)


class HierarchyResponse(BaseModel):
    scope: str = Field(..., description="What the caller may see: tenant, subtree or none")
    viewer_email: Optional[str] = None
    total_visible: int
    roots: List[HierarchyNode]


HierarchyNode.model_rebuild()


class EmployeeSelfUpdateSchema(BaseModel):
    """Fields an employee may change on their own profile.

    Department, position, email and reporting line stay HR-managed through the
    directory endpoints; self-service edits are limited to personal details.
    """

    name: Optional[str] = Field(None, min_length=1, max_length=200, description="Updated full name")
    phone: Optional[str] = Field(
        None,
        min_length=7,
        max_length=20,
        pattern=r"^\+?[0-9 ()\-]+$",
        description="Updated contact phone number",
    )
    location: Optional[str] = Field(None, min_length=1, max_length=200, description="Updated work location")


# ------------------------------------------------
# Endpoints
# ------------------------------------------------
@app.get("/health", tags=["health"])
async def health_check():
    """Check if the service and database are healthy."""
    try:
        await client.admin.command("ping")
        return {"status": "Employee Service is running", "database": "connected"}
    except pymongo.errors.PyMongoError:
        return {
            "status": "Employee Service is running",
            "database": "disconnected",
        }


@app.get("/employees", response_model=PaginatedEmployees, tags=["employees"], summary="List all employees")
async def get_employees(
    request: Request,
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(10, ge=1, le=100, description="Items per page"),
    search: Optional[str] = Query(None, description="Search by name, email, department, or position"),
):
    """Retrieve a paginated, searchable list of employees scoped to a tenant."""
    tenant_id = getattr(request.state, "tenant_id", "default")
    search = validate_search_param(search)
    query = {"tenant_id": tenant_id}
    if search:
        pattern = re.compile(re.escape(search), re.IGNORECASE)
        query["$or"] = [{field: pattern} for field in ALLOWED_SEARCH_FIELDS]

    total = await employees_collection.count_documents(query)

    skip = (page - 1) * page_size
    total_pages = max(1, math.ceil(total / page_size)) if total else 1

    cursor = employees_collection.find(query).skip(skip).limit(page_size)
    items = []
    async for employee in cursor:
        items.append(serialize_employee(employee))

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
    }


@app.get("/employees/me", response_model=EmployeeSchema, tags=["employees"], summary="Get my employee profile")
async def get_my_employee(request: Request):
    """Return the employee record linked to the verified caller identity.

    The lookup key comes exclusively from the verified internal token claims;
    no email, id or tenant may be supplied through the request.
    """
    email = require_self_identity(request)
    tenant_id = getattr(request.state, "tenant_id", "default")
    employee = await employees_collection.find_one({"email": email, "tenant_id": tenant_id})
    if employee:
        return serialize_employee(employee)
    raise HTTPException(status_code=404, detail="No employee profile linked to this account")


@app.put("/employees/me", response_model=EmployeeSchema, tags=["employees"], summary="Update my employee profile")
async def update_my_employee(
    request: Request,
    employee: EmployeeSelfUpdateSchema = Body(...),
):
    """Update the caller's own profile details.

    The record is located by the verified identity only, so a caller can never
    edit somebody else's profile.
    """
    email = require_self_identity(request)
    tenant_id = getattr(request.state, "tenant_id", "default")
    existing = await employees_collection.find_one({"email": email, "tenant_id": tenant_id})
    if not existing:
        raise HTTPException(status_code=404, detail="No employee profile linked to this account")

    update_data = employee.model_dump(exclude_none=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    await employees_collection.update_one(
        {"email": email, "tenant_id": tenant_id},
        {"$set": update_data},
    )
    updated = await employees_collection.find_one({"email": email, "tenant_id": tenant_id})
    log_event("info", "employee.self_updated", tenant_id=tenant_id, fields=sorted(update_data.keys()))
    return serialize_employee(updated)


@app.get(
    "/employees/hierarchy",
    response_model=HierarchyResponse,
    tags=["employees"],
    summary="Get the employee reporting hierarchy",
)
async def get_employee_hierarchy(request: Request):
    """Return the reporting tree the caller is allowed to see.

    Permissions are enforced here, server-side: admin and hr see the whole
    tenant forest, everyone else sees only their own subtree (the people who
    report to them, directly or indirectly). Records with a missing or cyclic
    manager are surfaced as roots rather than dropped, and every node carries
    span-of-control counts for the manager facet.
    """
    tenant_id = getattr(request.state, "tenant_id", "default")
    role = str(getattr(request.state, "user_role", "employee") or "employee").lower()
    viewer_email = str(getattr(request.state, "user_email", "") or "").strip().lower()

    records = await load_hierarchy_records(tenant_id)
    nodes, roots = build_hierarchy(records)

    if role in PRIVILEGED_HIERARCHY_ROLES:
        visible_roots = roots
        scope = "tenant"
    else:
        viewer = nodes.get(viewer_email)
        if viewer is None:
            visible_roots = []
            scope = "none"
        else:
            visible_roots = [viewer]
            scope = "subtree"

    for root in visible_roots:
        compute_report_counts(root)

    total_visible = sum(1 + root["total_reports"] for root in visible_roots)
    return {
        "scope": scope,
        "viewer_email": viewer_email or None,
        "total_visible": total_visible,
        "roots": visible_roots,
    }


@app.get("/employees/{email}", response_model=EmployeeSchema, tags=["employees"], summary="Get employee by email")
async def get_employee(request: Request, email: str):
    """Fetch a single employee by their email address within a tenant scope."""
    validate_email_param(email)
    tenant_id = getattr(request.state, "tenant_id", "default")
    employee = await employees_collection.find_one({"email": email, "tenant_id": tenant_id})
    if employee:
        return serialize_employee(employee)
    await asyncio.sleep(random.uniform(0, 0.05))
    raise HTTPException(status_code=404, detail="Employee not found")


@app.post("/employees", response_model=EmployeeSchema, tags=["employees"], summary="Create employee")
async def create_employee(
    request: Request,
    employee: EmployeeSchema = Body(...),
):
    """Create a new employee record. Email must be unique per tenant."""
    tenant_id = getattr(request.state, "tenant_id", "default")
    employee_dict = employee.model_dump(by_alias=True, exclude_none=True)
    employee_dict["tenant_id"] = tenant_id

    manager_id = str(employee_dict.get("manager_id") or "").strip()
    if manager_id:
        employee_dict["manager_id"] = await resolve_manager_reference(
            tenant_id, manager_id, employee_email=employee.email
        )
    else:
        employee_dict.pop("manager_id", None)

    try:
        result = await employees_collection.insert_one(employee_dict)
        employee_dict["_id"] = str(result.inserted_id)
        return employee_dict
    except pymongo.errors.DuplicateKeyError:
        log_event("warning", "employee.duplicate_email", email=employee.email, tenant_id=tenant_id)
        raise HTTPException(
            status_code=409, detail="Employee with this email already exists in this tenant"
        )


@app.put("/employees/{email}", response_model=EmployeeSchema, tags=["employees"], summary="Update employee")
async def update_employee(
    request: Request,
    email: str,
    employee: EmployeeUpdateSchema = Body(...),
):
    """Update an existing employee's details. Email change is validated for uniqueness."""
    validate_email_param(email)
    tenant_id = getattr(request.state, "tenant_id", "default")
    existing = await employees_collection.find_one({"email": email, "tenant_id": tenant_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Employee not found")

    update_data = employee.model_dump(exclude_none=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    unset_manager = False
    if "manager_id" in update_data:
        new_manager = str(update_data["manager_id"] or "").strip()
        if new_manager:
            update_data["manager_id"] = await resolve_manager_reference(
                tenant_id,
                new_manager,
                employee_email=update_data.get("email", email),
            )
        else:
            del update_data["manager_id"]
            unset_manager = True

    if "email" in update_data and update_data["email"] != email:
        duplicate = await employees_collection.find_one(
            {"email": update_data["email"], "tenant_id": tenant_id}
        )
        if duplicate:
            raise HTTPException(status_code=400, detail="Email already in use")

    update_doc = {}
    if update_data:
        update_doc["$set"] = update_data
    if unset_manager:
        update_doc["$unset"] = {"manager_id": ""}

    await employees_collection.update_one(
        {"email": email, "tenant_id": tenant_id},
        update_doc
    )

    updated = await employees_collection.find_one({"email": update_data.get("email", email), "tenant_id": tenant_id})
    return serialize_employee(updated)


@app.delete("/employees/{email}", tags=["employees"], summary="Delete employee")
async def delete_employee(
    request: Request,
    email: str,
):
    """Permanently delete an employee record."""
    validate_email_param(email)
    tenant_id = getattr(request.state, "tenant_id", "default")
    result = await employees_collection.delete_one({"email": email, "tenant_id": tenant_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Employee not found")
    await publish_delete_event(email, tenant_id)
    return {"message": "Employee deleted successfully"}


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8001))
    uvicorn.run(app, host="0.0.0.0", port=port)
