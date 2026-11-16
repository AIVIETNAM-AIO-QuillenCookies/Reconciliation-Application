import {
  parseExcelReference,
  type ExcelReferenceWorkbook,
  type ReferenceParseOptions,
} from './excel-reference.ts'
import { downloadSample } from './sample-download.ts'
import type {
  ReconciliationPeriod,
  ReconciliationResult,
} from './reconciliation-types.ts'
import type { ReconciliationException } from './exceptions.ts'

export const REFERENCE_FILE_NAME = 'Nexa_Home_Recon_Dataset_Final.xlsx'

/**
 * Asks open screens (e.g. unsaved accounting review edits) whether the Excel
 * reference may replace the visible result. A listener cancels the event to block.
 */
export const allowReferenceSwitch = () =>
  window.dispatchEvent(
    new Event('reconcile:before-reference', { cancelable: true }),
  )
export const REFERENCE_STEPS = [
  'Đọc workbook tham chiếu',
  'Kiểm tra cấu trúc và số liệu',
  'Chuẩn bị đối soát, hoàn trả và chất lượng',
  'Hiển thị đủ 4 dashboard',
] as const
export interface ExcelReferenceState {
  enabled: boolean
  status: 'idle' | 'loading' | 'ready' | 'error'
  panelOpen: boolean
  workbook: ExcelReferenceWorkbook | null
  fileName: string | null
  period: ReconciliationPeriod
  error: string | null
  step: number
  counts: number[]
}
export const emptyExcelReference = (): ExcelReferenceState => ({
  enabled: false,
  status: 'idle',
  panelOpen: false,
  workbook: null,
  fileName: null,
  period: { start: '2025-01-01', end: '2025-12-31' },
  error: null,
  step: -1,
  counts: [],
})

export function selectActiveResult(state: {
  excelReference: ExcelReferenceState
  reconciliationData: ReconciliationResult | null
  exceptionsData: ReconciliationException[]
  period: ReconciliationPeriod
}) {
  const reference = state.excelReference
  return reference.enabled && reference.status === 'ready' && reference.workbook
    ? {
        source: 'excel' as const,
        workbook: reference.workbook,
        period: reference.period,
      }
    : {
        source: 'raw' as const,
        result: state.reconciliationData,
        exceptions: state.exceptionsData,
        period: state.period,
      }
}

/** Independent lifecycle: these actions never mutate a Raw run or a review case. */
export function createExcelReferenceController(
  get: () => ExcelReferenceState,
  publish: (state: ExcelReferenceState) => void,
) {
  let generation = 0
  let controller: AbortController | null = null
  const patch = (update: Partial<ExcelReferenceState>) =>
    publish({ ...get(), ...update })
  return {
    openExcelReference() {
      patch({ panelOpen: true })
    },
    closeExcelReference() {
      patch({ panelOpen: false })
    },
    setExcelReferencePeriod(period: ReconciliationPeriod) {
      patch({ period: { ...period } })
    },
    disableExcelReference() {
      generation++
      controller?.abort()
      controller = null
      publish(emptyExcelReference())
    },
    async loadExcelReference(
      file?: Pick<File, 'name' | 'arrayBuffer'>,
      options?: ReferenceParseOptions,
    ) {
      const version = ++generation
      controller?.abort()
      const active = new AbortController()
      controller = active
      const current = () => version === generation && !active.signal.aborted
      publish({
        ...emptyExcelReference(),
        status: 'loading',
        panelOpen: true,
        fileName: file?.name ?? REFERENCE_FILE_NAME,
        step: 0,
      })
      try {
        let bytes: ArrayBuffer
        if (file) bytes = await file.arrayBuffer()
        else {
          const base =
            (import.meta as ImportMeta & { env?: { BASE_URL?: string } }).env
              ?.BASE_URL ?? '/'
          bytes = await downloadSample(async () => {
            const response = await fetch(
              `${base}demo/Nexa_Home_Recon_Dataset_Final.xlsx`,
              { signal: active.signal },
            )
            if (!response.ok)
              throw new Error(
                'Không đọc được workbook đi kèm. Hãy chọn file Excel tham chiếu.',
              )
            return response.arrayBuffer()
          }, 'Kiểm tra mạng rồi bấm “Mở workbook đi kèm” để thử lại, hoặc “Chọn workbook” nếu bạn có sẵn file Excel tham chiếu.')
        }
        if (!current()) return
        const workbook = await parseExcelReference(
          bytes,
          file?.name ?? REFERENCE_FILE_NAME,
          (stage) => {
            if (current())
              patch({
                step: stage === 'read' ? 0 : stage === 'validate' ? 1 : 2,
              })
          },
          options,
        )
        if (!current()) return
        const first = workbook.months[0]
        const last = workbook.months.at(-1)!
        const end = new Date(
          Date.UTC(Number(last.slice(0, 4)), Number(last.slice(5, 7)), 0),
        )
          .toISOString()
          .slice(0, 10)
        patch({
          workbook,
          enabled: true,
          status: 'ready',
          error: null,
          step: 4,
          period: { start: `${first}-01`, end },
          counts: [
            3 + (workbook.dashboard?.sourceSheets.length ?? 0),
            workbook.checks.length,
            workbook.bridgeRows.length +
              workbook.exceptions.length +
              workbook.details.length,
            workbook.months.length,
          ],
        })
      } catch (error) {
        if (!current()) return
        patch({
          enabled: false,
          workbook: null,
          status: 'error',
          error:
            error instanceof Error
              ? error.message
              : 'Không thể đọc workbook tham chiếu.',
        })
      }
    },
  }
}
