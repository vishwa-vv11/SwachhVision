# 🌿 SwachhVision — Hackathon Pitch & Live Demo Guide

> **Project Tagline:**  
> *"SwachhVision is an AI-powered closed-loop civic issue management system that detects garbage accumulation and sewage overflow from photos, assesses severity from visible extent and geospatial context, routes tasks to municipal authorities, and verifies resolution via before-and-after computer vision."*

---

## 🎯 1. Executive Summary & Problem Statement

### ❌ The Civic Bottleneck Today
1. **Subjective & Unstructured Complaints:** Citizens complain on portals with vague text descriptions ("Garbage near my house"). Authorities cannot determine whether it is a small plastic bag or a 2-tonne hazardous dump near a primary stormwater drain.
2. **Slow & Ambiguous Routing:** Reports sit in limbo because citizens don't know which municipal department (Solid Waste Management vs. Water & Sewerage Board) is responsible.
3. **No Verification / Ghost Resolutions:** Workers often mark tickets "Resolved" without verifiable proof, leaving citizens frustrated with reopened complaints.
4. **Reactive Instead of Preventive:** Recurring garbage accumulation spots are treated as isolated events rather than identified as systematic civic hotspots.

### ✨ The SwachhVision Innovation: A Verified Closed-Loop System
SwachhVision closes the loop with **5 core technical pillars**:
1. **YOLOv8 Segmentation Masking:** Extracts exact pixel surface area to compute a quantifiable 1–5 Extent Score ($0\text{--}10\% \rightarrow 1$ to $>75\% \rightarrow 5$).
2. **Geospatial Context Fusion (Severity Engine):** Fuses visual volume (60%) with sensitive POI proximity (40%)—such as drains, hospitals, schools, and arterial roads—into an objective $0\text{--}100$ Severity Score.
3. **Automated Municipal Dispatch:** Instantly routes tickets to the correct department with estimated SLAs and priority ranks.
4. **Spatial DBSCAN Hotspot Clustering:** Automatically clusters recurring reports within $100\text{--}350\text{m}$ into actionable municipal hotspot zones.
5. **AI Before/After Resolution Verification:** When workers upload an AFTER photo, Computer Vision validates residual extent ($<5\%$ threshold) before permitting ticket closure.

---

## 🏗️ 2. High-Level Architecture Flow

```text
       ┌──────────────────────────────┐
       │   📱 CITIZEN REPORT PORTAL   │
       │  (Camera Snap + Auto GPS)    │
       └──────────────┬───────────────┘
                      │ POST /report (Image + Lat/Lon)
                      ▼
 ┌──────────────────────────────────────────────┐
 │             FASTAPI AI BACKEND               │
 │ 1. YOLOv8 Segmentation  ➔ Extent (1–5)       │
 │ 2. Nominatim Geocoding  ➔ Reverse Address    │
 │ 3. PostGIS POI Analysis ➔ Location Risk(1–5) │
 │ 4. Severity Formula     ➔ Score (0–100)      │
 │ 5. Routing Service      ➔ Auto Dept Dispatch │
 └──────────────┬───────────────────────────────┘
                │
                ├───────────────────────────────────────┐
                ▼                                       ▼
┌───────────────────────────────┐     ┌──────────────────────────────────┐
│  🖥️ OFFICER COMMAND CENTER     │     │   📍 DBSCAN HOTSPOT ENGINE       │
│  - Live GIS Map & Pulsing Pins│     │   - Rolling Spatial Clustering   │
│  - Severity Triage Filtering  │     │   - High-Risk Accumulation Zones │
│  - Instant Worker Dispatch    │     └──────────────────────────────────┘
└───────────────┬───────────────┘
                │
                ▼
┌───────────────────────────────┐
│   👷 FIELD WORKER PORTAL      │
│   - Priority Task Queue       │
│   - One-Tap GPS Navigation    │
│   - Clean & Snap AFTER Photo  │
└───────────────┬───────────────┘
                │ POST /resolve (AFTER Image)
                ▼
┌───────────────────────────────────────────────┐
│       🤖 AI VERIFICATION ENGINE              │
│       - YOLO Segmentation on AFTER Image      │
│       - Extent == 0% ? ➔ VERIFIED & CLOSED    │
│       - Residual > 5% ? ➔ REOPEN & ALERT      │
└───────────────┬───────────────────────────────┘
                │
                ▼
┌───────────────────────────────┐
│  🔍 CITIZEN PROOF TRACKER     │
│  - Side-by-side Before/After  │
│  - Verified Time & Dept SLA   │
│  - Full Public Transparency   │
└───────────────────────────────┘
```

