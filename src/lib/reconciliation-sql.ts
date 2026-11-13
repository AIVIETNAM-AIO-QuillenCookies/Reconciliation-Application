import type { ReconciliationPeriod } from './reconciliation-types.ts'

const calendarTimestampSQL = (column: string) =>
  `COALESCE(TRY_CAST(NULLIF(TRIM(${column}), '') AS TIMESTAMP), TRY_STRPTIME(NULLIF(TRIM(${column}), ''), ['%m/%d/%Y %H:%M:%S', '%m/%d/%Y %H:%M', '%m/%d/%Y %I:%M:%S %p', '%d/%m/%Y %H:%M:%S', '%d/%m/%Y %H:%M', '%m/%d/%Y', '%d/%m/%Y', '%Y%m%d']))`
/** Export instants with explicit offsets compare in UTC, independently of session timezone. */
export const timestampSQL = (column: string) =>
  `CASE WHEN regexp_matches(TRIM(${column}), '(Z|z|[+-][0-9]{2}:?[0-9]{2})$')
    THEN make_timestamp(epoch_us(TRY_CAST(NULLIF(TRIM(${column}), '') AS TIMESTAMPTZ)))
    ELSE ${calendarTimestampSQL(column)} END`
export const dateSQL = (column: string) =>
  `CAST(${calendarTimestampSQL(column)} AS DATE)`
const moneySQL = (column: string) =>
  `CASE WHEN regexp_full_match(TRIM(${column}), '[+-]?[0-9]+(\\.[0-9]{1,2})?') THEN TRY_CAST(TRIM(${column}) AS DECIMAL(18,2)) END`

export const NORMALIZATION_SQL = [
  `CREATE TEMP TABLE pos_clean AS SELECT ROW_NUMBER() OVER () AS row_id,
    __reconcile_file_order, __reconcile_row_order,
    NULLIF(TRIM(receipt_no), '') AS receipt_no, NULLIF(TRIM(line_no), '') AS line_no,
    NULLIF(TRIM(store_key), '') AS store_key,
    CASE WHEN regexp_full_match(TRIM(export_seq), '[0-9]+') THEN TRY_CAST(export_seq AS BIGINT) END AS export_seq,
    ${dateSQL('business_date')} AS business_date, ${dateSQL('posting_date')} AS posting_date,
    ${moneySQL('net_usd_month_end')} AS net_usd_month_end,
    ${moneySQL('discount_usd_daily')} AS discount_usd_daily FROM raw_pos`,
  `CREATE TEMP TABLE pos_ranked AS SELECT *, ROW_NUMBER() OVER (PARTITION BY receipt_no, line_no ORDER BY (export_seq = 1) DESC, row_id) AS keep_rank FROM pos_clean`,
  `CREATE TEMP VIEW vw_pos AS SELECT * EXCLUDE (row_id, keep_rank) FROM pos_ranked WHERE export_seq = 1 AND keep_rank = 1`,
  `CREATE TEMP TABLE web_clean AS SELECT NULLIF(TRIM(web_order_id), '') AS web_order_id,
    __reconcile_file_order, __reconcile_row_order,
    NULLIF(TRIM(store_key), '') AS store_key, ${dateSQL('order_date')} AS order_date,
    ${dateSQL('delivery_date')} AS delivery_date, ${dateSQL('return_date')} AS return_date,
    NULLIF(TRIM(delivery_date), '') IS NOT NULL AS has_delivery_date,
    NULLIF(TRIM(return_date), '') IS NOT NULL AS has_return_date,
    LOWER(TRIM(order_status)) AS order_status,
    ${moneySQL('gross_usd_daily')} AS gross_usd_daily,
    ${moneySQL('net_usd_month_end')} AS net_usd_month_end,
    ${moneySQL('discount_usd_daily')} AS discount_usd_daily FROM raw_web`,
  `CREATE TEMP VIEW vw_web AS SELECT *, order_status = 'cancelled' AS is_cancelled,
    order_status = 'returned' AS is_returned FROM web_clean`,
  `CREATE TEMP TABLE gl_clean AS SELECT NULLIF(TRIM(journal_id), '') AS journal_id,
    __reconcile_file_order, __reconcile_row_order,
    NULLIF(TRIM(store_key), '') AS store_key, UPPER(TRIM(journal_type)) AS journal_type,
    ${dateSQL('posting_date')} AS posting_date, ${moneySQL('amount_usd')} AS amount_usd FROM raw_gl`,
  `CREATE TEMP VIEW vw_gl AS SELECT *, -amount_usd AS revenue_usd FROM gl_clean`,
  `CREATE TEMP TABLE flash_clean AS SELECT ${dateSQL('month_end_date')} AS month_end_date,
    __reconcile_file_order, __reconcile_row_order,
    ${moneySQL('revenue_usd')} AS revenue_usd FROM raw_flash`,
  `CREATE TEMP VIEW vw_flash AS SELECT * FROM flash_clean`,
]

