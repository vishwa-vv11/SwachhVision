from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class IncidentBase(BaseModel):
    issue_type: str = Field(..., description="GARBAGE_ACCUMULATION or SEWAGE_OVERFLOW")
    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)
    address: Optional[str] = None
    before_image_url: str
    reporter_contact: Optional[str] = None

class IncidentCreate(IncidentBase):
    pass

class IncidentUpdateStatus(BaseModel):
    status: str = Field(..., description="REPORTED, ASSIGNED, IN_PROGRESS, RESOLVED, VERIFIED, REOPENED, CLOSED")
    assigned_worker_name: Optional[str] = None
    department_id: Optional[int] = None

class IncidentResolve(BaseModel):
    after_image_url: str
    notes: Optional[str] = None

class IncidentOut(BaseModel):
    id: int
    ticket_number: str
    issue_type: str
    status: str
    latitude: float
    longitude: float
    address: Optional[str] = None
    before_image_url: str
    after_image_url: Optional[str] = None
    annotated_image_url: Optional[str] = None
    ai_confidence: Optional[float] = None
    extent_score: Optional[int] = None
    extent_percentage: Optional[float] = None
    location_impact_score: Optional[int] = None
    location_impact_reason: Optional[str] = None
    severity_score: Optional[float] = None
    severity_tier: Optional[str] = None
    department_id: Optional[int] = None
    department_name: Optional[str] = None
    assigned_worker_name: Optional[str] = None
    reporter_contact: Optional[str] = None
    verification_status: Optional[str] = None
    verification_notes: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None

    class Config:
        from_attributes = True
