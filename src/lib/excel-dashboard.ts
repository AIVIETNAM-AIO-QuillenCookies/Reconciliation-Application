import * as XLSX from 'xlsx'
import type { DashboardSnapshot } from './dashboard-model.ts'

/** Cached, normalized Nexa outputs used by the Excel preview, never a Raw run. */
export const EXCEL_DASHBOARD_SHEETS = [
  '02a_POS_chuan_hoa',
  '02b_Web_chuan_hoa',
  '02c_GL_chuan_hoa',
  '02d_Flash_chuan_hoa',
  'QC_Summary',
] as const

export interface ExcelDashboardSource {
  sheetName: string
  sourceRow: number
  field: string
}
export interface ExcelDashboardData {
  sourceSheets: string[]
  cells: (DashboardSnapshot['cells'][number] & {
    sourceSheet: string
    sourceRows: number[]
    sources: ExcelDashboardSource[]
  })[]
  online: DashboardSnapshot['online']
  quality: DashboardSnapshot['quality']
  glChannels: DashboardSnapshot['glChannels']
  flashChannels: { month: string; channel: string; revenueUSD: number }[]
  manuals: {
    id: string
    journalId: string
    postingDate: string
    period: string
    storeKey: string
    storeCode: string
    channel: string
    revenueUSD: number
    description: string
    sourceRef: string
    sourceSheet: string
    sourceRow: number
  }[]
  validations: {
    id: string
    label: string
    count: number | null
    status: string
    tableId: string
    actual: unknown
    expected: unknown
    rule: string
    note: string
    sourceSheet: string
    sourceRow: number
  }[]
  rules: string[]
}

type RecordRow = { sourceRow: number; values: Record<string, unknown> }

function records(workbook: XLSX.WorkBook, name: string): RecordRow[] {
  const sheet = workbook.Sheets[name]
  if (!sheet?.['!ref']) throw new Error(`Nexa Home thiếu sheet ${name}.`)
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    raw: true,
    defval: null,
    blankrows: false,
  })
  return rows.map((row) => ({
    sourceRow: (row as { __rowNum__?: number }).__rowNum__! + 1,
    values: Object.fromEntries(
      Object.entries(row).map(([key, value]) => [key.trim(), value]),
    ),
  }))
}

function amount(row: RecordRow, field: string, sheet: string): number {
  const value = row.values[field]
  if (typeof value !== 'number' || !Number.isFinite(value))
    throw new Error(
      `${sheet} dòng ${row.sourceRow}: thiếu số hợp lệ ở ${field}.`,
    )
  return value
}

const text = (row: RecordRow, field: string) =>
  String(row.values[field] ?? '').trim()

