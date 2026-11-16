import { useEffect, useState } from 'react'
import { useAppStore } from '@/lib/store'
import type { GLCaseStatus, GLClassification, GLRecord } from '@/lib/gl-review'
import type { GLReviewCase } from '@/lib/accounting-review'
import { transferIssue } from '@/lib/accounting-review'
import {
  classificationLabels,
  money,
  reviewStatusLabels,
} from './review-format'

export function CaseInspector({
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
      data-tour="accounting-case-form"
      data-case-id={reviewCase.id}
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
            data-tour="accounting-evidence"
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
            data-tour="accounting-notes"
            value={draft.notes}
            onChange={(e) => set('notes', e.target.value)}
          />
        </label>
        <div className="row">
          <label>
            Người / nhóm phụ trách
            <input
              data-tour="accounting-owner"
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
