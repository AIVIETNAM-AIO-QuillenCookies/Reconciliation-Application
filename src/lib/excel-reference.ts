import type { ReconciliationPeriod } from './reconciliation-types.ts'

/** Session-only adapter. Values are already USD; no FX or cents rounding is applied. */
export const REFERENCE_SHEETS = [
  'Cau_noi',
  'Nhat_ky_ngoai_le',
  'Chi_tiet',
] as const
export type ReferenceSheetName = (typeof REFERENCE_SHEETS)[number]
export type ReferenceValue = string | number | boolean | null
export interface ReferenceSourceRow {
  sourceRow: number
  values: Record<string, ReferenceValue>
}
export interface ReferenceSheet {
  name: ReferenceSheetName
  columns: string[]
  rows: ReferenceSourceRow[]
  /** Repeated table headers are metadata, not financial records. */
  skippedHeaderRows: number[]
}
export interface ReferenceBridgeRow extends ReferenceSourceRow {
  id: string
  label: string
  kind: 'sales' | 'adjustment' | 'bridge_total' | 'finance' | 'check'
  detailCodes: string[]
  monthly: Record<string, number>
  annual: number
  annualDifference: number
}
export interface ReferenceException extends ReferenceSourceRow {
  id: string
  stage: string
  source: string
  description: string
  impactUSD: number
  periodLabel: string
  months: string[]
  category: string
  resolution: string
  owner: string
  status: string
}
export interface ReferenceDetail extends ReferenceSourceRow {
  id: string
  code: string
  month: string
  transactionId: string
  usd: number | null
  sourceLine: string
}
export interface ReferenceCheck {
  id: string
  label: string
  month: string | null
  actualUSD: number
  expectedUSD: number
  differenceUSD: number
  passed: boolean
  unit: 'USD' | 'records'
}
export interface ExcelReferenceWorkbook {
  fileName: string
  months: string[]
  sheets: Record<ReferenceSheetName, ReferenceSheet>
  bridgeRows: ReferenceBridgeRow[]
  exceptions: ReferenceException[]
  details: ReferenceDetail[]
  checks: ReferenceCheck[]
  toleranceUSD: number
}
export interface ReferenceSelection {
  months: string[]
  bridgeRows: (ReferenceBridgeRow & { amountUSD: number })[]
  exceptions: ReferenceException[]
  details: ReferenceDetail[]
  salesUSD: number
  financeUSD: number
  varianceUSD: number
  shippingUSD: number
  unexplainedUSD: number
  bridgeResidualUSD: number
  checks: ReferenceCheck[]
  available: boolean
}
export type ReferenceParseStage = 'read' | 'validate' | 'prepare'
const TOLERANCE_USD = 0.01
const normalize = (value: unknown) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')

/** Compensated summation retains the precision supplied by Excel until display. */
export function sumReferenceUSD(values: Iterable<number>): number {
  let sum = 0
  let correction = 0
  for (const value of values) {
    const next = sum + value
    correction +=
      Math.abs(sum) >= Math.abs(value) ? sum - next + value : value - next + sum
    sum = next
  }
  return sum + correction
}

function numberValue(value: ReferenceValue, context: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value))
    throw new Error(`${context}: cần một số hợp lệ trong workbook.`)
  return value
}

function sourceText(row: ReferenceSourceRow, column: string): string {
  return String(row.values[column] ?? '').trim()
}

function requiredColumn(sheet: ReferenceSheet, expected: string): string {
  const found = sheet.columns.find(
    (column) => normalize(column) === normalize(expected),
  )
  if (!found) throw new Error(`${sheet.name}: thiếu cột “${expected}”.`)
  return found
}

