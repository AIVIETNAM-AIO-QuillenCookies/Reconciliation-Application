import type { AsyncDuckDBConnection } from '@duckdb/duckdb-wasm'
import type {
  ReconciliationPeriod,
  ReconciliationResult,
} from './reconciliation-types.ts'
import type { ExcelReferenceWorkbook } from './excel-reference.ts'
import { sumReferenceUSD } from './excel-reference.ts'
import { bridgeSQL } from './reconciliation-sql.ts'

export type DashboardChannel = 'ALL' | 'STORE' | 'WEB' | 'UNALLOCATED'
export interface DashboardFilters {
  startMonth: string
  endMonth: string
  channel: DashboardChannel
  country: string
}
export interface DashboardMonth {
  month: string
  flashUSD: number | null
  glUSD: number | null
  deltaUSD: number | null
  deltaRatio: number | null
  rulesUSD: number | null
  dataErrorsUSD: number | null
  unexplainedUSD: number | null
}
export interface DashboardSourceRow {
  [key: string]: unknown
  fileName: string
  sheetName: string
  sourceRow: number | null
  sourceRecord?: number | null
  sourceTable?: string
  month: string
  transactionId: string
  amountUSD: number | null
  description: string
  exceptionId?: string
}
export interface DashboardBridgeRow {
  id: string
  label: string
  kind: 'sales' | 'adjustment' | 'finance'
  category: 'rule' | 'error' | 'unexplained' | 'rounding' | 'total'
  amountUSD: number
  monthly: Record<string, number>
  startUSD: number
  endUSD: number
  sourceRows: DashboardSourceRow[]
  sourceRowsTruncated?: boolean
  detailCount?: number
  detailCodes: string[]
}
export interface DashboardCheck {
  id: string
  label: string
  actualUSD: number
  expectedUSD: number
  differenceUSD: number
  passed: boolean
  month: string | null
}
export interface DashboardCell {
  id: string
  storeKey: string
  date: string
  expectedUSD: number
  glUSD: number
  deltaUSD: number
  status: string
  exceptionIds: string[]
}
export interface DashboardStore {
  storeKey: string
  rawDeltaUSD: number
  normalizedDeltaUSD: number
  ratio: number | null
  magnitudeUSD: number
  status: string
  months: string[]
  exceptionIds: string[]
}
export interface DashboardQualityMonth {
  month: string
  returnsUSD: number | null
  deliveredUSD: number | null
  returnRate: number | null
  cancelledOrders: number | null
  removedDuplicateLines: number | null
}
export interface DashboardModel {
  source: 'raw' | 'excel'
  available: boolean
  months: string[]
  selectedMonths: string[]
  channels: DashboardChannel[]
  countries: string[]
  filterNotes: string[]
  totals: {
    flashUSD: number | null
    glUSD: number | null
    deltaUSD: number | null
    deltaRatio: number | null
    rulesUSD: number | null
    dataErrorsUSD: number | null
    unexplainedUSD: number | null
    roundingUSD: number | null
  }
  monthly: DashboardMonth[]
  bridge: DashboardBridgeRow[]
  checks: DashboardCheck[]
  matrix: {
    id: string
    label: string
    monthly: Record<string, number | null>
    totalUSD: number | null
  }[]
  insights: string[]
  detail: {
    available: boolean
    reason: string
    stores: DashboardStore[]
    cells: DashboardCell[]
    trend: { month: string; rawDeltaUSD: number; normalizedDeltaUSD: number }[]
    onlineTrend: {
      month: string
      orderUSD: number
      recognizedUSD: number
      glUSD: number
      deltaUSD: number
    }[]
    rawCellCount: number | null
    cellCount: number | null
    beforeThresholdStores: number | null
    afterThresholdStores: number | null
    onlineDeltaUSD: number | null
  }
  quality: {
    available: boolean
    reason: string
    returnsUSD: number | null
    deliveredUSD: number | null
    returnRate: number | null
    cancelledOrders: number | null
    removedDuplicateLines: number | null
    monthly: DashboardQualityMonth[]
    validations: {
      id: string
      label: string
      count: number | null
      status: string
      tableId: string
      actual?: unknown
      expected?: unknown
      rule?: string
      note?: string
      sourceSheet?: string
      sourceRow?: number
    }[]
  }
}

/** Complete aggregates captured once from the successful run, never bounded evidence samples. */
export interface DashboardSnapshot {
  months: {
    month: string
    flashUSD: number | null
    glUSD: number
    discountsUSD: number
    cancellationsUSD: number
    timingUSD: number
    returnsUSD: number
    dataErrorsUSD: number
    unexplainedUSD: number
    duplicateUSD: number
    missingUSD: number
  }[]
  glChannels: { month: string; channel: string; revenueUSD: number }[]
  cells: {
    storeKey: string
    date: string
    rawUSD: number
    expectedUSD: number
    glUSD: number
    hasExpected: boolean
    hasGL: boolean
  }[]
  online: {
    month: string
    orderUSD: number
    recognizedUSD: number
    glUSD: number
  }[]
  quality: DashboardQualityMonth[]
}

const sum = (values: Iterable<number>) => sumReferenceUSD(values)
export function safeDashboardRatio(
  numerator: number | null,
  denominator: number | null,
): number | null {
  return numerator === null || denominator === null || denominator === 0
    ? null
    : numerator / denominator
}
/** Store-month flag: |Δ| > 200 USD AND |Δ| / |GL| > 1 %, both strict. */
export const STORE_MONTH_THRESHOLD_CENTS = 20_000
export const STORE_MONTH_THRESHOLD_PERCENT = 1
export function storeMonthBreaches(deltaUSD: number, glUSD: number): boolean {
  const deltaCents = Math.round(deltaUSD * 100)
  const glCents = Math.round(glUSD * 100)
  return (
    Number.isSafeInteger(deltaCents) &&
    Number.isSafeInteger(glCents) &&
    Math.abs(deltaCents) > STORE_MONTH_THRESHOLD_CENTS &&
    glCents !== 0 &&
    BigInt(Math.abs(deltaCents)) * 100n >
      BigInt(Math.abs(glCents)) * BigInt(STORE_MONTH_THRESHOLD_PERCENT)
  )
}
export function dashboardMonths(period: ReconciliationPeriod): string[] {
  const start = period.start.slice(0, 7)
  const end = period.end.slice(0, 7)
  if (
    !/^\d{4}-(0[1-9]|1[0-2])$/.test(start) ||
    !/^\d{4}-(0[1-9]|1[0-2])$/.test(end) ||
    start > end
  )
    return []
  const months: string[] = []
  let year = Number(start.slice(0, 4))
  let month = Number(start.slice(5))
  while (months.length < 240) {
    const key = `${year}-${String(month).padStart(2, '0')}`
    if (key > end) break
    months.push(key)
    if (++month === 13) {
      month = 1
      year++
    }
  }
  return months
}
export function defaultDashboardFilters(months: string[]): DashboardFilters {
  return {
    startMonth: months[0] ?? '',
    endMonth: months.at(-1) ?? '',
    channel: 'ALL',
    country: '',
  }
}

