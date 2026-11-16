import assert from 'node:assert/strict'
import { before, test } from 'node:test'
import { createRequire } from 'node:module'
import {
  createDuckDB,
  NODE_RUNTIME,
  VoidLogger,
} from '@duckdb/duckdb-wasm/blocking'
import { ReconciliationEngine } from '../src/lib/ReconciliationEngine.ts'
import { buildWaterfall } from '../src/lib/reconciliation-types.ts'
import { SAMPLE_CSV, SAMPLE_PERIOD } from './fixtures/sample-reconciliation.ts'
import { workbookToCSV, workbookToSheets } from '../src/lib/spreadsheet.ts'
import { formatUSD } from '../src/lib/format-money.ts'
import { createAppStore } from '../src/lib/store.ts'
import { zipSync, strToU8, unzipSync, strFromU8 } from 'fflate'
import * as XLSX from 'xlsx'
import { parseMappingPreview } from '../src/lib/mapping-preview.ts'
import { HeaderRowError } from '../src/lib/header-row.ts'
import {
  createMasterDraft,
  REFERENCE_ROLES,
  defaultRelationship,
  masterSnapshot,
} from '../src/lib/master-data.ts'
import { parseDimMappingPreviews } from '../src/lib/mapping-preview.ts'

const require = createRequire(import.meta.url)
let bindings
let engine
let closes = 0
let database
before(async () => {
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
  // Same installed WASM engine and SQL as the browser. Only the transport is adapted.
  database = {
    registerFileText: async (path, text) =>
      bindings.registerFileText(path, text),
    registerFileBuffer: async (path, bytes) =>
      bindings.registerFileBuffer(path, bytes),
    dropFile: async (path) => bindings.dropFile(path),
    connect: async () => {
      const connection = bindings.connect()
      return {
        query: async (sql) => connection.query(sql),
        close: async () => {
          connection.close()
          closes++
        },
      }
    },
  }
  engine = new ReconciliationEngine(database, undefined, undefined, {
    schemaMode: 'compatible',
    onWarning() {},
  })
})

function files(overrides = {}) {
  return Object.entries({ ...SAMPLE_CSV, ...overrides }).map(
    ([source, csv]) => ({
      id: source,
      source,
      file: new File([csv], `${source}.csv`, { type: 'text/csv' }),
    }),
  )
}
function assertClean() {
  assert.equal(bindings.globFiles('reconcile_*').length, 0)
}

test('all seven buckets execute in DuckDB and reconcile the documented sample to cents', async () => {
  const result = await engine.run(files(), SAMPLE_PERIOD)
  for (const [key, expected] of Object.entries({
    Flash_Sales: 4700,
    Discounts: -450,
    Cancellations: -270,
    Timing_Differences: 280,
    Returns: -450,
    Data_Errors: -1350,
    GL_Finance: 2460,
    Unexplained: 0,
    duplicatePOSLines: 1,
    missingGLEntries: 1,
    duplicatePOSAdjustment: -900,
    missingGLAdjustment: -450,
  }))
    assert.equal(result[key], expected, key)
  assert.deepEqual(result.rowCounts, { POS: 5, WEB: 5, GL: 8, Flash: 1 })
  assert.doesNotThrow(() => JSON.stringify(result))
  assertClean()
})

test('unexplained GL amounts are explicit and never folded into Data_Errors', async () => {
  const result = await engine.run(
    files({ GL: SAMPLE_CSV.GL.replace('-900.00', '-890.01') }),
    SAMPLE_PERIOD,
  )
  assert.equal(result.Data_Errors, -1350)
  assert.equal(result.Unexplained, -9.99)
  assert.equal(result.unexplainedCents, -999)
  const steps = buildWaterfall(result)
  assert.equal(steps.at(-2).key, 'Unexplained')
  assert.equal(steps.at(-2).end, result.GL_Finance)
  assertClean()
})

test('a missing refund day is a positive error adjustment, without counting the sale twice', async () => {
  const gl = SAMPLE_CSV.GL.split('\n')
    .filter((line) => !line.startsWith('G8,'))
    .join('\n')
  const result = await engine.run(files({ GL: gl }), SAMPLE_PERIOD)
  assert.equal(result.Returns, -450)
  assert.equal(result.missingGLEntries, 2)
  assert.equal(result.missingGLAdjustment, 0)
  assert.equal(result.GL_Finance, 2910)
  assert.equal(result.Unexplained, 0)
})

test('period boundary recognition separates delivery timing, posting timing, and returns', async () => {
  const result = await engine.run(
    files({ Flash: 'month_end_date,revenue_usd\n2026-12-31,0.00' }),
    { start: '2026-12-01', end: '2026-12-31' },
  )
  assert.equal(result.Flash_Sales, 0)
  assert.equal(result.Timing_Differences, 560)
  assert.equal(result.Returns, 0)
  assert.equal(result.GL_Finance, 560)
  assert.equal(result.Unexplained, 0)
})

test('strict mode rejects conflicting sequence-1 POS copies and cleans resources', async () => {
  const beforeClose = closes
  const strictEngine = new ReconciliationEngine(
    database,
    undefined,
    undefined,
    {
      schemaMode: 'strict',
    },
  )
  await assert.rejects(
    strictEngine.run(
      files({
        POS:
          SAMPLE_CSV.POS + '\nR1,01,1,S01,2026-11-05,2026-11-05,899.00,100.00',
      }),
      SAMPLE_PERIOD,
    ),
    /Conflicting/,
  )
  assert.equal(closes, beforeClose + 1)
  assertClean()
})

test('strict mode rejects missing columns, invalid dates, excess precision, and duplicate GL keys', async () => {
  const strictEngine = new ReconciliationEngine(
    database,
    undefined,
    undefined,
    { schemaMode: 'strict' },
  )
  const cases = [
    [
      { POS: SAMPLE_CSV.POS.replace('receipt_no,', 'wrong_header,') },
      /missing columns: receipt_no/,
    ],
    [
      { POS: SAMPLE_CSV.POS.replaceAll('2026-11-05', '2026-02-30') },
      /POS has invalid/,
    ],
    [{ POS: SAMPLE_CSV.POS.replace('900.00', '900.001') }, /POS has invalid/],
    [
      { POS: SAMPLE_CSV.POS.replace('R1,01,1,', 'R1,01,3,') },
      /must have an export_seq = 1/,
    ],
    [
      { GL: SAMPLE_CSV.GL + '\n' + SAMPLE_CSV.GL.split('\n')[1] },
      /journal_id must be unique/,
    ],
    [
      {
        WEB: SAMPLE_CSV.WEB.replace('2026-11-20,Returned', 'invalid,Returned'),
      },
      /WEB has invalid/,
    ],
  ]
  for (const [override, message] of cases) {
    await assert.rejects(
      strictEngine.run(files(override), SAMPLE_PERIOD),
      message,
    )
    assertClean()
  }
})

test('rejects unassigned sources, incomplete batches, legacy XLS, mixed sample data, and SQL-like dates', async () => {
  const unassigned = files()
  unassigned[0].source = ''
  await assert.rejects(engine.run(unassigned, SAMPLE_PERIOD), /Choose a source/)
  await assert.rejects(engine.run(files().slice(1), SAMPLE_PERIOD), /POS file/)
  const legacy = files()
  legacy[0].file = new File(['not a workbook'], 'pos.xls')
  await assert.rejects(engine.run(legacy, SAMPLE_PERIOD), /legacy XLS/)
  const mixed = files()
  mixed[0].sample = true
  await assert.rejects(engine.run(mixed, SAMPLE_PERIOD), /Remove sample/)
  await assert.rejects(
    engine.run(files(), {
      start: "2026-11-01'; DROP TABLE raw_pos; --",
      end: '2026-11-30',
    }),
    /valid ISO/,
  )
  assertClean()
})

test('cancelled and concurrent runs cannot contaminate subsequent results', async () => {
  const controller = new AbortController()
  controller.abort()
  await assert.rejects(engine.run(files(), SAMPLE_PERIOD, controller.signal), {
    name: 'AbortError',
  })
  const [a, b] = await Promise.all([
    engine.run(files(), SAMPLE_PERIOD),
    engine.run(files(), SAMPLE_PERIOD),
  ])
  assert.equal(a.GL_Finance, b.GL_Finance)
  assert.equal(b.Unexplained, 0)
  assertClean()
})

test('range bars preserve negative totals and impacts that cross zero', () => {
  const cents = {
    Flash_Sales: 100,
    Discounts: -300,
    Cancellations: 0,
    Timing_Differences: 100,
    Returns: 0,
    Data_Errors: 0,
    GL_Finance: -100,
  }
  const steps = buildWaterfall({ cents, unexplainedCents: 0 })
  assert.deepEqual(steps[1].range, [-2, 1])
  assert.deepEqual(steps.at(-1).range, [-1, 0])
  assert.equal(steps.at(-2).end, -1)
})

