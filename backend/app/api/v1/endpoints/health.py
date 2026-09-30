from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.core.database import get_db
from app.core.config import settings
from app.schemas.health import HealthResponse

router = APIRouter()

@router.get("/health", response_model=HealthResponse)
def health_check(db: Session = Depends(get_db)):
    db_connected = False
    postgis_available = False
    postgis_version = None

    try:
        # Check basic db connection
        db.execute(text("SELECT 1"))
        db_connected = True

        # Check PostGIS extension
        try:
            result = db.execute(text("SELECT PostGIS_Version();")).fetchone()
            if result:
                postgis_available = True
                postgis_version = str(result[0])
        except Exception:
            postgis_available = False
            postgis_version = None

    except Exception:
        db_connected = False

    return HealthResponse(
        status="HEALTHY" if db_connected else "DEGRADED",
        project=settings.PROJECT_NAME,
        version="1.0.0",
        database_connected=db_connected,
        postgis_available=postgis_available,
        postgis_version=postgis_version
    )