/** Queries use only validated dates and the same normalized relations as the bridge. */
export async function captureDashboardSnapshot(
  connection: AsyncDuckDBConnection,
  period: ReconciliationPeriod,
  signal?: AbortSignal,
): Promise<DashboardSnapshot> {
  const query = async (sql: string) => {
    signal?.throwIfAborted()
    const rows = (await connection.query(sql)).toArray()
    signal?.throwIfAborted()
    return rows
  }
  const months = [] as DashboardSnapshot['months']
  for (const month of dashboardMonths(period)) {
    const end = new Date(
      Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 0),
    )
      .toISOString()
      .slice(0, 10)
    const row = (
      await query(
        bridgeSQL(
          {
            start: period.start > `${month}-01` ? period.start : `${month}-01`,
            end: period.end < end ? period.end : end,
          },
          true,
        ),
      )
    )[0]
    const n = (key: string) => Number(row[key])
    const flash = n('Flash_Sales')
    const gl = n('GL_Finance')
    const adjustments = [
      'Discounts',
      'Cancellations',
      'Timing_Differences',
      'Returns',
      'Data_Errors',
    ].map(n)
    months.push({
      month,
      flashUSD: n('flash_period_rows') ? flash : null,
      glUSD: gl,
      discountsUSD: n('Discounts'),
      cancellationsUSD: n('Cancellations'),
      timingUSD: n('Timing_Differences'),
      returnsUSD: n('Returns'),
      dataErrorsUSD: n('Data_Errors'),
      unexplainedUSD: Number((gl - flash - sum(adjustments)).toFixed(2)),
      duplicateUSD: n('duplicate_adjustment'),
      missingUSD: n('missing_adjustment'),
    })
  }
  const glChannels = (
    await query(
      `SELECT strftime(posting_date, '%Y-%m') AS month, channel, CAST(SUM(revenue_usd) AS VARCHAR) AS revenue FROM vw_gl GROUP BY ALL ORDER BY 1,2`,
    )
  ).map((row) => ({
    month: String(row.month),
    channel: String(row.channel),
    revenueUSD: Number(row.revenue),
  }))
  // Only POS journal types enter the store comparator; WEB or unallocated journals cannot be attributed to a POS store implicitly.
  const cells = (
    await query(`WITH raw AS (SELECT store_key, business_date AS date, SUM(net_usd_daily) AS revenue FROM pos_clean GROUP BY ALL), expected AS (SELECT store_key, posting_date AS date, SUM(net_usd_month_end) AS revenue FROM vw_pos GROUP BY ALL), gl AS (SELECT store_key, posting_date AS date, SUM(revenue_usd) AS revenue FROM vw_gl WHERE journal_type LIKE 'POS%' GROUP BY ALL), keys AS (SELECT store_key,date FROM raw UNION SELECT store_key,date FROM expected UNION SELECT store_key,date FROM gl)
    SELECT k.store_key, CAST(k.date AS VARCHAR) AS date, CAST(COALESCE(r.revenue,0) AS VARCHAR) AS raw, CAST(COALESCE(e.revenue,0) AS VARCHAR) AS expected, CAST(COALESCE(g.revenue,0) AS VARCHAR) AS gl, e.store_key IS NOT NULL AS has_expected, g.store_key IS NOT NULL AS has_gl FROM keys k LEFT JOIN raw r USING(store_key,date) LEFT JOIN expected e USING(store_key,date) LEFT JOIN gl g USING(store_key,date) ORDER BY k.store_key,k.date`)
  ).map((row) => ({
    storeKey: String(row.store_key),
    date: String(row.date),
    rawUSD: Number(row.raw),
    expectedUSD: Number(row.expected),
    glUSD: Number(row.gl),
    hasExpected: Boolean(row.has_expected),
    hasGL: Boolean(row.has_gl),
  }))
  const online = (
    await query(`WITH entries AS (
    SELECT CAST(order_date AS VARCHAR) AS month, net_usd_month_end AS orders, 0::DECIMAL(18,2) AS recognized, 0::DECIMAL(18,2) AS gl FROM vw_web
    UNION ALL SELECT CAST(posting_date AS VARCHAR),0,revenue_usd,0 FROM expected_events WHERE source='WEB'
    UNION ALL SELECT CAST(posting_date AS VARCHAR),0,0,revenue_usd FROM vw_gl WHERE channel='WEB' OR journal_type LIKE 'WEB%')
    SELECT month,CAST(SUM(orders) AS VARCHAR) AS orders,CAST(SUM(recognized) AS VARCHAR) AS recognized,CAST(SUM(gl) AS VARCHAR) AS gl FROM entries GROUP BY month ORDER BY month`)
  ).map((row) => ({
    month: String(row.month),
    orderUSD: Number(row.orders),
    recognizedUSD: Number(row.recognized),
    glUSD: Number(row.gl),
  }))
  const qualityRows = await query(`WITH entries AS (
    SELECT strftime(return_date,'%Y-%m') AS month, net_usd_month_end AS returns, 0::DECIMAL(18,2) AS delivered, NULL::VARCHAR AS cancelled, 0 AS duplicates FROM vw_web WHERE is_returned
    UNION ALL SELECT strftime(delivery_date,'%Y-%m'),0,net_usd_month_end,NULL,0 FROM vw_web WHERE NOT is_cancelled
    UNION ALL SELECT strftime(order_date,'%Y-%m'),0,0,web_order_id,0 FROM vw_web WHERE is_cancelled
    UNION ALL SELECT strftime(business_date,'%Y-%m'),0,0,NULL,1 FROM q_POS_Dup_Rows)
    SELECT month,CAST(SUM(returns) AS VARCHAR) AS returns,CAST(SUM(delivered) AS VARCHAR) AS delivered,COUNT(DISTINCT cancelled) AS cancelled,SUM(duplicates) AS duplicates FROM entries GROUP BY month ORDER BY month`)
  const quality = months.map(({ month }) => {
    const row = qualityRows.find((row) => row.month === month)
    const returnsUSD = Number(row?.returns ?? 0)
    const deliveredUSD = Number(row?.delivered ?? 0)
    return {
      month,
      returnsUSD,
      deliveredUSD,
      returnRate: safeDashboardRatio(returnsUSD, deliveredUSD),
      cancelledOrders: Number(row?.cancelled ?? 0),
      removedDuplicateLines: Number(row?.duplicates ?? 0),
    }
  })
  return { months, glChannels, cells, online, quality }
}