test('compares store/date aggregates without inventing GL transaction references', async () => {
  const result = await engine.run(
    files({
      POS: SAMPLE_CSV.POS + '\nR5,01,1,S01,2026-11-05,2026-11-05,100.00,0.00',
      GL: SAMPLE_CSV.GL.replace('-900.00', '-1000.00'),
      Flash: SAMPLE_CSV.Flash.replace('4700.00', '4800.00'),
    }),
    SAMPLE_PERIOD,
  )
  assert.equal(result.Unexplained, 0)
  assert.equal(result.missingGLEntries, 1)
  assert.equal(result.dailyDifferenceCount, 1)
  assert.deepEqual(result.dailyDifferences[0], {
    storeKey: 'S01',
    postingDate: '2026-11-06',
    expectedCents: 45000,
    glCents: 0,
    varianceCents: -45000,
    missingGL: true,
  })
  assertClean()
})

test('daily cancellations and month-end returned values keep their distinct FX bases', async () => {
  const result = await engine.run(
    files({
      WEB: SAMPLE_CSV.WEB.replace(
        'Cancelled,300.00,270.00',
        'Cancelled,300.00,260.00',
      ).replace('Delivered,800.00,720.00', 'Delivered,800.00,710.00'),
      GL: SAMPLE_CSV.GL.replace('-720.00', '-710.00'),
    }),
    SAMPLE_PERIOD,
  )
  assert.equal(result.Cancellations, -270)
  assert.equal(result.Returns, -450)
  assert.equal(result.Unexplained, -10)
  assert.equal(result.dailyDifferenceCount, 1) // the expected missing POS day only
})

test('a present GL group with a wrong amount is residual, not a missing GL day', async () => {
  const result = await engine.run(
    files({ GL: SAMPLE_CSV.GL + '\nG9,2026-11-06,S01,MANUAL,0.00' }),
    SAMPLE_PERIOD,
  )
  assert.equal(result.missingGLEntries, 0)
  assert.equal(result.Data_Errors, -900)
  assert.equal(result.Unexplained, -450)
  assert.equal(result.dailyDifferences[0].missingGL, false)
})

test('header-only sources produce a valid zero bridge and partial months are rejected', async () => {
  const empty = Object.fromEntries(
    Object.entries(SAMPLE_CSV).map(([source, csv]) => [
      source,
      csv.split('\n')[0] + '\n',
    ]),
  )
  const result = await engine.run(files(empty), SAMPLE_PERIOD)
  assert.equal(result.GL_Finance, 0)
  assert.equal(result.Flash_Sales, 0)
  assert.equal(result.Unexplained, 0)
  await assert.rejects(
    engine.run(files(), { start: '2026-11-02', end: '2026-11-30' }),
    /complete calendar months/,
  )
  assertClean()
})

test('missing POS posting_date falls back; strict mode rejects an invalid supplied date', async () => {
  const fallback = SAMPLE_CSV.POS.split('\n')
    .map((line) =>
      line
        .split(',')
        .filter((_, i) => i !== 5)
        .join(','),
    )
    .join('\n')
  const result = await engine.run(files({ POS: fallback }), SAMPLE_PERIOD)
  assert.equal(result.posPostingDateFallback, true)
  const strictEngine = new ReconciliationEngine(
    database,
    undefined,
    undefined,
    {
      schemaMode: 'strict',
    },
  )
  await assert.rejects(
    strictEngine.run(
      files({
        POS: SAMPLE_CSV.POS.replace(
          '2026-11-05,2026-11-05',
          '2026-11-05,not-a-date',
        ),
      }),
      SAMPLE_PERIOD,
    ),
    /POS has invalid/,
  )
})

function xlsxFixture(sheetCount = 1) {
  const dateSerial =
    (Date.UTC(2026, 10, 30) - Date.UTC(1899, 11, 30)) / 86400000
  const parts = {
    '[Content_Types].xml': `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${Array.from({ length: sheetCount }, (_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`,
    '_rels/.rels':
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    'xl/styles.xml':
      '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cellXfs count="2"><xf numFmtId="0"/><xf numFmtId="14"/></cellXfs></styleSheet>',
  }
  parts['xl/workbook.xml'] =
    `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${Array.from({ length: sheetCount }, (_, i) => `<sheet name="Source${i + 1}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`
  parts['xl/_rels/workbook.xml.rels'] =
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="styles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>${Array.from({ length: sheetCount }, (_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}</Relationships>`
  for (let i = 1; i <= sheetCount; i++)
    parts[`xl/worksheets/sheet${i}.xml`] =
      `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>month_end_date</t></is></c><c r="B1" t="inlineStr"><is><t>revenue_usd</t></is></c></row><row r="2"><c r="A2" s="1"><v>${dateSerial}</v></c><c r="B2"><v>4700.00</v></c></row></sheetData></worksheet>`
  return zipSync(
    Object.fromEntries(
      Object.entries(parts).map(([path, value]) => [path, strToU8(value)]),
    ),
  )
}

test('XLSX dates and decimal cells run through conversion, registration, and DuckDB SQL', async () => {
  const bytes = xlsxFixture()
  const csv = await workbookToCSV(bytes.buffer)
  assert.match(
    csv,
    /2026-11-30/,
    `Native Excel dates must be ISO calendar dates: ${csv}`,
  )
  const selected = files()
  selected.find((entry) => entry.source === 'Flash').file = new File(
    [bytes],
    'flash.xlsx',
  )
  const excelEngine = new ReconciliationEngine(database, workbookToCSV)
  const result = await excelEngine.run(selected, SAMPLE_PERIOD)
  assert.equal(result.Flash_Sales, 4700)
  assert.equal(result.GL_Finance, 2460)
  assert.equal(result.Unexplained, 0)
  const multiple = xlsxFixture(2)
  assert.equal(
    await workbookToCSV(multiple.buffer),
    await workbookToCSV(bytes.buffer),
  )
  assertClean()
})

test('money labels preserve cents at the safe integer boundary', () => {
  assert.equal(formatUSD(Number.MAX_SAFE_INTEGER), '$90,071,992,547,409.91')
  assert.equal(formatUSD(-1), '-$0.01')
})

test('upload store registers partial sources, then publishes real bridge and anomalies atomically', async () => {
  const store = createAppStore(SAMPLE_PERIOD)
  const detach = store.attachProcessor((selected, period, options) =>
    engine.processUploads(selected, period, options),
  )
  const selected = files()
  store.actions.setFiles(selected.filter((entry) => entry.source !== 'GL'))
  await store.whenSettled()
  assert.equal(store.getState().status, 'waiting')
  assert.deepEqual(store.getState().filesUploaded, {
    POS: true,
    WEB: true,
    GL: false,
    Flash: true,
    Dim: false,
  })
  assert.equal(store.getState().reconciliationData, null)
  assert.deepEqual(store.getState().exceptionsData, [])
  assertClean()

  const observed = []
  const unsubscribe = store.subscribe(() => {
    const snapshot = store.getState()
    if (snapshot.status === 'ready')
      observed.push([snapshot.reconciliationData, snapshot.exceptionsData])
  })
  store.actions.setFiles(selected)
  await store.whenSettled()
  const state = store.getState()
  assert.equal(state.status, 'ready')
  assert.equal(state.reconciliationData.GL_Finance, 2460)
  assert.deepEqual(state.filesUploaded, {
    POS: true,
    WEB: true,
    GL: true,
    Flash: true,
    Dim: false,
  })
  assert.strictEqual(state.exceptionsData, state.reconciliationData.exceptions)
  assert.equal(observed.length, 1)
  const duplicate = state.exceptionsData.find(
    (row) => row.category === 'Data Error',
  )
  assert.equal(duplicate.deltaCents, 90000)
  assert.equal(duplicate.reference, 'R1 / 01')
  assert.equal(duplicate.duplicateLineCount, 1)
  assert.doesNotMatch(duplicate.id, /\s/)
  const missing = state.exceptionsData.find(
    (row) => row.category === 'Missing GL',
  )
  assert.equal(missing.deltaCents, 45000) // the log uses source minus GL
  assert.equal(missing.storeKey, 'S01')
  assert.equal(missing.date, '2026-11-06')

  store.actions.setFiles([])
  assert.equal(store.getState().status, 'idle')
  assert.equal(store.getState().reconciliationData, null)
  assert.deepEqual(store.getState().exceptionsData, [])
  assert.deepEqual(store.getState().filesUploaded, {
    POS: false,
    WEB: false,
    GL: false,
    Flash: false,
    Dim: false,
  })
  unsubscribe()
  detach()
  store.dispose()
  assertClean()
})

test('extracts individual manual journals only where the daily aggregation supports that attribution', async () => {
  const result = await engine.run(
    files({
      GL: SAMPLE_CSV.GL + '\nADJ-0925,2026-11-25,NX057,MANUAL,-1250.00',
    }),
    SAMPLE_PERIOD,
  )
  const manual = result.exceptions.find((row) => row.reference === 'ADJ-0925')
  assert.equal(manual.category, 'Unexplained')
  assert.equal(manual.type, 'Manual Journal')
  assert.equal(manual.deltaCents, -125000)
  assert.equal(manual.storeKey, 'NX057')
  const multiple = await engine.run(
    files({
      GL:
        SAMPLE_CSV.GL +
        '\nADJ-1,2026-11-25,NX057,MANUAL,-1000.00\nADJ-2,2026-11-25,NX057,MANUAL,-250.00',
    }),
    SAMPLE_PERIOD,
  )
  const day = multiple.exceptions.find((row) => row.storeKey === 'NX057')
  assert.equal(day.type, 'Daily Variance')
  assert.equal(day.deltaCents, -125000)
  assert.match(day.description, /ADJ-1, ADJ-2/)
  assertClean()
})

