import type { AsyncDuckDBConnection } from '@duckdb/duckdb-wasm'
import type { QueuedFile, Source } from './uploads.ts'
import type { FailureReason, RunFailure } from './run-failure.ts'

type Check = { code: string; fields: string[]; message: string; where: string }
const web: Check[] = [
  {
    code: 'WEB_ORDER_KEY_MISSING',
    fields: ['web_order_id'],
    message: 'Thiếu mã đơn hàng WEB.',
    where: 'web_order_id IS NULL',
  },
  {
    code: 'WEB_STORE_KEY_MISSING',
    fields: ['store_key'],
    message: 'Thiếu khóa cửa hàng WEB.',
    where: 'store_key IS NULL',
  },
  {
    code: 'WEB_ORDER_DATE_INVALID',
    fields: ['order_date'],
    message: 'Ngày đặt hàng WEB không đọc được.',
    where: 'order_date IS NULL',
  },
  {
    code: 'WEB_STATUS_INVALID',
    fields: ['order_status'],
    message: 'Trạng thái WEB thiếu hoặc ngoài Delivered, Cancelled, Returned.',
    where:
      "order_status IS NULL OR order_status NOT IN ('delivered','cancelled','returned')",
  },
  {
    code: 'WEB_AMOUNT_INVALID',
    fields: ['gross_usd_daily', 'net_usd_month_end', 'discount_usd_daily'],
    message: 'Số tiền WEB không đọc được, âm hoặc gross nhỏ hơn discount.',
    where:
      'gross_usd_daily IS NULL OR net_usd_month_end IS NULL OR discount_usd_daily IS NULL OR net_usd_month_end < 0 OR discount_usd_daily < 0 OR gross_usd_daily < discount_usd_daily',
  },
  {
    code: 'WEB_DELIVERY_DATE_INVALID',
    fields: ['delivery_date', 'order_date', 'order_status'],
    message:
      'Ngày giao WEB không đọc được, trước ngày đặt hoặc thiếu ở đơn chưa hủy.',
    where:
      '(has_delivery_date AND delivery_date IS NULL) OR delivery_date < order_date OR (NOT is_cancelled AND delivery_date IS NULL)',
  },
  {
    code: 'WEB_RETURN_DATE_INVALID',
    fields: ['return_date', 'delivery_date', 'order_status'],
    message:
      'Ngày trả WEB không đọc được, thiếu ở đơn trả, có ở đơn chưa trả hoặc trước ngày giao.',
    where:
      '(has_return_date AND return_date IS NULL) OR (is_returned AND return_date IS NULL) OR (NOT is_returned AND has_return_date) OR return_date < delivery_date',
  },
  {
    code: 'WEB_CANCELLED_DATES_PRESENT',
    fields: ['order_status', 'delivery_date', 'return_date'],
    message: 'Đơn WEB đã hủy còn ngày giao hoặc ngày trả.',
    where: 'is_cancelled AND (has_return_date OR has_delivery_date)',
  },
]
const flash: Check[] = [
  {
    code: 'FLASH_MONTH_END_INVALID',
    fields: ['month_end_date'],
    message: 'Ngày Flash không đọc được hoặc không phải ngày cuối tháng.',
    where:
      'month_end_date IS NULL OR month_end_date <> last_day(month_end_date)',
  },
  {
    code: 'FLASH_REVENUE_INVALID',
    fields: ['revenue_usd'],
    message: 'Doanh thu Flash không đọc được hoặc âm.',
    where: 'revenue_usd IS NULL OR revenue_usd < 0',
  },
]

/** Bounded original records and exact failed checks, from the failed run connection. */
export async function captureValidationFailure(
  connection: Pick<AsyncDuckDBConnection, 'query'>,
  options: {
    source?: string
    files: QueuedFile[]
    paths: Map<Source, string[]>
    count: number
    message: string
  },
): Promise<Partial<RunFailure>> {
  const { source } = options
  const relation =
    source === 'WEB' ? 'vw_web' : source === 'Flash' ? 'flash_clean' : null
  if (!relation)
    return {
      reasons: [
        {
          code: `${source ?? 'SOURCE'}_VALIDATION`,
          fields: [],
          message: options.message,
          count: options.count,
        },
      ],
    }
  const checks: Check[] =
    source === 'WEB' && options.message.includes('unique')
      ? [
          {
            code: 'WEB_ORDER_KEY_DUPLICATE',
            fields: ['web_order_id'],
            message: 'Mã đơn WEB trùng giữa các tệp đã chọn.',
            where:
              'web_order_id IN (SELECT web_order_id FROM vw_web GROUP BY web_order_id HAVING COUNT(*) > 1)',
          },
        ]
      : source === 'WEB'
        ? web
        : flash
  const counts = (
    await connection.query(
      `SELECT ${checks.map((check, i) => `COUNT(*) FILTER (WHERE ${check.where}) AS reason_${i}`).join(', ')} FROM ${relation}`,
    )
  ).toArray()[0]
  const reasons: FailureReason[] = checks.flatMap((check, i) =>
    Number(counts[`reason_${i}`]) > 0
      ? [
          {
            code: check.code,
            fields: check.fields,
            message: check.message,
            count: Number(counts[`reason_${i}`]),
          },
        ]
      : [],
  )
  const predicate = checks.map((check) => `(${check.where})`).join(' OR ')
  const rows = (
    await connection.query(
      `SELECT raw.* FROM raw_${source!.toLowerCase()} raw WHERE EXISTS (SELECT 1 FROM ${relation} invalid WHERE (${predicate}) AND raw.__reconcile_file_order = invalid.__reconcile_file_order AND raw.__reconcile_row_order = invalid.__reconcile_row_order) ORDER BY raw.__reconcile_file_order, raw.__reconcile_row_order LIMIT 5`,
    )
  ).toArray()
  const sourceFiles = options.files.filter((file) => file.source === source)
  const samples = []
  for (const row of rows) {
    const fileIndex = Number(row.__reconcile_file_order)
    const sourceRecord = Number(row.__reconcile_row_order)
    const path = options.paths.get(source as Source)![fileIndex]
    const original = (
      await connection.query(
        `SELECT * FROM read_csv_auto('${path.replaceAll("'", "''")}', header=true, all_varchar=true) LIMIT 1 OFFSET ${sourceRecord - 1}`,
      )
    ).toArray()[0]
    samples.push({
      fileName: sourceFiles[fileIndex]?.file.name ?? source!,
      sourceRecord,
      values: Object.fromEntries(
        Object.entries(original).map(([key, value]) => [
          key,
          value === null ? null : String(value),
        ]),
      ),
    })
  }
  return {
    reasons: reasons.length
      ? reasons
      : [
          {
            code: `${source}_VALIDATION`,
            fields: [],
            message: options.message,
            count: options.count,
          },
        ],
    samples,
  }
}
