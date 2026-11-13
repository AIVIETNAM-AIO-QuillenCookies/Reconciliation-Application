import * as XLSX from 'xlsx'
import { validateHeaderRow } from './header-row.ts'
import { selectedSheetRange } from './spreadsheet-range.ts'
import { normalizeSpreadsheetValues } from './spreadsheet-values.ts'

interface CSVRecord {
  sourceRow: number
  fields: string[]
  empty: boolean
}

/** Conservative RFC-style CSV scan. Unrecognized dialects have no asserted coordinates. */
function csvRecords(text: string, delimiter: string): CSVRecord[] | null {
  const records: CSVRecord[] = []
  let fields: string[] = []
  let value = ''
  let quoted = false
  let closed = false
  let fieldStart = true
  let row = 1
  let sourceRow = 1
  let recordStart = 0
  const finish = (end: number) => {
    records.push({
      sourceRow,
      fields: [...fields, value],
      empty: end === recordStart,
    })
    fields = []
    value = ''
    fieldStart = true
    closed = false
  }
  for (let index = 0; index < text.length; index++) {
    const char = text[index]
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          value += '"'
          index++
        } else {
          quoted = false
          closed = true
        }
      } else {
        value += char
        if (char === '\n' || (char === '\r' && text[index + 1] !== '\n')) row++
      }
      continue
    }
    if (char === '"') {
      if (!fieldStart || closed) return null
      quoted = true
      fieldStart = false
    } else if (char === delimiter) {
      fields.push(value)
      value = ''
      fieldStart = true
      closed = false
    } else if (char === '\n' || char === '\r') {
      finish(index)
      if (char === '\r' && text[index + 1] === '\n') index++
      row++
      sourceRow = row
      recordStart = index + 1
    } else {
      if (closed) return null
      value += char
      fieldStart = false
    }
  }
  if (quoted) return null
  if (recordStart < text.length) finish(text.length)
  return records
}

/**
 * Array index is imported record ordinal minus one; values are physical source
 * starting rows (CSV lines or first-sheet XLSX rows), never inferred offsets.
 * null means the source dialect/coordinates could not be established exactly.
 */
export async function sourceRecordRows(
  file: File,
  headerRow: number,
): Promise<number[] | null> {
  validateHeaderRow(headerRow)
  try {
    const buffer = await file.arrayBuffer()
    if (file.name.toLowerCase().endsWith('.xlsx')) {
      const signature = new Uint8Array(
        buffer,
        0,
        Math.min(4, buffer.byteLength),
      )
      if (signature[0] !== 0x50 || signature[1] !== 0x4b) return null
      const workbook = XLSX.read(buffer, {
        type: 'array',
        cellDates: false,
        cellNF: true,
        cellText: false,
        sheets: 0,
      })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      if (!sheet?.['!ref']) return null
      const range = selectedSheetRange(sheet, headerRow)
      const normalized = normalizeSpreadsheetValues(
        sheet,
        headerRow,
        !!workbook.Workbook?.WBProps?.date1904,
      )
      const nonempty = new Set<number>()
      for (const address of Object.keys(normalized)) {
        if (address.startsWith('!')) continue
        const { r, c } = XLSX.utils.decode_cell(address)
        const cell = normalized[address] as XLSX.CellObject
        if (
          r >= headerRow &&
          c >= range.s.c &&
          c <= range.e.c &&
          cell.v != null
        )
          nonempty.add(r + 1)
      }
      const rows = [...nonempty].sort((a, b) => a - b)
      const serialized = XLSX.utils.sheet_to_csv(normalized, {
        blankrows: false,
        rawNumbers: true,
        dateNF: 'yyyy-mm-dd',
      })
      const records = csvRecords(serialized, ',')
      return records && records.length === rows.length + 1 ? rows : null
    }
    if (!file.name.toLowerCase().endsWith('.csv')) return null
    const text = new TextDecoder('utf-8', { fatal: true })
      .decode(buffer)
      .replace(/^\uFEFF/, '')
    // SheetJS's sep= directive changes logical row selection; do not guess it.
    if (/^sep=./i.test(text)) return null
    const workbook = XLSX.read(text, {
      type: 'string',
      raw: true,
      cellDates: false,
    })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    if (!sheet?.['!ref']) return null
    const range = selectedSheetRange(sheet, headerRow)
    const header = Array.from(
      { length: range.e.c - range.s.c + 1 },
      (_, index) =>
        String(
          (
            sheet[
              XLSX.utils.encode_cell({ r: headerRow - 1, c: range.s.c + index })
            ] as XLSX.CellObject | undefined
          )?.v ?? '',
        ),
    )
    const candidates = [',', ';', '\t', '|'].flatMap((delimiter) => {
      const records = csvRecords(text, delimiter)
      const selected = records?.[headerRow - 1]
      if (!records || !selected || selected.fields.length <= 1) return []
      if (
        selected.fields
          .slice(range.s.c, range.e.c + 1)
          .some((field, index) => field !== header[index])
      )
        return []
      if (selected.fields.length !== range.e.c + 1) return []
      const data = records.slice(headerRow)
      if (headerRow === 1) {
        // Direct DuckDB registration skips physically empty lines, while a
        // delimiter-only record is still an imported row containing nulls.
        const kept = data.filter((record) => !record.empty)
        if (
          kept.some((record) => record.fields.length !== selected.fields.length)
        )
          return []
        return [kept.map((record) => record.sourceRow)]
      }
      // Selected-header CSVs go through sheetCSV(blankrows:false).
      return [
        data
          .filter((record) =>
            record.fields
              .slice(range.s.c, range.e.c + 1)
              .some((field) => field !== ''),
          )
          .map((record) => record.sourceRow),
      ]
    })
    return candidates.length === 1 ? candidates[0] : null
  } catch {
    return null
  }
}
