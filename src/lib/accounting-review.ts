import type {
  GLRecord,
  GLReviewSnapshot,
  GLClassification,
  GLCaseStatus,
  GLCorrection,
} from './gl-review.ts'
import { suggestGLClassification } from './gl-review.ts'
import type { ReconciliationException } from './exceptions.ts'

export interface GLReviewCase {
  id: string
  recordIds: string[]
  sourceFingerprints: Record<string, string>
  configurationVersion: string
  originalPeriods: string[]
  classification: GLClassification
  suggestionReasons: string[]
  status: GLCaseStatus
  purpose: string
  notes: string
  evidence: string
  evidenceReviewed: boolean
  decision: string
  owner: string
  dueDate: string
  nextStep: string
  history: { at: string; action: string; detail: string }[]
  stale: boolean
}
export type GLCasePatch = Partial<
  Pick<
    GLReviewCase,
    | 'classification'
    | 'status'
    | 'purpose'
    | 'notes'
    | 'evidence'
    | 'evidenceReviewed'
    | 'decision'
    | 'owner'
    | 'dueDate'
    | 'nextStep'
  >
>
export type GLCorrectionPatch = GLCorrection['patch']
export interface GLCorrectionPreview {
  complete: boolean
  recordId: string
  before: GLRecord
  after: GLRecord
  totalGLDeltaCents: number
  unexplainedDeltaCents: number
  impacts: {
    period: string
    channel: string
    beforeCents: number
    afterCents: number
  }[]
  reason: string
  patch: GLCorrectionPatch
}

const now = () => new Date().toISOString()
function needsReview(record: GLRecord) {
  return (
    record.journalType === 'MANUAL' ||
    record.channel === 'UNALLOCATED' ||
    record.storeKey === '-1' ||
    !record.description?.trim() ||
    record.staleCorrection
  )
}
export function transferIssue(records: readonly GLRecord[]): string | null {
  if (records.length !== 2) return 'Chuyển kênh cần đúng hai journal độc lập.'
  if (records.some((r) => r.revenueCents === null))
    return 'Chưa đọc được số tiền của hai vế.'
  if (
    records[0].channel === records[1].channel ||
    records.some((r) => r.channel === 'UNALLOCATED')
  )
    return 'Hai vế phải thuộc hai kênh xác định khác nhau.'
  if (records[0].period !== records[1].period)
    return 'Hai vế khác kỳ, cần rà soát thời điểm ghi nhận.'
  if (records.reduce((sum, r) => sum + (r.revenueCents ?? 0), 0) !== 0)
    return 'Tổng doanh thu hai vế chưa bằng 0.'
  return null
}

