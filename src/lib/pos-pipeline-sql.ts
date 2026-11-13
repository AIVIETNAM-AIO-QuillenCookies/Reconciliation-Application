import { dateSQL, timestampSQL } from './reconciliation-sql.ts'

const money = (name: string) => `TRY_CAST(${name} AS DECIMAL(18,2)) AS ${name}`
const bool = (name: string) =>
  `COALESCE(TRY_CAST(${name} AS BOOLEAN), FALSE) AS ${name}`

/** Staging retains original mapped text alongside typed values and source ordinals. */
export const ACCOUNTING_POS_STAGING_SQL = [
  `CREATE TEMP TABLE pos_staging AS SELECT ROW_NUMBER() OVER (ORDER BY __reconcile_file_order, __reconcile_row_order) AS row_id,
    __reconcile_file_order, __reconcile_row_order,
    NULLIF(TRIM(receipt_no), '') AS receipt_no, NULLIF(TRIM(line_no), '') AS line_no,
    NULLIF(TRIM(store_key), '') AS store_key, ${dateSQL('business_date')} AS business_date,
    ${dateSQL('posting_date')} AS posting_date, ${timestampSQL('exported_at')} AS exported_at,
    TRY_CAST(export_timestamp_mapped AS BOOLEAN) AND ${timestampSQL('exported_at')} IS NULL AS invalid_exported_at,
    TRY_CAST(source_export_seq AS BIGINT) AS source_export_seq,
    ${['line_amount', 'gross_local', 'discount_local', 'net_local', 'gross_usd_daily', 'net_usd_month_end', 'discount_usd_daily'].map(money).join(', ')},
    currency, ${['has_supplied_net', 'uses_local_gross', 'uses_local_discount'].map(bool).join(', ')},
    TRY_CAST(fx_rate_daily AS DECIMAL(24,10)) AS fx_rate_daily,
    TRY_CAST(fx_rate_month_end AS DECIMAL(24,10)) AS fx_rate_month_end,
    fx_daily_status, fx_month_end_status, fx_daily_key, fx_month_end_key, store_lookup_status, posting_date_source,
    raw_receipt_no, raw_line_no, raw_store_key, raw_business_date, raw_posting_date,
    raw_exported_at, raw_gross_amount, raw_discount_amount, raw_net_amount, raw_currency, source_values, source_content,
    mapped_store_key, mapped_business_date, mapped_posting_date, mapped_fx_rate_daily,
    mapped_fx_rate_month_end, mapped_fx_daily_status, mapped_fx_month_end_status, mapped_store_lookup_status
    FROM raw_pos`,
]

export const ACCOUNTING_POS_CLASSIFICATION_SQL = [
  `CREATE TEMP TABLE pos_ranked AS SELECT *,
    ROW_NUMBER() OVER (PARTITION BY receipt_no, line_no ORDER BY exported_at ASC NULLS LAST,
      source_export_seq ASC NULLS LAST, __reconcile_file_order, __reconcile_row_order) AS export_seq,
    ROW_NUMBER() OVER (PARTITION BY receipt_no, line_no ORDER BY exported_at ASC NULLS LAST,
      source_export_seq ASC NULLS LAST, __reconcile_file_order, __reconcile_row_order) AS keep_rank,
    COUNT(*) OVER (PARTITION BY receipt_no, line_no) AS export_group_rows FROM pos_staging`,
]

export const ACCOUNTING_POS_CLEANING_SQL = [
  `CREATE TEMP VIEW q_POS_First_Export AS SELECT * FROM pos_ranked WHERE keep_rank = 1`,
  `CREATE TEMP VIEW q_POS_Cleaning AS SELECT * FROM q_POS_First_Export`,
  `CREATE TEMP VIEW q_POS_Dup_Keys AS SELECT receipt_no, line_no, COUNT(*) AS export_rows,
    COUNT(*) - 1 AS discarded_rows,
    COUNT(DISTINCT source_content) AS content_variants
    FROM pos_ranked GROUP BY receipt_no, line_no HAVING COUNT(*) > 1`,
]