/** The relation is based on the actual source codes in Chi_tiet, never transaction guesses. */
function classify(
  label: string,
): Pick<ReferenceBridgeRow, 'kind' | 'detailCodes'> {
  const key = normalize(label)
  if (key === 'doanhsosalesflash' || key === 'salesflash')
    return { kind: 'sales', detailCodes: [] }
  if (key.includes('doanhthufinance'))
    return { kind: 'finance', detailCodes: [] }
  if (key === 'doanhthutheocaunoi')
    return { kind: 'bridge_total', detailCodes: [] }
  if (key.startsWith('kiemtra')) return { kind: 'check', detailCodes: [] }
  const codes: Record<string, string> = {
    chietkhau: 'DISCOUNT',
    dongpostrung: 'DUP_POS',
    dononlinebihuy: 'CANCEL',
    lechthoidiemonline: 'WEB_TIMING',
    lechngayghisocuahang: 'POS_TIMING',
    loichuyendulieupossanggl: 'INTERFACE',
    hangtra: 'RETURN',
    phivanchuyen: 'SHIP',
    tygia: 'FX',
    lamtron: 'ROUND',
    chuagiaithichduoc: 'UNEXPLAINED',
    chuagiaithich: 'UNEXPLAINED',
  }
  return { kind: 'adjustment', detailCodes: codes[key] ? [codes[key]] : [] }
}

export function referencePeriodMonths(
  label: string,
  availableMonths: string[],
): string[] {
  const text = label.trim()
  let result: string[] = []
  if (/^\d{4}$/.test(text))
    result = availableMonths.filter((month) => month.startsWith(text))
  else if (/^\d{4}-\d{2}$/.test(text)) result = [text]
  else {
    const range = text.match(/^(\d{1,2})\s*[-–]\s*(\d{1,2})\/(\d{4})$/)
    if (range) {
      const start = Number(range[1])
      const end = Number(range[2])
      if (start >= 1 && end <= 12 && start <= end)
        result = Array.from(
          { length: end - start + 1 },
          (_, index) => `${range[3]}-${String(start + index).padStart(2, '0')}`,
        )
    } else {
      const bounds = text.match(
        /^(\d{4}-\d{2})\s*(?:[-–]|đến|to)\s*(\d{4}-\d{2})$/,
      )
      if (bounds && bounds[1] <= bounds[2])
        result = availableMonths.filter(
          (month) => month >= bounds[1] && month <= bounds[2],
        )
    }
  }
  if (
    !result.length ||
    result.some((month) => !availableMonths.includes(month))
  )
    throw new Error(
      `Kỳ ngoại lệ “${label}” không ánh xạ được vào các tháng trong Cau_noi.`,
    )
  return result
}

function check(
  id: string,
  label: string,
  actualUSD: number,
  expectedUSD: number,
  month: string | null = null,
  unit: 'USD' | 'records' = 'USD',
): ReferenceCheck {
  const differenceUSD = actualUSD - expectedUSD
  return {
    id,
    label,
    month,
    actualUSD,
    expectedUSD,
    differenceUSD,
    passed: Math.abs(differenceUSD) <= (unit === 'USD' ? TOLERANCE_USD : 0),
    unit,
  }
}