/** Cases are control views over journals. They never contribute a second GL amount. */
export function synchronizeReviewCases(
  snapshot: GLReviewSnapshot,
  previous: readonly GLReviewCase[] = [],
  forcedRecordIds: readonly string[] = [],
): GLReviewCase[] {
  const grouped = new Map<string, GLRecord[]>()
  for (const record of snapshot.records) {
    if (
      !needsReview(record) &&
      !snapshot.diagnostics.some((d) => d.recordId === record.id) &&
      !forcedRecordIds.includes(record.id) &&
      !previous.some((c) => c.recordIds.includes(record.id))
    )
      continue
    const hint = suggestGLClassification(record)
    const key =
      hint.classification === 'channel_transfer' && record.sourceRef
        ? `transfer:${encodeURIComponent(record.sourceRef)}`
        : `record:${record.id}`
    grouped.set(key, [...(grouped.get(key) ?? []), record])
  }
  const cases: GLReviewCase[] = []
  for (const [key, records] of grouped) {
    records.sort((a, b) => a.id.localeCompare(b.id))
    const id = `gl-case:${key}`
    const old = previous.find((c) => c.id === id)
    const fingerprints = Object.fromEntries(
      records.map((r) => [r.id, r.sourceFingerprint]),
    )
    const changed =
      !!old &&
      (old.configurationVersion !== snapshot.configurationVersion ||
        JSON.stringify(old.sourceFingerprints) !== JSON.stringify(fingerprints))
    const stale = changed || records.some((r) => r.staleCorrection)
    const hint = suggestGLClassification(records[0])
    const issue =
      hint.classification === 'channel_transfer' ? transferIssue(records) : null
    const base: GLReviewCase = {
      id,
      recordIds: records.map((r) => r.id),
      sourceFingerprints: fingerprints,
      configurationVersion: snapshot.configurationVersion,
      originalPeriods: [
        ...new Set(
          records.map(
            (r) => r.raw.period || r.original.period || 'Không đọc được kỳ',
          ),
        ),
      ],
      classification: hint.classification,
      suggestionReasons: hint.reasons,
      status: 'open',
      purpose: '',
      notes: '',
      evidence: '',
      evidenceReviewed: false,
      decision: '',
      owner: 'Finance',
      dueDate: '',
      nextStep: issue ?? 'Bổ sung bằng chứng và xác nhận mục đích.',
      history: [
        {
          at: now(),
          action: 'created',
          detail:
            'Tạo yêu cầu rà soát từ GL; mã tham chiếu chưa phải bằng chứng đã xác minh.',
        },
      ],
      stale,
    }
    cases.push(
      old
        ? {
            ...base,
            ...old,
            recordIds: base.recordIds,
            sourceFingerprints: fingerprints,
            originalPeriods: base.originalPeriods,
            configurationVersion: snapshot.configurationVersion,
            stale: stale || old.stale,
            ...(changed
              ? {
                  status: 'open' as const,
                  evidenceReviewed: false,
                  nextStep:
                    'Nguồn hoặc cấu hình đã thay đổi. Rà soát lại quyết định và chỉnh sửa cũ.',
                  history: [
                    ...old.history,
                    {
                      at: now(),
                      action: 'source_changed',
                      detail:
                        'Nguồn/cấu hình khác phiên đã xác nhận; không áp quyết định cũ tự động.',
                    },
                  ],
                }
              : {}),
          }
        : base,
    )
  }
  // Retain audit trails for records removed/replaced in the browser session.
  for (const old of previous)
    if (!cases.some((c) => c.id === old.id))
      cases.push(
        old.stale
          ? old
          : {
              ...old,
              stale: true,
              status: 'open',
              evidenceReviewed: false,
              nextStep:
                'Bản ghi không còn trong nguồn hiện tại. Kiểm tra tệp thay thế.',
              history: [
                ...old.history,
                {
                  at: now(),
                  action: 'source_removed',
                  detail:
                    'Giữ lịch sử; không áp dụng quyết định vào bản ghi khác.',
                },
              ],
            },
      )
  return cases
}

