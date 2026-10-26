import { useState } from 'react'
import { BreakdownChart } from '../components/BreakdownChart'
import { HorizonPanel } from '../components/HorizonPanel'
import { MetricCard } from '../components/MetricCard'
import { PageState } from '../components/PageState'
import { RangeControls } from '../components/Controls'
import { ScatterPanel } from '../components/ScatterPanel'
import { useDashboard } from '../hooks/useDashboard'
import {
  useAccuracy,
  useDiagnostics,
  useHorizon,
  usePoints,
} from '../hooks/useWindData'
import type { DiagnosticsResponse, Metrics } from '../types/analytics'
import {
  formatDate,
  formatMw,
  formatPercent,
  SIGN_CONVENTION,
} from '../utils/format'

function AccuracySummary({ metrics }: { metrics: Metrics }) {
  return (
    <>
      <div className="metric-grid six">
        <MetricCard
          label="MAE"
          value={formatMw(metrics.mae_mw)}
          explanation="Mean absolute error: average size of the forecast miss."
        />
        <MetricCard
          label="RMSE"
          value={formatMw(metrics.rmse_mw)}
          explanation="Root mean square error: gives larger misses more weight."
        />
        <MetricCard
          label="Bias"
          value={formatMw(metrics.bias_mw, true)}
          explanation="Mean forecast minus actual; positive means wind underdelivered versus forecast."
        />
        <MetricCard
          label="nMAE"
          value={formatPercent(metrics.nmae)}
          explanation="MAE divided by mean actual generation, shown as a percentage."
        />
        <MetricCard
          label="P90 shortfall"
          value={formatMw(metrics.p90_shortfall_mw)}
          explanation="Extra MW beyond the forecast that covers 90% of observed hourly shortfalls."
          tone="warning"
        />
        <MetricCard
          label="P95 shortfall"
          value={formatMw(metrics.p95_shortfall_mw)}
          explanation="Extra MW beyond the forecast that covers 95% of observed hourly shortfalls."
          tone="warning"
        />
      </div>
      <p className="sign-note">
        <strong>Error definition:</strong> {SIGN_CONVENTION}
      </p>
      <section className="planning-card">
        <span className="eyebrow">Trading context</span>
        <h2>Planning buffer</h2>
        <p>
          To cover 90% / 95% of hours in this selected period, the extra power
          needed beyond the forecast was{' '}
          <strong>{formatMw(metrics.p90_shortfall_mw)}</strong> /{' '}
          <strong>{formatMw(metrics.p95_shortfall_mw)}</strong>.
        </p>
        <small>
          Historical percentiles of max(forecast − actual, 0), not a
          forward-looking procurement recommendation.
        </small>
      </section>
    </>
  )
}

function BiasIllustration({ data }: { data: DiagnosticsResponse }) {
  const illustration = data.bias_correction_illustration
  return (
    <section className="illustration-card">
      <span className="eyebrow">
        Retrospective illustration · full committed snapshot
      </span>
      <h2>Illustrative bias adjustment</h2>
      <p>
        Leave one day out, estimate the constant error from the other days, then
        subtract it from the held-out forecasts. This is a same-month,
        in-sample-period illustration that uses future days. It is not a
        recommendation or a production trading rule.
      </p>
      <div className="comparison-grid">
        <div>
          <span>Uncorrected</span>
          <strong>{formatMw(illustration.uncorrected.mae_mw)}</strong>
          <small>
            MAE · P90 / P95 shortfall{' '}
            {formatMw(illustration.uncorrected.p90_shortfall_mw)} /{' '}
            {formatMw(illustration.uncorrected.p95_shortfall_mw)}
          </small>
        </div>
        <div>
          <span>Illustratively adjusted</span>
          <strong>{formatMw(illustration.corrected.mae_mw)}</strong>
          <small>
            MAE · P90 / P95 shortfall{' '}
            {formatMw(illustration.corrected.p90_shortfall_mw)} /{' '}
            {formatMw(illustration.corrected.p95_shortfall_mw)}
          </small>
        </div>
      </div>
    </section>
  )
}

