import type {
  DecodedSheet,
  SpreadsheetRequest,
  SpreadsheetResponse,
} from './spreadsheet-types.ts'
import { cachedWorkbook } from './workbook-cache.ts'

/** A separate worker keeps XLSX decompression and parsing off the UI thread. */
function decodeWorkbook(
  buffer: ArrayBuffer,
  mode: SpreadsheetRequest['mode'],
  signal?: AbortSignal,
  headerRow = 1,
  format: 'csv' | 'xlsx' = 'xlsx',
  selectedSheets?: Record<string, { headerRow: number }>,
  sheetName?: string,
): Promise<DecodedSheet[]> {
  signal?.throwIfAborted()
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL('../workers/spreadsheet.worker.ts', import.meta.url),
      { type: 'module' },
    )
    const cleanup = () => {
      worker.terminate()
      signal?.removeEventListener('abort', abort)
    }
    const abort = () => {
      cleanup()
      reject(signal?.reason ?? new DOMException('Cancelled', 'AbortError'))
    }
    signal?.addEventListener('abort', abort, { once: true })
    worker.onmessage = (event: MessageEvent<SpreadsheetResponse>) => {
      cleanup()
      if (event.data.sheets) resolve(event.data.sheets)
      else
        reject(new Error(event.data.error ?? 'Unable to decode this workbook.'))
    }
    worker.onerror = (event) => {
      event.preventDefault()
      cleanup()
      reject(new Error(event.message || 'The spreadsheet worker failed.'))
    }
    const request: SpreadsheetRequest = {
      buffer,
      mode,
      headerRow,
      format,
      selectedSheets,
      sheetName,
    }
    worker.postMessage(request, [buffer])
  })
}

export async function decodeSpreadsheet(
  buffer: ArrayBuffer,
  signal?: AbortSignal,
  headerRow = 1,
  format: 'csv' | 'xlsx' = 'xlsx',
  sheetName?: string,
  file?: File,
): Promise<string> {
  const workbook = cachedWorkbook(file)
  if (workbook) {
    const { workbookToCSV } = await import('./spreadsheet')
    return workbookToCSV(buffer, signal, headerRow, format, sheetName, workbook)
  }
  return (
    await decodeWorkbook(
      buffer,
      'first',
      signal,
      headerRow,
      format,
      undefined,
      sheetName,
    )
  )[0].csv
}

export function decodeDimSpreadsheet(
  buffer: ArrayBuffer,
  signal?: AbortSignal,
  headerRow = 1,
  selectedSheets?: Record<string, { headerRow: number }>,
  file?: File,
): Promise<DecodedSheet[]> {
  const workbook = cachedWorkbook(file)
  if (workbook)
    return import('./spreadsheet').then(({ workbookToSheets }) =>
      workbookToSheets(buffer, signal, headerRow, selectedSheets, workbook),
    )
  return decodeWorkbook(
    buffer,
    'dim',
    signal,
    headerRow,
    'xlsx',
    selectedSheets,
  )
}
