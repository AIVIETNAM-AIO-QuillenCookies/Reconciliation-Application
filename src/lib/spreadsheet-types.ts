export interface DecodedSheet {
  name: string
  csv: string
}
export interface SpreadsheetRequest {
  buffer: ArrayBuffer
  mode: 'first' | 'dim'
  headerRow?: number
  format?: 'csv' | 'xlsx'
  selectedSheets?: Record<string, { headerRow: number }>
}
export interface SpreadsheetResponse {
  sheets?: DecodedSheet[]
  error?: string
}