export function editReviewCase(
  current: GLReviewCase,
  patch: GLCasePatch,
  records: readonly GLRecord[],
): GLReviewCase {
  const allowed = [
    'classification',
    'status',
    'purpose',
    'notes',
    'evidence',
    'evidenceReviewed',
    'decision',
    'owner',
    'dueDate',
    'nextStep',
  ] as const
  const clean: GLCasePatch = {}
  for (const key of allowed)
    if (Object.hasOwn(patch, key)) Object.assign(clean, { [key]: patch[key] })
  const next = { ...current, ...clean }
  if (
    !['shipping', 'channel_transfer', 'unexplained', 'other'].includes(
      next.classification,
    ) ||
    !['open', 'in_progress', 'reviewed', 'confirmed'].includes(next.status)
  )
    throw new Error('Phân loại hoặc trạng thái không hợp lệ.')
  if (next.dueDate && !validDate(next.dueDate))
    throw new Error('Hạn xử lý phải là ngày hợp lệ.')
  if (next.evidenceReviewed && !next.evidence.trim())
    throw new Error('Cần bổ sung bằng chứng trước khi đánh dấu đã rà soát.')
  if (
    clean.evidence !== undefined &&
    clean.evidence !== current.evidence &&
    clean.evidenceReviewed === undefined
  )
    next.evidenceReviewed = false
  if (next.status === 'confirmed') {
    if (
      !next.purpose.trim() ||
      !next.decision.trim() ||
      !next.evidence.trim() ||
      !next.evidenceReviewed
    )
      throw new Error(
        'Xác nhận cần mục đích, quyết định cụ thể và bằng chứng đã được rà soát.',
      )
    if (next.classification === 'unexplained')
      throw new Error(
        'Khoản chưa giải thích cần tiếp tục theo dõi cho tới khi có phân loại và căn cứ.',
      )
    const linked = records.filter((r) => current.recordIds.includes(r.id))
    if (linked.some((r) => r.staleCorrection))
      throw new Error(
        'Chỉnh sửa cũ đã bị bỏ qua do nguồn thay đổi. Hoàn tác hoặc thay thế chỉnh sửa đó trước khi xác nhận.',
      )
    if (
      linked.length !== current.recordIds.length ||
      linked.some(
        (r) =>
          r.amountCents === null ||
          !r.postingDate ||
          !r.journalId ||
          !r.journalType ||
          records.filter((other) => other.journalId === r.journalId).length >
            1 ||
          (r.storeKey === '-1') !== (r.channel === 'UNALLOCATED') ||
          !['STORE', 'WEB', 'UNALLOCATED'].includes(r.channel),
      )
    )
      throw new Error(
        'Không thể xác nhận khi nguồn thiếu hoặc còn lỗi dữ liệu.',
      )
    if (next.classification === 'channel_transfer') {
      const issue = transferIssue(linked)
      if (issue) throw new Error(issue)
    }
    next.stale = false
  }
  const changed = allowed.filter((key) => current[key] !== next[key])
  if (!changed.length && current.stale === next.stale) return current
  return {
    ...next,
    history: [
      ...current.history,
      {
        at: now(),
        action: 'updated',
        detail: JSON.stringify({
          before: Object.fromEntries(changed.map((k) => [k, current[k]])),
          after: Object.fromEntries(changed.map((k) => [k, next[k]])),
        }),
      },
    ],
  }
}

const validDate = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString().slice(0, 10) === value

export function previewCorrection(
  record: GLRecord,
  patch: GLCorrectionPatch,
  reason: string,
  period: { start: string; end: string },
): GLCorrectionPreview {
  if (!reason.trim())
    throw new Error('Nhập lý do chỉnh sửa trước khi xem ảnh hưởng và áp dụng.')
  const keys = Object.keys(patch)
  if (
    !keys.length ||
    keys.some(
      (k) =>
        ![
          'amountCents',
          'postingDate',
          'period',
          'storeKey',
          'channel',
        ].includes(k),
    )
  )
    throw new Error('Chọn ít nhất một trường được phép chỉnh sửa.')
  if (
    patch.amountCents !== undefined &&
    !Number.isSafeInteger(patch.amountCents)
  )
    throw new Error(
      'Số tiền phải chính xác đến cent và nằm trong phạm vi hỗ trợ.',
    )
  const after = {
    ...record,
    ...patch,
    revenueCents:
      patch.amountCents === undefined
        ? record.revenueCents
        : -patch.amountCents,
  }
  if (!after.postingDate || !validDate(after.postingDate))
    throw new Error('Ngày hạch toán không hợp lệ.')
  if (patch.postingDate !== undefined && patch.period === undefined)
    after.period = after.postingDate.slice(0, 7)
  if (after.period !== after.postingDate.slice(0, 7))
    throw new Error(
      'Kỳ phải khớp với ngày hạch toán; chỉnh cả ngày khi chuyển kỳ.',
    )
  if (!after.channel?.trim() || !after.storeKey?.trim())
    throw new Error(
      'Kênh và khóa phân bổ không được trống. Dùng -1 / UNALLOCATED cho chưa phân bổ.',
    )
  if (!['STORE', 'WEB', 'UNALLOCATED'].includes(after.channel))
    throw new Error('Kênh hợp lệ: STORE, WEB, UNALLOCATED.')
  if ((after.storeKey === '-1') !== (after.channel === 'UNALLOCATED'))
    throw new Error(
      'Khóa -1 thuộc nhóm kỹ thuật UNALLOCATED. Cần chỉnh cả phân bổ và kênh nhất quán.',
    )
  if (after.amountCents === null || after.revenueCents === null)
    throw new Error('Cần sửa số tiền không đọc được trước khi áp dụng.')
  const impacts = new Map<string, GLCorrectionPreview['impacts'][number]>()
  const add = (r: GLRecord, side: 'beforeCents' | 'afterCents') => {
    const key = `${r.period}:${r.channel}`
    const entry = impacts.get(key) ?? {
      period: r.period ?? '',
      channel: r.channel,
      beforeCents: 0,
      afterCents: 0,
    }
    entry[side] += r.revenueCents ?? 0
    impacts.set(key, entry)
  }
  add(record, 'beforeCents')
  add(after, 'afterCents')
  const within = (r: GLRecord) =>
    r.postingDate &&
    r.postingDate >= period.start &&
    r.postingDate <= period.end
      ? (r.revenueCents ?? 0)
      : 0
  const delta = Number(BigInt(within(after)) - BigInt(within(record)))
  if (!Number.isSafeInteger(delta))
    throw new Error('Ảnh hưởng vượt phạm vi cent chính xác.')
  return {
    complete: false,
    recordId: record.id,
    before: record,
    after,
    totalGLDeltaCents: delta,
    unexplainedDeltaCents: delta,
    impacts: [...impacts.values()],
    reason: reason.trim(),
    patch: {
      ...patch,
      ...(patch.postingDate !== undefined ? { period: after.period! } : {}),
    },
  }
}

