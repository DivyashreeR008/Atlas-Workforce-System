from fastapi import FastAPI, HTTPException, Body, Query
from pydantic import BaseModel, Field
from typing import List, Optional
import os
import math
import re
import uvicorn
# pyrefly: ignore [missing-import]
from motor.motor_asyncio import AsyncIOMotorClient
from contextlib import asynccontextmanager

MONGO_URL = os.environ.get(
    "MONGO_URL",
    "mongodb://admin:REDACTED_DATABASE_PASSWORD@localhost:27017/atlas_db?authSource=admin",
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


app = FastAPI(title="Employee Service API", version="1.0.0", lifespan=lifespan)


class EmployeeSchema(BaseModel):
    id: Optional[int] = Field(None, alias="_id")
    name: str
    department: str
    position: str
    email: str

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


@app.get("/health")
async def health_check():
    try:
        await client.admin.command("ping")
        return {"status": "Employee Service is running", "database": "connected"}
    except Exception as e:
        return {
            "status": "Employee Service is running",
            "database": "disconnected",
            "error": str(e),
        }


@app.get("/employees", response_model=PaginatedEmployees)
async def get_employees(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    search: Optional[str] = Query(None),
):
    query = {}
    if search:
        pattern = re.compile(re.escape(search), re.IGNORECASE)
        query = {
            "$or": [
                {"name": pattern},
                {"email": pattern},
                {"department": pattern},
                {"position": pattern},
            ]
        }

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


@app.get("/employees/{email}", response_model=EmployeeSchema)
async def get_employee(email: str):
    employee = await employees_collection.find_one({"email": email})
    if employee:
        return serialize_employee(employee)
    raise HTTPException(status_code=404, detail="Employee not found")


@app.post("/employees", response_model=EmployeeSchema)
async def create_employee(employee: EmployeeSchema = Body(...)):
    employee_dict = employee.model_dump(by_alias=True, exclude_none=True)

    existing = await employees_collection.find_one({"email": employee.email})
    if existing:
        raise HTTPException(
            status_code=400, detail="Employee with this email already exists"
        )

    result = await employees_collection.insert_one(employee_dict)
    employee_dict["_id"] = str(result.inserted_id)
    return employee_dict


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8001))
    uvicorn.run(app, host="0.0.0.0", port=port)
