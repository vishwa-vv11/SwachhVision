# SwachhVision frontend

The Vite/React application renders the citizen, admin, worker, and tracker portals as React elements using the existing portal markup and design. This preserves their layouts and interactions while the frontend continues to use the same FastAPI API. The original pages remain under `frontend/` as the source for their presentation and existing behavior scripts.

## Development

Start the FastAPI service on `http://127.0.0.1:8000`, then run:

```powershell
cd frontend
npm install
npm run dev
```

Vite proxies API, upload, and static image requests to FastAPI.

If port 8000 or 8001 is already occupied, start FastAPI on an available port
(for example, 8010), then set the Vite proxy target before starting the
frontend:

```powershell
# Backend terminal
uvicorn app.main:app --reload --host 127.0.0.1 --port 8010

# Frontend terminal
$env:SWACHHVISION_API_TARGET = "http://127.0.0.1:8010"
npm run dev
```

## Production

Build the frontend before starting FastAPI so the backend can serve the generated assets:

```powershell
cd frontend
npm install
npm run build
```

The build is written to `frontend/dist`. FastAPI serves the React application at the citizen, admin, worker, and tracker routes. In development, Vite proxies the existing markup, styles, media, and API requests to FastAPI.
