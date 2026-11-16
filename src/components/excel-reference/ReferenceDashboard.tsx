/**
 * Legacy Excel reference dashboard. It is not rendered anywhere: the Dashboard
 * page uses components/dashboard/DashboardSuite for both Raw and Excel results.
 * Kept and re-exported from ./ReferenceViews for backward compatibility; listed
 * as a cleanup candidate in docs/REFACTORING_REPORT.md.
 */
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Table2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  referenceDetailsFor,
  selectExcelReference,
} from '@/lib/excel-reference'
import { money, NO_DATA } from './reference-format'
import {
  ReferenceChecks,
  ReferenceHeading,
  ReferencePeriodControl,
  SourceTable,
  type ReferenceViewProps,
} from './ReferencePrimitives'

const kindLabel = {
  sales: 'Tổng Sales Flash',
  adjustment: 'Điều chỉnh',
  bridge_total: 'Tổng cầu nối',
  finance: 'Tổng Finance',
  check: 'Kiểm tra',
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
