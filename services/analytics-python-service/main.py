from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import os
import uvicorn
from sqlalchemy import create_engine, text
from openai import OpenAI
import json

app = FastAPI(title="Analytics Service API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATABASE_URL = os.environ.get(
    "POSTGRES_URL", "postgresql://atlas_user:REDACTED_DATABASE_PASSWORD@postgres:5432/atlas_db"
)

try:
    engine = create_engine(DATABASE_URL)
except Exception as e:
    print(f"Error creating engine: {e}")
    engine = None

api_key = os.environ.get("OPENAI_API_KEY")
client = OpenAI(api_key=api_key) if api_key and api_key != "dummy_key_for_now" else None


@app.get("/health")
def health_check():
    return {"status": "Analytics Service is running"}


@app.get("/analytics/department")
def get_department_analytics(x_tenant_id: str = Header("default")):
    if not engine:
        raise HTTPException(status_code=500, detail="Database connection failed")

    try:
        query = (
            "SELECT department, count(id) as headcount FROM users WHERE tenant_id = :tenant_id GROUP BY department"
        )
        df = pd.read_sql_query(text(query).bindparams(tenant_id=x_tenant_id), engine)
        return df.to_dict(orient="records")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/analytics/payroll")
def get_payroll_analytics(x_tenant_id: str = Header("default")):
    if not engine:
        raise HTTPException(status_code=500, detail="Database connection failed")

    try:
        query = """
        SELECT period, sum(base_salary) as total_base, sum(tax) as total_tax, sum(net_salary) as total_net
        FROM payroll_records
        WHERE tenant_id = :tenant_id
        GROUP BY period
        ORDER BY period ASC
        """
        df = pd.read_sql_query(text(query).bindparams(tenant_id=x_tenant_id), engine)
        return df.to_dict(orient="records")
    except Exception:
        return []


@app.get("/analytics/performance")
def get_performance_prediction():
    data = {
        "employee_id": [1, 2, 3],
        "years_experience": [2, 5, 10],
        "projects_completed": [5, 12, 25],
    }
    df = pd.DataFrame(data)

    df["performance_score"] = (df["years_experience"] * 0.4) + (
        df["projects_completed"] * 0.6
    )
    top_performer = df.loc[df["performance_score"].idxmax()]

    return {
        "predictions_ready": True,
        "top_performer_id": int(top_performer["employee_id"]),
        "score": float(top_performer["performance_score"]),
    }


@app.post("/analytics/ai-insights")
def get_ai_insights(x_tenant_id: str = Header("default")):
    try:
        # Fetch some high level stats to feed to OpenAI
        dept_data = get_department_analytics(x_tenant_id=x_tenant_id)
        payroll_data = get_payroll_analytics(x_tenant_id=x_tenant_id)

        context = f"Department Headcounts: {json.dumps(dept_data)}. Payroll Trends: {json.dumps(payroll_data)}."

        # If no real API key is set, return a mock response to avoid failing in local dev
        if not client:
            return {
                "insight": (
                    "AI Insights (Mock): Your engineering department is growing rapidly, "
                    "which correlates with the 15% increase in total net payroll observed this period. "
                    "Consider optimizing cloud costs to offset the growing personnel expenditure."
                )
            }

        response = client.chat.completions.create(
            model="gpt-4",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are an expert HR and financial analyst AI. Provide a "
                        "2-sentence strategic insight based on the provided workforce data."
                    ),
                },
                {"role": "user", "content": context},
            ],
        )
        return {"insight": response.choices[0].message.content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8003))
    uvicorn.run(app, host="0.0.0.0", port=port)
