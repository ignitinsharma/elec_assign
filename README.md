# Day-ahead wind forecast review

## 1. Project overview

Foundation for a UK power trading tool that will show the national wind forecast available at the day-ahead decision cutoff and assess forecast accuracy for January 2026. The committed data snapshot is fetched and validated offline. Forecast selection, metrics, and the trading UI are future work.

## 2. Repo structure

- `backend/app/main.py`: FastAPI application and `/api/health`.
- `backend/app/config.py`: decision time, timezone, and data paths.
- `backend/app/services/data_loader.py`: BMRS normalization and cached, typed CSV loading; the other service modules remain placeholders.
- `backend/app/schemas/`: Pydantic response model.
- `backend/scripts/fetch_data.py`: chunked BMRS fetcher, retry logic, CSV writer, and validation report.
- `backend/tests/`: API smoke test and offline fetch/normalization tests.
- `frontend/src/`: React app, with folders reserved for components, pages, API calls, hooks, types, and styles.
- `api/index.py`: Vercel Python entrypoint.
- `data/`: committed January 2026 gzip CSVs, `metadata.json`, and `validation_report.json`; raw responses are ignored.

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
# refresh the committed snapshot only when needed
.venv/bin/python backend/scripts/fetch_data.py --help
.venv/bin/python backend/scripts/fetch_data.py
```

Vite proxies `/api` to the backend in local development. `vercel.json` builds `frontend/dist` and routes `/api/*` to `api/index.py`; deployment is not part of this setup.

## 4. Deployed app link

_Not deployed yet._

## 5. Design decisions and assumptions

- Decision cutoff is 09:00 `Europe/London` on the day before delivery. The exact selection rule is deferred to the feature implementation.
- National-level wind only; generation values are MW. The committed January 2026 delivery window and CSV timestamps are UTC; the later trading cutoff will use `Europe/London`.
- The existing root `DESIGN.md`, `CLAUDE.md`, and `AGENTS.md` describe an unrelated BoothOps/Next.js project. The requested Vite/FastAPI stack takes precedence; the frontend folders are ready for a project-specific design document. The health page is intentionally plain.
- `api/index.py` adds `backend/` to Python's import path so the same FastAPI app runs locally and on Vercel. The root `requirements.txt` forwards to the backend requirements for Vercel's Python runtime.

## 6. Data and methodology

The fetcher uses Elexon's [FUELHH stream](https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/FUELHH/stream) with `settlementDateFrom=2026-01-01`, `settlementDateTo=2026-01-31`, and `fuelType=WIND`, and the [WINDFOR stream](https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/WINDFOR/stream) with `publishDateTimeFrom=2025-12-15T00:00:00Z` and `publishDateTimeTo=2026-01-31T23:59:59Z`. Requests are split into one-day chunks. Elexon's stream API requires no key and documents no response or pagination limit. FUELHH's settlement-date end is inclusive; WINDFOR is filtered by publication time, then by January delivery `startTime`. The observed maximum WINDFOR lead was 66.5 hours, so the December 15 start includes ample lookback.

Timestamps are parsed as UTC. Exact duplicates are removed; for duplicate keys the last row wins. `horizon_hours` is `startTime - publishTime`. No interpolation or forecast selection is applied. The snapshot contains 1,488 half-hour FUELHH actuals and 18,080 WINDFOR forecast rows. WINDFOR has only hourly delivery start times, so 744 January half-hours have no direct forecast; all are listed in `data/validation_report.json`. Another 3,697 forecast rows have negative horizons because the response includes start times before publication. Runtime data loading reads the committed CSVs and never calls BMRS. Forecast selection and accuracy metrics are future work.

## 7. AI tools used

AI tools such as Codex/Claude were used to assist with project setup, documentation, and code review. Generated work was checked with tests, lint, and build commands.
