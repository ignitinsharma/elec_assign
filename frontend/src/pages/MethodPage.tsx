import { useDashboard } from '../hooks/useDashboard'
import { SIGN_CONVENTION } from '../utils/format'

export function MethodPage() {
  const { meta } = useDashboard()
  const first = meta.available_delivery_dates[0]
  const last = meta.available_delivery_dates.at(-1)
  return (
    <>
      <div className="page-title-row">
        <div>
          <span className="eyebrow">Reference / methodology</span>
          <h1>Method &amp; limits</h1>
          <p>
            What these numbers mean, which records they use, and where the
            evidence stops.
          </p>
        </div>
      </div>
      <div className="method-grid">
        <section className="method-card">
          <span className="eyebrow">01 / Selection</span>
          <h2>The decision-time rule</h2>
          <p>
            For delivery day D in Europe/London, the decision cutoff is the
            chosen London hour on D−1. Each delivery hour uses the latest
            WINDFOR forecast published at or before that cutoff. A publication
            exactly at cutoff counts.
          </p>
        </section>
        <section className="method-card">
          <span className="eyebrow">02 / Comparison</span>
          <h2>Hourly matching</h2>
          <p>
            WINDFOR has hourly start times. Forecasts are joined to FUELHH WIND
            actuals on the exact UTC start time, using the :00 observation. The
            intervening :30 observations are not interpolated into the main
            analysis.
          </p>
        </section>
        <section className="method-card">
          <span className="eyebrow">03 / Interpretation</span>
          <h2>Error and shortfall</h2>
          <p>
            {SIGN_CONVENTION} Shortfall is max(forecast − actual, 0) MW. MAE is
            average absolute error; bias is average signed error. P90 and P95
            shortfall are historical percentile levels, not guaranteed future
            buffers.
          </p>
        </section>
        <section className="method-card">
          <span className="eyebrow">04 / Provenance</span>
          <h2>Committed snapshot</h2>
          <p>
            Available delivery dates: {first} to {last}. All runtime analysis
            reads the committed snapshot; the live BMRS API is not called by the
            dashboard.
          </p>
          <p>
            Source datasets:{' '}
            <a
              href="https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/FUELHH/stream"
              target="_blank"
              rel="noreferrer"
            >
              Elexon FUELHH WIND ↗
            </a>{' '}
            and{' '}
            <a
              href="https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/WINDFOR/stream"
              target="_blank"
              rel="noreferrer"
            >
              Elexon WINDFOR ↗
            </a>
            .
          </p>
        </section>
      </div>
      <section className="limits-card">
        <span className="eyebrow">Read before acting</span>
        <h2>Limits of this analysis</h2>
        <ul>
          <li>
            The snapshot covers one month and national wind only; it does not
            establish performance in other seasons or regions.
          </li>
          <li>
            Documentation does not establish a matched list of wind farms for
            WINDFOR and FUELHH WIND. The cause of the observed positive bias
            remains unverified.
          </li>
          <li>
            The all-vintages horizon chart includes publications after the
            day-ahead cutoff and is separate from decision-time performance.
          </li>
          <li>
            The bias adjustment is a retrospective same-month illustration that
            uses future days, not a trading recommendation.
          </li>
        </ul>
        <a
          className="text-link"
          href="https://github.com/ignitinsharma/elec_assign/blob/main/README.md"
          target="_blank"
          rel="noreferrer"
        >
          Read the full README methodology ↗
        </a>
      </section>
    </>
  )
}
