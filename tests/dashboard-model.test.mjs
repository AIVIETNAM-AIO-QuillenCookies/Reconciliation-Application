import assert from 'node:assert/strict'
import { before, test } from 'node:test'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import {
  createDuckDB,
  NODE_RUNTIME,
  VoidLogger,
} from '@duckdb/duckdb-wasm/blocking'
import { ReconciliationEngine } from '../src/lib/ReconciliationEngine.ts'
import { parseExcelReference } from '../src/lib/excel-reference.ts'
import {
  buildDashboardModel,
  defaultDashboardFilters,
  safeDashboardRatio,
  storeMonthBreaches,
} from '../src/lib/dashboard-model.ts'

let engine, workbook
before(async () => {
  const require = createRequire(import.meta.url)
  const bindings = await createDuckDB(
    {
      mvp: {
        mainModule: require.resolve('@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm'),
      },
      eh: {
        mainModule: require.resolve('@duckdb/duckdb-wasm/dist/duckdb-eh.wasm'),
      },
    },
    new VoidLogger(),
    NODE_RUNTIME,
  )
  await bindings.instantiate()
  bindings.open({ path: ':memory:' })
  engine = new ReconciliationEngine(
    {
      registerFileText: async (path, text) =>
        bindings.registerFileText(path, text),
      registerFileBuffer: async (path, bytes) =>
        bindings.registerFileBuffer(path, bytes),
      dropFile: async (path) => bindings.dropFile(path),
      connect: async () => {
        const connection = bindings.connect()
        return {
          query: async (sql) => connection.query(sql),
          close: async () => connection.close(),
        }
      },
    },
    undefined,
    undefined,
    { schemaMode: 'accounting', onWarning() {} },
  )
  workbook = await parseExcelReference(
    new Uint8Array(
      await readFile(
        new URL('../public/reference/excel-reference.xlsx', import.meta.url),
      ),
    ),
    'excel-reference.xlsx',
  )
})

test('Excel totals, waterfall arithmetic and zero annual adjustments retain the verified monthly values', () => {
  const model = buildDashboardModel({
    source: 'excel',
    workbook,
    filters: { ...defaultDashboardFilters(workbook.months), country: 'ALL' },
  })
  assert.equal(model.available, true)
  assert.equal(model.totals.flashUSD, 31_124_401)
  assert.equal(model.totals.glUSD, 28_698_496.23)
  assert.ok(Math.abs(model.totals.deltaUSD - -2_425_904.77) < 1e-7)
  assert.equal(model.totals.unexplainedUSD, 1250)
  assert.ok(
    model.checks.find((check) => check.id === 'control-variance').actualUSD < 0,
  )
  assert.ok(model.totals.deltaRatio < 0)
  const finance = model.bridge.at(-1)
  assert.equal(finance.kind, 'finance')
  assert.ok(Math.abs(model.bridge.at(-2).endUSD - finance.amountUSD) < 0.011)
  const offset = model.bridge.find((row) =>
    row.detailCodes.includes('INTERFACE'),
  )
  assert.equal(offset.amountUSD, 0)
  assert.notEqual(offset.monthly['2025-11'], 0)
  assert.notEqual(offset.monthly['2025-12'], 0)
  assert.ok(
    model.bridge.every(
      (row) => row.kind !== 'check' && row.kind !== 'bridge_total',
    ),
  )
  const contribution = model.bridge
    .filter((row) => row.kind === 'adjustment')
    .reduce((sum, row) => sum + row.amountUSD, 0)
  assert.ok(Math.abs(contribution - model.totals.deltaUSD) < 0.011)
  assert.equal(model.quality.cancelledOrders, 124)
  assert.equal(model.quality.removedDuplicateLines, 12)
  assert.equal(model.quality.deliveredUSD, null)
  assert.equal(model.quality.returnRate, null)
  assert.equal(model.detail.cellCount, null)
})

