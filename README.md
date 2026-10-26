# Day-ahead wind forecast review

## 1. Project overview

Backend foundation for a UK power trading tool that shows the national wind forecast available at the day-ahead decision cutoff and assesses forecast accuracy for January 2026. The app reads a committed, validated snapshot and exposes decision-time and accuracy APIs. The trading UI is future work.

## 2. Repo structure

- `backend/app/main.py`: FastAPI application, lifespan snapshot loading, and `/api/health`.
- `backend/app/config.py`: decision time, timezone, and data paths.
- `backend/app/services/`: typed snapshot loading, local-time forecast selection, exact-time joins, and pure accuracy metrics.
- `backend/app/routers/analytics.py`: read-only analysis endpoints under `/api`.
- `backend/app/schemas/`: Pydantic response models.
- `backend/scripts/fetch_data.py`: chunked BMRS fetcher, retry logic, CSV writer, and validation report.
- `backend/scripts/sanity_check.py`: reproducible real-snapshot coverage and sensitivity checks.
- `backend/scripts/bias_diagnostics.py`: snapshot-only alignment, bias, horizon, and illustrative correction analysis.
- `backend/tests/`: offline selection, metrics, API, fetch, and health tests.
- `frontend/src/`: React app, with folders reserved for components, pages, API calls, hooks, types, and styles.
- `api/index.py`: Vercel Python entrypoint.
- `data/`: committed January 2026 gzip CSVs, provenance, validation, and bias-diagnostic reports; raw responses are ignored.

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
.venv/bin/python backend/scripts/sanity_check.py
.venv/bin/python backend/scripts/bias_diagnostics.py
```

Vite proxies `/api` to the backend in local development. `vercel.json` builds `frontend/dist` and routes `/api/*` to `api/index.py`; deployment is not part of this setup.

## 4. Deployed app link

_Not deployed yet._

## 5. Design decisions and assumptions

- Decision cutoff is 09:00 `Europe/London` on the day before delivery by default. API callers may override the hour from 0 through 23.
- National-level wind only; generation values are MW. The committed January 2026 delivery window and CSV timestamps are UTC; the later trading cutoff will use `Europe/London`.
- The existing root `DESIGN.md`, `CLAUDE.md`, and `AGENTS.md` describe an unrelated BoothOps/Next.js project. The requested Vite/FastAPI stack takes precedence; the frontend folders are ready for a project-specific design document. The health page is intentionally plain.
- `api/index.py` adds `backend/` to Python's import path so the same FastAPI app runs locally and on Vercel. The root `requirements.txt` forwards to the backend requirements for Vercel's Python runtime.

## 6. Data and methodology

The fetcher uses Elexon's [FUELHH stream](https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/FUELHH/stream) with `settlementDateFrom=2026-01-01`, `settlementDateTo=2026-01-31`, and `fuelType=WIND`, and the [WINDFOR stream](https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/WINDFOR/stream) with `publishDateTimeFrom=2025-12-15T00:00:00Z` and `publishDateTimeTo=2026-01-31T23:59:59Z`. Requests are split into one-day chunks. Elexon's stream API requires no key and documents no response or pagination limit. FUELHH's settlement-date end is inclusive; WINDFOR is filtered by publication time, then by January delivery `startTime`. The observed maximum WINDFOR lead was 66.5 hours, so the December 15 start includes ample lookback.

Timestamps are parsed as UTC. Exact duplicates are removed; for duplicate keys the last row wins. `horizon_hours` is `startTime - publishTime`. The snapshot contains 1,488 half-hour FUELHH actuals and 18,080 WINDFOR forecast rows. WINDFOR has only hourly delivery start times, so 744 January half-hours have no direct forecast; all are listed in `data/validation_report.json`. Another 3,697 forecast rows have negative horizons because the response includes start times before publication. Runtime data loading reads the committed CSVs and never calls BMRS.

### Decision-time methodology

For each forecast `startTime`, delivery day D is its **Europe/London local calendar date**. The decision cutoff is 09:00 London time on D−1 unless `cutoff_hour` overrides it. The selector keeps the latest `publishTime` **at or before** that cutoff for each `startTime`; a publication exactly at cutoff qualifies. It computes the cutoff in local time with `zoneinfo`, then converts it to UTC. The same rule applies across daylight saving transitions.

WINDFOR forecasts have hourly `:00` start times. Accuracy joins them to FUELHH actuals on the **exact UTC `startTime`**. FUELHH's `:30` actuals are excluded from the main comparison, and no forecast is interpolated. Each selected forecast MW value represents one hour when summing the day’s forecast MWh. The separate sanity script also compares against the mean of each hour’s `:00` and `:30` actuals.

Error is `forecast_mw − actual_mw`. Positive error means wind underdelivered versus forecast, so the buyer would need to procure more power. `shortfall_mw = max(error_mw, 0)`. MAE is mean absolute error; RMSE is root mean squared error; bias is mean signed error; MAPE is mean absolute percentage error (zero actuals excluded); nMAE is MAE divided by mean actual MW. Error standard deviation uses the population denominator. P50/P90/P95 absolute errors and P90/P95 shortfalls use linear-interpolated quantiles. Wind-level bands are terciles of actual MW within the requested date range. Horizon buckets are left-closed, right-open six-hour intervals.

`/api/accuracy/horizon` uses **all** forecast vintages with nonnegative horizon, including those published after a delivery day’s decision cutoff. It is a separate lead-time analysis, not decision-time performance. Metrics retain full precision internally and are rounded only in API responses.

### Bias diagnostics

Run `.venv/bin/python backend/scripts/bias_diagnostics.py` to print the January 2026 cutoff-9 analysis and regenerate [`data/bias_diagnostics.json`](data/bias_diagnostics.json). It uses only the committed FUELHH WIND and WINDFOR snapshot. A shift compares a forecast for time `t` with the observed actual at `t + shift`; the ±30-minute checks use observed half-hourly FUELHH rows. No interpolation is used.

The lowest shift-test MAE occurs at −2 hours (2,077.9 MW versus 2,127.5 MW unshifted), a 2.3% improvement; bias remains +1,829.0 MW versus +1,851.5 MW unshifted. At 09:00 cutoff, 27 of 31 days have positive bias, with a 12-day positive run. The latest 0–6-hour vintages cover the same 744 delivery hours and reduce mean bias to +1,592.5 MW, so bias **does shrink** as delivery nears, but remains substantial. An illustrative leave-one-day-out constant correction reduces MAE to 1,468.8 MW and P90/P95 shortfall to 2,482.6/3,594.4 MW; it uses other days including future days and is **not for production**.

Elexon's [FUELHH dataset documentation](https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/FUELHH/stream) describes half-hourly GB fuel-type outturn. Its [generation-by-fuel-type explanation](https://bmrs.elexon.co.uk/generation-by-fuel-type) says the data come from “Operational Metering for BMUs connected to the transmission system” and exclude embedded generation and wind farms without operational meters. Elexon's [WINDFOR dataset documentation](https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/WINDFOR/stream) describes wind forecasts; its [wind-generation explanation](https://bmrs.elexon.co.uk/wind-generation) says they cover “wind farms which are visible to the ESO and have operational metering.” The documents do not identify a matched asset list or establish identical coverage for these two January 2026 series. The persistent positive gap is consistent with a forecast-level calibration or coverage mismatch; the diagnostics strongly disfavor a simple timestamp offset, but cannot identify the underlying cause from these two datasets alone.

### API

| Endpoint | Content |
| --- | --- |
| `GET /api/meta` | Available delivery dates, default cutoff, timezone, snapshot provenance, notes |
| `GET /api/decision-forecast?date=2026-01-01&cutoff_hour=9` | Selected hourly rows, UTC and London cutoff, day summary |
| `GET /api/forecast-vintages?date=2026-01-01&cutoff_hour=9` | All eligible publication groups and selected rows |
| `GET /api/accuracy?start=2026-01-01&end=2026-01-31&cutoff_hour=9` | Overall decision-time metrics and breakdowns |
| `GET /api/accuracy/horizon` | Separate all-vintages lead-time analysis |

Date ranges default to the full January snapshot. Invalid dates or cutoff hours return 422; dates outside the snapshot return 404.

## 7. AI tools used

AI tools such as Codex/Claude were used to assist with project setup, documentation, and code review. Generated work was checked with tests, lint, and build commands.