function emptyModel(
  source: DashboardModel['source'],
  months: string[],
  selectedMonths: string[],
): DashboardModel {
  return {
    source,
    available: false,
    months,
    selectedMonths,
    channels: ['ALL'],
    countries: [],
    filterNotes: [],
    totals: {
      flashUSD: null,
      glUSD: null,
      deltaUSD: null,
      deltaRatio: null,
      rulesUSD: null,
      dataErrorsUSD: null,
      unexplainedUSD: null,
      roundingUSD: null,
    },
    monthly: [],
    bridge: [],
    checks: [],
    matrix: [],
    insights: [],
    detail: {
      available: false,
      reason:
        'Cần dữ liệu POS, WEB, GL và bảng cửa hàng × ngày từ cùng phiên xử lý.',
      stores: [],
      cells: [],
      trend: [],
      onlineTrend: [],
      rawCellCount: null,
      cellCount: null,
      beforeThresholdStores: null,
      afterThresholdStores: null,
      onlineDeltaUSD: null,
    },
    quality: {
      available: false,
      reason:
        'Cần bảng đơn WEB (ngày đặt, giao, trả, trạng thái) và dòng POS xuất lặp bị loại.',
      returnsUSD: null,
      deliveredUSD: null,
      returnRate: null,
      cancelledOrders: null,
      removedDuplicateLines: null,
      monthly: [],
      validations: [],
    },
  }
}