export const VALIDATION_SQL = [
  {
    message:
      'POS has invalid transaction/store keys, export_seq, dates, or USD amounts.',
    sql: `SELECT COUNT(*) AS n FROM pos_clean WHERE receipt_no IS NULL OR line_no IS NULL OR store_key IS NULL OR export_seq IS NULL OR export_seq < 1 OR business_date IS NULL OR posting_date IS NULL OR net_usd_month_end IS NULL OR discount_usd_daily IS NULL OR net_usd_month_end < 0 OR discount_usd_daily < 0`,
  },
  {
    message: 'Each POS receipt_no + line_no must have an export_seq = 1 row.',
    sql: `SELECT COUNT(*) AS n FROM (SELECT receipt_no, line_no FROM pos_clean GROUP BY ALL HAVING COUNT(*) FILTER (WHERE export_seq = 1) = 0)`,
  },
  {
    message: 'Conflicting export_seq = 1 POS rows require review.',
    sql: `SELECT COUNT(*) AS n FROM (SELECT receipt_no, line_no FROM pos_clean WHERE export_seq = 1 GROUP BY ALL HAVING COUNT(DISTINCT (store_key, business_date, posting_date, net_usd_month_end, discount_usd_daily)) > 1)`,
  },
  {
    message:
      'WEB has invalid keys, dates, status, or USD amounts. Returned orders require delivery_date and return_date.',
    sql: `SELECT COUNT(*) AS n FROM vw_web WHERE web_order_id IS NULL OR store_key IS NULL OR order_date IS NULL OR order_status IS NULL OR order_status NOT IN ('delivered','cancelled','returned') OR gross_usd_daily IS NULL OR net_usd_month_end IS NULL OR discount_usd_daily IS NULL OR net_usd_month_end < 0 OR discount_usd_daily < 0 OR gross_usd_daily < discount_usd_daily OR (has_delivery_date AND delivery_date IS NULL) OR (has_return_date AND return_date IS NULL) OR delivery_date < order_date OR (NOT is_cancelled AND delivery_date IS NULL) OR (is_returned AND return_date IS NULL) OR (NOT is_returned AND has_return_date) OR (is_cancelled AND (has_return_date OR has_delivery_date)) OR return_date < delivery_date`,
  },
  {
    message: 'WEB web_order_id must be unique across the selected files.',
    sql: `SELECT COUNT(*) AS n FROM (SELECT web_order_id FROM vw_web GROUP BY ALL HAVING COUNT(*) > 1)`,
  },
  {
    message:
      'GL requires journal_id, journal_type, a valid posting date, and a signed amount_usd. Unallocated rows remain in GL.',
    sql: `SELECT COUNT(*) AS n FROM vw_gl WHERE journal_id IS NULL OR store_key IS NULL OR journal_type IS NULL OR posting_date IS NULL OR amount_usd IS NULL`,
  },
  {
    message: 'GL journal_id must be unique across the selected files.',
    sql: `SELECT COUNT(*) AS n FROM (SELECT journal_id FROM vw_gl GROUP BY ALL HAVING COUNT(*) > 1)`,
  },
  {
    message:
      'Flash requires a calendar month_end_date and non-negative revenue_usd.',
    sql: `SELECT COUNT(*) AS n FROM flash_clean WHERE month_end_date IS NULL OR month_end_date <> last_day(month_end_date) OR revenue_usd IS NULL OR revenue_usd < 0`,
  },
]

/**
 * Logical unified transaction layer: normalized source views feed expected_events.
 * Flash stays monthly, dimensions stay separate, and GL is compared only AFTER
 * both sides are aggregated to store_key + posting_date. There is no persistent
 * unified_transactions table; these views belong to the run's connection.
 */
