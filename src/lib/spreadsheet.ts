import * as XLSX from 'xlsx'
import type { DecodedSheet } from './spreadsheet-types.ts'
import { HeaderRowError, validateHeaderRow } from './header-row.ts'
import { normalizeSpreadsheetValues } from './spreadsheet-values.ts'

function readWorkbook(buffer: ArrayBuffer): XLSX.WorkBook {
  const signature = new Uint8Array(buffer, 0, Math.min(4, buffer.byteLength))
  // SheetJS also accepts plaintext. Do not silently treat a broken .xlsx as CSV.
  if (signature.length < 4 || signature[0] !== 0x50 || signature[1] !== 0x4b)
    throw new Error(
      'This file is not a valid XLSX workbook. Export it as XLSX or CSV and try again.',
    )
  return XLSX.read(buffer, {
    type: 'array',
    cellDates: false,
    cellText: false,
    cellNF: true,
  })
}

function sheetCSV(
  sheet: XLSX.WorkSheet,
  headerRow: number,
  date1904 = false,
): string {
  validateHeaderRow(headerRow)
  const normalized = normalizeSpreadsheetValues(sheet, headerRow, date1904)
  return XLSX.utils.sheet_to_csv(normalized, {
    blankrows: false,
    rawNumbers: true,
    dateNF: 'yyyy-mm-dd',
  })
}

/** Revenue workbooks use the first worksheet, including GL and Flash exports. */
export async function workbookToCSV(
  buffer: ArrayBuffer,
  signal?: AbortSignal,
  headerRow = 1,
  format: 'csv' | 'xlsx' = 'xlsx',
): Promise<string> {
  signal?.throwIfAborted()
  if (format === 'csv') return csvFromHeaderRow(buffer, headerRow)
  const workbook = readWorkbook(buffer)
  const first = workbook.SheetNames[0]
  if (!first || !workbook.Sheets[first]?.['!ref'])
    throw new Error('The first worksheet is empty or missing.')
  const csv = sheetCSV(
    workbook.Sheets[first],
    headerRow,
    !!workbook.Workbook?.WBProps?.date1904,
  )
  if (!csv.trim()) throw new Error('The first worksheet is empty.')
  return csv
}

/** Dim workbooks retain every non-empty dimension sheet, with its original name. */
export async function workbookToSheets(
  buffer: ArrayBuffer,
  signal?: AbortSignal,
  headerRow = 1,
  selectedSheets?: Record<string, { headerRow: number }>,
): Promise<DecodedSheet[]> {
  const workbook = readWorkbook(buffer)
  const sheets: DecodedSheet[] = []
  for (const name of Object.keys(selectedSheets ?? {}))
    if (!workbook.SheetNames.includes(name))
      throw new Error(`Selected worksheet no longer exists: ${name}`)
  for (const name of workbook.SheetNames) {
    if (selectedSheets && !Object.hasOwn(selectedSheets, name)) continue
    signal?.throwIfAborted()
    const sheet = workbook.Sheets[name]
    if (!sheet?.['!ref']) continue
    try {
      const csv = sheetCSV(
        sheet,
        selectedSheets?.[name]?.headerRow ?? headerRow,
        !!workbook.Workbook?.WBProps?.date1904,
      )
      if (csv.trim()) sheets.push({ name, csv })
    } catch (error) {
      throw new Error(
        `${name}: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }
  if (!sheets.length)
    throw new Error('The Dim workbook has no non-empty worksheets.')
  return sheets
}

/** Re-serialize CSV records rather than splitting lines, which may contain quoted newlines. */
export async function csvFromHeaderRow(
  buffer: ArrayBuffer,
  headerRow = 1,
): Promise<string> {
  validateHeaderRow(headerRow)
  let text: string
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(buffer)
  } catch {
    throw new Error('Save this file as CSV UTF-8 or XLSX, then try again.')
  }
  const workbook = XLSX.read(text, {
    type: 'string',
    raw: true,
    cellDates: false,
  })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  if (!sheet?.['!ref'])
    throw new HeaderRowError('The CSV file has no header row.')
  return sheetCSV(sheet, headerRow)
}
