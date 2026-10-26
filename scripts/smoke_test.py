"""Check a deployed Vercel URL against the committed wind snapshot contract."""

from __future__ import annotations

import argparse
import json
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


def get(base_url: str, path: str) -> tuple[str, str]:
    """Fetch one same-origin path, including a generous serverless cold-start timeout."""
    request = Request(f"{base_url}{path}", headers={"User-Agent": "wind-deployment-smoke/1.0"})
    with urlopen(request, timeout=45) as response:
        return response.headers.get_content_type(), response.read().decode("utf-8")


def check(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)
    print(f"PASS {message}")


def run(base_url: str) -> None:
    if not base_url.startswith(("https://", "http://")):
        raise ValueError("URL must begin with https:// or http://")
    base = base_url.rstrip("/")

    for path in ("/", "/revisions", "/accuracy", "/method"):
        content_type, body = get(base, path)
        check(content_type == "text/html" and '<div id="root"></div>' in body, f"{path} serves the React HTML")

    _, health_body = get(base, "/api/health")
    check(json.loads(health_body).get("status") == "ok", "/api/health responds")

    _, meta_body = get(base, "/api/meta")
    meta = json.loads(meta_body)
    dates = meta.get("available_delivery_dates", [])
    check(len(dates) == 32 and dates[0] == "2026-01-01" and dates[-1] == "2026-02-01", "/api/meta lists 32 delivery dates through 1 February")

    _, decision_body = get(base, "/api/decision-forecast?date=2026-02-01")
    decision = json.loads(decision_body)
    check(decision.get("decision_date") == "2026-01-31" and len(decision.get("rows", [])) == 24, "1 February decision forecast has 24 hours")

    _, accuracy_body = get(base, "/api/accuracy")
    accuracy = json.loads(accuracy_body)
    check(accuracy.get("overall", {}).get("n") == 744 and accuracy.get("start") == "2026-01-02" and accuracy.get("end") == "2026-02-01", "default accuracy covers 744 January-decision hours")

    _, diagnostics_body = get(base, "/api/diagnostics")
    diagnostics = json.loads(diagnostics_body)
    check(diagnostics.get("bias_correction_illustration", {}).get("corrected", {}).get("n") == 768, "committed bias diagnostics are bundled")

    _, horizon_body = get(base, "/api/accuracy/horizon")
    check(bool(json.loads(horizon_body).get("buckets")), "all-vintages horizon analysis responds")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("url", help="Deployment origin, for example https://your-project.vercel.app")
    args = parser.parse_args()
    try:
        run(args.url)
    except (AssertionError, ValueError, HTTPError, URLError, TimeoutError, json.JSONDecodeError) as error:
        parser.exit(1, f"FAIL {error}\n")


if __name__ == "__main__":
    main()
