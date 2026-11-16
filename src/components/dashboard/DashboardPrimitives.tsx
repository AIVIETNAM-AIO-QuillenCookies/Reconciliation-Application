import { useMemo, useState, type ReactNode } from 'react'
import {
  ArrowDownUp,
  ChevronLeft,
  ChevronRight,
  Database,
  Search,
} from 'lucide-react'
import { InformationNote } from '@/components/PageInformation'

export interface InspectSelection {
  panel?: 'source' | 'insights'
  title: string
  description: string
  rows: Record<string, unknown>[]
  links?: { label: string; to: string }[]
}

export function EmptyWidget({ children }: { children: ReactNode }) {
  return (
    <div className="dash-empty">
      <Database size={21} aria-hidden="true" />
      <p>{children}</p>
    </div>
  )
}

export function Kpi({
  label,
  value,
  note,
  tone = 'teal',
  unit = 'USD',
}: {
  label: string
  value: string
  note: string
  tone?: string
  unit?: string
}) {
  return (
    <section
      className={`dash-kpi dash-tone-${tone}`}
      aria-label={label}
      title={`${label}: ${value} ${unit}. ${note}`}
    >
      <h2>
        {label}
        <span>{unit}</span>
      </h2>
      <strong className="financial-value">{value}</strong>
      <InformationNote title={label}>{note}</InformationNote>
    </section>
  )
}

export interface DataColumn<T> {
  key: string
  label: string
  value: (row: T) => string | number | null
  render?: (row: T) => ReactNode
  numeric?: boolean
}

export function DataTable<T>({
  rows,
  columns,
  label,
  onSelect,
  pageSize = 8,
}: {
  rows: T[]
  columns: DataColumn<T>[]
  label: string
  onSelect?: (row: T) => void
  pageSize?: number
}) {
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState({ key: '', ascending: false })
  const [page, setPage] = useState(0)
  const filtered = useMemo(() => {
    const tokens = query
      .trim()
      .toLocaleLowerCase('vi')
      .split(/\s+/)
      .filter(Boolean)
    const result = rows.filter((row) =>
      tokens.every((token) =>
        columns
          .map((c) => c.value(row))
          .join(' ')
          .toLocaleLowerCase('vi')
          .includes(token),
      ),
    )
    const col = columns.find((c) => c.key === sort.key)
    if (col)
      result.sort((a, b) => {
        const x = col.value(a),
          y = col.value(b)
        return (
          (typeof x === 'number' && typeof y === 'number'
            ? x - y
            : String(x ?? '').localeCompare(String(y ?? ''), 'vi', {
                numeric: true,
              })) * (sort.ascending ? 1 : -1)
        )
      })
    return result
  }, [rows, columns, query, sort])
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, pages - 1)
  return (
    <div className="dash-data-table">
      <div className="dash-table-tools">
        <label>
          <Search size={13} aria-hidden="true" />
          <input
            aria-label={`Tìm trong ${label}`}
            placeholder="Tìm kiếm…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setPage(0)
            }}
          />
        </label>
        <span>{filtered.length.toLocaleString('vi-VN')} dòng</span>
      </div>
      <div
        className="dash-table-scroll"
        tabIndex={0}
        role="region"
        aria-label={label}
      >
        <table className="dash-table">
          <thead>
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={c.numeric ? 'dash-number' : ''}
                  aria-sort={
                    sort.key === c.key
                      ? sort.ascending
                        ? 'ascending'
                        : 'descending'
                      : 'none'
                  }
                >
                  <button
                    onClick={() => {
                      setSort({
                        key: c.key,
                        ascending: sort.key === c.key ? !sort.ascending : true,
                      })
                      setPage(0)
                    }}
                  >
                    {c.label}
                    <ArrowDownUp size={11} aria-hidden="true" />
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered
              .slice(currentPage * pageSize, (currentPage + 1) * pageSize)
              .map((row, i) => (
                <tr
                  key={i}
                  onClick={onSelect ? () => onSelect(row) : undefined}
                  className={onSelect ? 'dash-clickable' : ''}
                >
                  {columns.map((c, index) => (
                    <td
                      key={c.key}
                      data-label={c.label}
                      className={c.numeric ? 'dash-number' : ''}
                    >
                      {onSelect && index === 0 ? (
                        <button
                          className="dash-text-button"
                          onClick={(e) => {
                            e.stopPropagation()
                            onSelect(row)
                          }}
                        >
                          {c.render?.(row) ?? c.value(row) ?? '—'}
                        </button>
                      ) : (
                        (c.render?.(row) ?? c.value(row) ?? '—')
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            {!filtered.length && (
              <tr>
                <td colSpan={columns.length}>
                  Không có dòng phù hợp với bộ lọc.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="dash-table-footer">
        <span>
          Trang {currentPage + 1}/{pages}
        </span>
        <button
          aria-label={`Trang trước ${label}`}
          disabled={!currentPage}
          onClick={() => setPage(currentPage - 1)}
        >
          <ChevronLeft size={14} />
        </button>
        <button
          aria-label={`Trang sau ${label}`}
          disabled={currentPage + 1 >= pages}
          onClick={() => setPage(currentPage + 1)}
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  )
}
