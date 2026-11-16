import { formatUSD } from './format-money.ts'

export const EXCEPTION_CATEGORIES = [
  'Data Error',
  'Missing GL',
  'Unexplained',
] as const
export type ExceptionCategory = (typeof EXCEPTION_CATEGORIES)[number]
export type CategoryFilter = ExceptionCategory | 'All'
export type ExceptionSort = {
  key: 'impact' | 'date' | 'store'
  direction: 'asc' | 'desc'
}

interface ExceptionBase {
  id: string
  /** Linked GL controls are the same exposure, never extra financial adjustments. */
  reviewCaseIds?: string[]
  storeKey: string | null
  date: string
  reference: string
  /** Source minus GL, in exact integer cents. Preserve the supplied sign. */
  deltaCents: number
  description: string
}

export type ReconciliationException = ExceptionBase &
  (
    | {
        category: 'Data Error'
        type: 'Duplicate POS'
        duplicateLineCount: number
      }
    | { category: 'Missing GL'; type: 'Missing GL' }
    | { category: 'Unexplained'; type: 'Manual Journal' | 'Daily Variance' }
  )

/** Default Exception Log filter: strictly greater than $200.00, no percentage test. */
export const DEFAULT_EXCEPTION_THRESHOLD_CENTS = 20_000

export function filterExceptions(
  rows: readonly ReconciliationException[],
  {
    query = '',
    category = 'All',
    thresholdCents = DEFAULT_EXCEPTION_THRESHOLD_CENTS,
    sort = { key: 'impact', direction: 'desc' },
  }: {
    query?: string
    category?: CategoryFilter
    thresholdCents?: number
    sort?: ExceptionSort
  } = {},
): ReconciliationException[] {
  if (!Number.isSafeInteger(thresholdCents) || thresholdCents < 0)
    throw new Error('Threshold must be non-negative integer cents.')
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  return rows
    .filter((row) => {
      // Strictly greater than: a $200.00 difference does not breach a $200 threshold.
      if (
        Math.abs(row.deltaCents) <= thresholdCents ||
        (category !== 'All' && row.category !== category)
      )
        return false
      const searchable = [
        row.storeKey ?? 'not specified',
        row.category,
        row.type,
        row.reference,
        row.id,
        row.description,
      ]
        .join(' ')
        .toLowerCase()
      return tokens.every((token) => searchable.includes(token))
    })
    .sort((a, b) => {
      const comparison =
        sort.key === 'impact'
          ? Math.abs(a.deltaCents) - Math.abs(b.deltaCents)
          : sort.key === 'date'
            ? a.date.localeCompare(b.date)
            : (a.storeKey ?? '\uffff').localeCompare(b.storeKey ?? '\uffff')
      return comparison === 0
        ? a.id.localeCompare(b.id)
        : comparison * (sort.direction === 'asc' ? 1 : -1)
    })
}

export function signedDelta(cents: number): string {
  return `${cents > 0 ? '+' : ''}${formatUSD(cents)}`
}

export function exceptionActionLabel(row: ReconciliationException): string {
  if (row.type === 'Duplicate POS') return 'Generate IT Ticket (Email)'
  return row.category === 'Missing GL'
    ? 'Export CSV for ERP'
    : 'Send inquiry to Finance'
}

/** No recipient is invented. The user reviews recipients and sends in their email client. */
export function buildExceptionMailto(
  row: ReconciliationException,
  sample = false,
): string {
  if (row.category === 'Missing GL')
    throw new Error('Missing GL cases use the ERP CSV action.')
  const store = row.storeKey ? `Store ${row.storeKey}` : 'store not specified'
  const subject =
    `${sample ? '[SAMPLE] ' : ''}${row.type === 'Duplicate POS' ? 'Alert: Duplicate POS export detected' : 'Finance inquiry'} — ${store} — ${row.reference}`.replace(
      /[\r\n]+/g,
      ' ',
    )
  const body = [
    row.type === 'Duplicate POS' ? 'Hello IT team,' : 'Hello Finance team,',
    '',
    ...(sample ? ['SAMPLE CASE — for demonstration only.', ''] : []),
    `${row.type} detected at ${store} on ${row.date}.`,
    `Exception: ${row.id}`,
    `Reference: ${row.reference}`,
    `Category: ${row.category}`,
    `Delta (source minus GL): ${signedDelta(row.deltaCents)} USD`,
    ...(row.type === 'Duplicate POS'
      ? [`Duplicate lines: ${row.duplicateLineCount}`]
      : []),
    '',
    row.description,
    '',
    row.type === 'Duplicate POS'
      ? 'Please investigate the export job and confirm the duplicate removal approach.'
      : 'Please provide the supporting journal detail and explain the difference.',
    '',
    'Prepared in Reconciliation Auto-Pilot.',
  ].join('\r\n')
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

/** Quote CSV text and neutralize spreadsheet formulas without altering numeric deltas. */
function csvText(value: string): string {
  const safe =
    /^[\s]*[=+\-@]/.test(value) || /^[\t\r\n]/.test(value) ? `'${value}` : value
  return `"${safe.replaceAll('"', '""')}"`
}

export function buildERPReviewCSV(
  rows: readonly ReconciliationException[],
  sample = false,
): string {
  const headers = [
    'record_type',
    'exception_id',
    'store_key',
    'business_date',
    'reference',
    'category',
    'delta_usd',
    'currency',
    'description',
    'review_status',
    'dataset',
  ]
  const lines = rows.map((row) => {
    const cents = BigInt(row.deltaCents)
    const absolute = cents < 0n ? -cents : cents
    const amount = `${cents < 0n ? '-' : ''}${absolute / 100n}.${(absolute % 100n).toString().padStart(2, '0')}`
    return [
      csvText('RECONCILIATION_REVIEW'),
      csvText(row.id),
      csvText(row.storeKey ?? ''),
      csvText(row.date),
      csvText(row.reference),
      csvText(row.category),
      amount,
      csvText('USD'),
      csvText(row.description),
      csvText('DRAFT_REVIEW_REQUIRED'),
      csvText(sample ? 'SAMPLE' : 'UPLOADED'),
    ].join(',')
  })
  // UTF-8 BOM helps Excel open the download; this is a review template, not an ERP posting file.
  return '\uFEFF' + [headers.join(','), ...lines].join('\r\n') + '\r\n'
}
