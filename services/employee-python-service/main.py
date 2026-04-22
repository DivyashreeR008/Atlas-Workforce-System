from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import os
import uvicorn

app = FastAPI(title="Employee Service API", version="1.0.0")

class Employee(BaseModel):
    id: int
    name: str
    department: str
    position: str

# Dummy database
employees = [
    {"id": 1, "name": "John Doe", "department": "Engineering", "position": "Software Engineer"}
]

@app.get("/health")
def health_check():
    return {"status": "Employee Service is running"}

@app.get("/employees", response_model=list[Employee])
def get_employees():
    return employees

@app.get("/employees/{emp_id}", response_model=Employee)
def get_employee(emp_id: int):
    for emp in employees:
        if emp["id"] == emp_id:
            return emp
    raise HTTPException(status_code=404, detail="Employee not found")

@app.post("/employees", response_model=Employee)
def create_employee(employee: Employee):
    employees.append(employee.dict())
    # TODO: Publish event to RabbitMQ for Notification Service
    return employee

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8001))
    uvicorn.run(app, host="0.0.0.0", port=port)