test('exception results are complete beyond the 200-row dashboard preview', async () => {
  const empty = Object.fromEntries(
    Object.entries(SAMPLE_CSV).map(([source, csv]) => [
      source,
      csv.split('\n')[0] + '\n',
    ]),
  )
  empty.GL += Array.from(
    { length: 205 },
    (_, index) => `J${index},2026-11-05,NX${index},POS,-301.00`,
  ).join('\n')
  const result = await engine.run(files(empty), SAMPLE_PERIOD)
  assert.equal(result.dailyDifferences.length, 200)
  assert.equal(result.dailyDifferenceCount, 205)
  assert.equal(result.exceptions.length, 205)
  assert.ok(result.exceptions.every((row) => row.deltaCents === -30100))
  assertClean()
})

function dimWorkbookFixture() {
  const parts = unzipSync(xlsxFixture(4))
  parts['xl/workbook.xml'] = strToU8(
    strFromU8(parts['xl/workbook.xml'])
      .replace('Source1', 'dim_store')
      .replace('Source2', 'dim_date')
      .replace('Source3', 'fx_daily')
      .replace('Source4', 'fx_month_end'),
  )
  const rows = [
    [
      ['store_key', 'store_name'],
      ['001', 'Nexa Home'],
    ],
    [
      ['date_key', 'calendar_date'],
      ['20261130', '2026-11-30'],
    ],
    [
      ['currency', 'rate_daily'],
      ['EUR', '1.075400'],
    ],
    [
      ['currency', 'rate_month_end'],
      ['EUR', '1.065400'],
    ],
  ]
  rows.forEach((data, index) => {
    const sheetData = data
      .map(
        (row, rowIndex) =>
          `<row r="${rowIndex + 1}">${row.map((value, colIndex) => `<c r="${String.fromCharCode(65 + colIndex)}${rowIndex + 1}" t="inlineStr"><is><t>${value}</t></is></c>`).join('')}</row>`,
      )
      .join('')
    parts[`xl/worksheets/sheet${index + 1}.xml`] = strToU8(
      `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetData}</sheetData></worksheet>`,
    )
  })
  return zipSync(parts)
}
const dimFile = () => ({
  id: 'dim',
  source: 'Dim',
  file: new File([dimWorkbookFixture()], 'Nexa_Home_Master_Data.xlsx'),
})
const dimEngine = () =>
  new ReconciliationEngine(database, workbookToCSV, workbookToSheets, {
    schemaMode: 'strict',
  })
function dimTableCount() {
  const connection = bindings.connect()
  try {
    return Number(
      connection
        .query(
          "SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = 'dim'",
        )
        .toArray()[0].n,
    )
  } finally {
    connection.close()
  }
}

test('multi-sheet Dim registers every dimension and retains queryable tables after file cleanup', async () => {
  const result = await dimEngine().run([...files(), dimFile()], SAMPLE_PERIOD)
  assert.equal(result.GL_Finance, 2460)
  assert.equal(result.Unexplained, 0)
  assert.deepEqual(
    result.dimTables.map((table) => table.name),
    ['dim_store', 'dim_date', 'fx_daily', 'fx_month_end'],
  )
  assert.ok(result.dimTables.every((table) => table.rowCount === 1))
  assert.equal(dimTableCount(), 4)
  const connection = bindings.connect()
  try {
    assert.equal(
      connection.query('SELECT store_key FROM dim.dim_store').toArray()[0]
        .store_key,
      '001',
    )
    assert.equal(
      connection.query('SELECT calendar_date FROM dim.dim_date').toArray()[0]
        .calendar_date,
      '2026-11-30',
    )
    assert.equal(
      connection
        .query('SELECT rate_month_end FROM dim.fx_month_end')
        .toArray()[0].rate_month_end,
      '1.065400',
    )
    assert.deepEqual(result.dimTables[0].columns, ['store_key', 'store_name'])
  } finally {
    connection.close()
  }
  assertClean() // source buffers are gone; materialized dimension rows remain
})

test('Dim can arrive first, does not become required, and removal or clearing drops stale dimensions', async () => {
  const processor = dimEngine()
  const store = createAppStore(SAMPLE_PERIOD)
  const detach = store.attachProcessor((selected, period, options) =>
    processor.processUploads(selected, period, options),
  )
  const dim = dimFile()
  store.actions.setFiles([dim])
  await store.whenSettled()
  assert.equal(store.getState().status, 'waiting')
  assert.equal(store.getState().filesUploaded.Dim, true)
  assert.equal(store.getState().dimTables.length, 4)
  assert.equal(store.getState().canViewReconciliation, false)
  store.actions.setFiles([...files(), dim])
  assert.equal(store.getState().canViewReconciliation, true)
  await store.whenSettled()
  assert.equal(store.getState().status, 'ready')
  assert.equal(store.getState().reconciliationData.GL_Finance, 2460)
  store.actions.setFiles(files())
  await store.whenSettled()
  assert.equal(store.getState().status, 'ready')
  assert.equal(store.getState().filesUploaded.Dim, false)
  assert.deepEqual(store.getState().dimTables, [])
  assert.equal(dimTableCount(), 0)
  store.actions.setFiles([dim])
  await store.whenSettled()
  store.actions.setFiles([])
  await store.whenSettled()
  assert.equal(store.getState().status, 'idle')
  assert.equal(dimTableCount(), 0)
  detach()
  store.dispose()
  assertClean()
})

test('failed Dim replacement cannot leave stale dimensions or partial tables', async () => {
  const processor = dimEngine()
  await processor.run([...files(), dimFile()], SAMPLE_PERIOD)
  const broken = {
    ...dimFile(),
    file: new File(['not an XLSX archive'], 'bad_dim.xlsx'),
  }
  await assert.rejects(processor.run([...files(), broken], SAMPLE_PERIOD))
  assert.equal(dimTableCount(), 0)
  assertClean()

  const duplicate = new ReconciliationEngine(
    database,
    workbookToCSV,
    async () => [
      { name: 'dim_store', csv: 'store_key\n001' },
      { name: 'DIM_STORE', csv: 'store_key\n002' },
    ],
    { schemaMode: 'strict' },
  )
  await assert.rejects(
    duplicate.run([...files(), dimFile()], SAMPLE_PERIOD),
    /unique/,
  )
  assert.equal(dimTableCount(), 0)
  assertClean()
})

test('five-file pipeline sends POS/WEB bytes and first-sheet GL/Flash plus four Dim sheets as CSV text', async () => {
  const registrations = { buffers: [], texts: [] }
  const tracked = {
    ...database,
    async registerFileBuffer(path, bytes) {
      registrations.buffers.push(path)
      return database.registerFileBuffer(path, bytes)
    },
    async registerFileText(path, csv) {
      registrations.texts.push({ path, csv })
      return database.registerFileText(path, csv)
    },
  }
  const selected = files()
  const gl = XLSX.read(SAMPLE_CSV.GL, { type: 'string', raw: true })
  XLSX.utils.book_append_sheet(
    gl,
    XLSX.utils.aoa_to_sheet([
      ['Notes'],
      ['This second sheet must not be imported as GL.'],
    ]),
    'Notes',
  )
  selected.find((row) => row.source === 'GL').file = new File(
    [XLSX.write(gl, { type: 'array', bookType: 'xlsx' })],
    'finance_gl.xlsx',
  )
  selected.find((row) => row.source === 'Flash').file = new File(
    [xlsxFixture(2)],
    'sales_flash.xlsx',
  )
  const result = await new ReconciliationEngine(tracked, undefined, undefined, {
    schemaMode: 'strict',
  }).run([...selected, dimFile()], SAMPLE_PERIOD)
  assert.equal(result.GL_Finance, 2460)
  assert.equal(result.Flash_Sales, 4700)
  assert.equal(result.Unexplained, 0)
  assert.equal(registrations.buffers.length, 2)
  assert.ok(registrations.buffers.some((name) => name.endsWith('_pos.csv')))
  assert.ok(registrations.buffers.some((name) => name.endsWith('_web.csv')))
  assert.equal(registrations.texts.length, 6)
  for (const suffix of [
    'gl.csv',
    'flash.csv',
    'dim_store.csv',
    'dim_date.csv',
    'fx_daily.csv',
    'fx_month_end.csv',
  ]) {
    const registered = registrations.texts.find(({ path }) =>
      path.endsWith(suffix),
    )
    assert.ok(registered, suffix)
    assert.equal(typeof registered.csv, 'string')
    assert.ok(!registered.csv.startsWith('PK'))
  }
  assertClean()
})

