import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session

from models import Base

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    f"postgresql://{os.environ.get('POSTGRES_USER', 'atlas_user')}:{os.environ.get('POSTGRES_PASSWORD', 'atlas_password')}@{os.environ.get('POSTGRES_HOST', 'localhost')}:5432/{os.environ.get('POSTGRES_DB', 'atlas_db')}",
)

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()


from routers import jobs, candidates, applications, interviews, offers, analytics


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield
    engine.dispose()


app = FastAPI(title="ATS Service API", version="1.0.0", lifespan=lifespan)

ALLOWED_ORIGINS = os.environ.get("ALLOWED_ORIGINS", "http://localhost:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    openapi_schema = get_openapi(
        title="Atlas ATS Service",
        version="1.0.0",
        description="Applicant Tracking System service. Manages jobs, candidates, applications, interviews, and offers. Part of the Atlas Workforce System.",
        routes=app.routes,
    )
    openapi_schema["servers"] = [{"url": "http://localhost:8012", "description": "Local development"}]
    openapi_schema["tags"] = [
        {"name": "jobs", "description": "Job posting management"},
        {"name": "candidates", "description": "Candidate profile management"},
        {"name": "applications", "description": "Job application management"},
        {"name": "interviews", "description": "Interview scheduling and feedback"},
        {"name": "offers", "description": "Offer letter management"},
        {"name": "analytics", "description": "ATS pipeline analytics"},
        {"name": "health", "description": "Service health check"},
    ]
    app.openapi_schema = openapi_schema
    return app.openapi_schema


app.openapi = custom_openapi

app.include_router(jobs.router, prefix="/api/v1")
app.include_router(candidates.router, prefix="/api/v1")
app.include_router(applications.router, prefix="/api/v1")
app.include_router(interviews.router, prefix="/api/v1")
app.include_router(offers.router, prefix="/api/v1")
app.include_router(analytics.router, prefix="/api/v1")


@app.get("/health", tags=["health"])
def health_check():
    try:
        with engine.connect() as conn:
            conn.execute(engine.dialect.statement_compiler(engine.dialect, None).__class__.__module__ and text("SELECT 1"))
            db_status = "connected"
    except Exception:
        db_status = "disconnected"
    return {"status": "ATS Service is running", "database": db_status}


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", 8012))
    uvicorn.run(app, host="0.0.0.0", port=port)
