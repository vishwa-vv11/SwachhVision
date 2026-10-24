import os
from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from app.core.config import settings
from app.api.v1.api import api_router
from app.db.init_db import init_db
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("civicai.main")

# Paths
BASE_DIR = Path(__file__).resolve().parent.parent.parent
BACKEND_DIR = Path(__file__).resolve().parent.parent
UPLOADS_DIR = BACKEND_DIR / "uploads"
FRONTEND_DIR = BASE_DIR / "frontend"
FRONTEND_DIST_DIR = FRONTEND_DIR / "dist"
FRONTEND_BUILD_INDEX = FRONTEND_DIST_DIR / "index.html"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url="/docs",
    redoc_url="/redoc",
    description="""
# SwachhVision API 🌿
### AI-Powered Civic Issue Detection, Hotspot Intelligence & Verified Resolution System

Closed-loop civic issue management system that:
1. Detects garbage accumulation & sewage overflow from photos.
2. Quantifies issue extent via segmentation masks.
3. Computes severity based on precise location & proximity to sensitive POIs.
4. Routes tickets to responsible municipal authorities.
5. Verifies issue resolution via Before/After image comparison.
6. Clusters recurring reports into actionable hotspots.
    """,
    version="1.0.0"
)

# Set up CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount uploads directory for static images
app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")

# Mount frontend static files
if FRONTEND_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")
if FRONTEND_DIST_DIR.exists():
    app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIST_DIR)), name="frontend-assets")

# Include API Router
app.include_router(api_router, prefix=settings.API_V1_STR)

def portal_index(legacy_filename: str) -> Path:
    if FRONTEND_BUILD_INDEX.exists():
        return FRONTEND_BUILD_INDEX
    return FRONTEND_DIR / legacy_filename

@app.on_event("startup")
async def on_startup():
    logger.info("SwachhVision Backend starting up...")
    try:
        init_db()
    except Exception as e:
        logger.error(f"Database initialization warning on startup: {e}")

@app.get("/")
def root(request: Request):
    accept_header = request.headers.get("accept", "")
    index_file = portal_index("index.html")
    
    # If client specifically asks for JSON (e.g. API test / client), return JSON
    if "application/json" in accept_header:
        return JSONResponse({
            "message": "Welcome to SwachhVision API",
            "docs": "/docs",
            "health": f"{settings.API_V1_STR}/health"
        })
    
    # Otherwise serve dashboard UI
    if index_file.exists():
        return FileResponse(index_file)
    return {
        "message": "Welcome to SwachhVision API",
        "docs": "/docs",
        "health": f"{settings.API_V1_STR}/health"
    }

@app.get("/admin")
def admin_portal():
    admin_file = portal_index("admin.html")
    return FileResponse(admin_file)

@app.get("/admin.html")
def admin_portal_html():
    admin_file = portal_index("admin.html")
    return FileResponse(admin_file)

@app.get("/citizen")
def citizen_portal():
    citizen_file = portal_index("index.html")
    return FileResponse(citizen_file)

@app.get("/citizen.html")
def citizen_portal_html():
    citizen_file = portal_index("index.html")
    return FileResponse(citizen_file)

@app.get("/index.html")
def index_portal_html():
    index_file = portal_index("index.html")
    return FileResponse(index_file)

@app.get("/dashboard")
def dashboard():
    admin_file = portal_index("admin.html")
    return FileResponse(admin_file)

@app.get("/worker")
def worker_portal():
    worker_file = portal_index("worker.html")
    return FileResponse(worker_file)

@app.get("/worker.html")
def worker_portal_html():
    worker_file = portal_index("worker.html")
    return FileResponse(worker_file)

@app.get("/track/{incident_id}")
def track_portal(incident_id: int):
    tracker_file = portal_index("tracker.html")
    return FileResponse(tracker_file)

@app.get("/tracker")
def tracker_portal():
    tracker_file = portal_index("tracker.html")
    return FileResponse(tracker_file)

@app.get("/tracker.html")
def tracker_portal_html():
    tracker_file = portal_index("tracker.html")
    return FileResponse(tracker_file)

@app.get("/tracker/{incident_id}")
def tracker_detail_portal(incident_id: int):
    tracker_file = portal_index("tracker.html")
    return FileResponse(tracker_file)

# Direct static fallbacks for root-level asset requests
@app.get("/styles.css")
def get_styles():
    return FileResponse(FRONTEND_DIR / "styles.css")

@app.get("/app.js")
def get_app_js():
    return FileResponse(FRONTEND_DIR / "app.js")

@app.get("/admin.js")
def get_admin_js():
    return FileResponse(FRONTEND_DIR / "admin.js")

@app.get("/citizen.js")
def get_citizen_js():
    return FileResponse(FRONTEND_DIR / "app.js")

@app.get("/worker.js")
def get_worker_js():
    return FileResponse(FRONTEND_DIR / "worker.js")

@app.get("/tracker.js")
def get_tracker_js():
    return FileResponse(FRONTEND_DIR / "tracker.js")

@app.get("/logo.png")
def get_logo():
    return FileResponse(FRONTEND_DIR / "logo.png")

@app.get("/LOGO.png")
def get_logo_upper():
    return FileResponse(FRONTEND_DIR / "logo.png")
