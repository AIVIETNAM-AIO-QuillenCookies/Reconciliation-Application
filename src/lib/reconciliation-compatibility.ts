import type { FactSource } from './uploads.ts'
import type { ReconciliationPeriod } from './reconciliation-types.ts'

export type SchemaMode = 'accounting' | 'compatible' | 'strict'
const identifier = (value: string) => `"${value.replaceAll('"', '""')}"`
const literal = (value: string) => `'${value.replaceAll("'", "''")}'`
const normalized = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]/g, '')
const text = (column: string) => `CAST(${identifier(column)} AS VARCHAR)`
// Temporary US-first parsing for ambiguous slash dates. Strict mode keeps its
// original parser; source-specific date/locale rules will replace this adapter.
const compatibleDateSQL = (column: string) =>
  `COALESCE(TRY_CAST(NULLIF(TRIM(${column}), '') AS DATE), CAST(TRY_STRPTIME(TRIM(${column}), '%m/%d/%Y') AS DATE), CAST(TRY_STRPTIME(TRIM(${column}), '%d/%m/%Y') AS DATE))`

/** Temporary placeholder conversion only: currency conversion is NOT performed. */
function money(column: string, unsigned = true): string {
  const parsed = `COALESCE(TRY_CAST(REPLACE(REPLACE(TRIM(${text(column)}), ',', ''), '$', '') AS DECIMAL(18,2)), 0)`
  return `CAST(${unsigned ? `ABS(${parsed})` : parsed} AS VARCHAR)`
}

/** Build one complete canonical SQL projection per file BEFORE views reference it.
 * Canonical fields also receive temporary conversions so malformed dates, blank
 * identifiers, and nonnumeric amounts cannot block the UI preview.
 * Keep this adapter separate so the temporary behavior can be removed cleanly.
 */