export const ACCOUNTING_POS_MAPPING_SQL = [
  `CREATE TEMP TABLE pos_mapped_all AS SELECT * EXCLUDE (store_key, business_date, posting_date,
    fx_rate_daily, fx_rate_month_end, fx_daily_status, fx_month_end_status, store_lookup_status),
    NULLIF(TRIM(mapped_store_key), '') AS store_key,
    ${dateSQL('mapped_business_date')} AS business_date, ${dateSQL('mapped_posting_date')} AS posting_date,
    TRY_CAST(mapped_fx_rate_daily AS DECIMAL(24,10)) AS fx_rate_daily,
    TRY_CAST(mapped_fx_rate_month_end AS DECIMAL(24,10)) AS fx_rate_month_end,
    mapped_fx_daily_status AS fx_daily_status, mapped_fx_month_end_status AS fx_month_end_status,
    mapped_store_lookup_status AS store_lookup_status FROM pos_ranked`,
  `CREATE TEMP TABLE q_POS_Mapped AS SELECT mapped.* FROM q_POS_Cleaning keeper
    JOIN pos_mapped_all mapped ON keeper.row_id = mapped.row_id`,
]

const dailyRate = `CASE WHEN currency = 'USD' THEN 1::DECIMAL(24,10) WHEN fx_daily_status = 'matched' THEN fx_rate_daily END`
const netRate = `CASE WHEN currency = 'USD' THEN 1::DECIMAL(24,10)
  WHEN fx_month_end_status <> 'not-configured' THEN CASE WHEN fx_month_end_status = 'matched' THEN fx_rate_month_end END
  WHEN fx_daily_status = 'matched' THEN fx_rate_daily END`
const converted = (amount: string, rate: string) =>
  `TRY_CAST(${amount} / NULLIF((${rate}), 0) AS DECIMAL(18,2))`

export const ACCOUNTING_POS_CONVERSION_SQL = [
  `CREATE TEMP TABLE pos_converted_all AS SELECT * EXCLUDE (gross_usd_daily, discount_usd_daily, net_usd_month_end),
    CASE WHEN uses_local_gross THEN ${converted('gross_local', dailyRate)} ELSE gross_usd_daily END AS gross_usd_daily,
    CASE WHEN uses_local_discount THEN ${converted('discount_local', dailyRate)} ELSE discount_usd_daily END AS discount_usd_daily,
    CASE WHEN has_supplied_net THEN net_usd_month_end
      WHEN uses_local_gross AND (uses_local_discount OR COALESCE(discount_usd_daily, 0) = 0)
        THEN ${converted('net_local', netRate)}
      WHEN uses_local_gross AND currency = 'USD' THEN gross_local - discount_usd_daily
      WHEN NOT uses_local_gross AND NOT uses_local_discount THEN gross_usd_daily - discount_usd_daily
      WHEN NOT uses_local_gross AND uses_local_discount THEN gross_usd_daily - ${converted('discount_local', dailyRate)}
      END AS net_usd_month_end,
    CASE WHEN has_supplied_net THEN net_usd_month_end
      WHEN uses_local_gross AND (uses_local_discount OR COALESCE(discount_usd_daily, 0) = 0) THEN ${converted('net_local', dailyRate)}
      WHEN uses_local_gross AND currency = 'USD' THEN gross_local - discount_usd_daily
      WHEN NOT uses_local_gross AND NOT uses_local_discount THEN gross_usd_daily - discount_usd_daily
      WHEN NOT uses_local_gross AND uses_local_discount THEN gross_usd_daily - ${converted('discount_local', dailyRate)} END AS net_usd_daily,
    CASE WHEN has_supplied_net THEN 'supplied-usd' WHEN currency = 'USD' OR NOT uses_local_gross THEN 'usd'
      WHEN fx_month_end_status <> 'not-configured' THEN 'month-end' ELSE 'daily' END AS net_usd_basis
    FROM pos_mapped_all`,
  // pos_clean is the all-export audit relation consumed by bridge discounts, never the revenue fact.
  `CREATE TEMP VIEW pos_clean AS SELECT * FROM pos_converted_all`,
  `CREATE TEMP VIEW q_POS_USD AS SELECT converted.* FROM q_POS_Mapped keeper
    JOIN pos_converted_all converted ON keeper.row_id = converted.row_id`,
  `CREATE TEMP VIEW q_POS_Dup_Rows AS SELECT *, 'discarded-later-export' AS discard_reason
    FROM pos_clean WHERE keep_rank > 1`,
  `CREATE TEMP VIEW q_POS_Dup_Impact AS SELECT receipt_no, line_no, store_key, business_date,
    COUNT(*) AS discarded_rows, SUM(net_usd_daily) AS duplicate_net_usd_daily,
    SUM(net_usd_month_end) AS duplicate_net_usd_month_end,
    -SUM(net_usd_daily) AS bridge_adjustment_usd FROM q_POS_Dup_Rows GROUP BY ALL`,
]

