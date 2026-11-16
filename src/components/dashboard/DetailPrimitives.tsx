/**
 * Building blocks of the Detail and Quality dashboard tabs: missing-data note,
 * metric card, locally paged table and monthly trend chart. The DataTable here
 * is distinct from the overview DataTable in ./DashboardPrimitives (different
 * props, paging and default sort), so the two are not interchangeable.
 */
import { useMemo, useState, type ReactNode } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ArrowDownUp, ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { InformationNote } from '@/components/PageInformation'
import { useDashboardWidgetExpanded } from './DashboardWidgets'
import { compact } from '@/lib/dashboard-format'
import { count, monthLabel, money, ratio } from './detail-format'

export function Missing({ children }: { children: ReactNode }) {
  return (
    <div className="dash-empty" role="status">
      <strong>Chưa có dữ liệu để tính</strong>
      <p>{children}</p>
    </div>
  )
}
export function Metric({
  label,
  value,
  description,
  unit,
}: {
  label: string
  value: string
  description: string
  unit?: string
}) {
  return (
    <section className="dash-kpi" aria-label={label} title={description}>
      <h3>{label}</h3>
      <p className="financial-value">
        {value} {unit && <small>{unit}</small>}
      </p>
      <InformationNote title={label}>{description}</InformationNote>
    </section>
  )
}
export type Column<Row> = {
  key: string
  label: string
  value: (row: Row) => string | number | null
  render?: (row: Row) => ReactNode
  numeric?: boolean
}
/** Locally paged tables never re-run the reconciliation processor. */
export function DataTable<Row extends { id: string }>({
  label,
  rows,
  columns,
  onSelect,
  empty,
}: {
  label: string
  rows: Row[]
  columns: Column<Row>[]
  onSelect?: (row: Row) => void
  empty: ReactNode
}) {
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState({ key: columns[0]?.key, ascending: true })
  const [page, setPage] = useState(0)
  const filtered = useMemo(() => {
    const tokens = query.toLocaleLowerCase('vi').trim().split(/\s+/)
    const column = columns.find((item) => item.key === sort.key)
    return rows
      .filter((row) => {
        const text = columns
          .map((item) => String(item.value(row) ?? ''))
          .join(' ')
          .toLocaleLowerCase('vi')
        return tokens.every((token) => text.includes(token))
      })
      .sort((left, right) => {
        const a = column?.value(left)
        const b = column?.value(right)
        const comparison =
          typeof a === 'number' && typeof b === 'number'
            ? a - b
            : String(a ?? '').localeCompare(String(b ?? ''), 'vi')
        return comparison * (sort.ascending ? 1 : -1)
      })
  }, [rows, columns, query, sort])
  const lastPage = Math.max(0, Math.ceil(filtered.length / 20) - 1)
  const currentPage = Math.min(page, lastPage)
  return (
    <>
      <div className="dash-table-tools">
        <label className="dash-search">
          <Search size={14} aria-hidden="true" />
          <input
            data-tour="dashboard-detail-search"
            aria-label={`Tìm trong ${label}`}
            value={query}
            placeholder="Tìm kiếm…"
            onChange={(event) => {
              setQuery(event.target.value)
              setPage(0)
            }}
          />
        </label>
        <span>{count(filtered.length)} dòng</span>
      </div>
      <div className="dash-table-scroll" tabIndex={0} aria-label={label}>
        <table className="dash-table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={column.numeric ? 'dash-number' : undefined}
                  aria-sort={
                    sort.key === column.key
                      ? sort.ascending
                        ? 'ascending'
                        : 'descending'
                      : 'none'
                  }
                >
                  <button
                    onClick={() =>
                      setSort({
                        key: column.key,
                        ascending:
                          sort.key === column.key ? !sort.ascending : true,
                      })
                    }
                    title={`Sắp xếp theo ${column.label}`}
                  >
                    {column.label} <ArrowDownUp size={11} aria-hidden="true" />
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered
              .slice(currentPage * 20, (currentPage + 1) * 20)
              .map((row) => (
                <tr key={row.id} data-tour={`dashboard-detail-row-${row.id}`}>
                  {columns.map((column, index) => (
                    <td
                      key={column.key}
                      data-label={column.label}
                      className={column.numeric ? 'dash-number' : undefined}
                    >
                      {index === 0 && onSelect ? (
                        <button
                          className="dash-text-button"
                          onClick={() => onSelect(row)}
                        >
                          {column.render?.(row) ?? column.value(row)}
                        </button>
                      ) : (
                        (column.render?.(row) ?? column.value(row) ?? '—')
                      )}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
        {!filtered.length && (
          <div className="dash-empty">
            {rows.length ? 'Không có dòng phù hợp tìm kiếm.' : empty}
          </div>
        )}
      </div>
      {lastPage > 0 && (
        <div className="dash-pagination">
          <button
            aria-label={`Trang trước của ${label}`}
            disabled={currentPage === 0}
            onClick={() => setPage(currentPage - 1)}
          >
            <ChevronLeft size={14} />
          </button>
          <span>
            Trang {currentPage + 1} / {lastPage + 1}
          </span>
          <button
            aria-label={`Trang sau của ${label}`}
            disabled={currentPage === lastPage}
            onClick={() => setPage(currentPage + 1)}
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </>
  )
}

export function TrendChart<Row extends { month: string }>({
  rows,
  series,
  percent = false,
  bars = false,
  onMonth,
}: {
  rows: Row[]
  series: { key: string; label: string; color: string }[]
  percent?: boolean
  bars?: boolean
  onMonth: (month: string) => void
}) {
  const expanded = useDashboardWidgetExpanded()
  const chartChildren = (
    <>
      <CartesianGrid vertical={false} stroke="#e7ecf0" strokeDasharray="3 4" />
      <XAxis
        dataKey="month"
        tickFormatter={monthLabel}
        tick={{ fontSize: expanded ? 13 : 11 }}
        tickLine={false}
        axisLine={false}
      />
      <YAxis
        width={expanded ? 92 : 64}
        tick={{ fontSize: expanded ? 13 : 11 }}
        tickFormatter={(value: number) =>
          percent ? `${compact(value * 100)}%` : compact(value)
        }
        tickLine={false}
        axisLine={false}
      />
      <Tooltip
        allowEscapeViewBox={{ x: false, y: false }}
        wrapperStyle={{
          maxWidth: 'min(360px, 85vw)',
          whiteSpace: 'normal',
          zIndex: 5,
        }}
        contentStyle={{
          fontSize: expanded ? 13 : 12,
          maxWidth: 'min(360px, 85vw)',
          overflowWrap: 'anywhere',
          borderRadius: 8,
        }}
        labelFormatter={(label) => monthLabel(String(label))}
        formatter={(value) =>
          percent
            ? ratio(Number(value))
            : `${money(Number(value))}${bars ? ' đơn' : ' USD'}`
        }
      />
      <Legend wrapperStyle={{ fontSize: expanded ? 13 : 11 }} />
      {series.map((item) =>
        bars ? (
          <Bar
            key={item.key}
            dataKey={item.key}
            name={item.label}
            fill={item.color}
            radius={[3, 3, 0, 0]}
            maxBarSize={30}
            isAnimationActive={false}
          />
        ) : (
          <Line
            key={item.key}
            dataKey={item.key}
            name={item.label}
            stroke={item.color}
            strokeWidth={2}
            dot={{ r: 2 }}
            activeDot={{ r: 4 }}
            connectNulls={false}
            isAnimationActive={false}
          />
        ),
      )}
    </>
  )
  return (
    <>
      <div className="dash-chart">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          {bars ? (
            <BarChart
              data={rows}
              onClick={(state) => {
                if (state.activeLabel != null)
                  onMonth(String(state.activeLabel))
              }}
              margin={{ top: 8, left: 0, right: 12, bottom: 0 }}
              accessibilityLayer
            >
              {chartChildren}
            </BarChart>
          ) : (
            <LineChart
              data={rows}
              onClick={(state) => {
                if (state.activeLabel != null)
                  onMonth(String(state.activeLabel))
              }}
              margin={{ top: 8, left: 0, right: 12, bottom: 0 }}
              accessibilityLayer
            >
              {chartChildren}
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
      <label className="dash-chart-detail-select">
        Xem dữ liệu
        <span className="sr-only">Chọn kỳ để xem chi tiết</span>
        <select
          aria-label="Xem dữ liệu biểu đồ theo kỳ"
          value=""
          onChange={(event) => {
            if (event.target.value) onMonth(event.target.value)
          }}
        >
          <option value="">Xem chi tiết kỳ/ngày…</option>
          {rows.map((row) => (
            <option key={row.month} value={row.month}>
              {monthLabel(row.month)}
            </option>
          ))}
        </select>
      </label>
    </>
  )
}
