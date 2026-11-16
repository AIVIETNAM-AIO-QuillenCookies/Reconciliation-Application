import * as XLSX from 'xlsx'
import type { ReferenceParseOptions } from './excel-reference.ts'

export const GUIDE_REFERENCE_OPTIONS: ReferenceParseOptions = {
  expectedExceptionCount: 7,
}
const BRIDGE_SHEET = '04a_Cau_noi_Flash_GL'
const normalizedSheets = {
  POS: '02a_POS_chuan_hoa',
  WEB: '02b_Web_chuan_hoa',
  GL: '02c_GL_chuan_hoa',
} as const
type SourceRecord = Record<string, unknown> & { sourceRow: number }

function requiredSheet(workbook: XLSX.WorkBook, name: string) {
  const sheet = workbook.Sheets[name]
  if (!sheet?.['!ref']) throw new Error(`Nexa Home thiếu sheet ${name}.`)
  return sheet
}
function number(value: unknown, context: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value))
    throw new Error(`${context}: thiếu kết quả số đã tính trong workbook.`)
  return value
}
function records(workbook: XLSX.WorkBook, name: string): SourceRecord[] {
  const values = XLSX.utils.sheet_to_json<Record<string, unknown>>(
    requiredSheet(workbook, name),
    { defval: null, blankrows: false },
  )
  return values.map((row) => ({
    ...row,
    sourceRow: (row as { __rowNum__?: number }).__rowNum__! + 1,
  }))
}
function sourceMonth(workbook: XLSX.WorkBook, value: unknown): string {
  if (typeof value === 'string' && /^\d{4}-\d{2}/.test(value))
    return value.slice(0, 7)
  if (typeof value !== 'number') return ''
  const date = XLSX.SSF.parse_date_code(value, {
    date1904: !!workbook.Workbook?.WBProps?.date1904,
  })
  return date ? `${date.y}-${String(date.m).padStart(2, '0')}` : ''
}
function exceptionPeriod(value: unknown): string {
  const text = String(value ?? '')
  const range = text.match(/^(\d{4})-(\d{2})\s*→\s*(\d{2})$/)
  return range ? `${range[1]}-${range[2]} – ${range[1]}-${range[3]}` : text
}

/**
 * A compatibility view of cached Nexa Excel outputs, created only after explicit
 * opt-in. It is not a Raw run. Monetary cells are copied without recalculation,
 * conversion, balancing or cents rounding. Provenance names the original cells.
 */
