import * as XLSX from 'xlsx'
import type { FilePreview } from './data-mapping.ts'
import { HeaderRowError, validateHeaderRow } from './header-row.ts'
import { selectedSheetRange } from './spreadsheet-range.ts'
import { normalizeSpreadsheetValues } from './spreadsheet-values.ts'

function readPreviewWorkbook(
  buffer: ArrayBuffer,
  extension: 'csv' | 'xlsx',
  allSheets = false,
  headerRow = 1,
  sheetName?: string,
): XLSX.WorkBook {
  validateHeaderRow(headerRow)
  if (extension === 'xlsx') {
    const signature = new Uint8Array(buffer, 0, Math.min(4, buffer.byteLength))
    if (
      signature.length < 4 ||
      signature[0] !== 0x50 ||
      signature[1] !== 0x4b
    ) {
      throw new Error(
        'This is not a valid XLSX workbook. Export it as CSV or XLSX and try again.',
      )
    }
  }
  let input: ArrayBuffer | string = buffer
  if (extension === 'csv') {
    try {
      input = new TextDecoder('utf-8', { fatal: true }).decode(buffer)
    } catch {
      throw new Error('Save this file as CSV UTF-8 or XLSX, then try again.')
    }
  }
  return XLSX.read(input, {
    type: extension === 'csv' ? 'string' : 'array',
    raw: true,
    cellText: true,
    cellDates: false,
    cellNF: true,
    sheetRows: headerRow + 6,
    sheets: allSheets ? undefined : (sheetName ?? 0),
  })
}

/** Shared with a dedicated worker and Node tests; no financial coercion occurs here. */
export function parseMappingPreview(
  buffer: ArrayBuffer,
  extension: 'csv' | 'xlsx',
  headerRow = 1,
  sheetName?: string,
): FilePreview {
  const workbook = readPreviewWorkbook(
    buffer,
    extension,
    false,
    headerRow,
    sheetName,
  )
  const name = sheetName ?? workbook.SheetNames[0]
  if (sheetName && !workbook.SheetNames.includes(sheetName))
    throw new Error(`Selected worksheet no longer exists: ${sheetName}`)
  const sheet = workbook.Sheets[name]
  if (!sheet?.['!ref'])
    throw new HeaderRowError(
      'The first worksheet is empty. Add a header row and try again.',
    )
  return {
    ...sheetPreview(
      sheet,
      extension === 'xlsx' ? name : null,
      headerRow,
      !!workbook.Workbook?.WBProps?.date1904,
    ),
    sheetNames: workbook.SheetNames,
  }
}

/** Dimensions keep every non-empty sheet, using bounded samples of each. */
export function parseDimMappingPreviews(
  buffer: ArrayBuffer,
  extension: 'csv' | 'xlsx',
  headerRow = 1,
  sheetName?: string,
): FilePreview[] {
  const workbook = readPreviewWorkbook(buffer, extension, true, headerRow)
  const previews = workbook.SheetNames.flatMap((name) => {
    if (sheetName && name !== sheetName) return []
    const sheet = workbook.Sheets[name]
    if (!sheet?.['!ref']) return []
    try {
      return [
        sheetPreview(
          sheet,
          extension === 'xlsx' ? name : null,
          headerRow,
          !!workbook.Workbook?.WBProps?.date1904,
        ),
      ]
    } catch (error) {
      const message = `${name}: ${error instanceof Error ? error.message : String(error)}`
      return [
        {
          sheetName: name,
          headerRow,
          headers: [],
          rows: [],
          hasMoreRows: false,
          error: message,
        },
      ]
    }
  })
  if (!previews.length)
    throw new Error('The master workbook has no non-empty worksheets.')
  return previews
}

export function sheetPreview(
  sheet: XLSX.WorkSheet,
  sheetName: string | null,
  headerRow: number,
  date1904 = false,
): FilePreview {
  const range = selectedSheetRange(sheet, headerRow)
  if (range.e.c - range.s.c > 1023)
    throw new Error(
      'This file has more than 1,024 columns. Remove empty or unused columns and try again.',
    )
  let values: string[][]
  try {
    values = XLSX.utils.sheet_to_json<string[]>(
      { ...sheet, '!ref': XLSX.utils.encode_range(range) },
      {
        range: headerRow - 1,
        header: 1,
        raw: false,
        defval: '',
        blankrows: true,
      },
    )
  } catch (error) {
    throw new HeaderRowError(
      `Unable to read headers on row ${headerRow}. ${error instanceof Error ? error.message : String(error)}`,
    )
  }
  const headers = (values[0] ?? []).map((header) => String(header))
  if (!headers.length || headers.every((header) => !header.trim()))
    throw new HeaderRowError(
      `No column headers found on row ${headerRow}. Choose the row containing column names.`,
    )
  const blank = headers.findIndex((header) => !header.trim())
  if (blank !== -1)
    throw new HeaderRowError(
      `Column ${XLSX.utils.encode_col(blank + range.s.c)} has no header on row ${headerRow}. Choose the row containing column names.`,
    )
  const normalized = headers.map((header) => header.trim().toLowerCase())
  const duplicate = normalized.findIndex(
    (header, index) => normalized.indexOf(header) !== index,
  )
  if (duplicate !== -1)
    throw new HeaderRowError(
      `Duplicate header "${headers[duplicate]}". Give each column a unique name.`,
    )
  const rows = values
    .slice(1)
    .map((row) => headers.map((_, index) => String(row[index] ?? '')))
  const normalizedValues = XLSX.utils.sheet_to_json<unknown[]>(
    normalizeSpreadsheetValues(sheet, headerRow, date1904),
    { range: headerRow - 1, header: 1, raw: true, defval: '', blankrows: true },
  )
  return {
    headers,
    rows: rows.slice(0, 5),
    normalizedRows: normalizedValues
      .slice(1, 6)
      .map((row) => headers.map((_, index) => String(row[index] ?? ''))),
    sheetName,
    headerRow,
    startColumn: range.s.c,
    hasMoreRows:
      rows.length > 5 ||
      (sheet['!fullref'] != null &&
        XLSX.utils.decode_range(sheet['!fullref']).e.r > headerRow + 4),
  }
}
