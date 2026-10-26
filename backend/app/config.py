"""Application constants and filesystem locations."""

import os
from pathlib import Path

DECISION_CUTOFF_HOUR = int(os.getenv("DECISION_CUTOFF_HOUR", "9"))
TIMEZONE = os.getenv("TIMEZONE", "Europe/London")
REPO_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = Path(os.getenv("DATA_DIR", str(REPO_ROOT / "data")))
RAW_DATA_DIR = DATA_DIR / "raw"
PROCESSED_DATA_DIR = DATA_DIR / "processed"