export const ACCOUNTING_POS_FACT_SQL = [
  `CREATE TEMP VIEW fact_POS_final AS SELECT * FROM q_POS_USD`,
  `CREATE TEMP VIEW vw_pos AS SELECT * EXCLUDE (row_id, keep_rank) FROM fact_POS_final`,
]

export const ACCOUNTING_POS_SQL = [
  ...ACCOUNTING_POS_STAGING_SQL,
  ...ACCOUNTING_POS_CLASSIFICATION_SQL,
  ...ACCOUNTING_POS_CLEANING_SQL,
  ...ACCOUNTING_POS_MAPPING_SQL,
  ...ACCOUNTING_POS_CONVERSION_SQL,
  ...ACCOUNTING_POS_FACT_SQL,
]

/** Predicates share one all-row relation; overlapping reason counts are never summed as rows. */
export const POS_ROW_ISSUES = [
  {
    code: 'POS_RECEIPT_INVALID',
    label: 'Receipt ID không hợp lệ',
    where: 'receipt_no IS NULL',
  },
  {
    code: 'POS_LINE_INVALID',
    label: 'Line number không hợp lệ',
    where: 'line_no IS NULL',
  },
  {
    code: 'POS_STORE_INVALID',
    label: 'Store key không hợp lệ',
    where: 'store_key IS NULL',
  },
  {
    code: 'POS_STORE_LOOKUP_MISSING',
    label: 'Không tìm thấy store lookup',
    where: "store_lookup_status = 'missing'",
  },
  {
    code: 'POS_STORE_LOOKUP_DUPLICATE',
    label: 'Khóa store lookup bị trùng',
    where: "store_lookup_status = 'duplicate'",
  },
  {
    code: 'POS_STORE_LOOKUP_INVALID',
    label: 'Store lookup không hợp lệ',
    where: "store_lookup_status = 'invalid'",
  },
  {
    code: 'POS_BUSINESS_DATE_INVALID',
    label: 'Business date không parse được',
    where: 'business_date IS NULL',
  },
  {
    code: 'POS_POSTING_DATE_INVALID',
    label: 'Posting date không parse được',
    where: 'posting_date IS NULL',
  },
  {
    code: 'POS_EXPORT_TIMESTAMP_INVALID',
    label: 'Export timestamp không hợp lệ',
    where: 'invalid_exported_at',
  },
  {
    code: 'POS_LOCAL_AMOUNT_INVALID',
    label: 'Số tiền nguyên tệ không hợp lệ',
    where:
      '(uses_local_gross AND (gross_local IS NULL OR gross_local < 0 OR net_local IS NULL OR net_local < 0)) OR (uses_local_discount AND (discount_local IS NULL OR discount_local < 0))',
  },
  {
    code: 'POS_CURRENCY_MISSING',
    label: 'Thiếu currency cho số tiền nguyên tệ',
    where:
      'currency IS NULL AND ((uses_local_gross AND NOT has_supplied_net) OR uses_local_discount)',
  },
  {
    code: 'POS_CURRENCY_BASIS_MIXED',
    label: 'Gross nguyên tệ và discount USD chưa có cùng cơ sở',
    where:
      "uses_local_gross AND NOT has_supplied_net AND NOT uses_local_discount AND currency <> 'USD' AND discount_usd_daily <> 0",
  },
  {
    code: 'POS_FX_DAILY_MISSING',
    label: 'Thiếu FX Daily theo ngày và currency',
    where:
      "currency <> 'USD' AND ((uses_local_gross AND NOT has_supplied_net) OR uses_local_discount) AND fx_daily_status IN ('missing', 'not-configured')",
  },
  {
    code: 'POS_FX_DAILY_DUPLICATE',
    label: 'Khóa FX Daily bị trùng',
    where: "fx_daily_status = 'duplicate'",
  },
  {
    code: 'POS_FX_DAILY_INVALID',
    label: 'Tỷ giá FX Daily không hợp lệ',
    where: "fx_daily_status = 'invalid'",
  },
  {
    code: 'POS_FX_MONTH_END_MISSING',
    label: 'Thiếu FX Month End theo kỳ và currency',
    where:
      "currency <> 'USD' AND uses_local_gross AND NOT has_supplied_net AND fx_month_end_status = 'missing'",
  },
  {
    code: 'POS_FX_MONTH_END_DUPLICATE',
    label: 'Khóa FX Month End bị trùng',
    where: "fx_month_end_status = 'duplicate'",
  },
  {
    code: 'POS_FX_MONTH_END_INVALID',
    label: 'Tỷ giá FX Month End không hợp lệ',
    where: "fx_month_end_status = 'invalid'",
  },
  {
    code: 'POS_USD_NET_INVALID',
    label: 'Net USD null, không hợp lệ hoặc âm',
    where: 'net_usd_month_end IS NULL OR net_usd_month_end < 0',
  },
  {
    code: 'POS_USD_DISCOUNT_INVALID',
    label: 'Discount USD null, không hợp lệ hoặc âm',
    where: 'discount_usd_daily IS NULL OR discount_usd_daily < 0',
  },
  {
    code: 'POS_USD_GROSS_INVALID',
    label: 'Gross USD không hợp lệ hoặc nhỏ hơn discount USD',
    where:
      '(NOT uses_local_gross AND raw_gross_amount IS NOT NULL AND gross_usd_daily IS NULL) OR gross_usd_daily < 0 OR gross_usd_daily < discount_usd_daily',
  },
]