test('explicit legacy compatibility fills missing POS columns and completes a five-file batch', async () => {
  const logs = []
  const compatible = new ReconciliationEngine(database, undefined, undefined, {
    schemaMode: 'compatible',
    onWarning: (warning) => logs.push(warning),
  })
  const raw =
    'receipt_no,line_no,business_date,amount\nRAW-1,01,2026-11-05,125.50'
  const result = await compatible.run(
    [...files({ POS: raw }), dimFile()],
    SAMPLE_PERIOD,
  )
  assert.equal(result.schemaMode, 'compatible')
  assert.equal(result.rowCounts.POS, 1)
  assert.equal(result.GL_Finance, 2460)
  assert.equal(result.dimTables.length, 4)
  for (const column of [
    'export_seq',
    'store_key',
    'net_usd_month_end',
    'discount_usd_daily',
  ]) {
    assert.ok(
      result.compatibilityWarnings.some((warning) =>
        warning.includes(`${column}:`),
      ),
      column,
    )
  }
  assert.ok(
    logs.some(
      (message) =>
        message.includes('POS (POS.csv)') && message.includes('NX001'),
    ),
  )
  const sourceDay = result.dailyDifferences.find(
    (day) => day.storeKey === 'NX001' && day.postingDate === '2026-11-05',
  )
  assert.equal(sourceDay.expectedCents, 12550)
  assert.ok(
    result.compatibilityWarnings.some((warning) =>
      warning.includes('derived from amount'),
    ),
  )
  assertClean()
})

test('raw amount-only files for all four sources produce a renderable provisional bridge', async () => {
  const compatible = new ReconciliationEngine(database, undefined, undefined, {
    schemaMode: 'compatible',
    onWarning() {},
  })
  const result = await compatible.run(
    files({
      POS: 'Amount\n100.00',
      WEB: 'Amount\n200.00',
      GL: 'Amount\n-300.00',
      Flash: 'Amount\n300.00',
    }),
    SAMPLE_PERIOD,
  )
  assert.equal(result.Flash_Sales, 300)
  assert.equal(result.GL_Finance, 300)
  assert.equal(result.Unexplained, 0)
  assert.equal(result.Discounts, 0)
  assert.ok(result.compatibilityWarnings.length > 20)
  assert.equal(buildWaterfall(result).at(-1).endCents, 30000)
  assert.doesNotThrow(() => JSON.stringify(result))
  assertClean()
})

test('raw store codes and amount aliases are SQL-quoted and normalized per file', async () => {
  const compatible = new ReconciliationEngine(database, undefined, undefined, {
    schemaMode: 'compatible',
    onWarning() {},
  })
  const raw =
    'Receipt ID,Line Number,Business Date,Store Code,Amount\nRAW-2,02,2026-11-07,NX007,"$1,234.56"'
  const selected = files()
  selected.push({
    id: 'second-pos',
    source: 'POS',
    file: new File([raw], 'raw_pos.csv'),
  })
  const result = await compatible.run(selected, SAMPLE_PERIOD)
  assert.equal(result.rowCounts.POS, 6)
  assert.equal(result.duplicatePOSAdjustment, -900) // canonical rows are unchanged
  const day = result.dailyDifferences.find(
    (entry) => entry.storeKey === 'NX007',
  )
  assert.equal(day.expectedCents, 123456)
  assert.ok(
    result.compatibilityWarnings.some(
      (warning) =>
        warning.includes('raw_pos.csv') && warning.includes('Store Code'),
    ),
  )
  assertClean()
})

test('missing amounts fall back to zero, and generated POS identities do not collide across files', async () => {
  const compatible = new ReconciliationEngine(database, undefined, undefined, {
    schemaMode: 'compatible',
    onWarning() {},
  })
  const selected = files({ POS: 'unmapped_column\nplaceholder' })
  selected.push({
    id: 'second-pos',
    source: 'POS',
    file: new File(['amount,export_seq\n25.00,2'], 'second_pos.csv'),
  })
  const result = await compatible.run(selected, SAMPLE_PERIOD)
  assert.equal(result.rowCounts.POS, 2)
  assert.equal(result.duplicatePOSLines, 0)
  assert.ok(
    result.compatibilityWarnings.some((warning) =>
      warning.includes('no recognized amount column'),
    ),
  )
  assert.ok(
    result.compatibilityWarnings.some((warning) =>
      warning.includes('reset to 1'),
    ),
  )
  assertClean()
})

test('complete canonical input keeps its metrics and still discloses bypassed validation', async () => {
  const result = await engine.run(files(), SAMPLE_PERIOD)
  assert.equal(result.compatibilityWarnings.length, 1)
  assert.match(
    result.compatibilityWarnings[0],
    /row-integrity checks are disabled/,
  )
  assert.equal(result.Flash_Sales, 4700)
  assert.equal(result.GL_Finance, 2460)
  assert.equal(result.Data_Errors, -1350)
  assertClean()
})

test('6894 returned WEB rows with US dates and blank recognition dates publish dashboard-ready results', async () => {
  const rawWeb = [
    SAMPLE_CSV.WEB.split('\n')[0],
    ...Array.from(
      { length: 6894 },
      () => 'REPEATED-ID,,11/21/2026,,,Returned,100.00,90.00,10.00',
    ),
  ].join('\n')
  const store = createAppStore(SAMPLE_PERIOD)
  const detach = store.attachProcessor((selected, period, options) =>
    engine.processUploads(selected, period, options),
  )
  try {
    store.actions.setFiles([...files({ WEB: rawWeb }), dimFile()])
    await store.whenSettled()
    const state = store.getState()
    assert.equal(state.status, 'ready')
    assert.equal(state.error, null)
    assert.equal(state.canViewReconciliation, true)
    const result = state.reconciliationData
    assert.equal(result.rowCounts.WEB, 6894)
    assert.equal(result.dimTables.length, 4)
    assert.equal(result.Returns, -620460)
    assert.equal(result.GL_Finance, 2460)
    assert.strictEqual(state.exceptionsData, result.exceptions)
    assert.ok(buildWaterfall(result).every((bar) => Number.isFinite(bar.end)))
    assertClean()
  } finally {
    detach()
    store.dispose()
  }
})

test('compatible mode tolerates malformed canonical values and conflicting keys in every source', async () => {
  const result = await engine.run(
    files({
      POS: `${SAMPLE_CSV.POS.split('\n')[0]}\n,,, ,bad,bad,N/A,bad\nDUP,1,1,NX001,11/21/2026,11/21/2026,100.00,0\nDUP,1,1,NX001,11/21/2026,11/21/2026,200.00,0`,
      WEB: `${SAMPLE_CSV.WEB.split('\n')[0]}\n,,bad,bad,bad,unknown,N/A,bad,-5.001\nW,,11/21/2026,,,Returned,100,90,10\nW,,11/21/2026,bad,bad,Canceled,100,90,10`,
      GL: `${SAMPLE_CSV.GL.split('\n')[0]}\n,,, ,N/A\nJ,bad,NX001,MANUAL,-10\nJ,11/21/2026,NX001,MANUAL,-10`,
      Flash: 'month_end_date,revenue_usd\nbad,N/A\n11/21/2026,"$1,234.567"',
    }),
    SAMPLE_PERIOD,
  )
  assert.equal(result.GL_Finance, 20)
  assert.equal(result.Flash_Sales, 1234.57)
  assert.equal(result.Returns, -90)
  assert.equal(result.Cancellations, -90)
  assert.equal(result.duplicatePOSLines, 1)
  assert.ok(Object.values(result.cents).every(Number.isSafeInteger))
  assert.ok(buildWaterfall(result).every((bar) => Number.isFinite(bar.end)))
  assert.doesNotThrow(() => JSON.stringify(result))
  assertClean()
})

const accountingEngine = () =>
  new ReconciliationEngine(database, undefined, undefined, { onWarning() {} })
const dimCSV = (name, csv) => ({
  id: name,
  source: 'Dim',
  file: new File([csv], `${name}.csv`),
})

async function nativeMasterConfig(
  file,
  storeKey = 'store_key',
  storeId = 'store_code',
) {
  const config = createMasterDraft(
    file.id,
    parseDimMappingPreviews(await file.file.arrayBuffer(), 'xlsx'),
  )
  for (const role of REFERENCE_ROLES) config.roles[role].usage = 'not-used'
  config.roles.store = {
    usage: 'enabled',
    sheetName: 'dim_store',
    columns: { pos_store_id: storeId, finance_store_code: storeKey },
    relationships: [defaultRelationship('store')],
  }
  config.roles.calendar = {
    usage: 'enabled',
    sheetName: 'dim_date',
    columns: { date: 'date_key', posting_date: 'posting_date' },
    relationships: [
      {
        ...defaultRelationship('calendar'),
        purpose: 'calendar-posting',
        outputs: ['posting_date'],
      },
    ],
  }
  return masterSnapshot(config)
}

