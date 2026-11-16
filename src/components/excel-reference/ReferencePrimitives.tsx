/**
 * Building blocks shared by the Excel reference views: the view props contract,
 * headings, stat cards, the period selector, the paged source table and the
 * workbook arithmetic checks. Styles come from ./reference-views.css, which is
 * loaded by ./ReferenceViews.tsx.
 */
import { useMemo, useState, type ReactNode } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { InformationNote } from '@/components/PageInformation'
import {
  selectExcelReference,
  type ExcelReferenceWorkbook,
  type ReferenceSourceRow,
} from '@/lib/excel-reference'
import type { ReconciliationPeriod } from '@/lib/reconciliation-types'
import {
  cell,
  columnKind,
  money,
  monthEnd,
  sourceCell,
  statusTone,
} from './reference-format'

export interface ReferenceViewProps {
  workbook: ExcelReferenceWorkbook
  period: ReconciliationPeriod
  setPeriod?: (period: ReconciliationPeriod) => void
}
export type ReferenceSheetName = 'Cau_noi' | 'Nhat_ky_ngoai_le' | 'Chi_tiet'

export function ReferenceStat({
  label,
  value,
  hint,
  icon,
  tone = 'forest',
}: {
  label: string
  value: ReactNode
  hint: string
  icon: ReactNode
  tone?: string
}) {
  return (
    <article className="reference-stat" data-tone={tone} title={hint}>
      <div className="reference-stat-label">
        <span>{label}</span>
        <span className="reference-stat-icon" aria-hidden="true">
          {icon}
        </span>
      </div>
      <strong className="reference-stat-value">{value}</strong>
      <InformationNote title={label}>{hint}</InformationNote>
    </article>
  )
}

export function ReferenceHeading({
  title,
  description,
  icon,
}: {
  title: string
  description: string
  icon?: ReactNode
  eyebrow?: string
  showBadge?: boolean
}) {
  return (
    <header className="excel-reference-heading">
      <div className="reference-heading-title">
        {icon && (
          <span className="reference-heading-icon" aria-hidden="true">
            {icon}
          </span>
        )}
        <div>
          <h1>{title}</h1>
          <InformationNote title={title}>{description}</InformationNote>
        </div>
      </div>
    </header>
  )
}

export function ReferencePeriodControl({
  workbook,
  period,
  setPeriod,
}: ReferenceViewProps) {
  return (
    <div className="excel-reference-period">
      <CalendarDays
        size={17}
        className="reference-period-icon"
        aria-hidden="true"
      />
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
      <InformationNote title="Kỳ và đơn vị tham chiếu">
        {workbook.fileName}. Các giá trị tiền tệ đã là USD trong workbook, không
        quy đổi tỷ giá thêm. Chọn kỳ để lọc các tháng hiển thị.
      </InformationNote>
    </div>
  )
}

export function SourceTable({
  columns,
  rows,
  label,
  sheet,
}: {
  columns: string[]
  rows: ReferenceSourceRow[]
  label: string
  sheet?: ReferenceSheetName | 'manuals'
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
        <label className="reference-search-field">
          <Search size={16} aria-hidden="true" />
          <span className="sr-only">Tìm trong bảng</span>
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
        <span className="reference-table-count">
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
          <table
            className={`excel-reference-table reference-table-source reference-table-${sheet === 'Cau_noi' ? 'bridge' : sheet === 'Nhat_ky_ngoai_le' ? 'exceptions' : sheet === 'manuals' ? 'manuals' : 'details'}`}
          >
            <thead>
              <tr>
                <th className="reference-column-row" scope="col">
                  Dòng Excel
                </th>
                {columns.map((column) => (
                  <th
                    key={column}
                    scope="col"
                    className={`reference-column-${columnKind(column)}`}
                  >
                    {/^\d{4}-\d{2}$/.test(column)
                      ? `T${Number(column.slice(5))} / ${column.slice(0, 4)}`
                      : column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayed.map((row) => (
                <tr
                  key={row.sourceRow}
                  data-kind={'kind' in row ? String(row.kind) : undefined}
                >
                  <td
                    className="numeric reference-column-row"
                    title={`Dòng ${row.values.Source_Row ?? row.sourceRow} · ${row.values.Source_Sheet ?? sheet ?? 'sheet tham chiếu'}`}
                  >
                    {row.values.Source_Row ?? row.sourceRow}
                  </td>
                  {columns.map((column) => (
                    <td
                      key={column}
                      className={`reference-column-${columnKind(column)} ${typeof row.values[column] === 'number' ? 'numeric' : ''}`}
                      title={
                        row.values[column] == null
                          ? undefined
                          : String(row.values[column])
                      }
                    >
                      {column === 'Trạng thái' && row.values[column] ? (
                        <span
                          className={`excel-reference-status reference-status-${statusTone(String(row.values[column]))}`}
                        >
                          {sourceCell(row.values[column], column)}
                        </span>
                      ) : (
                        sourceCell(row.values[column], column)
                      )}
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
        <InformationNote title="Cách đọc bảng nguồn">
          Tiền tệ hiển thị 2 số lẻ · Rê chuột lên ô để xem giá trị gốc. Các cột
          USD dùng các cơ sở tính khác nhau và không được cộng lẫn.
        </InformationNote>
        <div>
          <Button
            variant="outline"
            size="sm"
            disabled={safePage === 0}
            onClick={() => setPage(safePage - 1)}
          >
            <ChevronLeft size={14} aria-hidden="true" />
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
            <ChevronRight size={14} aria-hidden="true" />
          </Button>
        </div>
      </div>
    </>
  )
}

export function ReferenceChecks({ workbook, period }: ReferenceViewProps) {
  const selected = selectExcelReference(workbook, period)
  return (
    <InformationNote title="Kiểm tra số liệu và nguồn workbook">
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
    </InformationNote>
  )
}
