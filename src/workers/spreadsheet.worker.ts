import { workbookToCSV, workbookToSheets } from '../lib/spreadsheet'
import type {
  SpreadsheetRequest,
  SpreadsheetResponse,
} from '../lib/spreadsheet-types'

const scope = self as unknown as {
  onmessage: (event: MessageEvent<SpreadsheetRequest>) => void
  postMessage: (message: SpreadsheetResponse, transfer?: Transferable[]) => void
}
scope.onmessage = (event) => {
  const {
    buffer,
    mode,
    headerRow = 1,
    format = 'xlsx',
    selectedSheets,
    sheetName,
  } = event.data
  const decode =
    mode === 'dim'
      ? workbookToSheets(buffer, undefined, headerRow, selectedSheets)
      : workbookToCSV(buffer, undefined, headerRow, format, sheetName).then(
          (csv) => [{ name: 'source', csv }],
        )
  void decode
    .then((sheets) => {
      scope.postMessage({ sheets })
    })
    .catch((error: unknown) => {
      scope.postMessage({
        error: error instanceof Error ? error.message : String(error),
      })
    })
}
