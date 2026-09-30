from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, func
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.spatial_types import SpatialPoint

class Incident(Base):
    __tablename__ = "incidents"

    id = Column(Integer, primary_key=True, index=True)
    ticket_number = Column(String(50), unique=True, index=True, nullable=False)
    
    # Issue Classification
    issue_type = Column(String(50), nullable=False, index=True)  # GARBAGE_ACCUMULATION, SEWAGE_OVERFLOW
    status = Column(String(50), default="REPORTED", index=True, nullable=False)
    # Status lifecycle: REPORTED -> AI_ANALYZED -> ASSIGNED -> IN_PROGRESS -> RESOLVED -> VERIFIED / REOPENED -> CLOSED
    
    # Geospatial data
    location = Column(SpatialPoint, nullable=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    address = Column(String(500), nullable=True)
    
    # Images
    before_image_url = Column(String(500), nullable=False)
    after_image_url = Column(String(500), nullable=True)
    annotated_image_url = Column(String(500), nullable=True)
    
    # AI Vision & Severity Metrics
    ai_confidence = Column(Float, nullable=True)
    extent_score = Column(Integer, nullable=True)  # 1 to 5
    extent_percentage = Column(Float, nullable=True)
    location_impact_score = Column(Integer, nullable=True)  # 1 to 5
    location_impact_reason = Column(String(255), nullable=True)
    severity_score = Column(Float, nullable=True)  # 0 to 100
    severity_tier = Column(String(20), nullable=True, index=True)  # LOW, MEDIUM, HIGH, CRITICAL
    
    # Authority Assignment
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    assigned_worker_name = Column(String(100), nullable=True)
    reporter_contact = Column(String(100), nullable=True)
    
    # Resolution & Verification
    verification_status = Column(String(50), default="PENDING")  # PENDING, VERIFIED, FAILED
    verification_notes = Column(Text, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())
    resolved_at = Column(DateTime(timezone=True), nullable=True)

    department = relationship("Department", backref="incidents")

    @property
    def department_name(self) -> str | None:
        return self.department.name if self.department else None
