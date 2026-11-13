import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowRight, FileSpreadsheet, Table2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  selectExcelReference,
  referenceDetailsFor,
  type ExcelReferenceWorkbook,
  type ReferenceSourceRow,
} from '@/lib/excel-reference'
import type { ReconciliationPeriod } from '@/lib/reconciliation-types'
import './reference-views.css'

export interface ReferenceViewProps {
  workbook: ExcelReferenceWorkbook
  period: ReconciliationPeriod
  setPeriod?: (period: ReconciliationPeriod) => void
}
export type ReferenceSheetName = 'Cau_noi' | 'Nhat_ky_ngoai_le' | 'Chi_tiet'
const NO_DATA = 'Chưa có dữ liệu tương ứng trong file tham chiếu.'
const money = (value: number | null | undefined) =>
  value === null || value === undefined
    ? '—'
    : new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(Object.is(value, -0) ? 0 : value)
const cell = (value: unknown) =>
  value === null || value === undefined || value === ''
    ? '—'
    : typeof value === 'number'
      ? new Intl.NumberFormat('vi-VN', {
          maximumFractionDigits: 12,
        }).format(value)
      : String(value)
const kindLabel = {
  sales: 'Tổng Sales Flash',
  adjustment: 'Điều chỉnh',
  bridge_total: 'Tổng cầu nối',
  finance: 'Tổng Finance',
  check: 'Kiểm tra',
}

function ReferenceHeading({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <header className="excel-reference-heading">
      <div>
        <h1>{title}</h1>
        <p className="mt-1">{description}</p>
      </div>
      <span className="excel-reference-badge">
        <FileSpreadsheet size={13} aria-hidden="true" />
        Kết quả tham chiếu Excel
      </span>
    </header>
  )
}

function monthEnd(month: string) {
  const [year, value] = month.split('-').map(Number)
  return `${month}-${String(new Date(Date.UTC(year, value, 0)).getUTCDate()).padStart(2, '0')}`
}

export function ReferencePeriodControl({
  workbook,
  period,
  setPeriod,
}: ReferenceViewProps) {
  return (
    <div className="excel-reference-period">
      <strong>Kỳ xem thử</strong>
      <label>
        <span className="sr-only">Từ tháng tham chiếu</span>
        <select
          aria-label="Từ tháng tham chiếu"
          value={period.start.slice(0, 7)}
          disabled={!setPeriod}
          onChange={(event) => {
            const start = event.target.value
            const end =
              start > period.end.slice(0, 7) ? start : period.end.slice(0, 7)
            setPeriod?.({ start: `${start}-01`, end: monthEnd(end) })
          }}
        >
          {workbook.months.map((month) => (
            <option key={month} value={month}>
              {month}
            </option>
          ))}
        </select>
      </label>
      <span>đến</span>
      <label>
        <span className="sr-only">Đến tháng tham chiếu</span>
        <select
          aria-label="Đến tháng tham chiếu"
          value={period.end.slice(0, 7)}
          disabled={!setPeriod}
          onChange={(event) => {
            const end = event.target.value
            const start =
              end < period.start.slice(0, 7) ? end : period.start.slice(0, 7)
            setPeriod?.({ start: `${start}-01`, end: monthEnd(end) })
          }}
        >
          {workbook.months.map((month) => (
            <option key={month} value={month}>
              {month}
            </option>
          ))}
        </select>
      </label>
      {setPeriod && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            setPeriod({
              start: `${workbook.months[0]}-01`,
              end: monthEnd(workbook.months.at(-1)!),
            })
          }
        >
          Cả năm
        </Button>
      )}
      <small>USD trong workbook · Không quy đổi tỷ giá thêm</small>
    </div>
  )
}

