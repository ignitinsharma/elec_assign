import { useQuery } from '@tanstack/react-query'
import { windApi } from '../api/client'

export const useMeta = () =>
  useQuery({ queryKey: ['meta'], queryFn: windApi.meta, staleTime: Infinity })
export const useDecision = (day: string, cutoff: number) =>
  useQuery({
    queryKey: ['decision', day, cutoff],
    queryFn: () => windApi.decision(day, cutoff),
  })
export const useVintages = (day: string, cutoff: number) =>
  useQuery({
    queryKey: ['vintages', day, cutoff],
    queryFn: () => windApi.vintages(day, cutoff),
  })
export const useAccuracy = (start: string, end: string, cutoff: number) =>
  useQuery({
    queryKey: ['accuracy', start, end, cutoff],
    queryFn: () => windApi.accuracy(start, end, cutoff),
    enabled: start <= end,
  })
export const usePoints = (start: string, end: string, cutoff: number) =>
  useQuery({
    queryKey: ['points', start, end, cutoff],
    queryFn: () => windApi.points(start, end, cutoff),
    enabled: start <= end,
  })
export const useHorizon = () =>
  useQuery({
    queryKey: ['horizon'],
    queryFn: windApi.horizon,
    staleTime: Infinity,
  })
export const useDiagnostics = () =>
  useQuery({
    queryKey: ['diagnostics'],
    queryFn: windApi.diagnostics,
    staleTime: Infinity,
  })
