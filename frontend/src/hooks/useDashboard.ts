import { useOutletContext } from 'react-router-dom'
import type { MetaResponse } from '../types/analytics'

interface DashboardContext {
  meta: MetaResponse
  day: string
  setDay: (day: string) => void
  cutoff: number
  setCutoff: (hour: number) => void
}

export const useDashboard = () => useOutletContext<DashboardContext>()