export const POS_STAGING_ISSUES = POS_ROW_ISSUES.filter((issue) =>
  [
    'POS_RECEIPT_INVALID',
    'POS_LINE_INVALID',
    'POS_STORE_INVALID',
    'POS_BUSINESS_DATE_INVALID',
    'POS_POSTING_DATE_INVALID',
    'POS_EXPORT_TIMESTAMP_INVALID',
    'POS_LOCAL_AMOUNT_INVALID',
    'POS_CURRENCY_MISSING',
  ].includes(issue.code),
).map((issue) => ({
  ...issue,
  where:
    issue.code === 'POS_STORE_INVALID'
      ? "store_key IS NULL AND NULLIF(TRIM(mapped_store_key), '') IS NULL"
      : issue.code === 'POS_BUSINESS_DATE_INVALID'
        ? `business_date IS NULL AND ${dateSQL('mapped_business_date')} IS NULL`
        : issue.code === 'POS_POSTING_DATE_INVALID'
          ? `posting_date IS NULL AND ${dateSQL('mapped_posting_date')} IS NULL`
          : issue.where,
}))

export const ACCOUNTING_POS_VALIDATION = {
  message:
    'POS requires valid receipt/line/store keys, dates, export timestamps, and non-negative USD amounts.',
  sql: `SELECT COUNT(*) AS n FROM pos_clean WHERE ${POS_ROW_ISSUES.map((issue) => `(${issue.where})`).join(' OR ')}`,
}
