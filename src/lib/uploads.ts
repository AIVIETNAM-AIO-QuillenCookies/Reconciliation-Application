export const REQUIRED_SOURCES = ['POS', 'WEB', 'GL', 'Flash'] as const
export type FactSource = (typeof REQUIRED_SOURCES)[number]
export const SOURCES = [...REQUIRED_SOURCES, 'Dim'] as const
export type Source = (typeof SOURCES)[number]
export const MAX_FILE_BYTES = 50 * 1024 * 1024
export const ACCEPTED_EXTENSIONS = ['csv', 'xlsx'] as const
export const MAX_FILES = 20
export const MAX_BATCH_BYTES = 200 * 1024 * 1024

export interface QueuedFile {
  id: string
  file: File
  source: Source | ''
  sample?: boolean
  /** One-based source row containing column names. Defaults to the first row. */
  headerRow?: number
  /** Explicit fact worksheet; omitted preserves the first-sheet import default. */
  sheetName?: string
}

export function fileKey(file: File): string {
  return `${file.name}:${file.size}:${file.lastModified}`
}

export function validateFile(file: File): string | null {
  const extension = file.name.split('.').pop()?.toLowerCase()
  if (extension === 'xls')
    return `${file.name}: legacy XLS is not supported. Save it as XLSX or CSV.`
  if (!ACCEPTED_EXTENSIONS.some((accepted) => accepted === extension))
    return `${file.name}: use CSV or XLSX.`
  if (file.size === 0) return `${file.name}: this file is empty.`
  if (file.size > MAX_FILE_BYTES)
    return `${file.name}: exceeds the 50 MB limit.`
  return null
}

export function inferSource(filename: string): Source | '' {
  const tokens = filename.toLowerCase().split(/[^a-z0-9]+/)
  // The workbook's original filename stays Nexa_Home_Master_Data.xlsx.
  if (tokens.includes('master')) return 'Dim'
  return SOURCES.find((source) => tokens.includes(source.toLowerCase())) ?? ''
}

export function formatFileSize(bytes: number): string {
  return bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(1)} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
