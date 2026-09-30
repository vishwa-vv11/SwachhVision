from sqlalchemy import Column, Integer, String, DateTime, func
from app.core.database import Base
from app.models.spatial_types import SpatialPolygon
from datetime import datetime

class Department(Base):
    __tablename__ = "departments"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, unique=True)
    category = Column(String(50), nullable=False)  # GARBAGE, SEWAGE, GENERAL
    contact_email = Column(String(255), nullable=True)
    contact_phone = Column(String(50), nullable=True)
    jurisdiction_polygon = Column(SpatialPolygon, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())