test('Excel month selection scopes totals, checks, insights and detail without inventing channels or countries', () => {
  const filters = {
    ...defaultDashboardFilters(workbook.months),
    startMonth: '2025-11',
    endMonth: '2025-11',
  }
  const model = buildDashboardModel({ source: 'excel', workbook, filters })
  assert.deepEqual(model.selectedMonths, ['2025-11'])
  assert.equal(
    model.totals.flashUSD,
    workbook.bridgeRows.find((row) => row.kind === 'sales').monthly['2025-11'],
  )
  assert.equal(model.monthly.length, 1)
  assert.ok(model.checks.every((check) => check.month === '2025-11'))
  assert.deepEqual(model.channels, ['ALL'])
  assert.deepEqual(model.countries, [])
  assert.equal(Object.keys(model.matrix[0].monthly).length, 12)
  assert.ok(model.insights[0].includes('1 tháng'))
  assert.ok(
    model.bridge
      .flatMap((row) => row.sourceRows)
      .filter((row) => row.sheetName === 'Chi_tiet')
      .every((row) => row.month === '2025-11'),
  )
  assert.equal(
    buildDashboardModel({
      source: 'excel',
      workbook,
      filters: { ...filters, country: 'DE' },
    }).available,
    false,
  )
  assert.equal(
    buildDashboardModel({
      source: 'excel',
      workbook,
      filters: { ...filters, channel: 'WEB' },
    }).totals.deltaUSD,
    null,
  )
  const storeOnly = buildDashboardModel({
    source: 'excel',
    workbook,
    filters: { ...filters, channel: 'STORE' },
  })
  assert.equal(storeOnly.quality.returnsUSD, null)
  assert.equal(storeOnly.quality.cancelledOrders, null)
  const webOnly = buildDashboardModel({
    source: 'excel',
    workbook,
    filters: { ...defaultDashboardFilters(workbook.months), channel: 'WEB' },
  })
  assert.equal(webOnly.quality.cancelledOrders, 124)
  assert.equal(webOnly.quality.removedDuplicateLines, null)
})

test('safe ratios and strict store-month thresholds separate zero denominators and boundary equality', () => {
  assert.equal(safeDashboardRatio(1, 0), null)
  assert.equal(safeDashboardRatio(null, 100), null)
  assert.equal(safeDashboardRatio(0, 100), 0)
  assert.equal(storeMonthBreaches(200, 1000), false)
  assert.equal(storeMonthBreaches(200.000000000004, 1000), false)
  assert.equal(storeMonthBreaches(201, 20100), false)
  assert.equal(storeMonthBreaches(-201, -20000), true)
  assert.equal(storeMonthBreaches(300, 0), false)
})

