import assert from 'node:assert/strict'
import { before, test } from 'node:test'
import { createRequire } from 'node:module'
import {
  createDuckDB,
  NODE_RUNTIME,
  VoidLogger,
} from '@duckdb/duckdb-wasm/blocking'
import {
  accountingProjection,
  ACCOUNTING_POS_SQL,
  POS_ROW_ISSUES,
} from '../src/lib/reconciliation-accounting.ts'
import { buildMasterJoins } from '../src/lib/master-joins.ts'
import { ReconciliationEngine } from '../src/lib/ReconciliationEngine.ts'
import * as XLSX from 'xlsx'

let bindings
let serial = 0
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

async function withPOS(csv, overrides, check) {
  const path = `pos_pipeline_${serial++}.csv`
  bindings.registerFileText(path, csv)
  const c = bindings.connect()
  try {
    const headers = c
      .query(
        `SELECT * FROM read_csv_auto('${path}', header=true, all_varchar=true) LIMIT 0`,
      )
      .schema.fields.map((f) => f.name)
    const adapter = accountingProjection('POS', headers, undefined, overrides)
    c.query(
      `CREATE TEMP TABLE raw_pos AS SELECT ${adapter.projection}, 0 AS __reconcile_file_order, ROW_NUMBER() OVER () AS __reconcile_row_order FROM read_csv_auto('${path}', header=true, all_varchar=true) AS input`,
    )
    for (const sql of ACCOUNTING_POS_SQL) c.query(sql)
    await check(c)
  } finally {
    c.close()
    bindings.dropFile(path)
  }
}
const rows = (c, sql) =>
  c
    .query(sql)
    .toArray()
    .map((row) => Object.fromEntries(Object.entries(row)))
const issueCount = (c, code) =>
  Number(
    rows(
      c,
      `SELECT COUNT(*) AS n FROM pos_clean WHERE ${POS_ROW_ISSUES.find((issue) => issue.code === code).where}`,
    )[0].n,
  )

test('POS classification keeps earliest exports and all receipt lines with stable tie breakers', async () => {
  await withPOS(
    'receipt_no,line_no,store_key,business_date,exported_at,export_seq,gross_usd,discount_usd_daily\nR,01,S,2025-03-01,2025-03-03 08:00:00,1,110,10\nR,01,S,2025-03-01,2025-03-02 08:00:00,99,100,10\nR,01,S,2025-03-01,2025-03-02 08:00:00,2,90,10\nR,02,S,2025-03-01,2025-03-02 08:00:00,1,50,0',
    {},
    (c) => {
      assert.deepEqual(
        rows(
          c,
          'SELECT receipt_no, line_no, CAST(net_usd_month_end AS VARCHAR) AS net FROM fact_POS_final ORDER BY line_no',
        ),
        [
          { receipt_no: 'R', line_no: '01', net: '80.00' },
          { receipt_no: 'R', line_no: '02', net: '50.00' },
        ],
      )
      assert.equal(
        Number(rows(c, 'SELECT COUNT(*) AS n FROM q_POS_Dup_Keys')[0].n),
        1,
      )
      assert.equal(
        Number(
          rows(c, 'SELECT SUM(export_rows) AS n FROM q_POS_Dup_Keys')[0].n,
        ),
        3,
      )
      assert.equal(
        Number(rows(c, 'SELECT COUNT(*) AS n FROM q_POS_Dup_Rows')[0].n),
        2,
      )
      assert.equal(
        Number(
          rows(c, 'SELECT content_variants AS n FROM q_POS_Dup_Keys')[0].n,
        ),
        3,
      )
      assert.equal(
        Number(rows(c, 'SELECT COUNT(*) AS n FROM q_POS_Cleaning')[0].n),
        Number(rows(c, 'SELECT COUNT(*) AS n FROM fact_POS_final')[0].n),
      )
    },
  )
})