---

## 🎬 3. The 2-Minute Live Demo Script for Judges

### ⏱️ Act 1: The Citizen Snap (0:00 – 0:35)
1. Open the **Citizen Portal** (`/citizen`).
2. Click **"📍 Detect Current GPS"** — notice the high-precision GPS lock and draggable Leaflet pin.
3. Choose a photo of garbage near a drainage channel.
4. Click **"Run AI Analysis & Submit Report"**.
5. **Point out to Judges:**
   > *"Notice how the citizen didn't have to fill out complex forms or pick a department. In under 1 second, SwachhVision analyzed the image using YOLO segmentation (extent score 4/5), evaluated that it is 60m from a storm drainage canal (location score 5/5), computed a **CRITICAL Severity of 88/100**, and auto-assigned it to Solid Waste Management."*

### ⏱️ Act 2: Officer Command Center & Hotspots (0:35 – 1:10)
1. Switch to the **Officer Dashboard** (`/dashboard`).
2. Show the interactive Leaflet GIS map with color-coded pulsing radar pins (🔴 Critical, 🟠 High, 🟡 Medium, 🟢 Low).
3. Toggle the **"Hotspot Heatmap Overlay"** switch.
4. **Point out to Judges:**
   > *"For municipal commissioners, this changes everything. The DBSCAN spatial engine groups 75+ reports across the city into active hotspot zones (e.g. Indiranagar Metro Canal), enabling proactive sanitation drives rather than reactive firefighting."*
5. Click on an incident in the triage table and dispatch a field worker.

### ⏱️ Act 3: Field Worker Action & GPS Navigation (1:10 – 1:35)
1. Switch to the **Field Worker Portal** (`/worker`).
2. Show the task queue pre-sorted by severity.
3. Click the **"🗺️ Navigate"** button — show how it opens direct turn-by-turn Google Maps navigation to the exact latitude/longitude.
4. Click **"⚡ Start Action"** -> changes status to `IN_PROGRESS`.

### ⏱️ Act 4: The Closed-Loop AI Verification (1:35 – 2:00)
1. In the worker portal, click **"📸 Submit Resolution"**.
2. Upload a cleaned area photo and submit notes.
3. Switch to the **Public Resolution Tracker** (`/tracker?id=...`).
4. **Grand Finale Presentation Line:**
   > *"This is our core differentiator: The AI Closed-Loop Verification. The system ran Computer Vision on the worker's AFTER image, confirmed 0.0% residual waste, stamped the ticket **AI VERIFIED & CLOSED**, and generated a public transparency certificate with side-by-side Before & After proof for the citizen."*

---

## 💡 4. Technology Stack & Competitive Edge

| Layer | Technology | Key Differentiator |
|---|---|---|
| **Computer Vision** | YOLOv8-seg (Ultralytics) + OpenCV | Multi-polygon segmentation calculating exact pixel surface percentage |
| **Geospatial & POI** | PostGIS + OpenStreetMap Nominatim | Proximity scoring to sensitive urban drainage and hospital zones |
| **Severity Logic** | Deterministic Formula | $60\% \times \text{Extent} + 40\% \times \text{POI Impact}$ (Explainable & Audit-ready) |
| **Hotspot Engine** | Geospatial DBSCAN Clustering | Identifies recurring waste dumping patterns automatically |
| **Backend API** | FastAPI + SQLAlchemy | Async high-throughput REST architecture with auto-fallback database |
| **Frontend UI** | Modern Vanilla CSS + Leaflet GIS | Zero-dependency, ultra-fast dark mode glassmorphism UI |

---

## 🏆 5. Hackathon Submission Deliverables Checklist
- [x] Full Monorepo Architecture (`/backend`, `/frontend`, `/ml`, `/docs`)
- [x] PostGIS Spatial Database & Fallback Layer
- [x] YOLO Segmentation Pipeline & Pretrained Model
- [x] Severity Engine & Geospatial Context Analyzer
- [x] Automated Municipal Routing Engine
- [x] Spatial DBSCAN Hotspot Clustering Algorithm
- [x] Officer Command Center GIS Dashboard (`/dashboard`)
- [x] Mobile-First Citizen Reporting Portal (`/citizen`)
- [x] Field Worker Action Portal with Turn-by-Turn GPS (`/worker`)
- [x] AI Resolution Verification & Transparency Proof Tracker (`/tracker`)
- [x] 75+ Seeded Realistic Incidents & Active Hotspots
- [x] 27/27 Passing Automated Unit, Integration & E2E Tests
