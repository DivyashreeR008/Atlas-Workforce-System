from fastapi import FastAPI, HTTPException, Body
from pydantic import BaseModel, Field
from typing import List, Optional
import os
import uvicorn
from motor.motor_asyncio import AsyncIOMotorClient
from contextlib import asynccontextmanager

# Configuration
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://admin:REDACTED_DATABASE_PASSWORD@localhost:27017/atlas_db?authSource=admin")
DB_NAME = "atlas_db"

# Database Connection
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]
employees_collection = db["employees"]

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initial check or setup if needed
    print(f"Connecting to MongoDB at {MONGO_URL}")
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
                "email": "john.doe@atlas.io"
            }
        }

@app.get("/health")
async def health_check():
    try:
        await client.admin.command('ping')
        return {"status": "Employee Service is running", "database": "connected"}
    except Exception as e:
        return {"status": "Employee Service is running", "database": "disconnected", "error": str(e)}

@app.get("/employees", response_model=List[EmployeeSchema])
async def get_employees():
    employees = []
    async for employee in employees_collection.find().limit(100):
        employee["_id"] = str(employee["_id"]) # Convert ObjectId to string if needed or use custom ID
        employees.append(employee)
    return employees

@app.get("/employees/{email}", response_model=EmployeeSchema)
async def get_employee(email: str):
    employee = await employees_collection.find_one({"email": email})
    if employee:
        employee["_id"] = str(employee["_id"])
        return employee
    raise HTTPException(status_code=404, detail="Employee not found")

@app.post("/employees", response_model=EmployeeSchema)
async def create_employee(employee: EmployeeSchema = Body(...)):
    employee_dict = employee.dict(by_alias=True, exclude_none=True)
    
    # Check if exists
    existing = await employees_collection.find_one({"email": employee.email})
    if existing:
        raise HTTPException(status_code=400, detail="Employee with this email already exists")
    
    result = await employees_collection.insert_one(employee_dict)
    employee_dict["_id"] = str(result.inserted_id)
    
    # TODO: Publish event to RabbitMQ for Notification Service
    
    return employee_dict

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8001))
    uvicorn.run(app, host="0.0.0.0", port=port)