function date(
  workbook: XLSX.WorkBook,
  value: unknown,
  context: string,
): string {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value))
    return value.slice(0, 10)
  if (value instanceof Date && Number.isFinite(value.getTime()))
    return value.toISOString().slice(0, 10)
  if (typeof value === 'number' && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value, {
      date1904: !!workbook.Workbook?.WBProps?.date1904,
    })
    if (parsed)
      return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`
  }
  throw new Error(`${context}: thiếu ngày hợp lệ trong workbook.`)
}

/** Retain source-cell precision; rounding belongs to display, not the adapter. */
function sum(values: Iterable<number>): number {
  let total = 0
  let correction = 0
  for (const value of values) {
    const next = total + value
    correction +=
      Math.abs(total) >= Math.abs(value)
        ? total - next + value
        : value - next + total
    total = next
  }
  return total + correction
}

export function readExcelDashboard(
  workbook: XLSX.WorkBook,
): ExcelDashboardData {
  const [posName, webName, glName, flashName, qcName] = EXCEL_DASHBOARD_SHEETS
  const pos = records(workbook, posName)
  const web = records(workbook, webName)
  const gl = records(workbook, glName)
  const flash = records(workbook, flashName)
  const qc = records(workbook, qcName)
  const rowDate = (row: RecordRow, field: string, sheet: string) =>
    date(
      workbook,
      row.values[field],
      `${sheet} dòng ${row.sourceRow}, ${field}`,
    )
  const monthly = new Map<
    string,
    {
      orders: number[]
      recognized: number[]
      gl: number[]
      returns: number[]
      delivered: number[]
      cancelled: Set<string>
      duplicates: number
    }
  >()
  const month = (key: string) => {
    let entry = monthly.get(key)
    if (!entry) {
      entry = {
        orders: [],
        recognized: [],
        gl: [],
        returns: [],
        delivered: [],
        cancelled: new Set(),
        duplicates: 0,
      }
      monthly.set(key, entry)
    }
    return entry
  }
  const groups = new Map<
    string,
    {
      storeKey: string
      date: string
      raw: number[]
      expected: number[]
      gl: number[]
      sources: ExcelDashboardSource[]
    }
  >()
  const cell = (storeKey: string, date: string) => {
    const key = `${storeKey}\u0000${date}`
    let entry = groups.get(key)
    if (!entry) {
      entry = { storeKey, date, raw: [], expected: [], gl: [], sources: [] }
      groups.set(key, entry)
    }
    return entry
  }
  const addCell = (
    row: RecordRow,
    sheet: string,
    dateField: string,
    valueField: string,
    target: 'raw' | 'expected' | 'gl',
  ) => {
    const storeKey = text(row, 'store_key')
    if (!storeKey)
      throw new Error(`${sheet} dòng ${row.sourceRow}: thiếu store_key.`)
    const entry = cell(storeKey, rowDate(row, dateField, sheet))
    entry[target].push(amount(row, valueField, sheet))
    entry.sources.push({
      sheetName: sheet,
      sourceRow: row.sourceRow,
      field: valueField,
    })
  }
  for (const row of pos) {
    const businessDate = rowDate(row, 'business_date', posName)
    const sequence = amount(row, 'export_seq', posName)
    if (!Number.isSafeInteger(sequence) || sequence < 1)
      throw new Error(
        `${posName} dòng ${row.sourceRow}: export_seq không hợp lệ.`,
      )
    addCell(row, posName, 'business_date', 'net_usd_daily', 'raw')
    if (sequence === 1)
      addCell(row, posName, 'posting_date', 'net_usd_month_end', 'expected')
    else month(businessDate.slice(0, 7)).duplicates++
  }
  for (const row of web) {
    const status = text(row, 'order_status')
    if (!['Delivered', 'Returned', 'Cancelled'].includes(status))
      throw new Error(
        `${webName} dòng ${row.sourceRow}: order_status không hợp lệ.`,
      )
    const orderMonth = rowDate(row, 'order_date', webName).slice(0, 7)
    const dailyUSD = amount(row, 'net_usd_daily', webName)
    if (status === 'Cancelled') {
      const id = text(row, 'web_order_id')
      if (!id)
        throw new Error(`${webName} dòng ${row.sourceRow}: thiếu web_order_id.`)
      month(orderMonth).cancelled.add(id)
      continue
    }
    month(orderMonth).orders.push(dailyUSD)
    const deliveryMonth = rowDate(row, 'delivery_date', webName).slice(0, 7)
    const delivery = month(deliveryMonth)
    delivery.recognized.push(amount(row, 'net_usd_month_end_delivery', webName))
    // PDF dashboard 4 measures returns and deliveries on the same daily-USD basis.
    delivery.delivered.push(dailyUSD)
    if (status === 'Returned') {
      const returned = month(rowDate(row, 'return_date', webName).slice(0, 7))
      returned.returns.push(dailyUSD)
      returned.recognized.push(
        -amount(row, 'net_usd_month_end_return', webName),
      )
    }
  }
  const glChannels = new Map<string, number[]>()
  const manuals: ExcelDashboardData['manuals'] = []
  for (const row of gl) {
    const postingDate = rowDate(row, 'posting_date', glName)
    const period = text(row, 'period')
    const channel = text(row, 'channel')
    const journalType = text(row, 'journal_type')
    const revenueUSD = amount(row, 'revenue_usd', glName)
    const groupKey = `${postingDate.slice(0, 7)}\u0000${channel}`
    const amounts = glChannels.get(groupKey) ?? []
    amounts.push(revenueUSD)
    glChannels.set(groupKey, amounts)
    if (journalType.startsWith('POS'))
      addCell(row, glName, 'posting_date', 'revenue_usd', 'gl')
    if (journalType === 'WEB_DELIVERY' || journalType === 'WEB_RETURN')
      month(postingDate.slice(0, 7)).gl.push(revenueUSD)
    if (journalType === 'MANUAL')
      manuals.push({
        id: `excel-gl-${row.sourceRow}`,
        journalId: text(row, 'journal_id'),
        postingDate,
        period,
        storeKey: text(row, 'store_key'),
        storeCode: text(row, 'store_code'),
        channel,
        revenueUSD,
        description: text(row, 'description'),
        sourceRef: text(row, 'source_ref'),
        sourceSheet: glName,
        sourceRow: row.sourceRow,
      })
  }
  const flashChannels = new Map<string, number[]>()
  for (const row of flash) {
    const key = `${rowDate(row, 'month_end_date', flashName).slice(0, 7)}\u0000${text(row, 'channel_code')}`
    const values = flashChannels.get(key) ?? []
    values.push(amount(row, 'revenue_usd', flashName))
    flashChannels.set(key, values)
  }
  const channelRows = (values: Map<string, number[]>) =>
    [...values]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, values]) => {
        const [month, channel] = key.split('\u0000')
        return { month, channel, revenueUSD: sum(values) }
      })
  const months = [...monthly.keys()].sort()
  return {
    sourceSheets: [...EXCEL_DASHBOARD_SHEETS],
    cells: [...groups.values()]
      .sort(
        (a, b) =>
          a.storeKey.localeCompare(b.storeKey) || a.date.localeCompare(b.date),
      )
      .map((entry) => ({
        storeKey: entry.storeKey,
        date: entry.date,
        rawUSD: sum(entry.raw),
        expectedUSD: sum(entry.expected),
        glUSD: sum(entry.gl),
        hasExpected: entry.expected.length > 0,
        hasGL: entry.gl.length > 0,
        sourceSheet: `${posName}; ${glName}`,
        sourceRows: [
          ...new Set(entry.sources.map((source) => source.sourceRow)),
        ],
        sources: entry.sources,
      })),
    online: months.map((key) => {
      const entry = month(key)
      return {
        month: key,
        orderUSD: sum(entry.orders),
        recognizedUSD: sum(entry.recognized),
        glUSD: sum(entry.gl),
      }
    }),
    quality: months.map((key) => {
      const entry = month(key)
      const returnsUSD = sum(entry.returns)
      const deliveredUSD = sum(entry.delivered)
      return {
        month: key,
        returnsUSD,
        deliveredUSD,
        returnRate: deliveredUSD === 0 ? null : returnsUSD / deliveredUSD,
        cancelledOrders: entry.cancelled.size,
        removedDuplicateLines: entry.duplicates,
      }
    }),
    glChannels: channelRows(glChannels),
    flashChannels: channelRows(flashChannels),
    manuals,
    validations: qc
      .filter((row) => text(row, 'Chỉ tiêu kiểm tra'))
      .map((row) => ({
        id: `excel-qc-${row.sourceRow}`,
        label: `${text(row, 'File')} · ${text(row, 'Chỉ tiêu kiểm tra')}`,
        count:
          typeof row.values['Số lỗi'] === 'number' &&
          Number.isFinite(row.values['Số lỗi'])
            ? row.values['Số lỗi']
            : null,
        status: text(row, 'Trạng thái'),
        tableId: text(row, 'File'),
        actual: row.values['Kết quả thực tế'],
        expected: row.values['Kết quả mong đợi'],
        rule: text(row, 'Ngưỡng / Quy tắc'),
        note: text(row, 'Ghi chú'),
        sourceSheet: qcName,
        sourceRow: row.sourceRow,
      })),
    rules: [
      'Excel: dùng giá trị đã tính trong các sheet chuẩn hóa; giữ nguyên độ chính xác nguồn, không chạy pipeline Raw.',
      'Cửa hàng: trước chuẩn hóa là net_usd_daily của toàn bộ export theo business_date; sau chuẩn hóa giữ export_seq = 1, dùng posting_date và net_usd_month_end; GL chỉ lấy journal_type POS*. So sánh USD có thể còn sai số làm tròn dù nội tệ khớp.',
      'Online: chỉ đơn Delivered/Returned theo ngày đặt; ghi nhận theo ngày giao trừ ngày trả bằng USD cuối tháng; GL chỉ lấy WEB_DELIVERY và WEB_RETURN, tách bút toán MANUAL sang bảng rà soát.',
      'Hàng trả và tỷ lệ hàng trả dùng net_usd_daily theo ngày trả / net_usd_daily của đơn không hủy theo ngày giao, theo trang 38 PDF. Không lấy trung bình tỷ lệ tháng.',
      'QC_Summary là kết quả lưu trong workbook cho toàn bộ dữ liệu nguồn. Giữ nguyên trạng thái và số lỗi còn trống; kết quả chưa điền cần được đánh giá trong phần chất lượng dữ liệu riêng.',
    ],
  }
}
