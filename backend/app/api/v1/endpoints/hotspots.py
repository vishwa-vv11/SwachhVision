from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.hotspot import Hotspot
from app.models.incident import Incident
from app.schemas.hotspot import HotspotOut
from app.schemas.incident import IncidentOut
from app.services.hotspot_service import hotspot_service
from app.services.geo_service import haversine_distance_meters

router = APIRouter()

@router.get("/", response_model=List[HotspotOut])
def get_hotspots(
    issue_type: Optional[str] = Query(None, description="Filter by issue type (GARBAGE_ACCUMULATION, SEWAGE_OVERFLOW)"),
    risk_level: Optional[str] = Query(None, description="Filter by risk level (LOW, MODERATE, HIGH, SEVERE)"),
    db: Session = Depends(get_db)
):
    """
    Get active spatial hotspot clusters.
    """
    query = db.query(Hotspot).filter(Hotspot.is_active == True)
    if issue_type:
        query = query.filter(Hotspot.issue_type == issue_type)
    if risk_level:
        query = query.filter(Hotspot.risk_level == risk_level)
    return query.order_by(Hotspot.incident_count.desc()).all()

@router.post("/refresh", response_model=List[HotspotOut])
def refresh_hotspots(
    radius_meters: float = Query(120.0, ge=20.0, le=1000.0, description="Clustering proximity radius in meters"),
    db: Session = Depends(get_db)
):
    """
    Execute spatial DBSCAN clustering algorithm to recalculate recurring hotspot zones.
    """
    refreshed = hotspot_service.refresh_hotspots(db, eps_meters=radius_meters)
    return refreshed

@router.get("/{hotspot_id}")
def get_hotspot_details(hotspot_id: int, db: Session = Depends(get_db)):
    """
    Get single hotspot details along with all incidents clustered inside it.
    """
    hotspot = db.query(Hotspot).filter(Hotspot.id == hotspot_id).first()
    if not hotspot:
        raise HTTPException(status_code=404, detail="Hotspot not found")

    # Find incidents within this hotspot's radius
    all_incidents = db.query(Incident).filter(Incident.issue_type == hotspot.issue_type).all()
    clustered_incidents = []
    for inc in all_incidents:
        dist = haversine_distance_meters(hotspot.latitude, hotspot.longitude, inc.latitude, inc.longitude)
        if dist <= hotspot.radius_meters:
            clustered_incidents.append(IncidentOut.from_orm(inc))

    return {
        "hotspot": HotspotOut.from_orm(hotspot),
        "incidents": clustered_incidents,
        "total_clustered": len(clustered_incidents)
    }
