import assert from 'node:assert/strict'
import { before, test } from 'node:test'
import { createRequire } from 'node:module'
import {
  createDuckDB,
  NODE_RUNTIME,
  VoidLogger,
} from '@duckdb/duckdb-wasm/blocking'
import { ReconciliationEngine } from '../src/lib/ReconciliationEngine.ts'
import { createAppStore } from '../src/lib/store.ts'
import { autoMapColumns } from '../src/lib/data-mapping.ts'
import { parseMappingPreview } from '../src/lib/mapping-preview.ts'

const period = { start: '2026-11-01', end: '2026-11-30' }
const sourceCSV = {
  POS: 'receipt_no,line_no,store_key,business_date,posting_date,gross_usd_daily,discount_usd_daily,net_usd_month_end,exported_at,memo\nR1,01,S01,2026-11-02,2026-11-03,100.00,2.75,97.25,2026-11-03 12:00:00,later\nR1,01,S01,2026-11-02,2026-11-03,100.00,2.75,97.25,2026-11-03 08:00:00,"earlier\nquoted note"\nR2,01,S01,2026-10-31,2026-11-02,1.01,0.00,1.01,2026-11-01 01:00:00,boundary',
  WEB: 'web_order_id,store_key,order_date,delivery_date,return_date,order_status,gross_usd_daily,discount_usd_daily,net_usd_month_end\nW1,S01,2026-11-02,2026-11-03,,Delivered,10.01,0.00,10.01\nW2,S01,2026-10-31,2026-11-01,2026-11-04,Returned,23.45,0.00,23.45\nW3,S01,2026-11-05,,,Cancelled,7.89,0.00,7.89',
  GL: 'journal_id,posting_date,store_key,journal_type,amount_usd\nG1,2026-11-03,S01,SALE,-107.26\nG2,2026-11-02,S01,SALE,-1.01\nG3,2026-11-01,S01,SALE,-23.45\nG4,2026-11-04,S01,RETURN,23.45',
  Flash: 'month_end_date,revenue_usd\n2026-11-30,218.65',
}
const files = (overrides = {}) =>
  Object.entries({ ...sourceCSV, ...overrides }).map(([source, csv]) => ({
    id: source,
    source,
    file: new File([csv], `${source}.csv`, { type: 'text/csv' }),
  }))
let bindings, engine
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
  const database = {
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
  }
  engine = new ReconciliationEngine(database, undefined, undefined, {
    schemaMode: 'accounting',
    onWarning() {},
  })
})
const table = (result, id) =>
  result.evidence.tables.find((entry) => entry.id === id)

