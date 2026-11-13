import {
  parseDimMappingPreviews,
  parseMappingPreview,
} from '../lib/mapping-preview'
import type { FilePreview } from '../lib/data-mapping'
import { HeaderRowError, type PreviewErrorKind } from '../lib/header-row'

const scope = self as unknown as {
  onmessage: (
    event: MessageEvent<{
      buffer: ArrayBuffer
      extension: 'csv' | 'xlsx'
      mode: 'first' | 'dim'
      headerRow?: number
      sheetName?: string
    }>,
  ) => void
  postMessage: (message: {
    previews?: FilePreview[]
    error?: string
    errorKind?: PreviewErrorKind
  }) => void
}
scope.onmessage = ({ data }) => {
  try {
    scope.postMessage({
      previews:
        data.mode === 'dim'
          ? parseDimMappingPreviews(
              data.buffer,
              data.extension,
              data.headerRow,
              data.sheetName,
            )
          : [parseMappingPreview(data.buffer, data.extension, data.headerRow)],
    })
  } catch (error) {
    scope.postMessage({
      error: error instanceof Error ? error.message : String(error),
      errorKind: error instanceof HeaderRowError ? 'header-row' : 'file',
    })
  }
}
