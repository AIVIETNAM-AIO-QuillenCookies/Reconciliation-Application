import type { FilePreview } from './data-mapping.ts'
import { HeaderRowError, type PreviewErrorKind } from './header-row.ts'
import { cachedWorkbook } from './workbook-cache.ts'

/** Reading only the preview in a disposable worker keeps the mapping view responsive. */
export async function readMappingPreviews(
  file: File,
  signal: AbortSignal,
  mode: 'first' | 'dim' = 'first',
  headerRow = 1,
  sheetName?: string,
): Promise<FilePreview[]> {
  signal.throwIfAborted()
  const cached = cachedWorkbook(file)
  if (cached) {
    const { sheetPreview } = await import('./mapping-preview')
    signal.throwIfAborted()
    return (
      mode === 'dim'
        ? cached.SheetNames.filter((name) => !sheetName || name === sheetName)
        : [sheetName ?? cached.SheetNames[0]]
    )
      .filter((name) => cached.Sheets[name]?.['!ref'])
      .map((name) => {
        try {
          return {
            ...sheetPreview(
              cached.Sheets[name],
              name,
              headerRow,
              !!cached.Workbook?.WBProps?.date1904,
            ),
            sheetNames: cached.SheetNames,
          }
        } catch (error) {
          if (mode !== 'dim') throw error
          return {
            sheetName: name,
            headerRow,
            headers: [],
            rows: [],
            hasMoreRows: false,
            error: error instanceof Error ? error.message : String(error),
          }
        }
      })
  }
  const buffer = await file.arrayBuffer()
  signal.throwIfAborted()
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL('../workers/mapping-preview.worker.ts', import.meta.url),
      { type: 'module' },
    )
    const cleanup = () => {
      worker.terminate()
      signal.removeEventListener('abort', abort)
    }
    const abort = () => {
      cleanup()
      reject(signal.reason)
    }
    signal.addEventListener('abort', abort, { once: true })
    worker.onmessage = ({
      data,
    }: MessageEvent<{
      previews?: FilePreview[]
      error?: string
      errorKind?: PreviewErrorKind
    }>) => {
      cleanup()
      if (data.previews?.length) resolve(data.previews)
      else {
        const message = data.error ?? 'Unable to preview this file.'
        reject(
          data.errorKind === 'header-row'
            ? new HeaderRowError(message)
            : new Error(message),
        )
      }
    }
    worker.onerror = (event) => {
      event.preventDefault()
      cleanup()
      reject(new Error(event.message || 'The file preview worker failed.'))
    }
    worker.postMessage(
      {
        buffer,
        extension: file.name.toLowerCase().endsWith('.xlsx') ? 'xlsx' : 'csv',
        mode,
        headerRow,
        sheetName,
      },
      [buffer],
    )
  })
}

export async function readMappingPreview(
  file: File,
  signal: AbortSignal,
  headerRow = 1,
  sheetName?: string,
): Promise<FilePreview> {
  return (
    await readMappingPreviews(file, signal, 'first', headerRow, sheetName)
  )[0]
}
