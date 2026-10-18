"""Tests for the Employee Service API using FastAPI TestClient."""

import base64
import hashlib
import hmac
import json
import os
import time
from types import SimpleNamespace

os.environ.setdefault("INTERNAL_JWT_SECRET", "test-secret")

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from httpx import ASGITransport, AsyncClient
import pymongo.errors
from main import app, lifespan

INTERNAL_JWT_SECRET = os.environ.get("INTERNAL_JWT_SECRET", "test-secret")


def _make_internal_token(secret: str, tenant_id: str = "test-tenant", email=None, role=None) -> str:
    claims = {"sub": "test", "tenant_id": tenant_id, "exp": int(time.time()) + 3600}
    if email is not None:
        claims["email"] = email
    if role is not None:
        claims["user_role"] = role
    hdr = base64.urlsafe_b64encode(
        json.dumps({"alg": "HS256", "typ": "JWT"}).encode()
    ).rstrip(b"=").decode()
    payload = base64.urlsafe_b64encode(
        json.dumps(claims).encode()
    ).rstrip(b"=").decode()
    sig = base64.urlsafe_b64encode(
        hmac.new(secret.encode(), f"{hdr}.{payload}".encode(), hashlib.sha256).digest()
    ).rstrip(b"=").decode()
    return f"{hdr}.{payload}.{sig}"


class AsyncCursorMock:
    """Mocks a MongoDB cursor supporting async iteration and chaining (find.skip.limit)."""

    def __init__(self, items=None):
        self.items = items or []
        self._iter = None

    def sort(self, *args, **kwargs):
        return self

    def skip(self, *args, **kwargs):
        return self

    def limit(self, *args, **kwargs):
        return self

    def __aiter__(self):
        self._iter = iter(self.items)
        return self

    async def __anext__(self):
        try:
            return next(self._iter)
        except StopIteration:
            raise StopAsyncIteration

    async def to_list(self, length):
        return self.items


@pytest.fixture
def client():
    transport = ASGITransport(app=app)
    token = _make_internal_token(INTERNAL_JWT_SECRET, tenant_id="test-tenant")
    return AsyncClient(transport=transport, base_url="http://test", headers={"x-internal-auth": token})


@pytest.fixture(autouse=True)
def mock_mongodb():
    """Mock MongoDB collection to avoid needing a real connection during tests."""
    mock_collection = MagicMock()
    mock_collection.count_documents = AsyncMock(return_value=0)
    mock_collection.find_one = AsyncMock(return_value=None)
    mock_collection.find = MagicMock(return_value=AsyncCursorMock())
    mock_collection.insert_one = AsyncMock()
    mock_collection.update_one = AsyncMock()
    mock_collection.delete_one = AsyncMock()

    with patch("main.employees_collection", mock_collection):
        yield mock_collection


@pytest.mark.asyncio
async def test_health_check(client):
    response = await client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert "Employee Service" in data["status"]


@pytest.mark.asyncio
async def test_get_employees_empty(client):
    response = await client.get("/employees")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "total" in data
    assert "page" in data
    assert "page_size" in data


@pytest.mark.asyncio
async def test_get_employees_pagination(client):
    response = await client.get(
        "/employees?page=1&page_size=5",
    )
    assert response.status_code == 200
    data = response.json()
    assert data["page"] == 1
    assert data["page_size"] == 5


@pytest.mark.asyncio
async def test_get_nonexistent_employee(client):
    response = await client.get(
        "/employees/nonexistent@test.com",
    )
    assert response.status_code == 404
    assert response.json()["detail"] == "Employee not found"


@pytest.mark.asyncio
async def test_invalid_page_param(client):
    response = await client.get(
        "/employees?page=0",
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_employees_with_search(client):
    response = await client.get(
        "/employees?search=engineering",
    )
    assert response.status_code == 200
    data = response.json()
    assert "items" in data


@pytest.mark.asyncio
async def test_get_employees_requires_auth():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as unauth:
        response = await unauth.get("/employees")
        assert response.status_code == 401
        assert "Missing internal authentication" in response.json().get("detail", "")


@pytest.mark.asyncio
async def test_post_employees_requires_auth():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as unauth:
        response = await unauth.post(
            "/employees",
            json={"name": "x", "department": "y", "position": "z", "email": "x@y.io"},
        )
        assert response.status_code == 401


@pytest.mark.asyncio
async def test_tenant_isolation_ignores_header(client, mock_mongodb):
    # Client token is for tenant-a, but header tries to force tenant-b
    token_b = _make_internal_token(INTERNAL_JWT_SECRET, tenant_id="tenant-a")
    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport, base_url="http://test", headers={"x-internal-auth": token_b, "X-Tenant-Id": "tenant-b"}
    ) as c:
        await c.get("/employees")
        # Verify query used tenant-a from token, not tenant-b from header
        assert mock_mongodb.count_documents.called
        call_kwargs = mock_mongodb.count_documents.call_args[0][0] if mock_mongodb.count_documents.call_args else {}
        # count_documents called with query dict containing tenant_id
        assert call_kwargs.get("tenant_id") == "tenant-a"


