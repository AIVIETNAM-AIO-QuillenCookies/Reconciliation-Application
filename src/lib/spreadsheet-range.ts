import * as XLSX from 'xlsx'
import { HeaderRowError, validateHeaderRow } from './header-row.ts'

/** Ignore rows above the chosen header and columns used only by their metadata. */
export function selectedSheetRange(
  sheet: XLSX.WorkSheet,
  headerRow: number,
): XLSX.Range {
  validateHeaderRow(headerRow)
  const ref = sheet['!ref']
  if (!ref)
    throw new HeaderRowError('No column headers found in this worksheet.')
  const range = XLSX.utils.decode_range(ref)
  range.s.r = headerRow - 1
  let firstColumn = Infinity
  let lastColumn = -1
  for (const address of Object.keys(sheet)) {
    if (address.startsWith('!')) continue
    const position = XLSX.utils.decode_cell(address)
    if (position.r < range.s.r || position.r > range.e.r) continue
    const cell = sheet[address] as XLSX.CellObject
    if (!cell.f && (cell.v == null || cell.v === '')) continue
    firstColumn = Math.min(firstColumn, position.c)
    lastColumn = Math.max(lastColumn, position.c)
  }
  if (lastColumn < 0)
    throw new HeaderRowError(
      `No column headers found on row ${headerRow}. Choose the row containing column names.`,
    )
  range.s.c = firstColumn
  range.e.c = lastColumn
  return range
}
