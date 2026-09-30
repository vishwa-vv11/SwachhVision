from pydantic import BaseModel
from typing import Optional

class HealthResponse(BaseModel):
    status: str
    project: str
    version: str
    database_connected: bool
    postgis_available: bool
    postgis_version: Optional[str] = None
