"""In-memory January snapshot and per-cutoff selection cache."""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import date
from functools import lru_cache
from typing import Any

import pandas as pd

from app.config import DATA_DIR
from app.services.data_loader import load_actuals, load_forecasts
from app.services.forecast_selector import delivery_days, select_decision_forecast
from app.services.metrics import join_decision_actuals


@dataclass(eq=False)
class Snapshot:
    actuals: pd.DataFrame
    forecasts: pd.DataFrame
    metadata: dict[str, Any]

    @property
    def available_days(self) -> list[date]:
        """Return the local delivery dates represented by the committed actuals."""
        return sorted(delivery_days(self.actuals["startTime"]).unique().tolist())

    @lru_cache(maxsize=24)
    def selected(self, cutoff_hour: int) -> pd.DataFrame:
        """Cache vectorised decision-time selection for each cutoff hour."""
        return select_decision_forecast(self.forecasts, cutoff_hour)

    @lru_cache(maxsize=24)
    def joined(self, cutoff_hour: int) -> pd.DataFrame:
        """Cache exact hourly joins for each cutoff hour."""
        return join_decision_actuals(self.selected(cutoff_hour), self.actuals)


@lru_cache(maxsize=1)
def load_snapshot() -> Snapshot:
    """Load the committed files once per process, including Vercel cold starts."""
    metadata = json.loads((DATA_DIR / "metadata.json").read_text())
    return Snapshot(load_actuals(), load_forecasts(), metadata)