class FakeTenantCollection:
    """In-memory stand-in for the employees collection that enforces the
    per-tenant unique index on (tenant_id, email) the way Mongo does."""

    def __init__(self):
        self.docs = []

    async def insert_one(self, doc):
        for existing in self.docs:
            if existing.get("tenant_id") == doc.get("tenant_id") and existing.get("email") == doc.get("email"):
                raise pymongo.errors.DuplicateKeyError("E11000 duplicate key error on tenant_id/email")
        stored = dict(doc)
        stored["_id"] = f"fake-id-{len(self.docs)}"
        self.docs.append(stored)

        class _Result:
            pass

        result = _Result()
        result.inserted_id = stored["_id"]
        return result


def _employee_payload(name="Jane", email="jane@example.com"):
    return {"name": name, "department": "Engineering", "position": "Dev", "email": email}


@pytest.mark.asyncio
async def test_create_same_email_different_tenants():
    fake = FakeTenantCollection()
    transport = ASGITransport(app=app)
    with patch("main.employees_collection", fake):
        async with AsyncClient(
            transport=transport,
            base_url="http://test",
            headers={"x-internal-auth": _make_internal_token(INTERNAL_JWT_SECRET, tenant_id="tenant-a")},
        ) as c:
            resp = await c.post("/employees", json=_employee_payload(name="A"))
            assert resp.status_code == 200
        async with AsyncClient(
            transport=transport,
            base_url="http://test",
            headers={"x-internal-auth": _make_internal_token(INTERNAL_JWT_SECRET, tenant_id="tenant-b")},
        ) as c:
            resp = await c.post("/employees", json=_employee_payload(name="B"))
            assert resp.status_code == 200


@pytest.mark.asyncio
async def test_create_duplicate_email_same_tenant_returns_409():
    fake = FakeTenantCollection()
    transport = ASGITransport(app=app)
    headers = {"x-internal-auth": _make_internal_token(INTERNAL_JWT_SECRET, tenant_id="tenant-a")}
    with patch("main.employees_collection", fake):
        async with AsyncClient(transport=transport, base_url="http://test", headers=headers) as c:
            first = await c.post("/employees", json=_employee_payload())
            assert first.status_code == 200
            second = await c.post("/employees", json=_employee_payload(name="Other"))
            assert second.status_code == 409
            assert "this tenant" in second.json()["detail"]


@pytest.mark.asyncio
async def test_lifespan_migrates_email_index_to_per_tenant():
    mock_collection = MagicMock()
    mock_collection.drop_index = AsyncMock()
    mock_collection.create_index = AsyncMock()
    with patch("main.employees_collection", mock_collection):
        async with lifespan(app):
            pass
    mock_collection.drop_index.assert_called_once_with("email_1")
    created = [(call.args[0], call.kwargs) for call in mock_collection.create_index.call_args_list]
    assert ([("tenant_id", 1), ("email", 1)], {"unique": True}) in created
    for args, kwargs in created:
        assert not (args == "email" and kwargs.get("unique") is True), \
            "global unique email index must not be created"


# ---------------------------------------------------------------------------
# Reporting hierarchy (/employees/hierarchy)
#
# The tree is assembled server-side and scoped from the verified role and
# email claims: admin/hr see the tenant forest, everyone else only their own
# subtree. Hidden subtrees must never be serialized, and dirty manager links
# (missing or cyclic) must not break the response.
# ---------------------------------------------------------------------------

