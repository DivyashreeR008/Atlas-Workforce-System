from fastapi import FastAPI, HTTPException, Body, Query, Header
from fastapi.openapi.utils import get_openapi
from pydantic import BaseModel, Field
from typing import List, Optional
import os
import math
import re
import uvicorn
# pyrefly: ignore [missing-import]
from motor.motor_asyncio import AsyncIOMotorClient
from contextlib import asynccontextmanager

MONGO_USER = os.environ.get("MONGO_USER", "admin")
MONGO_PASSWORD = os.environ.get("MONGO_PASSWORD", "admin_password")
MONGO_HOST = os.environ.get("MONGO_HOST", "localhost")
MONGO_DB = os.environ.get("MONGO_DB", "atlas_db")
MONGO_URL = os.environ.get(
    "MONGO_URL",
    f"mongodb://{MONGO_USER}:{MONGO_PASSWORD}@{MONGO_HOST}:27017/{MONGO_DB}?authSource=admin",
)
DB_NAME = "atlas_db"

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]
employees_collection = db["employees"]


@asynccontextmanager
async def lifespan(app: FastAPI):
    print(f"Connecting to MongoDB at {MONGO_URL}")
    try:
        await employees_collection.create_index("email", unique=True)
        await employees_collection.create_index("name")
        await employees_collection.create_index("department")
        print("MongoDB indexes created successfully")
    except Exception as e:
        print(f"Warning: Failed to create MongoDB indexes: {e}")
    yield
    client.close()


app = FastAPI(title="Employee Service API", version="2.0.0", lifespan=lifespan)


def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    openapi_schema = get_openapi(
        title="Atlas Employee Service",
        version="2.0.0",
        description="Manages employee records, directory, and lifecycle. Part of the Atlas Workforce System.",
        routes=app.routes,
    )
    openapi_schema["servers"] = [{"url": "http://localhost:8001", "description": "Local development"}]
    openapi_schema["tags"] = [
        {"name": "employees", "description": "Employee CRUD operations"},
        {"name": "health", "description": "Service health check"},
    ]
    app.openapi_schema = openapi_schema
    return app.openapi_schema


app.openapi = custom_openapi


class EmployeeSchema(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    name: str = Field(..., description="Full name of the employee")
    department: str = Field(..., description="Department name")
    position: str = Field(..., description="Job position/title")
    email: str = Field(..., description="Employee email address (unique per tenant)")
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
    name: Optional[str] = Field(None, description="Updated full name")
    department: Optional[str] = Field(None, description="Updated department")
    position: Optional[str] = Field(None, description="Updated position")
    email: Optional[str] = Field(None, description="Updated email")


@app.get("/health", tags=["health"])
async def health_check():
    """Check if the service and database are healthy."""
    try:
        await client.admin.command("ping")
        return {"status": "Employee Service is running", "database": "connected"}
    except Exception as e:
        return {
            "status": "Employee Service is running",
            "database": "disconnected",
            "error": str(e),
        }


@app.get("/employees", response_model=PaginatedEmployees, tags=["employees"], summary="List all employees")
async def get_employees(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(10, ge=1, le=100, description="Items per page"),
    search: Optional[str] = Query(None, description="Search by name, email, department, or position"),
    x_tenant_id: str = Header("default", alias="X-Tenant-Id"),
):
    """Retrieve a paginated, searchable list of employees scoped to a tenant."""
    query = {"tenant_id": x_tenant_id}
    if search:
        pattern = re.compile(re.escape(search), re.IGNORECASE)
        query["$or"] = [
            {"name": pattern},
            {"email": pattern},
            {"department": pattern},
            {"position": pattern},
        ]

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


@app.get("/employees/{email}", response_model=EmployeeSchema, tags=["employees"], summary="Get employee by email")
async def get_employee(email: str, x_tenant_id: str = Header("default", alias="X-Tenant-Id")):
    """Fetch a single employee by their email address within a tenant scope."""
    employee = await employees_collection.find_one({"email": email, "tenant_id": x_tenant_id})
    if employee:
        return serialize_employee(employee)
    raise HTTPException(status_code=404, detail="Employee not found")


@app.post("/employees", response_model=EmployeeSchema, tags=["employees"], summary="Create employee")
async def create_employee(
    employee: EmployeeSchema = Body(...),
    x_tenant_id: str = Header("default", alias="X-Tenant-Id")
):
    """Create a new employee record. Email must be unique per tenant."""
    employee_dict = employee.model_dump(by_alias=True, exclude_none=True)
    employee_dict["tenant_id"] = x_tenant_id

    existing = await employees_collection.find_one({"email": employee.email, "tenant_id": x_tenant_id})
    if existing:
        raise HTTPException(
            status_code=400, detail="Employee with this email already exists"
        )

    result = await employees_collection.insert_one(employee_dict)
    employee_dict["_id"] = str(result.inserted_id)
    return employee_dict


@app.put("/employees/{email}", response_model=EmployeeSchema, tags=["employees"], summary="Update employee")
async def update_employee(
    email: str,
    employee: EmployeeUpdateSchema = Body(...),
    x_tenant_id: str = Header("default", alias="X-Tenant-Id")
):
    """Update an existing employee's details. Email change is validated for uniqueness."""
    existing = await employees_collection.find_one({"email": email, "tenant_id": x_tenant_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Employee not found")

    update_data = employee.model_dump(exclude_none=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    if "email" in update_data and update_data["email"] != email:
        duplicate = await employees_collection.find_one(
            {"email": update_data["email"], "tenant_id": x_tenant_id}
        )
        if duplicate:
            raise HTTPException(status_code=400, detail="Email already in use")

    await employees_collection.update_one(
        {"email": email, "tenant_id": x_tenant_id},
        {"$set": update_data}
    )

    updated = await employees_collection.find_one({"email": update_data.get("email", email), "tenant_id": x_tenant_id})
    return serialize_employee(updated)


@app.delete("/employees/{email}", tags=["employees"], summary="Delete employee")
async def delete_employee(email: str, x_tenant_id: str = Header("default", alias="X-Tenant-Id")):
    """Permanently delete an employee record."""
    result = await employees_collection.delete_one({"email": email, "tenant_id": x_tenant_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Employee not found")
    return {"message": "Employee deleted successfully"}


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8001))
    uvicorn.run(app, host="0.0.0.0", port=port)