test('same-run evidence uses actual keeper and recognition events with exact values and honest source coordinates', async () => {
  const phases = []
  const progress = []
  const result = await engine.processUploads(files(), period, {
    onPhaseChange: (phase) => phases.push(phase),
    onProgress: (event) => progress.push(event),
  })
  assert.deepEqual(result.period, result.evidence.period)
  assert.match(result.evidence.runId, /^[a-z0-9-]+$/i)
  assert.equal(table(result, 'pos_ranked').rowCount, 3)
  assert.equal(table(result, 'vw_pos').rowCount, 2)
  const events = table(result, 'expected_events')
  assert.equal(events.kind, 'logical')
  assert.equal(events.rowCount, 5)
  assert.equal(
    events.rows.filter((row) => row.transaction_id === 'W3').length,
    0,
  )
  assert.deepEqual(
    events.rows
      .filter((row) => row.transaction_id === 'W2')
      .map((row) => [row.event_type, row.revenue_usd])
      .sort(),
    [
      ['WEB delivery', '23.45'],
      ['WEB return', '-23.45'],
    ],
  )
  const keeper = events.rows.find((row) => row.transaction_id === 'R1')
  assert.equal(keeper.revenue_usd, '97.25')
  assert.equal(keeper.source_file, 'POS.csv')
  assert.equal(keeper.source_file_id, 'POS')
  assert.equal(keeper.source_record, '2')
  assert.equal(keeper.source_row, null)
  assert.equal(keeper.fx_basis, 'supplied-usd')
  assert.match(keeper.applied_rule_ids, /pos-dedup/)
  assert.equal(JSON.parse(keeper.input_values).memo, 'earlier\nquoted note')
  assert.equal(
    JSON.parse(keeper.input_values).exported_at,
    '2026-11-03 08:00:00',
  )
  assert.ok(events.rows.some((row) => row.transaction_date === '2026-10-31'))
  const gl = table(result, 'vw_gl').rows.find((row) => row.journal_id === 'G1')
  assert.equal(gl.amount_usd, '-107.26')
  assert.equal(gl.revenue_usd, '107.26')
  assert.ok(result.evidence.validations.length > 0)
  assert.ok(
    result.evidence.validations.every(
      (item) => item.status === 'passed' && item.invalidCount === 0,
    ),
  )
  const threshold = result.evidence.ruleApplications.find(
    (item) => item.id === 'exception-threshold',
  )
  assert.equal(threshold.status, 'not-evaluated')
  assert.equal(
    result.evidence.ruleApplications.find((item) => item.id === 'store-lookup')
      .status,
    'not-applicable',
  )
  assert.equal(
    result.evidence.files.find((file) => file.source === 'POS').netStrategy,
    'supplied',
  )
  assert.deepEqual(phases, [
    'registering',
    'dimensions',
    'projecting',
    'normalizing',
    'classifying',
    'cleaning',
    'mapping',
    'converting',
    'validating',
    'recognition',
    'reconciling',
    'evidence',
  ])
  assert.doesNotThrow(() => JSON.stringify(result.evidence))
  assert.ok(progress.every((event) => event.runId === result.evidence.runId))
  assert.deepEqual(
    progress
      .filter(
        (event) =>
          event.status === 'completed' || event.status === 'not-applicable',
      )
      .map((event) => event.phase),
    phases,
  )
  assert.equal(
    progress.find(
      (event) =>
        event.phase === 'dimensions' && event.status === 'not-applicable',
    ).metrics.length,
    0,
  )
  assert.equal(
    progress
      .find(
        (event) => event.phase === 'cleaning' && event.status === 'completed',
      )
      .metrics.find((metric) => metric.label === 'q_POS_Cleaning').value,
    2,
  )
  assert.deepEqual(
    progress.at(-1).tableIds,
    result.evidence.tables.map((table) => table.id),
  )
  assert.equal(bindings.globFiles('reconcile_*').length, 0)
})

test('bounded evidence retains full counts, records the actual net configuration and never reuses a run ID', async () => {
  const pos =
    'receipt_no,line_no,store_key,business_date,posting_date,gross_usd_daily,discount_usd_daily,net_usd_month_end\n' +
    Array.from(
      { length: 64 },
      (_, i) => `R${i},01,S01,2026-11-02,2026-11-03,1.25,0.24,999.99`,
    ).join('\n')
  const selection = files({ POS: pos })
  const mappings = selection.map((file) => ({
    fileId: file.id,
    fileName: file.file.name,
    source: file.source,
    columns: autoMapColumns(
      parseMappingPreview(
        new TextEncoder().encode(
          file.source === 'POS' ? pos : sourceCSV[file.source],
        ),
        'csv',
      ).headers,
      file.source,
    ),
  }))
  delete mappings.find((mapping) => mapping.source === 'POS').columns.net_amount
  const first = await engine.processUploads(selection, period, {
    columnMappings: mappings,
  })
  const second = await engine.processUploads(selection, period, {
    columnMappings: mappings,
  })
  assert.notEqual(first.evidence.runId, second.evidence.runId)
  assert.equal(first.evidence.previewLimit, 50)
  assert.equal(table(first, 'vw_pos').rowCount, 64)
  assert.equal(table(first, 'vw_pos').rows.length, 50)
  assert.equal(table(first, 'vw_pos').truncated, true)
  assert.equal(table(first, 'vw_pos').rows[0].net_usd_month_end, '1.01')
  assert.equal(table(first, 'expected_events').rowCount, 67)
  const config = first.evidence.files.find((file) => file.source === 'POS')
  assert.equal(config.netStrategy, 'gross-minus-discount')
  assert.equal(config.mappingMode, 'confirmed')
  assert.equal(config.columns.net_amount, undefined)
  assert.match(first.evidence.scope, /50 rows/)
  assert.equal(bindings.globFiles('reconcile_*').length, 0)
})

