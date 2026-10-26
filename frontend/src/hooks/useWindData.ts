import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { windApi } from '../api/client'

export const decisionOptions = (day: string, cutoff: number) => ({
  queryKey: ['decision', day, cutoff] as const,
  queryFn: () => windApi.decision(day, cutoff),
  staleTime: Infinity,
})
export const vintageOptions = (day: string, cutoff: number) => ({
  queryKey: ['vintages', day, cutoff] as const,
  queryFn: () => windApi.vintages(day, cutoff),
  staleTime: Infinity,
})
export const accuracyOptions = (
  start: string,
  end: string,
  cutoff: number,
) => ({
  queryKey: ['accuracy', start, end, cutoff] as const,
  queryFn: () => windApi.accuracy(start, end, cutoff),
  staleTime: Infinity,
})
export const pointsOptions = (start: string, end: string, cutoff: number) => ({
  queryKey: ['points', start, end, cutoff] as const,
  queryFn: () => windApi.points(start, end, cutoff),
  staleTime: Infinity,
})
export const horizonOptions = () => ({
  queryKey: ['horizon'] as const,
  queryFn: windApi.horizon,
  staleTime: Infinity,
})
export const diagnosticsOptions = () => ({
  queryKey: ['diagnostics'] as const,
  queryFn: windApi.diagnostics,
  staleTime: Infinity,
})

export const useMeta = () =>
  useQuery({ queryKey: ['meta'], queryFn: windApi.meta, staleTime: Infinity })
export const useDecision = (day: string, cutoff: number) =>
  useQuery({
    ...decisionOptions(day, cutoff),
    placeholderData: keepPreviousData,
  })
export const useVintages = (day: string, cutoff: number) =>
  useQuery({
    ...vintageOptions(day, cutoff),
    placeholderData: keepPreviousData,
  })
export const useAccuracy = (start: string, end: string, cutoff: number) =>
  useQuery({
    ...accuracyOptions(start, end, cutoff),
    placeholderData: keepPreviousData,
    enabled: start <= end,
  })
export const usePoints = (start: string, end: string, cutoff: number) =>
  useQuery({
    ...pointsOptions(start, end, cutoff),
    placeholderData: keepPreviousData,
    enabled: start <= end,
  })
export const useHorizon = () => useQuery(horizonOptions())
export const useDiagnostics = () => useQuery(diagnosticsOptions())