/** Lazy-load SheetJS only when reference import is requested. No Raw store is touched. */
export async function parseExcelReference(
  buffer: ArrayBuffer | Uint8Array,
  fileName: string,
  onStage?: (stage: ReferenceParseStage) => void,
): Promise<ExcelReferenceWorkbook> {
  onStage?.('read')
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b)
    throw new Error(
      'Không đọc được workbook XLSX. Hãy chọn đúng file tham chiếu Excel.',
    )
  const XLSX = await import('xlsx')
  const workbook = XLSX.read(bytes, {
    type: 'array',
    cellDates: false,
    cellText: false,
  })
  onStage?.('validate')
  // Let the progress screen paint before inspecting all detail records.
  await new Promise<void>((resolve) => setTimeout(resolve, 0))
  const sheets = {} as Record<ReferenceSheetName, ReferenceSheet>
  for (const name of REFERENCE_SHEETS) {
    const sheet = workbook.Sheets[name]
    if (!sheet?.['!ref'])
      throw new Error(`Workbook thiếu sheet có dữ liệu “${name}”.`)
    const range = XLSX.utils.decode_range(sheet['!ref'])
    const data = XLSX.utils.sheet_to_json<ReferenceValue[]>(sheet, {
      header: 1,
      defval: null,
      blankrows: true,
      range: range.s.r,
    })
    const headerIndex = data.findIndex((row) => {
      if (name === 'Cau_noi')
        return (
          row.some((value) => normalize(value) === 'khoanmuc') &&
          row.some((value) => /^\d{4}-\d{2}$/.test(String(value)))
        )
      if (name === 'Nhat_ky_ngoai_le')
        return (
          row.some((value) => normalize(value) === 'ma') &&
          row.some((value) => normalize(value) === 'trangthai')
        )
      return (
        row.some((value) => normalize(value) === 'makhoan') &&
        row.some((value) => normalize(value) === 'usd')
      )
    })
    if (headerIndex < 0)
      throw new Error(`${name}: không tìm thấy dòng tiêu đề hợp lệ.`)
    const header = data[headerIndex]
    const columns = Array.from(
      { length: Math.max(header.length, range.e.c + 1) },
      (_, index) =>
        String(header[index] ?? '').trim() ||
        `Cột ${XLSX.utils.encode_col(index)}`,
    )
    if (new Set(columns.map(normalize)).size !== columns.length)
      throw new Error(`${name}: tiêu đề cột bị trùng.`)
    const rows: ReferenceSourceRow[] = []
    const skippedHeaderRows: number[] = []
    for (let index = headerIndex + 1; index < data.length; index++) {
      const row = data[index]
      if (!row.some((value) => value !== null && String(value).trim() !== ''))
        continue
      const sourceRow = range.s.r + index + 1
      if (
        header.every(
          (value, column) => normalize(value) === normalize(row[column]),
        )
      ) {
        skippedHeaderRows.push(sourceRow)
        continue
      }
      const values = Object.fromEntries(
        columns.map((column, position) => [column, row[position] ?? null]),
      )
      rows.push({ sourceRow, values })
    }
    if (!rows.length) throw new Error(`${name}: không có bản ghi dữ liệu.`)
    sheets[name] = { name, columns, rows, skippedHeaderRows }
  }

  const bridgeSheet = sheets.Cau_noi
  const labelColumn = requiredColumn(bridgeSheet, 'Khoản mục')
  const annualColumn = requiredColumn(bridgeSheet, 'Cả năm')
  const months = bridgeSheet.columns.filter((column) =>
    /^\d{4}-(?:0[1-9]|1[0-2])$/.test(column),
  )
  if (
    months.length !== 12 ||
    months.some(
      (month, index) =>
        month !==
        `${months[0].slice(0, 4)}-${String(index + 1).padStart(2, '0')}`,
    )
  )
    throw new Error(
      'Cau_noi cần đủ 12 tháng liên tiếp của cùng một năm, từ tháng 01 đến tháng 12.',
    )
  const bridgeRows: ReferenceBridgeRow[] = bridgeSheet.rows.map((row) => {
    const label = sourceText(row, labelColumn)
    if (!label)
      throw new Error(`Cau_noi dòng ${row.sourceRow}: thiếu tên khoản mục.`)
    const monthly = Object.fromEntries(
      months.map((month) => [
        month,
        numberValue(
          row.values[month],
          `Cau_noi dòng ${row.sourceRow}, ${month}`,
        ),
      ]),
    )
    const annual = numberValue(
      row.values[annualColumn],
      `Cau_noi dòng ${row.sourceRow}, Cả năm`,
    )
    return {
      ...row,
      id: `bridge-${row.sourceRow}`,
      label,
      ...classify(label),
      monthly,
      annual,
      annualDifference: sumReferenceUSD(Object.values(monthly)) - annual,
    }
  })
  for (const kind of ['sales', 'finance', 'bridge_total', 'check'] as const)
    if (bridgeRows.filter((row) => row.kind === kind).length !== 1)
      throw new Error(
        `Cau_noi: cần đúng một dòng ${kind === 'sales' ? 'Doanh số Sales flash' : kind === 'finance' ? 'Doanh thu Finance' : kind === 'bridge_total' ? 'Doanh thu theo cầu nối' : 'Kiểm tra'}.`,
      )

  const exceptionSheet = sheets.Nhat_ky_ngoai_le
  const exceptionColumns = Object.fromEntries(
    [
      'Mã',
      'Phát hiện ở bước',
      'Nguồn',
      'Mô tả',
      'Ảnh hưởng (USD)',
      'Kỳ',
      'Phân loại',
      'Hướng xử lý',
      'Người phụ trách',
      'Trạng thái',
    ].map((label) => [label, requiredColumn(exceptionSheet, label)]),
  )
  const exceptions: ReferenceException[] = exceptionSheet.rows.map((row) => {
    const text = (label: string) => sourceText(row, exceptionColumns[label])
    const id = text('Mã')
    if (!id || !text('Trạng thái'))
      throw new Error(
        `Nhat_ky_ngoai_le dòng ${row.sourceRow}: thiếu mã hoặc trạng thái.`,
      )
    const periodLabel = text('Kỳ')
    return {
      ...row,
      id,
      stage: text('Phát hiện ở bước'),
      source: text('Nguồn'),
      description: text('Mô tả'),
      impactUSD: numberValue(
        row.values[exceptionColumns['Ảnh hưởng (USD)']],
        `Nhat_ky_ngoai_le dòng ${row.sourceRow}`,
      ),
      periodLabel,
      months: referencePeriodMonths(periodLabel, months),
      category: text('Phân loại'),
      resolution: text('Hướng xử lý'),
      owner: text('Người phụ trách'),
      status: text('Trạng thái'),
    }
  })
  if (new Set(exceptions.map((row) => row.id)).size !== exceptions.length)
    throw new Error('Nhat_ky_ngoai_le: mã ngoại lệ bị trùng.')

  const detailSheet = sheets.Chi_tiet
  const detailColumns = Object.fromEntries(
    ['Ma_khoan', 'Thang', 'Ma_giao_dich', 'USD', 'Dong_nguon'].map((label) => [
      label,
      requiredColumn(detailSheet, label),
    ]),
  )
  const details: ReferenceDetail[] = detailSheet.rows.map((row) => {
    const text = (label: string) => sourceText(row, detailColumns[label])
    const code = text('Ma_khoan')
    const month = text('Thang')
    if (!code || !months.includes(month))
      throw new Error(
        `Chi_tiet dòng ${row.sourceRow}: mã khoản hoặc tháng không hợp lệ.`,
      )
    return {
      ...row,
      id: `detail-${row.sourceRow}`,
      code,
      month,
      transactionId: text('Ma_giao_dich'),
      usd: numberValue(
        row.values[detailColumns.USD],
        `Chi_tiet dòng ${row.sourceRow}, USD`,
      ),
      sourceLine: text('Dong_nguon'),
    }
  })
  onStage?.('prepare')
  await new Promise<void>((resolve) => setTimeout(resolve, 0))
  const checks: ReferenceCheck[] = []
  const sales = bridgeRows.find((row) => row.kind === 'sales')!
  const finance = bridgeRows.find((row) => row.kind === 'finance')!
  const bridgeTotal = bridgeRows.find((row) => row.kind === 'bridge_total')!
  const sourceCheck = bridgeRows.find((row) => row.kind === 'check')!
  const components = bridgeRows.filter(
    (row) => row.kind === 'sales' || row.kind === 'adjustment',
  )
  for (const month of months) {
    const computed = sumReferenceUSD(
      components.map((row) => row.monthly[month]),
    )
    checks.push(
      check(
        `bridge-${month}`,
        'Tổng thành phần cầu nối so với Finance',
        computed,
        finance.monthly[month],
        month,
      ),
    )
    checks.push(
      check(
        `reported-bridge-${month}`,
        'Tổng cầu nối trong workbook so với tổng thành phần',
        bridgeTotal.monthly[month],
        computed,
        month,
      ),
    )
    checks.push(
      check(
        `source-check-${month}`,
        'Dòng kiểm tra trong workbook',
        sourceCheck.monthly[month],
        0,
        month,
      ),
    )
  }
  checks.push(
    check(
      'bridge-annual',
      'Tổng thành phần cầu nối cả năm so với Finance',
      sumReferenceUSD(components.flatMap((row) => Object.values(row.monthly))),
      sumReferenceUSD(Object.values(finance.monthly)),
    ),
  )
  for (const row of bridgeRows)
    checks.push(
      check(
        `annual-${row.id}`,
        `12 tháng so với Cả năm · ${row.label}`,
        sumReferenceUSD(Object.values(row.monthly)),
        row.annual,
      ),
    )
  // These are controls supplied by the user, never sources for displayed financial results.
  const annual = (row: ReferenceBridgeRow | undefined) =>
    row ? sumReferenceUSD(Object.values(row.monthly)) : 0
  checks.push(
    check(
      'control-sales',
      'Đối chiếu tham chiếu · Sales Flash cả năm',
      annual(sales),
      31_124_401,
    ),
  )
  checks.push(
    check(
      'control-finance',
      'Đối chiếu tham chiếu · Finance cả năm',
      annual(finance),
      28_698_496.23,
    ),
  )
  checks.push(
    check(
      'control-variance',
      'Đối chiếu tham chiếu · Sales Flash − Finance',
      annual(sales) - annual(finance),
      2_425_904.77,
    ),
  )
  checks.push(
    check(
      'control-shipping',
      'Đối chiếu tham chiếu · Phí vận chuyển',
      annual(bridgeRows.find((row) => row.detailCodes.includes('SHIP'))),
      94_766.95,
    ),
  )
  checks.push(
    check(
      'control-unexplained',
      'Đối chiếu tham chiếu · Chưa giải thích',
      annual(bridgeRows.find((row) => row.detailCodes.includes('UNEXPLAINED'))),
      1_250,
    ),
  )
  checks.push(
    check(
      'control-exceptions',
      'Số ngoại lệ tham chiếu',
      exceptions.length,
      10,
      null,
      'records',
    ),
  )
  return {
    fileName,
    months,
    sheets,
    bridgeRows,
    exceptions,
    details,
    checks,
    toleranceUSD: TOLERANCE_USD,
  }
}