test('failed validation publishes no successful evidence or evidence phase', async () => {
  const phases = []
  const progress = []
  await assert.rejects(
    () =>
      engine.processUploads(
        files({
          WEB: sourceCSV.WEB.replace('10.01,0.00,10.01', '10.01,0.00,bad'),
        }),
        period,
        {
          onPhaseChange: (phase) => phases.push(phase),
          onProgress: (event) => progress.push(event),
        },
      ),
    /invalid|USD amounts/,
  )
  assert.ok(phases.includes('validating'))
  assert.ok(!phases.includes('evidence'))
  assert.equal(progress.at(-1).phase, 'validating')
  assert.equal(progress.at(-1).status, 'error')
  assert.equal(progress.at(-1).source, 'WEB')
  assert.equal(progress.at(-2).metrics[0].value, 1)
  assert.ok(!progress.some((event) => event.phase === 'recognition'))
  assert.equal(bindings.globFiles('reconcile_*').length, 0)
})

test('POS staging diagnostics count overlapping failures once and retain real source values after cleanup', async () => {
  const progress = []
  const pos =
    'receipt_no,line_no,store_key,business_date,posting_date,gross_usd_daily,discount_usd_daily,net_usd_month_end,exported_at\n' +
    ',,,2026-02-30,not-date,100,5,bad,not-time\n' +
    'R2,01,S01,2026-11-02,2026-11-03,100,5,bad,2026-11-03 01:00:00\n' +
    'R2,01,S01,2026-11-02,2026-11-03,100,5,-1,2026-11-03 02:00:00'
  let diagnostic
  await assert.rejects(
    engine.run(files({ POS: pos }), period, undefined, {
      onProgress(event) {
        progress.push(event)
      },
    }),
    (error) => {
      assert.equal(error.name, 'PosValidationError')
      diagnostic = error.diagnostics
      assert.equal(diagnostic.stage, 'staging')
      assert.equal(diagnostic.uniqueInvalidRows, 1)
      assert.equal(diagnostic.invalidKeyGroups, 1)
      const reason = (code) =>
        diagnostic.reasons.find((item) => item.code === code)
      assert.equal(reason('POS_RECEIPT_INVALID').rowCount, 1)
      assert.equal(reason('POS_LINE_INVALID').rowCount, 1)
      assert.equal(reason('POS_BUSINESS_DATE_INVALID').rowCount, 1)
      assert.equal(reason('POS_EXPORT_TIMESTAMP_INVALID').rowCount, 1)
      assert.equal(reason('POS_USD_NET_INVALID'), undefined)
      assert.ok(
        diagnostic.reasons.reduce((total, item) => total + item.rowCount, 0) >
          diagnostic.uniqueInvalidRows,
      )
      assert.equal(diagnostic.branchCounts.raw_pos, 3)
      assert.equal(diagnostic.branchCounts.pos_staging, 3)
      assert.equal(diagnostic.branchCounts.q_POS_Cleaning, undefined)
      assert.equal(diagnostic.branchCounts.fact_POS_final, undefined)
      const sample = reason('POS_BUSINESS_DATE_INVALID').samples[0]
      assert.equal(sample.sourceFile, 'POS.csv')
      assert.equal(sample.sourceRecord, 1)
      assert.equal(sample.sourceRow, 2)
      assert.equal(sample.raw.business_date, '2026-02-30')
      assert.equal(sample.normalized.business_date, null)
      return true
    },
  )
  assert.equal(progress.at(-1).diagnostics, diagnostic)
  assert.equal(progress.at(-1).status, 'error')
  assert.equal(progress.at(-1).phase, 'normalizing')
  assert.equal(
    progress.some((event) => event.phase === 'classifying'),
    false,
  )
  assert.equal(
    progress.some((event) => event.phase === 'recognition'),
    false,
  )
  assert.equal(bindings.globFiles('reconcile_*').length, 0)
  assert.doesNotThrow(() => JSON.stringify(diagnostic))
})

