import os
import random
import logging
from pathlib import Path
from datetime import datetime, timedelta
from app.core.database import SessionLocal, engine, Base
from app.models.department import Department
from app.models.incident import Incident
from app.models.hotspot import Hotspot
from app.services.hotspot_service import hotspot_service

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("civicai.seed")

# Urban Bangalore landmark locations for realistic simulation
GEO_CLUSTERS = [
    # Cluster 1: Indiranagar - 100ft Road (High Commercial & Dining)
    {"name": "Indiranagar 100ft Rd", "lat": 12.9784, "lon": 77.6408, "dept": 1, "poi": "Major Commercial Arterial Road (Score: 3)"},
    {"name": "Indiranagar 12th Main", "lat": 12.9760, "lon": 77.6430, "dept": 1, "poi": "Residential & Eateries (Score: 2)"},
    {"name": "Indiranagar Metro Canal", "lat": 12.9790, "lon": 77.6395, "dept": 2, "poi": "Near Primary Stormwater Drain (Score: 5)"},
    {"name": "CMH Road Junction", "lat": 12.9810, "lon": 77.6440, "dept": 1, "poi": "Near Chinmaya Hospital (Score: 4)"},
    {"name": "HAL 2nd Stage Ward 80", "lat": 12.9740, "lon": 77.6460, "dept": 1, "poi": "Residential Colony (Score: 2)"},

    # Cluster 2: Koramangala - 5th Block (Frequent Waterlogging & Sewage)
    {"name": "Koramangala 5th Block Drain", "lat": 12.9352, "lon": 77.6245, "dept": 2, "poi": "Primary Wastewater Canal #12 (Score: 5)"},
    {"name": "Jyoti Nivas College Road", "lat": 12.9338, "lon": 77.6189, "dept": 1, "poi": "Near College & Educational Zone (Score: 4)"},
    {"name": "Koramangala 80ft Road", "lat": 12.9380, "lon": 77.6220, "dept": 1, "poi": "Major Traffic Corridor (Score: 3)"},
    {"name": "Koramangala 4th Block Park", "lat": 12.9320, "lon": 77.6290, "dept": 1, "poi": "Public Park & Walkway (Score: 2)"},
    {"name": "Sony World Junction", "lat": 12.9365, "lon": 77.6258, "dept": 2, "poi": "Sewer Manhole Intersection (Score: 5)"},

    # Cluster 3: Whitefield - IT Corridor
    {"name": "ITPB Main Gate", "lat": 12.9860, "lon": 77.7310, "dept": 1, "poi": "High Density Tech Park Entrance (Score: 3)"},
    {"name": "Whitefield Railway Station Rd", "lat": 12.9980, "lon": 77.7550, "dept": 1, "poi": "Transit Corridor (Score: 3)"},
    {"name": "Varthur Lake Outlet", "lat": 12.9430, "lon": 77.7470, "dept": 2, "poi": "Lake Inflow Drainage Basin (Score: 5)"},
    {"name": "Hope Farm Junction", "lat": 12.9840, "lon": 77.7510, "dept": 1, "poi": "Commercial Roadside (Score: 3)"},
    {"name": "Vydehi Hospital Environs", "lat": 12.9730, "lon": 77.7280, "dept": 1, "poi": "Hospital Zone Buffer (Score: 4)"},

    # Cluster 4: MG Road / Central Business District
    {"name": "MG Road Brigade Jn", "lat": 12.9750, "lon": 77.6070, "dept": 1, "poi": "High Traffic Boulevard (Score: 3)"},
    {"name": "Cubbon Park Boundary", "lat": 12.9760, "lon": 77.5920, "dept": 1, "poi": "Eco Sensitive Heritage Park (Score: 4)"},
    {"name": "Shivajinagar Market Drain", "lat": 12.9855, "lon": 77.6040, "dept": 2, "poi": "High Volume Market Drainage (Score: 5)"},
    {"name": "Bowring Hospital Perimeter", "lat": 12.9830, "lon": 77.6010, "dept": 1, "poi": "Hospital Vicinity (Score: 4)"},
    {"name": "Commercial Street East", "lat": 12.9820, "lon": 77.6100, "dept": 1, "poi": "High Density Pedestrian Hub (Score: 3)"}
]

SAMPLE_PHOTOS_GARBAGE = [
    "https://images.unsplash.com/photo-1530587191325-3db32d826c18?w=800",
    "https://images.unsplash.com/photo-1605600659908-0ef719419d41?w=800",
    "https://images.unsplash.com/photo-1595278069441-2cf29f8005a4?w=800",
    "https://images.unsplash.com/photo-1528323273322-d81458248d40?w=800",
]

