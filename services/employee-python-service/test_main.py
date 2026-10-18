"""Tests for the Employee Service API using FastAPI TestClient."""

import base64
import hashlib
import hmac
import json
import os
import time

os.environ.setdefault("INTERNAL_JWT_SECRET", "test-secret")

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from httpx import ASGITransport, AsyncClient
import pymongo.errors
from main import app, lifespan

INTERNAL_JWT_SECRET = os.environ.get("INTERNAL_JWT_SECRET", "test-secret")


def _make_internal_token(secret: str, tenant_id: str = "test-tenant", email: str = None) -> str:
    claims = {"sub": "test", "tenant_id": tenant_id, "exp": int(time.time()) + 3600}
    if email is not None:
        claims["email"] = email
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
# Self-service profile endpoints (/employees/me)
#
# The caller identity must come from the verified internal token only. A
# client-supplied email (path, query or body) must never widen or redirect
# the lookup, so a forged identity returns nothing belonging to another user.
# ---------------------------------------------------------------------------

JANE_DOC = {
    "_id": "fake-jane-id",
    "name": "Jane Doe",
    "department": "Engineering",
    "position": "Developer",
    "email": "jane@acme.io",
    "tenant_id": "test-tenant",
}


def _self_client(email=None, tenant_id="test-tenant"):
    token = _make_internal_token(INTERNAL_JWT_SECRET, tenant_id=tenant_id, email=email)
    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://test", headers={"x-internal-auth": token})


@pytest.mark.asyncio
async def test_my_profile_requires_verified_identity_claim():
    # A token without an email claim (service-to-service style) must fail
    # closed instead of falling back to request-supplied identifiers.
    async with _self_client(email=None) as c:
        resp = await c.get("/employees/me")
        assert resp.status_code == 401
        assert "identity" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_my_profile_reads_only_the_verified_identity(mock_mongodb):
    mock_mongodb.find_one = AsyncMock(return_value=dict(JANE_DOC))
    async with _self_client(email="jane@acme.io") as c:
        # Forged identity in the query string must be ignored.
        resp = await c.get("/employees/me?email=mallory@acme.io")
    assert resp.status_code == 200
    assert resp.json()["email"] == "jane@acme.io"
    query = mock_mongodb.find_one.call_args[0][0]
    assert query == {"email": "jane@acme.io", "tenant_id": "test-tenant"}


@pytest.mark.asyncio
async def test_my_profile_unknown_identity_returns_404(mock_mongodb):
    mock_mongodb.find_one = AsyncMock(return_value=None)
    async with _self_client(email="ghost@acme.io") as c:
        resp = await c.get("/employees/me")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_my_profile_update_is_scoped_to_the_verified_identity(mock_mongodb):
    mock_mongodb.find_one = AsyncMock(side_effect=[
        dict(JANE_DOC),
        {**JANE_DOC, "name": "Jane D.", "phone": "+1 555 0100"},
    ])
    async with _self_client(email="jane@acme.io") as c:
        resp = await c.put(
            "/employees/me",
            json={
                "name": "Jane D.",
                "phone": "+1 555 0100",
                # Fields outside the self-service allowlist must not land.
                "email": "mallory@acme.io",
                "department": "Sales",
            },
        )
    assert resp.status_code == 200
    assert resp.json()["name"] == "Jane D."

    filter_arg = mock_mongodb.update_one.call_args[0][0]
    update_arg = mock_mongodb.update_one.call_args[0][1]
    assert filter_arg == {"email": "jane@acme.io", "tenant_id": "test-tenant"}
    assert set(update_arg["$set"].keys()) == {"name", "phone"}


@pytest.mark.asyncio
async def test_my_profile_update_rejects_invalid_phone(mock_mongodb):
    mock_mongodb.find_one = AsyncMock(return_value=dict(JANE_DOC))
    async with _self_client(email="jane@acme.io") as c:
        resp = await c.put("/employees/me", json={"phone": "not-a-phone"})
    assert resp.status_code == 422
    assert not mock_mongodb.update_one.called


@pytest.mark.asyncio
async def test_my_profile_update_requires_at_least_one_field(mock_mongodb):
    mock_mongodb.find_one = AsyncMock(return_value=dict(JANE_DOC))
    async with _self_client(email="jane@acme.io") as c:
        resp = await c.put("/employees/me", json={})
    assert resp.status_code == 400
    assert not mock_mongodb.update_one.called