test('USD diagnostics expose actual missing FX keys, currency concentration and local-net/USD-null rows', async () => {
  const progress = []
  const pos =
    'receipt_no,line_no,store_key,business_date,line_amount,discount_amount,currency,exported_at\n' +
    'R,01,S01,2026-11-02,65.37,7.85,AUD,2026-11-02 01:00:00\n' +
    'R,01,S01,2026-11-02,65.37,7.85,AUD,2026-11-02 02:00:00'
  await assert.rejects(
    engine.run(files({ POS: pos }), period, undefined, {
      onProgress(event) {
        progress.push(event)
      },
    }),
    (error) => {
      const diagnostic = error.diagnostics
      assert.equal(diagnostic.stage, 'usd')
      assert.equal(diagnostic.uniqueInvalidRows, 2)
      assert.equal(diagnostic.invalidKeyGroups, 1)
      assert.deepEqual(diagnostic.currencyCounts, { AUD: 2 })
      assert.equal(diagnostic.validLocalMissingUsdRows, 2)
      assert.equal(diagnostic.branchCounts.q_POS_Cleaning, 1)
      assert.equal(diagnostic.branchCounts.q_POS_USD, 1)
      assert.equal(diagnostic.branchCounts.q_POS_Dup_Rows, 1)
      assert.deepEqual(diagnostic.duplicateGroups, {
        keyGroups: 1,
        rowsInGroups: 2,
        discardedRows: 1,
      })
      assert.equal(diagnostic.branchCounts.fact_POS_final, undefined)
      const fx = diagnostic.reasons.find(
        (reason) => reason.code === 'POS_FX_DAILY_MISSING',
      )
      assert.equal(fx.rowCount, 2)
      assert.equal(fx.keyGroupCount, 1)
      assert.equal(fx.samples[0].raw.line_amount, '65.37')
      assert.equal(fx.samples[0].normalized.net_local, '57.52')
      assert.equal(fx.samples[0].sourceRow, 2)
      return true
    },
  )
  assert.equal(progress.at(-1).phase, 'validating')
  assert.equal(bindings.globFiles('reconcile_*').length, 0)
})

test('store clears evidence with configuration edits and rejects stale phase and result callbacks', async () => {
  const result = await engine.processUploads(files(), period)
  const store = createAppStore(period)
  const jobs = []
  store.attachProcessor(
    (selection, dates, options) =>
      new Promise((resolve) =>
        jobs.push({ selection, dates, options, resolve }),
      ),
  )
  store.actions.setFiles(files())
  await Promise.resolve()
  const initial = jobs[0]
  initial.options.onPhaseChange('validating')
  assert.equal(store.getState().processingPhase, 'validating')
  initial.resolve(result)
  await store.whenSettled()
  assert.equal(
    store.getState().reconciliationData.evidence.runId,
    result.evidence.runId,
  )
  assert.equal(store.getState().processingPhase, null)
  store.actions.setPeriod({ start: '2026-10-01', end: '2026-11-30' })
  assert.equal(store.getState().reconciliationData, null)
  assert.deepEqual(store.getState().exceptionsData, [])
  assert.equal(store.getState().processingPhase, null)
  await Promise.resolve()
  const old = jobs[1]
  old.options.onPhaseChange('normalizing')
  store.actions.setFiles([])
  old.options.onPhaseChange('evidence')
  old.resolve(result)
  await store.whenSettled()
  await Promise.resolve()
  assert.equal(store.getState().reconciliationData, null)
  assert.equal(store.getState().processingPhase, null)
  store.dispose()
})