test('Raw dashboard captures complete same-run data beyond preview limits and applies normalization per month', async () => {
  const extra = Array.from(
    { length: 65 },
    (_, i) =>
      `R${i + 10},1,S10,2025-01-15,2025-01-15,10,0,10,2025-01-16 08:00:00`,
  )
  const pos = `receipt_no,line_no,store_key,business_date,posting_date,gross_usd_daily,discount_usd_daily,net_usd_month_end,exported_at\nR1,1,S01,2025-01-31,2025-02-01,1000,0,1000,2025-02-01 08:00:00\nR1,1,S01,2025-01-31,2025-02-01,1000,0,1000,2025-02-01 09:00:00\nR2,1,S02,2025-01-10,2025-01-10,200,0,200,2025-01-11 08:00:00\nR3,1,S03,2025-01-12,2025-01-12,300,0,300,2025-01-13 08:00:00\n${extra.join('\n')}`
  const web = `web_order_id,store_key,order_date,delivery_date,return_date,order_status,gross_usd_daily,discount_usd_daily,net_usd_month_end\nW1,999999,2025-01-01,2025-01-02,2025-02-02,Returned,100,0,100\nW2,999999,2025-02-01,2025-02-03,,Delivered,900,0,900\nW3,999999,2025-01-01,,,Cancelled,90,0,90`
  const gl = `journal_id,posting_date,store_key,journal_type,amount_usd\nG1,2025-01-31,S01,POS,-1000\nG2,2025-01-10,S02,POS,-400\nG3,2025-01-15,S10,POS,-650\nG4,2025-01-02,999999,WEB,-100\nG5,2025-02-03,999999,WEB,-900\nG6,2025-02-02,999999,WEB_RETURN,100`
  const flash = 'month_end_date,revenue_usd\n2025-01-31,3340\n2025-02-28,900'
  const files = Object.entries({
    POS: pos,
    WEB: web,
    GL: gl,
    Flash: flash,
  }).map(([source, csv]) => ({
    id: source,
    source,
    file: new File([csv], `${source}.csv`, { type: 'text/csv' }),
  }))
  const result = await engine.processUploads(files, {
    start: '2025-01-01',
    end: '2025-02-28',
  })
  const model = buildDashboardModel({
    source: 'raw',
    result,
    filters: defaultDashboardFilters(['2025-01', '2025-02']),
  })
  assert.ok(
    result.evidence.tables.find((table) => table.id === 'vw_pos').truncated,
  )
  assert.equal(model.quality.cancelledOrders, 1)
  assert.equal(model.quality.removedDuplicateLines, 1)
  assert.equal(model.quality.returnsUSD, 100)
  assert.equal(model.quality.deliveredUSD, 1000)
  assert.equal(model.quality.returnRate, 0.1)
  assert.equal(model.totals.roundingUSD, null)
  assert.ok(
    model.bridge
      .find((row) => row.id === 'Missing_GL')
      .sourceRows.every(
        (row) => row.fileName === 'Không xác định file từ bảng tổng hợp',
      ),
  )
  const shifted = model.detail.stores.find((row) => row.storeKey === 'S01')
  assert.equal(shifted.normalizedDeltaUSD, 0)
  assert.equal(shifted.magnitudeUSD, 2000)
  assert.equal(shifted.months.length, 2)
  assert.equal(model.detail.afterThresholdStores, 1)
  assert.equal(
    model.detail.stores.find((row) => row.storeKey === 'S02').status,
    'Còn chênh lệch',
  )
  assert.equal(
    model.detail.stores.find((row) => row.storeKey === 'S03').ratio,
    null,
  )
  assert.equal(
    model.detail.stores.find((row) => row.storeKey === 'S10')
      .normalizedDeltaUSD,
    0,
  )
  assert.equal(model.detail.onlineDeltaUSD, 0)
  assert.ok(model.detail.onlineTrend.every((row) => row.month.length === 10))
  const january = buildDashboardModel({
    source: 'raw',
    result,
    filters: {
      ...defaultDashboardFilters(['2025-01', '2025-02']),
      endMonth: '2025-01',
    },
  })
  assert.equal(
    january.detail.stores.find((row) => row.storeKey === 'S01')
      .normalizedDeltaUSD,
    1000,
  )
  assert.equal(january.quality.returnsUSD, 0)
  const online = buildDashboardModel({
    source: 'raw',
    result,
    filters: {
      ...defaultDashboardFilters(['2025-01', '2025-02']),
      channel: 'WEB',
    },
  })
  assert.equal(online.totals.flashUSD, null)
  assert.equal(online.totals.deltaUSD, null)
  assert.equal(online.totals.glUSD, 900)
  assert.equal(online.quality.removedDuplicateLines, null)
  assert.equal(online.detail.cellCount, null)
  const missingFlash = {
    ...result,
    dashboard: {
      ...result.dashboard,
      months: result.dashboard.months.map((row) =>
        row.month === '2025-02' ? { ...row, flashUSD: null } : row,
      ),
    },
  }
  const unavailable = buildDashboardModel({
    source: 'raw',
    result: missingFlash,
    filters: defaultDashboardFilters(['2025-01', '2025-02']),
  })
  assert.equal(unavailable.totals.flashUSD, null)
  assert.equal(unavailable.totals.deltaUSD, null)
  assert.equal(unavailable.bridge.length, 0)
})