export function createGuideReferenceFile(workbook: XLSX.WorkBook): File {
  const bridge = requiredSheet(workbook, BRIDGE_SHEET)
  const months = Array.from({ length: 12 }, (_, index) => {
    const address = XLSX.utils.encode_cell({ r: 6, c: index + 2 })
    const month = String(bridge[address]?.v ?? '')
    if (month !== `2025-${String(index + 1).padStart(2, '0')}`)
      throw new Error(`${BRIDGE_SHEET}!${address}: kỳ nguồn không hợp lệ.`)
    return month
  })
  const bridgeRows: unknown[][] = [
    ['Khoản mục', ...months, 'Cả năm', 'Source_Sheet', 'Source_Row'],
  ]
  for (let row = 7; row <= 21; row++) {
    const label = bridge[XLSX.utils.encode_cell({ r: row, c: 1 })]?.v
    if (typeof label !== 'string' || !label)
      throw new Error(`${BRIDGE_SHEET}: thiếu nhãn dòng ${row + 1}.`)
    bridgeRows.push([
      label,
      ...Array.from({ length: 13 }, (_, index) => {
        const address = XLSX.utils.encode_cell({ r: row, c: index + 2 })
        return number(bridge[address]?.v, `${BRIDGE_SHEET}!${address}`)
      }),
      BRIDGE_SHEET,
      row + 1,
    ])
  }

  const exceptionRows = records(workbook, '05_Nhat_ky_ngoai_le')
  if (
    exceptionRows.length !== 7 ||
    exceptionRows.some((row, index) => row['Mã'] !== `EX-0${index + 1}`)
  )
    throw new Error('Nexa Home phải có đúng 7 ngoại lệ EX-01 đến EX-07.')
  const exceptionColumns = [
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
  ]
  const exceptions: unknown[][] = [
    [...exceptionColumns, 'Kỳ nguồn', 'Source_Sheet', 'Source_Row'],
    ...exceptionRows.map((row) => [
      ...exceptionColumns.map((column) =>
        column === 'Kỳ' ? exceptionPeriod(row[column]) : row[column],
      ),
      row['Kỳ'],
      '05_Nhat_ky_ngoai_le',
      row.sourceRow,
    ]),
  ]

  const detailColumns = [
    'Ma_khoan',
    'Thang',
    'Ma_giao_dich',
    'USD',
    'Dong_nguon',
    'Loai_bang',
    'Source_Sheet',
    'Source_Row',
    'Source_Cell',
    'Kenh',
  ]
  const details: unknown[][] = [detailColumns]
  const detail = (
    code: string,
    month: string,
    id: string,
    usd: number,
    sheet: string,
    row: number,
    field: string,
    channel: string,
    aggregate = false,
  ) => {
    if (!months.includes(month)) return
    details.push([
      code,
      month,
      id,
      usd,
      `${sheet} · dòng ${row} · ${field}${aggregate ? ' · Tổng hợp tháng, không phải giao dịch' : ''}`,
      aggregate ? 'Tổng hợp tháng từ kết quả Excel' : 'Dòng chuẩn hóa từ Excel',
      sheet,
      row,
      field,
      channel,
    ])
  }
  // These original bridge rows have no complete transaction drill-down sheet.
  // Keep them at their supplied monthly grain, with blank transaction IDs.
  const aggregateCodes: Record<number, string> = {
    9: 'DISCOUNT',
    12: 'WEB_TIMING',
    13: 'POS_TIMING',
    14: 'INTERFACE',
    17: 'FX',
    18: 'ROUND',
  }
  for (const [physicalRow, code] of Object.entries(aggregateCodes)) {
    const row = Number(physicalRow)
    months.forEach((month, index) => {
      const address = XLSX.utils.encode_cell({ r: row - 1, c: index + 2 })
      detail(
        code,
        month,
        '',
        number(bridge[address]?.v, `${BRIDGE_SHEET}!${address}`),
        BRIDGE_SHEET,
        row,
        address,
        '',
        true,
      )
    })
  }
  for (const row of records(workbook, normalizedSheets.POS)) {
    if (number(row.export_seq, `POS dòng ${row.sourceRow} export_seq`) <= 1)
      continue
    detail(
      'DUP_POS',
      sourceMonth(workbook, row.business_date),
      `${row.receipt_no}-${row.line_no}`,
      -number(row.net_usd_daily, 'POS net_usd_daily'),
      normalizedSheets.POS,
      row.sourceRow,
      'net_usd_daily',
      'STORE',
    )
  }
  for (const row of records(workbook, normalizedSheets.WEB)) {
    if (row.order_status === 'Cancelled')
      detail(
        'CANCEL',
        sourceMonth(workbook, row.order_date),
        String(row.web_order_id),
        -number(row.net_usd_daily, 'WEB net_usd_daily'),
        normalizedSheets.WEB,
        row.sourceRow,
        'net_usd_daily theo ngày đặt',
        'WEB',
      )
    if (row.order_status === 'Returned')
      detail(
        'RETURN',
        sourceMonth(workbook, row.return_date),
        String(row.web_order_id),
        -number(row.net_usd_daily, 'WEB net_usd_daily'),
        normalizedSheets.WEB,
        row.sourceRow,
        'net_usd_daily theo ngày trả',
        'WEB',
      )
  }
  for (const row of records(workbook, normalizedSheets.GL)) {
    if (row.journal_type !== 'MANUAL') continue
    const reference = String(row.source_ref ?? '')
    const code = reference.startsWith('MJ-SHIP-')
      ? 'SHIP'
      : reference.startsWith('MJ-ADJ-')
        ? 'UNEXPLAINED'
        : null
    // The transfer pair sums to zero and is not another bridge adjustment.
    if (!code) continue
    detail(
      code,
      String(row.period),
      String(row.journal_id),
      number(row.revenue_usd, 'GL revenue_usd'),
      normalizedSheets.GL,
      row.sourceRow,
      `revenue_usd · ${reference}`,
      String(row.channel ?? ''),
    )
  }

  const compatible = XLSX.utils.book_new()
  compatible.Workbook = {
    WBProps: { date1904: !!workbook.Workbook?.WBProps?.date1904 },
  }
  XLSX.utils.book_append_sheet(
    compatible,
    XLSX.utils.aoa_to_sheet(bridgeRows),
    'Cau_noi',
  )
  XLSX.utils.book_append_sheet(
    compatible,
    XLSX.utils.aoa_to_sheet(exceptions),
    'Nhat_ky_ngoai_le',
  )
  XLSX.utils.book_append_sheet(
    compatible,
    XLSX.utils.aoa_to_sheet(details),
    'Chi_tiet',
  )
  // Keep the prepared inputs for all four dashboard tabs in the reference file.
  // These are cached Excel outputs, never a substitute Raw reconciliation run.
  for (const name of [
    '02a_POS_chuan_hoa',
    '02b_Web_chuan_hoa',
    '02c_GL_chuan_hoa',
    '02d_Flash_chuan_hoa',
    'QC_Summary',
  ])
    XLSX.utils.book_append_sheet(
      compatible,
      requiredSheet(workbook, name),
      name,
    )
  const bytes = XLSX.write(compatible, { type: 'array', bookType: 'xlsx' })
  return new File(
    [bytes],
    'Nexa_Home_Recon_Dataset_Final · tham chiếu Excel.xlsx',
    {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    },
  )
}
