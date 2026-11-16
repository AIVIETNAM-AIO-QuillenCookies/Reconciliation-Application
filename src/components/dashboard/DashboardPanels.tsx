/** Overview panels of the dashboard suite: the bridge/channel × month matrix and the data-source chip. */
import { Database, FileSpreadsheet, Info } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import type { DashboardModel } from '@/lib/dashboard-model'
import { money, shortMonth } from '@/lib/dashboard-format'
import { sumReferenceUSD } from '@/lib/excel-reference'
import { EmptyWidget, type InspectSelection } from './DashboardPrimitives'

export function Matrix({
  model,
  bridge,
  onSelect,
  onBridgeSelect,
}: {
  model: DashboardModel
  bridge?: boolean
  onSelect: (selection: InspectSelection) => void
  onBridgeSelect?: (row: DashboardModel['bridge'][number]) => void
}) {
  const rows = bridge
    ? model.bridge.map((row) => ({ ...row, totalUSD: row.amountUSD }))
    : model.matrix
  const fullYear =
    model.months.length === 12 &&
    model.months[0].endsWith('-01') &&
    model.months.at(-1) === `${model.months[0].slice(0, 4)}-12`
  return (
    <div
      className="dash-table-scroll dash-matrix"
      tabIndex={0}
      role="region"
      aria-label={
        bridge
          ? fullYear
            ? 'Ma trận cầu nối 12 tháng và cả năm'
            : 'Ma trận cầu nối theo tháng và toàn kỳ nguồn'
          : 'Ma trận doanh thu theo kênh và tháng'
      }
    >
      <table className="dash-table">
        <thead>
          <tr>
            <th>Khoản mục / USD</th>
            {model.months.map((month) => (
              <th
                key={month}
                className={`dash-number ${model.selectedMonths.includes(month) ? 'dash-selected-month' : ''}`}
              >
                {shortMonth(month)}
                <small>{month.slice(0, 4)}</small>
              </th>
            ))}
            <th className="dash-number">
              {fullYear ? 'Cả năm' : 'Toàn kỳ nguồn'}
            </th>
            <th className="dash-number">Kỳ chọn</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                <button
                  data-tour={
                    bridge
                      ? `dashboard-bridge-row-${row.id}`
                      : `dashboard-matrix-row-${row.id}`
                  }
                  className="dash-text-button"
                  onClick={() => {
                    const sourceRow = bridge
                      ? model.bridge.find((item) => item.id === row.id)
                      : null
                    if (sourceRow && onBridgeSelect) {
                      onBridgeSelect(sourceRow)
                      return
                    }
                    onSelect({
                      title: row.label,
                      description:
                        'Giá trị theo tháng · USD. Ô — là dữ liệu chưa có, không phải giá trị 0.',
                      rows: model.months.map((month) => ({
                        Tháng: month,
                        'Giá trị USD': row.monthly[month] ?? null,
                      })),
                    })
                  }}
                >
                  {row.label}
                </button>
              </td>
              {model.months.map((month) => (
                <td
                  key={month}
                  className={`dash-number ${model.selectedMonths.includes(month) ? 'dash-selected-month' : ''}`}
                  title={`${row.label} · ${month} · ${money(row.monthly[month])} USD`}
                >
                  {money(row.monthly[month])}
                </td>
              ))}
              <td className="dash-number">
                {model.months.length > 0 &&
                model.months.every((month) => row.monthly[month] != null)
                  ? money(
                      sumReferenceUSD(
                        model.months.map((month) => row.monthly[month]!),
                      ),
                    )
                  : '—'}
              </td>
              <td className="dash-number">
                <strong>{money(row.totalUSD)}</strong>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && (
        <EmptyWidget>
          Chưa có bảng tổng hợp tháng. Nhập nguồn hoặc mở workbook Excel tham
          chiếu.
        </EmptyWidget>
      )}
    </div>
  )
}

export function SourcePanel({
  onInspect,
  notes,
}: {
  onInspect: (selection: InspectSelection) => void
  notes: string[]
}) {
  const store = useAppStore()
  const active = store.activeResult
  const open = () => {
    if (active.source === 'excel')
      onInspect({
        title: 'Thông tin dữ liệu · Nguồn Excel tham chiếu',
        panel: 'source',
        description: `${active.workbook.fileName} · Phiên xem thử trong tab này. USD giữ nguyên từ workbook, cộng theo tháng; không quy đổi FX thêm. Δ = GL − Flash; Δ% = Δ / Flash.`,
        rows: [
          ...Object.values(active.workbook.sheets).map((sheet) => ({
            File: active.workbook.fileName,
            Sheet: sheet.name,
            'Số dòng': sheet.rows.length,
            'Các trường': sheet.columns.join(', '),
          })),
          ...notes.map((note) => ({ 'Lưu ý dữ liệu': note })),
        ],
        links: [{ label: 'Mở quy tắc và mô hình dữ liệu', to: '/methodology' }],
      })
    else
      onInspect({
        title: 'Thông tin dữ liệu · Nguồn pipeline Raw',
        panel: 'source',
        description: `Phiên: ${active.result?.evidence?.runId ?? 'chưa có kết quả'}. ${active.result?.period.start ?? active.period.start} → ${active.result?.period.end ?? active.period.end}. Giá trị đã chuẩn hóa theo cấu hình của phiên; Δ = GL − Flash. Lọc dashboard chỉ đọc snapshot và không chạy lại pipeline.`,
        rows: [
          ...(active.result?.evidence?.files.map((file) => ({
            File: file.fileName,
            Nguồn: file.source,
            'Dòng tiêu đề': file.headerRow,
            'Ánh xạ': JSON.stringify(file.columns),
            'Ghi chú': file.notes.join('; '),
          })) ??
            store.files.map((file) => ({
              File: file.file.name,
              Nguồn: file.source,
              'Dòng tiêu đề': file.headerRow ?? 1,
            }))),
          ...notes.map((note) => ({ 'Lưu ý dữ liệu': note })),
        ],
        links: [
          { label: 'Xem quy tắc và bảng dữ liệu nguồn', to: '/methodology' },
          { label: 'Xem cấu hình nhập dữ liệu', to: '/ingestion' },
        ],
      })
  }
  return (
    <button
      data-tour="dashboard-source"
      className={`dash-source-chip ${active.source === 'excel' ? 'is-excel' : ''}`}
      onClick={open}
      title="Thông tin dữ liệu · file, sheet, phiên xử lý và các lưu ý"
      aria-label={
        active.source === 'excel'
          ? 'Thông tin dữ liệu: Excel tham chiếu'
          : 'Thông tin dữ liệu: Raw'
      }
    >
      {active.source === 'excel' ? (
        <FileSpreadsheet size={13} />
      ) : (
        <Database size={13} />
      )}
      <span>
        {active.source === 'excel' ? 'Excel tham chiếu' : 'Web tính toán · Raw'}
      </span>
      <Info size={12} />
    </button>
  )
}