TENANT_TREE = [
    {"_id": "1", "name": "Alice Root", "email": "alice@acme.io",
     "department": "Executive", "position": "CEO", "tenant_id": "test-tenant"},
    {"_id": "2", "name": "Bob Lead", "email": "bob@acme.io",
     "department": "Engineering", "position": "Engineering Manager",
     "manager_id": "alice@acme.io", "tenant_id": "test-tenant"},
    {"_id": "3", "name": "Carol Staff", "email": "carol@acme.io",
     "department": "Engineering", "position": "Developer",
     "manager_id": "bob@acme.io", "tenant_id": "test-tenant"},
    {"_id": "4", "name": "Dave Lead", "email": "dave@acme.io",
     "department": "Sales", "position": "Sales Manager",
     "manager_id": "alice@acme.io", "tenant_id": "test-tenant"},
    {"_id": "5", "name": "Eve Staff", "email": "eve@acme.io",
     "department": "Sales", "position": "Account Executive",
     "manager_id": "dave@acme.io", "tenant_id": "test-tenant"},
]


def _seeded_hierarchy(records):
    return MagicMock(return_value=AsyncCursorMock([dict(record) for record in records]))


def _hierarchy_client(email, role):
    token = _make_internal_token(INTERNAL_JWT_SECRET, email=email, role=role)
    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://test", headers={"x-internal-auth": token})


def _emails_in(roots):
    found = []
    stack = list(roots)
    while stack:
        node = stack.pop()
        found.append(node["email"])
        stack.extend(node.get("children", []))
    return found


@pytest.mark.asyncio
async def test_hierarchy_admin_sees_whole_tenant_tree(mock_mongodb):
    mock_mongodb.find = _seeded_hierarchy(TENANT_TREE)
    async with _hierarchy_client("admin@acme.io", "admin") as c:
        resp = await c.get("/employees/hierarchy")

    assert resp.status_code == 200
    body = resp.json()
    assert body["scope"] == "tenant"
    assert body["total_visible"] == 5
    assert sorted(_emails_in(body["roots"])) == [
        "alice@acme.io", "bob@acme.io", "carol@acme.io", "dave@acme.io", "eve@acme.io",
    ]
    alice = body["roots"][0]
    assert alice["email"] == "alice@acme.io"
    assert alice["direct_reports"] == 2
    assert alice["total_reports"] == 4
    bob = next(node for node in alice["children"] if node["email"] == "bob@acme.io")
    assert bob["direct_reports"] == 1
    assert bob["total_reports"] == 1
    # Tenant comes from the verified token; the query must stay tenant-scoped.
    assert mock_mongodb.find.call_args[0][0] == {"tenant_id": "test-tenant"}


@pytest.mark.asyncio
async def test_hierarchy_manager_sees_only_own_subtree(mock_mongodb):
    mock_mongodb.find = _seeded_hierarchy(TENANT_TREE)
    async with _hierarchy_client("bob@acme.io", "manager") as c:
        resp = await c.get("/employees/hierarchy")

    assert resp.status_code == 200
    body = resp.json()
    assert body["scope"] == "subtree"
    assert body["total_visible"] == 2
    visible = _emails_in(body["roots"])
    assert sorted(visible) == ["bob@acme.io", "carol@acme.io"]
    # The sibling subtree must not leak in any form.
    assert "dave@acme.io" not in json.dumps(body)
    assert body["roots"][0]["total_reports"] == 1


@pytest.mark.asyncio
async def test_hierarchy_employee_sees_only_themselves(mock_mongodb):
    mock_mongodb.find = _seeded_hierarchy(TENANT_TREE)
    async with _hierarchy_client("eve@acme.io", "employee") as c:
        resp = await c.get("/employees/hierarchy")

    body = resp.json()
    assert body["scope"] == "subtree"
    assert body["total_visible"] == 1
    assert _emails_in(body["roots"]) == ["eve@acme.io"]


@pytest.mark.asyncio
async def test_hierarchy_unknown_viewer_gets_empty_tree(mock_mongodb):
    mock_mongodb.find = _seeded_hierarchy(TENANT_TREE)
    async with _hierarchy_client("ghost@acme.io", "manager") as c:
        resp = await c.get("/employees/hierarchy")

    body = resp.json()
    assert body["scope"] == "none"
    assert body["roots"] == []
    assert body["total_visible"] == 0


