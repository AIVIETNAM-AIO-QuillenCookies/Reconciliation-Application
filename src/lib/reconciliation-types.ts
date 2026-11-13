import type { ReconciliationException } from './exceptions.ts'
import type { RunEvidence } from './reconciliation-evidence.ts'

export const BRIDGE_KEYS = [
  'Flash_Sales',
  'Discounts',
  'Cancellations',
  'Timing_Differences',
  'Returns',
  'Data_Errors',
  'GL_Finance',
] as const
export type BridgeKey = (typeof BRIDGE_KEYS)[number]
export type BridgeMetrics = Record<BridgeKey, number>
export interface ReconciliationPeriod {
  start: string
  end: string
}
export interface DimTableInfo {
  name: string
  rowCount: number
  columns: string[]
}
export interface ReconciliationResult extends BridgeMetrics {
  /** Complete dashboard aggregates from this run; never reconstructed from evidence previews. */
  dashboard?: import('./dashboard-model.ts').DashboardSnapshot
  glReview?: import('./gl-review.ts').GLReviewSnapshot
  /** Bounded, JSON-friendly evidence captured before this successful run closes. */
  evidence?: RunEvidence
  schemaMode: 'accounting' | 'compatible' | 'strict'
  compatibilityWarnings: string[]
  dimTables: DimTableInfo[]
  exceptions: ReconciliationException[]
  /** Exact integer cents; floating point is used only at the presentation boundary. */
  cents: Record<BridgeKey, number>
  Unexplained: number
  unexplainedCents: number
  duplicatePOSLines: number
  missingGLEntries: number
  duplicatePOSAdjustment: number
  missingGLAdjustment: number
  duplicatePOSAdjustmentCents: number
  missingGLAdjustmentCents: number
  period: ReconciliationPeriod
  rowCounts: Record<'POS' | 'WEB' | 'GL' | 'Flash', number>
  posPostingDateFallback: boolean
  dailyDifferenceCount: number
  dailyDifferences: {
    storeKey: string
    postingDate: string
    expectedCents: number
    glCents: number
    varianceCents: number
    missingGL: boolean
  }[]
}

export interface WaterfallStep {
  key: string
  label: string
  amount: number
  amountCents: number
  startCents: number
  endCents: number
  start: number
  end: number
  range: [number, number]
  total: boolean
  unexplained: boolean
}

export function buildWaterfall(result: ReconciliationResult): WaterfallStep[] {
  let running = 0n
  const keys: (BridgeKey | 'Unexplained')[] = [...BRIDGE_KEYS]
  if (result.unexplainedCents !== 0) keys.splice(-1, 0, 'Unexplained')
  const labels: Record<BridgeKey | 'Unexplained', string> = {
    Flash_Sales: 'Flash sales',
    Discounts: 'Discounts',
    Cancellations: 'Cancellations',
    Timing_Differences: 'Timing',
    Returns: 'Returns',
    Data_Errors: 'Data errors',
    GL_Finance: 'GL finance',
    Unexplained: 'Unexplained',
  }
  return keys.map((key) => {
    const amountCents =
      key === 'Unexplained' ? result.unexplainedCents : result.cents[key]
    const total = key === 'Flash_Sales' || key === 'GL_Finance'
    const start = total ? 0n : running
    const end = total ? BigInt(amountCents) : running + BigInt(amountCents)
    running = end
    return {
      key,
      label: labels[key],
      amount: amountCents / 100,
      amountCents,
      startCents: Number(start),
      endCents: Number(end),
      start: Number(start) / 100,
      end: Number(end) / 100,
      range: [
        Number(start < end ? start : end) / 100,
        Number(start > end ? start : end) / 100,
      ],
      total,
      unexplained: key === 'Unexplained',
    }
  })
}
