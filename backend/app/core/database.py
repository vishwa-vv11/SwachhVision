import logging
from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from app.core.config import settings

logger = logging.getLogger("civicai.database")

def create_db_engine():
    """Attempt connecting to configured PostgreSQL database, falling back to SQLite if unreachable."""
    database_url = settings.DATABASE_URL
    try:
        engine = create_engine(database_url, pool_pre_ping=True, echo=False)
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        logger.info(f"✓ Connected to primary database: {database_url.split('@')[-1] if '@' in database_url else database_url}")
        return engine
    except Exception as e:
        logger.warning(f"Could not connect to primary database ({e}). Falling back to local SQLite database (civicai.db)...")
        fallback_url = "sqlite:///./civicai.db"
        fallback_engine = create_engine(fallback_url, echo=False, connect_args={"check_same_thread": False})
        return fallback_engine

engine = create_db_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    """Dependency for obtaining database sessions per request."""
    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()
