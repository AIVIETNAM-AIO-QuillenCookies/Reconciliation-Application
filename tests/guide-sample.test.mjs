import assert from 'node:assert/strict'
import { before, test } from 'node:test'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import {
  createDuckDB,
  NODE_RUNTIME,
  VoidLogger,
} from '@duckdb/duckdb-wasm/blocking'
import {
  inspectGuideSample,
  loadGuideSample,
  GUIDE_COLUMNS,
  prepareGuideGL,
} from '../src/lib/guide-sample.ts'
import { workbookToCSV, workbookToSheets } from '../src/lib/spreadsheet.ts'
import { sourceRecordRows } from '../src/lib/source-coordinates.ts'
import { parseMappingPreview } from '../src/lib/mapping-preview.ts'
import { ReconciliationEngine } from '../src/lib/ReconciliationEngine.ts'

let sample, bytes, database
before(async () => {
  const raw = await readFile(
    new URL(
      '../public/demo/Nexa_Home_Recon_Dataset_Final.xlsx',
      import.meta.url,
    ),
  )
  bytes = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength)
  sample = await inspectGuideSample(bytes)
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
  database = {
    registerFileText: async (path, text) =>
      bindings.registerFileText(path, text),
    registerFileBuffer: async (path, buffer) =>
      bindings.registerFileBuffer(path, buffer),
    dropFile: async (path) => bindings.dropFile(path),
    connect: async () => {
      const c = bindings.connect()
      return {
        query: async (sql) => c.query(sql),
        close: async () => c.close(),
      }
    },
  }
})

test('production workbook controls preserve scope, formula caches and seven original exception states', () => {
  const { formulas, ...evidence } = sample.evidence
  assert.deepEqual(evidence, {
    posRows: 17124,
    uniquePOSKeys: 17112,
    duplicateGroups: 12,
    duplicateRows: 24,
    excessPOSRows: 12,
    webRows: 9441,
    cancelledAll: 139,
    cancelled2025: 124,
    glRows: 6940,
    manualGL: 15,
    flashRows: 156,
    flashUSD: 31124401,
    glRevenueUSD: 28698496.23,
    qcUnassessed: 26,
  })
  assert.equal(formulas.length, 483)
  assert.match(
    formulas.find((row) => row.sheet === 'QC_Summary' && row.cell === 'C3')
      .formula,
    /COUNTA/,
  )
  assert.deepEqual(
    sample.sourceExceptions.map((row) => row.status),
    [
      'Cần sửa nguồn',
      'Cần đối chiếu',
      'Cần đối chiếu',
      'Cần đối chiếu',
      'Chưa giải thích',
      'Cần xác minh',
      'Đã xác định nguyên nhân, cần xác nhận chứng từ',
    ],
  )
  assert.equal(sample.sourceExceptions[4].impactUSD, 1250)
  assert.equal(new Set(sample.files.map((entry) => entry.file)).size, 1)
})

test('selected worksheet controls actual preview, imported rows and evidence coordinates', async () => {
  const name = '01c_Nguon_GL'
  const preview = parseMappingPreview(bytes, 'xlsx', 1, name)
  assert.equal(preview.headers[0], 'journal_id')
  assert.equal(preview.sheetNames.length, 21)
  const csv = await workbookToCSV(
    bytes,
    undefined,
    1,
    'xlsx',
    name,
    sample.workbook,
  )
  assert.match(csv, /^journal_id,posting_date/)
  assert.match(csv, /JE20250100001,2025-01-01/)
  // Direct decoder injection receives the engine's File context; the cached
  // workbook must be reused rather than interpreting File as a WorkBook.
  assert.equal(
    await workbookToCSV(
      new ArrayBuffer(0),
      undefined,
      1,
      'xlsx',
      name,
      sample.file,
    ),
    csv,
  )
  const dimensions = await workbookToSheets(
    new ArrayBuffer(0),
    undefined,
    1,
    { '01e_Master_Cua_Hang': { headerRow: 1 } },
    sample.file,
  )
  assert.equal(dimensions.length, 1)
  assert.equal(dimensions[0].name, '01e_Master_Cua_Hang')
  assert.match(dimensions[0].csv, /^pos_store_id,finance_store_code/)
  const rows = await sourceRecordRows(sample.file, 1, name)
  assert.equal(rows.length, 6940)
  assert.equal(rows.at(-1), 6941)
  await assert.rejects(
    workbookToCSV(bytes, undefined, 1, 'xlsx', 'missing', sample.workbook),
    /Selected worksheet/,
  )
})

