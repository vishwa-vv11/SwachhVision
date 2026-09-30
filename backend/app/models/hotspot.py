from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, func
from app.core.database import Base
from app.models.spatial_types import SpatialPoint

class Hotspot(Base):
    __tablename__ = "hotspots"

    id = Column(Integer, primary_key=True, index=True)
    cluster_code = Column(String(50), unique=True, index=True, nullable=False)
    issue_type = Column(String(50), nullable=False, index=True)
    
    # Cluster spatial geometry
    centroid = Column(SpatialPoint, nullable=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    radius_meters = Column(Float, default=100.0)
    
    incident_count = Column(Integer, default=1)
    risk_level = Column(String(20), default="MODERATE")  # LOW, MODERATE, HIGH, SEVERE
    is_active = Column(Boolean, default=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_updated = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())
