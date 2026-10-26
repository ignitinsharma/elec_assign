import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useMeta } from '../hooks/useWindData'
import { PageState } from './PageState'

export function Layout() {
  const metaQuery = useMeta()
  const [chosenDay, setDay] = useState<string | null>(null)
  const [chosenCutoff, setCutoff] = useState<number | null>(null)
  if (metaQuery.isPending || metaQuery.isError || !metaQuery.data) {
    return <PageState query={metaQuery} label="snapshot metadata" />
  }
  const meta = metaQuery.data
  const day = chosenDay ?? meta.available_delivery_dates[0]
  const cutoff = chosenCutoff ?? meta.cutoff_hour_default
  const first = meta.available_delivery_dates[0]
  const last = meta.available_delivery_dates.at(-1)
  const snapshotMonth = first
    ? new Intl.DateTimeFormat('en-GB', {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      }).format(new Date(`${first}T00:00:00Z`))
    : 'No dates'

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="site-header">
        <div className="header-inner">
          <div className="brand">
            <div className="brand-mark" aria-hidden="true">
              W
            </div>
            <div>
              <span className="eyebrow">Trading intelligence</span>
              <strong>Wind Forecast Decision Desk</strong>
            </div>
          </div>
          <span
            className="snapshot-badge"
            aria-label={`Data snapshot ${first} to ${last}`}
          >
            ● Snapshot · {snapshotMonth} · National wind
          </span>
        </div>
        <nav className="site-nav" aria-label="Main navigation">
          <NavLink to="/" end>
            Decision Desk
          </NavLink>
          <NavLink to="/revisions">Forecast Revisions</NavLink>
          <NavLink to="/accuracy">Forecast Accuracy</NavLink>
          <NavLink to="/method">Method &amp; limits</NavLink>
        </nav>
      </header>
      <main id="main" className="page-wrap">
        <Outlet context={{ meta, day, setDay, cutoff, setCutoff }} />
      </main>
      <footer className="site-footer">
        BMRS FUELHH WIND + WINDFOR · {snapshotMonth} snapshot · Times shown in
        Europe/London
      </footer>
    </div>
  )
}