test('export offsets compare actual UTC instants while financial dates retain their declared calendar day', async () => {
  await withPOS(
    'receipt_no,line_no,store_key,business_date,exported_at,gross_usd\nR,1,S,2025-03-01T00:30:00+02:00,2025-03-01T08:30:00Z,200\nR,1,S,2025-03-01T00:30:00+02:00,2025-03-01T09:00:00+01:00,100',
    {},
    (c) => {
      assert.deepEqual(
        rows(
          c,
          'SELECT CAST(net_usd_month_end AS VARCHAR) AS net, CAST(exported_at AS VARCHAR) AS exported, CAST(business_date AS VARCHAR) AS business FROM fact_POS_final',
        ),
        [
          {
            net: '100.00',
            exported: '2025-03-01 08:00:00',
            business: '2025-03-01',
          },
        ],
      )
    },
  )
})

test('local POS converts each USD basis once and keeps duplicate impact outside fact', async () => {
  const csv =
    'receipt_no,line_no,store_key,business_date,exported_at,line_amount,discount_amount,currency\nR,1,S,2025-03-01,2025-03-01 08:00:00,65.37,7.85,AUD\nR,1,S,2025-03-01,2025-03-02 08:00:00,65.37,7.85,AUD'
  await withPOS(
    csv,
    {
      fx_rate_daily: '1.5',
      fx_rate_month_end: '2',
      fx_daily_status: "'matched'",
      fx_month_end_status: "'matched'",
    },
    (c) => {
      const row = rows(
        c,
        'SELECT CAST(net_local AS VARCHAR) AS local, CAST(gross_usd_daily AS VARCHAR) AS gross, CAST(discount_usd_daily AS VARCHAR) AS discount, CAST(net_usd_daily AS VARCHAR) AS daily, CAST(net_usd_month_end AS VARCHAR) AS finance FROM fact_POS_final',
      )[0]
      assert.deepEqual(row, {
        local: '57.52',
        gross: '43.58',
        discount: '5.23',
        daily: '38.35',
        finance: '28.76',
      })
      assert.equal(
        rows(
          c,
          'SELECT CAST(bridge_adjustment_usd AS VARCHAR) AS amount FROM q_POS_Dup_Impact',
        )[0].amount,
        '-38.35',
      )
      assert.equal(
        Number(rows(c, 'SELECT COUNT(*) AS n FROM fact_POS_final')[0].n),
        1,
      )
      assert.equal(issueCount(c, 'POS_USD_NET_INVALID'), 0)
      assert.equal(
        Number(
          rows(c, 'SELECT content_variants AS n FROM q_POS_Dup_Keys')[0].n,
        ),
        1,
      )
    },
  )
})

test('duplicate audit retains extra source fields and warns for changed products with equal amounts', async () => {
  await withPOS(
    'receipt_no,line_no,store_key,business_date,exported_at,gross_usd,product_id,qty\nR,1,S,2025-03-01,2025-03-01 08:00:00,10,P1,1\nR,1,S,2025-03-01,2025-03-02 08:00:00,10,P1,1\nR,1,S,2025-03-01,2025-03-03 08:00:00,10,P2,1',
    {},
    (c) => {
      assert.equal(
        Number(
          rows(c, 'SELECT content_variants AS n FROM q_POS_Dup_Keys')[0].n,
        ),
        2,
      )
      const discarded = rows(
        c,
        'SELECT source_values,discard_reason FROM q_POS_Dup_Rows ORDER BY exported_at',
      )
      assert.equal(discarded.length, 2)
      assert.match(discarded[1].source_values, /product_id.*P2/)
      assert.match(discarded[1].source_values, /qty.*1/)
      assert.equal(discarded[1].discard_reason, 'discarded-later-export')
      assert.equal(
        Number(rows(c, 'SELECT COUNT(*) AS n FROM fact_POS_final')[0].n),
        1,
      )
    },
  )
})

test('supplied USD net including zero remains authoritative and invalid mapped cells fail', async () => {
  const header =
    'receipt_no,line_no,store_key,business_date,line_amount,currency,discount_usd_daily,net_usd_month_end\n'
  await withPOS(header + 'R,1,S,2025-03-01,100,GBP,110,0', {}, (c) => {
    assert.equal(
      rows(
        c,
        'SELECT CAST(net_usd_month_end AS VARCHAR) AS n FROM fact_POS_final',
      )[0].n,
      '0.00',
    )
    assert.equal(issueCount(c, 'POS_USD_NET_INVALID'), 0)
  })
  await withPOS(header + 'R,1,S,2025-03-01,100,USD,10,oops', {}, (c) =>
    assert.equal(issueCount(c, 'POS_USD_NET_INVALID'), 1),
  )
})