test('actual sample GL uses existing normalization and never inserts manual or catch-up journals', async () => {
  const snapshot = await prepareGuideGL(database, sample)
  assert.equal(snapshot.records.length, 6940)
  const manual = snapshot.records.filter((row) => row.journalType === 'MANUAL')
  assert.equal(manual.length, 15)
  assert.equal(
    manual
      .filter((row) => row.sourceRef?.startsWith('MJ-SHIP'))
      .reduce((sum, row) => sum + row.revenueCents, 0),
    9476695,
  )
  const adj = manual.find((row) => row.journalId === 'JE20250904892')
  assert.equal(adj.amountCents, -125000)
  assert.equal(adj.revenueCents, 125000)
  assert.equal(adj.sourceRow, 4893)
  assert.equal(adj.sheetName, '01c_Nguon_GL')
  const late = snapshot.records.find((row) => row.journalId === 'JE20251206231')
  assert.equal(late.postingDate, '2025-12-02')
})

test('actual Raw engine validates selected sources and joins then stops at unsupported WEB FX', async () => {
  const mappings = sample.files
    .filter((row) => row.source !== 'Dim')
    .map((row) => ({
      fileId: row.id,
      fileName: row.file.name,
      source: row.source,
      columns: GUIDE_COLUMNS[row.source],
      headerRow: 1,
      sheetName: row.sheetName,
      ...(row.source === 'GL' ? { glAmountBasis: 'ledger' } : {}),
    }))
  const engine = new ReconciliationEngine(database, undefined, undefined, {
    onWarning() {},
  })
  let validation
  await engine.processUploads(
    sample.files,
    { start: '2025-01-01', end: '2025-12-31' },
    {
      columnMappings: mappings,
      masterConfiguration: sample.preset,
      validationOnly: true,
      masterFingerprint: 'guide-test',
      onMasterValidation: (value) => {
        validation = value
      },
    },
  )
  assert.equal(validation.passed, true, JSON.stringify(validation))
  let snapshot
  await assert.rejects(
    engine.processUploads(
      sample.files,
      { start: '2025-01-01', end: '2025-12-31' },
      {
        columnMappings: mappings,
        masterConfiguration: sample.preset,
        onGLSnapshot: (value) => {
          snapshot = value
        },
      },
    ),
    /WEB_FX_NOT_SUPPORTED/,
  )
  assert.equal(snapshot.records.length, 6940)
})

test('the guided practice explains a sample download network failure in Vietnamese', async () => {
  const savedFetch = globalThis.fetch
  try {
    globalThis.fetch = async () => {
      throw new TypeError('Failed to fetch')
    }
    await assert.rejects(loadGuideSample(), (error) => {
      assert.equal(
        error.message,
        'Không tải được workbook mẫu, có thể do mất kết nối mạng hoặc máy chủ chưa phản hồi. Kiểm tra mạng rồi thử lại.',
      )
      assert.equal(error.cause.message, 'Failed to fetch')
      return true
    })
    globalThis.fetch = async () => new Response('', { status: 503 })
    await assert.rejects(loadGuideSample(), {
      message: 'Không tải được workbook mẫu (HTTP 503). Hãy thử lại.',
    })
    // Leaving the guide aborts the download; that is not reported as offline.
    const leaving = new AbortController()
    leaving.abort()
    globalThis.fetch = async (_url, { signal }) => signal.throwIfAborted()
    await assert.rejects(loadGuideSample(leaving.signal), {
      name: 'AbortError',
    })
  } finally {
    globalThis.fetch = savedFetch
  }
})