SAMPLE_PHOTOS_CLEAN = [
    "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800",
    "https://images.unsplash.com/photo-1477959858617-67f30bc75b82?w=800",
    "https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=800",
]

def seed_rich_demo_data(target_count: int = 40):
    """
    Populates database with realistic multi-ward civic incidents covering:
    - Garbage Accumulation & Sewage Overflow
    - Calculated severity distributions (Critical, High, Medium, Low)
    - Full lifecycle states (Reported, Assigned, In Progress, Verified)
    - Before & After photo records
    - Clustered Hotspot Zones
    """
    logger.info(f"🌿 Seeding SwachhVision with {target_count} rich demo incidents...")

    db = SessionLocal()
    try:
        # Check existing incidents
        existing_count = db.query(Incident).count()
        if existing_count >= target_count:
            logger.info(f"Database already populated with {existing_count} incidents. Triggering spatial hotspot refresh.")
            hotspot_service.refresh_hotspots(db=db, eps_meters=350.0)
            return

        now = datetime.utcnow()

        for i in range(1, target_count + 1):
            cluster = random.choice(GEO_CLUSTERS)
            # Add slight jitter for realistic spatial clustering
            lat = cluster["lat"] + random.uniform(-0.003, 0.003)
            lon = cluster["lon"] + random.uniform(-0.003, 0.003)

            issue_type = "GARBAGE_ACCUMULATION"
            dept_id = 1

            # Extent and POI scores
            extent_score = random.randint(2, 5)
            extent_pct = round(random.uniform(18.0, 78.0), 1)
            loc_impact_score = 5 if "Drain" in cluster["poi"] or "Canal" in cluster["poi"] else random.randint(2, 4)

            # Deterministic severity calculation: (Extent/5 * 60) + (Location/5 * 40)
            sev_score = round(((extent_score / 5.0) * 60.0) + ((loc_impact_score / 5.0) * 40.0), 1)
            if sev_score >= 76:
                sev_tier = "CRITICAL"
            elif sev_score >= 51:
                sev_tier = "HIGH"
            elif sev_score >= 26:
                sev_tier = "MEDIUM"
            else:
                sev_tier = "LOW"

            # Lifecycle status distribution
            rand_status = random.random()
            created_offset = random.randint(2, 72)
            created_at = now - timedelta(hours=created_offset)

            if rand_status < 0.30:
                status = "REPORTED"
                worker = None
                after_url = None
                ver_status = "PENDING"
                ver_notes = None
                resolved_at = None
            elif rand_status < 0.55:
                status = "ASSIGNED"
                worker = f"Field Team #{random.randint(1, 8)}"
                after_url = None
                ver_status = "PENDING"
                ver_notes = None
                resolved_at = None
            elif rand_status < 0.75:
                status = "IN_PROGRESS"
                worker = f"Field Team #{random.randint(1, 8)}"
                after_url = None
                ver_status = "PENDING"
                ver_notes = "Crew deployed on site with suction equipment and loaders."
                resolved_at = None
            else:
                status = "VERIFIED"
                worker = f"Field Team #{random.randint(1, 8)}"
                after_url = random.choice(SAMPLE_PHOTOS_CLEAN)
                ver_status = "VERIFIED"
                ver_notes = "[AI VERIFICATION PASSED] Residual extent 0.0%. Clean area validated by YOLO segmentation."
                resolved_at = created_at + timedelta(hours=random.randint(1, 4))

            incident = Incident(
                ticket_number=f"SWV-{random.randint(10000, 99999)}",
                issue_type=issue_type,
                status=status,
                latitude=round(lat, 5),
                longitude=round(lon, 5),
                address=f"{cluster['name']}, Ward {random.randint(10, 198)}, Bengaluru",
                before_image_url=random.choice(SAMPLE_PHOTOS_GARBAGE),
                after_image_url=after_url,
                ai_confidence=round(random.uniform(0.85, 0.98), 2),
                extent_score=extent_score,
                extent_percentage=extent_pct,
                location_impact_score=loc_impact_score,
                location_impact_reason=cluster["poi"],
                severity_score=sev_score,
                severity_tier=sev_tier,
                department_id=dept_id,
                assigned_worker_name=worker,
                reporter_contact=f"+91 98{random.randint(10000000, 99999999)}",
                verification_status=ver_status,
                verification_notes=ver_notes,
                created_at=created_at,
                resolved_at=resolved_at
            )
            db.add(incident)

        db.commit()
        logger.info(f"[OK] Successfully seeded {target_count} incidents into SwachhVision database.")

        # Trigger spatial hotspot clustering
        hotspot_service.refresh_hotspots(db=db, eps_meters=350.0)
        logger.info("[OK] Spatial hotspot zones clustered and updated.")
    finally:
        db.close()

if __name__ == "__main__":
    seed_rich_demo_data(45)
