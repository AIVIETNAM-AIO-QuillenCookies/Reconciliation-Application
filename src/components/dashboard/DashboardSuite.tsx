import { useMemo, useState } from 'react'
import { Popover } from 'radix-ui'
import { Link, useSearchParams } from 'react-router-dom'
import {
  ArrowRight,
  BookOpen,
  ChevronDown,
  Database,
  FileSpreadsheet,
  Info,
  LoaderCircle,
  RotateCcw,
  SlidersHorizontal,
  UploadCloud,
  X,
} from 'lucide-react'
import { useAppStore } from '@/lib/store'
import {
  buildDashboardModel,
  type DashboardFilters,
  type DashboardModel,
} from '@/lib/dashboard-model'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '@/components/ui/sheet'
import { LocalizedError } from '@/components/LocalizedError'
import {
  DashboardWaterfall,
  ImpactRanking,
  RevenueTrend,
  VarianceChart,
} from './DashboardCharts'
import {
  DataTable,
  EmptyWidget,
  Kpi,
  type InspectSelection,
} from './DashboardPrimitives'
import { money, percent, shortMonth } from '@/lib/dashboard-format'
import { DetailTab, QualityTab } from './DetailQualityTabs'
import { sumReferenceUSD } from '@/lib/excel-reference'
import {
  DashboardWidget,
  DashboardWidgetProvider,
  useDashboardWidgets,
} from './DashboardWidgets'
import '@/dashboard-suite.css'
import '@/dashboard-ux.css'

const tabLabels = {
  overview: 'Tổng quan',
  bridge: 'Cầu nối chênh lệch',
  detail: 'Đối soát chi tiết',
  quality: 'Hoàn trả & chất lượng',
}
type DashboardTab = keyof typeof tabLabels
const channelLabels: Record<string, string> = {
  ALL: 'Tất cả kênh',
  STORE: 'Cửa hàng · POS',
  WEB: 'Online · WEB',
  UNALLOCATED: 'Chưa phân bổ',
}

function summaryBridge(
  rows: DashboardModel['bridge'],
): DashboardModel['bridge'] {
  const first = rows.find((row) => row.kind === 'sales')
  const last = rows.find((row) => row.kind === 'finance')
  if (!first || !last) return []
  let running = first.amountUSD
  const groups = (
    ['rule', 'error', 'rounding', 'unexplained'] as const
  ).flatMap((category) => {
    const children = rows.filter((row) => row.category === category)
    if (!children.length) return []
    const amountUSD = sumReferenceUSD(children.map((row) => row.amountUSD))
    const startUSD = running
    running = sumReferenceUSD([running, amountUSD])
    return [
      {
        id: `group-${category}`,
        label: {
          rule: 'Quy tắc ghi nhận',
          error: 'Lỗi dữ liệu',
          rounding: 'Làm tròn',
          unexplained: 'Chưa giải thích',
        }[category],
        kind: 'adjustment' as const,
        category,
        amountUSD,
        startUSD,
        endUSD: running,
        monthly: Object.fromEntries(
          Object.keys(first.monthly).map((month) => [
            month,
            sumReferenceUSD(children.map((row) => row.monthly[month] ?? 0)),
          ]),
        ),
        sourceRows: children.flatMap((row) => row.sourceRows),
        detailCodes: children.flatMap((row) => row.detailCodes),
        sourceRowsTruncated: children.some((row) => row.sourceRowsTruncated),
        detailCount: children.reduce(
          (sum, row) => sum + (row.detailCount ?? 0),
          0,
        ),
      },
    ]
  })
  return [first, ...groups, last]
}