test('production accounting mode preserves the seven-bucket financial baseline without preview mocks', async () => {
  const result = await accountingEngine().run(files(), SAMPLE_PERIOD)
  assert.equal(result.schemaMode, 'accounting')
  assert.equal(result.Flash_Sales, 4700)
  assert.equal(result.Discounts, -450)
  assert.equal(result.Cancellations, -270)
  assert.equal(result.Timing_Differences, 280)
  assert.equal(result.Returns, -450)
  assert.equal(result.Data_Errors, -1350)
  assert.equal(result.GL_Finance, 2460)
  assert.equal(result.Unexplained, 0)
  assert.ok(
    result.compatibilityWarnings.every((note) => !note.includes('disabled')),
  )
  assertClean()
})

test('Flash gross_usd sums its real 2025 month-end rows and GL credits retain exact cents', async () => {
  const result = await accountingEngine().run(
    files({
      POS: SAMPLE_CSV.POS.split('\n')[0],
      WEB: SAMPLE_CSV.WEB.split('\n')[0],
      GL: 'journal_id,posting_date,store_key,journal_type,amount_usd\nJ1,2025-03-31,999999,SALES,-28698496.23',
      Flash:
        'month_end_date,gross_usd\n03/31/2025,"$10,000,000.00"\n2025-03-31,21120000.00\n2024-03-31,9000000.00\n2025-04-30,9000000.00',
    }),
    { start: '2025-03-01', end: '2025-03-31' },
  )
  assert.equal(result.Flash_Sales, 31120000)
  assert.equal(result.cents.Flash_Sales, 3112000000)
  assert.equal(result.GL_Finance, 28698496.23)
  assert.equal(result.cents.GL_Finance, 2869849623)
  assert.ok(
    result.compatibilityWarnings.some((note) =>
      note.includes('revenue_usd mapped from gross_usd'),
    ),
  )
  assertClean()
})

test('POS earliest exported_at wins across files, net subtracts discount once, and duplicates form an exact adjustment', async () => {
  const selected = files({
    POS: 'receipt_no,line_no,store_key,business_date,posting_date,exported_at,export_seq,gross_usd,discount_usd_daily\nR1,01,NX007,2025-03-29,2025-03-29,2025-03-30 09:00:00,1,110,10',
    WEB: SAMPLE_CSV.WEB.split('\n')[0],
    GL: 'journal_id,posting_date,store_key,journal_type,amount_usd\nJ1,2025-03-29,NX007,SALES,-90',
    Flash: 'month_end_date,revenue_usd\n2025-03-31,210',
  })
  selected.push({
    id: 'earlier-export',
    source: 'POS',
    file: new File(
      [
        'receipt_no,line_no,store_key,business_date,posting_date,exported_at,export_seq,gross_usd,discount_usd_daily\nR1,01,NX007,2025-03-29,2025-03-29,2025-03-29 09:00:00,99,100,10',
      ],
      'earlier.csv',
    ),
  })
  const result = await accountingEngine().run(selected, {
    start: '2025-03-01',
    end: '2025-03-31',
  })
  assert.equal(result.Discounts, -20)
  assert.equal(result.duplicatePOSLines, 1)
  assert.equal(result.duplicatePOSAdjustment, -100)
  assert.equal(result.GL_Finance, 90)
  assert.equal(result.missingGLEntries, 0)
  assert.equal(result.Unexplained, 0)
  assert.equal(result.exceptions[0].deltaCents, 10000)
  assertClean()
})

test('store/calendar dimension mappings join both store and date without fanout or false missing GL', async () => {
  const selected = files({
    POS: 'receipt_no,line_no,store_code,business_date_key,exported_at,gross_usd,discount_usd_daily\nR1,1,NX007,20250329,2025-03-29,100,10\nR2,1,NX007,20250329,2025-03-29,200,20',
    WEB: 'web_order_id,order_date,delivery_date,return_date,order_status,gross_usd_daily,net_usd_month_end,discount_usd_daily\nW1,03/29/2025,03/30/2025,,Delivered,100,90,10',
    GL: 'journal_id,posting_date,store_key,journal_type,amount_usd\nJ1,2025-03-30,7.0,POS,-100\nJ2,2025-03-30,7,POS,-170\nJ3,2025-03-30,999999.0,WEB,-90',
    Flash: 'month_end_date,gross_usd\n2025-03-31,400',
  })
  selected.push(
    dimCSV('dim_store', 'store_key,store_code\n7,NX007\n999999,ONLINE'),
  )
  selected.push(
    dimCSV(
      'dim_date',
      'date_key,calendar_date,posting_date\n20250329,2025-03-29,2025-03-30',
    ),
  )
  const workbook = XLSX.utils.book_new()
  for (const dim of selected.splice(-2)) {
    const sheet = XLSX.read(await dim.file.text(), {
      type: 'string',
      raw: true,
    })
    XLSX.utils.book_append_sheet(
      workbook,
      sheet.Sheets[sheet.SheetNames[0]],
      dim.id,
    )
  }
  const master = {
    id: 'master',
    source: 'Dim',
    file: new File(
      [XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })],
      'Master.xlsx',
    ),
  }
  selected.push(master)
  const result = await accountingEngine().run(
    selected,
    {
      start: '2025-03-01',
      end: '2025-03-31',
    },
    undefined,
    { masterConfiguration: await nativeMasterConfig(master) },
  )
  assert.equal(result.GL_Finance, 360)
  assert.equal(result.Discounts, -40)
  assert.equal(result.missingGLEntries, 0)
  assert.equal(result.Unexplained, 0)
  assert.deepEqual(result.dailyDifferences, [])
  assert.equal(result.exceptions.length, 0)
  assertClean()
})

test('accounting recognition excludes cancellations, books returns on return_date, and handles cross-month timing', async () => {
  const result = await accountingEngine().run(
    files({
      POS: SAMPLE_CSV.POS.split('\n')[0],
      WEB: 'web_order_id,store_key,order_date,delivery_date,return_date,order_status,gross_usd_daily,net_usd_month_end,discount_usd_daily\nC,999999,2025-03-01,,,Cancelled,100,90,10\nR,999999,2025-02-27,2025-02-28,2025-03-01,Returned,200,180,20\nOUT,999999,2025-03-31,2025-04-01,,Delivered,300,270,30\nIN,999999,2025-02-28,2025-03-01,,Delivered,400,360,40',
      GL: 'journal_id,posting_date,store_key,journal_type,amount_usd\nJ1,2025-03-01,999999,SALE,-360\nJ2,2025-03-01,999999,REFUND,180',
      Flash: 'month_end_date,revenue_usd\n2025-03-31,400',
    }),
    { start: '2025-03-01', end: '2025-03-31' },
  )
  assert.equal(result.Discounts, -40)
  assert.equal(result.Cancellations, -90)
  assert.equal(result.Timing_Differences, 90)
  assert.equal(result.Returns, -180)
  assert.equal(result.GL_Finance, 180)
  assert.equal(result.Data_Errors, 0)
  assert.equal(result.Unexplained, 0)
  assertClean()
})

test('accounting distinguishes genuine absent store-days from present but mismatched GL totals', async () => {
  const result = await accountingEngine().run(
    files({
      POS: 'receipt_no,line_no,store_key,business_date,exported_at,gross_usd\nR1,1,NX057,2025-11-21,2025-11-21,7228\nR2,1,NX007,2025-11-21,2025-11-21,500\nR3,1,NX057,2025-11-22,2025-11-22,100',
      WEB: SAMPLE_CSV.WEB.split('\n')[0],
      GL: 'journal_id,posting_date,store_key,journal_type,amount_usd\nJ1,2025-11-21,NX007,SALES,-490\nJ2,2025-11-22,NX057,SALES,-100',
      Flash: 'month_end_date,gross_usd\n2025-11-30,7828',
    }),
    { start: '2025-11-01', end: '2025-11-30' },
  )
  assert.equal(result.missingGLEntries, 1)
  assert.equal(result.missingGLAdjustment, -7228)
  assert.equal(result.Data_Errors, -7228)
  assert.equal(result.Unexplained, -10)
  assert.equal(
    result.exceptions.find((row) => row.category === 'Missing GL').storeKey,
    'NX057',
  )
  assertClean()
})

test('accounting refuses fabricated financial values and ambiguous dimensions', async () => {
  for (const [selected, expected] of [
    [
      files({ Flash: 'month_end_date,unknown_amount\n2025-03-31,99' }),
      /missing revenue_usd/,
    ],
    [files({ Flash: 'month_end_date,gross_usd\nbad,N\/A' }), /Flash requires/],
    [
      files({
        WEB: SAMPLE_CSV.WEB.replace('2026-11-20,Returned', ',Returned'),
      }),
      /WEB has invalid/,
    ],
    [
      [
        ...files(),
        dimCSV('dim_store', 'store_key,store_code\n1,NX007\n2,NX007'),
      ],
      /Confirm Master/,
    ],
    [
      [
        ...files(),
        dimCSV(
          'dim_date',
          'date_key,calendar_date,posting_date\n1,2026-11-01,2026-11-01\n1,2026-11-01,2026-11-02',
        ),
      ],
      /Confirm Master/,
    ],
  ]) {
    await assert.rejects(
      accountingEngine().run(selected, SAMPLE_PERIOD),
      expected,
    )
    assertClean()
  }
})

