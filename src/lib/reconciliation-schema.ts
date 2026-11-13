/** Legacy canonical headers, retained for strict-mode regression tests. */
export const REQUIRED_COLUMNS = {
  POS: [
    'receipt_no',
    'line_no',
    'export_seq',
    'store_key',
    'business_date',
    'net_usd_month_end',
    'discount_usd_daily',
  ],
  WEB: [
    'web_order_id',
    'store_key',
    'order_date',
    'delivery_date',
    'return_date',
    'order_status',
    'gross_usd_daily',
    'net_usd_month_end',
    'discount_usd_daily',
  ],
  GL: ['journal_id', 'posting_date', 'store_key', 'journal_type', 'amount_usd'],
  Flash: ['month_end_date', 'revenue_usd'],
} as const

/** Human-readable production inputs; alternatives map to the same normalized fields. */
export const ACCOUNTING_SOURCE_FIELDS = {
  POS: 'receipt_no + line_no, business_date, store_key; line_amount / discount_amount with currency and confirmed usd_to_ccy FX, or explicit gross USD / discount USD; mapped net USD remains authoritative; posting_date falls back to configured Calendar or business_date; exported_at orders exports, source sequence is only a fallback',
  WEB: 'web_order_id, order_date, order_status, gross_usd_daily, discount_usd_daily; net_amount / net_usd_month_end optional (unmapped net = gross minus discount); delivery_date required for recognized orders, return_date for returned orders; online store 999999 when no store column is supplied',
  GL: 'journal_id, posting_date, store_key or store_code, journal_type, amount_usd',
  Flash:
    'month_end_date, revenue_usd or gross_usd; select Header Row 5 for exports with four metadata rows (the global default remains Row 1)',
} as const
