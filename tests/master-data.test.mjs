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
import {
  autoMapColumns,
  confirmedMappingSnapshot,
} from '../src/lib/data-mapping.ts'
import {
  parseMappingPreview,
  parseDimMappingPreviews,
} from '../src/lib/mapping-preview.ts'
import {
  createMasterDraft,
  defaultRelationship,
  masterSnapshot,
  masterFingerprint,
  masterConfigurationIssues,
} from '../src/lib/master-data.ts'
import { workbookToSheets } from '../src/lib/spreadsheet.ts'
import { createAppStore } from '../src/lib/store.ts'

const period = { start: '2025-03-01', end: '2025-03-31' }
let bindings, database, engine
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
  database = {
    registerFileText: async (p, s) => bindings.registerFileText(p, s),
    registerFileBuffer: async (p, b) => bindings.registerFileBuffer(p, b),
    dropFile: async (p) => bindings.dropFile(p),
    connect: async () => {
      const c = bindings.connect()
      return {
        query: async (sql) => c.query(sql),
        close: async () => c.close(),
      }
    },
  }
  engine = new ReconciliationEngine(database, undefined, undefined, {
    onWarning() {},
  })
})
function workbook(duplicate = false, badRate = false) {
  const book = XLSX.utils.book_new()
  const sheets = {
    README: [['Instructions'], ['Do not use as a dimension']],
    'Điểm bán bất kỳ': [
      ['metadata'],
      [],
      ['Mã điểm bán', 'Mã sổ cái'],
      ['001', 'FIN'],
      ['002', 'FIN'],
      ...(duplicate ? [['001', 'OTHER']] : []),
    ],
    'Tỷ giá ngày': [
      ['metadata'],
      ['Ngày', 'Tiền tệ', 'Giá'],
      ['2025-03-01', 'CAD', badRate ? 'oops' : 1.4],
      ['2025-03-01', 'EUR', 0.9],
    ],
    'Tỷ giá kỳ': [
      ['metadata'],
      [],
      [],
      ['Kỳ', 'CCY', 'Tỷ giá'],
      ['2025-03', 'CAD', 1.5],
      ['2025-03', 'EUR', 0.95],
    ],
    'Lịch riêng': [
      ['metadata'],
      [],
      [],
      [],
      ['Ngày gốc', 'Ngày ghi nhận'],
      ['2025-03-01', '2025-03-02'],
    ],
    Data_Dictionary: [
      ['Field', 'Meaning'],
      ['ID', 'example'],
    ],
  }
  for (const [name, rows] of Object.entries(sheets))
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), name)
  return new File(
    [XLSX.write(book, { type: 'array', bookType: 'xlsx' })],
    'Master.xlsx',
  )
}
async function setup(options = {}) {
  const selected = [
    {
      id: 'p1',
      source: 'POS',
      file: new File(
        [
          'receipt_no,line_no,store_key,business_date,gross_usd_daily,discount_usd_daily,net_usd_month_end,currency\nA,1,001,2025-03-01,100,10,89,CAD',
        ],
        'POS1.csv',
      ),
    },
    {
      id: 'p2',
      source: 'POS',
      file: new File(
        [
          'Biên lai,Dòng,Chi nhánh,Ngày bán,Tổng,Giảm,Thực thu,Đồng tiền\nB,1,002,2025-03-01,200,20,178,EUR',
        ],
        'POS2.csv',
      ),
    },
    {
      id: 'web',
      source: 'WEB',
      file: new File(
        [
          'web_order_id,store_key,order_date,delivery_date,return_date,order_status,gross_usd_daily,net_usd_month_end,discount_usd_daily',
        ],
        'WEB.csv',
      ),
    },
    {
      id: 'gl',
      source: 'GL',
      file: new File(
        [
          'journal_id,posting_date,store_key,journal_type,amount_usd\nJ1,2025-03-02,FIN,SALE,-267',
        ],
        'GL.csv',
      ),
    },
    {
      id: 'flash',
      source: 'Flash',
      file: new File(
        ['month_end_date,revenue_usd\n2025-03-31,300'],
        'Flash.csv',
      ),
    },
    {
      id: 'master',
      source: 'Dim',
      file: workbook(options.duplicate, options.badRate),
    },
  ]
  const mappings = []
  for (const file of selected.filter((f) => f.source !== 'Dim')) {
    const preview = parseMappingPreview(await file.file.arrayBuffer(), 'csv')
    const columns =
      file.id === 'p2'
        ? {
            transaction_id: 'Biên lai',
            line_no: 'Dòng',
            store_key: 'Chi nhánh',
            date: 'Ngày bán',
            gross_amount: 'Tổng',
            discount: 'Giảm',
            net_amount: 'Thực thu',
            currency: 'Đồng tiền',
          }
        : autoMapColumns(preview.headers, file.source)
    mappings.push({
      fileId: file.id,
      fileName: file.file.name,
      source: file.source,
      columns,
    })
  }
  const buffer = await selected.at(-1).file.arrayBuffer()
  const config = createMasterDraft(
    'master',
    parseDimMappingPreviews(buffer, 'xlsx'),
  )
  for (const [name, row] of Object.entries({
    'Điểm bán bất kỳ': 3,
    'Tỷ giá ngày': 2,
    'Tỷ giá kỳ': 4,
    'Lịch riêng': 5,
  })) {
    const preview = parseDimMappingPreviews(buffer, 'xlsx', row, name)[0]
    config.sheets[name] = { headerRow: row, preview, error: null }
  }
  config.roles.store = {
    usage: 'enabled',
    sheetName: 'Điểm bán bất kỳ',
    columns: { pos_store_id: 'Mã điểm bán', finance_store_code: 'Mã sổ cái' },
    relationships: [defaultRelationship('store')],
  }
  config.roles.calendar = {
    usage: 'enabled',
    sheetName: 'Lịch riêng',
    columns: { date: 'Ngày gốc', posting_date: 'Ngày ghi nhận' },
    relationships: [
      {
        ...defaultRelationship('calendar'),
        purpose: 'calendar-posting',
        outputs: ['posting_date'],
      },
    ],
  }
  config.roles.fxDaily = {
    usage: 'enabled',
    sheetName: 'Tỷ giá ngày',
    columns: { date: 'Ngày', currency: 'Tiền tệ', rate: 'Giá' },
    relationships: [defaultRelationship('fxDaily')],
  }
  config.roles.fxMonthEnd = {
    usage: 'enabled',
    sheetName: 'Tỷ giá kỳ',
    columns: { period: 'Kỳ', currency: 'CCY', rate: 'Tỷ giá' },
    relationships: [defaultRelationship('fxMonthEnd')],
  }
  return { files: selected, mappings, config }
}
async function process(data, extra = {}) {
  return engine.processUploads(data.files, period, {
    columnMappings: data.mappings,
    masterConfiguration: masterSnapshot(data.config),
    ...extra,
  })
}
test('arbitrary sheets, Unicode columns, independent headers, per-file canonical keys and composite FX lookups reach accounting and evidence', async () => {
  const data = await setup()
  assert.deepEqual(masterConfigurationIssues(data.config), [])
  const result = await process(data)
  assert.equal(result.GL_Finance, 267)
  assert.equal(result.Unexplained, -3)
  assert.equal(result.missingGLEntries, 0)
  assert.deepEqual(
    result.dimTables.map((t) => t.name).sort(),
    ['Điểm bán bất kỳ', 'Tỷ giá ngày', 'Tỷ giá kỳ', 'Lịch riêng'].sort(),
  )
  assert.equal(result.evidence.masterJoins.length, 8)
  assert.ok(
    result.evidence.masterJoins.every(
      (j) =>
        j.rowsBefore === j.rowsAfter &&
        j.unmatchedRows === 0 &&
        j.duplicateKeys === 0,
    ),
  )
  const projected = result.evidence.tables.find((t) => t.id === 'raw_pos')
  assert.equal(projected.rows[0].store_key, '001')
  assert.equal(projected.rows[0].posting_date, '2025-03-01')
  const mapped = result.evidence.tables.find((t) => t.id === 'q_POS_Mapped')
  assert.equal(mapped.rows[0].store_key, 'FIN')
  assert.equal(mapped.rows[0].posting_date, '2025-03-02')
  assert.equal(projected.rows[0].net_usd_month_end, '89.00')
  assert.equal(projected.rows[0].master_fxDaily_0_rate, '1.4')
  assert.equal(
    result.evidence.masterConfiguration.roles.store.columns.pos_store_id,
    'Mã điểm bán',
  )
  assert.ok(
    result.evidence.ruleApplications.some(
      (r) => r.id.startsWith('master:') && r.status === 'applied',
    ),
  )
  assert.equal(bindings.globFiles('reconcile_*').length, 0)
})
test('duplicate chosen reference keys block fanout; repeated finance outputs remain valid', async () => {
  const data = await setup({ duplicate: true })
  let validation
  await process(data, {
    validationOnly: true,
    onMasterValidation: (v) => {
      validation = v
    },
  })
  assert.equal(validation.passed, false)
  const store = validation.joins.find(
    (j) => j.role === 'store' && j.fileId === 'p1',
  )
  assert.equal(store.duplicateKeys, 1)
  assert.equal(store.rowsBefore, 1)
  assert.equal(store.rowsAfter, 1)
  await assert.rejects(process(data), /POS_STORE_LOOKUP_DUPLICATE/)
})
test('unmatched rows and samples are real, keep policy preserves rows, and bad FX rate values fail', async () => {
  const data = await setup()
  data.config.roles.store.columns.pos_store_id = 'Mã sổ cái'
  let validation
  await process(data, {
    validationOnly: true,
    onMasterValidation: (v) => {
      validation = v
    },
  })
  assert.equal(validation.passed, false)
  assert.equal(validation.joins[0].unmatchedRows, 1)
  assert.deepEqual(validation.joins[0].unmatchedSamples, ['["001"]'])
  // Unique alternate keys, no matches: keep must retain source rows.
  data.config.roles.store.columns.pos_store_id = 'Mã điểm bán'
  data.config.roles.store.relationships[0].keys[0].sourceField =
    'transaction_id'
  data.config.roles.store.relationships[0].unmatched = 'keep'
  const kept = await process(data)
  assert.equal(kept.rowCounts.POS, 2)
  assert.equal(kept.evidence.masterJoins[0].unmatchedRows, 1)
  await assert.rejects(
    process(await setup({ badRate: true })),
    /POS_FX_DAILY_INVALID/,
  )
})
test('partial roles load only confirmed sheets; full preflight uses the same parser and releases its dimension tables', async () => {
  const data = await setup()
  for (const role of ['calendar', 'fxDaily', 'fxMonthEnd'])
    data.config.roles[role].usage = 'not-used'
  let validation
  const progress = []
  await process(data, {
    validationOnly: true,
    onProgress: (event) => progress.push(event),
    onMasterValidation: (v) => {
      validation = v
    },
  })
  assert.equal(validation.scope, 'full')
  assert.equal(validation.passed, true)
  assert.deepEqual(
    [...new Set(progress.map((event) => event.phase))],
    ['registering', 'dimensions', 'projecting'],
  )
  assert.deepEqual(
    progress.flatMap((event) => event.joins ?? []),
    validation.joins,
  )
  assert.equal(progress.at(-1).status, 'completed')
  const c = bindings.connect()
  assert.equal(
    c
      .query(
        "SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema='dim'",
      )
      .toArray()[0].n,
    0n,
  )
  c.close()
  const result = await process(data)
  assert.deepEqual(
    result.dimTables.map((t) => t.name),
    ['Điểm bán bất kỳ'],
  )
  const decoded = await workbookToSheets(
    await data.files.at(-1).file.arrayBuffer(),
    undefined,
    1,
    { 'Điểm bán bất kỳ': { headerRow: 3 } },
  )
  assert.ok(decoded[0].csv.includes('001,FIN'))
  await engine.processUploads([], period)
})
test('FX composite duplicates, blank keys and incompatible key types fail on full data', async () => {
  for (const change of ['duplicate', 'blank', 'bad-date']) {
    const data = await setup()
    const f = data.files.at(-1)
    const book = XLSX.read(await f.file.arrayBuffer(), { type: 'array' })
    const sheet = book.Sheets['Tỷ giá ngày']
    if (change === 'duplicate')
      XLSX.utils.sheet_add_aoa(sheet, [['2025-03-01', 'CAD', 1.7]], {
        origin: -1,
      })
    if (change === 'blank') sheet.B3 = { t: 's', v: '' }
    if (change === 'bad-date') sheet.A3 = { t: 's', v: 'not a date' }
    f.file = new File(
      [XLSX.write(book, { type: 'array', bookType: 'xlsx' })],
      'Master.xlsx',
    )
    let validation
    await process(data, {
      validationOnly: true,
      onMasterValidation: (v) => {
        validation = v
      },
    })
    assert.equal(validation.passed, false, change)
    const report = validation.joins.find((j) => j.role === 'fxDaily')
    assert.equal(report.duplicateKeys, change === 'duplicate' ? 1 : 0)
    if (change === 'blank') assert.equal(report.blankReferenceKeys, 1)
    if (change === 'bad-date') assert.equal(report.invalidReferenceKeys, 1)
  }
})
test('missing columns or worksheets and absent per-file source mappings never fall back to guessed names', async () => {
  for (const change of ['sheet', 'column', 'source']) {
    const data = await setup()
    if (change === 'sheet') {
      data.config.sheets.Missing = { headerRow: 1 }
      data.config.roles.store.sheetName = 'Missing'
    }
    if (change === 'column')
      data.config.roles.store.columns.pos_store_id = 'does not exist'
    if (change === 'source')
      delete data.mappings.find((m) => m.fileId === 'p2').columns.currency
    await assert.rejects(process(data), /no longer exists|map currency/)
    assert.equal(bindings.globFiles('reconcile_*').length, 0)
  }
})
test('quoted sheet/column identifiers and numeric Excel identifier masks agree between preview and full ingestion', async () => {
  const data = await setup()
  const f = data.files.at(-1)
  const book = XLSX.read(await f.file.arrayBuffer(), { type: 'array' })
  const original = 'Điểm bán bất kỳ',
    renamed = 'Store "team\'s" data'
  const sheet = book.Sheets[original]
  sheet.A3 = { t: 's', v: 'Mã "điểm"' }
  sheet.A4 = { t: 'n', v: 1, z: '000' }
  sheet.A5 = { t: 'n', v: 2, z: '000' }
  delete book.Sheets[original]
  book.Sheets[renamed] = sheet
  book.SheetNames = book.SheetNames.map((n) => (n === original ? renamed : n))
  f.file = new File(
    [XLSX.write(book, { type: 'array', bookType: 'xlsx' })],
    'Master.xlsx',
  )
  data.config.sheets[renamed] = data.config.sheets[original]
  delete data.config.sheets[original]
  data.config.roles.store.sheetName = renamed
  data.config.roles.store.columns.pos_store_id = 'Mã "điểm"'
  const preview = parseDimMappingPreviews(
    await f.file.arrayBuffer(),
    'xlsx',
    3,
    renamed,
  )[0]
  assert.equal(preview.rows[0][0], '001')
  const result = await process(data)
  assert.equal(result.missingGLEntries, 0)
  assert.equal(result.evidence.masterJoins[0].unmatchedRows, 0)
})
test('explicit surrogate calendar keys resolve dates and recognition periods without altering USD accounting', async () => {
  const data = await setup()
  for (const f of data.files.filter((f) => f.source === 'POS'))
    f.file = new File(
      [(await f.file.text()).replace('2025-03-01', 'DAY-1')],
      f.file.name,
    )
  const f = data.files.at(-1)
  const book = XLSX.read(await f.file.arrayBuffer(), { type: 'array' })
  book.Sheets['Lịch riêng'] = XLSX.utils.aoa_to_sheet([
    ['metadata'],
    [],
    [],
    [],
    ['Mã ngày', 'Ngày thật', 'Ngày ghi nhận'],
    ['DAY-1', '2025-03-01', '2025-03-02'],
  ])
  f.file = new File(
    [XLSX.write(book, { type: 'array', bookType: 'xlsx' })],
    'Master.xlsx',
  )
  const key = { sourceField: 'date', referenceField: 'date_key', type: 'text' }
  data.config.roles.calendar.columns = {
    date_key: 'Mã ngày',
    date: 'Ngày thật',
    posting_date: 'Ngày ghi nhận',
  }
  data.config.roles.calendar.relationships = [
    {
      ...defaultRelationship('calendar'),
      purpose: 'calendar-date',
      keys: [key],
      outputs: ['date'],
      dateTarget: 'date',
    },
    {
      ...defaultRelationship('calendar'),
      purpose: 'calendar-posting',
      keys: [key],
      outputs: ['posting_date'],
    },
  ]
  const result = await process(data)
  assert.equal(result.missingGLEntries, 0)
  assert.equal(result.Unexplained, -3)
  assert.equal(
    result.evidence.tables.find((t) => t.id === 'q_POS_Mapped').rows[0]
      .business_date,
    '2025-03-01',
  )
  assert.ok(
    result.evidence.masterJoins.every(
      (j) => j.unmatchedRows === 0 && j.rowsBefore === j.rowsAfter,
    ),
  )
})
test('Not used never activates a familiar sheet name or changes the no-Master accounting baseline', async () => {
  const data = await setup({ duplicate: true })
  const f = data.files.at(-1)
  const book = XLSX.read(await f.file.arrayBuffer(), { type: 'array' })
  book.Sheets.dim_store = book.Sheets['Điểm bán bất kỳ']
  delete book.Sheets['Điểm bán bất kỳ']
  book.SheetNames = book.SheetNames.map((n) =>
    n === 'Điểm bán bất kỳ' ? 'dim_store' : n,
  )
  f.file = new File(
    [XLSX.write(book, { type: 'array', bookType: 'xlsx' })],
    'Master.xlsx',
  )
  data.config.roles.store.usage = 'not-used'
  data.config.roles.store.sheetName = 'dim_store'
  data.config.roles.fxDaily.usage = 'not-used'
  data.config.roles.fxMonthEnd.usage = 'not-used'
  data.config.roles.calendar.relationships[0].purpose = 'validate'
  data.config.roles.calendar.relationships[0].outputs = ['date']
  const configured = await process(data)
  const baseline = await engine.processUploads(
    data.files.filter((f) => f.source !== 'Dim'),
    period,
    { columnMappings: data.mappings, masterConfiguration: null },
  )
  assert.deepEqual(configured.cents, baseline.cents)
  assert.equal(configured.Unexplained, baseline.Unexplained)
  assert.deepEqual(
    configured.dimTables.map((t) => t.name),
    ['Lịch riêng'],
  )
  assert.equal(
    configured.evidence.ruleApplications.find((r) => r.id === 'store-lookup')
      .status,
    'not-applicable',
  )
})
test('shared sheet headers invalidate only affected mappings; stale preview/validation and workbook replacements cannot restore confirmation', async () => {
  const data = await setup()
  const store = createAppStore(period, { ingestionMode: 'wizard' })
  store.actions.setFiles(data.files)
  for (const f of data.files) {
    if (f.source === 'Dim') {
      store.actions.setFilePreview(
        f.id,
        f.file,
        'Dim',
        Object.values(data.config.sheets)[0].preview,
        Object.values(data.config.sheets).map((s) => s.preview),
      )
    } else {
      store.actions.setFilePreview(
        f.id,
        f.file,
        f.source,
        parseMappingPreview(await f.file.arrayBuffer(), 'csv'),
      )
      store.actions.setColumnMapping(
        f.id,
        data.mappings.find((m) => m.fileId === f.id).columns,
      )
    }
  }
  for (const [role, ref] of Object.entries(data.config.roles))
    store.actions.setMasterReference('master', role, ref)
  for (const [name, sheet] of Object.entries(data.config.sheets)) {
    store.actions.setMasterSheetHeader('master', name, sheet.headerRow)
    store.actions.setMasterSheetPreview(
      'master',
      data.files.at(-1).file,
      name,
      sheet.headerRow,
      sheet.preview,
    )
  }
  for (const [role, ref] of Object.entries(data.config.roles))
    store.actions.setMasterReference('master', role, ref)
  const snapshot = store.getState()
  const fingerprint = masterFingerprint(
    snapshot.mappingDrafts.master.master,
    snapshot.files,
    confirmedMappingSnapshot(snapshot.files, snapshot.mappingDrafts),
  )
  let validation
  await process(data, {
    validationOnly: true,
    masterFingerprint: fingerprint,
    onMasterValidation: (v) => {
      validation = v
    },
  })
  store.actions.setMasterValidation('master', validation)
  store.actions.completeOnboarding()
  assert.ok(store.getState().confirmedMaster)
  const unaffected = store.getState().mappingDrafts.master.master.roles.fxDaily
  store.actions.setMasterSheetHeader('master', 'Điểm bán bất kỳ', (n) => n + 1)
  store.actions.setMasterSheetHeader('master', 'Điểm bán bất kỳ', (n) => n + 1)
  assert.equal(
    store.getState().mappingDrafts.master.master.sheets['Điểm bán bất kỳ']
      .headerRow,
    5,
  )
  assert.deepEqual(
    store.getState().mappingDrafts.master.master.roles.store.columns,
    {},
  )
  assert.equal(
    store.getState().mappingDrafts.master.master.roles.fxDaily,
    unaffected,
  )
  assert.equal(store.getState().confirmedMaster, null)
  store.actions.setMasterValidation('master', validation)
  assert.equal(
    store.getState().mappingDrafts.master.masterValidation,
    undefined,
  )
  store.actions.setMasterSheetPreview(
    'master',
    data.files.at(-1).file,
    'Điểm bán bất kỳ',
    3,
    data.config.sheets['Điểm bán bất kỳ'].preview,
  )
  assert.equal(
    store.getState().mappingDrafts.master.master.sheets['Điểm bán bất kỳ']
      .preview,
    null,
  )
  store.actions.setFiles(
    data.files.map((f) =>
      f.source === 'Dim' ? { ...f, file: workbook() } : f,
    ),
  )
  assert.equal(store.getState().mappingDrafts.master, undefined)
  assert.throws(() => store.actions.completeOnboarding())
  store.actions.setFiles(data.files.filter((f) => f.source !== 'Dim'))
  assert.doesNotThrow(() => store.actions.completeOnboarding())
  store.dispose()
})