export function buildDashboardModel({
  source,
  result,
  workbook,
  filters,
}: {
  source: DashboardModel['source']
  result?: ReconciliationResult | null
  workbook?: ExcelReferenceWorkbook | null
  filters: DashboardFilters
}): DashboardModel {
  const months =
    source === 'excel'
      ? (workbook?.months ?? [])
      : (result?.dashboard?.months.map((row) => row.month) ??
        (result ? dashboardMonths(result.period) : []))
  const selectedMonths = months.filter(
    (month) =>
      (!filters.startMonth || month >= filters.startMonth) &&
      (!filters.endMonth || month <= filters.endMonth),
  )
  const model = emptyModel(source, months, selectedMonths)
  if (!selectedMonths.length || (source === 'excel' ? !workbook : !result))
    return model
  const selected = new Set(selectedMonths)
  const matches = (month: string) => selected.has(month.slice(0, 7))
  const sumMonthly = (values: Record<string, number>) =>
    sum(selectedMonths.map((month) => values[month] ?? 0))
  if (source === 'excel' && workbook) {
    model.available = true
    model.filterNotes.push(
      workbook.dashboard
        ? 'Excel: cầu nối giữ nguyên kết quả workbook; chi tiết, kênh và chất lượng lấy từ các sheet chuẩn hóa và QC_Summary. Quốc gia chưa được phân bổ cho đối soát chi tiết.'
        : 'Excel tham chiếu chỉ có cầu nối theo tháng; chưa có phân bổ kênh hoặc quốc gia đáng tin cậy.',
    )
    const rows = workbook.bridgeRows.filter(
      (row) =>
        row.kind === 'sales' ||
        row.kind === 'adjustment' ||
        row.kind === 'finance',
    )
    model.bridge = rows.map((row) => ({
      id: row.id,
      label: row.label,
      kind: row.kind as DashboardBridgeRow['kind'],
      category:
        row.kind !== 'adjustment'
          ? 'total'
          : row.detailCodes.some((code) =>
                ['DUP_POS', 'INTERFACE'].includes(code),
              )
            ? 'error'
            : row.detailCodes.includes('UNEXPLAINED')
              ? 'unexplained'
              : row.detailCodes.includes('ROUND')
                ? 'rounding'
                : 'rule',
      amountUSD: sumMonthly(row.monthly),
      monthly: row.monthly,
      startUSD: 0,
      endUSD: 0,
      detailCodes: row.detailCodes,
      sourceRows: [
        {
          fileName: workbook.fileName,
          sheetName: String(row.values.Source_Sheet ?? 'Cau_noi'),
          sourceRow:
            typeof row.values.Source_Row === 'number'
              ? row.values.Source_Row
              : row.sourceRow,
          month: selectedMonths.join(' → '),
          transactionId: '',
          amountUSD: sumMonthly(row.monthly),
          description: row.label,
        },
        ...workbook.details
          .filter(
            (detail) =>
              matches(detail.month) && row.detailCodes.includes(detail.code),
          )
          .slice(0, 199)
          .map((detail) => ({
            fileName: workbook.fileName,
            sheetName: String(detail.values.Source_Sheet ?? 'Chi_tiet'),
            sourceRow:
              typeof detail.values.Source_Row === 'number'
                ? detail.values.Source_Row
                : detail.sourceRow,
            month: detail.month,
            transactionId: detail.transactionId,
            amountUSD: detail.usd,
            description: detail.sourceLine,
          })),
      ],
      detailCount: workbook.details.filter(
        (detail) =>
          matches(detail.month) && row.detailCodes.includes(detail.code),
      ).length,
      sourceRowsTruncated:
        workbook.details.filter(
          (detail) =>
            matches(detail.month) && row.detailCodes.includes(detail.code),
        ).length > 199,
    }))
    model.monthly = selectedMonths.map((month) =>
      monthFromBridge(month, model.bridge),
    )
    model.checks = workbook.checks
      .filter(
        (check) =>
          check.unit === 'USD' &&
          (check.month
            ? selected.has(check.month)
            : selectedMonths.length === months.length),
      )
      .map((check) =>
        check.id === 'control-variance'
          ? {
              ...check,
              label: 'Đối chiếu tham chiếu · GL − Sales Flash',
              actualUSD: -check.actualUSD,
              expectedUSD: -check.expectedUSD,
              differenceUSD: -check.differenceUSD,
            }
          : { ...check },
      )
    const details = workbook.details.filter(
      (row) =>
        matches(row.month) &&
        (filters.channel === 'ALL' ||
          String(row.values.Kenh ?? '').toUpperCase() === filters.channel),
    )
    const distinct = (code: string, month?: string) =>
      new Set(
        details
          .filter((row) => row.code === code && (!month || row.month === month))
          .map((row) => row.transactionId)
          .filter(Boolean),
      ).size
    const amount = (code: string, month?: string) =>
      sum(
        details
          .filter((row) => row.code === code && (!month || row.month === month))
          .map((row) => Math.abs(row.usd ?? 0)),
      )
    const duplicateCount = (month?: string) =>
      details.filter(
        (row) => row.code === 'DUP_POS' && (!month || row.month === month),
      ).length
    model.quality = {
      ...model.quality,
      available: true,
      reason:
        'Chi_tiet: giá trị hàng trả theo cơ sở USD trong workbook; thiếu doanh thu WEB đã giao nên chưa tính tỷ lệ hàng trả. Không có bảng kiểm tra chất lượng Raw.',
      returnsUSD:
        filters.channel === 'ALL' || filters.channel === 'WEB'
          ? amount('RETURN')
          : null,
      cancelledOrders:
        filters.channel === 'ALL' || filters.channel === 'WEB'
          ? distinct('CANCEL')
          : null,
      removedDuplicateLines:
        filters.channel === 'ALL' || filters.channel === 'STORE'
          ? duplicateCount()
          : null,
      monthly: selectedMonths.map((month) => ({
        month,
        returnsUSD:
          filters.channel === 'ALL' || filters.channel === 'WEB'
            ? amount('RETURN', month)
            : null,
        deliveredUSD: null,
        returnRate: null,
        cancelledOrders:
          filters.channel === 'ALL' || filters.channel === 'WEB'
            ? distinct('CANCEL', month)
            : null,
        removedDuplicateLines:
          filters.channel === 'ALL' || filters.channel === 'STORE'
            ? duplicateCount(month)
            : null,
      })),
      validations: [],
    }
    const dashboard = workbook.dashboard
    if (dashboard) {
      model.channels = ['ALL', 'STORE', 'WEB', 'UNALLOCATED']
      populateDetail(model, [], dashboard, matches, filters.channel)
      model.detail.reason = dashboard.rules.join(' ')
      const includeWeb = filters.channel === 'ALL' || filters.channel === 'WEB'
      const includeStore =
        filters.channel === 'ALL' || filters.channel === 'STORE'
      const quality = dashboard.quality
        .filter((row) => selected.has(row.month))
        .map((row) => ({
          ...row,
          returnsUSD: includeWeb ? row.returnsUSD : null,
          deliveredUSD: includeWeb ? row.deliveredUSD : null,
          returnRate: includeWeb ? row.returnRate : null,
          cancelledOrders: includeWeb ? row.cancelledOrders : null,
          removedDuplicateLines: includeStore
            ? row.removedDuplicateLines
            : null,
        }))
      const metric = (key: keyof Omit<DashboardQualityMonth, 'month'>) =>
        quality.every((row) => row[key] !== null)
          ? sum(quality.map((row) => row[key] ?? 0))
          : null
      const returnsUSD = metric('returnsUSD')
      const deliveredUSD = metric('deliveredUSD')
      model.quality = {
        available: true,
        reason:
          'Excel · theo quy tắc báo cáo: hàng trả tại ngày trả / đơn đã giao tại ngày giao, dùng net_usd_daily. Đơn hủy theo ngày đặt; POS trùng chỉ đếm export_seq > 1. QC_Summary giữ nguyên kết quả toàn workbook, không lọc theo tháng hoặc kênh; ô chưa đánh giá không được coi là đạt.',
        returnsUSD,
        deliveredUSD,
        returnRate: safeDashboardRatio(returnsUSD, deliveredUSD),
        cancelledOrders: metric('cancelledOrders'),
        removedDuplicateLines: metric('removedDuplicateLines'),
        monthly: quality,
        validations: dashboard.validations.map((row) => ({
          ...row,
          status: row.status || 'Chưa đánh giá',
        })),
      }
      model.matrix = (['STORE', 'WEB', 'UNALLOCATED'] as const)
        .filter(
          (channel) => filters.channel === 'ALL' || channel === filters.channel,
        )
        .flatMap((channel) =>
          (['flash', 'gl'] as const)
            .filter((kind) => channel !== 'UNALLOCATED' || kind === 'gl')
            .map((kind) => {
              const rows =
                kind === 'flash'
                  ? dashboard.flashChannels
                  : dashboard.glChannels
              const monthly = Object.fromEntries(
                months.map((month) => [
                  month,
                  sum(
                    rows
                      .filter(
                        (row) => row.channel === channel && row.month === month,
                      )
                      .map((row) => row.revenueUSD),
                  ),
                ]),
              )
              return {
                id: `${kind}-${channel}`,
                label: `${kind === 'flash' ? 'Sales Flash' : 'GL'} · ${channel === 'STORE' ? 'Cửa hàng' : channel === 'WEB' ? 'Online' : 'Chưa phân bổ'}`,
                monthly,
                totalUSD: sum(selectedMonths.map((month) => monthly[month])),
              }
            }),
        )
    }
  } else if (result) {
    model.available = true
    const snapshot = result.dashboard
    model.channels = snapshot ? ['ALL', 'STORE', 'WEB', 'UNALLOCATED'] : ['ALL']
    model.filterNotes.push(
      'Quốc gia chưa có phân bổ đáng tin cậy cho cả Flash và GL; bộ lọc quốc gia chưa áp dụng.',
    )
    if (snapshot) {
      const specs: [
        string,
        string,
        keyof DashboardSnapshot['months'][number],
        DashboardBridgeRow['category'],
      ][] = [
        ['Flash_Sales', 'Doanh số Sales Flash', 'flashUSD', 'total'],
        ['Discounts', 'Chiết khấu', 'discountsUSD', 'rule'],
        ['Duplicate_POS', 'Dòng POS trùng bị loại', 'duplicateUSD', 'error'],
        ['Cancellations', 'Đơn online bị hủy', 'cancellationsUSD', 'rule'],
        ['Timing_Differences', 'Lệch thời điểm ghi nhận', 'timingUSD', 'rule'],
        ['Returns', 'Hàng trả', 'returnsUSD', 'rule'],
        ['Missing_GL', 'Nhóm thiếu GL', 'missingUSD', 'error'],
        ['Unexplained', 'Chưa giải thích', 'unexplainedUSD', 'unexplained'],
        ['GL_Finance', 'Doanh thu GL', 'glUSD', 'total'],
      ]
      model.bridge = specs.map(([id, label, field, category], index) => ({
        id,
        label,
        kind:
          index === 0
            ? 'sales'
            : index === specs.length - 1
              ? 'finance'
              : 'adjustment',
        category,
        amountUSD: sum(
          snapshot.months
            .filter((row) => selected.has(row.month))
            .map((row) => Number(row[field] ?? 0)),
        ),
        monthly: Object.fromEntries(
          snapshot.months.map((row) => [row.month, Number(row[field] ?? 0)]),
        ),
        startUSD: 0,
        endUSD: 0,
        sourceRows: [],
        detailCodes: [id],
      }))
      for (const row of model.bridge) {
        const tableIds: Record<string, string[]> = {
          Flash_Sales: ['vw_flash'],
          Discounts: ['pos_clean', 'vw_web'],
          Duplicate_POS: ['q_POS_Dup_Rows'],
          Cancellations: ['vw_web'],
          Timing_Differences: ['expected_events'],
          Returns: ['expected_events'],
          Missing_GL: ['daily_comparison'],
          Unexplained: [],
          GL_Finance: ['vw_gl'],
        }
        const tables =
          result.evidence?.tables.filter((table) =>
            (tableIds[row.id] ?? []).includes(table.id),
          ) ?? []
        row.sourceRowsTruncated = tables.some((table) => table.truncated)
        row.detailCount = tables.reduce(
          (count, table) => count + table.rowCount,
          0,
        )
        row.sourceRows = tables.flatMap((table) =>
          table.rows
            .filter((record) => {
              const date =
                record.month_end_date ??
                record.posting_date ??
                record.order_date ??
                record.business_date ??
                ''
              if (!matches(date)) return false
              if (row.id === 'Cancellations')
                return record.is_cancelled === 'true'
              if (row.id === 'Returns')
                return record.event_type === 'WEB return'
              if (row.id === 'Missing_GL') return record.missing_gl === 'true'
              return true
            })
            .map((record) => {
              const journal = record.journal_id
                ? result.glReview?.records.find(
                    (item) => item.journalId === record.journal_id,
                  )
                : undefined
              return {
                fileName:
                  journal?.fileName ??
                  record.source_file ??
                  result.evidence?.files.find(
                    (file) => file.fileId === record.source_file_id,
                  )?.fileName ??
                  'Không xác định file từ bảng tổng hợp',
                sheetName:
                  journal?.sheetName ??
                  record.source_sheet ??
                  'Không xác định sheet',
                sourceTable: table.id,
                sourceRow:
                  journal?.sourceRow ??
                  (record.source_row === null || record.source_row === undefined
                    ? null
                    : Number(record.source_row)),
                sourceRecord:
                  journal?.sourceRecord ??
                  (record.source_record == null
                    ? null
                    : Number(record.source_record)),
                month: (
                  record.month_end_date ??
                  record.posting_date ??
                  record.order_date ??
                  record.business_date ??
                  ''
                ).slice(0, 7),
                transactionId:
                  record.transaction_id ??
                  record.journal_id ??
                  record.web_order_id ??
                  record.receipt_no ??
                  '',
                amountUSD:
                  record.revenue_usd === null ||
                  record.revenue_usd === undefined
                    ? null
                    : Number(record.revenue_usd),
                description: `Preview cùng phiên · ${table.label}; số dòng toàn bảng ${table.rowCount}.`,
              }
            }),
        )
      }
      model.monthly = selectedMonths.map((month) => {
        const row = snapshot.months.find((row) => row.month === month)!
        return {
          ...monthFromBridge(month, model.bridge),
          flashUSD: row.flashUSD,
          deltaUSD: row.flashUSD === null ? null : row.glUSD - row.flashUSD,
          deltaRatio: safeDashboardRatio(
            row.flashUSD === null ? null : row.glUSD - row.flashUSD,
            row.flashUSD,
          ),
        }
      })
      model.checks = model.monthly.map((row) => {
        const actualUSD = sum(
          model.bridge
            .filter((item) => item.kind !== 'finance')
            .map((item) => item.monthly[row.month] ?? 0),
        )
        return {
          id: `bridge-${row.month}`,
          label: 'Flash + điều chỉnh + chưa giải thích so với GL',
          actualUSD,
          expectedUSD: row.glUSD ?? 0,
          differenceUSD: actualUSD - (row.glUSD ?? 0),
          passed:
            row.flashUSD !== null &&
            Math.abs(actualUSD - (row.glUSD ?? 0)) <= 0.01,
          month: row.month,
        }
      })
      populateDetail(
        model,
        result.exceptions,
        snapshot,
        matches,
        filters.channel,
      )
      const quality = snapshot.quality
        .filter((row) => selected.has(row.month))
        .map((row) => ({ ...row }))
      const includeWeb = filters.channel === 'ALL' || filters.channel === 'WEB'
      const includeStore =
        filters.channel === 'ALL' || filters.channel === 'STORE'
      for (const row of quality) {
        if (!includeWeb) {
          row.returnsUSD = null
          row.deliveredUSD = null
          row.returnRate = null
          row.cancelledOrders = null
        }
        if (!includeStore) row.removedDuplicateLines = null
      }
      const metric = (key: keyof Omit<DashboardQualityMonth, 'month'>) =>
        quality.every((row) => row[key] !== null)
          ? sum(quality.map((row) => row[key] ?? 0))
          : null
      const returnsUSD = metric('returnsUSD'),
        deliveredUSD = metric('deliveredUSD')
      model.quality = {
        available: true,
        reason:
          'Hàng trả: net USD tại ngày trả; mẫu số: net USD của đơn không hủy theo ngày giao. POS trùng: số export bị loại, không phải toàn bộ nhóm trùng. Kiểm tra nguồn áp dụng toàn phiên.',
        returnsUSD,
        deliveredUSD,
        returnRate: safeDashboardRatio(returnsUSD, deliveredUSD),
        cancelledOrders: metric('cancelledOrders'),
        removedDuplicateLines: metric('removedDuplicateLines'),
        monthly: quality,
        validations: (result.evidence?.validations ?? []).map((row) => ({
          id: row.id,
          label: dashboardValidationLabel(row.message),
          count: row.invalidCount,
          status: row.status === 'passed' ? 'Đạt' : 'Cần kiểm tra',
          tableId: /^WEB/.test(row.message)
            ? 'vw_web'
            : /^GL/.test(row.message)
              ? 'vw_gl'
              : /^Flash/.test(row.message)
                ? 'vw_flash'
                : 'pos_clean',
        })),
      }
      model.matrix = (['STORE', 'WEB', 'UNALLOCATED'] as const)
        .map((channel) => ({
          id: channel,
          label:
            channel === 'STORE'
              ? 'GL · Cửa hàng'
              : channel === 'WEB'
                ? 'GL · Online'
                : 'GL · Chưa phân bổ',
          monthly: Object.fromEntries(
            months.map((month) => [
              month,
              sum(
                snapshot.glChannels
                  .filter(
                    (row) => row.channel === channel && row.month === month,
                  )
                  .map((row) => row.revenueUSD),
              ),
            ]),
          ),
          totalUSD: sum(
            snapshot.glChannels
              .filter(
                (row) => row.channel === channel && selected.has(row.month),
              )
              .map((row) => row.revenueUSD),
          ),
        }))
        .filter(
          (row) => filters.channel === 'ALL' || row.id === filters.channel,
        )
    } else {
      // Existing or legacy snapshots have only one verified period total. Never divide it into synthetic months.
      const fullSelection = selectedMonths.length === months.length
      if (fullSelection) {
        model.totals.flashUSD = result.cents.Flash_Sales / 100
        model.totals.glUSD = result.cents.GL_Finance / 100
        model.totals.rulesUSD = sum(
          ['Discounts', 'Cancellations', 'Timing_Differences', 'Returns'].map(
            (key) => result.cents[key as keyof typeof result.cents] / 100,
          ),
        )
        model.totals.dataErrorsUSD = result.cents.Data_Errors / 100
        model.totals.unexplainedUSD = result.unexplainedCents / 100
      }
      model.filterNotes.push(
        'Snapshot này chưa lưu tổng hợp theo tháng; cần chạy phiên xử lý mới để xem biểu đồ và lọc tháng. Không tổng hợp từ preview giới hạn.',
      )
    }
  }
  if (model.bridge.length) {
    let running = 0
    for (const row of model.bridge) {
      row.startUSD = row.kind === 'adjustment' ? running : 0
      row.endUSD =
        row.kind === 'adjustment'
          ? sum([running, row.amountUSD])
          : row.amountUSD
      running = row.endUSD
    }
    model.totals = {
      flashUSD: sum(
        model.bridge
          .filter((row) => row.kind === 'sales')
          .map((row) => row.amountUSD),
      ),
      glUSD: sum(
        model.bridge
          .filter((row) => row.kind === 'finance')
          .map((row) => row.amountUSD),
      ),
      deltaUSD: null,
      deltaRatio: null,
      rulesUSD: sum(
        model.bridge
          .filter((row) => row.category === 'rule')
          .map((row) => row.amountUSD),
      ),
      dataErrorsUSD: sum(
        model.bridge
          .filter((row) => row.category === 'error')
          .map((row) => row.amountUSD),
      ),
      unexplainedUSD: sum(
        model.bridge
          .filter((row) => row.category === 'unexplained')
          .map((row) => row.amountUSD),
      ),
      roundingUSD: model.bridge.some((row) => row.category === 'rounding')
        ? sum(
            model.bridge
              .filter((row) => row.category === 'rounding')
              .map((row) => row.amountUSD),
          )
        : null,
    }
    if (model.monthly.some((row) => row.flashUSD === null)) {
      model.totals.flashUSD = null
      model.totals.rulesUSD = null
      model.totals.dataErrorsUSD = null
      model.totals.unexplainedUSD = null
      model.bridge = []
      model.filterNotes.push(
        'Thiếu Sales Flash ở ít nhất một tháng đã chọn; không thể tính cầu nối hoặc chênh lệch cho toàn kỳ.',
      )
    }
  }
  if (filters.channel !== 'ALL') {
    const channelSnapshot =
      source === 'raw' ? result?.dashboard : workbook?.dashboard
    const flashByChannel =
      source === 'excel' && filters.channel !== 'UNALLOCATED'
        ? workbook?.dashboard?.flashChannels
        : undefined
    const channelFlash = (month: string) =>
      flashByChannel
        ? sum(
            flashByChannel
              .filter(
                (row) => row.channel === filters.channel && row.month === month,
              )
              .map((row) => row.revenueUSD),
          )
        : null
    if (channelSnapshot) {
      model.totals.glUSD = sum(
        channelSnapshot.glChannels
          .filter(
            (row) => row.channel === filters.channel && selected.has(row.month),
          )
          .map((row) => row.revenueUSD),
      )
      model.monthly = model.monthly.map((row) => {
        const flashUSD = channelFlash(row.month)
        const glUSD = sum(
          channelSnapshot.glChannels
            .filter(
              (item) =>
                item.channel === filters.channel && item.month === row.month,
            )
            .map((item) => item.revenueUSD),
        )
        const deltaUSD = flashUSD === null ? null : glUSD - flashUSD
        return {
          ...row,
          flashUSD,
          glUSD,
          deltaUSD,
          deltaRatio: safeDashboardRatio(deltaUSD, flashUSD),
          rulesUSD: null,
          dataErrorsUSD: null,
          unexplainedUSD: null,
        }
      })
    } else model.totals.glUSD = null
    model.totals.flashUSD = flashByChannel
      ? sum(selectedMonths.map((month) => channelFlash(month)!))
      : null
    model.totals.rulesUSD = null
    model.totals.dataErrorsUSD = null
    model.totals.unexplainedUSD = null
    model.totals.roundingUSD = null
    model.bridge = []
    model.checks = []
    model.filterNotes.push(
      flashByChannel
        ? 'Flash và GL theo kênh lấy từ sheet chuẩn hóa. Cầu nối điều chỉnh chỉ có tổng tất cả kênh nên không phân bổ cầu nối hoặc phần dư theo kênh.'
        : 'Flash không có phân bổ kênh đã xác minh: chỉ GL và chi tiết có dữ liệu kênh được lọc; chênh lệch và cầu nối để trống.',
    )
  }
  if (filters.country && filters.country !== 'ALL') {
    return {
      ...emptyModel(source, months, selectedMonths),
      filterNotes: [
        'Chưa có dữ liệu phân bổ quốc gia đáng tin cậy. Hãy đặt lại bộ lọc quốc gia.',
      ],
    }
  }
  model.totals.deltaUSD =
    model.totals.flashUSD !== null && model.totals.glUSD !== null
      ? model.totals.glUSD - model.totals.flashUSD
      : null
  model.totals.deltaRatio = safeDashboardRatio(
    model.totals.deltaUSD,
    model.totals.flashUSD,
  )
  if (!model.matrix.length)
    model.matrix = [
      {
        id: 'flash',
        label: 'Sales Flash · tổng kênh',
        monthly: Object.fromEntries(
          months.map((month) => [
            month,
            filters.channel !== 'ALL'
              ? null
              : source === 'excel'
                ? (workbook?.bridgeRows.find((row) => row.kind === 'sales')
                    ?.monthly[month] ?? null)
                : (result?.dashboard?.months.find((row) => row.month === month)
                    ?.flashUSD ?? null),
          ]),
        ),
        totalUSD: model.totals.flashUSD,
      },
      {
        id: 'gl',
        label: 'GL · tổng kênh',
        monthly: Object.fromEntries(
          months.map((month) => [
            month,
            filters.channel !== 'ALL'
              ? null
              : source === 'excel'
                ? (workbook?.bridgeRows.find((row) => row.kind === 'finance')
                    ?.monthly[month] ?? null)
                : (result?.dashboard?.months.find((row) => row.month === month)
                    ?.glUSD ?? null),
          ]),
        ),
        totalUSD: model.totals.glUSD,
      },
    ]
  const money = (value: number) =>
    new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(value) +
    ' USD'
  if (model.totals.deltaUSD !== null)
    model.insights.push(
      `GL ${model.totals.deltaUSD < 0 ? 'thấp hơn' : 'cao hơn'} Sales Flash ${money(Math.abs(model.totals.deltaUSD))} trong ${selectedMonths.length} tháng đã chọn.`,
    )
  if (model.totals.unexplainedUSD !== null)
    model.insights.push(
      `Khoản chưa giải thích: ${money(model.totals.unexplainedUSD)}; đây là phần dư sau các điều chỉnh đã phân loại.`,
    )
  const top = model.monthly
    .filter((row) => row.unexplainedUSD !== null)
    .sort(
      (a, b) =>
        Math.abs(b.unexplainedUSD ?? 0) - Math.abs(a.unexplainedUSD ?? 0),
    )[0]
  if (top)
    model.insights.push(
      `Tháng ${top.month} có độ lớn phần dư cao nhất: ${money(top.unexplainedUSD ?? 0)}.`,
    )
  const offset = model.bridge.filter(
    (row) =>
      row.kind === 'adjustment' &&
      Math.abs(row.amountUSD) < 0.005 &&
      selectedMonths.some((month) => Math.abs(row.monthly[month] ?? 0) > 0.005),
  )
  if (offset.length)
    model.insights.push(
      `${offset.length} khoản mục tự bù trong kỳ vẫn được giữ để xem ảnh hưởng từng tháng.`,
    )
  if (model.detail.afterThresholdStores !== null)
    model.insights.push(
      `${model.detail.afterThresholdStores} cửa hàng vượt đồng thời 200 USD và 1% |GL| ở ít nhất một tháng sau chuẩn hóa.`,
    )
  if (!model.insights.length)
    model.insights.push(
      'Chọn kỳ có dữ liệu và nguồn kết quả để xem các nhận xét được tính từ số liệu hiện tại.',
    )
  return model
}

