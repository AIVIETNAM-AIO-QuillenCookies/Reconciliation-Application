import assert from 'node:assert/strict'
import { before, test } from 'node:test'
import { createRequire } from 'node:module'
import {
  createDuckDB,
  NODE_RUNTIME,
  VoidLogger,
} from '@duckdb/duckdb-wasm/blocking'
import * as XLSX from 'xlsx'
import { ReconciliationEngine } from '../src/lib/ReconciliationEngine.ts'

let bindings
before(async () => {
  const require = createRequire(import.meta.url)
  bindings = await createDuckDB(
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
})

function fixture({ pos, gl, flash, sheets, enabledRoles }) {
  const book = XLSX.utils.book_new()
  for (const [name, rows] of Object.entries(sheets))
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), name)
  const files = Object.entries({
    POS: pos,
    WEB: 'web_order_id,store_key,order_date,delivery_date,return_date,order_status,gross_usd_daily,net_usd_month_end,discount_usd_daily',
    GL: gl,
    Flash: `month_end_date,revenue_usd\n2025-03-31,${flash}`,
  }).map(([source, csv]) => ({
    id: source,
    source,
    file: new File([csv], `${source}.csv`),
  }))
  files.push({
    id: 'master',
    source: 'Dim',
    file: new File(
      [XLSX.write(book, { type: 'array', bookType: 'xlsx' })],
      'Master.xlsx',
    ),
  })
  const roles = Object.fromEntries(
    ['store', 'calendar', 'fxDaily', 'fxMonthEnd'].map((role) => [
      role,
      { usage: 'not-used', sheetName: '', columns: {}, relationships: [] },
    ]),
  )
  Object.assign(roles, enabledRoles)
  return {
    files,
    masterConfiguration: {
      revision: 1,
      fileId: 'master',
      sheets: Object.fromEntries(
        Object.keys(sheets).map((name) => [name, { headerRow: 1 }]),
      ),
      roles,
    },
  }
}

async function runFixture(data) {
  const engine = new ReconciliationEngine(
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
    { onWarning() {} },
  )
  return engine.run(
    data.files,
    { start: '2025-03-01', end: '2025-03-31' },
    undefined,
    { masterConfiguration: data.masterConfiguration },
  )
}
const factRows = (result) =>
  result.evidence.tables.find((table) => table.id === 'fact_POS_final').rows

test('Calendar-resolved POS business date supplies posting fallback and both configured FX keys', async () => {
  const data = fixture({
    pos: 'receipt_no,line_no,store_key,business_date,line_amount,discount_amount,currency,exported_at\nR,1,S,DAY-A,65.37,7.85,AUD,2025-03-01 08:00:00',
    gl: 'journal_id,posting_date,store_key,journal_type,amount_usd\nJ,2025-03-01,S,POS,-28.76',
    flash: 43.58,
    sheets: {
      Calendar: [
        ['source_day', 'actual_day'],
        ['DAY-A', '2025-03-01'],
      ],
      Daily: [
        ['day', 'ccy', 'rate'],
        ['2025-03-01', 'AUD', 1.5],
      ],
      Monthly: [
        ['month', 'ccy', 'rate'],
        ['2025-03', 'AUD', 2],
      ],
    },
    enabledRoles: {
      calendar: {
        usage: 'enabled',
        sheetName: 'Calendar',
        columns: { date_key: 'source_day', date: 'actual_day' },
        relationships: [
          {
            id: 'resolve-day',
            source: 'POS',
            keys: [
              { sourceField: 'date', referenceField: 'date_key', type: 'text' },
            ],
            outputs: ['date'],
            purpose: 'calendar-date',
            dateTarget: 'date',
            unmatched: 'error',
          },
        ],
      },
      fxDaily: {
        usage: 'enabled',
        sheetName: 'Daily',
        columns: { date: 'day', currency: 'ccy', rate: 'rate' },
        relationships: [
          {
            id: 'daily-rate',
            source: 'POS',
            keys: [
              { sourceField: 'date', referenceField: 'date', type: 'date' },
              {
                sourceField: 'currency',
                referenceField: 'currency',
                type: 'text',
              },
            ],
            outputs: ['rate'],
            purpose: 'enrich',
            unmatched: 'error',
          },
        ],
      },
      fxMonthEnd: {
        usage: 'enabled',
        sheetName: 'Monthly',
        columns: { period: 'month', currency: 'ccy', rate: 'rate' },
        relationships: [
          {
            id: 'monthly-rate',
            source: 'POS',
            keys: [
              {
                sourceField: 'recognition_period',
                referenceField: 'period',
                type: 'period',
              },
              {
                sourceField: 'currency',
                referenceField: 'currency',
                type: 'text',
              },
            ],
            outputs: ['rate'],
            purpose: 'enrich',
            unmatched: 'error',
          },
        ],
      },
    },
  })
  const result = await runFixture(data)
  const [row] = factRows(result)
  assert.equal(row.raw_business_date, 'DAY-A')
  assert.equal(row.business_date, '2025-03-01')
  assert.equal(row.posting_date, '2025-03-01')
  assert.equal(row.fx_daily_status, 'matched')
  assert.equal(row.fx_month_end_status, 'matched')
  assert.equal(row.net_usd_daily, '38.35')
  assert.equal(row.net_usd_month_end, '28.76')
  assert.equal(result.evidence.posDiagnostics.uniqueInvalidRows, 0)
  assert.ok(
    result.evidence.masterJoins.every((join) => join.errors.length === 0),
  )
})