/** Exact GL-only bridge delta: reallocations can also create/remove a missing-GL group. */
export function completeCorrectionPreview(
  preview: GLCorrectionPreview,
  snapshot: GLReviewSnapshot,
  period: { start: string; end: string },
): GLCorrectionPreview {
  if (!snapshot.complete || !snapshot.expectedDaily) return preview
  const group = (store: string, date: string) => JSON.stringify([store, date])
  const before = new Set(
    snapshot.records
      .filter((r) => r.postingDate)
      .map((r) => group(r.storeKey, r.postingDate!)),
  )
  const after = new Set(
    snapshot.records
      .map((r) => (r.id === preview.recordId ? preview.after : r))
      .filter((r) => r.postingDate)
      .map((r) => group(r.storeKey, r.postingDate!)),
  )
  let missingDelta = 0n
  for (const expected of snapshot.expectedDaily) {
    if (
      expected.postingDate < period.start ||
      expected.postingDate > period.end
    )
      continue
    const key = group(expected.storeKey, expected.postingDate)
    const oldMissing = before.has(key) ? 0 : -expected.revenueCents
    const newMissing = after.has(key) ? 0 : -expected.revenueCents
    missingDelta += BigInt(newMissing) - BigInt(oldMissing)
  }
  const delta = Number(BigInt(preview.totalGLDeltaCents) - missingDelta)
  if (!Number.isSafeInteger(delta))
    throw new Error('Ảnh hưởng vượt phạm vi cent chính xác.')
  return { ...preview, complete: true, unexplainedDeltaCents: delta }
}

export function linkReviewExceptions(
  exceptions: ReconciliationException[],
  snapshot: GLReviewSnapshot,
  cases: readonly GLReviewCase[],
): ReconciliationException[] {
  const linked = new Map<string, Set<string>>()
  for (const reviewCase of cases)
    for (const record of snapshot.records) {
      if (!reviewCase.recordIds.includes(record.id)) continue
      const key = JSON.stringify([record.storeKey, record.postingDate])
      const ids = linked.get(key) ?? new Set<string>()
      ids.add(reviewCase.id)
      linked.set(key, ids)
    }
  return exceptions.map((row) =>
    row.type === 'Duplicate POS'
      ? row
      : {
          ...row,
          reviewCaseIds: [
            ...(linked.get(JSON.stringify([row.storeKey, row.date])) ?? []),
          ],
        },
  )
}