function SourceTable({
  columns,
  rows,
  label,
}: {
  columns: string[]
  rows: ReferenceSourceRow[]
  label: string
}) {
  const [page, setPage] = useState(0)
  const [query, setQuery] = useState('')
  const filtered = useMemo(() => {
    const search = query.trim().toLocaleLowerCase('vi-VN')
    return search
      ? rows.filter((row) =>
          Object.values(row.values).some((value) =>
            String(value ?? '')
              .toLocaleLowerCase('vi-VN')
              .includes(search),
          ),
        )
      : rows
  }, [rows, query])
  const pages = Math.max(1, Math.ceil(filtered.length / 100))
  const safePage = Math.min(page, pages - 1)
  const displayed = filtered.slice(safePage * 100, safePage * 100 + 100)
  return (
    <>
      <div className="excel-reference-toolbar">
        <label>
          Tìm trong bảng
          <input
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setPage(0)
            }}
            placeholder="Mã, mô tả, dòng nguồn…"
          />
        </label>
        <span>
          {filtered.length.toLocaleString('vi-VN')} /{' '}
          {rows.length.toLocaleString('vi-VN')} bản ghi
        </span>
      </div>
      <div
        className="excel-reference-scroll"
        role="region"
        aria-label={label}
        tabIndex={0}
      >
        {displayed.length ? (
          <table className="excel-reference-table">
            <thead>
              <tr>
                <th>Dòng Excel</th>
                {columns.map((column) => (
                  <th key={column}>{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayed.map((row) => (
                <tr key={row.sourceRow}>
                  <td className="numeric">{row.sourceRow}</td>
                  {columns.map((column) => (
                    <td
                      key={column}
                      className={
                        typeof row.values[column] === 'number'
                          ? 'numeric'
                          : undefined
                      }
                    >
                      {cell(row.values[column])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="excel-reference-empty">
            Không có bản ghi phù hợp với kỳ và bộ lọc đã chọn.
          </p>
        )}
      </div>
      <div className="excel-reference-footer">
        <span>Giữ nguyên các cột nguồn; không cộng các cột USD khác nhau.</span>
        <div>
          <Button
            variant="outline"
            size="sm"
            disabled={safePage === 0}
            onClick={() => setPage(safePage - 1)}
          >
            Trước
          </Button>
          <span>
            Trang {safePage + 1} / {pages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={safePage + 1 >= pages}
            onClick={() => setPage(safePage + 1)}
          >
            Sau
          </Button>
        </div>
      </div>
    </>
  )
}

function ReferenceChecks({ workbook, period }: ReferenceViewProps) {
  const selected = selectExcelReference(workbook, period)
  return (
    <details className="excel-reference-technical">
      <summary>Kiểm tra số liệu và nguồn workbook</summary>
      <p className="mb-2">
        Nguồn: {workbook.fileName}. Ngưỡng sai số:{' '}
        {money(workbook.toleranceUSD)}. Cột Cả năm chỉ dùng đối chiếu, không
        cộng vào 12 tháng. Khớp số học không xác nhận đủ bằng chứng kế toán.
      </p>
      <table className="excel-reference-table">
        <thead>
          <tr>
            <th>Kiểm tra</th>
            <th>Kỳ</th>
            <th>Đọc / tính được</th>
            <th>Đối chiếu</th>
            <th>Chênh lệch</th>
            <th>Kết quả</th>
          </tr>
        </thead>
        <tbody>
          {selected.checks.map((check) => (
            <tr key={check.id}>
              <td>{check.label}</td>
              <td>{check.month ?? 'Cả năm'}</td>
              <td className="numeric">
                {check.unit === 'records'
                  ? `${cell(check.actualUSD)} bản ghi`
                  : money(check.actualUSD)}
              </td>
              <td className="numeric">
                {check.unit === 'records'
                  ? `${cell(check.expectedUSD)} bản ghi`
                  : money(check.expectedUSD)}
              </td>
              <td className="numeric">
                {check.unit === 'records'
                  ? cell(check.differenceUSD)
                  : money(check.differenceUSD)}
              </td>
              <td>{check.passed ? 'Khớp' : 'Cần kiểm tra'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  )
}

function ReferenceWaterfall({
  rows,
}: {
  rows: ReturnType<typeof selectExcelReference>['bridgeRows']
}) {
  const bridge = rows.filter((row) =>
    ['sales', 'adjustment', 'finance'].includes(row.kind),
  )
  const points = bridge.reduce<
    ((typeof bridge)[number] & {
      start: number
      end: number
      total: boolean
    })[]
  >((previous, row) => {
    const total = row.kind !== 'adjustment'
    const start = total ? 0 : (previous.at(-1)?.end ?? 0)
    const end = total ? row.amountUSD : start + row.amountUSD
    return [...previous, { ...row, start, end, total }]
  }, [])
  const low = Math.min(
    0,
    ...points.flatMap((point) => [point.start, point.end]),
  )
  const high = Math.max(
    1,
    ...points.flatMap((point) => [point.start, point.end]),
  )
  const span = Math.max(1, high - low)
  const y = (value: number) => 224 - ((value - low) / span) * 176
  const width = Math.max(1100, bridge.length * 90)
  const step = (width - 80) / Math.max(1, points.length)
  const formatCompact = new Intl.NumberFormat('vi-VN', {
    notation: 'compact',
    maximumFractionDigits: 2,
  })
  return (
    <div
      className="excel-reference-scroll"
      tabIndex={0}
      role="region"
      aria-label="Biểu đồ cầu nối tham chiếu có thể cuộn ngang"
    >
      <svg
        viewBox={`0 0 ${width} 300`}
        className="excel-reference-chart"
        role="img"
        aria-label="Cầu nối từ Sales Flash đến Finance theo Excel"
      >
        <line
          x1="42"
          x2={width - 14}
          y1={y(0)}
          y2={y(0)}
          stroke="var(--border)"
        />
        {points.map((point, index) => {
          const x = 50 + index * step
          const top = Math.min(y(point.start), y(point.end))
          const height = Math.max(2, Math.abs(y(point.end) - y(point.start)))
          const color = point.total
            ? 'var(--forest)'
            : /chưa|unexplained/i.test(point.label)
              ? 'var(--warning)'
              : point.amountUSD < 0
                ? 'var(--negative)'
                : 'var(--positive)'
          return (
            <g key={point.id}>
              <title>
                {point.label}: {money(point.amountUSD)}
              </title>
              <rect
                x={x}
                y={top}
                width={Math.max(20, step - 26)}
                height={height}
                rx="3"
                fill={color}
              />
              <text x={x + (step - 26) / 2} y={top - 9} textAnchor="middle">
                {formatCompact.format(point.amountUSD)}
              </text>
              <text x={x + (step - 26) / 2} y="248" textAnchor="middle">
                {point.label
                  .split(/\s+/)
                  .reduce<string[]>((lines, word) => {
                    if (!lines.length || `${lines.at(-1)} ${word}`.length > 14)
                      lines.push(word)
                    else lines[lines.length - 1] += ` ${word}`
                    return lines
                  }, [])
                  .slice(0, 3)
                  .map((line, lineIndex) => (
                    <tspan
                      key={lineIndex}
                      x={x + (step - 26) / 2}
                      dy={lineIndex ? 13 : 0}
                    >
                      {line}
                    </tspan>
                  ))}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

export function ReferenceDashboard(props: ReferenceViewProps) {
  const { workbook, period } = props
  const selected = useMemo(
    () => selectExcelReference(workbook, period),
    [workbook, period],
  )
  const [view, setView] = useState<'table' | 'chart' | 'unsupported'>('table')
  const [detailId, setDetailId] = useState<string | null>(null)
  const detailRows = useMemo(
    () => (detailId ? referenceDetailsFor(workbook, detailId, period) : []),
    [workbook, detailId, period],
  )
  const detailRow = selected.bridgeRows.find((row) => row.id === detailId)
  const residualMatches =
    Math.abs(selected.bridgeResidualUSD) <= workbook.toleranceUSD
  return (
    <div className="excel-reference-view viewport-workspace">
      <ReferenceHeading
        title="Tổng quan doanh thu"
        description="Dùng kết quả Excel để xem cầu nối và các ngoại lệ tham chiếu."
      />
      <ReferencePeriodControl {...props} />
      <section
        className="excel-reference-kpis"
        aria-label="KPI tham chiếu theo kỳ"
      >
        {[
          [
            'Doanh số Sales Flash',
            money(selected.available ? selected.salesUSD : null),
            'Tổng các tháng đã chọn · USD',
          ],
          [
            'Doanh thu Finance',
            money(selected.available ? selected.financeUSD : null),
            'Giá trị trong Cau_noi · USD',
          ],
          [
            'Chênh lệch',
            money(selected.available ? selected.varianceUSD : null),
            'Sales Flash − Finance',
          ],
          [
            'Ngoại lệ tham chiếu',
            selected.exceptions.length.toLocaleString('vi-VN'),
            `${workbook.exceptions.length} ngoại lệ trong toàn bộ workbook`,
          ],
        ].map(([label, value, hint]) => (
          <article key={label}>
            <p>{label}</p>
            <strong>{value}</strong>
            <small>{hint}</small>
          </article>
        ))}
      </section>
      <div className="excel-reference-summary">
        <span>
          Phí vận chuyển:{' '}
          <strong>
            {money(selected.available ? selected.shippingUSD : null)}
          </strong>
        </span>
        <span>
          Chưa giải thích:{' '}
          <strong>
            {money(selected.available ? selected.unexplainedUSD : null)}
          </strong>
        </span>
        <Link
          className="text-primary underline underline-offset-2"
          to="/exceptions"
        >
          Xem nhật ký tham chiếu
        </Link>
      </div>
      {selected.available && (
        <p className="excel-reference-notice" data-warning={!residualMatches}>
          <strong>
            {residualMatches
              ? 'Cầu nối khớp về số học.'
              : `Cầu nối còn chênh lệch ${money(selected.bridgeResidualUSD)}.`}
          </strong>{' '}
          Trạng thái chứng từ theo từng ngoại lệ vẫn giữ nguyên trong Excel;
          khớp số học không xác nhận đủ bằng chứng kế toán.
        </p>
      )}
      <section
        className="excel-reference-panel"
        aria-label="Cầu nối doanh thu tham chiếu"
      >
        <div className="excel-reference-panel-heading">
          <div>
            <h2>Cầu nối doanh thu</h2>
            <small>
              {workbook.fileName} · Cau_noi ·{' '}
              {selected.months.join(', ') || 'Ngoài kỳ workbook'}
            </small>
          </div>
          <div className="excel-reference-tabs" aria-label="Cách xem cầu nối">
            <button
              type="button"
              aria-pressed={view === 'table'}
              onClick={() => setView('table')}
            >
              Khoản mục & chi tiết
            </button>
            <button
              type="button"
              aria-pressed={view === 'chart'}
              onClick={() => setView('chart')}
            >
              Biểu đồ
            </button>
            <button
              type="button"
              aria-pressed={view === 'unsupported'}
              onClick={() => setView('unsupported')}
            >
              Cửa hàng / ngày
            </button>
          </div>
        </div>
        {!selected.available || view === 'unsupported' ? (
          <p className="excel-reference-empty">
            {NO_DATA}
            <br />
            Workbook tham chiếu không cung cấp bảng đối soát đầy đủ theo cửa
            hàng và ngày.
          </p>
        ) : view === 'chart' ? (
          <ReferenceWaterfall rows={selected.bridgeRows} />
        ) : (
          <div
            className="excel-reference-scroll"
            role="region"
            aria-label="Các khoản mục cầu nối Excel"
            tabIndex={0}
          >
            <table className="excel-reference-table">
              <thead>
                <tr>
                  <th>Khoản mục trong Excel</th>
                  <th>Loại dòng</th>
                  <th>Số tiền kỳ chọn (USD)</th>
                  <th>Truy vết</th>
                </tr>
              </thead>
              <tbody>
                {selected.bridgeRows.map((row) => (
                  <tr key={row.id} data-kind={row.kind}>
                    <td>
                      {row.detailCodes.length ? (
                        <button
                          type="button"
                          className="excel-reference-row-button"
                          onClick={() => setDetailId(row.id)}
                        >
                          <Table2 size={13} aria-hidden="true" />
                          {row.label}
                        </button>
                      ) : (
                        row.label
                      )}
                    </td>
                    <td>{kindLabel[row.kind]}</td>
                    <td className="numeric">{money(row.amountUSD)}</td>
                    <td className="excel-reference-source">
                      Cau_noi · Dòng {row.sourceRow}
                      {row.detailCodes.length
                        ? ` · ${row.detailCodes.join(', ')}`
                        : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="excel-reference-footer">
          <span>
            Các khoản tự bù giữa tháng vẫn được giữ. Cả năm không được cộng
            thêm.
          </span>
          <Link
            className="text-primary underline underline-offset-2"
            to="/processing?sheet=Cau_noi"
          >
            Xem bảng nguồn
          </Link>
        </div>
      </section>
      <ReferenceChecks {...props} />
      <Dialog
        open={detailId !== null}
        onOpenChange={(open) => {
          if (!open) setDetailId(null)
        }}
      >
        <DialogContent
          closeLabel="Đóng chi tiết tham chiếu"
          className="max-w-6xl"
        >
          <div className="p-5 pr-14">
            <DialogTitle>
              {detailRow?.label ?? 'Chi tiết khoản mục'}
            </DialogTitle>
            <DialogDescription className="mt-1">
              {workbook.fileName} · Chi_tiet · {selected.months.join(', ')} ·{' '}
              {detailRows.length.toLocaleString('vi-VN')} bản ghi
            </DialogDescription>
          </div>
          {detailRows.length ? (
            <SourceTable
              key={`${detailId}-${period.start}-${period.end}`}
              columns={workbook.sheets.Chi_tiet.columns}
              rows={detailRows}
              label="Chi tiết khoản mục từ Chi_tiet"
            />
          ) : (
            <p className="excel-reference-empty">{NO_DATA}</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export function ReferenceExceptions(props: ReferenceViewProps) {
  const { workbook, period: sharedPeriod } = props
  const [params, setParams] = useSearchParams()
  const requestedReturn = params.get('returnTo')
  const dashboardReturn =
    requestedReturn === '/' || requestedReturn?.startsWith('/?')
      ? requestedReturn
      : null
  const localScope = !!dashboardReturn || params.has('from') || params.has('to')
  const startMonth = params.get('from') ?? sharedPeriod.start.slice(0, 7)
  const endMonth = params.get('to') ?? sharedPeriod.end.slice(0, 7)
  const validScope =
    workbook.months.includes(startMonth) &&
    workbook.months.includes(endMonth) &&
    startMonth <= endMonth
  const period = useMemo(
    () =>
      localScope && validScope
        ? { start: `${startMonth}-01`, end: monthEnd(endMonth) }
        : sharedPeriod,
    [localScope, validScope, startMonth, endMonth, sharedPeriod],
  )
  const viewProps: ReferenceViewProps = {
    ...props,
    period,
    setPeriod: localScope
      ? (next) =>
          setParams(
            (previous) => {
              previous.set('from', next.start.slice(0, 7))
              previous.set('to', next.end.slice(0, 7))
              return previous
            },
            { replace: true },
          )
      : props.setPeriod,
  }
  const selected = useMemo(
    () => selectExcelReference(workbook, period),
    [workbook, period],
  )
  const [query, setQuery] = useState('')
  const selectedId = params.get('id')
  const setSelectedId = (id: string | null) =>
    setParams(
      (previous) => {
        if (id) previous.set('id', id)
        else previous.delete('id')
        return previous
      },
      { replace: true },
    )
  const rows = selected.exceptions.filter((row) =>
    [
      row.id,
      row.description,
      row.owner,
      row.category,
      row.status,
      row.periodLabel,
    ]
      .join(' ')
      .toLocaleLowerCase('vi-VN')
      .includes(query.toLocaleLowerCase('vi-VN')),
  )
  const detail = selected.exceptions.find((row) => row.id === selectedId)
  return (
    <div className="excel-reference-view viewport-workspace">
      <ReferenceHeading
        title="Nhật ký ngoại lệ"
        description="Ngoại lệ tham chiếu từ Excel; trạng thái giữ nguyên theo workbook."
      />
      {dashboardReturn && (
        <Button asChild variant="outline" size="sm" className="w-fit">
          <Link to={dashboardReturn}>Quay lại dashboard</Link>
        </Button>
      )}
      <ReferencePeriodControl {...viewProps} />
      {localScope && (
        <p className="excel-reference-notice" role="status">
          {validScope
            ? 'Kỳ truy vết được lọc riêng trong nhật ký này; kỳ xem thử Excel và dữ liệu Raw được giữ nguyên.'
            : 'Kỳ trong liên kết không hợp lệ; đang hiển thị kỳ xem thử Excel hiện tại. Chọn lại kỳ truy vết tại đây.'}
        </p>
      )}
      {selectedId && !detail && (
        <p className="excel-reference-notice" role="status">
          {workbook.exceptions.some((row) => row.id === selectedId)
            ? `Ngoại lệ ${selectedId} nằm ngoài kỳ đang chọn. Hãy mở rộng kỳ truy vết để xem đúng bản ghi.`
            : `Không tìm thấy ngoại lệ ${selectedId} trong workbook đang chọn.`}
        </p>
      )}
      <p className="excel-reference-notice">
        Hồ sơ rà soát Raw, ghi chú, bằng chứng và quyết định thủ công được giữ
        nguyên. Nhật ký tham chiếu không xác nhận hoặc đóng các hồ sơ đó.
      </p>
      <section className="excel-reference-panel">
        <div className="excel-reference-panel-heading">
          <div>
            <h2>
              {rows.length} ngoại lệ trong kỳ · {workbook.exceptions.length}{' '}
              ngoại lệ toàn bộ workbook
            </h2>
            <small>{workbook.fileName} · Nhat_ky_ngoai_le</small>
          </div>
          <Link
            className="text-xs text-primary underline underline-offset-2"
            to="/processing?sheet=Nhat_ky_ngoai_le"
          >
            Xem bảng nguồn
          </Link>
        </div>
        <div className="excel-reference-toolbar">
          <label>
            Tìm ngoại lệ
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Mã, mô tả, người phụ trách…"
            />
          </label>
          <span>Chỉ xem · Không đổi trạng thái Excel</span>
        </div>
        <div
          className="excel-reference-scroll"
          role="region"
          aria-label="Ngoại lệ tham chiếu Excel"
          tabIndex={0}
        >
          {rows.length ? (
            <table className="excel-reference-table">
              <thead>
                <tr>
                  <th>Mã</th>
                  <th>Mô tả</th>
                  <th>Ảnh hưởng USD</th>
                  <th>Kỳ trong Excel</th>
                  <th>Phân loại</th>
                  <th>Hướng xử lý</th>
                  <th>Người phụ trách</th>
                  <th>Trạng thái Excel</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <button
                        type="button"
                        className="excel-reference-row-button"
                        onClick={() => setSelectedId(row.id)}
                      >
                        {row.id}
                      </button>
                    </td>
                    <td className="min-w-64">{row.description}</td>
                    <td className="numeric">{money(row.impactUSD)}</td>
                    <td className="whitespace-nowrap">{row.periodLabel}</td>
                    <td>{row.category}</td>
                    <td className="min-w-56">{row.resolution}</td>
                    <td>{row.owner}</td>
                    <td>
                      <span className="excel-reference-status">
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="excel-reference-empty">
              Không có ngoại lệ phù hợp trong kỳ đã chọn.
            </p>
          )}
        </div>
        <div className="excel-reference-footer">
          <span>
            Ngoại lệ nhiều tháng giữ nguyên phạm vi kỳ Excel; ảnh hưởng được giữ
            nguyên, không phân bổ giả định theo tháng.
          </span>
        </div>
      </section>
      <Dialog
        open={!!detail}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null)
        }}
      >
        <DialogContent closeLabel="Đóng ngoại lệ tham chiếu">
          <div className="p-5 pr-14">
            <DialogTitle>{detail?.id} · Ngoại lệ tham chiếu</DialogTitle>
            <DialogDescription className="mt-1">
              {workbook.fileName} · Nhat_ky_ngoai_le · Dòng {detail?.sourceRow}
            </DialogDescription>
          </div>
          <div className="excel-reference-scroll">
            <dl className="excel-reference-definitions">
              {detail &&
                workbook.sheets.Nhat_ky_ngoai_le.columns.map((column) => (
                  <div key={column}>
                    <dt>{column}</dt>
                    <dd>{cell(detail.values[column])}</dd>
                  </div>
                ))}
            </dl>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export function ReferenceTables({
  sheet = 'Cau_noi',
  ...props
}: ReferenceViewProps & { sheet?: ReferenceSheetName }) {
  const { workbook, period } = props
  const [activeSheet, setActiveSheet] = useState<ReferenceSheetName>(sheet)
  const selected = useMemo(
    () => selectExcelReference(workbook, period),
    [workbook, period],
  )
  const data = workbook.sheets[activeSheet]
  const rows =
    activeSheet === 'Cau_noi'
      ? selected.bridgeRows
      : activeSheet === 'Nhat_ky_ngoai_le'
        ? selected.exceptions
        : selected.details
  const columns =
    activeSheet === 'Cau_noi'
      ? data.columns.filter(
          (column) =>
            !/^\d{4}-\d{2}$/.test(column) || selected.months.includes(column),
        )
      : data.columns
  return (
    <div className="excel-reference-view viewport-workspace">
      <ReferenceHeading
        title="Xử lý dữ liệu & xem bảng"
        description="Dùng kết quả Excel; ba bảng tham chiếu được đọc trực tiếp từ workbook."
      />
      <ReferencePeriodControl {...props} />
      <section className="excel-reference-panel">
        <div className="excel-reference-panel-heading">
          <div>
            <h2>Bảng dữ liệu tham chiếu</h2>
            <small>
              {workbook.fileName} · {activeSheet} ·{' '}
              {rows.length.toLocaleString('vi-VN')} bản ghi trong kỳ
            </small>
          </div>
          <div className="excel-reference-tabs" aria-label="Sheet tham chiếu">
            {(['Cau_noi', 'Nhat_ky_ngoai_le', 'Chi_tiet'] as const).map(
              (name) => (
                <button
                  type="button"
                  key={name}
                  aria-pressed={activeSheet === name}
                  onClick={() => setActiveSheet(name)}
                >
                  {name}
                </button>
              ),
            )}
          </div>
        </div>
        <SourceTable
          key={`${activeSheet}-${period.start}-${period.end}`}
          columns={columns}
          rows={rows}
          label={`Bảng ${activeSheet} từ ${workbook.fileName}`}
        />
      </section>
      <details className="excel-reference-technical">
        <summary>Cách đọc dữ liệu nguồn</summary>
        <p>
          Chi_tiet giữ từng cột USD, USD_bao_cao, USD_chinh_xac và các cột tỷ
          giá để truy vết. Các cột này thể hiện các cách tính khác nhau và không
          được cộng lẫn. Dòng Excel là vị trí thực tế trong sheet. Cả năm là số
          đối chiếu của workbook.
        </p>
      </details>
      <div className="excel-reference-muted">
        <strong>Giao dịch Raw / đối soát cửa hàng–ngày:</strong> {NO_DATA}
      </div>
    </div>
  )
}

export function ReferenceMethodology(props: ReferenceViewProps) {
  const { workbook } = props
  return (
    <div className="excel-reference-view viewport-workspace">
      <ReferenceHeading
        title="Quy tắc & Mô hình dữ liệu"
        description="Nguồn kết quả hiện tại là workbook tham chiếu Excel."
      />
      <ReferencePeriodControl {...props} />
      <section className="excel-reference-panel">
        <div className="excel-reference-panel-heading">
          <h2>Luồng tham chiếu đang dùng</h2>
          <span className="excel-reference-source">{workbook.fileName}</span>
        </div>
        <div className="excel-reference-scroll">
          <dl className="excel-reference-definitions">
            <div>
              <dt>Cau_noi · {workbook.bridgeRows.length} dòng</dt>
              <dd>
                12 tháng và Cả năm. Phân biệt tổng Sales, điều chỉnh, tổng cầu
                nối, Finance và kiểm tra. Giữ nguyên tên và dấu; chỉ cộng các
                tháng trong kỳ.
              </dd>
            </div>
            <div>
              <dt>Nhat_ky_ngoai_le · {workbook.exceptions.length} ngoại lệ</dt>
              <dd>
                Giữ nguyên mã, mô tả, ảnh hưởng USD, phạm vi kỳ, phân loại,
                hướng xử lý, người phụ trách và trạng thái. Ngoại lệ không tự
                trở thành hồ sơ đã giải quyết.
              </dd>
            </div>
            <div>
              <dt>
                Chi_tiet · {workbook.details.length.toLocaleString('vi-VN')}{' '}
                dòng
              </dt>
              <dd>
                Liên kết khoản mục qua Ma_khoan và tháng khi xác định được quan
                hệ. Giữ Ma_giao_dich, Dong_nguon và các cột tiền/tỷ giá riêng
                biệt.
              </dd>
            </div>
            <div>
              <dt>Kiểm tra số học</dt>
              <dd>
                Sales Flash + các khoản điều chỉnh so với Finance, kiểm tra từng
                tháng và cả năm với sai số {money(workbook.toleranceUSD)}. Chênh
                lệch thực tế được hiển thị; không tạo khoản cân bằng.
              </dd>
            </div>
            <div>
              <dt>Đơn vị và độ chính xác</dt>
              <dd>
                Số liệu cầu nối đã là USD. Không quy đổi FX thêm; chỉ làm tròn
                theo tiền tệ khi hiển thị. Cả năm chỉ dùng đối chiếu.
              </dd>
            </div>
            <div>
              <dt>Phạm vi dữ liệu</dt>
              <dd>
                Bảng giao dịch Raw và đối soát đầy đủ theo cửa hàng/ngày:{' '}
                {NO_DATA}
              </dd>
            </div>
          </dl>
          <p className="excel-reference-notice mx-4 mb-4">
            Các quy tắc xử lý Raw, trạng thái kiểm tra Flash và hồ sơ kế toán
            được giữ nguyên. Tắt xem thử để trở lại mô hình và bằng chứng của
            luồng Raw.
          </p>
        </div>
        <div className="excel-reference-footer">
          <Link
            className="text-primary underline underline-offset-2"
            to="/processing?sheet=Cau_noi"
          >
            Xem ba bảng nguồn
          </Link>
          <Link className="text-primary underline underline-offset-2" to="/">
            Xem cầu nối
          </Link>
        </div>
      </section>
      <ReferenceChecks {...props} />
    </div>
  )
}

export function ReferenceAccountingSummary(props: ReferenceViewProps) {
  const { workbook, period } = props
  const selected = selectExcelReference(workbook, period)
  const needsEvidence = selected.exceptions.filter((row) =>
    /chứng từ|evidence/i.test(row.status),
  )
  return (
    <div className="excel-reference-view viewport-workspace">
      <ReferenceHeading
        title="Rà soát kế toán"
        description="Các liên kết đang dùng kết quả tham chiếu Excel trong kỳ đã chọn."
      />
      <ReferencePeriodControl {...props} />
      <p className="excel-reference-notice">
        Hồ sơ, ghi chú, bằng chứng và quyết định thủ công của luồng Raw vẫn được
        giữ nguyên. Tắt xem thử để tiếp tục rà soát các hồ sơ thực tế.
      </p>
      <section className="excel-reference-panel">
        <div className="excel-reference-panel-heading">
          <h2>Thông tin kế toán trong file tham chiếu</h2>
          <span className="excel-reference-source">{workbook.fileName}</span>
        </div>
        <div className="excel-reference-scroll">
          <dl className="excel-reference-definitions">
            <div>
              <dt>Chưa giải thích trong kỳ</dt>
              <dd>{money(selected.unexplainedUSD)}</dd>
            </div>
            <div>
              <dt>Ngoại lệ trong kỳ</dt>
              <dd>
                {selected.exceptions.length} / {workbook.exceptions.length}{' '}
                ngoại lệ tham chiếu
              </dd>
            </div>
            <div>
              <dt>Chênh lệch số học cầu nối</dt>
              <dd>
                {money(selected.bridgeResidualUSD)} · Ngưỡng{' '}
                {money(workbook.toleranceUSD)}
              </dd>
            </div>
            <div>
              <dt>Trạng thái cần chứng từ trong Excel</dt>
              <dd>
                {needsEvidence.length
                  ? needsEvidence
                      .map((row) => `${row.id}: ${row.status}`)
                      .join(' · ')
                  : 'Không có ngoại lệ mang trạng thái cần chứng từ trong kỳ đã chọn.'}
              </dd>
            </div>
          </dl>
          <p className="excel-reference-notice mx-4 mb-4" data-warning="true">
            Cầu nối khớp về số học không có nghĩa đã đủ bằng chứng kế toán. Các
            ngoại lệ cần chứng từ vẫn giữ nguyên trạng thái Excel.
          </p>
          <p className="excel-reference-empty">
            Chi tiết hồ sơ và quyết định GL thực tế: {NO_DATA}
          </p>
        </div>
        <div className="excel-reference-footer">
          <Link
            className="inline-flex items-center gap-1 text-primary underline underline-offset-2"
            to="/exceptions"
          >
            Xem ngoại lệ tham chiếu <ArrowRight size={13} />
          </Link>
          <Link
            className="text-primary underline underline-offset-2"
            to="/processing?sheet=Chi_tiet"
          >
            Xem Chi_tiet
          </Link>
        </div>
      </section>
    </div>
  )
}
