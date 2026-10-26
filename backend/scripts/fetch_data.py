"""Future BMRS downloader for January 2026 FUELHH WIND and WINDFOR.

FUELHH stream accepts settlementDateFrom, settlementDateTo, and fuelType.
WINDFOR stream accepts publishDateTimeFrom and publishDateTimeTo. The
publication window must include forecasts made before January 2026 for
January delivery. No download is performed by this setup stub.
"""


def main() -> None:
    raise SystemExit("BMRS ingestion is not implemented in the setup phase.")


if __name__ == "__main__":
    main()