function Matrix({
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

function SourcePanel({
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

export function Dashboard() {
  const store = useAppStore()
  const [params] = useSearchParams()
  const active = store.activeResult
  return (
    <DashboardWidgetProvider
      sourceLabel={
        active.source === 'excel' ? 'Excel tham chiếu' : 'Web tính toán · Raw'
      }
      periodLabel={`${params.get('from') ?? active.period.start.slice(0, 7)} → ${params.get('to') ?? active.period.end.slice(0, 7)} · USD`}
      identity={active.source === 'excel' ? active.workbook : active.result}
    >
      <DashboardWorkspace />
    </DashboardWidgetProvider>
  )
}

function DashboardWorkspace() {
  const store = useAppStore()
  const { closeExpanded } = useDashboardWidgets()
  const active = store.activeResult
  const [params, setParams] = useSearchParams()
  const rawResult = active.source === 'raw' ? active.result : null
  const referenceWorkbook = active.source === 'excel' ? active.workbook : null
  const sourceIdentity = rawResult ?? referenceWorkbook
  const [inspectionState, setInspectionState] = useState<{
    selection: InspectSelection
    sourceIdentity: typeof sourceIdentity
  } | null>(null)
  const inspection =
    inspectionState?.sourceIdentity === sourceIdentity
      ? (inspectionState?.selection ?? null)
      : null
  const setInspection = (selection: InspectSelection | null) => {
    if (selection) closeExpanded()
    setInspectionState(selection ? { selection, sourceIdentity } : null)
  }
  const basePeriod =
    active.source === 'excel'
      ? active.period
      : (active.result?.period ?? active.period)
  const tab = (
    Object.hasOwn(tabLabels, params.get('tab') ?? '')
      ? params.get('tab')
      : 'overview'
  ) as DashboardTab
  const startMonth = params.get('from') ?? basePeriod.start.slice(0, 7)
  const endMonth = params.get('to') ?? basePeriod.end.slice(0, 7)
  const channel = Object.hasOwn(channelLabels, params.get('channel') ?? '')
    ? (params.get('channel') as DashboardFilters['channel'])
    : 'ALL'
  const country = params.get('country') ?? 'ALL'
  const filters = useMemo<DashboardFilters>(
    () => ({ startMonth, endMonth, channel, country }),
    [startMonth, endMonth, channel, country],
  )
  const model = useMemo(
    () =>
      buildDashboardModel({
        source: active.source,
        result: rawResult,
        workbook: referenceWorkbook,
        filters,
      }),
    [active.source, rawResult, referenceWorkbook, filters],
  )
  const update = (patch: Record<string, string | null>) => {
    if (patch.tab) closeExpanded()
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(patch)) {
      if (value == null) next.delete(key)
      else next.set(key, value)
    }
    setParams(next, { replace: true })
    setInspection(null)
  }
  const reset = () =>
    update({ from: null, to: null, channel: null, country: null })
  const inspectMonth = (month: string) => {
    const row = model.monthly.find((item) => item.month === month)
    update({ from: month, to: month })
    if (row)
      setInspection({
        title: `Đối soát tháng ${month}`,
        description:
          'Bộ lọc tháng đã được cập nhật trên cả bốn tab. Δ = GL − Flash; tỷ lệ = Δ / Flash. Dữ liệu chưa có được hiển thị —.',
        rows: [
          {
            Tháng: month,
            'Sales Flash USD': row.flashUSD,
            'GL USD': row.glUSD,
            'Δ USD': row.deltaUSD,
            'Δ%': percent(row.deltaRatio),
            'Lỗi dữ liệu USD': row.dataErrorsUSD,
            'Chưa giải thích USD': row.unexplainedUSD,
          },
          ...model.bridge
            .filter((item) => item.kind === 'adjustment')
            .map((item) => ({
              'Khoản mục': item.label,
              USD: item.monthly[month] ?? null,
            })),
        ],
      })
  }
  const inspectBridge = (row: DashboardModel['bridge'][number]) =>
    setInspection({
      title: row.label,
      description: `${money(row.amountUSD)} USD trong kỳ chọn. ${row.category === 'rule' ? 'Khác biệt do quy tắc ghi nhận; không tự là lỗi dữ liệu.' : row.category === 'error' ? 'Ảnh hưởng lỗi dữ liệu đã phân loại.' : row.category === 'unexplained' ? 'Phần dư chưa được giải thích bằng các điều chỉnh.' : 'Giá trị thuộc cầu nối Flash → GL.'} Lũy kế ${money(row.startUSD)} → ${money(row.endUSD)} USD. ${row.sourceRowsTruncated ? `Mẫu truy vết có giới hạn; bảng nguồn có ${row.detailCount ?? 'nhiều'} dòng. Tổng được tính từ toàn bộ dữ liệu.` : ''}`,
      rows: [
        ...model.months.map((month) => ({
          Tháng: month,
          USD: row.monthly[month] ?? null,
        })),
        ...row.sourceRows.map((source) => ({
          File: source.fileName,
          'Sheet / bảng': source.sheetName,
          'Bảng tính toán': source.sourceTable,
          'Dòng nguồn': source.sourceRow,
          'Thứ tự bản ghi': source.sourceRecord,
          Tháng: source.month,
          'Mã giao dịch': source.transactionId,
          USD: source.amountUSD,
          'Diễn giải': source.description,
        })),
      ],
      links:
        active.source === 'excel'
          ? [
              {
                label: 'Xem nhật ký Excel cùng kỳ',
                to: `/exceptions?${new URLSearchParams({ from: filters.startMonth, to: filters.endMonth, returnTo: `/?${params}` })}`,
              },
            ]
          : [{ label: 'Xem dữ liệu nguồn và quy tắc', to: '/methodology' }],
    })
  const values = model.totals
  const isLoading = active.source === 'raw' && store.isProcessing
  const hasResults = model.available
  return (
    <div className="dashboard-suite" data-dashboard-source={active.source}>
      <header className="dash-page-heading">
        <div>
          <h1>Dashboard đối soát</h1>
        </div>
        <div className="dash-heading-actions">
          <SourcePanel onInspect={setInspection} notes={model.filterNotes} />
          {active.source === 'excel' && (
            <Button
              variant="ghost"
              size="sm"
              className="dash-exit-preview"
              onClick={store.disableExcelReference}
            >
              Tắt xem thử · Raw
            </Button>
          )}
          <Button size="sm" onClick={store.openOnboarding}>
            <UploadCloud size={14} />
            Nhập dữ liệu
          </Button>
        </div>
      </header>
      <section
        className="dash-filters"
        aria-label="Bộ lọc dùng chung dashboard"
      >
        <SlidersHorizontal size={15} aria-hidden="true" />
        <label>
          Từ tháng
          <select
            aria-label="Từ tháng"
            value={filters.startMonth}
            onChange={(e) =>
              update({
                from: e.target.value,
                to:
                  e.target.value > filters.endMonth
                    ? e.target.value
                    : filters.endMonth,
              })
            }
          >
            {!model.months.includes(filters.startMonth) && (
              <option value={filters.startMonth}>
                {filters.startMonth} · chưa có dữ liệu
              </option>
            )}
            {model.months.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </label>
        <label>
          Đến tháng
          <select
            aria-label="Đến tháng"
            value={filters.endMonth}
            onChange={(e) =>
              update({
                to: e.target.value,
                from:
                  e.target.value < filters.startMonth
                    ? e.target.value
                    : filters.startMonth,
              })
            }
          >
            {!model.months.includes(filters.endMonth) && (
              <option value={filters.endMonth}>
                {filters.endMonth} · chưa có dữ liệu
              </option>
            )}
            {model.months.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </label>
        <label>
          Kênh
          <select
            aria-label="Kênh"
            value={filters.channel}
            onChange={(e) => update({ channel: e.target.value })}
          >
            {['ALL', 'STORE', 'WEB', 'UNALLOCATED'].map((c) => (
              <option key={c} value={c}>
                {channelLabels[c]}
              </option>
            ))}
          </select>
        </label>
        <Popover.Root>
          <Popover.Trigger asChild>
            <button className="dash-more-filters">
              Bộ lọc khác
              <ChevronDown size={13} />
            </button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              className="dash-filter-popover"
              sideOffset={8}
              align="end"
            >
              <strong>Bộ lọc bổ sung</strong>
              <label
                title={
                  model.countries.length
                    ? 'Chỉ áp dụng nơi có phân bổ quốc gia được xác minh'
                    : 'Chưa có phân bổ quốc gia đáng tin cậy cho toàn bộ chỉ tiêu'
                }
              >
                Quốc gia
                <select
                  aria-label="Quốc gia"
                  disabled={!model.countries.length}
                  value={filters.country}
                  onChange={(e) => update({ country: e.target.value })}
                >
                  <option value="ALL">
                    {model.countries.length
                      ? 'Tất cả quốc gia'
                      : 'Chưa có phân bổ'}
                  </option>
                  {model.countries.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <p>
                Quốc gia chỉ áp dụng khi có phân bổ đáng tin cậy cho toàn bộ
                phạm vi chỉ tiêu.
              </p>
              <Popover.Close asChild>
                <button className="dash-text-button">Đóng bộ lọc</button>
              </Popover.Close>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
        <button className="dash-reset" onClick={reset}>
          <RotateCcw size={13} />
          Đặt lại
        </button>
        <span className="dash-scope">
          USD · {filters.startMonth} → {filters.endMonth}
        </span>
      </section>
      {isLoading && (
        <div className="dash-status" role="status">
          <LoaderCircle size={15} className="motion-safe:animate-spin" />
          Đang xử lý dữ liệu. Snapshot mới sẽ hiển thị khi phiên hoàn tất.
        </div>
      )}
      {active.source === 'raw' && store.status === 'error' && (
        <div className="dash-status is-error" role="alert">
          <LocalizedError message={store.error} />
          <Button variant="outline" size="sm" onClick={store.retry}>
            Thử lại
          </Button>
          <Link to="/processing">Xem chẩn đoán</Link>
        </div>
      )}
      <Tabs
        value={tab}
        onValueChange={(value) => update({ tab: value })}
        className="dash-tabs"
      >
        <TabsList aria-label="Các trang dashboard" className="dash-tab-list">
          {Object.entries(tabLabels).map(([id, label], index) => (
            <TabsTrigger value={id} key={id}>
              <span className="dash-tab-number">0{index + 1}</span>
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
        <section className="dash-insights" aria-label="Điểm chính">
          <div>
            <span className="dash-insight-dot" />
            <h2>Điểm chính</h2>
          </div>
          <p className="dash-insight-summary" title={model.insights[0]}>
            {model.insights[0]}
          </p>
          <button
            onClick={() =>
              setInspection({
                title: 'Điểm chính',
                panel: 'insights',
                description: 'Nhận xét tính từ nguồn và bộ lọc hiện tại.',
                rows: model.insights.map((text, index) => ({
                  STT: index + 1,
                  'Nhận xét': text,
                })),
                links: [],
              })
            }
          >
            Xem thêm
            <ChevronDown size={13} />
          </button>
        </section>
        {!hasResults &&
          !isLoading &&
          (active.source === 'excel' || !!active.result) && (
            <div className="dash-onboarding" role="status">
              <Info size={22} />
              <div>
                <strong>Không có tháng trong phạm vi nguồn đã chọn</strong>
                <p>
                  Nguồn hiện tại chưa có dữ liệu cho bộ lọc này. Đặt lại để xem
                  toàn kỳ của nguồn.
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={reset}>
                Đặt lại bộ lọc
              </Button>
            </div>
          )}
        {!hasResults &&
          !isLoading &&
          active.source === 'raw' &&
          !active.result && (
            <div className="dash-onboarding">
              <Database size={25} />
              <div>
                <strong>Sẵn sàng kết nối doanh số với sổ cái</strong>
                <p>
                  Nhập POS, WEB, GL và Sales Flash hoặc mở Excel tham chiếu để
                  khám phá dashboard.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void store.loadExcelReference()}
              >
                Xem thử Excel
                <ArrowRight size={13} />
              </Button>
            </div>
          )}
        <TabsContent value="overview" className="dash-tab-content">
          <div className="dash-kpis">
            <Kpi
              label="Doanh số Sales Flash"
              value={money(values.flashUSD)}
              note="Doanh số theo kỳ đã chọn"
            />
            <Kpi
              label="Doanh thu GL"
              value={money(values.glUSD)}
              note="Doanh thu đã ghi sổ"
              tone="navy"
            />
            <Kpi
              label="Chênh lệch GL − Flash"
              value={money(values.deltaUSD)}
              note={`Δ / Flash: ${percent(values.deltaRatio)}`}
              tone="orange"
            />
            <Kpi
              label="Ảnh hưởng lỗi dữ liệu"
              value={money(values.dataErrorsUSD)}
              note="Chỉ các điều chỉnh được phân loại lỗi"
              tone="red"
            />
            <Kpi
              label="Khoản chưa giải thích"
              value={money(values.unexplainedUSD)}
              note="GL − Flash − các điều chỉnh"
              tone="red"
            />
          </div>
          <div className="dash-overview-grid">
            <DashboardWidget
              id="overview-trend"
              title="Sales Flash và GL theo tháng"
              subtitle="USD · phạm vi kỳ chọn · bấm tháng để lọc"
              className="dash-trend-card"
              action={
                <div className="dash-legend">
                  <span>
                    <i />
                    Flash
                  </span>
                  <span>
                    <i className="is-gl" />
                    GL
                  </span>
                </div>
              }
            >
              {model.monthly.some(
                (m) => m.flashUSD != null || m.glUSD != null,
              ) ? (
                <RevenueTrend model={model} onMonth={inspectMonth} />
              ) : (
                <EmptyWidget>
                  Cần tổng Flash và GL phân bổ theo tháng, kênh.
                </EmptyWidget>
              )}
            </DashboardWidget>
            <DashboardWidget
              id="overview-bridge"
              title="Từ Sales Flash đến GL"
              subtitle="USD · quy tắc ghi nhận và lỗi dữ liệu tách riêng"
              className="dash-bridge-card"
            >
              {model.bridge.length ? (
                <DashboardWaterfall
                  rows={summaryBridge(model.bridge)}
                  onSelect={inspectBridge}
                />
              ) : (
                <EmptyWidget>
                  Chưa có cầu nối cho phạm vi đang chọn.
                </EmptyWidget>
              )}
            </DashboardWidget>
            <DashboardWidget
              id="overview-ratio"
              title="Tỷ lệ chênh lệch theo tháng"
              subtitle="Δ% = (GL − Flash) / Flash"
              className="dash-ratio-card"
            >
              {model.monthly.some((m) => m.deltaRatio != null) ? (
                <VarianceChart model={model} onMonth={inspectMonth} />
              ) : (
                <EmptyWidget>
                  Cần Flash khác 0 và GL cùng phạm vi để tính tỷ lệ.
                </EmptyWidget>
              )}
            </DashboardWidget>
            <DashboardWidget
              id="overview-matrix"
              title="Doanh thu theo kênh × tháng"
              subtitle="USD · tháng được chọn tô nền · cuộn ngang trong bảng"
              className="dash-matrix-card"
            >
              {active.source === 'excel' && (
                <p className="dash-scope-note">
                  Chưa có bảng Flash và GL phân bổ theo kênh. Các dòng dưới là
                  tổng tất cả kênh từ Cau_noi.
                </p>
              )}
              <Matrix model={model} onSelect={setInspection} />
            </DashboardWidget>
            <DashboardWidget
              id="overview-residual"
              title="Tháng còn chênh lệch lớn nhất"
              subtitle="USD · phần dư sau toàn bộ điều chỉnh đã phân loại"
              className="dash-residual-card"
            >
              {model.monthly.some((m) => m.unexplainedUSD != null) ? (
                <VarianceChart model={model} onMonth={inspectMonth} residual />
              ) : (
                <EmptyWidget>
                  Cần cầu nối tháng để xác định phần dư.
                </EmptyWidget>
              )}
            </DashboardWidget>
          </div>
        </TabsContent>
        <TabsContent value="bridge" className="dash-tab-content">
          <div className="dash-kpis">
            <Kpi
              label="Sales Flash → GL"
              value={money(values.deltaUSD)}
              note="Δ = GL − Sales Flash"
              tone="navy"
            />
            <Kpi
              label="Quy tắc ghi nhận"
              value={money(values.rulesUSD)}
              note="Khác cơ sở doanh thu, ngày và FX"
            />
            <Kpi
              label="Lỗi dữ liệu"
              value={money(values.dataErrorsUSD)}
              note="Tách khỏi quy tắc ghi nhận"
              tone="red"
            />
            <Kpi
              label="Chưa giải thích"
              value={money(values.unexplainedUSD)}
              note="Phần dư sau cầu nối"
              tone="red"
            />
            <Kpi
              label="Làm tròn"
              value={money(values.roundingUSD)}
              note="Theo cơ sở tính của nguồn"
              tone="orange"
            />
          </div>
          <div className="dash-bridge-grid">
            <DashboardWidget
              id="bridge-waterfall"
              title="Cầu nối chi tiết Flash → GL"
              subtitle="USD · thanh nổi biểu diễn đúng số dư lũy kế"
            >
              {model.bridge.length ? (
                <DashboardWaterfall
                  rows={model.bridge}
                  onSelect={inspectBridge}
                />
              ) : (
                <EmptyWidget>
                  Chưa có dữ liệu cầu nối cho phạm vi đang chọn.
                </EmptyWidget>
              )}
            </DashboardWidget>
            <DashboardWidget
              id="bridge-ranking"
              title="Xếp hạng ảnh hưởng điều chỉnh"
              subtitle="Giữ cả khoản tự bù giữa các tháng"
            >
              {model.bridge.length ? (
                <ImpactRanking
                  rows={model.bridge}
                  selectedMonths={model.selectedMonths}
                  onSelect={inspectBridge}
                />
              ) : (
                <EmptyWidget>Cần các khoản mục điều chỉnh.</EmptyWidget>
              )}
            </DashboardWidget>
            <DashboardWidget
              id="bridge-matrix"
              title="Ma trận cầu nối theo tháng"
              subtitle="USD · giữ đủ khoản mục · nhấn tên để xem giá trị theo tháng"
            >
              <Matrix
                model={model}
                bridge
                onSelect={setInspection}
                onBridgeSelect={inspectBridge}
              />
            </DashboardWidget>
            <DashboardWidget
              id="bridge-checks"
              title="Kiểm tra cầu nối với nguồn"
              subtitle={
                active.source === 'excel'
                  ? 'Excel tham chiếu · kiểm tra số học nội bộ workbook'
                  : 'Web tính toán · kiểm tra đẳng thức của phiên Raw'
              }
            >
              <p className="dash-preview-note">
                Bản xem trước · phóng to để xem số thực tế và số đối chiếu.
              </p>
              <DataTable
                rows={model.checks}
                label="kiểm tra cầu nối"
                columns={[
                  { key: 'label', label: 'Kiểm tra', value: (r) => r.label },
                  {
                    key: 'month',
                    label: 'Tháng',
                    value: (r) => r.month ?? 'Kỳ chọn',
                  },
                  {
                    key: 'actual',
                    label: 'Thực tế USD',
                    value: (r) => r.actualUSD,
                    render: (r) => money(r.actualUSD),
                    numeric: true,
                  },
                  {
                    key: 'expected',
                    label: 'Đối chiếu USD',
                    value: (r) => r.expectedUSD,
                    render: (r) => money(r.expectedUSD),
                    numeric: true,
                  },
                  {
                    key: 'difference',
                    label: 'Lệch USD',
                    value: (r) => r.differenceUSD,
                    render: (r) => (
                      <span className={r.passed ? 'dash-good' : 'dash-bad'}>
                        {money(r.differenceUSD)}
                      </span>
                    ),
                    numeric: true,
                  },
                ]}
                onSelect={(r) =>
                  setInspection({
                    title: r.label,
                    description:
                      'Đây là phép kiểm tra đẳng thức trong nguồn đang chọn. Chỉ có thể so Web với Excel khi có hai kết quả độc lập cùng phạm vi.',
                    rows: [
                      {
                        Tháng: r.month,
                        'Thực tế USD': r.actualUSD,
                        'Đối chiếu USD': r.expectedUSD,
                        'Chênh lệch USD': r.differenceUSD,
                        'Kết quả': r.passed ? 'Khớp' : 'Cần kiểm tra',
                      },
                    ],
                  })
                }
              />
            </DashboardWidget>
          </div>
        </TabsContent>
        <TabsContent value="detail" className="dash-tab-content">
          <DetailTab model={model} onInspect={setInspection} />
        </TabsContent>
        <TabsContent value="quality" className="dash-tab-content">
          <QualityTab model={model} onInspect={setInspection} />
        </TabsContent>
      </Tabs>
      <footer className="dash-footer">
        <span>
          Δ = GL − nguồn · Ngưỡng cửa hàng–tháng: |Δ| &gt; 200 USD và |Δ / |GL||
          &gt; 1%
        </span>
        <div>
          {(params.has('from') ||
            params.has('to') ||
            params.has('channel') ||
            params.has('country')) && (
            <button onClick={reset}>
              <X size={12} />
              Xóa lựa chọn
            </button>
          )}
          <Link to="/methodology">
            <BookOpen size={12} />
            Quy tắc & dữ liệu
          </Link>
        </div>
      </footer>
      <Sheet
        open={!!inspection}
        onOpenChange={(open) => {
          if (!open) setInspection(null)
        }}
      >
        <SheetContent side="right" className="dash-inspector">
          <SheetTitle>{inspection?.title ?? 'Chi tiết dashboard'}</SheetTitle>
          <SheetDescription>{inspection?.description}</SheetDescription>
          {inspection && (
            <>
              {inspection.panel === 'source' && (
                <div className="dash-information-actions">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setInspection(null)
                      if (active.source === 'excel') store.openExcelReference()
                      else store.openProcessingPanel()
                    }}
                  >
                    File & tiến trình
                  </Button>
                  {model.filterNotes.length > 0 && (
                    <span>
                      {model.filterNotes.length} lưu ý về phạm vi dữ liệu
                    </span>
                  )}
                </div>
              )}
              <div className="dash-inspector-links">
                {inspection.links?.map((link) => (
                  <Button asChild variant="outline" size="sm" key={link.to}>
                    <Link to={link.to}>
                      {link.label}
                      <ArrowRight size={13} />
                    </Link>
                  </Button>
                ))}
              </div>
              <DataTable
                rows={inspection.rows}
                columns={Array.from(
                  new Set(inspection.rows.flatMap((row) => Object.keys(row))),
                ).map((key) => ({
                  key,
                  label: key,
                  value: (row: Record<string, unknown>) => {
                    const v = row[key]
                    return v == null
                      ? null
                      : typeof v === 'number'
                        ? v
                        : typeof v === 'object'
                          ? JSON.stringify(v)
                          : String(v)
                  },
                }))}
                label="dữ liệu truy vết"
                pageSize={20}
              />
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
