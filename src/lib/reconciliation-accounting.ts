import type { FactSource } from './uploads.ts'
import type { GLAmountBasis } from './gl-review.ts'
import { dateSQL } from './reconciliation-sql.ts'
import {
  mappingIssues,
  effectiveGLAmountBasis,
  type ColumnMapping,
  type MappingFieldId,
} from './data-mapping.ts'
import {
  quoteIdentifier as quote,
  quoteLiteral as literal,
} from './sql-quoting.ts'

// `quote` remains part of this module's public API for existing importers.
export { quote }
const folded = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '')
export const findColumn = (columns: readonly string[], names: string[]) =>
  names
    .map((name) => columns.find((column) => folded(column) === folded(name)))
    .find(Boolean)
const value = (column: string) =>
  `NULLIF(TRIM(CAST(input.${quote(column)} AS VARCHAR)), '')`

/** Preserve signs and cents. Unparseable inputs remain NULL and fail validation. */
export const usdSQL = (expression: string) =>
  `TRY_CAST(CASE WHEN regexp_full_match(TRIM(${expression}), '\\([0-9$,. +\\-]+\\)') THEN '-' || REPLACE(REPLACE(TRIM(${expression}), '(', ''), ')', '') ELSE TRIM(${expression}) END AS VARCHAR)`
export const amountSQL = (expression: string) => {
  const number = `TRIM(REPLACE(${usdSQL(expression)}, '$', ''))`
  return `TRY_CAST(CASE
    WHEN regexp_full_match(${number}, '[+-]?[0-9]+,[0-9]{1,2}') THEN REPLACE(${number}, ',', '.')
    WHEN regexp_full_match(${number}, '[+-]?[0-9]{1,3}(\\.[0-9]{3})+,[0-9]{1,2}') THEN REPLACE(REPLACE(${number}, '.', ''), ',', '.')
    WHEN regexp_full_match(${number}, '[+-]?([0-9]+|[0-9]{1,3}(,[0-9]{3})+)(\\.[0-9]{1,2})?') THEN REPLACE(${number}, ',', '')
    END AS DECIMAL(18,2))`
}

/** Shared by all sources and dimension aliases; leading-zero text keys survive. */
export const keySQL = (expression: string) =>
  `UPPER(CASE WHEN regexp_full_match(TRIM(${expression}), '[0-9]+\\.0+') THEN regexp_replace(TRIM(${expression}), '\\.0+$', '') ELSE NULLIF(TRIM(${expression}), '') END)`
const storeSQL = keySQL
const resolvedDate = dateSQL

