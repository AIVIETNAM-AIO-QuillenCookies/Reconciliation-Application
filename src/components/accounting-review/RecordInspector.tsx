import { useEffect, useRef, useState } from 'react'
import { ShieldCheck, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/lib/store'
import type { GLRecord, GLReviewSnapshot } from '@/lib/gl-review'
import type { GLReviewCase } from '@/lib/accounting-review'
import { CaseInspector } from './CaseInspector'
import { CorrectionForm } from './CorrectionForm'
import { TransformationHistory } from './TransformationHistory'
import {
  classificationLabels,
  displayChannel,
  money,
  reviewStatusLabels,
} from './review-format'

export type InspectorTab = 'overview' | 'evidence' | 'correction' | 'history'
const inspectorTabs: { id: InspectorTab; label: string }[] = [
  { id: 'overview', label: 'Tổng quan' },
  { id: 'evidence', label: 'Bằng chứng & xử lý' },
  { id: 'correction', label: 'Điều chỉnh' },
  { id: 'history', label: 'Lịch sử & nguồn' },
]

export function RecordInspector({
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
        <h2
          id="review-inspector-title"
          title={title}
          data-tour="accounting-selected-journal"
          data-journal-id={record?.journalId}
        >
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
            data-tour={`accounting-inspector-tab-${id}`}
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
              data-tour="accounting-save-review"
              form={`review-case-${reviewCase.id}`}
              size="sm"
              disabled={store.isProcessing}
            >
              <ShieldCheck className="size-3.5" />
              Lưu rà soát
            </Button>
            <Button
              data-tour="accounting-request-evidence"
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