@pytest.mark.asyncio
async def test_hierarchy_survives_cycles_and_dangling_managers(mock_mongodb):
    records = [
        {"_id": "1", "name": "Root", "email": "root@acme.io",
         "department": "Executive", "position": "CEO", "tenant_id": "test-tenant"},
        {"_id": "2", "name": "Xing", "email": "x@acme.io",
         "department": "Ops", "position": "Lead", "manager_id": "y@acme.io",
         "tenant_id": "test-tenant"},
        {"_id": "3", "name": "Yara", "email": "y@acme.io",
         "department": "Ops", "position": "Lead", "manager_id": "x@acme.io",
         "tenant_id": "test-tenant"},
        {"_id": "4", "name": "Zoe", "email": "z@acme.io",
         "department": "Ops", "position": "Analyst", "manager_id": "missing@acme.io",
         "tenant_id": "test-tenant"},
    ]
    mock_mongodb.find = _seeded_hierarchy(records)
    async with _hierarchy_client("admin@acme.io", "admin") as c:
        resp = await c.get("/employees/hierarchy")

    assert resp.status_code == 200
    body = resp.json()
    visible = sorted(_emails_in(body["roots"]))
    # Every employee is still surfaced; the cycle pair is split so that one
    # node becomes a root instead of hanging the traversal.
    assert visible == ["root@acme.io", "x@acme.io", "y@acme.io", "z@acme.io"]
    assert body["total_visible"] == 4


@pytest.mark.asyncio
async def test_create_employee_validates_and_normalizes_manager(mock_mongodb):
    manager_doc = {"_id": "1", "name": "Alice Root", "email": "alice@acme.io",
                   "department": "Executive", "position": "CEO", "tenant_id": "test-tenant"}
    mock_mongodb.find_one = AsyncMock(side_effect=[manager_doc])
    mock_mongodb.insert_one = AsyncMock(return_value=SimpleNamespace(inserted_id="new-id"))

    async with _hierarchy_client("admin@acme.io", "admin") as c:
        resp = await c.post("/employees", json={
            "name": "New Hire", "email": "new@acme.io",
            "department": "Engineering", "position": "Developer",
            "manager_id": "Alice@Acme.io",
        })

    assert resp.status_code == 200
    inserted = mock_mongodb.insert_one.call_args[0][0]
    assert inserted["manager_id"] == "alice@acme.io"


@pytest.mark.asyncio
async def test_create_employee_rejects_unknown_and_self_manager(mock_mongodb):
    async with _hierarchy_client("admin@acme.io", "admin") as c:
        mock_mongodb.find_one = AsyncMock(return_value=None)
        unknown = await c.post("/employees", json={
            "name": "New Hire", "email": "new@acme.io",
            "department": "Engineering", "position": "Developer",
            "manager_id": "ghost@acme.io",
        })
        assert unknown.status_code == 400
        assert "tenant" in unknown.json()["detail"]

        self_ref = await c.post("/employees", json={
            "name": "New Hire", "email": "new@acme.io",
            "department": "Engineering", "position": "Developer",
            "manager_id": "new@acme.io",
        })
        assert self_ref.status_code == 400
        assert "themselves" in self_ref.json()["detail"]

    assert not mock_mongodb.insert_one.called


@pytest.mark.asyncio
async def test_update_employee_rejects_reporting_cycle(mock_mongodb):
    carol = {"_id": "3", "name": "Carol Staff", "email": "carol@acme.io",
             "department": "Engineering", "position": "Developer", "tenant_id": "test-tenant"}
    bob = {"_id": "2", "name": "Bob Lead", "email": "bob@acme.io",
           "department": "Engineering", "position": "Engineering Manager",
           "manager_id": "carol@acme.io", "tenant_id": "test-tenant"}
    mock_mongodb.find_one = AsyncMock(side_effect=[carol, bob])

    async with _hierarchy_client("admin@acme.io", "admin") as c:
        resp = await c.put("/employees/carol@acme.io", json={"manager_id": "bob@acme.io"})

    assert resp.status_code == 400
    assert "cycle" in resp.json()["detail"]
    assert not mock_mongodb.update_one.called


@pytest.mark.asyncio
async def test_update_employee_can_clear_manager(mock_mongodb):
    alice = {"_id": "1", "name": "Alice Root", "email": "alice@acme.io",
             "department": "Executive", "position": "CEO",
             "manager_id": "bob@acme.io", "tenant_id": "test-tenant"}
    cleared = {key: value for key, value in alice.items() if key != "manager_id"}
    mock_mongodb.find_one = AsyncMock(side_effect=[alice, cleared])

    async with _hierarchy_client("admin@acme.io", "admin") as c:
        resp = await c.put("/employees/alice@acme.io", json={"manager_id": ""})

    assert resp.status_code == 200
    update_doc = mock_mongodb.update_one.call_args[0][1]
    assert update_doc["$unset"] == {"manager_id": ""}
    assert "$set" not in update_doc
