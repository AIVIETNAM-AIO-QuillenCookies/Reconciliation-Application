import {
  buildERPReviewCSV,
  type ReconciliationException,
} from './exceptions.ts'

/** Local file download only. No ERP endpoint is called. */
export function downloadERPReviewCSV(
  rows: readonly ReconciliationException[],
  sample: boolean,
): void {
  const blob = new Blob([buildERPReviewCSV(rows, sample)], {
    type: 'text/csv;charset=utf-8;',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download =
    rows.length === 1
      ? `erp-review-${rows[0].id.replace(/[^a-zA-Z0-9_-]/g, '_')}.csv`
      : 'erp-review-filtered.csv'
  document.body.appendChild(anchor)
  try {
    anchor.click()
  } finally {
    anchor.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
}