/** Explicit financial mappings: no fabricated stores, dates, IDs, or amounts. */
export function accountingProjection(
  source: FactSource,
  columns: readonly string[],
  mapping?: ColumnMapping,
  overrides: Record<string, string> = {},
  configuration: { glAmountBasis?: GLAmountBasis } = {},
) {
  const fields: Record<string, string> = {}
  const notes: string[] = []
  const resolvedColumns: Record<string, string> = {}
  const find = (...names: string[]) => findColumn(columns, names)
  if (mapping) {
    const issues = mappingIssues(source, {
      preview: {
        headers: [...columns],
        rows: [],
        sheetName: null,
        hasMoreRows: false,
      },
      error: null,
      columns: mapping,
    })
    if (issues.length)
      throw new Error(
        `${source}: invalid confirmed mappings for ${issues.join(', ')}. Reopen Import Data and review this file.`,
      )
  }
  const pick = (field: MappingFieldId, names: string[]) => {
    const column = mapping ? mapping[field] : find(...names)
    if (column) resolvedColumns[field] = column
    return column
  }
  pick('currency', ['currency', 'currency_code', 'ccy'])
  const mappingKeys: Record<string, MappingFieldId> = {
    receipt_no: 'transaction_id',
    web_order_id: 'transaction_id',
    journal_id: 'transaction_id',
    business_date: 'date',
    order_date: 'date',
    month_end_date: 'date',
    posting_date: source === 'POS' ? 'posting_date' : 'date',
    store_key: 'store_key',
    line_no: 'line_no',
    order_status: 'order_status',
    journal_type: 'journal_type',
    amount_usd: 'net_amount',
    revenue_usd: 'gross_amount',
  }
  const required = (name: string, aliases: string[] = []) => {
    const column =
      mapping && mappingKeys[name]
        ? mapping[mappingKeys[name]]
        : find(name, ...aliases)
    if (!column)
      throw new Error(
        `${source}: missing ${[name, ...aliases].join(' / ')}. Available columns: ${columns.join(', ')}. Map a real source field; accounting mode does not generate financial values.`,
      )
    resolvedColumns[mappingKeys[name] ?? name] = column
    if (column !== name) notes.push(`${name} mapped from ${column}.`)
    return value(column)
  }
  const optionalMoney = (names: string[], field: MappingFieldId) => {
    const column = pick(field, names)
    if (mapping && column) notes.push(`${field} mapped from ${column}.`)
    return column ? amountSQL(value(column)) : undefined
  }
  const date = (name: string, aliases: string[] = []) =>
    resolvedDate(required(name, aliases))
  const discount = optionalMoney(
    ['discount_usd_daily', 'discount_usd', 'discount_amount_usd'],
    'discount',
  )
  let posPostingDateFallback = false
  if (source === 'POS') {
    const store = required('store_key', ['store_code', 'store_id'])
    const receipt = required('receipt_no', ['receipt_id', 'transaction_id'])
    const lineNo = required('line_no', ['line_number'])
    const business = required('business_date', [
      'business_date_key',
      'date_key',
      'transaction_date',
    ])
    const grossColumn = pick('gross_amount', [
      'gross_usd_daily',
      'gross_usd',
      'gross_amount_usd',
      'gross_sales_usd',
      'amount_usd',
      'line_amount',
    ])
    const localColumn = find('line_amount')
    const selectedGross = grossColumn ?? localColumn
    const currency = resolvedColumns.currency
    if (currency) resolvedColumns.currency = currency
    const netColumn = pick('net_amount', [
      'net_usd_month_end',
      'net_usd',
      'net_sales_usd',
    ])
    const discountColumn =
      resolvedColumns.discount ??
      (!mapping
        ? find('discount_amount', 'discount_local', 'line_discount')
        : undefined)
    if (discountColumn) resolvedColumns.discount = discountColumn
    // A currency attribute does not change the existing mapped USD contract.
    // Only explicitly local source fields establish a local monetary basis.
    const localGross =
      !!selectedGross &&
      ['lineamount', 'grosslocal', 'amountlocal', 'lineamountlocal'].includes(
        folded(selectedGross),
      )
    const localDiscount =
      !!discountColumn &&
      [
        'discountamount',
        'discountlocal',
        'linediscount',
        'discountamountlocal',
      ].includes(folded(discountColumn))
    if (!selectedGross && !netColumn)
      throw new Error(
        'POS: map line_amount / gross USD or authoritative net USD.',
      )
    const money = (column?: string) =>
      column ? amountSQL(value(column)) : 'NULL::DECIMAL(18,2)'
    const raw = (column?: string) => (column ? value(column) : 'NULL::VARCHAR')
    fields.receipt_no = receipt
    fields.line_no = lineNo
    fields.store_key = keySQL(store)
    fields.business_date = resolvedDate(business)
    const posting = pick('posting_date', ['posting_date', 'posting_date_key'])
    posPostingDateFallback = !posting
    fields.posting_date = posting
      ? resolvedDate(value(posting))
      : fields.business_date
    fields.posting_date_source = literal(
      overrides.posting_date
        ? 'configured-calendar'
        : posting
          ? 'mapped-posting-date'
          : 'business-date-fallback',
    )
    const exported = pick('exported_at', [
      'exported_at',
      'export_timestamp',
      'export_date',
    ])
    fields.exported_at = raw(exported)
    fields.export_timestamp_mapped = exported ? 'TRUE' : 'FALSE'
    fields.source_export_seq = raw(find('export_seq'))
    const record = (selected: readonly string[]) =>
      `CAST(struct_pack(${[...selected]
        .sort()
        .map(
          (column) =>
            `${quote(column)} := CAST(input.${quote(column)} AS VARCHAR)`,
        )
        .join(', ')}) AS VARCHAR)`
    fields.source_values = record(columns)
    fields.source_content = record(
      columns.filter(
        (column) => column !== exported && folded(column) !== 'exportseq',
      ),
    )
    fields.line_amount = money(localColumn)
    fields.currency = currency ? keySQL(value(currency)) : 'NULL::VARCHAR'
    fields.gross_local = localGross
      ? money(selectedGross)
      : 'NULL::DECIMAL(18,2)'
    fields.discount_local = localDiscount
      ? money(discountColumn)
      : '0::DECIMAL(18,2)'
    fields.net_local = localGross
      ? `(${fields.gross_local} - ${fields.discount_local})`
      : 'NULL::DECIMAL(18,2)'
    fields.gross_usd_daily = localGross
      ? 'NULL::DECIMAL(18,2)'
      : money(selectedGross)
    fields.discount_usd_daily = localDiscount
      ? 'NULL::DECIMAL(18,2)'
      : discountColumn
        ? money(discountColumn)
        : '0::DECIMAL(18,2)'
    fields.net_usd_month_end = money(netColumn)
    fields.has_supplied_net = netColumn ? 'TRUE' : 'FALSE'
    fields.uses_local_gross = localGross ? 'TRUE' : 'FALSE'
    fields.uses_local_discount = localDiscount ? 'TRUE' : 'FALSE'
    fields.fx_rate_daily = 'NULL::DECIMAL(24,10)'
    fields.fx_rate_month_end = 'NULL::DECIMAL(24,10)'
    fields.fx_daily_status = literal('not-configured')
    fields.fx_month_end_status = literal('not-configured')
    fields.fx_daily_key = 'NULL::VARCHAR'
    fields.fx_month_end_key = 'NULL::VARCHAR'
    fields.store_lookup_status = literal('not-configured')
    for (const [name, expression] of Object.entries({
      receipt_no: receipt,
      line_no: lineNo,
      store_key: store,
      business_date: business,
      posting_date: raw(posting),
      exported_at: raw(exported),
      gross_amount: raw(selectedGross),
      discount_amount: raw(discountColumn),
      net_amount: raw(netColumn),
      currency: raw(currency),
    }))
      fields[`raw_${name}`] = expression
    notes.push(
      netColumn
        ? 'Mapped net USD is authoritative, including zero; no discount or FX is applied to it.'
        : localGross
          ? 'Net local = gross local minus local discount. Confirmed usd_to_ccy rates divide local amounts into USD; no currency is assumed.'
          : 'Net USD calculated as gross USD minus USD discount; no additional FX conversion applied.',
    )
    if (localColumn)
      notes.push(
        'POS line_amount is the source local gross field; supplied net_usd_month_end remains authoritative, including its FX basis.',
      )
    if (!posting)
      notes.push(
        'POS posting date falls back to business_date unless a confirmed Calendar relationship supplies it.',
      )
    if (!exported)
      notes.push(
        'exported_at absent: deduplication orders by supplied export_seq, then stable file/row position.',
      )
  } else if (source === 'WEB') {
    fields.discount_usd_daily = discount ?? '0::DECIMAL(18,2)'
    const store = pick('store_key', [
      'store_key',
      'store_code',
      'store_id',
      'branch_code',
    ])
    fields.store_key = store ? storeSQL(value(store)) : literal('999999')
    if (!store)
      notes.push(
        'WEB has no store field; using the online ledger store 999999.',
      )
    const grossColumn = pick('gross_amount', [
      'gross_usd_daily',
      'gross_usd',
      'gross_amount_usd',
      'gross_sales_usd',
      'amount_usd',
    ])
    const gross = grossColumn ? amountSQL(value(grossColumn)) : undefined
    const net = optionalMoney(
      ['net_usd_month_end', 'net_usd', 'net_sales_usd'],
      'net_amount',
    )
    if (!gross && !net)
      throw new Error('WEB: requires gross USD or supplied net USD.')
    fields.gross_usd_daily = gross ?? `(${net} + ${fields.discount_usd_daily})`
    fields.net_usd_month_end =
      net ?? `(${gross} - ${fields.discount_usd_daily})`
    // A currency column describes source money. Non-USD money needs an
    // explicitly USD source field until WEB FX conversion is implemented.
    const webCurrency = resolvedColumns.currency
    const selectedMoney = [
      grossColumn,
      resolvedColumns.net_amount,
      resolvedColumns.discount,
    ].filter((column): column is string => !!column)
    const needsWebFX = selectedMoney.some(
      (column) => !folded(column).includes('usd'),
    )
    fields.__web_requires_fx =
      webCurrency && needsWebFX
        ? `COALESCE(UPPER(${value(webCurrency)}) NOT IN ('USD', ''), FALSE)`
        : 'FALSE'
    if (!net)
      notes.push(
        'Net USD calculated as gross USD minus USD discount; no additional FX conversion applied.',
      )
    fields.web_order_id = required('web_order_id', ['order_id'])
    fields.order_date = date('order_date', ['order_date_key'])
    for (const name of ['delivery_date', 'return_date']) {
      const column = pick(name as 'delivery_date' | 'return_date', [
        name,
        `${name}_key`,
      ])
      fields[name] = column ? resolvedDate(value(column)) : 'NULL::DATE'
    }
    const status = required('order_status', ['status'])
    fields.order_status = `CASE LOWER(${status}) WHEN 'canceled' THEN 'cancelled' ELSE LOWER(${status}) END`
  } else if (source === 'GL') {
    fields.journal_id = required('journal_id', ['journal_no'])
    const store = pick('store_key', ['store_key', 'store_code', 'store_id'])
    const rawColumn = (column?: string) =>
      column ? `CAST(input.${quote(column)} AS VARCHAR)` : 'NULL::VARCHAR'
    const metadata = (names: string[]) => rawColumn(find(...names))
    fields.store_key = store ? storeSQL(value(store)) : 'NULL::VARCHAR'
    fields.posting_date = date('posting_date', ['posting_date_key'])
    fields.journal_type = `UPPER(${required('journal_type', ['entry_type'])})`
    const amountColumn =
      mapping?.net_amount ?? find('amount_usd', 'journal_amount', 'revenue_usd')
    if (!amountColumn)
      throw new Error(
        'GL: map a signed amount_usd or an explicitly configured revenue_usd field.',
      )
    resolvedColumns.net_amount = amountColumn
    const basis = effectiveGLAmountBasis(
      { net_amount: amountColumn },
      configuration.glAmountBasis,
    )
    fields.amount_usd =
      basis === 'ledger'
        ? amountSQL(value(amountColumn))
        : `-(${amountSQL(value(amountColumn))})`
    fields.amount_basis = literal(basis)
    fields.amount_source_field = literal(amountColumn)
    fields.channel = `UPPER(NULLIF(TRIM(${metadata(['channel', 'sales_channel'])}), ''))`
    const channelColumn = find('channel', 'sales_channel')
    if (channelColumn) resolvedColumns.channel = channelColumn
    fields.store_code = metadata(['store_code', 'store_id'])
    fields.period = `NULLIF(TRIM(${metadata(['period', 'posting_period', 'journal_period'])}), '')`
    fields.source_ref = metadata([
      'source_ref',
      'source_reference',
      'reference',
    ])
    fields.description = metadata([
      'description',
      'journal_description',
      'memo',
    ])
    for (const [name, column] of Object.entries({
      journal_id: resolvedColumns.transaction_id,
      posting_date: resolvedColumns.date,
      store_key: store,
      journal_type: resolvedColumns.journal_type,
      amount: amountColumn,
    }))
      fields[`raw_${name}`] = rawColumn(column)
    fields.raw_store_code = fields.store_code
    fields.raw_channel = metadata(['channel', 'sales_channel'])
    fields.raw_period = metadata(['period', 'posting_period', 'journal_period'])
    fields.raw_source_ref = fields.source_ref
    fields.raw_description = fields.description
    fields.source_values = `CAST(struct_pack(${[...columns]
      .sort()
      .map(
        (column) =>
          `${quote(column)} := CAST(input.${quote(column)} AS VARCHAR)`,
      )
      .join(', ')}) AS VARCHAR)`
    notes.push(
      basis === 'ledger'
        ? 'GL ledger basis: revenue_usd = -amount_usd exactly once; source signed amount is preserved.'
        : 'GL revenue basis: mapped values already represent revenue; no second revenue sign reversal is applied.',
    )
  } else {
    fields.month_end_date = date('month_end_date', ['month_end_date_key'])
    const periodColumn = resolvedColumns.date
    if (
      periodColumn &&
      /^(thang|month|period|reportingmonth)$/.test(
        periodColumn
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase()
          .replace(/[^a-z0-9]/g, ''),
      )
    ) {
      fields.source_period = value(periodColumn)
      fields.month_end_date = `last_day(${fields.month_end_date})`
      notes.push(
        `Flash reporting period ${periodColumn} is retained in source_period and resolved to that period's month end.`,
      )
    }
    fields.revenue_usd = amountSQL(
      required('revenue_usd', ['gross_usd', 'gross_usd_daily']),
    )
  }
  if (source === 'POS') {
    // Prepare safe reference results without replacing canonical staging values.
    // The mapping stage applies these fields only after export classification.
    const mapped = [
      'store_key',
      'business_date',
      'posting_date',
      'fx_rate_daily',
      'fx_rate_month_end',
      'fx_daily_status',
      'fx_month_end_status',
      'store_lookup_status',
    ]
    for (const name of mapped)
      fields[`mapped_${name}`] = overrides[name] ?? fields[name]
    if (
      overrides.business_date &&
      !resolvedColumns.posting_date &&
      !overrides.posting_date
    )
      fields.mapped_posting_date = overrides.business_date
    for (const [name, expression] of Object.entries(overrides))
      if (!mapped.includes(name)) fields[name] = expression
  } else Object.assign(fields, overrides)
  // Normalize to strings once. The shared SQL then applies DECIMAL/date typing.
  return {
    projection: Object.entries(fields)
      .map(
        ([name, expression]) =>
          `CAST(${expression} AS VARCHAR) AS ${quote(name)}`,
      )
      .join(', '),
    notes,
    resolvedColumns,
    netStrategy:
      source === 'POS' || source === 'WEB'
        ? resolvedColumns.net_amount
          ? ('supplied' as const)
          : ('gross-minus-discount' as const)
        : null,
    posPostingDateFallback,
  }
}

export {
  ACCOUNTING_POS_STAGING_SQL,
  ACCOUNTING_POS_CLASSIFICATION_SQL,
  ACCOUNTING_POS_CLEANING_SQL,
  ACCOUNTING_POS_MAPPING_SQL,
  ACCOUNTING_POS_CONVERSION_SQL,
  ACCOUNTING_POS_FACT_SQL,
  ACCOUNTING_POS_SQL,
  ACCOUNTING_POS_VALIDATION,
  POS_ROW_ISSUES,
  POS_STAGING_ISSUES,
} from './pos-pipeline-sql.ts'
