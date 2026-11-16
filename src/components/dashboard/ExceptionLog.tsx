import { LocalizedNote } from '@/components/LocalizedError'
import { vi } from '@/lib/i18n'
import { Fragment, useId, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  ArrowDown,
  ArrowDownUp,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Download,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ExceptionActions } from './exceptions/ExceptionActions'
import { ExceptionBadge } from './exceptions/ExceptionBadge'
import { downloadERPReviewCSV } from '@/lib/exception-download'
import {
  EXCEPTION_CATEGORIES,
  filterExceptions,
  signedDelta,
  type CategoryFilter,
  type ExceptionSort,
  type ReconciliationException,
} from '@/lib/exceptions'
import type { GLReviewCase } from '@/lib/accounting-review'
import { formatUSD } from '@/lib/format-money'
import '@/exceptions.css'

const formatDate = (value: string) =>
  new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`))
const THRESHOLDS = [0, 20_000, 100_000, 500_000, 1_000_000] as const

export interface ExceptionLogProps {
  data?: readonly ReconciliationException[]
  sample?: boolean
  reviewCases?: readonly GLReviewCase[]
  emptyState?: { title: string; description: string }
}

/** Summaries and exports cover the entire filtered view, before pagination. */
export function ExceptionLog({
  data = [],
  sample = false,
  reviewCases = [],
  emptyState = {
    title: 'Chưa có bản ghi ngoại lệ.',
    description: 'Ngoại lệ sẽ xuất hiện sau khi hoàn tất đối soát.',
  },
}: ExceptionLogProps) {
  const instanceId = useId()
  const [params] = useSearchParams()
  const requestedRecord = params.get('record')
  const requestedReturn = params.get('returnTo')
  const dashboardReturn =
    requestedReturn === '/' || requestedReturn?.startsWith('/?')
      ? requestedReturn
      : null
  const [query, setQuery] = useState(params.get('q') ?? '')
  const [category, setCategory] = useState<CategoryFilter>(() => {
    const value = params.get('category')
    return EXCEPTION_CATEGORIES.find((item) => item === value) ?? 'All'
  })
  const [thresholdCents, setThresholdCents] = useState<number>(() => {
    const value = params.get('threshold')
    return value !== null &&
      Number.isSafeInteger(Number(value)) &&
      Number(value) >= 0
      ? Number(value)
      : 20_000
  })
  const [sort, setSort] = useState<ExceptionSort>({
    key:
      params.get('sort') === 'store'
        ? 'store'
        : params.get('sort') === 'date'
          ? 'date'
          : 'impact',
    direction: params.get('direction') === 'asc' ? 'asc' : 'desc',
  })
  const [pageSelection, setPageSelection] = useState<{
    request: string | null
    value: number | null
  }>(() => ({
    request: requestedRecord,
    value:
      Number.isSafeInteger(Number(params.get('page'))) &&
      Number(params.get('page')) > 0
        ? Number(params.get('page'))
        : null,
  }))
  const page =
    pageSelection.request === requestedRecord ? pageSelection.value : null
  const setPage = (value: number) =>
    setPageSelection({ request: requestedRecord, value })
  const [pageSize, setPageSize] = useState(
    () =>
      [10, 20, 50].find((value) => value === Number(params.get('rows'))) ?? 20,
  )
  const [selection, setSelection] = useState<{
    request: string | null
    value: string | null
  }>(() => ({ request: requestedRecord, value: requestedRecord }))
  const selectedId =
    selection.request === requestedRecord ? selection.value : requestedRecord
  const expanded = data.some((row) => row.id === selectedId) ? selectedId : null
  const setExpanded = (value: string | null) =>
    setSelection({ request: requestedRecord, value })
  const [announcement, setAnnouncement] = useState('')
  const filtered = useMemo(
    () => filterExceptions(data, { query, category, thresholdCents, sort }),
    [data, query, category, thresholdCents, sort],
  )
  const caseMap = new Map(reviewCases.map((item) => [item.id, item]))
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const requestedIndex = filtered.findIndex((row) => row.id === requestedRecord)
  const currentPage = Math.min(
    page ??
      (requestedIndex >= 0 ? Math.floor(requestedIndex / pageSize) + 1 : 1),
    pageCount,
  )
  const start = (currentPage - 1) * pageSize
  const visible = filtered.slice(start, start + pageSize)
  const exceptionReturnTo = (recordId: string) => {
    const context = new URLSearchParams({
      tab: 'differences',
      q: query,
      category,
      threshold: String(thresholdCents),
      sort: sort.key,
      direction: sort.direction,
      page: String(currentPage),
      rows: String(pageSize),
      record: recordId,
    })
    if (dashboardReturn) {
      context.set('from', 'dashboard')
      context.set('returnTo', dashboardReturn)
    }
    return `/exceptions?${context}`
  }
  const absoluteDelta = filtered.reduce(
    (total, row) => total + BigInt(Math.abs(row.deltaCents)),
    0n,
  )
  const activeFilters =
    query.trim() !== '' || category !== 'All' || thresholdCents !== 20_000
  function resetFilters() {
    setQuery('')
    setCategory('All')
    setThresholdCents(20_000)
    setPage(1)
    setExpanded(null)
  }
  function changeSort(key: ExceptionSort['key']) {
    setSort((previous) => ({
      key,
      direction:
        previous.key === key
          ? previous.direction === 'asc'
            ? 'desc'
            : 'asc'
          : key === 'store'
            ? 'asc'
            : 'desc',
    }))
    setPage(1)
  }
  function exportRows(rows: readonly ReconciliationException[]) {
    try {
      downloadERPReviewCSV(rows, sample)
      setAnnouncement(
        `Đã tạo CSV cho ${rows.length} dòng. Tệp là mẫu rà soát, chưa ghi vào ERP.`,
      )
    } catch {
      setAnnouncement('Không tạo được tệp CSV. Vui lòng thử lại.')
    }
  }
  function sortIcon(key: ExceptionSort['key']) {
    const Icon =
      sort.key !== key
        ? ArrowDownUp
        : sort.direction === 'desc'
          ? ArrowDown
          : ArrowUp
    return <Icon className="size-3" aria-hidden="true" />
  }
  const ariaSort = (key: ExceptionSort['key']) =>
    sort.key === key
      ? sort.direction === 'asc'
        ? ('ascending' as const)
        : ('descending' as const)
      : ('none' as const)

  return (
    <section className="exception-data" aria-label="Chênh lệch đối soát">
      {dashboardReturn && (
        <div className="px-3 pt-2">
          <Button asChild variant="ghost" size="sm">
            <Link to={dashboardReturn}>Quay lại dashboard</Link>
          </Button>
        </div>
      )}
      {requestedRecord && requestedIndex < 0 && (
        <p className="exception-filter-scope" role="status">
          {data.some((row) => row.id === requestedRecord)
            ? `Ngoại lệ ${requestedRecord} nằm ngoài bộ lọc đang chọn.`
            : `Không tìm thấy ngoại lệ ${requestedRecord} trong kết quả hiện tại.`}
        </p>
      )}
      {sample && (
        <p className="exception-sample">
          Dữ liệu minh họa năm 2026, độc lập với tệp và kỳ đang chọn.
        </p>
      )}
      <div className="exception-summary">
        <span>
          <strong>{filtered.length.toLocaleString('vi-VN')}</strong> dòng sau
          lọc <small>/ {data.length.toLocaleString('vi-VN')} dòng</small>
        </span>
        <span title="Tổng trị tuyệt đối chênh lệch của các dòng sau lọc; các góc nhìn có thể trùng rủi ro.">
          <small>Tổng |chênh lệch|</small>{' '}
          <strong className="exception-money">
            {formatUSD(absoluteDelta)}
          </strong>
        </span>
        <span>
          <strong>
            {filtered.filter((row) => row.category === 'Data Error').length}
          </strong>{' '}
          lỗi dữ liệu
        </span>
        <span>
          <strong>
            {filtered.filter((row) => row.category === 'Missing GL').length}
          </strong>{' '}
          thiếu GL
        </span>
      </div>
      <div className="exception-toolbar">
        <label className="exception-search">
          <Search className="size-4" aria-hidden="true" />
          <span className="sr-only">
            Tìm ngoại lệ theo cửa hàng, loại hoặc tham chiếu
          </span>
          <input
            type="search"
            value={query}
            placeholder="Tìm cửa hàng, loại, tham chiếu…"
            onChange={(event) => {
              setQuery(event.target.value)
              setPage(1)
            }}
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('')
                setPage(1)
              }}
              aria-label="Xóa tìm kiếm"
            >
              <X className="size-3.5" />
            </button>
          )}
        </label>
        <label className="exception-filter">
          <span className="sr-only">Loại ngoại lệ</span>
          <select
            aria-label="Loại ngoại lệ"
            value={category}
            onChange={(event) => {
              setCategory(event.target.value as CategoryFilter)
              setPage(1)
            }}
          >
            <option value="All">Tất cả loại</option>
            {EXCEPTION_CATEGORIES.map((value) => (
              <option key={value} value={value}>
                {vi(value)}
              </option>
            ))}
          </select>
        </label>
        <details className="exception-more-filters">
          <summary>
            <SlidersHorizontal className="size-3.5" aria-hidden="true" /> Bộ lọc
            khác{' '}
            {thresholdCents !== 20_000 && (
              <span className="exception-filter-dot" />
            )}
          </summary>
          <div>
            <label>
              Ngưỡng |chênh lệch| (USD)
              <select
                value={thresholdCents}
                onChange={(event) => {
                  setThresholdCents(Number(event.target.value))
                  setPage(1)
                }}
              >
                {THRESHOLDS.map((value) => (
                  <option key={value} value={value}>
                    Lớn hơn {formatUSD(value)}
                  </option>
                ))}
              </select>
            </label>
            <p>
              Chỉ áp dụng cho chênh lệch đối soát. Hồ sơ kiểm soát chứng từ dùng
              bộ lọc riêng.
            </p>
          </div>
        </details>
        {activeFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={resetFilters}
            className="h-8 gap-1 text-xs"
          >
            <X className="size-3" /> Xóa bộ lọc
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          className="exception-export h-8 gap-1.5 text-xs"
          onClick={() => exportRows(filtered)}
          disabled={!filtered.length}
        >
          <Download className="size-3.5" /> Xuất CSV
        </Button>
      </div>
      <p className="exception-filter-scope">
        Phạm vi: chênh lệch nguồn − GL · |chênh lệch| &gt;{' '}
        {formatUSD(thresholdCents)} · tổng hợp theo các dòng sau lọc.
      </p>
      <div className="exception-table-shell">
        <div
          className="exception-table-scroll"
          tabIndex={0}
          aria-label="Danh sách chênh lệch đối soát"
        >
          <table className="exception-table">
            <caption className="sr-only">
              Các dòng chênh lệch vượt ngưỡng đang chọn. Chọn vấn đề để mở mô
              tả; mở hồ sơ kế toán để xử lý.
            </caption>
            <colgroup>
              <col style={{ width: '27%' }} />
              <col style={{ width: '16%' }} />
              <col style={{ width: '16%' }} />
              <col style={{ width: '17%' }} />
              <col style={{ width: '19%' }} />
              <col style={{ width: '5%' }} />
            </colgroup>
            <thead>
              <tr>
                <th scope="col">Vấn đề / tham chiếu</th>
                <th scope="col" aria-sort={ariaSort('store')}>
                  <button onClick={() => changeSort('store')}>
                    Nhóm liên quan {sortIcon('store')}
                  </button>
                </th>
                <th
                  scope="col"
                  aria-sort={ariaSort(sort.key === 'date' ? 'date' : 'impact')}
                  className="exception-value-heading"
                >
                  <button onClick={() => changeSort('impact')}>
                    Chênh lệch USD {sortIcon('impact')}
                  </button>
                  <button
                    onClick={() => changeSort('date')}
                    aria-label="Sắp xếp theo ngày"
                  >
                    Ngày / kỳ {sortIcon('date')}
                  </button>
                </th>
                <th scope="col">Trạng thái</th>
                <th scope="col">Phụ trách / bước tiếp</th>
                <th scope="col">
                  <span className="sr-only">Thao tác</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => {
                const related = (row.reviewCaseIds ?? []).flatMap((id) =>
                  caseMap.get(id) ? [caseMap.get(id)!] : [],
                )
                const state = related.some((item) => item.stale)
                  ? 'stale'
                  : related.length &&
                      related.every((item) => item.status === 'confirmed')
                    ? 'confirmed'
                    : related.some((item) => item.status === 'in_progress')
                      ? 'in_progress'
                      : related.length &&
                          related.every(
                            (item) =>
                              item.status === 'reviewed' ||
                              item.status === 'confirmed',
                          )
                        ? 'reviewed'
                        : 'open'
                const statusLabel = {
                  stale: 'Cần rà soát lại',
                  confirmed: 'Đã xác nhận',
                  in_progress: 'Đang xử lý',
                  reviewed: 'Đã xem · chưa giải quyết',
                  open: related.length ? 'Chờ xác minh' : 'Cần rà soát',
                }[state]
                const owners = [
                  ...new Set(related.map((item) => item.owner).filter(Boolean)),
                ].join(', ')
                const nextSteps = [
                  ...new Set(
                    related.map((item) => item.nextStep).filter(Boolean),
                  ),
                ].join(' · ')
                const nextStep =
                  nextSteps ||
                  (row.type === 'Duplicate POS'
                    ? 'Kiểm tra bản ghi POS trùng'
                    : row.category === 'Missing GL'
                      ? 'Đối chiếu bút toán còn thiếu'
                      : 'Xác minh căn cứ chênh lệch')
                return (
                  <Fragment key={row.id}>
                    <tr
                      data-tour={`exception-row-${row.id}`}
                      className={
                        expanded === row.id ? 'is-selected' : undefined
                      }
                    >
                      <td className="exception-issue-cell">
                        <button
                          data-tour={`exception-open-${row.id}`}
                          className="exception-issue-button"
                          aria-label={`Xem chi tiết ${row.reference}`}
                          aria-expanded={expanded === row.id}
                          aria-controls={`${instanceId}-${row.id}`}
                          onClick={() =>
                            setExpanded(expanded === row.id ? null : row.id)
                          }
                        >
                          <ChevronRight
                            className={`size-3.5 ${expanded === row.id ? 'rotate-90' : ''}`}
                            aria-hidden="true"
                          />
                          <span>
                            <strong>{vi(row.type)}</strong>
                            <small title={row.reference}>
                              {row.reference}
                              {row.type === 'Duplicate POS' &&
                                ` · ${row.duplicateLineCount} dòng`}
                            </small>
                          </span>
                        </button>
                        <ExceptionBadge category={row.category} />
                      </td>
                      <td>
                        <span className="exception-cell-label">
                          Nhóm liên quan
                        </span>
                        <strong>
                          {row.storeKey === '-1'
                            ? 'Chưa phân bổ'
                            : row.storeKey || 'Chưa rõ cửa hàng'}
                        </strong>
                        {row.reviewCaseIds?.map((id, index) => (
                          <Link
                            className="exception-case-link"
                            key={id}
                            to={`/accounting-review?case=${encodeURIComponent(id)}&from=exceptions&returnTo=${encodeURIComponent(exceptionReturnTo(row.id))}`}
                          >
                            Mở hồ sơ
                            {row.reviewCaseIds!.length > 1
                              ? ` ${index + 1}`
                              : ''}
                            <ChevronRight className="size-3" />
                          </Link>
                        ))}
                      </td>
                      <td className="exception-value-cell">
                        <span className="exception-cell-label">
                          Chênh lệch USD
                        </span>
                        <strong
                          className={`exception-money ${row.deltaCents < 0 ? 'is-negative' : ''}`}
                        >
                          {signedDelta(row.deltaCents)}
                        </strong>
                        <time dateTime={row.date}>{formatDate(row.date)}</time>
                        <small>Kỳ {row.date.slice(0, 7)}</small>
                      </td>
                      <td>
                        <span className="exception-cell-label">Trạng thái</span>
                        <span className={`accounting-pill is-${state}`}>
                          {statusLabel}
                        </span>
                        {!!related.length && (
                          <small>{related.length} hồ sơ liên quan</small>
                        )}
                      </td>
                      <td>
                        <span className="exception-cell-label">
                          Phụ trách / bước tiếp
                        </span>
                        <strong>{owners || 'Chưa phân công'}</strong>
                        <small>{nextStep}</small>
                      </td>
                      <td className="exception-action-cell">
                        <ExceptionActions
                          row={row}
                          sample={sample}
                          onExport={(item) => exportRows([item])}
                          onDraft={() =>
                            setAnnouncement(
                              'Đã yêu cầu mở thư nháp. Kiểm tra người nhận và nội dung trước khi gửi.',
                            )
                          }
                        />
                      </td>
                    </tr>
                    {expanded === row.id && (
                      <tr className="exception-detail-row">
                        <td colSpan={6}>
                          <div
                            id={`${instanceId}-${row.id}`}
                            data-tour="exception-detail"
                            data-exception-id={row.id}
                            className="exception-detail"
                          >
                            <LocalizedNote message={row.description} />
                            <p>
                              Mã ngoại lệ: <span>{row.id}</span> · Tham chiếu:{' '}
                              <span>{row.reference}</span>
                            </p>
                            {!!row.reviewCaseIds?.length && (
                              <p>
                                Các hồ sơ kế toán liên quan cùng chênh lệch;
                                không cộng số tiền hồ sơ thêm vào rủi ro.
                              </p>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
              {!visible.length && (
                <tr>
                  <td colSpan={6} className="exception-empty">
                    <Search
                      className="mx-auto mb-2 size-5"
                      aria-hidden="true"
                    />
                    <strong>
                      {data.length
                        ? 'Không có ngoại lệ phù hợp.'
                        : emptyState.title}
                    </strong>
                    <p>
                      {data.length
                        ? 'Thử thay đổi từ khóa, loại hoặc ngưỡng chênh lệch.'
                        : emptyState.description}
                    </p>
                    {activeFilters && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3"
                        onClick={resetFilters}
                      >
                        Xóa bộ lọc
                      </Button>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <footer className="exception-footer">
        <p role="status">
          {filtered.length ? start + 1 : 0}–
          {Math.min(start + pageSize, filtered.length)} / {filtered.length} dòng
        </p>
        <label>
          <span>Số dòng</span>
          <select
            aria-label="Số dòng mỗi trang"
            value={pageSize}
            onChange={(event) => {
              setPageSize(Number(event.target.value))
              setPage(1)
            }}
          >
            {[10, 20, 50].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <span>
          Trang {currentPage} / {pageCount}
        </span>
        <Button
          variant="outline"
          size="icon"
          className="size-8"
          aria-label="Trang trước"
          disabled={currentPage <= 1}
          onClick={() => setPage(currentPage - 1)}
        >
          <ChevronLeft className="size-3.5" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="size-8"
          aria-label="Trang sau"
          disabled={currentPage >= pageCount}
          onClick={() => setPage(currentPage + 1)}
        >
          <ChevronRight className="size-3.5" />
        </Button>
      </footer>
      {announcement && (
        <p role="status" className="exception-announcement">
          {announcement}
        </p>
      )}
    </section>
  )
}

export default ExceptionLog