function dashboardValidationLabel(message: string): string {
  if (/^WEB has invalid/.test(message))
    return 'WEB · Kiểm tra khóa, ngày, trạng thái và số tiền USD'
  if (/^WEB web_order_id/.test(message)) return 'WEB · Kiểm tra mã đơn duy nhất'
  if (/^GL requires/.test(message))
    return 'GL · Kiểm tra định danh, ngày ghi sổ và số tiền có dấu'
  if (/^GL journal_id/.test(message))
    return 'GL · Kiểm tra mã bút toán duy nhất'
  if (/^Flash requires/.test(message))
    return 'Sales Flash · Kiểm tra ngày cuối tháng và doanh thu không âm'
  if (/^POS has invalid/.test(message))
    return 'POS · Kiểm tra khóa, ngày và số tiền USD'
  if (/^Each POS/.test(message))
    return 'POS · Kiểm tra export gốc cho mỗi receipt_no + line_no'
  if (/^Conflicting/.test(message))
    return 'POS · Kiểm tra nội dung export gốc bị xung đột'
  return message
}

function monthFromBridge(
  month: string,
  bridge: DashboardBridgeRow[],
): DashboardMonth {
  const amount = (predicate: (row: DashboardBridgeRow) => boolean) =>
    sum(bridge.filter(predicate).map((row) => row.monthly[month] ?? 0))
  const flashUSD = amount((row) => row.kind === 'sales'),
    glUSD = amount((row) => row.kind === 'finance')
  return {
    month,
    flashUSD,
    glUSD,
    deltaUSD: glUSD - flashUSD,
    deltaRatio: safeDashboardRatio(glUSD - flashUSD, flashUSD),
    rulesUSD: amount((row) => row.category === 'rule'),
    dataErrorsUSD: amount((row) => row.category === 'error'),
    unexplainedUSD: amount((row) => row.category === 'unexplained'),
  }
}

