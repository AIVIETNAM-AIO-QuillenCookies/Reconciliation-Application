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
  FileSearch,
  History,
  Search,
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
import { InformationNote } from '@/components/PageInformation'
import { ReferenceAccountingSummary } from '@/components/excel-reference/ReferenceViews'
import type { GLRecord } from '@/lib/gl-review'
import { REVIEW_LAYOUT } from '@/lib/review-layout'
import {
  RecordInspector,
  type InspectorTab,
} from '@/components/accounting-review/RecordInspector'
import { TransformationHistory } from '@/components/accounting-review/TransformationHistory'
import {
  classificationLabels,
  displayChannel,
  money,
  reviewStatusLabels,
} from '@/components/accounting-review/review-format'
import '@/accounting-review.css'

// These panels live in components/accounting-review; they stay re-exported here
// so existing imports from this page module keep working.
export { GLDiagnosticsView } from '@/components/accounting-review/GLDiagnosticsView'
export { AccountingExceptionCases } from '@/components/accounting-review/AccountingExceptionCases'

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
      data-tour="accounting-workspace"
      data-manual-count={
        records.filter((record) => record.journalType === 'MANUAL').length
      }
      data-visible-count={filtered.length}
      className="accounting-workspace viewport-workspace"
      aria-label="Rà soát kế toán"
    >
      <header className="workspace-page-heading accounting-page-heading">
        <div>
          <h1>Rà soát kế toán</h1>
          <InformationNote title="Rà soát kế toán">
            <p>
              Kiểm tra bút toán, bằng chứng và quyết định. Bộ lọc chỉ áp dụng
              danh sách; tổng GL giữ nguyên kỳ báo cáo. Không lọc ngưỡng tiền
              trong hàng chờ rà soát.
            </p>
            <p>
              Kỳ báo cáo: {store.period.start} → {store.period.end}.
            </p>
          </InformationNote>
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
                data-tour="accounting-search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Mã, nội dung, cửa hàng…"
              />
            </label>
            <label>
              Góc nhìn
              <select
                data-tour="accounting-scope"
                value={scope}
                onChange={(e) => setScope(e.target.value)}
              >
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
              data-tour="accounting-more-filters"
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
                <select
                  data-tour="accounting-journal-type"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                >
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
                  data-tour="accounting-classification"
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
                      <th className="money">Doanh thu (USD)</th>
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
                          data-tour={`accounting-row-${r.journalId}`}
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
                              data-tour={`accounting-journal-${r.journalId}`}
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
                          <td
                            className="money"
                            title={`GL gốc theo dấu sổ cái: ${money(r.amountCents)}`}
                          >
                            <strong>{money(r.revenueCents)}</strong>
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
