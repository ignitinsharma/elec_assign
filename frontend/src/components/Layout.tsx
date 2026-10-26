import { Suspense, useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  accuracyOptions,
  decisionOptions,
  diagnosticsOptions,
  horizonOptions,
  pointsOptions,
  useMeta,
  vintageOptions,
} from '../hooks/useWindData'
import { PageState } from './PageState'
import { LoadingRegion, Skeleton } from './Skeleton'
import { formatDate } from '../utils/format'

const views = [
  { path: '/', title: 'Decision Desk', short: 'Desk' },
  { path: '/revisions', title: 'Forecast Revisions', short: 'Revisions' },
  { path: '/accuracy', title: 'Forecast Accuracy', short: 'Accuracy' },
  { path: '/method', title: 'Method & limits', short: 'Method' },
]

export function Layout() {
  const metaQuery = useMeta()
  const [chosenDay, setDay] = useState<string | null>(null)
  const [chosenCutoff, setCutoff] = useState<number | null>(null)
  const location = useLocation()
  const queryClient = useQueryClient()
  const lastPath = useRef(location.pathname)
  const activeIndex = Math.max(
    0,
    views.findIndex((view) => view.path === location.pathname),
  )
  const activeTitle = views[activeIndex].title
  useEffect(() => {
    document.title = `${activeTitle} | Wind Forecast Decision Desk`
    if (lastPath.current !== location.pathname) {
      lastPath.current = location.pathname
      const main = document.getElementById('main')
      if (!main) return
      const observer = new MutationObserver(() => {
        const heading = main.querySelector<HTMLElement>('h1')
        if (heading) {
          heading.focus()
          observer.disconnect()
        }
      })
      observer.observe(main, { childList: true, subtree: true })
      const heading = main.querySelector<HTMLElement>('h1')
      if (heading) {
        heading.focus()
        observer.disconnect()
      }
      return () => observer.disconnect()
    }
  }, [activeTitle, location.pathname])
  const meta = metaQuery.data
  const day = chosenDay ?? meta?.accuracy_default_start ?? ''
  const cutoff = chosenCutoff ?? meta?.cutoff_hour_default ?? 9
  const first = meta?.available_delivery_dates[0]
  const last = meta?.available_delivery_dates.at(-1)
  const snapshotRange =
    first && last ? `${formatDate(first)}–${formatDate(last)}` : ''

  function prefetch(path: string) {
    if (!meta) return
    if (path === '/')
      void queryClient.prefetchQuery(decisionOptions(day, cutoff))
    if (path === '/revisions')
      void queryClient.prefetchQuery(vintageOptions(day, cutoff))
    if (path === '/accuracy') {
      const firstDay = meta.accuracy_default_start
      const lastDay = meta.accuracy_default_end
      void queryClient.prefetchQuery(accuracyOptions(firstDay, lastDay, cutoff))
      void queryClient.prefetchQuery(pointsOptions(firstDay, lastDay, cutoff))
      void queryClient.prefetchQuery(horizonOptions())
      void queryClient.prefetchQuery(diagnosticsOptions())
    }
  }

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
          {meta ? (
            <span
              className="snapshot-badge"
              aria-label={`Data snapshot ${first} to ${last}`}
            >
              ● Snapshot · {snapshotRange} · National wind
            </span>
          ) : (
            <Skeleton className="skeleton-badge" />
          )}
        </div>
        <nav
          className="site-nav"
          aria-label="Main navigation"
          style={{ '--active-index': activeIndex } as React.CSSProperties}
        >
          {views.map((view) => (
            <NavLink
              key={view.path}
              to={view.path}
              end={view.path === '/'}
              onMouseEnter={() => prefetch(view.path)}
              onFocus={() => prefetch(view.path)}
            >
              <span className="nav-long">{view.title}</span>
              <span className="nav-short">{view.short}</span>
            </NavLink>
          ))}
        </nav>
      </header>
      <span className="sr-only" aria-live="polite">
        {activeTitle} page
      </span>
      <main id="main" className="page-wrap" tabIndex={-1}>
        {meta ? (
          <div key={location.pathname} className="route-enter">
            <Suspense
              fallback={
                <LoadingRegion
                  kind={
                    activeIndex === 2
                      ? 'accuracy'
                      : activeIndex === 1
                        ? 'revisions'
                        : activeIndex === 3
                          ? 'method'
                          : 'decision'
                  }
                />
              }
            >
              <Outlet context={{ meta, day, setDay, cutoff, setCutoff }} />
            </Suspense>
          </div>
        ) : (
          <PageState
            query={metaQuery}
            label="snapshot metadata"
            kind={
              activeIndex === 3
                ? 'method'
                : activeIndex === 2
                  ? 'accuracy'
                  : activeIndex === 1
                    ? 'revisions'
                    : 'decision'
            }
          />
        )}
      </main>
      <footer className="site-footer">
        BMRS FUELHH WIND + WINDFOR ·{' '}
        {snapshotRange ? `${snapshotRange} snapshot · ` : ''}Times shown in
        Europe/London
      </footer>
    </div>
  )
}