test('missing FX, missing currency, bad dates and bad money retain separate causes', async () => {
  await withPOS(
    'receipt_no,line_no,store_key,business_date,exported_at,line_amount,discount_amount,currency\nR,1,S,bad,invalid,65.37,7.85,AUD\nR,2,S,2025-03-01,2025-03-01,10,0,\nR,3,S,2025-03-01,2025-03-01,oops,0,USD',
    {},
    (c) => {
      assert.equal(issueCount(c, 'POS_FX_DAILY_MISSING'), 1)
      assert.equal(issueCount(c, 'POS_CURRENCY_MISSING'), 1)
      assert.equal(issueCount(c, 'POS_BUSINESS_DATE_INVALID'), 1)
      assert.equal(issueCount(c, 'POS_EXPORT_TIMESTAMP_INVALID'), 1)
      assert.equal(issueCount(c, 'POS_LOCAL_AMOUNT_INVALID'), 1)
      assert.equal(issueCount(c, 'POS_USD_NET_INVALID'), 3)
    },
  )
})

test('unambiguous decimal-comma local amounts preserve cents', async () => {
  await withPOS(
    'receipt_no;line_no;store_key;business_date;line_amount;discount_amount;currency\nR;1;S;2025-03-01;65,37;7,85;USD',
    {},
    (c) => {
      assert.equal(
        rows(
          c,
          'SELECT CAST(net_usd_month_end AS VARCHAR) AS n FROM fact_POS_final',
        )[0].n,
        '57.52',
      )
    },
  )
})

test('native currency aliases use the same local-to-USD conversion as confirmed currency mappings', async () => {
  await withPOS(
    'receipt_no,line_no,store_key,business_date,line_amount,discount_amount,currency_code\nR,1,S,2025-03-01,10,1,AUD',
    { fx_rate_daily: '1.5', fx_daily_status: "'matched'" },
    (c) => {
      assert.deepEqual(
        rows(
          c,
          'SELECT currency,CAST(net_usd_month_end AS VARCHAR) AS net FROM fact_POS_final',
        ),
        [{ currency: 'AUD', net: '6.00' }],
      )
    },
  )
})