test('accounting flags an empty Flash reporting period rather than silently masking it', async () => {
  const result = await accountingEngine().run(
    files({ Flash: 'month_end_date,gross_usd\n2025-03-31,100' }),
    SAMPLE_PERIOD,
  )
  assert.equal(result.Flash_Sales, 0)
  assert.ok(
    result.compatibilityWarnings.some((note) =>
      note.includes('Flash has no month_end_date rows'),
    ),
  )
  assertClean()
})

test('accounting quantifies twelve duplicate NX007 lines as exactly 12622 USD', async () => {
  const rows = ['R1,1,NX007,03/29/2025,03/29/2025 08:00:00,1000']
  for (let index = 0; index < 12; index++)
    rows.push(
      `R1,1,NX007,03/29/2025,03/29/2025 09:${String(index).padStart(2, '0')}:00,${index === 11 ? 1061 : 1051}`,
    )
  const result = await accountingEngine().run(
    files({
      POS: `receipt_no,line_no,store_key,business_date,exported_at,gross_usd\n${rows.join('\n')}`,
      WEB: SAMPLE_CSV.WEB.split('\n')[0],
      GL: 'journal_id,posting_date,store_key,journal_type,amount_usd\nJ1,2025-03-29,NX007,POS,-1000',
      Flash: 'month_end_date,gross_usd\n2025-03-31,13622',
    }),
    { start: '2025-03-01', end: '2025-03-31' },
  )
  assert.equal(result.duplicatePOSLines, 12)
  assert.equal(result.duplicatePOSAdjustment, -12622)
  assert.equal(result.Data_Errors, -12622)
  assert.equal(result.missingGLEntries, 0)
  assert.equal(result.Unexplained, 0)
  assert.equal(result.exceptions[0].duplicateLineCount, 12)
  assert.equal(result.exceptions[0].deltaCents, 1262200)
  assertClean()
})

test('confirmed FY2025 headers complete a five-file store run, retaining monthly FX net and both year boundaries', async () => {
  const xlsxFile = (name, sheets) => {
    const workbook = XLSX.utils.book_new()
    for (const [sheet, rows] of Object.entries(sheets))
      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.aoa_to_sheet(rows),
        sheet,
      )
    return new File(
      [XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })],
      name,
    )
  }
  const store = createAppStore()
  const selected = [
    {
      id: 'pos',
      source: 'POS',
      file: new File(
        [
          'receipt_no,line_no,exported_at,business_date,line_amount,discount_usd_daily,net_usd_month_end,store_key,export_seq\nR1,1,2025-01-01 08:00:00,2025-01-01,100,10,89,NX007,1\nR2,1,2025-12-31 08:00:00,2025-12-31,200,20,178,NX007,1',
        ],
        'POS_Sales_Export_2025.csv',
      ),
    },
    {
      id: 'web',
      source: 'WEB',
      file: new File(
        [
          'web_order_id,order_date,delivery_date,return_date,order_status,gross_usd_daily,net_usd_month_end,discount_usd_daily\nC,2025-01-05,,,Cancelled,200,179,20\nR,2024-12-20,2024-12-21,2025-01-03,Returned,300,268,30\nOUT,2025-12-31,2026-01-02,,Delivered,400,357,40\nIN,2024-12-31,2025-01-01,,Delivered,500,447,50',
        ],
        'WEB_Orders_Export.csv',
      ),
    },
    {
      id: 'gl',
      source: 'GL',
      file: xlsxFile('Finance_GL_Revenue_FY2025.xlsx', {
        fact_gl_entry: [
          [
            'journal_id',
            'posting_date',
            'amount_usd',
            'store_key',
            'journal_type',
          ],
          ['J1', '2025-01-02', -89, 'NX007', 'POS'],
          ['J2', '2025-01-01', -447, '999999', 'WEB_DELIVERY'],
          ['J3', '2025-01-03', 268, '999999', 'WEB_RETURN'],
          ['OUT', '2026-01-02', -535, 'NX007', 'POS'],
        ],
      }),
    },
    {
      id: 'flash',
      source: 'Flash',
      file: xlsxFile('Sales_Flash_Report_2025.xlsx', {
        fact_sales_flash: [
          ['month_end_date', 'revenue_usd'],
          ['2024-12-31', 5000000],
          ...Array.from({ length: 12 }, (_, month) => [
            new Date(Date.UTC(2025, month + 1, 0)).toISOString().slice(0, 10),
            month === 0 ? 300 : month === 11 ? 600 : 0,
          ]),
          ['2026-01-31', 9000000],
        ],
      }),
    },
    {
      id: 'dim',
      source: 'Dim',
      file: xlsxFile('Nexa_Home_Master_Data.xlsx', {
        dim_store: [['store_key'], ['NX007'], ['999999']],
        dim_date: [
          ['date_key', 'working_day', 'posting_date'],
          ['20250101', true, '2025-01-02'],
          ['20251231', true, '2026-01-02'],
        ],
        fx_daily: [
          ['currency', 'rate_daily'],
          ['USD', 1],
        ],
        fx_month_end: [
          ['currency', 'rate_month_end'],
          ['USD', 1],
        ],
      }),
    },
  ]
  const masterConfiguration = await nativeMasterConfig(
    selected.at(-1),
    'store_key',
    'store_key',
  )
  const detach = store.attachProcessor((inputs, period, options) =>
    accountingEngine().processUploads(inputs, period, {
      ...options,
      masterConfiguration: inputs.some((f) => f.source === 'Dim')
        ? masterConfiguration
        : null,
    }),
  )
  try {
    store.actions.setFiles(selected)
    await store.whenSettled()
    const state = store.getState()
    assert.equal(state.status, 'ready', state.error ?? '')
    const result = state.reconciliationData
    assert.deepEqual(result.period, { start: '2025-01-01', end: '2025-12-31' })
    assert.equal(result.schemaMode, 'accounting')
    assert.equal(result.Flash_Sales, 900)
    assert.equal(result.Discounts, -90)
    assert.equal(result.Cancellations, -180)
    assert.equal(result.Timing_Differences, -88)
    assert.equal(result.Returns, -268)
    assert.equal(result.Data_Errors, 0)
    assert.equal(result.GL_Finance, 268)
    assert.equal(result.Unexplained, -6) // Real daily/month-end FX basis differences.
    assert.equal(result.missingGLEntries, 0)
    assert.deepEqual(result.dailyDifferences, [])
    assert.equal(result.dimTables.length, 2)
    assert.strictEqual(state.exceptionsData, result.exceptions)
    assert.ok(
      result.compatibilityWarnings.some((note) => note.includes('line_amount')),
    )
    assertClean()
  } finally {
    detach()
    store.dispose()
  }
})

test('POS local line_amount is never mixed with USD discounts when supplied net USD is present', async () => {
  const result = await accountingEngine().run(
    files({
      POS: 'receipt_no,line_no,exported_at,business_date,line_amount,currency,discount_usd_daily,net_usd_month_end,store_key\nR1,1,2025-03-29,2025-03-29,100,GBP,110,15,NX007',
      WEB: SAMPLE_CSV.WEB.split('\n')[0],
      GL: 'journal_id,posting_date,amount_usd,store_key,journal_type\nJ1,2025-03-29,-15,NX007,POS',
      Flash: 'month_end_date,revenue_usd\n2025-03-31,125',
    }),
    { start: '2025-03-01', end: '2025-03-31' },
  )
  assert.equal(result.GL_Finance, 15)
  assert.equal(result.Data_Errors, 0)
  assert.equal(result.Unexplained, 0)
  assertClean()
})

test('POS USD line_amount derives net only when no supplied net field exists', async () => {
  const result = await accountingEngine().run(
    files({
      POS: 'receipt_no,line_no,exported_at,business_date,line_amount,currency,discount_usd_daily,store_key\nR1,1,2025-03-29,2025-03-29,100,USD,10,NX007',
      WEB: SAMPLE_CSV.WEB.split('\n')[0],
      GL: 'journal_id,posting_date,amount_usd,store_key,journal_type\nJ1,2025-03-29,-90,NX007,POS',
      Flash: 'month_end_date,revenue_usd\n2025-03-31,100',
    }),
    { start: '2025-03-01', end: '2025-03-31' },
  )
  assert.equal(result.GL_Finance, 90)
  assert.equal(result.Unexplained, 0)
  assertClean()
})

