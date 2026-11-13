import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  ArrowRight,
  ClipboardCheck,
  FileSearch,
  History,
  Search,
  ShieldCheck,
  Undo2,
  X,
  SlidersHorizontal,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { ReconciliationRunStatus } from '@/components/ReconciliationRunStatus'
import { useAppStore } from '@/lib/store'
import { ReferenceAccountingSummary } from '@/components/excel-reference/ReferenceViews'
import { formatUSD } from '@/lib/format-money'
import type {
  GLRecord,
  GLPatch,
  GLReviewSnapshot,
  GLClassification,
  GLCaseStatus,
} from '@/lib/gl-review'
import type { GLReviewCase } from '@/lib/accounting-review'
import { transferIssue } from '@/lib/accounting-review'
import { REVIEW_LAYOUT } from '@/lib/review-layout'
import '@/accounting-review.css'

const classificationLabels: Record<GLClassification, string> = {
  shipping: 'Phí vận chuyển',
  channel_transfer: 'Chuyển kênh',
  unexplained: 'Chưa giải thích',
  other: 'Nghiệp vụ khác',
}
const reviewStatusLabels: Record<GLCaseStatus, string> = {
  open: 'Chờ xác minh',
  in_progress: 'Đang xử lý',
  reviewed: 'Đã xem · chưa giải quyết',
  confirmed: 'Đã xác nhận',
}
const money = (cents: number | null | undefined) =>
  cents == null ? 'Không đọc được' : formatUSD(cents)
const displayChannel = (record: GLRecord) =>
  record.channel === 'UNALLOCATED' || record.storeKey === '-1'
    ? 'Chưa phân bổ'
    : record.channel || 'Chưa rõ kênh'