export const DAILY_SQL = [
  `CREATE TEMP VIEW expected_events AS
    SELECT store_key, posting_date, net_usd_month_end AS revenue_usd,
      'POS' AS source, 'Store' AS channel, receipt_no AS transaction_id, line_no,
      'POS sale' AS event_type, business_date AS transaction_date,
      posting_date AS recognition_date, NULL::VARCHAR AS order_status,
      net_usd_month_end AS net_usd, 'USD' AS currency,
      __reconcile_file_order, __reconcile_row_order FROM vw_pos
    UNION ALL SELECT store_key, delivery_date, net_usd_month_end,
      'WEB', 'Online', web_order_id, NULL::VARCHAR,
      'WEB delivery', order_date, delivery_date, order_status,
      net_usd_month_end, 'USD', __reconcile_file_order, __reconcile_row_order
      FROM vw_web WHERE NOT is_cancelled
    UNION ALL SELECT store_key, return_date, -net_usd_month_end,
      'WEB', 'Online', web_order_id, NULL::VARCHAR,
      'WEB return', order_date, return_date, order_status,
      net_usd_month_end, 'USD', __reconcile_file_order, __reconcile_row_order
      FROM vw_web WHERE is_returned`,
  `CREATE TEMP VIEW expected_daily AS SELECT store_key, posting_date, SUM(revenue_usd) AS expected_revenue FROM expected_events GROUP BY ALL`,
  `CREATE TEMP VIEW gl_daily AS SELECT store_key, posting_date, SUM(revenue_usd) AS gl_revenue, COUNT(*) AS journals FROM vw_gl GROUP BY ALL`,
  `CREATE TEMP VIEW daily_comparison AS SELECT COALESCE(e.store_key, g.store_key) AS store_key,
    COALESCE(e.posting_date, g.posting_date) AS posting_date,
    COALESCE(e.expected_revenue, 0) AS expected_revenue, COALESCE(g.gl_revenue, 0) AS gl_revenue,
    COALESCE(g.gl_revenue, 0) - COALESCE(e.expected_revenue, 0) AS variance,
    g.journals IS NULL AND COALESCE(e.expected_revenue, 0) <> 0 AS missing_gl
    FROM expected_daily e FULL OUTER JOIN gl_daily g USING (store_key, posting_date)`,
]

export function bridgeSQL(
  period: ReconciliationPeriod,
  accounting = false,
): string {
  // Flash includes raw duplicates: deduct raw daily discounts first, then remove
  // duplicate net amounts. This avoids deducting their discounts a second time.
  // Timing uses source recognition dates. FX basis changes remain in the residual.
  const within = (column: string) =>
    `${column} BETWEEN DATE '${period.start}' AND DATE '${period.end}'`
  const sum = (expr: string) => `COALESCE(SUM(${expr}), 0)`
  const timing = (newDate: string, oldDate: string) =>
    `${sum(`CASE WHEN ${within(newDate)} THEN net_usd_month_end ELSE 0 END - CASE WHEN ${within(oldDate)} THEN net_usd_month_end ELSE 0 END`)}`
  return `WITH
    flash AS (SELECT ${sum('revenue_usd')} AS amount, COUNT(*) AS n FROM vw_flash WHERE ${within('month_end_date')}),
    discounts AS (SELECT SUM(amount) AS amount FROM (
      SELECT -${sum('discount_usd_daily')} AS amount FROM pos_clean WHERE ${within('business_date')}
      UNION ALL SELECT -${sum('discount_usd_daily')} FROM vw_web WHERE ${within('order_date')})),
    cancellations AS (SELECT -${sum('gross_usd_daily - discount_usd_daily')} AS amount FROM vw_web WHERE is_cancelled AND ${within('order_date')}),
    timing AS (SELECT SUM(amount) AS amount FROM (
      SELECT ${timing('posting_date', 'business_date')} AS amount FROM vw_pos
      UNION ALL SELECT ${timing('delivery_date', 'order_date')} FROM vw_web WHERE NOT is_cancelled)),
    returns AS (SELECT -${sum('net_usd_month_end')} AS amount FROM vw_web WHERE is_returned AND ${within('return_date')}),
    duplicates AS (SELECT -${sum(accounting ? 'net_usd_daily' : 'net_usd_month_end')} AS amount, COUNT(*) AS n FROM ${accounting ? 'q_POS_Dup_Rows' : 'pos_ranked'} WHERE keep_rank > 1 AND ${within('business_date')}),
    missing AS (SELECT ${sum('variance')} AS amount, COUNT(*) AS n FROM daily_comparison WHERE missing_gl AND ${within('posting_date')}),
    finance AS (SELECT ${sum('revenue_usd')} AS amount FROM vw_gl WHERE ${within('posting_date')})
    SELECT CAST(flash.amount AS VARCHAR) AS "Flash_Sales", CAST(discounts.amount AS VARCHAR) AS "Discounts",
      CAST(cancellations.amount AS VARCHAR) AS "Cancellations", CAST(timing.amount AS VARCHAR) AS "Timing_Differences",
      CAST(returns.amount AS VARCHAR) AS "Returns", CAST(duplicates.amount + missing.amount AS VARCHAR) AS "Data_Errors",
      CAST(finance.amount AS VARCHAR) AS "GL_Finance", CAST(duplicates.amount AS VARCHAR) AS duplicate_adjustment,
      CAST(missing.amount AS VARCHAR) AS missing_adjustment, CAST(duplicates.n AS VARCHAR) AS duplicate_count,
      CAST(missing.n AS VARCHAR) AS missing_count, CAST(flash.n AS VARCHAR) AS flash_period_rows
    FROM flash, discounts, cancellations, timing, returns, duplicates, missing, finance`
}