test('Excel conversion preserves time so the earliest same-day POS export wins', async () => {
  const workbook = XLSX.utils.book_new()
  const serial = (Date.UTC(2025, 2, 29) - Date.UTC(1899, 11, 30)) / 86400000
  const sheet = XLSX.utils.aoa_to_sheet([
    [
      'receipt_no',
      'line_no',
      'exported_at',
      'business_date',
      'line_amount',
      'discount_usd_daily',
      'net_usd_month_end',
      'store_key',
      'export_seq',
    ],
    ['R1', 1, serial + 22.25 / 24, '2025-03-29', 200, 0, 200, 'NX007', 1],
    ['R1', 1, serial + 8.25 / 24, '2025-03-29', 100, 0, 100, 'NX007', 2],
  ])
  sheet.C2.z = sheet.C3.z = 'yyyy-mm-dd hh:mm:ss'
  XLSX.utils.book_append_sheet(workbook, sheet, 'fact_pos_line')
  const posFile = new File(
    [XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })],
    'POS.xlsx',
  )
  const converted = await workbookToCSV(await posFile.arrayBuffer())
  assert.match(converted, /2025-03-29 22:15:00/)
  assert.match(converted, /2025-03-29 08:15:00/)
  const selected = files({
    WEB: SAMPLE_CSV.WEB.split('\n')[0],
    GL: 'journal_id,posting_date,amount_usd,store_key,journal_type\nJ1,2025-03-29,-100,NX007,POS',
    Flash: 'month_end_date,revenue_usd\n2025-03-31,300',
  })
  selected[0].file = posFile
  const result = await accountingEngine().run(selected, {
    start: '2025-03-01',
    end: '2025-03-31',
  })
  assert.equal(result.duplicatePOSAdjustment, -200)
  assert.equal(result.Unexplained, 0)
  assertClean()
})

function mappedWizardFixture(
  localCurrency = false,
  { salesNet = 'mapped', posNet = '100.00', webNet = '50.00' } = {},
) {
  const inputs = {
    POS: [
      [
        'Receipt "code"',
        'Receipt line',
        'Store ref',
        'Business day',
        'Finance day',
        localCurrency ? 'line_amount' : 'Counter total',
        'Promo value',
        'Settled USD',
        'Export time',
        'gross_usd_daily',
        'currency',
      ],
      [
        'R1',
        '01',
        'S01',
        '2026-11-05',
        '2026-11-05',
        localCurrency ? '9999.00' : '120.00',
        '20.00',
        posNet,
        '2026-11-05 01:00:00',
        '8888.00',
        localCurrency ? 'EUR' : 'USD',
      ],
    ],
    WEB: [
      [
        'Web ref',
        'Store ref',
        'Order day',
        'Delivered on',
        'Status value',
        'Web total',
        'Web promo',
        'Web net',
        'gross_usd_daily',
      ],
      [
        'W1',
        'S01',
        '2026-11-05',
        '2026-11-05',
        'Delivered',
        '60.00',
        '10.00',
        webNet,
        '9999.00',
      ],
    ],
    GL: [
      [
        'Journal ref',
        'Finance day',
        'Ledger site',
        'Entry class',
        'Signed USD',
        'amount_usd',
      ],
      ['G1', '2026-11-05', 'S01', 'POS', '-150.00', '-999.00'],
    ],
    Flash: [
      ['Report close', 'Flash total'],
      ['2026-11-30', '180.00'],
    ],
  }
  const mappings = {
    POS: {
      transaction_id: 'Receipt "code"',
      line_no: 'Receipt line',
      store_key: 'Store ref',
      date: 'Business day',
      posting_date: 'Finance day',
      gross_amount: localCurrency ? 'line_amount' : 'Counter total',
      discount: 'Promo value',
      net_amount: 'Settled USD',
      exported_at: 'Export time',
    },
    WEB: {
      transaction_id: 'Web ref',
      store_key: 'Store ref',
      date: 'Order day',
      delivery_date: 'Delivered on',
      order_status: 'Status value',
      gross_amount: 'Web total',
      discount: 'Web promo',
      net_amount: 'Web net',
    },
    GL: {
      transaction_id: 'Journal ref',
      date: 'Finance day',
      store_key: 'Ledger site',
      journal_type: 'Entry class',
      net_amount: 'Signed USD',
    },
    Flash: { date: 'Report close', gross_amount: 'Flash total' },
  }
  if (salesNet !== 'mapped') {
    for (const source of ['POS', 'WEB']) {
      const index = inputs[source][0].indexOf(mappings[source].net_amount)
      delete mappings[source].net_amount
      if (salesNet === 'absent') {
        for (const row of inputs[source]) row.splice(index, 1)
      } else {
        // An unselected native net header must not override the user's fallback choice.
        inputs[source][0].push('net_usd_month_end')
        inputs[source][1].push('999.00')
      }
    }
  }
  const selected = Object.entries(inputs).map(([source, values]) => {
    const sheet = XLSX.utils.aoa_to_sheet(values)
    if (source === 'GL') {
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, sheet, 'Ledger')
      return {
        id: source,
        source,
        file: new File(
          [XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })],
          `${source}.xlsx`,
        ),
      }
    }
    return {
      id: source,
      source,
      file: new File([XLSX.utils.sheet_to_csv(sheet)], `${source}.csv`),
    }
  })
  const configuration = selected.map((file) => ({
    fileId: file.id,
    fileName: file.file.name,
    source: file.source,
    columns: mappings[file.source],
  }))
  return { selected, configuration }
}

test('wizard completion reconciles selected custom CSV/XLSX headers through the real store and DuckDB', async () => {
  const { selected, configuration } = mappedWizardFixture()
  const store = createAppStore(SAMPLE_PERIOD, { ingestionMode: 'wizard' })
  let runs = 0
  store.attachProcessor((files, period, options) => {
    runs++
    return accountingEngine().processUploads(files, period, options)
  })
  store.actions.openOnboarding()
  store.actions.setFiles(selected)
  for (const file of selected) {
    store.actions.setFilePreview(
      file.id,
      file.file,
      file.source,
      parseMappingPreview(
        await file.file.arrayBuffer(),
        file.source === 'GL' ? 'xlsx' : 'csv',
      ),
    )
    store.actions.setColumnMapping(
      file.id,
      configuration.find((mapping) => mapping.fileId === file.id).columns,
    )
  }
  await store.whenSettled()
  assert.equal(runs, 0, 'no SQL runs while the user is still mapping sources')
  store.actions.completeOnboarding()
  assert.equal(store.getState().onboardingOpen, false)
  await store.whenSettled()
  assert.equal(runs, 1)
  assert.equal(store.getState().status, 'ready', store.getState().error)
  const result = store.getState().reconciliationData
  assert.equal(result.Flash_Sales, 180)
  assert.equal(result.Discounts, -30)
  assert.equal(
    result.GL_Finance,
    150,
    'use selected Signed USD, ignoring the decoy native amount_usd',
  )
  assert.equal(result.Unexplained, 0)
  assert.deepEqual(result.rowCounts, { POS: 1, WEB: 1, GL: 1, Flash: 1 })
  assert.deepEqual(
    store
      .getState()
      .confirmedMappings.map(({ glAmountBasis, sheetName, ...mapping }) => {
        if (mapping.source === 'GL') {
          assert.equal(glAmountBasis, 'ledger')
          assert.equal(sheetName, 'Ledger')
        }
        return mapping
      }),
    configuration,
  )
  assertClean()
  store.dispose()
})

test('mapped processing rejects missing, stale, and duplicate column selections without leaking registered files', async () => {
  for (const invalid of ['missing', 'stale', 'duplicate']) {
    const { selected, configuration } = mappedWizardFixture()
    if (invalid === 'missing') configuration.shift()
    if (invalid === 'stale') configuration[0].columns.date = 'Removed column'
    if (invalid === 'duplicate')
      configuration[0].columns.gross_amount =
        configuration[0].columns.net_amount
    await assert.rejects(
      accountingEngine().processUploads(selected, SAMPLE_PERIOD, {
        columnMappings: configuration,
      }),
      /confirmed.*mapping|invalid confirmed mappings/i,
    )
    assertClean()
  }
})

test('explicit POS line_amount mapping still preserves authoritative USD net for non-USD source gross', async () => {
  const { selected, configuration } = mappedWizardFixture(true)
  const result = await accountingEngine().processUploads(
    selected,
    SAMPLE_PERIOD,
    { columnMappings: configuration },
  )
  assert.equal(result.GL_Finance, 150)
  assert.equal(result.Discounts, -30)
  assert.equal(result.Unexplained, 0)
  assertClean()
})

for (const salesNet of ['absent', 'unmapped']) {
  test(`POS and WEB derive net from selected gross minus discount when sales net is ${salesNet}`, async () => {
    for (const emptySelection of [undefined, '']) {
      const { selected, configuration } = mappedWizardFixture(false, {
        salesNet,
      })
      if (emptySelection === '')
        for (const mapping of configuration)
          if (mapping.source === 'POS' || mapping.source === 'WEB')
            mapping.columns.net_amount = ''
      const result = await accountingEngine().processUploads(
        selected,
        SAMPLE_PERIOD,
        { columnMappings: configuration },
      )
      assert.equal(result.GL_Finance, 150)
      assert.equal(result.Discounts, -30)
      assert.equal(result.Unexplained, 0)
      assert.equal(
        result.dailyDifferenceCount,
        0,
        'net is 100 + 50, including when a native net header contains 999',
      )
      for (const source of ['POS', 'WEB'])
        assert.ok(
          result.compatibilityWarnings.some(
            (note) =>
              note.startsWith(`${source} (`) &&
              note.includes(
                'Net USD calculated as gross USD minus USD discount',
              ),
          ),
        )
      assertClean()
    }
  })
}

