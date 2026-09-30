from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class HotspotOut(BaseModel):
    id: int
    cluster_code: str
    issue_type: str
    latitude: float
    longitude: float
    radius_meters: float
    incident_count: int
    risk_level: str
    is_active: bool
    created_at: Optional[datetime] = None
    last_updated: Optional[datetime] = None

    class Config:
        from_attributes = True
