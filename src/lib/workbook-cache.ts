import type * as XLSX from 'xlsx'

// A guide workbook is parsed once after consent. File identity is shared by its
// source roles; WeakMap ownership releases the parsed cells with the demo session.
const workbooks = new WeakMap<File, XLSX.WorkBook>()
export function rememberWorkbook(file: File, workbook: XLSX.WorkBook) {
  workbooks.set(file, workbook)
}
export function cachedWorkbook(file?: File): XLSX.WorkBook | undefined {
  return file ? workbooks.get(file) : undefined
}