for (const [posNet, expectedCents] of [
  ['0.00', 5000],
  ['97.25', 14725],
]) {
  test(`mapped POS net ${posNet} is used as supplied instead of deriving or discounting it again`, async () => {
    const { selected, configuration } = mappedWizardFixture(false, { posNet })
    const result = await accountingEngine().processUploads(
      selected,
      SAMPLE_PERIOD,
      { columnMappings: configuration },
    )
    assert.equal(result.dailyDifferenceCount, 1)
    assert.equal(result.dailyDifferences[0].expectedCents, expectedCents)
    assert.equal(
      result.dailyDifferences[0].varianceCents,
      15000 - expectedCents,
    )
    assert.equal(
      result.compatibilityWarnings.some(
        (note) =>
          note.startsWith('POS (') && note.includes('Net USD calculated'),
      ),
      false,
    )
    assertClean()
  })
}

test('a mapped but blank net value fails row validation instead of silently calculating a replacement', async () => {
  const { selected, configuration } = mappedWizardFixture(false, { posNet: '' })
  await assert.rejects(
    accountingEngine().processUploads(selected, SAMPLE_PERIOD, {
      columnMappings: configuration,
    }),
    /POS_USD_NET_INVALID/,
  )
  assertClean()
})

test('derived net preserves decimal cents in both POS and WEB', async () => {
  const { selected, configuration } = mappedWizardFixture(false, {
    salesNet: 'absent',
  })
  for (const [source, original, replacement] of [
    ['POS', '120.00,20.00', '120.10,20.07'],
    ['WEB', '60.00,10.00', '60.01,10.02'],
  ]) {
    const entry = selected.find((file) => file.source === source)
    const csv = await entry.file.text()
    assert.ok(csv.includes(original))
    entry.file = new File([csv.replace(original, replacement)], entry.file.name)
  }
  const result = await accountingEngine().processUploads(
    selected,
    SAMPLE_PERIOD,
    { columnMappings: configuration },
  )
  assert.equal(
    result.dailyDifferences[0].expectedCents,
    15002,
    '100.03 POS + 49.99 WEB',
  )
  assert.equal(result.dailyDifferences[0].varianceCents, -2)
  assertClean()
})

test('unmapped POS net requires a confirmed currency before converting local line_amount', async () => {
  const { selected, configuration } = mappedWizardFixture(true, {
    salesNet: 'absent',
  })
  await assert.rejects(
    accountingEngine().processUploads(selected, SAMPLE_PERIOD, {
      columnMappings: configuration,
    }),
    /POS_CURRENCY_MISSING/,
  )
  assertClean()
})

test('Sales Flash header selection survives wizard confirmation and excludes Excel metadata in DuckDB', async () => {
  const { selected, configuration } = mappedWizardFixture()
  const flash = selected.find((entry) => entry.source === 'Flash')
  const original = XLSX.read(await flash.file.text(), {
    type: 'string',
    raw: true,
  })
  const values = XLSX.utils.sheet_to_json(
    original.Sheets[original.SheetNames[0]],
    { header: 1 },
  )
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      ['Sales Flash report'],
      ['Prepared by', 'Finance'],
      [],
      [],
      ...values,
    ]),
    'Flash',
  )
  flash.file = new File(
    [XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })],
    'Messy Flash.xlsx',
  )
  const store = createAppStore(SAMPLE_PERIOD, { ingestionMode: 'wizard' })
  const decoded = []
  const processor = new ReconciliationEngine(
    database,
    (buffer, signal, headerRow, format) => {
      decoded.push({ headerRow, format })
      return workbookToCSV(buffer, signal, headerRow, format)
    },
    undefined,
    { schemaMode: 'accounting', onWarning() {} },
  )
  store.attachProcessor((files, period, options) =>
    processor.processUploads(files, period, options),
  )
  store.actions.setFiles(selected)
  for (const entry of selected) {
    try {
      store.actions.setFilePreview(
        entry.id,
        entry.file,
        entry.source,
        parseMappingPreview(
          await entry.file.arrayBuffer(),
          entry.file.name.endsWith('.xlsx') ? 'xlsx' : 'csv',
        ),
      )
      store.actions.setColumnMapping(
        entry.id,
        configuration.find((mapping) => mapping.fileId === entry.id).columns,
      )
    } catch (error) {
      assert.equal(entry.source, 'Flash')
      assert.ok(error instanceof HeaderRowError)
      store.actions.setPreviewError(
        entry.id,
        entry.file,
        entry.source,
        error.message,
        'header-row',
      )
    }
  }
  assert.equal(store.getState().mappingDrafts.Flash.errorKind, 'header-row')
  store.actions.setHeaderRow('Flash', 5)
  store.actions.setFilePreview(
    'Flash',
    flash.file,
    'Flash',
    parseMappingPreview(await flash.file.arrayBuffer(), 'xlsx', 5),
  )
  store.actions.setColumnMapping(
    'Flash',
    configuration.find((mapping) => mapping.source === 'Flash').columns,
  )
  store.actions.completeOnboarding()
  await store.whenSettled()
  assert.equal(store.getState().status, 'ready', store.getState().error)
  assert.equal(
    store
      .getState()
      .confirmedMappings.find((mapping) => mapping.source === 'Flash')
      .headerRow,
    5,
  )
  assert.ok(
    decoded.some(
      (request) => request.headerRow === 5 && request.format === 'xlsx',
    ),
  )
  const result = store.getState().reconciliationData
  assert.equal(result.Flash_Sales, 180)
  assert.equal(result.GL_Finance, 150)
  assert.equal(result.Unexplained, 0)
  assert.equal(result.rowCounts.Flash, 1)
  assertClean()
  store.dispose()
})

test('non-default CSV header rows use the same record selection for preview and reconciliation', async () => {
  const { selected, configuration } = mappedWizardFixture()
  const flash = selected.find((entry) => entry.source === 'Flash')
  flash.file = new File(
    [`"Sales\nmetadata"\n\n${await flash.file.text()}`],
    'Messy Flash.csv',
  )
  flash.headerRow = 3
  const preview = parseMappingPreview(await flash.file.arrayBuffer(), 'csv', 3)
  assert.deepEqual(preview.headers, ['Report close', 'Flash total'])
  const result = await accountingEngine().processUploads(
    selected,
    SAMPLE_PERIOD,
    { columnMappings: configuration },
  )
  assert.equal(result.Flash_Sales, 180)
  assert.equal(result.Unexplained, 0)
  assert.equal(result.rowCounts.Flash, 1)
  assertClean()
})

async function webCurrencyWizardFixture(currency, namedUSD = false) {
  const { selected, configuration } = mappedWizardFixture()
  const web = selected.find((entry) => entry.source === 'WEB')
  const mapping = configuration.find((entry) => entry.source === 'WEB')
  const text = await web.file.text()
  let csv = text
    .trimEnd()
    .split('\n')
    .map((line, index) => `${line},${index ? currency : 'currency'}`)
    .join('\n')
  mapping.columns.currency = 'currency'
  if (namedUSD) {
    for (const [field, name] of [
      ['gross_amount', 'Selected gross USD'],
      ['discount', 'Selected discount USD'],
      ['net_amount', 'Selected net USD'],
    ]) {
      csv = csv.replace(mapping.columns[field], name)
      mapping.columns[field] = name
    }
  }
  web.file = new File([csv], 'WEB.csv')
  return { selected, configuration }
}

test('WEB FX guard rejects mapped non-USD generic amounts before producing financial results', async () => {
  const { selected, configuration } = await webCurrencyWizardFixture('EUR')
  let failure
  await assert.rejects(
    accountingEngine().processUploads(selected, SAMPLE_PERIOD, {
      columnMappings: configuration,
      onFailure: (diagnostic) => {
        failure = diagnostic
      },
    }),
    /\[WEB_FX_NOT_SUPPORTED\]/,
  )
  assert.equal(failure.source, 'WEB')
  assert.match(failure.originalMessage, /không thể coi nội tệ là USD/)
  assertClean()
})

test('WEB FX guard accepts explicitly USD mapped amounts when source currency describes non-USD money', async () => {
  const { selected, configuration } = await webCurrencyWizardFixture(
    'EUR',
    true,
  )
  const result = await accountingEngine().processUploads(
    selected,
    SAMPLE_PERIOD,
    { columnMappings: configuration },
  )
  assert.deepEqual(result.rowCounts, { POS: 1, WEB: 1, GL: 1, Flash: 1 })
  assert.equal(result.Flash_Sales, 180)
  assert.equal(result.GL_Finance, 150)
  assert.equal(result.Unexplained, 0)
  assertClean()
})

test('WEB FX guard accepts generic mapped amounts when the source currency is USD', async () => {
  const { selected, configuration } = await webCurrencyWizardFixture('USD')
  const result = await accountingEngine().processUploads(
    selected,
    SAMPLE_PERIOD,
    { columnMappings: configuration },
  )
  assert.equal(result.Flash_Sales, 180)
  assert.equal(result.GL_Finance, 150)
  assert.equal(result.Unexplained, 0)
  assertClean()
})
