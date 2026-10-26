# Deploy one Vercel project

Docker Compose is for local development only. Vercel serves the Vite static build and runs `api/index.py` as a Python function. The function reads the committed snapshot from `data/`; it does not fetch BMRS at runtime.

## CLI path

Run from the repository root:

```sh
npm install -g vercel
vercel login
vercel link
vercel pull --yes
vercel build
vercel --prod
python3 scripts/smoke_test.py https://YOUR-PROJECT.vercel.app
```

During `vercel link`, select the desired Vercel account, create or link **one** project, and keep its Root Directory at the repository root (`./`). Do not point the project at `frontend/`, because that would omit `api/`, `backend/app/`, and `data/`. `vercel pull --yes` refreshes project settings for the local preflight. Inspect `.vercel/output` after `vercel build` and before `vercel --prod`.

## GitHub dashboard path

In Vercel, choose **Add New → Project → Import Git Repository**, select this repository, and deploy one project with these settings:

| Setting | Value |
| --- | --- |
| Root Directory | Repository root (`./`) |
| Framework Preset | Other (`framework: null` in `vercel.json`) |
| Install Command | `cd frontend && npm ci` |
| Build Command | `cd frontend && npm run build` |
| Output Directory | `frontend/dist` |
| Python | 3.12, pinned by `.python-version` |
| Required environment variables | None |

Keep `DATA_DIR` unset so the app resolves the bundled repository `data/` directory. The existing defaults are `DECISION_CUTOFF_HOUR=9` and `TIMEZONE=Europe/London`; changing them changes the app's defaults. `vercel.json` routes `/api/*` to the Python function and rewrites other paths to the React `index.html` for client-side navigation. The function configuration explicitly bundles `backend/app/`, the gzip CSVs, `metadata.json`, and `bias_diagnostics.json` while excluding development files.

## Verification after deployment

Open these URLs on the same deployment origin:

- `/` — React dashboard loads.
- `/api/health` — `{"status":"ok"}`.
- `/api/meta` — 32 delivery dates, 1 Jan through 1 Feb 2026.
- `/api/decision-forecast?date=2026-02-01` — 24 rows; decision date 31 Jan.
- `/api/accuracy` — default range 2 Jan–1 Feb; `overall.n` is 744.
- `/api/diagnostics` — committed bias report loads.
- `/accuracy` and `/revisions` — open directly, then refresh; the React page still loads.

Run `python3 scripts/smoke_test.py https://YOUR-PROJECT.vercel.app` to perform these checks automatically. Replace the placeholder in the README with the live URL after verification.
