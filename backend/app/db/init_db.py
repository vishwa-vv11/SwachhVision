import logging
from sqlalchemy import text
from app.core.database import engine, Base, SessionLocal
from app.models.department import Department
from app.models.incident import Incident
from app.models.hotspot import Hotspot

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("civicai.db.init")

def init_db():
    logger.info("Initializing database and spatial extensions...")
    
    # Enable PostGIS extension if running on PostgreSQL
    try:
        with engine.connect() as conn:
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis;"))
            conn.commit()
            logger.info("✓ PostGIS extension enabled.")
    except Exception as e:
        logger.warning(f"PostGIS extension check note: {e}")

    # Create all tables
    logger.info("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    logger.info("✓ Tables created successfully.")

    # Seed default municipal departments
    db = SessionLocal()
    try:
        departments = [
            {
                "name": "Sanitation & Solid Waste Management Authority",
                "category": "GARBAGE",
                "contact_email": "sanitation@civicai.gov",
                "contact_phone": "+91-1800-GARBAGE"
            },
            {
                "name": "Water Supply & Sewerage Board",
                "category": "SEWAGE",
                "contact_email": "sewerage@civicai.gov",
                "contact_phone": "+91-1800-DRAINAGE"
            },
            {
                "name": "Municipal Public Health Department",
                "category": "GENERAL",
                "contact_email": "health@civicai.gov",
                "contact_phone": "+91-1800-PUBHEALTH"
            }
        ]

        for dept_data in departments:
            existing = db.query(Department).filter(Department.name == dept_data["name"]).first()
            if not existing:
                dept = Department(**dept_data)
                db.add(dept)
                logger.info(f"Seeded department: {dept_data['name']}")
        db.commit()
        logger.info("✓ Department seeding completed.")
    except Exception as e:
        db.rollback()
        logger.error(f"Error seeding departments: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    init_db()
