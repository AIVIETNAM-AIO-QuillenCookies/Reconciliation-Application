import * as XLSX from 'xlsx'
import { selectedSheetRange } from './spreadsheet-range.ts'

/** The same cell values feed both preview normalization and full ingestion. */
export function normalizeSpreadsheetValues(
  sheet: XLSX.WorkSheet,
  headerRow: number,
  date1904 = false,
): XLSX.WorkSheet {
  const normalized: XLSX.WorkSheet = {
    ...sheet,
    '!ref': XLSX.utils.encode_range(selectedSheetRange(sheet, headerRow)),
  }
  for (const address of Object.keys(sheet)) {
    if (address.startsWith('!')) continue
    if (XLSX.utils.decode_cell(address).r < headerRow - 1) continue
    const cell = sheet[address] as XLSX.CellObject
    if (cell.t === 'e')
      throw new Error(
        `Excel error at ${address}. Correct the cell before importing.`,
      )
    if (cell.f && cell.v == null)
      throw new Error(
        `Formula at ${address} has no cached value. Recalculate and save the workbook first.`,
      )
    if (
      cell.t === 'd' ||
      (cell.t === 'n' && cell.z && XLSX.SSF.is_date(cell.z))
    ) {
      let date: Date
      if (cell.t === 'n') {
        // Read Excel's calendar directly. Local machine timezone must not move
        // a business date or change ordering of same-day export timestamps.
        const parsed = XLSX.SSF.parse_date_code(cell.v, { date1904 })
        if (!parsed) throw new Error(`Invalid Excel date at ${address}.`)
        date = new Date(
          Date.UTC(
            parsed.y,
            parsed.m - 1,
            parsed.d,
            parsed.H,
            parsed.M,
            parsed.S,
          ),
        )
        date.setUTCMilliseconds(Math.round(parsed.u * 1000))
      } else {
        date = cell.v instanceof Date ? cell.v : new Date(String(cell.v))
      }
      if (!Number.isFinite(date.getTime()))
        throw new Error(`Invalid Excel date at ${address}.`)
      const iso = date.toISOString()
      normalized[address] = {
        t: 's',
        v: iso.endsWith('T00:00:00.000Z')
          ? iso.slice(0, 10)
          : iso.slice(0, -1).replace('T', ' '),
      }
    } else if (cell.t === 'n' && cell.z && /^0+$/.test(String(cell.z))) {
      // Only identifier masks carry meaningful formatting into accounting.
      // Currency/rate numbers retain their raw precision.
      normalized[address] = { t: 's', v: XLSX.utils.format_cell(cell) }
    }
  }
  return normalized
}