export function dailyDifferenceSQL(
  period: ReconciliationPeriod,
  limit = 200,
): string {
  return `SELECT store_key, CAST(posting_date AS VARCHAR) AS posting_date,
    CAST(expected_revenue AS VARCHAR) AS expected_revenue, CAST(gl_revenue AS VARCHAR) AS gl_revenue,
    CAST(variance AS VARCHAR) AS variance, missing_gl, CAST(COUNT(*) OVER () AS VARCHAR) AS total_count
    FROM daily_comparison WHERE variance <> 0 AND posting_date BETWEEN DATE '${period.start}' AND DATE '${period.end}'
    ORDER BY ABS(variance) DESC, store_key, posting_date LIMIT ${limit}`
}

/** All candidates are returned, independently of the dashboard's 200-row daily preview.
 * The table applies its user-selected threshold. Deltas use source minus GL.
 */
export function exceptionSQL(
  period: ReconciliationPeriod,
  accounting = false,
): string {
  const within = (date: string) =>
    `${date} BETWEEN DATE '${period.start}' AND DATE '${period.end}'`
  return `WITH duplicate_lines AS (
    SELECT store_key, business_date AS event_date, receipt_no, line_no,
      SUM(${accounting ? 'net_usd_daily' : 'net_usd_month_end'}) AS delta, COUNT(*) AS duplicate_count
    FROM ${accounting ? 'q_POS_Dup_Rows' : 'pos_ranked'} WHERE keep_rank > 1 AND ${within('business_date')}
    GROUP BY ALL
  ), journal_context AS (
    SELECT store_key, posting_date, COUNT(*) AS journal_count,
      COUNT(*) FILTER (WHERE journal_type = 'MANUAL') AS manual_count,
      STRING_AGG(journal_id, ', ' ORDER BY journal_id) FILTER (WHERE journal_type = 'MANUAL') AS manual_refs
    FROM vw_gl GROUP BY ALL
  ), candidates AS (
    SELECT 'Data Error' AS category, 'Duplicate POS' AS exception_type,
      store_key, event_date, receipt_no || ' / ' || line_no AS reference,
      delta, duplicate_count, CAST(NULL AS VARCHAR) AS manual_refs
    FROM duplicate_lines
    UNION ALL
    SELECT CASE WHEN d.missing_gl THEN 'Missing GL' ELSE 'Unexplained' END,
      CASE WHEN d.missing_gl THEN 'Missing GL'
        WHEN d.expected_revenue = 0 AND j.journal_count = 1 AND j.manual_count = 1 THEN 'Manual Journal'
        ELSE 'Daily Variance' END,
      d.store_key, d.posting_date,
      CASE WHEN d.expected_revenue = 0 AND j.journal_count = 1 AND j.manual_count = 1 THEN j.manual_refs
        ELSE d.store_key || ' / ' || CAST(d.posting_date AS VARCHAR) END,
      -d.variance, 0, j.manual_refs
    FROM daily_comparison d LEFT JOIN journal_context j USING (store_key, posting_date)
    WHERE d.variance <> 0 AND ${within('d.posting_date')}
  ) SELECT category, exception_type, store_key, CAST(event_date AS VARCHAR) AS event_date,
    reference, CAST(delta AS VARCHAR) AS delta, CAST(duplicate_count AS VARCHAR) AS duplicate_count,
    manual_refs FROM candidates
    ORDER BY ABS(delta) DESC, category, store_key, event_date, reference`
}
