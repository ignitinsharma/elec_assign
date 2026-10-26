# Day-ahead wind forecast review

## 1. Project overview

UK power trading dashboard showing the national wind forecast available at the day-ahead decision cutoff and its historical accuracy. It reads a committed, validated snapshot; runtime requests never call BMRS.

## 2. Repo structure

- `backend/app/main.py`: FastAPI application, lifespan snapshot loading, and `/api/health`.
- `backend/app/config.py`: decision time, timezone, and data paths.
- `backend/app/services/`: typed snapshot loading, local-time forecast selection, exact-time joins, and pure accuracy metrics.
- `backend/app/routers/analytics.py`: read-only analysis endpoints under `/api`, including hourly scatter points and the committed bias diagnostics.
- `backend/app/schemas/`: Pydantic response models.
- `backend/scripts/fetch_data.py`: chunked BMRS fetcher, retry logic, CSV writer, and validation report.
- `backend/scripts/sanity_check.py`: reproducible real-snapshot coverage and sensitivity checks.
- `backend/scripts/bias_diagnostics.py`: snapshot-only alignment, bias, horizon, and illustrative correction analysis.
- `backend/tests/`: offline selection, metrics, API, fetch, and health tests.
- `frontend/src/pages/`: Decision Desk, Forecast Revisions, Forecast Accuracy, and Method & limits.
- `frontend/src/components/`, `api/`, `hooks/`, `types/`, `utils/`, `styles/`: reusable charts, skeletons and controls; typed API access, cached queries, MW axis and time formatting, and responsive styles.
- `api/index.py`: Vercel Python entrypoint.
- `vercel.json` and root `requirements.txt`: static-build routing and pinned Python function dependencies.
- `DEPLOY.md`: one-project Vercel deployment and verification steps.
- `scripts/smoke_test.py`: deployed HTML and snapshot API checks.
- `data/`: committed 1 Jan–1 Feb 2026 delivery gzip CSVs, provenance, validation, and bias-diagnostic reports; raw responses are ignored.

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
(cd frontend && npm run test && npm run lint && npm run build)
# refresh the committed snapshot only when needed
.venv/bin/python backend/scripts/fetch_data.py --help
.venv/bin/python backend/scripts/fetch_data.py
.venv/bin/python backend/scripts/sanity_check.py
.venv/bin/python backend/scripts/bias_diagnostics.py
```

Vite proxies `/api` to the backend in local development. Docker Compose is for local development only; Vercel builds `frontend/dist` and runs `api/index.py` as a Python function.

## 4. Deployed app link

_Live URL: to be added after deployment and smoke testing._

See [DEPLOY.md](DEPLOY.md) for the CLI and GitHub import steps, project settings, and verification checklist. From the repository root, run `python3 scripts/smoke_test.py https://YOUR-PROJECT.vercel.app` after deployment.

## 5. Design decisions and assumptions

- Decision cutoff is 09:00 `Europe/London` on the day before delivery by default. API callers may override the hour from 0 through 23.
- National-level wind only; generation values are MW. CSV timestamps are UTC; trading cutoffs use `Europe/London`.
- The root `DESIGN.md`, `CLAUDE.md`, and `AGENTS.md` describe an unrelated project. This dashboard follows the supplied design brief.
- `api/index.py` adds `backend/` to Python's import path so the same FastAPI app runs locally and on Vercel. The root `requirements.txt` pins only the production FastAPI and pandas dependencies for Vercel; `backend/requirements.txt` also includes local development and test tools.

## 6. Data and methodology

The snapshot covers decisions made **31 Dec 2025 to 31 Jan 2026** for delivery days **1 Jan to 1 Feb 2026**: the decision for delivery day D is made on D−1. We retain 1 Jan delivery so both the January-delivery and January-decision interpretations remain available. Accuracy defaults to delivery **2 Jan–1 Feb** (31 days × 24 hours), the decisions made in January; 1 Jan delivery remains selectable.

The fetcher uses Elexon's [FUELHH stream](https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/FUELHH/stream) with `settlementDateFrom=2026-01-01`, `settlementDateTo=2026-02-01`, and `fuelType=WIND`, and the [WINDFOR stream](https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/WINDFOR/stream) with `publishDateTimeFrom=2025-12-15T00:00:00Z` and `publishDateTimeTo=2026-02-01T23:59:59Z`. The added February publication day supports the separate all-vintages lead-time analysis; decision-time selection still uses only publications at or before each cutoff. Requests are split into one-day chunks. Elexon's stream API requires no key and documents no response or pagination limit. FUELHH's settlement-date end is inclusive; WINDFOR is filtered by publication time, then by delivery `startTime`. The observed maximum WINDFOR lead was 66.5 hours, so the December 15 start includes ample lookback.

Timestamps are parsed as UTC. Exact duplicates are removed; for duplicate keys the last row wins. `horizon_hours` is `startTime - publishTime`. The snapshot contains 1,536 half-hour FUELHH actuals and 18,664 WINDFOR forecast rows. WINDFOR has only hourly delivery start times, so 768 half-hours have no direct forecast; all are listed in `data/validation_report.json`. Another 3,817 forecast rows have negative horizons because the response includes start times before publication. Runtime data loading reads the committed CSVs and never calls BMRS.

### Decision-time methodology

