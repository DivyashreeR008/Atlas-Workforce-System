"""Tests for the Employee Service API using FastAPI TestClient."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from httpx import ASGITransport, AsyncClient
from main import app


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
    return AsyncClient(transport=transport, base_url="http://test")


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
    response = await client.get("/employees", headers={"X-Tenant-Id": "test-tenant"})
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
        headers={"X-Tenant-Id": "test-tenant"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["page"] == 1
    assert data["page_size"] == 5


@pytest.mark.asyncio
async def test_get_nonexistent_employee(client):
    response = await client.get(
        "/employees/nonexistent@test.com",
        headers={"X-Tenant-Id": "test-tenant"},
    )
    assert response.status_code == 404
    assert response.json()["detail"] == "Employee not found"


@pytest.mark.asyncio
async def test_invalid_page_param(client):
    response = await client.get(
        "/employees?page=0",
        headers={"X-Tenant-Id": "test-tenant"},
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_employees_with_search(client):
    response = await client.get(
        "/employees?search=engineering",
        headers={"X-Tenant-Id": "test-tenant"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
