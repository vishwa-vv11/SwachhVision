from app.schemas.health import HealthResponse
from app.schemas.department import DepartmentCreate, DepartmentOut
from app.schemas.incident import IncidentCreate, IncidentUpdateStatus, IncidentResolve, IncidentOut
from app.schemas.hotspot import HotspotOut

__all__ = [
    "HealthResponse",
    "DepartmentCreate",
    "DepartmentOut",
    "IncidentCreate",
    "IncidentUpdateStatus",
    "IncidentResolve",
    "IncidentOut",
    "HotspotOut",
]