function postingFixture(mappedPosting) {
  return fixture({
    pos: mappedPosting
      ? 'receipt_no,line_no,store_key,business_date,posting_date,gross_usd,discount_usd_daily\nR,1,S,2025-03-02,2025-03-04,10,0'
      : 'receipt_no,line_no,store_key,business_date,gross_usd,discount_usd_daily\nR-match,1,S,2025-03-01,10,0\nR-keep,1,S,2025-03-02,20,0',
    gl: mappedPosting
      ? 'journal_id,posting_date,store_key,journal_type,amount_usd\nJ,2025-03-04,S,POS,-10'
      : 'journal_id,posting_date,store_key,journal_type,amount_usd\nJ1,2025-03-03,S,POS,-10\nJ2,2025-03-02,S,POS,-20',
    flash: mappedPosting ? 10 : 30,
    sheets: {
      Calendar: [
        ['day', 'posting'],
        ['2025-03-01', '2025-03-03'],
      ],
    },
    enabledRoles: {
      calendar: {
        usage: 'enabled',
        sheetName: 'Calendar',
        columns: { date: 'day', posting_date: 'posting' },
        relationships: [
          {
            id: 'posting',
            source: 'POS',
            keys: [
              { sourceField: 'date', referenceField: 'date', type: 'date' },
            ],
            outputs: ['posting_date'],
            purpose: 'calendar-posting',
            unmatched: 'keep',
          },
        ],
      },
    },
  })
}

test('Calendar posting unmatched keep reports actual business-date fallback instead of Calendar provenance', async () => {
  const result = await runFixture(postingFixture(false))
  const rows = factRows(result)
  const matched = rows.find((row) => row.receipt_no === 'R-match')
  const kept = rows.find((row) => row.receipt_no === 'R-keep')
  assert.equal(matched.posting_date, '2025-03-03')
  assert.equal(matched.posting_date_source, 'configured-calendar')
  assert.equal(kept.posting_date, '2025-03-02')
  assert.equal(kept.posting_date_source, 'business-date-fallback')
  assert.equal(result.missingGLEntries, 0)
})

test('Calendar posting unmatched keep preserves mapped posting date and its actual provenance', async () => {
  const result = await runFixture(postingFixture(true))
  const [row] = factRows(result)
  assert.equal(row.posting_date, '2025-03-04')
  assert.equal(row.posting_date_source, 'mapped-posting-date')
  assert.equal(result.missingGLEntries, 0)
})
