import {
  serializeConventionDocument,
  type ConventionDocument,
} from './convention-document.ts'

/** Local file download only; the document is never sent anywhere. */
export function downloadConventionDocument(document: ConventionDocument) {
  const fileName = `quy-uoc-ghi-nhan-v${document.version}.json`
  const blob = new Blob([serializeConventionDocument(document)], {
    type: 'application/json;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const anchor = window.document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  window.document.body.appendChild(anchor)
  try {
    anchor.click()
  } finally {
    anchor.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return fileName
}
