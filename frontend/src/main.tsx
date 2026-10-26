import { StrictMode, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import './styles/global.css'
import './styles/dashboard.css'
import './styles/responsive.css'

const DecisionDesk = lazy(() =>
  import('./pages/DecisionDesk').then((module) => ({
    default: module.DecisionDesk,
  })),
)
const ForecastRevisions = lazy(() =>
  import('./pages/ForecastRevisions').then((module) => ({
    default: module.ForecastRevisions,
  })),
)
const ForecastAccuracy = lazy(() =>
  import('./pages/ForecastAccuracy').then((module) => ({
    default: module.ForecastAccuracy,
  })),
)
const MethodPage = lazy(() =>
  import('./pages/MethodPage').then((module) => ({
    default: module.MethodPage,
  })),
)
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<DecisionDesk />} />
            <Route path="revisions" element={<ForecastRevisions />} />
            <Route path="accuracy" element={<ForecastAccuracy />} />
            <Route path="method" element={<MethodPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
