# Day-ahead wind forecast review

## 1. Project overview

Foundation for a UK power trading tool that will show the national wind forecast available at the day-ahead decision cutoff and assess forecast accuracy for January 2026. This setup includes a health API and a minimal connection page only. Data ingestion, forecast selection, metrics, and the trading UI are future work.

## 2. Repo structure

- `backend/app/main.py`: FastAPI application and `/api/health`.
- `backend/app/config.py`: decision time, timezone, and data paths.
- `backend/app/services/`: placeholders for loading, selecting, and scoring data.
- `backend/app/schemas/`: Pydantic response model.
- `backend/scripts/fetch_data.py`: documented ingestion stub.
- `backend/tests/`: API smoke test.
- `frontend/src/`: React app, with folders reserved for components, pages, API calls, hooks, types, and styles.
- `api/index.py`: Vercel Python entrypoint.
- `data/`: reserved for a processed January 2026 snapshot; no data is committed yet.

## 3. How to run

Docker:

```sh
make up       # frontend http://localhost:5173, API http://localhost:8000/api/health
make test
make lint
make down
```

Without Docker (Python 3.12 and Node 22+):

```sh
python3 -m venv .venv
.venv/bin/pip install -r backend/requirements.txt
PYTHONPATH=backend .venv/bin/uvicorn app.main:app --reload --port 8000
# in a second terminal
(cd frontend && npm ci && npm run dev)
# checks from the repo root
.venv/bin/pytest
(cd frontend && npm run lint && npm run build)
```

Vite proxies `/api` to the backend in local development. `vercel.json` builds `frontend/dist` and routes `/api/*` to `api/index.py`; deployment is not part of this setup.

## 4. Deployed app link

_Not deployed yet._

## 5. Design decisions and assumptions

- Decision cutoff is 09:00 `Europe/London` on the day before delivery. The exact selection rule is deferred to the feature implementation.
- National-level wind only; generation values are MW. January 2026 is the delivery window, expressed in UK local time when processing data.
- The existing root `DESIGN.md`, `CLAUDE.md`, and `AGENTS.md` describe an unrelated BoothOps/Next.js project. The requested Vite/FastAPI stack takes precedence; the frontend folders are ready for a project-specific design document. The health page is intentionally plain.
- `api/index.py` adds `backend/` to Python's import path so the same FastAPI app runs locally and on Vercel. The root `requirements.txt` forwards to the backend requirements for Vercel's Python runtime.

## 6. Data and methodology

No BMRS data is downloaded during setup. The later fetcher should use Elexon's [FUELHH stream](https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/FUELHH/stream) with `settlementDateFrom`, `settlementDateTo`, and `fuelType=WIND`, and the [WINDFOR stream](https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/WINDFOR/stream) with `publishDateTimeFrom` and `publishDateTimeTo`. WINDFOR is filtered by **publication** time; forecasts for early January delivery may have been published in December 2025. Both endpoints return JSON arrays. Retrieval boundaries, validation, matching, and metrics remain to be designed and implemented.

## 7. AI tools used

AI tools such as Codex/Claude were used to assist with project setup, documentation, and code review. Generated work was checked with tests, lint, and build commands.
