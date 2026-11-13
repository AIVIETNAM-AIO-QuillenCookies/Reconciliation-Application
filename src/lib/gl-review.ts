/** Browser-session GL review contracts. Raw source values are never edited. */
export type GLAmountBasis = 'ledger' | 'revenue'
export type GLClassification =
  'shipping' | 'channel_transfer' | 'unexplained' | 'other'
export type GLCaseStatus = 'open' | 'in_progress' | 'reviewed' | 'confirmed'
export interface GLPatch {
  amountCents?: number
  postingDate?: string
  period?: string
  storeKey?: string
  channel?: string
}
export interface GLCorrection {
  id: string
  recordId: string
  sourceFingerprint: string
  configurationVersion: string
  patch: GLPatch
  reason: string
  appliedAt: string
  active: boolean
}
export interface GLRecord {
  id: string
  sourceFingerprint: string
  configurationVersion: string
  fileId: string
  fileName: string
  sheetName: string
  sourceRow: number | null
  sourceRecord?: number
  sourceValues?: Record<string, string | null>
  journalId: string | null
  journalType: string | null
  postingDate: string | null
  period: string | null
  storeKey: string
  storeCode: string | null
  channel: string
  amountCents: number | null
  revenueCents: number | null
  sourceRef: string | null
  description: string | null
  amountBasis: GLAmountBasis
  raw: {
    journalId: string | null
    postingDate: string | null
    period: string | null
    storeKey: string | null
    storeCode: string | null
    channel: string | null
    amount: string | null
    journalType: string | null
    sourceRef: string | null
    description: string | null
  }
  original: {
    postingDate: string | null
    period: string | null
    storeKey: string
    channel: string
    amountCents: number | null
    revenueCents: number | null
  }
  staleCorrection: boolean
}
export interface GLDiagnostic {
  id: string
  code: string
  recordId: string
  journalId: string | null
  field: string
  value: string | null
  fileName: string
  sheetName: string
  sourceRow: number | null
  reason: string
  blocking: boolean
}
export interface GLTransformation {
  id: string
  rule: string
  recordId: string
  journalId: string | null
  sourceField: string
  outputField: string
  before: string | null
  after: string | null
  impactCents: number
}
export interface GLReviewSnapshot {
  expectedDaily?: {
    storeKey: string
    postingDate: string
    revenueCents: number
  }[]
  runId: string
  records: GLRecord[]
  transformations: GLTransformation[]
  diagnostics: GLDiagnostic[]
  configurationVersion: string
  complete: boolean
}

/** Stable deterministic identity; financial correctness never depends on this hash alone. */
export function glFingerprint(value: unknown): string {
  const text = JSON.stringify(value)
  let hash = 14695981039346656037n
  for (let index = 0; index < text.length; index++) {
    hash ^= BigInt(text.charCodeAt(index))
    hash = BigInt.asUintN(64, hash * 1099511628211n)
  }
  return hash.toString(16).padStart(16, '0')
}

export function suggestGLClassification(record: GLRecord): {
  classification: GLClassification
  reasons: string[]
} {
  const text = `${record.sourceRef ?? ''} ${record.description ?? ''}`
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
  if (
    /(?:\brcl\b|reclass|chuyen kenh|channel transfer)/.test(
      text.replaceAll('-', ' '),
    )
  )
    return {
      classification: 'channel_transfer',
      reasons: [
        'Tham chiếu hoặc diễn giải có dấu hiệu chuyển kênh; cần kiểm tra đủ hai vế và tác động từng kênh.',
      ],
    }
  if (
    /(shipping|\bship\b|freight|delivery fee|phi van chuyen|cuoc van chuyen)/.test(
      text.replaceAll('-', ' '),
    )
  )
    return {
      classification: 'shipping',
      reasons: [
        'Diễn giải có từ khóa phí vận chuyển; đây là gợi ý cần người dùng xác nhận.',
      ],
    }
  return {
    classification: 'unexplained',
    reasons: [
      record.storeKey === '-1' || record.channel === 'UNALLOCATED'
        ? 'Khoản chưa phân bổ cần Finance xác nhận mục đích và bằng chứng.'
        : 'Bút toán cần xác nhận mục đích và bằng chứng; mã tham chiếu không chứng minh đã xác minh.',
    ],
  }
}