test('confirmed FX lookup never multiplies POS even for duplicate, missing and invalid rates', async () => {
  const path = `pos_fx_${serial++}.csv`
  bindings.registerFileText(
    path,
    'receipt_no,line_no,store_key,business_date,line_amount,discount_amount,currency\nR,1,S,2025-03-01,10,0,AUD\nR,2,S,2025-03-01,10,0,EUR\nR,3,S,2025-03-01,10,0,CAD',
  )
  const c = bindings.connect()
  try {
    c.query('CREATE SCHEMA IF NOT EXISTS dim')
    c.query(
      "CREATE TABLE dim.pos_pipeline_fx AS SELECT * FROM (VALUES ('2025-03-01','AUD','1.5'),('2025-03-01','AUD','1.6'),('2025-03-01','CAD','0')) AS t(day,ccy,usd_to_ccy)",
    )
    const roles = Object.fromEntries(
      ['store', 'calendar', 'fxDaily', 'fxMonthEnd'].map((role) => [
        role,
        { usage: 'not-used', sheetName: '', columns: {}, relationships: [] },
      ]),
    )
    roles.fxDaily = {
      usage: 'enabled',
      sheetName: 'pos_pipeline_fx',
      columns: { date: 'day', currency: 'ccy', rate: 'usd_to_ccy' },
      relationships: [
        {
          id: 'daily',
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
    }
    const config = {
      revision: 1,
      fileId: 'master',
      sheets: { pos_pipeline_fx: { headerRow: 1 } },
      roles,
    }
    const projection = accountingProjection('POS', [
      'receipt_no',
      'line_no',
      'store_key',
      'business_date',
      'line_amount',
      'discount_amount',
      'currency',
    ])
    const joins = await buildMasterJoins(
      { query: async (sql) => c.query(sql) },
      {
        config,
        source: 'POS',
        fileId: 'pos',
        path,
        columns: projection.resolvedColumns,
      },
    )
    assert.equal(joins.safeForProjection, true)
    assert.equal(joins.reports[0].duplicateKeys, 1)
    assert.equal(joins.reports[0].rowsAfter, 3)
    const adapter = accountingProjection(
      'POS',
      [
        'receipt_no',
        'line_no',
        'store_key',
        'business_date',
        'line_amount',
        'discount_amount',
        'currency',
      ],
      undefined,
      joins.overrides,
    )
    c.query(
      `CREATE TEMP TABLE raw_pos AS SELECT ${adapter.projection}, 0 AS __reconcile_file_order, ${joins.ordinal} AS __reconcile_row_order FROM ${joins.from}`,
    )
    for (const sql of ACCOUNTING_POS_SQL) c.query(sql)
    assert.deepEqual(
      rows(
        c,
        'SELECT currency,fx_daily_status FROM pos_clean ORDER BY currency',
      ),
      [
        { currency: 'AUD', fx_daily_status: 'duplicate' },
        { currency: 'CAD', fx_daily_status: 'invalid' },
        { currency: 'EUR', fx_daily_status: 'missing' },
      ],
    )
    assert.equal(
      Number(rows(c, 'SELECT COUNT(*) AS n FROM fact_POS_final')[0].n),
      3,
    )
  } finally {
    c.query('DROP TABLE IF EXISTS dim.pos_pipeline_fx')
    c.close()
    bindings.dropFile(path)
  }
})

function localEngineFixture(missingRates = false) {
  const book = XLSX.utils.book_new()
  for (const [name, data] of Object.entries({
    Daily: [
      ['day', 'currency', 'usd_to_ccy'],
      ['2025-03-01', missingRates ? 'EUR' : 'AUD', 1.5],
    ],
    Monthly: [
      ['period', 'currency', 'usd_to_ccy'],
      ['2025-03', missingRates ? 'EUR' : 'AUD', 2],
    ],
  }))
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(data), name)
  const files = Object.entries({
    POS: 'receipt_no,line_no,store_key,business_date,exported_at,line_amount,discount_amount,currency\nR,1,S,2025-03-01,2025-03-01 08:00:00,65.37,7.85,AUD\nR,1,S,2025-03-01,2025-03-02 08:00:00,65.37,7.85,AUD',
    WEB: 'web_order_id,store_key,order_date,delivery_date,return_date,order_status,gross_usd_daily,net_usd_month_end,discount_usd_daily',
    GL: 'journal_id,posting_date,store_key,journal_type,amount_usd\nJ,2025-03-01,S,POS,-28.76',
    Flash: 'month_end_date,revenue_usd\n2025-03-31,87.16',
  }).map(([source, csv]) => ({
    id: source,
    source,
    file: new File([csv], source + '.csv'),
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
  for (const [role, sheetName, temporal, sourceField, type] of [
    ['fxDaily', 'Daily', 'date', 'date', 'date'],
    ['fxMonthEnd', 'Monthly', 'period', 'recognition_period', 'period'],
  ])
    roles[role] = {
      usage: 'enabled',
      sheetName,
      columns: {
        [temporal]: temporal === 'date' ? 'day' : 'period',
        currency: 'currency',
        rate: 'usd_to_ccy',
      },
      relationships: [
        {
          id: role,
          source: 'POS',
          keys: [
            { sourceField, referenceField: temporal, type },
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
    }
  return {
    files,
    masterConfiguration: {
      revision: 1,
      fileId: 'master',
      sheets: { Daily: { headerRow: 1 }, Monthly: { headerRow: 1 } },
      roles,
    },
  }
}
function integrationEngine() {
  return new ReconciliationEngine(
    {
      registerFileText: async (p, t) => bindings.registerFileText(p, t),
      registerFileBuffer: async (p, b) => bindings.registerFileBuffer(p, b),
      dropFile: async (p) => bindings.dropFile(p),
      connect: async () => {
        const c = bindings.connect()
        return {
          query: async (sql) => c.query(sql),
          close: async () => c.close(),
        }
      },
    },
    undefined,
    undefined,
    { onWarning() {} },
  )
}
test('full engine converts confirmed workbook FX, preserves keeper fact and audit bridge without double discounts', async () => {
  const fixture = localEngineFixture()
  const phases = []
  const result = await integrationEngine().processUploads(
    fixture.files,
    { start: '2025-03-01', end: '2025-03-31' },
    {
      masterConfiguration: fixture.masterConfiguration,
      onPhaseChange: (phase) => phases.push(phase),
    },
  )
  assert.equal(result.GL_Finance, 28.76)
  assert.equal(result.Discounts, -10.46)
  assert.equal(result.duplicatePOSAdjustment, -38.35)
  assert.equal(
    result.Unexplained,
    -9.59,
    'independent daily and month-end FX bases leave their real residual',
  )
  assert.equal(result.missingGLEntries, 0)
  assert.equal(
    result.exceptions.find((e) => e.type === 'Duplicate POS').deltaCents,
    3835,
  )
  assert.deepEqual(result.evidence.posDiagnostics.branchCounts, {
    raw_pos: 2,
    pos_staging: 2,
    pos_ranked: 2,
    q_POS_First_Export: 1,
    q_POS_Cleaning: 1,
    q_POS_Mapped: 1,
    q_POS_USD: 1,
    q_POS_Dup_Keys: 1,
    q_POS_Dup_Rows: 1,
    q_POS_Dup_Impact: 1,
    fact_POS_final: 1,
  })
  for (const phase of [
    'classifying',
    'cleaning',
    'mapping',
    'converting',
    'validating',
  ])
    assert.ok(phases.includes(phase))
  const fact = result.evidence.tables.find((t) => t.id === 'fact_POS_final')
  assert.equal(fact.rowCount, 1)
  assert.equal(fact.rows[0].net_usd_month_end, '28.76')
  assert.equal(fact.rows[0].net_usd_basis, 'month-end')
  const fxApplication = result.evidence.ruleApplications.find(
    (rule) => rule.id === 'report-fx',
  )
  assert.equal(fxApplication.status, 'applied')
  assert.equal(fxApplication.affectedRows, 1)
  const event = result.evidence.tables.find(
    (table) => table.id === 'expected_events',
  ).rows[0]
  assert.equal(event.fx_basis, 'month-end')
  assert.match(event.applied_rule_ids, /report-fx/)
})
test('full engine reports actual overlapping FX failures by unique rows, currency and original sample records', async () => {
  const fixture = localEngineFixture(true)
  await assert.rejects(
    integrationEngine().processUploads(
      fixture.files,
      { start: '2025-03-01', end: '2025-03-31' },
      { masterConfiguration: fixture.masterConfiguration },
    ),
    (error) => {
      assert.equal(error.name, 'PosValidationError')
      const d = error.diagnostics
      assert.equal(d.uniqueInvalidRows, 2)
      assert.equal(d.invalidKeyGroups, 1)
      assert.deepEqual(d.currencyCounts, { AUD: 2 })
      assert.equal(d.validLocalMissingUsdRows, 2)
      const missing = d.reasons.find((r) => r.code === 'POS_FX_DAILY_MISSING')
      assert.equal(missing.rowCount, 2)
      assert.equal(missing.samples[0].sourceFile, 'POS.csv')
      assert.equal(missing.samples[0].sourceRecord, 1)
      assert.equal(missing.samples[0].raw.line_amount, '65.37')
      assert.equal(missing.samples[0].normalized.net_local, '57.52')
      assert.equal(
        missing.samples[0].normalized.fx_daily_key,
        'date=2025-03-01 | currency=AUD',
      )
      assert.equal(
        missing.samples[0].normalized.fx_month_end_key,
        'recognition_period=2025-03 | currency=AUD',
      )
      assert.ok(
        d.reasons.reduce((sum, r) => sum + r.rowCount, 0) > d.uniqueInvalidRows,
      )
      assert.equal(d.branchCounts.fact_POS_final, undefined)
      return true
    },
  )
})
