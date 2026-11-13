import assert from 'node:assert/strict'
import { before, test } from 'node:test'
import { createRequire } from 'node:module'
import {
  createDuckDB,
  NODE_RUNTIME,
  VoidLogger,
} from '@duckdb/duckdb-wasm/blocking'
import {
  ReconciliationEngine,
  validatePeriod,
} from '../src/lib/ReconciliationEngine.ts'
import { createAppStore } from '../src/lib/store.ts'

const period = { start: '2025-01-01', end: '2025-12-31' }
const csv = {
  POS: 'receipt_no,line_no,store_key,business_date,posting_date,gross_usd_daily,discount_usd_daily,net_usd_month_end,exported_at\nR1,01,S01,2025-09-01,2025-09-01,100.00,0.00,100.00,2025-09-01 12:00:00',
  WEB: 'web_order_id,store_key,order_date,delivery_date,return_date,order_status,gross_usd_daily,discount_usd_daily,net_usd_month_end\nW1,S01,2025-09-01,2025-09-02,,Delivered,10.00,0.00,10.00',
  GL: 'journal_id,posting_date,store_key,journal_type,amount_usd\nG1,2025-09-01,S01,SALE,-100.00',
  Flash: 'month_end_date,revenue_usd\n2025-12-31,110.00',
}
const files = (overrides = {}) =>
  Object.entries({ ...csv, ...overrides }).map(([source, text]) => ({
    id: source,
    source,
    file: new File([text], `${source}.csv`, { type: 'text/csv' }),
  }))
let engine
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
})

test('FY2025 is a valid complete-month configuration; actual period failure has its own code', async () => {
  assert.doesNotThrow(() => validatePeriod(period))
  let failure
  await assert.rejects(
    engine.processUploads(
      files(),
      { start: '2025-01-02', end: period.end },
      {
        onFailure: (value) => {
          failure = value
        },
      },
    ),
    /complete calendar months/,
  )
  assert.equal(failure.stage, 'period')
  assert.equal(failure.source, null)
  assert.equal(failure.reasons[0].code, 'REPORTING_PERIOD_INCOMPLETE_MONTH')
})

test('WEB status failure identifies source, stage, fields and original record; GL remains valid in the same run', async () => {
  let failure, snapshot
  await assert.rejects(
    engine.processUploads(
      files({ WEB: csv.WEB.replace(',Delivered,', ',Pending,') }),
      period,
      {
        onFailure: (value) => {
          failure = value
        },
        onGLSnapshot: (value) => {
          snapshot = value
        },
      },
    ),
    /WEB has invalid/,
  )
  assert.equal(failure.source, 'WEB')
  assert.equal(failure.stage, 'validating')
  assert.deepEqual(
    failure.reasons.map((r) => r.code),
    ['WEB_STATUS_INVALID'],
  )
  assert.deepEqual(failure.reasons[0].fields, ['order_status'])
  assert.equal(failure.samples[0].fileName, 'WEB.csv')
  assert.equal(failure.samples[0].values.order_status, 'Pending')
  assert.equal(failure.samples[0].sourceRecord, 1)
  assert.equal(snapshot.complete, true)
  assert.equal(snapshot.runId, failure.runId)
})

test('Flash negative revenue is an amount failure, and a source date failure remains distinct', async () => {
  let failure
  await assert.rejects(
    engine.processUploads(
      files({ Flash: csv.Flash.replace('110.00', '-1.00') }),
      period,
      {
        onFailure: (value) => {
          failure = value
        },
      },
    ),
    /Flash requires/,
  )
  assert.equal(failure.source, 'Flash')
  assert.deepEqual(
    failure.reasons.map((r) => r.code),
    ['FLASH_REVENUE_INVALID'],
  )
  assert.deepEqual(failure.reasons[0].fields, ['revenue_usd'])
  assert.equal(failure.samples[0].values.revenue_usd, '-1.00')
  await assert.rejects(
    engine.processUploads(
      files({ Flash: csv.Flash.replace('2025-12-31', '2025-12-30') }),
      period,
      {
        onFailure: (value) => {
          failure = value
        },
      },
    ),
    /Flash requires/,
  )
  assert.deepEqual(
    failure.reasons.map((r) => r.code),
    ['FLASH_MONTH_END_INVALID'],
  )
})

test('failure provenance belongs to one generation and is cleared by edits and retry', async () => {
  const store = createAppStore(period)
  const callbacks = []
  const jobs = []
  store.attachProcessor((_, __, options) => {
    callbacks.push(options)
    return new Promise((resolve, reject) => jobs.push({ resolve, reject }))
  })
  store.actions.setFiles(files())
  await Promise.resolve()
  const old = store.whenSettled()
  const failure = {
    runId: 'failed-run',
    source: 'WEB',
    stage: 'validating',
    originalMessage: 'bad status',
    reasons: [
      {
        code: 'WEB_STATUS_INVALID',
        fields: ['order_status'],
        message: 'Bad status',
      },
    ],
    samples: [],
  }
  callbacks[0].onFailure(failure)
  jobs[0].reject(new Error('bad status'))
  await old
  assert.equal(store.getState().status, 'error')
  assert.equal(store.getState().runFailure.runId, 'failed-run')
  assert.deepEqual(store.getState().runFailure.period, period)
  assert.match(store.getState().runFailure.configurationId, /^configuration-/)
  store.actions.setPeriod({ start: '2025-09-01', end: '2025-09-30' })
  assert.equal(store.getState().error, null)
  assert.equal(store.getState().runFailure, null)
  callbacks[0].onFailure(failure)
  assert.equal(store.getState().runFailure, null)
  await Promise.resolve()
  jobs[1].resolve({ exceptions: [] })
  await store.whenSettled()
  assert.equal(store.getState().status, 'ready')
  assert.equal(store.getState().runFailure, null)
  store.dispose()
})
