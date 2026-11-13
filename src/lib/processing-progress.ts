import type { ProcessingPhase, RunEvidence } from './reconciliation-evidence.ts'
import type { JoinValidation, MasterValidation } from './master-data.ts'
import type { PosDiagnostics } from './pos-diagnostics.ts'

export type StepStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'needs-configuration'
  | 'error'
  | 'not-applicable'
  | 'waiting'
export interface ProgressMetric {
  label: string
  value: string | number
}
export interface EngineProgressEvent {
  phase: ProcessingPhase
  status: 'running' | 'completed' | 'error' | 'not-applicable'
  runId: string
  detail?: string
  error?: string
  source?: string
  fileId?: string
  fileName?: string
  joins?: JoinValidation[]
  metrics?: ProgressMetric[]
  tableIds?: string[]
  diagnostics?: PosDiagnostics
}
export interface ProgressStep {
  id: string
  title: string
  description: string
  input: string
  output: string
  status: StepStatus
  detail?: string
  error?: string
  source?: string
  fileId?: string
  fileName?: string
  joins: JoinValidation[]
  metrics: ProgressMetric[]
  tableIds: string[]
  diagnostics?: PosDiagnostics
}
export interface ProcessingFlow {
  id: string
  kind: 'configuration' | 'pipeline'
  engineRunId?: string
  fileId?: string
  fingerprint?: string
  status:
    | 'waiting'
    | 'running'
    | 'completed'
    | 'needs-configuration'
    | 'error'
    | 'cancelled'
  currentStepId: string | null
  steps: ProgressStep[]
  error?: string
}
const pipelineDefinitions = [
  [
    'registering',
    'Đọc dữ liệu nguồn',
    'Đọc CSV/XLSX theo cấu hình đã xác nhận.',
    'Tệp đã chọn, sheet và dòng tiêu đề',
    'Tệp được đăng ký trong DuckDB',
  ],
  [
    'dimensions',
    'Nạp dữ liệu tham chiếu',
    'Chỉ nạp các sheet Master / Dim đã xác nhận.',
    'Các sheet tham chiếu được sử dụng',
    'Các bảng dim và schema thực tế',
  ],
  [
    'projecting',
    'Ánh xạ trường & phép nối',
    'Áp dụng mapping, kiểm tra khóa và cấu hình phép nối trên toàn bộ tệp.',
    'Cột nguồn và cấu hình phép nối',
    'raw_pos, raw_web, raw_gl, raw_flash',
  ],
  [
    'normalizing',
    'Chuẩn hóa dữ liệu nguồn',
    'Chuẩn hóa khóa, ngày, timestamp, trạng thái và số tiền theo cơ sở của dữ liệu nguồn.',
    'Các projection của bốn nguồn',
    'POS staging, vw_web, vw_gl, vw_flash',
  ],
  [
    'classifying',
    'Phân loại dòng xuất lặp',
    'Xếp hạng theo receipt_no + line_no, thời điểm xuất sớm nhất và các khóa thứ tự ổn định.',
    'POS staging, gồm mọi bản xuất',
    'Keeper và nhánh audit các dòng bị loại',
  ],
  [
    'cleaning',
    'Làm sạch keeper',
    'Giữ đúng một bản xuất cho mỗi receipt_no + line_no; bảo toàn các line khác nhau của cùng receipt.',
    'Các dòng có hạng keeper bằng 1',
    'q_POS_Cleaning',
  ],
  [
    'mapping',
    'Ánh xạ tham chiếu',
    'Áp dụng cấu hình cửa hàng, ngày ghi nhận và khóa FX; kiểm tra phép nối không nhân dòng.',
    'Keeper đã làm sạch và tham chiếu đã xác nhận',
    'q_POS_Mapped: khóa cửa hàng, nguồn ngày ghi nhận và tỷ giá',
  ],
  [
    'converting',
    'Quy đổi USD',
    'Quy đổi nguyên tệ theo amount_local / usd_to_ccy. Giữ net USD được map và các cơ sở tỷ giá riêng.',
    'Tiền nguyên tệ, currency, khóa ngày/kỳ và tỷ giá',
    'q_POS_USD và duplicate impact từ nhánh audit',
  ],
  [
    'validating',
    'Kiểm tra đầu ra kế toán',
    'Kiểm tra USD sau quy đổi, grain fact, tính duy nhất và các điều kiện kế toán của từng nguồn.',
    'Keeper đã quy đổi, audit và các bảng nguồn đã chuẩn hóa',
    'fact_POS_final và kết quả kiểm tra dòng/nhóm khóa',
  ],
  [
    'recognition',
    'Tạo sự kiện & tổng hợp',
    'Ghi nhận POS/WEB theo ngày tương ứng; tổng hợp nguồn và GL về cửa hàng × ngày.',
    'POS keeper, WEB và GL',
    'expected_events và các bảng tổng hợp ngày',
  ],
  [
    'reconciling',
    'Đối soát & phân loại',
    'Tính cầu nối, chênh lệch ngày và các ngoại lệ có thể truy vết.',
    'Flash và doanh thu đã tổng hợp',
    'Cầu nối, daily differences và Exception Log',
  ],
  [
    'evidence',
    'Chuẩn bị kết quả để xem',
    'Giữ preview giới hạn từ chính connection của phiên trước khi cleanup.',
    'Các relation của phiên hiện tại',
    'Snapshot kết quả và preview cùng run ID',
  ],
] as const
const configurationDefinitions = [
  [
    'selection',
    'Xác nhận cấu hình',
    'Kiểm tra tệp, sheet, dòng tiêu đề và các trường đã ánh xạ.',
    'Draft hiện tại của các nguồn',
    'Cấu hình đủ để bắt đầu kiểm tra',
  ],
  [
    'registering',
    'Đọc tệp & dòng tiêu đề',
    'Đọc toàn bộ tệp theo cấu hình hiện tại; không chỉ kiểm tra dữ liệu mẫu.',
    'Các tệp và sheet đã chọn',
    'Tệp nguồn được đăng ký để kiểm tra',
  ],
  [
    'dimensions',
    'Nạp các sheet tham chiếu',
    'Xác nhận sheet và schema dùng cho từng role.',
    'Các role được bật',
    'Bảng tham chiếu được nạp cho phiên kiểm tra',
  ],
  [
    'projecting',
    'Kiểm tra ánh xạ, khóa & phép nối',
    'Kiểm tra cột, khóa ghép, cardinality, unmatched và giá trị đầu ra trên toàn bộ dữ liệu.',
    'Mapping và quan hệ đã chọn',
    'Số dòng trước/sau, lỗi khóa và mẫu khóa không khớp',
  ],
  [
    'summary',
    'Tổng hợp sẵn sàng',
    'Kết luận cấu hình hợp lệ hay cần sửa; chưa phải xử lý kế toán hoàn tất.',
    'Báo cáo validation thực tế',
    'Cấu hình hợp lệ hoặc các vấn đề cần sửa',
  ],
] as const
export function createProgressFlow(
  kind: ProcessingFlow['kind'],
  options: { id?: string; fileId?: string; fingerprint?: string } = {},
): ProcessingFlow {
  return {
    id: options.id ?? crypto.randomUUID(),
    kind,
    fileId: options.fileId,
    fingerprint: options.fingerprint,
    status: 'waiting',
    currentStepId: kind === 'configuration' ? 'selection' : null,
    steps: (kind === 'configuration'
      ? configurationDefinitions
      : pipelineDefinitions
    ).map(([id, title, description, input, output]) => ({
      id,
      title,
      description,
      input,
      output,
      status: 'pending',
      joins: [],
      metrics: [],
      tableIds: [],
    })),
  }
}
export function patchProgressStep(
  flow: ProcessingFlow,
  id: string,
  patch: Partial<ProgressStep>,
): ProcessingFlow {
  return {
    ...flow,
    steps: flow.steps.map((step) =>
      step.id === id ? { ...step, ...patch } : step,
    ),
  }
}
export function reduceProgress(
  flow: ProcessingFlow,
  event: EngineProgressEvent,
): ProcessingFlow {
  if (
    ['completed', 'error', 'needs-configuration', 'cancelled'].includes(
      flow.status,
    )
  )
    return flow
  if (flow.engineRunId && flow.engineRunId !== event.runId) return flow
  if (!flow.steps.some((step) => step.id === event.phase)) return flow
  const current = flow.steps.find((step) => step.id === event.phase)!
  const terminal =
    event.status === 'completed' || event.status === 'not-applicable'
  const joins = new Map(
    current.joins.map((join) => [
      `${join.relationshipId}:${join.fileId}`,
      join,
    ]),
  )
  event.joins?.forEach((join) =>
    joins.set(`${join.relationshipId}:${join.fileId}`, join),
  )
  const next = patchProgressStep(flow, event.phase, {
    status: event.status,
    detail: event.detail ?? (terminal ? undefined : current.detail),
    error: event.error,
    source: event.source ?? (terminal ? undefined : current.source),
    fileId: event.fileId ?? (terminal ? undefined : current.fileId),
    fileName: event.fileName ?? (terminal ? undefined : current.fileName),
    joins: [...joins.values()],
    metrics: event.metrics ?? current.metrics,
    tableIds: event.tableIds ?? current.tableIds,
    diagnostics:
      event.diagnostics?.runId === event.runId
        ? event.diagnostics
        : current.diagnostics,
  })
  return {
    ...next,
    engineRunId: event.runId,
    currentStepId: event.phase,
    status: event.status === 'error' ? 'error' : 'running',
    error: event.error,
    steps: next.steps.map((step) =>
      event.status === 'error' &&
      (step.status === 'pending' || step.status === 'running')
        ? { ...step, status: 'waiting' }
        : step,
    ),
  }
}
export function failProgress(
  flow: ProcessingFlow,
  error: string,
  status: 'error' | 'needs-configuration' | 'cancelled' = 'error',
): ProcessingFlow {
  const id =
    flow.currentStepId ??
    flow.steps.find((step) => step.status === 'pending')?.id ??
    flow.steps[0].id
  return {
    ...flow,
    status,
    error,
    currentStepId: id,
    steps: flow.steps.map((step) =>
      step.id === id
        ? {
            ...step,
            status: status === 'cancelled' ? 'waiting' : status,
            error,
          }
        : step.status === 'pending' || step.status === 'running'
          ? { ...step, status: 'waiting' }
          : step,
    ),
  }
}
export function finishConfiguration(
  flow: ProcessingFlow,
  validation: MasterValidation,
): ProcessingFlow {
  const next = patchProgressStep(flow, 'projecting', {
    source: undefined,
    fileId: undefined,
    fileName: undefined,
    detail: validation.passed
      ? 'Đã kiểm tra mapping và các phép nối của cấu hình hiện tại.'
      : 'Một hoặc nhiều phép nối cần sửa. Xem báo cáo theo nguồn bên dưới.',
    status: validation.passed ? 'completed' : 'error',
    joins: validation.joins,
    error: validation.errors.join('\n') || undefined,
    metrics: [
      { label: 'Phép nối đã kiểm tra', value: validation.joins.length },
    ],
  })
  return {
    ...patchProgressStep(next, 'summary', {
      status: validation.passed ? 'completed' : 'needs-configuration',
      detail: validation.passed
        ? 'Cấu hình hợp lệ. Có thể xác nhận để chạy đối soát.'
        : 'Cần sửa các vấn đề được nêu ở từng phép nối.',
      joins: validation.joins,
      error: validation.errors.join('\n') || undefined,
    }),
    status: validation.passed ? 'completed' : 'needs-configuration',
    currentStepId: validation.passed ? 'summary' : 'projecting',
    error: validation.errors.join('\n') || undefined,
  }
}
export function finishPipeline(
  flow: ProcessingFlow,
  evidence?: RunEvidence,
): ProcessingFlow {
  return {
    ...flow,
    engineRunId: evidence?.runId ?? flow.engineRunId,
    status: 'completed',
    currentStepId: flow.steps.at(-1)!.id,
    steps: flow.steps.map((step) =>
      step.status === 'pending' || step.status === 'running'
        ? {
            ...step,
            status: 'not-applicable',
            detail:
              'Bộ xử lý không cung cấp tín hiệu hoàn thành riêng cho bước này; không suy đoán trạng thái.',
          }
        : step,
    ),
  }
}
export const stepStatusLabels: Record<StepStatus, string> = {
  pending: 'Chưa chạy',
  running: 'Đang xử lý',
  completed: 'Hoàn thành',
  'needs-configuration': 'Cần cấu hình',
  error: 'Lỗi',
  'not-applicable': 'Không áp dụng',
  waiting: 'Đang chờ bước trước',
}
export function progressEvidence(flow: ProcessingFlow, evidence?: RunEvidence) {
  return flow.kind === 'pipeline' &&
    flow.status === 'completed' &&
    flow.engineRunId === evidence?.runId
    ? evidence
    : undefined
}