function populateDetail(
  model: DashboardModel,
  exceptions: ReconciliationResult['exceptions'],
  snapshot: Pick<DashboardSnapshot, 'cells' | 'online'>,
  matches: (month: string) => boolean,
  channel: DashboardChannel,
) {
  const includeStore = channel === 'ALL' || channel === 'STORE'
  const includeWeb = channel === 'ALL' || channel === 'WEB'
  const cells = includeStore
    ? snapshot.cells.filter((row) => matches(row.date))
    : []
  const deltas = (row: DashboardSnapshot['cells'][number]) => ({
    raw: row.glUSD - row.rawUSD,
    normal: row.glUSD - row.expectedUSD,
  })
  const storeMonths = new Map<
    string,
    {
      storeKey: string
      month: string
      raw: number
      normal: number
      gl: number
      hasExpected: boolean
      hasGL: boolean
    }
  >()
  for (const row of cells) {
    const month = row.date.slice(0, 7),
      key = `${row.storeKey}|${month}`
    const group = storeMonths.get(key) ?? {
      storeKey: row.storeKey,
      month,
      raw: 0,
      normal: 0,
      gl: 0,
      hasExpected: false,
      hasGL: false,
    }
    group.raw += deltas(row).raw
    group.normal += deltas(row).normal
    group.gl += row.glUSD
    group.hasExpected ||= row.hasExpected
    group.hasGL ||= row.hasGL
    storeMonths.set(key, group)
  }
  const values = [...storeMonths.values()]
  const storeKeys = [...new Set(values.map((row) => row.storeKey))]
  const exceptionIds = (storeKey: string, date?: string) =>
    exceptions
      .filter(
        (row) =>
          row.storeKey === storeKey &&
          matches(row.date) &&
          (!date || row.date === date),
      )
      .map((row) => row.id)
  const stores = storeKeys.map((storeKey) => {
    const entries = values.filter((row) => row.storeKey === storeKey)
    const rawDeltaUSD = sum(entries.map((row) => row.raw)),
      normalizedDeltaUSD = sum(entries.map((row) => row.normal)),
      gl = sum(entries.map((row) => row.gl))
    const hasMissing = entries.some((row) => !row.hasExpected || !row.hasGL)
    return {
      storeKey,
      rawDeltaUSD,
      normalizedDeltaUSD,
      ratio: hasMissing
        ? null
        : safeDashboardRatio(normalizedDeltaUSD, Math.abs(gl)),
      magnitudeUSD: sum(entries.map((row) => Math.abs(row.normal))),
      status: hasMissing
        ? 'Thiếu một bên'
        : entries.some((row) => row.gl === 0 && Math.abs(row.normal) > 0.005)
          ? 'GL bằng 0'
          : entries.some((row) => storeMonthBreaches(row.normal, row.gl))
            ? 'Vượt ngưỡng'
            : entries.some((row) => Math.abs(row.normal) > 0.005)
              ? 'Còn chênh lệch'
              : 'Khớp',
      months: entries
        .filter((row) => Math.abs(row.normal) > 0.005)
        .map((row) => row.month),
      exceptionIds: exceptionIds(storeKey),
    }
  })
  const onlineTrend = includeWeb
    ? snapshot.online
        .filter((row) => matches(row.month))
        .map((row) => ({ ...row, deltaUSD: row.glUSD - row.recognizedUSD }))
    : []
  model.detail = {
    available: true,
    reason:
      'Cửa hàng: GL journal_type POS* so với net POS. Trước chuẩn hóa dùng ngày bán và daily USD của toàn bộ export; sau chuẩn hóa dùng keeper, ngày hạch toán và month-end USD. Ngưỡng áp dụng từng cửa hàng–tháng: |Δ| > 200 và |Δ| / |GL| > 1%; trạng thái thiếu một bên hoặc GL bằng 0 được tách riêng. Online: đơn theo ngày đặt (gồm hủy) so với ngày giao trừ hàng trả.',
    stores,
    cells: cells
      .filter((row) => Math.abs(deltas(row).normal) > 0.005)
      .map((row) => ({
        id: `${row.storeKey}|${row.date}`,
        storeKey: row.storeKey,
        date: row.date,
        expectedUSD: row.expectedUSD,
        glUSD: row.glUSD,
        deltaUSD: deltas(row).normal,
        status: !row.hasGL
          ? 'Chỉ có POS'
          : !row.hasExpected
            ? 'Chỉ có GL'
            : 'Lệch tiền',
        exceptionIds: exceptionIds(row.storeKey, row.date),
      })),
    trend: includeStore
      ? model.selectedMonths.map((month) => ({
          month,
          rawDeltaUSD: sum(
            values.filter((row) => row.month === month).map((row) => row.raw),
          ),
          normalizedDeltaUSD: sum(
            values
              .filter((row) => row.month === month)
              .map((row) => row.normal),
          ),
        }))
      : [],
    onlineTrend,
    rawCellCount: includeStore
      ? cells.filter((row) => Math.abs(deltas(row).raw) > 0.005).length
      : null,
    cellCount: includeStore
      ? cells.filter((row) => row.hasExpected || row.hasGL).length
      : null,
    beforeThresholdStores: includeStore
      ? new Set(
          values
            .filter((row) => storeMonthBreaches(row.raw, row.gl))
            .map((row) => row.storeKey),
        ).size
      : null,
    afterThresholdStores: includeStore
      ? new Set(
          values
            .filter((row) => storeMonthBreaches(row.normal, row.gl))
            .map((row) => row.storeKey),
        ).size
      : null,
    onlineDeltaUSD: includeWeb
      ? sum(onlineTrend.map((row) => row.deltaUSD))
      : null,
  }
}