export function isGLReviewRecord(record: GLRecord): boolean {
  return (
    record.journalType === 'MANUAL' ||
    record.storeKey === '-1' ||
    record.channel === 'UNALLOCATED' ||
    !record.description ||
    record.staleCorrection
  )
}

export function validateGLPatch(
  record: GLRecord,
  patch: GLPatch,
  reason: string,
): void {
  if (!reason.trim())
    throw new Error('Cần nhập lý do chỉnh sửa dữ liệu hiệu lực của phiên.')
  if (!Object.keys(patch).length)
    throw new Error('Chưa có thay đổi để áp dụng.')
  for (const key of Object.keys(patch))
    if (
      !['amountCents', 'postingDate', 'period', 'storeKey', 'channel'].includes(
        key,
      )
    )
      throw new Error('Trường chỉnh sửa GL không được hỗ trợ.')
  if (
    patch.amountCents !== undefined &&
    !Number.isSafeInteger(patch.amountCents)
  )
    throw new Error('Số tiền phải là số xu USD nguyên hợp lệ.')
  if (
    patch.postingDate !== undefined &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(patch.postingDate) ||
      !Number.isFinite(Date.parse(patch.postingDate)) ||
      new Date(patch.postingDate).toISOString().slice(0, 10) !==
        patch.postingDate)
  )
    throw new Error('Ngày hạch toán phải hợp lệ theo YYYY-MM-DD.')
  if (
    patch.period !== undefined &&
    !/^\d{4}-(0[1-9]|1[0-2])$/.test(patch.period)
  )
    throw new Error('Kỳ hạch toán phải hợp lệ theo YYYY-MM.')
  const date = patch.postingDate ?? record.postingDate
  const period =
    patch.period ??
    (patch.postingDate ? patch.postingDate.slice(0, 7) : record.period)
  if (date && period && date.slice(0, 7) !== period)
    throw new Error(
      'Kỳ và ngày hạch toán phải nhất quán; thay đổi cả hai nếu cần chuyển kỳ.',
    )
  if (patch.storeKey !== undefined && !patch.storeKey.trim())
    throw new Error(
      'Dùng -1 cho nhóm Chưa phân bổ; không để khóa hiệu lực trống.',
    )
  if (
    patch.channel !== undefined &&
    !['STORE', 'WEB', 'UNALLOCATED'].includes(patch.channel)
  )
    throw new Error('Kênh phải là STORE, WEB hoặc UNALLOCATED.')
  const store = patch.storeKey ?? record.storeKey
  const channel = patch.channel ?? record.channel
  if ((store === '-1') !== (channel === 'UNALLOCATED'))
    throw new Error(
      'Nhóm Chưa phân bổ phải dùng đồng thời store_key -1 và kênh UNALLOCATED.',
    )
}

export class GLValidationError extends Error {
  readonly snapshot: GLReviewSnapshot
  constructor(snapshot: GLReviewSnapshot) {
    const errors = snapshot.diagnostics.filter((issue) => issue.blocking)
    super(
      `[GL_VALIDATION] ${errors.length} lỗi chặn đầu ra GL, bridge và dashboard. ${errors
        .map(
          (issue) =>
            `${issue.code}: ${issue.field}=${issue.value ?? '(trống)'} · ${issue.fileName}/${issue.sheetName}/dòng ${issue.sourceRow}: ${issue.reason}`,
        )
        .slice(0, 8)
        .join(' | ')}`,
    )
    this.name = 'GLValidationError'
    this.snapshot = snapshot
  }
}
