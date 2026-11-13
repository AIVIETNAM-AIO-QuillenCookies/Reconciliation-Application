import type { ProcessingPhase } from './reconciliation-evidence.ts'
import type { ReconciliationPeriod } from './reconciliation-types.ts'
import type { GLReviewSnapshot } from './gl-review.ts'
import type { PosDiagnostics } from './pos-diagnostics.ts'

export interface FailureReason {
  code: string
  fields: string[]
  message: string
  count?: number
}
export interface FailureSample {
  fileName: string
  sourceRecord: number
  /** Record ordinal is retained; physical CSV/worksheet line is not inferred. */
  values: Record<string, string | null>
}
export interface RunFailure {
  runId: string | null
  configurationId?: string
  period?: ReconciliationPeriod
  source: string | null
  fileId?: string
  fileName?: string
  stage: ProcessingPhase | 'period' | 'engine' | null
  originalMessage: string
  reasons: FailureReason[]
  samples: FailureSample[]
}

/** Keep the original diagnostic. A word such as "date" is never a reason code. */
export function captureRunFailure(
  issue: unknown,
  context: Partial<RunFailure> = {},
): RunFailure {
  const message = issue instanceof Error ? issue.message : String(issue)
  const structured = issue as {
    snapshot?: GLReviewSnapshot
    diagnostics?: PosDiagnostics
    reasonCode?: string
    fields?: string[]
  } | null
  const gl = structured?.snapshot
  const pos = structured?.diagnostics
  const reasons: FailureReason[] = gl
    ? gl.diagnostics
        .filter((d) => d.blocking)
        .map((d) => ({
          code: d.code,
          fields: [d.field],
          message: d.reason,
        }))
    : pos
      ? pos.reasons
          .filter((r) => r.rowCount > 0)
          .map((r) => ({
            code: r.code,
            fields: [],
            message: r.label,
            count: r.rowCount,
          }))
      : [
          {
            code:
              structured?.reasonCode ??
              /\[([A-Z][A-Z0-9_]+)\]/.exec(message)?.[1] ??
              'PROCESSING_FAILURE',
            fields: structured?.fields ?? [],
            message,
          },
        ]
  return {
    runId: gl?.runId ?? pos?.runId ?? null,
    source: gl ? 'GL' : pos ? 'POS' : null,
    stage: structured?.reasonCode?.startsWith('REPORTING_PERIOD_')
      ? 'period'
      : null,
    originalMessage: message,
    reasons,
    samples:
      pos?.reasons
        .flatMap((r) =>
          r.samples.map((s) => ({
            fileName: s.sourceFile,
            sourceRecord: s.sourceRecord,
            values: s.raw,
          })),
        )
        .slice(0, 5) ?? [],
    ...context,
  }
}
