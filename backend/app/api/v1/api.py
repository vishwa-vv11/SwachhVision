from fastapi import APIRouter
from app.api.v1.endpoints import health, departments, incidents, hotspots

api_router = APIRouter()
api_router.include_router(health.router, tags=["System & Health"])
api_router.include_router(departments.router, prefix="/departments", tags=["Departments"])
api_router.include_router(incidents.router, prefix="/incidents", tags=["Incidents & Reporting"])
api_router.include_router(hotspots.router, prefix="/hotspots", tags=["Hotspot Intelligence"])