export function compatibleProjection(
  source: FactSource,
  columns: readonly string[],
  period: ReconciliationPeriod,
  fileIndex: number,
) {
  const warnings: string[] = []
  const fields: Record<string, string> = {}
  const find = (names: string[]) => {
    for (const name of names) {
      const exact = columns.find(
        (column) => column.toLowerCase() === name.toLowerCase(),
      )
      if (exact) return exact
      const folded = columns.find(
        (column) => normalized(column) === normalized(name),
      )
      if (folded) return folded
    }
    return undefined
  }
  const set = (
    target: string,
    aliases: string[],
    fallback: string,
    description: string,
    convert: (column: string) => string = text,
  ) => {
    const canonical = find([target])
    if (canonical) {
      fields[target] = convert(canonical)
      if (canonical !== target)
        warnings.push(`${target}: mapped header ${canonical}.`)
    } else {
      const alias = find(aliases)
      fields[target] = alias ? convert(alias) : fallback
      warnings.push(
        `${target}: ${alias ? `derived from ${alias}` : description}.`,
      )
    }
    return fields[target]
  }
  const zero = "'0.00'"
  const rowNumber = 'CAST(ROW_NUMBER() OVER () AS VARCHAR)'
  const syntheticId = `${literal(`${source}_${fileIndex}_`)} || ${rowNumber}`
  const iso = (column: string, fallback: string) =>
    `CAST(COALESCE(${compatibleDateSQL(text(column))}, TRY_CAST(${fallback} AS DATE)) AS VARCHAR)`
  const store = () =>
    set(
      'store_key',
      [
        'store_code',
        'store_id',
        'store',
        'branch_code',
        'branch_id',
        'location_code',
      ],
      "'NX001'",
      "placeholder store 'NX001'",
      (column) => `COALESCE(NULLIF(TRIM(${text(column)}), ''), 'NX001')`,
    )
  const amountAliases = [
    'net_usd',
    'net_amount',
    'net_sales',
    'net_amount_usd',
    'amount',
    'amount_usd',
    'sales_amount',
    'total_amount',
    'total',
  ]
  let posPostingDateFallback = false

  if (source === 'POS') {
    const syntheticIdentity =
      !find([
        'receipt_no',
        'receipt_id',
        'receipt',
        'transaction_id',
        'transaction_no',
        'invoice_no',
      ]) || !find(['line_no', 'line_number', 'line', 'item_line'])
    set(
      'receipt_no',
      [
        'receipt_id',
        'receipt',
        'transaction_id',
        'transaction_no',
        'invoice_no',
      ],
      syntheticId,
      'generated receipt IDs; transaction identity is synthetic',
    )
    set(
      'line_no',
      ['line_number', 'line', 'item_line'],
      rowNumber,
      'generated row numbers; original line identity is unavailable',
    )
    set(
      'export_seq',
      ['export_sequence', 'export_sequence_no'],
      "'1'",
      'placeholder export sequence 1; duplicate export detection is limited',
    )
    if (
      syntheticIdentity &&
      find(['export_seq', 'export_sequence', 'export_sequence_no'])
    ) {
      // Generated row identities cannot be linked across export sequences.
      fields.export_seq = "'1'"
      warnings.push(
        'export_seq: reset to 1 for generated row identities; duplicate detection is unavailable for this file.',
      )
    }
    store()
    const business = set(
      'business_date',
      ['transaction_date', 'sales_date', 'receipt_date', 'date'],
      literal(period.start),
      'reporting period start date',
      (column) => iso(column, literal(period.start)),
    )
    posPostingDateFallback = !find([
      'posting_date',
      'posted_date',
      'posting_day',
    ])
    set(
      'posting_date',
      ['posted_date', 'posting_day'],
      business,
      'business_date used as posting_date',
      (column) => iso(column, business),
    )
    set(
      'net_usd_month_end',
      amountAliases,
      zero,
      'placeholder 0.00; no recognized amount column',
      money,
    )
    set(
      'discount_usd_daily',
      ['discount_usd', 'discount_amount', 'discount'],
      zero,
      'placeholder 0.00 discount',
      money,
    )
  } else if (source === 'WEB') {
    set(
      'web_order_id',
      [
        'order_id',
        'order_no',
        'order_number',
        'web_order_no',
        'transaction_id',
      ],
      syntheticId,
      'generated order IDs; transaction identity is synthetic',
    )
    store()
    const order = set(
      'order_date',
      ['business_date', 'transaction_date', 'created_date', 'date'],
      literal(period.start),
      'reporting period start date',
      (column) => iso(column, literal(period.start)),
    )
    const status = set(
      'order_status',
      ['status', 'state'],
      "'Delivered'",
      "placeholder status 'Delivered'",
      (column) =>
        `CASE WHEN LOWER(TRIM(${text(column)})) IN ('cancelled','canceled') THEN 'Cancelled' WHEN LOWER(TRIM(${text(column)})) IN ('returned','refunded') THEN 'Returned' ELSE 'Delivered' END`,
    )
    const cancelled = `LOWER(TRIM(${status})) = 'cancelled'`
    const returned = `LOWER(TRIM(${status})) = 'returned'`
    const delivery = set(
      'delivery_date',
      ['delivered_date', 'shipped_date'],
      `CASE WHEN ${cancelled} THEN NULL ELSE ${order} END`,
      'order_date used for delivery; cancelled orders have no delivery',
      (column) =>
        `CASE WHEN ${cancelled} THEN NULL ELSE ${iso(column, order)} END`,
    )
    set(
      'return_date',
      ['returned_date', 'refund_date'],
      `CASE WHEN ${returned} THEN ${delivery} ELSE NULL END`,
      'delivery_date used for returned orders; otherwise no return',
      (column) =>
        `CASE WHEN ${returned} THEN ${iso(column, delivery)} ELSE NULL END`,
    )
    const discount = set(
      'discount_usd_daily',
      ['discount_usd', 'discount_amount', 'discount'],
      zero,
      'placeholder 0.00 discount',
      money,
    )
    const knownNet = find([
      'net_usd_month_end',
      ...amountAliases.filter((name) => name.startsWith('net')),
    ])
    const grossFallback = `CAST(COALESCE(TRY_CAST(${knownNet ? money(knownNet) : zero} AS DECIMAL(18,2)), 0) + TRY_CAST(${discount} AS DECIMAL(18,2)) AS VARCHAR)`
    const gross = set(
      'gross_usd_daily',
      [
        'gross_usd',
        'gross_amount',
        'gross_sales',
        'order_total',
        'amount',
        'amount_usd',
        'total_amount',
        'total',
      ],
      grossFallback,
      'known net plus discount, or zero net plus discount',
      money,
    )
    set(
      'net_usd_month_end',
      amountAliases.filter((name) => name.startsWith('net')),
      `CAST(GREATEST(TRY_CAST(${gross} AS DECIMAL(18,2)) - TRY_CAST(${discount} AS DECIMAL(18,2)), 0) AS VARCHAR)`,
      'gross minus discount, assuming no FX difference',
      money,
    )
  } else if (source === 'GL') {
    set(
      'journal_id',
      ['entry_id', 'journal_no', 'document_no', 'id'],
      syntheticId,
      'generated journal IDs',
    )
    store()
    set(
      'posting_date',
      ['journal_date', 'business_date', 'transaction_date', 'date'],
      literal(period.start),
      'reporting period start date',
      (column) => iso(column, literal(period.start)),
    )
    set(
      'journal_type',
      ['entry_type', 'type'],
      "'RAW_EXPORT'",
      "placeholder journal type 'RAW_EXPORT'",
    )
    const revenue = find(['revenue_usd', 'net_usd_month_end', 'net_revenue'])
    set(
      'amount_usd',
      ['amount', 'signed_amount', 'journal_amount'],
      revenue
        ? `CAST(-TRY_CAST(${money(revenue)} AS DECIMAL(18,2)) AS VARCHAR)`
        : zero,
      revenue
        ? `negative ${revenue}, assuming credit revenue`
        : 'placeholder 0.00; no recognized amount column',
      (column) => money(column, false),
    )
  } else {
    set(
      'month_end_date',
      ['month_end', 'business_date', 'order_date', 'date'],
      literal(period.end),
      'reporting period end date',
      (column) =>
        `CAST(LAST_DAY(COALESCE(${compatibleDateSQL(text(column))}, DATE ${literal(period.end)})) AS VARCHAR)`,
    )
    set(
      'revenue_usd',
      [
        'gross_usd_daily',
        'sales_usd',
        'gross_sales',
        'revenue',
        'amount',
        'amount_usd',
        'total_amount',
        'sales',
      ],
      zero,
      'placeholder 0.00; no recognized sales column',
      money,
    )
  }
  // Blank supplied keys are as unusable as absent columns. These defaults only
  // serve the temporary preview; they do not establish real transaction identity.
  for (const key of ['receipt_no', 'line_no', 'web_order_id', 'journal_id']) {
    if (fields[key])
      fields[key] = `COALESCE(NULLIF(TRIM(${fields[key]}), ''), ${syntheticId})`
  }
  if (fields.export_seq)
    fields.export_seq = `CAST(GREATEST(COALESCE(TRY_CAST(${fields.export_seq} AS BIGINT), 1), 1) AS VARCHAR)`
  if (fields.journal_type)
    fields.journal_type = `COALESCE(NULLIF(TRIM(${fields.journal_type}), ''), 'RAW_EXPORT')`
  return {
    projection: Object.entries(fields)
      .map(([name, expression]) => `${expression} AS ${identifier(name)}`)
      .join(', '),
    warnings,
    posPostingDateFallback,
  }
}
