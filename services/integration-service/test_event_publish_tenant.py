"""Guards for #317: the event publish edge must route on verified identity, not the body."""
import ast
import unittest
from pathlib import Path

MAIN = Path(__file__).with_name("main.py").read_text(encoding="utf-8")
SCHEMAS = Path(__file__).with_name("schemas.py").read_text(encoding="utf-8")


class EventPublishTenantGuards(unittest.TestCase):
    def test_publish_endpoint_has_tenant_check(self):
        tree = ast.parse(MAIN)
        fn = next(
            n for n in tree.body
            if isinstance(n, ast.AsyncFunctionDef) and n.name == "publish_internal_event"
        )
        src = ast.get_source_segment(MAIN, fn)
        self.assertIn("check_body_tenant", src, "publish must reject a mismatched body tenant")
        self.assertIn('getattr(request.state, "tenant_id", None)', src, "publish must read the verified tenant")
        self.assertIn("route_event(payload.event_type, verified_tenant", src, "publish must route on the verified tenant")
        self.assertNotIn("route_event(payload.event_type, payload.tenant_id", src, "must not route on the body tenant")

    def test_helper_rejects_mismatch(self):
        self.assertIn("def check_body_tenant", MAIN)
        self.assertIn('raise HTTPException(status_code=403, detail="Tenant mismatch")', MAIN)

    def test_schema_does_not_default_tenant_to_generic(self):
        tree = ast.parse(SCHEMAS)
        cls = next(
            n for n in tree.body
            if isinstance(n, ast.ClassDef) and n.name == "EventPublishRequest"
        )
        src = ast.get_source_segment(SCHEMAS, cls)
        self.assertNotIn('default="default"', src, "an omitted body tenant must not look like a 'default' claim")
        self.assertIn("tenant_id: Optional[str]", src)

    def test_schema_forbids_extra_fields(self):
        self.assertIn('model_config = {"extra": "forbid"}', SCHEMAS)

    def test_middleware_stores_verified_tenant(self):
        self.assertIn('request.state.tenant_id = claims.get("tenant_id", "default")', MAIN)


if __name__ == "__main__":
    unittest.main()