export function ForecastAccuracy() {
  const { meta, cutoff, setCutoff } = useDashboard()
  const [start, setStart] = useState(meta.accuracy_default_start)
  const [end, setEnd] = useState(meta.accuracy_default_end)
  const validRange = start <= end
  const accuracy = useAccuracy(start, end, cutoff)
  const points = usePoints(start, end, cutoff)
  const horizon = useHorizon()
  const diagnostics = useDiagnostics()
  const data = accuracy.data

  return (
    <>
      <div className="page-title-row">
        <div>
          <span className="eyebrow">03 / Performance review</span>
          <h1 tabIndex={-1}>Forecast Accuracy</h1>
          <p>
            Measure the uncertainty that matters at the day-ahead decision
            point.
          </p>
        </div>
        <RangeControls
          meta={meta}
          start={start}
          end={end}
          onStart={setStart}
          onEnd={setEnd}
          cutoff={cutoff}
          onCutoff={setCutoff}
        />
      </div>
      {!validRange ? (
        <div className="state-panel" role="alert">
          The start date must be on or before the end date.
        </div>
      ) : accuracy.isPending || accuracy.isError || !data ? (
        <PageState query={accuracy} label="accuracy analysis" kind="accuracy" />
      ) : data.overall.n === 0 ? (
        <PageState query={accuracy} label="accuracy observations" />
      ) : (
        <div
          className={`data-content data-crossfade ${accuracy.isPlaceholderData ? 'is-updating' : ''}`}
          key={`${data.start}-${data.end}-${data.cutoff_hour}`}
          aria-busy={accuracy.isPlaceholderData}
        >
          {accuracy.isPlaceholderData && (
            <span className="updating-indicator" role="status">
              Updating…
            </span>
          )}
          <p className="basis-note">
            {data.basis}. {data.overall.n} hourly comparisons · delivery{' '}
            {formatDate(data.start)} to {formatDate(data.end)} · decisions{' '}
            {formatDate(
              meta.available_delivery_decisions.find(
                (item) => item.delivery_date === data.start,
              )?.decision_date ?? data.start,
            )}{' '}
            to{' '}
            {formatDate(
              meta.available_delivery_decisions.find(
                (item) => item.delivery_date === data.end,
              )?.decision_date ?? data.end,
            )}{' '}
            · cutoff {String(data.cutoff_hour).padStart(2, '0')}:00
            Europe/London.
          </p>
          <AccuracySummary metrics={data.overall} />
          <div className="chart-grid">
            <BreakdownChart
              rows={data.breakdowns.by_delivery_day}
              title="Daily accuracy"
              description="MAE and signed bias by London delivery day; MW."
            />
            <BreakdownChart
              rows={data.breakdowns.by_hour_london}
              title="Error by hour of day"
              description="MAE and signed bias by London delivery hour; MW."
            />
          </div>
          <div className="chart-grid">
            <BreakdownChart
              rows={data.breakdowns.by_wind_band}
              title="Bias by actual wind level"
              description={`Actual wind terciles; thresholds ${data.breakdowns.wind_band_thresholds_mw.map((value) => formatMw(value)).join(' and ')}. MAE and signed bias in MW.`}
            />
            {points.isPending || points.isError || !points.data ? (
              <PageState
                query={points}
                label="scatter observations"
                kind="chart"
              />
            ) : (
              <div
                className={points.isPlaceholderData ? 'is-updating' : ''}
                aria-busy={points.isPlaceholderData}
              >
                {points.isPlaceholderData && (
                  <span className="updating-indicator" role="status">
                    Updating…
                  </span>
                )}
                <ScatterPanel data={points.data} />
              </div>
            )}
          </div>
          {horizon.isPending || horizon.isError || !horizon.data ? (
            <PageState
              query={horizon}
              label="all-vintages horizon analysis"
              kind="chart"
            />
          ) : (
            <HorizonPanel data={horizon.data} />
          )}
          {diagnostics.isPending || diagnostics.isError || !diagnostics.data ? (
            <PageState
              query={diagnostics}
              label="bias illustration"
              kind="card"
            />
          ) : (
            <BiasIllustration data={diagnostics.data} />
          )}
        </div>
      )}
    </>
  )
}