/** Monthly workbook granularity: intersect reporting dates with the source months. */
export function selectExcelReference(
  workbook: ExcelReferenceWorkbook,
  period: ReconciliationPeriod,
): ReferenceSelection {
  const valid =
    /^\d{4}-\d{2}-\d{2}$/.test(period.start) &&
    /^\d{4}-\d{2}-\d{2}$/.test(period.end) &&
    period.start <= period.end
  const months = valid
    ? workbook.months.filter(
        (month) =>
          month >= period.start.slice(0, 7) && month <= period.end.slice(0, 7),
      )
    : []
  const selected = new Set(months)
  const bridgeRows = workbook.bridgeRows.map((row) => ({
    ...row,
    amountUSD: sumReferenceUSD(months.map((month) => row.monthly[month])),
  }))
  const total = (kind: ReferenceBridgeRow['kind']) =>
    bridgeRows.find((row) => row.kind === kind)?.amountUSD ?? 0
  const byCode = (code: string) =>
    sumReferenceUSD(
      bridgeRows
        .filter((row) => row.detailCodes.includes(code))
        .map((row) => row.amountUSD),
    )
  const salesUSD = total('sales')
  const financeUSD = total('finance')
  return {
    months,
    bridgeRows,
    exceptions: workbook.exceptions.filter((row) =>
      row.months.some((month) => selected.has(month)),
    ),
    details: workbook.details.filter((row) => selected.has(row.month)),
    salesUSD,
    financeUSD,
    varianceUSD: salesUSD - financeUSD,
    shippingUSD: byCode('SHIP'),
    unexplainedUSD: byCode('UNEXPLAINED'),
    bridgeResidualUSD:
      sumReferenceUSD(
        bridgeRows
          .filter((row) => row.kind === 'sales' || row.kind === 'adjustment')
          .map((row) => row.amountUSD),
      ) - financeUSD,
    checks: workbook.checks.filter((row) =>
      row.month
        ? selected.has(row.month)
        : months.length === workbook.months.length,
    ),
    available: months.length > 0,
  }
}

export function referenceDetailsFor(
  workbook: ExcelReferenceWorkbook,
  rowId: string,
  period: ReconciliationPeriod,
): ReferenceDetail[] {
  const bridge = workbook.bridgeRows.find((row) => row.id === rowId)
  if (!bridge || !bridge.detailCodes.length) return []
  const selection = selectExcelReference(workbook, period)
  return selection.details.filter((detail) =>
    bridge.detailCodes.includes(detail.code),
  )
}