For each forecast `startTime`, delivery day D is its **Europe/London local calendar date**. The decision cutoff is 09:00 London time on D−1 unless `cutoff_hour` overrides it. The selector keeps the latest `publishTime` **at or before** that cutoff for each `startTime`; a publication exactly at cutoff qualifies. It computes the cutoff in local time with `zoneinfo`, then converts it to UTC. The same rule applies across daylight saving transitions.

WINDFOR forecasts have hourly `:00` start times. Accuracy joins them to FUELHH actuals on the **exact UTC `startTime`**. FUELHH's `:30` actuals are excluded from the main comparison, and no forecast is interpolated. Each selected forecast MW value represents one hour when summing the day’s forecast MWh. The separate sanity script also compares against the mean of each hour’s `:00` and `:30` actuals.

Error is `forecast_mw − actual_mw`. Positive error means wind underdelivered versus forecast, so the buyer would need to procure more power. `shortfall_mw = max(error_mw, 0)`. MAE is mean absolute error; RMSE is root mean squared error; bias is mean signed error; MAPE is mean absolute percentage error (zero actuals excluded); nMAE is MAE divided by mean actual MW. Error standard deviation uses the population denominator. P50/P90/P95 absolute errors and P90/P95 shortfalls use linear-interpolated quantiles. Wind-level bands are terciles of actual MW within the requested date range. Horizon buckets are left-closed, right-open six-hour intervals.

`/api/accuracy/horizon` uses **all** forecast vintages with nonnegative horizon, including those published after a delivery day’s decision cutoff. It is a separate lead-time analysis, not decision-time performance. Metrics retain full precision internally and are rounded only in API responses.

### Bias diagnostics

Run `.venv/bin/python backend/scripts/bias_diagnostics.py` to print the full-snapshot cutoff-9 analysis and regenerate [`data/bias_diagnostics.json`](data/bias_diagnostics.json). It uses only the committed FUELHH WIND and WINDFOR snapshot. A shift compares a forecast for time `t` with the observed actual at `t + shift`; the ±30-minute checks use observed half-hourly FUELHH rows. No interpolation is used.

The lowest shift-test MAE occurs at −2 hours (2,032.1 MW versus 2,091.2 MW unshifted), a 2.8% improvement; bias remains +1,790.1 MW versus +1,823.4 MW unshifted. At 09:00 cutoff, 28 of 32 days have positive bias, with a 13-day positive run. The latest 0–6-hour vintages cover the same 768 delivery hours and reduce mean bias to +1,563.9 MW, so bias **does shrink** as delivery nears, but remains substantial. An illustrative leave-one-day-out constant correction reduces MAE to 1,448.1 MW and P90/P95 shortfall to 2,489.8/3,613.3 MW; it uses other days including future days and is **not for production**.

Elexon's [FUELHH dataset documentation](https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/FUELHH/stream) describes half-hourly GB fuel-type outturn. Its [generation-by-fuel-type explanation](https://bmrs.elexon.co.uk/generation-by-fuel-type) says the data come from “Operational Metering for BMUs connected to the transmission system” and exclude embedded generation and wind farms without operational meters. Elexon's [WINDFOR dataset documentation](https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/WINDFOR/stream) describes wind forecasts; its [wind-generation explanation](https://bmrs.elexon.co.uk/wind-generation) says they cover “wind farms which are visible to the ESO and have operational metering.” The documents do not identify a matched asset list or establish identical coverage for these series. The persistent positive gap is consistent with a forecast-level calibration or coverage mismatch; the diagnostics strongly disfavor a simple timestamp offset, but cannot identify the underlying cause from these two datasets alone.

### API

| Endpoint | Content |
| --- | --- |
| `GET /api/meta` | Available delivery and corresponding decision dates, default accuracy range, cutoff, timezone, snapshot provenance, notes |
| `GET /api/decision-forecast?date=2026-01-01&cutoff_hour=9` | Selected hourly rows, UTC and London cutoff, day summary |
| `GET /api/forecast-vintages?date=2026-01-01&cutoff_hour=9` | All eligible publication groups and selected rows |
| `GET /api/accuracy?start=2026-01-01&end=2026-02-01&cutoff_hour=9` | Overall decision-time metrics and breakdowns |
| `GET /api/accuracy/horizon` | Separate all-vintages lead-time analysis |

Accuracy and points date ranges default to 2 Jan–1 Feb delivery, the decisions made in January. The full 1 Jan–1 Feb delivery snapshot is available through explicit controls. The meta and day endpoints pair delivery dates with their decision dates. Invalid dates or cutoff hours return 422; dates outside the snapshot return 404.

The dashboard uses Recharts and TanStack Query. The date and cutoff controls send each selection to the API; `/api/accuracy/points` supplies the exact hourly pairs for the scatter plot. `/api/diagnostics` validates and serves the committed `bias_diagnostics.json`; its leave-one-day-out illustration is always labelled as a retrospective full-snapshot analysis, regardless of the selected accuracy date range. The React build uses same-origin `/api` paths in Docker and on Vercel.

### Screenshots

With the app running and Playwright Chromium installed, run `cd frontend && npm run screenshots` to capture all four views at desktop and mobile widths in the ignored `screenshots/` directory. Add representative screenshots here when sharing the deployed app.

## 7. AI tools used

AI tools such as Codex/Claude were used to assist with project setup, documentation, and code review. Generated work was checked with tests, lint, and build commands.