export function GLDiagnosticsView({
  snapshot,
  expanded = false,
}: {
  snapshot: GLReviewSnapshot
  expanded?: boolean
}) {
  return (
    <details className="accounting-diagnostics" open={expanded || undefined}>
      <summary>
        Chẩn đoán GL · {snapshot.diagnostics.length} lỗi kiểm tra ·{' '}
        {snapshot.records.length.toLocaleString('vi-VN')} dòng nguồn
      </summary>
      <p className="mt-2 text-xs leading-6 text-muted-foreground">
        {snapshot.complete
          ? 'Các dòng GL có thể tính toán. Khoản chưa phân bổ được giữ trong tổng GL, với khóa kỹ thuật -1.'
          : 'Đang chặn kết quả GL, cầu nối và chênh lệch phụ thuộc. Sửa cấu hình nguồn hoặc đề xuất điều chỉnh có lý do rồi chạy lại.'}
      </p>
      {snapshot.diagnostics.length > 0 && (
        <div className="diagnostics-scroll">
          <table className="accounting-table">
            <thead>
              <tr>
                <th>Mã lỗi / Bút toán</th>
                <th>Trường / giá trị</th>
                <th>Dòng nguồn</th>
                <th>Nguyên nhân</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.diagnostics.map((item) => (
                <tr key={item.id}>
                  <td>
                    {item.code}
                    <small>{item.journalId || 'Thiếu ID'}</small>
                  </td>
                  <td>
                    {item.field}
                    <small>{item.value ?? '(trống)'}</small>
                  </td>
                  <td>
                    {item.fileName}
                    <small>
                      {item.sheetName} ·{' '}
                      {item.sourceRow === null
                        ? 'Chưa xác định dòng vật lý'
                        : `dòng ${item.sourceRow}`}
                    </small>
                  </td>
                  <td className="max-w-96 whitespace-normal">
                    {item.reason}
                    <small>
                      {item.blocking
                        ? 'Chặn đầu ra phụ thuộc'
                        : 'Cần rà soát nghiệp vụ'}
                    </small>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Button asChild variant="outline" size="sm" className="mt-2">
        <Link to="/accounting-review">
          <FileSearch className="size-3.5" />
          Rà soát kế toán
        </Link>
      </Button>
    </details>
  )
}

export function AccountingExceptionCases() {
  const { reviewCases, glReview } = useAppStore()
  if (!reviewCases.length) return null
  const open = reviewCases.filter(
    (item) => item.status !== 'confirmed' || item.stale,
  )
  return (
    <section
      className="accounting-exception-cases"
      aria-label="Ngoại lệ kế toán dùng chung"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2>
          <ClipboardCheck className="mr-2 inline size-4 text-primary" />
          {reviewCases.length} hồ sơ rà soát · {open.length} hồ sơ còn mở
        </h2>
        <Link
          className="text-xs font-medium"
          to="/accounting-review?from=exceptions"
        >
          Mở hàng chờ <ArrowRight className="inline size-3" />
        </Link>
      </div>
      <details className="mt-2 text-xs leading-5 text-muted-foreground">
        <summary className="cursor-pointer">
          Phạm vi hồ sơ & cách đọc số tiền
        </summary>
        <p className="mt-1">
          Dùng chung dữ liệu với Rà soát kế toán. Một hồ sơ có thể liên quan
          nhiều bút toán. Các kiểm soát chứng từ không lọc theo ngưỡng tiền; giá
          trị hồ sơ không cộng thêm vào tổng rủi ro đối soát.
        </p>
      </details>
      <div className="case-list">
        {reviewCases.map((item) => {
          const related =
            glReview?.records.filter((r) => item.recordIds.includes(r.id)) || []
          const periods = [
            ...new Set(related.map((r) => r.period).filter(Boolean)),
          ]
          const complete =
            related.length === item.recordIds.length &&
            related.every((r) => r.revenueCents !== null)
          return (
            <Link
              className="case-link"
              key={item.id}
              to={`/accounting-review?case=${encodeURIComponent(item.id)}&from=exceptions`}
            >
              <span>
                <strong>{classificationLabels[item.classification]}</strong>
                <p
                  className="case-identifiers mt-1"
                  title={related.map((r) => r.journalId).join(', ')}
                >
                  {item.recordIds
                    .map(
                      (id) =>
                        glReview?.records.find((r) => r.id === id)?.journalId ||
                        id,
                    )
                    .join(', ')}
                </p>
                <span className="case-meta">
                  <span>Kỳ: {periods.join(', ') || 'Chưa rõ'}</span>
                  <span className="financial-value">
                    Doanh thu:{' '}
                    {complete
                      ? money(
                          related.reduce(
                            (sum, r) => sum + (r.revenueCents || 0),
                            0,
                          ),
                        )
                      : 'Nguồn cần kiểm tra'}
                  </span>
                  <span>Phụ trách: {item.owner || 'Chưa giao'}</span>
                  {item.dueDate && <span>Hạn: {item.dueDate}</span>}
                </span>
                <p className="case-step">
                  Bước tiếp: {item.nextStep || 'Bổ sung căn cứ và quyết định'}
                </p>
              </span>
              <span className={`accounting-pill is-${item.status}`}>
                {item.stale
                  ? 'Nguồn thay đổi · cần rà soát'
                  : reviewStatusLabels[item.status]}
              </span>
            </Link>
          )
        })}
      </div>
    </section>
  )
}

function TransformationHistory({
  snapshot,
  selectedId,
}: {
  snapshot: GLReviewSnapshot
  selectedId?: string
}) {
  const grouped = new Map<
    string,
    { count: number; impact: number; fields: Set<string> }
  >()
  for (const item of snapshot.transformations) {
    const group = grouped.get(item.rule) || {
      count: 0,
      impact: 0,
      fields: new Set<string>(),
    }
    group.count++
    group.impact += item.impactCents
    group.fields.add(`${item.sourceField} → ${item.outputField}`)
    grouped.set(item.rule, group)
  }
  const details = snapshot.transformations.filter(
    (item) => item.recordId === selectedId,
  )
  return (
    <details className="accounting-diagnostics">
      <summary>Lịch sử tự chuẩn hóa · {grouped.size} quy tắc</summary>
      <p className="mt-2 text-xs leading-6 text-muted-foreground">
        Với đầu vào sổ cái: doanh thu = −số tiền GL gốc. Đầu vào doanh thu giữ
        dấu và lưu riêng số tiền GL gốc tương ứng. Đây là thay đổi cách biểu
        diễn, không phải sửa sổ cái. Tổng ảnh hưởng dưới đây là chênh lệch giữa
        giá trị nguồn và giá trị biểu diễn theo từng quy tắc.
      </p>
      <div className="diagnostics-scroll">
        <table className="accounting-table">
          <thead>
            <tr>
              <th>Quy tắc</th>
              <th>Số dòng</th>
              <th>Field nguồn → đầu ra</th>
              <th>Ảnh hưởng biểu diễn USD</th>
            </tr>
          </thead>
          <tbody>
            {[...grouped].map(([rule, group]) => (
              <tr key={rule}>
                <td>{rule}</td>
                <td>{group.count.toLocaleString('vi-VN')}</td>
                <td>{[...group.fields].join(', ')}</td>
                <td>{money(group.impact)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs font-medium">
        Chi tiết bút toán đang chọn · {details.length} thay đổi
      </p>
      <div className="diagnostics-scroll">
        <table className="accounting-table">
          <thead>
            <tr>
              <th>Quy tắc / field</th>
              <th>Trước</th>
              <th>Sau</th>
            </tr>
          </thead>
          <tbody>
            {details.map((item) => (
              <tr key={item.id}>
                <td>
                  {item.rule}
                  <small>
                    {item.sourceField} → {item.outputField}
                  </small>
                </td>
                <td>{item.before ?? '(trống)'}</td>
                <td>{item.after ?? '(trống)'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Chọn bút toán khác để xem dấu vết tương ứng. Những dòng cần kiểm tra nằm
        trong chẩn đoán GL và hàng chờ.
      </p>
    </details>
  )
}

function CaseInspector({
  reviewCase,
  records,
  onDirtyChange,
}: {
  reviewCase: GLReviewCase
  records: GLRecord[]
  onDirtyChange: (dirty: boolean) => void
}) {
  const store = useAppStore()
  const [draft, setDraft] = useState(reviewCase)
  const [previousCase, setPreviousCase] = useState(reviewCase)
  const [message, setMessage] = useState('')
  const [savedDraft, setSavedDraft] = useState(JSON.stringify(reviewCase))
  // Refresh shared changes without replacing inputs or discarding local edits.
  if (previousCase !== reviewCase) {
    const editable = [
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
    setDraft({
      ...reviewCase,
      ...Object.fromEntries(
        editable
          .filter((field) => draft[field] !== previousCase[field])
          .map((field) => [field, draft[field]]),
      ),
    })
    setPreviousCase(reviewCase)
    setSavedDraft(JSON.stringify(reviewCase))
  }
  useEffect(() => {
    onDirtyChange(JSON.stringify(draft) !== savedDraft)
  }, [draft, savedDraft, onDirtyChange])
  const set = <K extends keyof GLReviewCase>(
    field: K,
    value: GLReviewCase[K],
  ) =>
    setDraft((old) => ({
      ...old,
      [field]: value,
      ...(field === 'evidence' ? { evidenceReviewed: false } : {}),
      ...(old.status === 'confirmed' &&
      ['classification', 'purpose', 'evidence', 'decision'].includes(field)
        ? { status: 'in_progress' as const }
        : {}),
    }))
  const save = () => {
    try {
      store.updateReviewCase(reviewCase.id, {
        classification: draft.classification,
        status: draft.status,
        purpose: draft.purpose,
        notes: draft.notes,
        evidence: draft.evidence,
        evidenceReviewed: draft.evidenceReviewed,
        decision: draft.decision,
        owner: draft.owner,
        dueDate: draft.dueDate,
        nextStep: draft.nextStep,
      })
      setSavedDraft(JSON.stringify(draft))
      setMessage('Đã lưu quyết định trong phiên. Nhật ký ngoại lệ đã cập nhật.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    }
  }
  const channelTotals = records.reduce<Record<string, number>>(
    (totals, record) => ({
      ...totals,
      [record.channel || 'UNALLOCATED']:
        (totals[record.channel || 'UNALLOCATED'] || 0) +
        (record.revenueCents || 0),
    }),
    {},
  )
  const total = records.reduce((sum, r) => sum + (r.revenueCents || 0), 0)
  const transferProblem = transferIssue(records)
  return (
    <form
      id={`review-case-${reviewCase.id}`}
      onSubmit={(event) => {
        event.preventDefault()
        save()
      }}
    >
      {reviewCase.stale && (
        <p className="accounting-notice is-warning mt-2">
          Nguồn hoặc cấu hình đã đổi. Rà soát lại bằng chứng và quyết định trước
          khi xác nhận.
        </p>
      )}
      <h3>Căn cứ gợi ý</h3>
      <ul>
        {reviewCase.suggestionReasons.map((reason) => (
          <li key={reason}>{reason}</li>
        ))}
      </ul>
      {draft.classification === 'channel_transfer' && (
        <div className="accounting-notice mt-3">
          <p className="font-medium">Kiểm tra hai vế chuyển kênh</p>
          {Object.entries(channelTotals).map(([channel, amount]) => (
            <p key={channel}>
              {channel}: {money(amount)}
            </p>
          ))}
          <p>
            Tổng công ty: {money(total)} · {records.length} bút toán độc lập.
          </p>
          <p>
            {transferProblem ||
              'Đủ hai bút toán, hai kênh cùng kỳ và tổng bằng 0. Vẫn cần người dùng xác minh chứng từ.'}
          </p>
        </div>
      )}
      <div className="accounting-form">
        <label>
          Phân loại nghiệp vụ
          <select
            value={draft.classification}
            onChange={(e) =>
              set('classification', e.target.value as GLClassification)
            }
          >
            {Object.entries(classificationLabels).map(([key, label]) => (
              <option value={key} key={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Mục đích bút toán
          <textarea
            value={draft.purpose}
            onChange={(e) => set('purpose', e.target.value)}
            placeholder="Nội dung nghiệp vụ đã kiểm tra"
          />
        </label>
        <label>
          Bằng chứng / tài liệu được cung cấp
          <textarea
            value={draft.evidence}
            onChange={(e) => set('evidence', e.target.value)}
            placeholder="Tên chứng từ, đường dẫn hoặc nội dung bằng chứng trong phiên"
          />
        </label>
        <p className="text-muted-foreground">
          Có mã tham chiếu: {records.some((r) => r.sourceRef) ? 'Có' : 'Không'}{' '}
          · Bằng chứng được cung cấp: {draft.evidence.trim() ? 'Có' : 'Chưa có'}
        </p>
        <label className="check">
          <input
            type="checkbox"
            checked={draft.evidenceReviewed}
            onChange={(e) => set('evidenceReviewed', e.target.checked)}
          />
          Tôi đã rà soát bằng chứng được cung cấp
        </label>
        <label>
          Nội dung quyết định / nguyên nhân xác nhận
          <textarea
            value={draft.decision}
            onChange={(e) => set('decision', e.target.value)}
            placeholder="Quyết định thực tế, căn cứ và phạm vi xác nhận"
          />
        </label>
        <label>
          Ghi chú
          <textarea
            value={draft.notes}
            onChange={(e) => set('notes', e.target.value)}
          />
        </label>
        <div className="row">
          <label>
            Người / nhóm phụ trách
            <input
              value={draft.owner}
              onChange={(e) => set('owner', e.target.value)}
              placeholder="Finance"
            />
          </label>
          <label>
            Hạn xử lý
            <input
              type="date"
              value={draft.dueDate}
              onChange={(e) => set('dueDate', e.target.value)}
            />
          </label>
        </div>
        <label>
          Bước tiếp theo
          <input
            value={draft.nextStep}
            onChange={(e) => set('nextStep', e.target.value)}
          />
        </label>
        <label>
          Trạng thái
          <select
            value={draft.status}
            onChange={(e) => set('status', e.target.value as GLCaseStatus)}
          >
            {Object.entries(reviewStatusLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <p className="text-muted-foreground">
          “Đã xem” vẫn là ngoại lệ mở. Xác nhận yêu cầu mục đích, bằng chứng đã
          rà soát và nội dung quyết định.
        </p>
        {message && (
          <p role="status" className="accounting-notice">
            {message}
          </p>
        )}
      </div>
    </form>
  )
}

function CorrectionForm({
  record,
  onDirtyChange,
  onPreviewChange,
}: {
  record: GLRecord
  onDirtyChange: (dirty: boolean) => void
  onPreviewChange: (kind: 'apply' | 'undo' | null) => void
}) {
  const store = useAppStore()
  const [amount, setAmount] = useState(
    record.amountCents == null ? '' : (record.amountCents / 100).toFixed(2),
  )
  const [date, setDate] = useState(record.postingDate || '')
  const [period, setPeriod] = useState(record.period || '')
  const [channel, setChannel] = useState(record.channel || 'UNALLOCATED')
  const [storeKey, setStoreKey] = useState(record.storeKey || '-1')
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<ReturnType<
    typeof store.previewGLCorrection
  > | null>(null)
  const [previewKind, setPreviewKind] = useState<'apply' | 'undo'>('apply')
  useEffect(() => {
    onPreviewChange(preview ? previewKind : null)
  }, [preview, previewKind, onPreviewChange])
  useEffect(() => {
    onDirtyChange(
      amount !==
        (record.amountCents == null
          ? ''
          : (record.amountCents / 100).toFixed(2)) ||
        date !== (record.postingDate || '') ||
        period !== (record.period || '') ||
        channel !== (record.channel || 'UNALLOCATED') ||
        storeKey !== (record.storeKey || '-1') ||
        !!reason.trim(),
    )
  }, [amount, date, period, channel, storeKey, reason, record, onDirtyChange])
  const active = store.glCorrections.some(
    (item) => item.recordId === record.id && item.active,
  )
  const prepare = () => {
    try {
      const patch: GLPatch = {}
      if (
        amount !==
        (record.amountCents == null
          ? ''
          : (record.amountCents / 100).toFixed(2))
      ) {
        if (!/^[+-]?\d+(\.\d{1,2})?$/.test(amount.trim()))
          throw new Error(
            'Nhập số tiền GL gốc (USD) bằng số, tối đa 2 chữ số thập phân.',
          )
        const cents = Math.round(Number(amount) * 100)
        if (!Number.isSafeInteger(cents))
          throw new Error('Số tiền vượt phạm vi hỗ trợ.')
        patch.amountCents = cents
      }
      if (date !== (record.postingDate || '')) patch.postingDate = date
      if (period !== (record.period || '')) patch.period = period
      if (storeKey !== (record.storeKey || '-1')) patch.storeKey = storeKey
      if (channel !== (record.channel || 'UNALLOCATED')) patch.channel = channel
      if (!Object.keys(patch).length)
        throw new Error('Chưa có thay đổi để xem trước.')
      setPreview(store.previewGLCorrection(record.id, patch, reason))
      setPreviewKind('apply')
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setPreview(null)
    }
  }
  const applyPreview = () => {
    if (!preview || store.isProcessing) return
    try {
      if (previewKind === 'undo')
        store.undoGLCorrection(record.id, preview.reason)
      else store.applyGLCorrection(record.id, preview.patch, preview.reason)
      setPreview(null)
      setError('')
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : String(issue))
    }
  }
  return (
    <div className="correction-section">
      <h3>Đề xuất điều chỉnh dữ liệu hiệu lực</h3>
      <p className="mt-2 text-muted-foreground">
        Chỉ áp dụng cho phiên đối soát trong tab này. Dữ liệu gốc được giữ
        nguyên. Thao tác này không sửa sổ cái ERP.
      </p>
      <form
        id="gl-correction-form"
        className="accounting-form"
        onChange={() => setPreview(null)}
        onSubmit={(event) => {
          event.preventDefault()
          if (
            (event.nativeEvent as SubmitEvent).submitter?.getAttribute(
              'value',
            ) === 'commit'
          )
            applyPreview()
          else prepare()
        }}
      >
        <label>
          Số tiền GL gốc (USD) · dấu sổ cái
          <input
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </label>
        <div className="row">
          <label>
            Ngày ghi sổ
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <label>
            Kỳ
            <input
              type="month"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
            />
          </label>
        </div>
        <div className="row">
          <label>
            Kênh
            <input
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              list="gl-review-channels"
            />
            <datalist id="gl-review-channels">
              <option value="STORE" />
              <option value="WEB" />
              <option value="UNALLOCATED" />
            </datalist>
          </label>
          <label>
            Khóa cửa hàng
            <input
              value={storeKey}
              onChange={(e) => setStoreKey(e.target.value)}
            />
          </label>
        </div>
        <label>
          Lý do và căn cứ (bắt buộc)
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
        {error && (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}
        {preview && (
          <div className="accounting-preview">
            <strong>
              {previewKind === 'undo' ? 'Hoàn tác về nguồn gốc' : 'Trước → Sau'}
            </strong>
            <table>
              <tbody>
                <tr>
                  <td>Số tiền GL gốc</td>
                  <td>
                    {money(preview.before.amountCents)} →{' '}
                    {money(preview.after.amountCents)}
                  </td>
                </tr>
                <tr>
                  <td>Doanh thu</td>
                  <td>
                    {money(preview.before.revenueCents)} →{' '}
                    {money(preview.after.revenueCents)}
                  </td>
                </tr>
                <tr>
                  <td>Ngày / kỳ</td>
                  <td>
                    {preview.before.postingDate} / {preview.before.period} →{' '}
                    {preview.after.postingDate} / {preview.after.period}
                  </td>
                </tr>
                <tr>
                  <td>Phân bổ</td>
                  <td>
                    {preview.before.channel} / {preview.before.storeKey} →{' '}
                    {preview.after.channel} / {preview.after.storeKey}
                  </td>
                </tr>
              </tbody>
            </table>
            <p>Δ Tổng GL: {money(preview.totalGLDeltaCents)}</p>
            <p>Δ Chưa giải thích: {money(preview.unexplainedDeltaCents)}</p>
            {!preview.complete && (
              <p className="font-medium text-warning">
                Ảnh hưởng tạm tính: nguồn chưa đủ để đối soát toàn bộ. Khôi phục
                dữ liệu gốc không hợp lệ sẽ chặn lại các đầu ra phụ thuộc.
              </p>
            )}
            <p>
              Chênh lệch nguồn − GL thay đổi ngược dấu doanh thu; các nhóm cửa
              hàng × ngày liên quan sẽ được tính lại.
            </p>
            <h3>Ảnh hưởng theo kỳ / kênh</h3>
            {preview.impacts.map((impact, index) => (
              <p key={index}>
                {impact.period} · {impact.channel}: {money(impact.beforeCents)}{' '}
                → {money(impact.afterCents)}
              </p>
            ))}
          </div>
        )}
        {active && (
          <Button
            variant="outline"
            size="sm"
            disabled={store.isProcessing}
            type="button"
            onClick={() => {
              try {
                setPreview(store.previewGLUndo(record.id, reason))
                setPreviewKind('undo')
                setError('')
              } catch (e) {
                setError(e instanceof Error ? e.message : String(e))
              }
            }}
          >
            <Undo2 className="size-3.5" />
            Xem trước hoàn tác
          </Button>
        )}
      </form>
    </div>
  )
}

type InspectorTab = 'overview' | 'evidence' | 'correction' | 'history'
const inspectorTabs: { id: InspectorTab; label: string }[] = [
  { id: 'overview', label: 'Tổng quan' },
  { id: 'evidence', label: 'Bằng chứng & xử lý' },
  { id: 'correction', label: 'Điều chỉnh' },
  { id: 'history', label: 'Lịch sử & nguồn' },
]

function RecordInspector({
  record,
  reviewCase,
  records,
  snapshot,
  onDirtyChange,
  onClose,
  drawer,
  tab,
  onTabChange,
}: {
  record?: GLRecord
  reviewCase?: GLReviewCase
  records: GLRecord[]
  snapshot: GLReviewSnapshot
  onDirtyChange: (dirty: boolean) => void
  onClose: () => void
  drawer: boolean
  tab: InspectorTab
  onTabChange: (tab: InspectorTab) => void
}) {
  const store = useAppStore()
  const [caseDirty, setCaseDirty] = useState(false)
  const [correctionDirty, setCorrectionDirty] = useState(false)
  const [previewAction, setPreviewAction] = useState<'apply' | 'undo' | null>(
    null,
  )
  const [message, setMessage] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(
    () => onDirtyChange(caseDirty || correctionDirty),
    [caseDirty, correctionDirty, onDirtyChange],
  )
  const activateTab = (value: InspectorTab) => {
    onTabChange(value)
    if (scrollRef.current) scrollRef.current.scrollTop = 0
  }
  const related = reviewCase
    ? records.filter((r) => reviewCase.recordIds.includes(r.id))
    : record
      ? [record]
      : []
  const title =
    record?.journalId ||
    (reviewCase ? 'Hồ sơ cần rà soát lại' : 'Chi tiết bút toán')
  return (
    <>
      <header className="inspector-header">
        <div className="inspector-heading-line">
          <span className="inspector-eyebrow">
            {reviewCase ? 'Hồ sơ rà soát' : 'Bút toán hệ thống'}
          </span>
          {drawer && (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Đóng chi tiết"
              onClick={onClose}
            >
              <X className="size-4" />
            </Button>
          )}
        </div>
        <h2 id="review-inspector-title" title={title}>
          {title}
        </h2>
        <div className="inspector-summary">
          <span>
            {record?.journalType ||
              (reviewCase && classificationLabels[reviewCase.classification])}
          </span>
          <strong className="financial-value">
            {record ? money(record.revenueCents) : `${related.length} bút toán`}
          </strong>
          {record && <small>Doanh thu (USD)</small>}
        </div>
        <span
          className={`accounting-pill is-${reviewCase?.status || 'confirmed'}`}
        >
          {reviewCase?.stale
            ? 'Nguồn thay đổi · cần rà soát'
            : reviewCase
              ? reviewStatusLabels[reviewCase.status]
              : 'Hợp lệ'}
        </span>
      </header>
      <div
        className="inspector-tabs"
        role="tablist"
        aria-label="Nội dung chi tiết"
      >
        {inspectorTabs.map(({ id, label }) => (
          <button
            key={id}
            id={`inspector-tab-${id}`}
            role="tab"
            aria-selected={tab === id}
            aria-controls={`inspector-panel-${id}`}
            tabIndex={tab === id ? 0 : -1}
            onClick={() => activateTab(id)}
            onKeyDown={(event) => {
              const index = inspectorTabs.findIndex((item) => item.id === id)
              const next =
                event.key === 'ArrowRight'
                  ? (index + 1) % 4
                  : event.key === 'ArrowLeft'
                    ? (index + 3) % 4
                    : event.key === 'Home'
                      ? 0
                      : event.key === 'End'
                        ? 3
                        : -1
              if (next >= 0) {
                event.preventDefault()
                activateTab(inspectorTabs[next].id)
                document
                  .getElementById(`inspector-tab-${inspectorTabs[next].id}`)
                  ?.focus()
              }
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="inspector-body" ref={scrollRef}>
        <section
          id="inspector-panel-overview"
          role="tabpanel"
          aria-labelledby="inspector-tab-overview"
          hidden={tab !== 'overview'}
        >
          {reviewCase?.stale && (
            <p className="accounting-notice is-warning">
              Nguồn hoặc cấu hình đã đổi. Rà soát lại bằng chứng và quyết định
              trước khi xác nhận.
            </p>
          )}
          <h3>Thông tin bút toán</h3>
          {record ? (
            <dl className="inspector-facts">
              <div>
                <dt>Ngày / kỳ</dt>
                <dd>
                  {record.postingDate || 'Ngày chưa hợp lệ'} ·{' '}
                  {record.period || 'Chưa rõ kỳ'}
                </dd>
              </div>
              <div>
                <dt>Kênh / cửa hàng</dt>
                <dd>
                  {displayChannel(record)} ·{' '}
                  {record.storeCode || record.storeKey || 'Chưa có'}
                  {record.storeKey === '-1' && (
                    <small>Nhóm kỹ thuật, không phải cửa hàng thực tế.</small>
                  )}
                </dd>
              </div>
              <div>
                <dt>Doanh thu (USD)</dt>
                <dd className="financial-value">
                  {money(record.revenueCents)}
                </dd>
              </div>
              <div>
                <dt>Số tiền GL gốc (USD)</dt>
                <dd className="financial-value">
                  {money(record.amountCents)}
                  <small>Theo dấu sổ cái</small>
                </dd>
              </div>
              <div>
                <dt>Tham chiếu</dt>
                <dd>{record.sourceRef || 'Chưa cung cấp'}</dd>
              </div>
              <div>
                <dt>Diễn giải</dt>
                <dd>{record.description || 'Chưa có diễn giải'}</dd>
              </div>
            </dl>
          ) : (
            <p className="accounting-notice is-warning">
              Bút toán liên quan không còn trong phiên dữ liệu hiện tại. Lịch sử
              hồ sơ được giữ để truy vết.
            </p>
          )}
          {reviewCase ? (
            <>
              <h3>
                {classificationLabels[reviewCase.classification]} ·{' '}
                {related.length} bút toán liên quan
              </h3>
              <ul>
                {reviewCase.suggestionReasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
              <dl className="inspector-facts">
                <div>
                  <dt>Người phụ trách</dt>
                  <dd>{reviewCase.owner || 'Chưa giao'}</dd>
                </div>
                <div>
                  <dt>Bước tiếp theo</dt>
                  <dd>
                    {reviewCase.nextStep || 'Bổ sung bằng chứng và quyết định'}
                  </dd>
                </div>
              </dl>
              {related.length > 1 && (
                <ul className="related-journals">
                  {related.map((r) => (
                    <li key={r.id}>
                      <span>{r.journalId}</span>
                      <strong className="financial-value">
                        {money(r.revenueCents)}
                      </strong>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-3 text-muted-foreground">
                {reviewCase.evidenceReviewed && reviewCase.evidence.trim()
                  ? 'Đã rà soát bằng chứng'
                  : 'Chưa xác minh chứng từ'}
                . Hồ sơ có thể liên quan nhiều bút toán.
              </p>
            </>
          ) : (
            <p className="accounting-notice mt-3">
              Bút toán hệ thống hợp lệ. Không có yêu cầu rà soát nghiệp vụ
              riêng.
            </p>
          )}
        </section>
        <section
          id="inspector-panel-evidence"
          role="tabpanel"
          aria-labelledby="inspector-tab-evidence"
          hidden={tab !== 'evidence'}
        >
          {reviewCase ? (
            <CaseInspector
              key={reviewCase.id}
              reviewCase={reviewCase}
              records={related}
              onDirtyChange={setCaseDirty}
            />
          ) : (
            <p>Bút toán này không có hồ sơ rà soát riêng.</p>
          )}
        </section>
        <section
          id="inspector-panel-correction"
          role="tabpanel"
          aria-labelledby="inspector-tab-correction"
          hidden={tab !== 'correction'}
        >
          {record ? (
            <CorrectionForm
              key={`${record.id}:${record.sourceFingerprint}:${record.amountCents}:${record.postingDate}:${record.storeKey}:${record.channel}`}
              record={record}
              onDirtyChange={setCorrectionDirty}
              onPreviewChange={setPreviewAction}
            />
          ) : (
            <p>Chọn bút toán trong nguồn hiện tại để đề xuất điều chỉnh.</p>
          )}
        </section>
        <section
          id="inspector-panel-history"
          role="tabpanel"
          aria-labelledby="inspector-tab-history"
          hidden={tab !== 'history'}
        >
          {reviewCase && (
            <>
              <h3>Lịch sử hồ sơ ({reviewCase.history.length})</h3>
              <ul className="accounting-history">
                {reviewCase.history.map((entry, index) => (
                  <li key={`${entry.at}:${index}`}>
                    <time>{entry.at}</time>
                    <strong>{entry.action}</strong>
                    <p>{entry.detail}</p>
                  </li>
                ))}
              </ul>
              <p className="technical-value mt-3 text-muted-foreground">
                Mã hồ sơ: {reviewCase.id}
              </p>
            </>
          )}
          {record && (
            <>
              <h3>Dữ liệu gốc & truy vết</h3>
              <p>
                {record.fileName} · {record.sheetName} ·{' '}
                {record.sourceRow === null
                  ? `Chưa xác định dòng vật lý · bản ghi ${record.sourceRecord ?? '?'}`
                  : `dòng ${record.sourceRow}`}
              </p>
              <p className="mt-2">
                Giá trị đầu vào: {record.raw.amount ?? '(trống)'} · Cơ sở:{' '}
                {record.amountBasis === 'ledger'
                  ? 'dấu sổ cái'
                  : 'doanh thu đã chuẩn hóa'}
                . Mỗi bút toán chỉ được tính một lần.
              </p>
              <pre>
                {JSON.stringify(record.sourceValues ?? record.raw, null, 2)}
              </pre>
              <p className="technical-value mt-2 text-muted-foreground">
                Dấu vân tay nguồn: {record.sourceFingerprint}
                <br />
                Cấu hình: {record.configurationVersion}
                <br />
                Phiên dữ liệu: {snapshot.runId}
              </p>
              <TransformationHistory
                snapshot={snapshot}
                selectedId={record.id}
              />
            </>
          )}
        </section>
      </div>
      <footer className="inspector-footer">
        {(caseDirty || correctionDirty) && (
          <p className="draft-indicator" role="status">
            Có thay đổi chưa lưu
            {caseDirty && correctionDirty ? ' ở phần xử lý và điều chỉnh' : ''}
          </p>
        )}
        {tab === 'evidence' && reviewCase ? (
          <>
            <Button
              type="submit"
              form={`review-case-${reviewCase.id}`}
              size="sm"
              disabled={store.isProcessing}
            >
              <ShieldCheck className="size-3.5" />
              Lưu rà soát
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={store.isProcessing}
              onClick={() => {
                const created = store.requestReviewEvidence([reviewCase.id])
                setMessage(
                  created
                    ? 'Đã tạo yêu cầu chứng từ trong phiên, không gửi email.'
                    : 'Hồ sơ đã có yêu cầu chứng từ đang chờ xử lý trong phiên.',
                )
              }}
            >
              Yêu cầu chứng từ
            </Button>
          </>
        ) : tab === 'correction' && record ? (
          <>
            {previewAction && (
              <Button
                type="submit"
                form="gl-correction-form"
                name="correction-action"
                value="commit"
                size="sm"
                disabled={store.isProcessing}
              >
                {previewAction === 'undo'
                  ? 'Hoàn tác & tính lại'
                  : 'Áp dụng & tính lại'}
              </Button>
            )}
            <Button
              type="submit"
              form="gl-correction-form"
              variant={previewAction ? 'outline' : 'default'}
              size="sm"
              disabled={store.isProcessing}
            >
              Xem trước ảnh hưởng
            </Button>
          </>
        ) : reviewCase ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => activateTab('evidence')}
          >
            Mở bằng chứng & xử lý
          </Button>
        ) : (
          <span className="text-muted-foreground">
            Dữ liệu chỉ lưu trong tab hiện tại.
          </span>
        )}
        {message && <p role="status">{message}</p>}
      </footer>
    </>
  )
}

export function AccountingReview() {
  const store = useAppStore()
  const result = store.activeResult
  return result.source === 'excel' ? (
    <ReferenceAccountingSummary
      workbook={result.workbook}
      period={result.period}
      setPeriod={store.setExcelReferencePeriod}
    />
  ) : (
    <RawAccountingReview />
  )
}

function RawAccountingReview() {
  const store = useAppStore()
  const [params] = useSearchParams()
  const [query, setQuery] = useState('')
  const [type, setType] = useState('all')
  const [period, setPeriod] = useState('all')
  const [status, setStatus] = useState('all')
  const [classification, setClassification] = useState('all')
  const [scope, setScope] = useState('review')
  const [page, setPage] = useState(0)
  const [selectedId, setSelectedId] = useState<string | null>(
    params.get('record'),
  )
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('overview')
  const [checked, setChecked] = useState<string[]>([])
  const [bulkMessage, setBulkMessage] = useState('')
  const [moreFilters, setMoreFilters] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(
    !!params.get('case') || !!params.get('record'),
  )
  const [wide, setWide] = useState(false)
  const [inspectorVersion, setInspectorVersion] = useState(0)
  const panelsRef = useRef<HTMLDivElement>(null)
  const inspectorRef = useRef<HTMLElement>(null)
  const dirtyRef = useRef(false)
  const triggerRef = useRef<HTMLElement | null>(null)
  const onDirtyChange = useCallback((dirty: boolean) => {
    dirtyRef.current = dirty
  }, [])
  const discardChanges = () =>
    !dirtyRef.current ||
    window.confirm(
      'Có thay đổi chưa lưu trong hồ sơ hoặc điều chỉnh. Bỏ thay đổi để tiếp tục?',
    )
  const closeInspector = () => {
    if (!discardChanges()) return
    if (dirtyRef.current) {
      setInspectorVersion((v) => v + 1)
      dirtyRef.current = false
    }
    setDrawerOpen(false)
    triggerRef.current?.focus()
  }
  const snapshot = store.glReview
  const hasSnapshot = !!snapshot
  const records = snapshot?.records || []
  useEffect(() => {
    const container = panelsRef.current
    if (!container) return
    const resize = () =>
      setWide(
        container.getBoundingClientRect().width >= REVIEW_LAYOUT.sideBySideMin,
      )
    resize()
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', resize)
      return () => window.removeEventListener('resize', resize)
    }
    const observer = new ResizeObserver(resize)
    observer.observe(container)
    return () => observer.disconnect()
  }, [hasSnapshot])
  useEffect(() => {
    const unload = (event: BeforeUnloadEvent) => {
      if (dirtyRef.current) {
        event.preventDefault()
        event.returnValue = ''
      }
    }
    const navigate = (event: MouseEvent) => {
      if (
        !(event.target instanceof Element) ||
        !event.target.closest('a[href]') ||
        event.defaultPrevented ||
        !dirtyRef.current
      )
        return
      if (
        !window.confirm('Có thay đổi chưa lưu. Bỏ thay đổi để chuyển trang?')
      ) {
        event.preventDefault()
        event.stopPropagation()
      }
    }
    const reference = (event: Event) => {
      if (
        dirtyRef.current &&
        !window.confirm(
          'Có thay đổi chưa lưu trong hồ sơ hoặc điều chỉnh. Bỏ thay đổi để tiếp tục?',
        )
      )
        event.preventDefault()
    }
    window.addEventListener('beforeunload', unload)
    window.addEventListener('reconcile:before-reference', reference)
    document.addEventListener('click', navigate, true)
    return () => {
      window.removeEventListener('beforeunload', unload)
      window.removeEventListener('reconcile:before-reference', reference)
      document.removeEventListener('click', navigate, true)
    }
  }, [])
  useEffect(() => {
    if (!drawerOpen || wide) return
    const previous = document.activeElement as HTMLElement | null
    const oldOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    inspectorRef.current
      ?.querySelector<HTMLButtonElement>('[aria-label="Đóng chi tiết"]')
      ?.focus()
    return () => {
      document.body.style.overflow = oldOverflow
      if (previous?.isConnected) previous.focus()
    }
  }, [drawerOpen, wide])
  const caseFor = (id: string) =>
    store.reviewCases.find((item) => item.recordIds.includes(id))
  const requested = store.reviewCases.find(
    (item) => item.id === params.get('case'),
  )
  const requestedKey = `${params.get('case') ?? ''}|${params.get('record') ?? ''}`
  const [lastRequested, setLastRequested] = useState(requestedKey)
  if (lastRequested !== requestedKey) {
    setLastRequested(requestedKey)
    setSelectedId(params.get('record'))
    setInspectorTab('overview')
    setDrawerOpen(!!params.get('case') || !!params.get('record'))
  }
  const requestedMissing =
    requested &&
    !requested.recordIds.some((id) => records.some((r) => r.id === id))
  const selected =
    requestedMissing && !selectedId
      ? undefined
      : records.find((r) => r.id === selectedId) ||
        records.find((r) => requested?.recordIds.includes(r.id)) ||
        records.find((r) => caseFor(r.id)) ||
        records[0]
  const selectedCase = selected
    ? caseFor(selected.id)
    : requestedMissing
      ? requested
      : undefined
  const filtered = records.filter((record) => {
    const item = caseFor(record.id)
    const text = [
      record.journalId,
      record.description,
      record.sourceRef,
      record.storeKey,
      record.storeCode,
      record.channel,
    ]
      .join(' ')
      .toLocaleLowerCase('vi')
    return (
      (scope === 'all' || !!item) &&
      (!query || text.includes(query.toLocaleLowerCase('vi'))) &&
      (type === 'all' || record.journalType === type) &&
      (period === 'all' || record.period === period) &&
      (status === 'all' ||
        (status === 'none' ? !item : item?.status === status)) &&
      (classification === 'all' || item?.classification === classification)
    )
  })
  const filterKey = [
    query,
    type,
    period,
    status,
    classification,
    scope,
    snapshot?.runId,
  ].join('|')
  const [lastFilterKey, setLastFilterKey] = useState(filterKey)
  if (lastFilterKey !== filterKey) {
    setLastFilterKey(filterKey)
    setPage(0)
    setChecked([])
    setBulkMessage('')
  }
  const lastPage = Math.max(0, Math.ceil(filtered.length / 100) - 1)
  const currentPage = Math.min(page, lastPage)
  const visible = filtered.slice(currentPage * 100, (currentPage + 1) * 100)
  const total = records
    .filter(
      (r) =>
        r.postingDate &&
        r.postingDate >= store.period.start &&
        r.postingDate <= store.period.end,
    )
    .reduce((sum, r) => sum + (r.revenueCents || 0), 0)
  const pending = store.reviewCases.filter(
    (item) => item.status !== 'confirmed' || item.stale,
  )
  const bulkCases = [
    ...new Set(
      checked.map((id) => caseFor(id)?.id).filter((id): id is string => !!id),
    ),
  ]
  const otherFilterCount = [type, period, classification].filter(
    (value) => value !== 'all',
  ).length
  const hasFilters =
    !!query || status !== 'all' || otherFilterCount > 0 || scope !== 'review'
  const selectRecord = (record: GLRecord, trigger: HTMLElement) => {
    if (record.id !== selected?.id && !discardChanges()) return
    triggerRef.current = trigger
    setSelectedId(record.id)
    setDrawerOpen(true)
    if (record.id !== selected?.id) dirtyRef.current = false
    if (record.id !== selected?.id) setInspectorTab('overview')
  }
  const clearFilters = () => {
    setQuery('')
    setType('all')
    setPeriod('all')
    setStatus('all')
    setClassification('all')
    setScope('review')
  }
  const returnTo = params.get('returnTo')
  const dashboardReturn = returnTo === '/' || returnTo?.startsWith('/?')
  const exceptionReturn = returnTo?.startsWith('/exceptions?')
    ? returnTo
    : dashboardReturn
      ? returnTo!
      : '/exceptions?tab=accounting'
  return (
    <section
      className="accounting-workspace viewport-workspace"
      aria-label="Rà soát kế toán"
    >
      <header className="workspace-page-heading accounting-page-heading">
        <div>
          <h1>Rà soát kế toán</h1>
          <p>Kiểm tra bút toán, bằng chứng và quyết định</p>
        </div>
        <div className="heading-actions">
          {snapshot && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setHistoryOpen(true)}
            >
              <History className="size-3.5" />
              <span className="history-action-label">Lịch sử chuẩn hóa</span>
            </Button>
          )}
          <Button asChild variant="outline" size="sm">
            <Link to={exceptionReturn}>
              {dashboardReturn
                ? 'Quay lại dashboard'
                : params.get('from') === 'exceptions'
                  ? 'Về nhật ký ngoại lệ'
                  : 'Nhật ký ngoại lệ'}
              <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        </div>
      </header>
      {!snapshot && <ReconciliationRunStatus />}
      {!snapshot ? (
        <div className="accounting-grid flex-1 items-start justify-center gap-3 p-6">
          <FileSearch className="size-8 text-primary" />
          <h2 className="text-lg font-semibold">
            Chưa có phiên dữ liệu GL để rà soát
          </h2>
          <p className="max-w-xl text-sm leading-6 text-muted-foreground">
            Nhập nguồn và chạy đối soát. Khi có lỗi GL, chẩn đoán và dòng nguồn
            vẫn được giữ để xử lý; tổng chưa đầy đủ sẽ không được công bố.
          </p>
          <Button onClick={() => store.openSourceOnboarding('GL')}>
            Mở cấu hình GL
          </Button>
        </div>
      ) : (
        <>
          <div
            className="accounting-summary"
            title={`Phiên dữ liệu: ${snapshot.runId} · Cấu hình: ${snapshot.configurationVersion}`}
          >
            <div className="summary-total">
              <small>Tổng GL trong kỳ · Doanh thu (USD)</small>
              <strong>
                {snapshot.complete && !store.isProcessing
                  ? money(total)
                  : 'Chưa công bố'}
              </strong>
            </div>
            <div>
              <small>Bút toán trong nguồn</small>
              <strong>{records.length.toLocaleString('vi-VN')}</strong>
            </div>
            <div>
              <small>Hồ sơ rà soát</small>
              <strong>
                {store.reviewCases.length.toLocaleString('vi-VN')}
              </strong>
            </div>
            <div>
              <small>Hồ sơ còn mở</small>
              <strong>{pending.length.toLocaleString('vi-VN')}</strong>
            </div>
            <span className="summary-period">
              {store.period.start} → {store.period.end}
            </span>
          </div>
          <ReconciliationRunStatus />
          {store.status !== 'error' &&
            (store.isProcessing ||
              !snapshot.complete ||
              store.status !== 'ready') && (
              <div
                role="status"
                className={`accounting-notice accounting-run-notice ${!snapshot.complete ? 'is-blocked' : ''}`}
              >
                <span>
                  {store.isProcessing
                    ? 'Đang tính lại GL và các đầu ra phụ thuộc.'
                    : !snapshot.complete
                      ? `GL có ${snapshot.diagnostics.filter((d) => d.blocking).length} lỗi chặn. Tổng phụ thuộc chưa được công bố.`
                      : 'Chưa có kết quả đối soát toàn bộ cho phiên đang xem.'}
                </span>
                <Button asChild variant="outline" size="sm">
                  <Link
                    to={
                      !snapshot.complete
                        ? `/processing?run=${encodeURIComponent(snapshot.runId)}&table=gl-diagnostics`
                        : '/processing'
                    }
                  >
                    {!snapshot.complete ? 'Xem dòng lỗi' : 'Mở tiến trình'}
                  </Link>
                </Button>
              </div>
            )}
          <div className="accounting-filters">
            <label className="review-search">
              <span>
                <Search className="inline size-3.5" /> Tìm bút toán / tham chiếu
              </span>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Mã, nội dung, cửa hàng…"
              />
            </label>
            <label>
              Góc nhìn
              <select value={scope} onChange={(e) => setScope(e.target.value)}>
                <option value="review">Hàng chờ rà soát</option>
                <option value="all">Toàn bộ GL</option>
              </select>
            </label>
            <label>
              Trạng thái
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="all">Tất cả trạng thái</option>
                {Object.entries(reviewStatusLabels).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
                <option value="none">Không cần rà soát</option>
              </select>
            </label>
            <Button
              variant="outline"
              size="sm"
              aria-expanded={moreFilters}
              aria-controls="accounting-more-filters"
              onClick={() => setMoreFilters(!moreFilters)}
            >
              <SlidersHorizontal className="size-3.5" />
              Bộ lọc khác{otherFilterCount > 0 && ` (${otherFilterCount})`}
            </Button>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Xóa bộ lọc
              </Button>
            )}
            <div
              id="accounting-more-filters"
              className="accounting-more-filters"
              hidden={!moreFilters}
            >
              <label>
                Loại bút toán
                <select value={type} onChange={(e) => setType(e.target.value)}>
                  <option value="all">Tất cả loại</option>
                  {[
                    ...new Set(
                      records.map((r) => r.journalType).filter(Boolean),
                    ),
                  ]
                    .sort()
                    .map((value) => (
                      <option key={value} value={value!}>
                        {value}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Kỳ nguồn
                <select
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                >
                  <option value="all">Tất cả kỳ</option>
                  {[...new Set(records.map((r) => r.period).filter(Boolean))]
                    .sort()
                    .map((value) => (
                      <option key={value} value={value!}>
                        {value}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Phân loại
                <select
                  value={classification}
                  onChange={(e) => setClassification(e.target.value)}
                >
                  <option value="all">Tất cả phân loại</option>
                  {Object.entries(classificationLabels).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <span>
                Bộ lọc chỉ áp dụng danh sách; tổng GL giữ nguyên kỳ báo cáo.
              </span>
            </div>
          </div>
          <div
            ref={panelsRef}
            className="accounting-panels"
            data-layout={wide ? 'split' : 'drawer'}
            style={
              {
                '--review-inspector-width': `${REVIEW_LAYOUT.inspectorWidth}px`,
              } as CSSProperties
            }
          >
            <div className="accounting-grid">
              <div className="accounting-grid-toolbar">
                <span aria-live="polite">
                  <strong>{filtered.length.toLocaleString('vi-VN')}</strong> /{' '}
                  {records.length.toLocaleString('vi-VN')} bút toán ·{' '}
                  {scope === 'review' ? 'Hàng chờ rà soát' : 'Toàn bộ GL'}
                  <small>
                    Không lọc ngưỡng tiền · Kỳ nguồn:{' '}
                    {period === 'all' ? 'tất cả' : period}
                  </small>
                </span>
                <span>
                  {filtered.length > 0
                    ? `${currentPage * 100 + 1}–${Math.min((currentPage + 1) * 100, filtered.length)}`
                    : '0'}{' '}
                  dòng
                </span>
              </div>
              {bulkCases.length > 0 && (
                <div className="accounting-bulk-bar">
                  <span>
                    {checked.length} bút toán · {bulkCases.length} hồ sơ
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={store.isProcessing}
                    onClick={() => {
                      const created = store.requestReviewEvidence(bulkCases)
                      setBulkMessage(
                        created
                          ? `Đã tạo yêu cầu chứng từ cho ${created} hồ sơ trong phiên.`
                          : 'Các hồ sơ đã có yêu cầu chứng từ đang chờ xử lý trong phiên.',
                      )
                    }}
                  >
                    Yêu cầu chứng từ
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setChecked([])}
                  >
                    Bỏ chọn
                  </Button>
                  {bulkMessage && <span role="status">{bulkMessage}</span>}
                </div>
              )}
              <div className="accounting-table-scroll">
                <table className="accounting-table journal-table">
                  <colgroup>
                    <col className="col-check" />
                    <col className="col-journal" />
                    <col className="col-date" />
                    <col className="col-channel" />
                    <col className="col-money" />
                    <col className="col-reference" />
                    <col className="col-status" />
                  </colgroup>
                  <thead>
                    <tr>
                      <th>
                        <span className="sr-only">Chọn</span>
                      </th>
                      <th>Bút toán / loại</th>
                      <th>Ngày / kỳ</th>
                      <th>Kênh / cửa hàng</th>
                      <th className="money">Giá trị (USD)</th>
                      <th>Tham chiếu</th>
                      <th>Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((r) => {
                      const item = caseFor(r.id)
                      return (
                        <tr
                          key={r.id}
                          aria-selected={r.id === selected?.id}
                          className={r.id === selected?.id ? 'is-selected' : ''}
                          onClick={(e) => {
                            if (
                              !(e.target as HTMLElement).closest(
                                'input,button,a',
                              )
                            )
                              selectRecord(
                                r,
                                e.currentTarget.querySelector('button')!,
                              )
                          }}
                        >
                          <td>
                            <input
                              type="checkbox"
                              aria-label={`Chọn ${r.journalId || r.id}`}
                              disabled={!item}
                              checked={checked.includes(r.id)}
                              onChange={(e) =>
                                setChecked((old) =>
                                  e.target.checked
                                    ? [...old, r.id]
                                    : old.filter((id) => id !== r.id),
                                )
                              }
                            />
                          </td>
                          <td>
                            <button
                              className="journal-button"
                              title={r.journalId || r.id}
                              onClick={(e) => selectRecord(r, e.currentTarget)}
                            >
                              {r.journalId || 'Thiếu mã bút toán'}
                            </button>
                            <small>{r.journalType || 'Chưa rõ loại'}</small>
                            {item && (
                              <small>
                                {classificationLabels[item.classification]}
                              </small>
                            )}
                          </td>
                          <td>
                            <span className="journal-date">
                              {r.postingDate || 'Ngày lỗi'}
                            </span>
                            <small>{r.period || 'Kỳ chưa rõ'}</small>
                          </td>
                          <td>
                            {displayChannel(r)}
                            <small title={r.storeKey || undefined}>
                              {r.storeKey === '-1'
                                ? 'Nhóm kỹ thuật'
                                : r.storeCode || r.storeKey || 'Trống'}
                            </small>
                          </td>
                          <td className="money">
                            <span className="amount-label">Doanh thu</span>
                            <strong>{money(r.revenueCents)}</strong>
                            <small className="amount-label">
                              GL gốc · dấu sổ cái
                            </small>
                            <span className="ledger-amount">
                              {money(r.amountCents)}
                            </span>
                          </td>
                          <td>
                            <span
                              className="reference-value"
                              title={r.sourceRef || 'Chưa cung cấp tham chiếu'}
                            >
                              {r.sourceRef || 'Chưa có'}
                            </span>
                          </td>
                          <td>
                            <span
                              className={`accounting-pill is-${item?.status || 'confirmed'}`}
                            >
                              {item?.stale
                                ? 'Cần rà soát lại'
                                : item
                                  ? reviewStatusLabels[item.status]
                                  : 'Hợp lệ'}
                            </span>
                            {item && (
                              <small>
                                {item.evidenceReviewed && item.evidence.trim()
                                  ? 'Đã rà soát bằng chứng'
                                  : 'Chưa xác minh chứng từ'}
                              </small>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                {!filtered.length && (
                  <p className="p-6 text-center text-sm text-muted-foreground">
                    Không có bút toán phù hợp bộ lọc hiện tại.
                    {hasFilters && (
                      <button
                        className="ml-2 text-primary underline"
                        onClick={clearFilters}
                      >
                        Xóa bộ lọc
                      </button>
                    )}
                  </p>
                )}
              </div>
              {filtered.length > 100 && (
                <div className="accounting-grid-toolbar">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === 0}
                    onClick={() => setPage((v) => Math.max(0, v - 1))}
                  >
                    Trang trước
                  </Button>
                  <span>
                    Trang {currentPage + 1} / {lastPage + 1} · 100 dòng / trang
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage >= lastPage}
                    onClick={() => setPage((v) => Math.min(lastPage, v + 1))}
                  >
                    Trang sau
                  </Button>
                </div>
              )}
            </div>
            {!wide && drawerOpen && (
              <button
                className="inspector-backdrop"
                tabIndex={-1}
                aria-label="Đóng vùng chi tiết"
                onClick={closeInspector}
              />
            )}
            <aside
              ref={inspectorRef}
              className="accounting-inspector"
              hidden={!wide && !drawerOpen}
              role={wide ? 'complementary' : 'dialog'}
              aria-modal={!wide && drawerOpen ? true : undefined}
              aria-labelledby="review-inspector-title"
              onKeyDown={(event) => {
                if (wide) return
                if (event.key === 'Escape') {
                  event.preventDefault()
                  closeInspector()
                }
                if (event.key === 'Tab') {
                  const focusable = [
                    ...(inspectorRef.current?.querySelectorAll<HTMLElement>(
                      'button,input,select,textarea,a[href]',
                    ) || []),
                  ].filter(
                    (el) =>
                      !el.closest('[hidden]') &&
                      !el.hasAttribute('disabled') &&
                      el.tabIndex >= 0,
                  )
                  const first = focusable[0],
                    last = focusable[focusable.length - 1]
                  if (event.shiftKey && document.activeElement === first) {
                    event.preventDefault()
                    last?.focus()
                  } else if (
                    !event.shiftKey &&
                    document.activeElement === last
                  ) {
                    event.preventDefault()
                    first?.focus()
                  }
                }
              }}
            >
              {selected || selectedCase ? (
                <RecordInspector
                  key={`${selected?.id || selectedCase?.id}:${inspectorVersion}`}
                  record={selected}
                  reviewCase={selectedCase}
                  records={records}
                  snapshot={snapshot}
                  drawer={!wide}
                  tab={inspectorTab}
                  onTabChange={setInspectorTab}
                  onClose={closeInspector}
                  onDirtyChange={onDirtyChange}
                />
              ) : (
                <p>Chọn một bút toán để xem chi tiết.</p>
              )}
            </aside>
          </div>
          <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
            <DialogContent className="history-dialog" closeLabel="Đóng lịch sử">
              <div className="p-5 pr-16">
                <DialogTitle>Lịch sử tự chuẩn hóa</DialogTitle>
                <DialogDescription>
                  Các quy tắc đã áp dụng trong phiên dữ liệu hiện tại.
                </DialogDescription>
              </div>
              <div className="history-dialog-body">
                <TransformationHistory
                  snapshot={snapshot}
                  selectedId={selected?.id}
                />
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}
    </section>
  )
}
