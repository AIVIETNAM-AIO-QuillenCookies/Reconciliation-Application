import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as XLSX from 'xlsx'
import {
  autoMapColumns,
  canConfirmMappings,
  confirmedMappingSnapshot,
  MAPPING_FIELDS,
  mappingIssues,
  normalizeHeader,
  effectiveGLAmountBasis,
} from '../src/lib/data-mapping.ts'
import { parseMappingPreview } from '../src/lib/mapping-preview.ts'
import { createAppStore } from '../src/lib/store.ts'

const posHeaders = [
  'receipt_no',
  'posting_date',
  'line_amount',
  'discount_usd_daily',
  'net_usd_month_end',
  'store_key',
  'line_no',
]
const preview = (headers = posHeaders) => ({
  headers,
  rows: [['R-001', '01/31/2025', '125.00', '5.00', '120.00', 'S01', '01']],
  sheetName: null,
  hasMoreRows: false,
})
const queued = (id = 'pos', source = 'POS') => ({
  id,
  source,
  file: new File(['sample'], `${id}.csv`),
})
const draft = (headers = posHeaders, source = 'POS') => ({
  preview: preview(headers),
  error: null,
  columns: autoMapColumns(headers, source),
})
const buffer = (csv) => new TextEncoder().encode(csv).buffer

test('smart defaults recognize production aliases, case, punctuation, and camelCase', () => {
  assert.deepEqual(autoMapColumns(posHeaders, 'POS'), {
    transaction_id: 'receipt_no',
    date: 'posting_date',
    gross_amount: 'line_amount',
    discount: 'discount_usd_daily',
    net_amount: 'net_usd_month_end',
    store_key: 'store_key',
    line_no: 'line_no',
  })
  const headers = [
    'TransactionID',
    'Posting Date',
    'Gross-Amount',
    'Discount',
    'Net Amount',
  ]
  assert.deepEqual(autoMapColumns(headers, 'WEB'), {
    transaction_id: headers[0],
    date: headers[1],
    gross_amount: headers[2],
    discount: headers[3],
    net_amount: headers[4],
  })
  assert.equal(normalizeHeader('  GROSS_Amount ($)  '), 'gross amount')
})

test('fuzzy matching accepts small typos and leaves unrelated or ambiguous columns unmapped', () => {
  assert.equal(
    autoMapColumns(['transacton_id'], 'POS').transaction_id,
    'transacton_id',
  )
  assert.deepEqual(
    autoMapColumns(['unrelated_id', 'batch_code', 'something_else'], 'POS'),
    {},
  )
  assert.equal(
    autoMapColumns(['net_amunt', 'net_amont'], 'POS').net_amount,
    undefined,
  )
  const defaults = autoMapColumns(['amount', 'line_amount'], 'POS')
  assert.equal(
    new Set(Object.values(defaults)).size,
    Object.values(defaults).length,
  )
})

test('POS Raw local gross and discount map with currency without requiring precomputed USD net', () => {
  const headers = [
    'receipt_no',
    'line_no',
    'business_date',
    'store_id',
    'line_amount',
    'discount_amount',
    'currency',
    'exported_at',
  ]
  const mapped = autoMapColumns(headers, 'POS')
  assert.equal(mapped.gross_amount, 'line_amount')
  assert.equal(mapped.discount, 'discount_amount')
  assert.equal(mapped.currency, 'currency')
  assert.equal(mapped.net_amount, undefined)
  assert.deepEqual(mappingIssues('POS', draft(headers)), [])
  assert.equal(canConfirmMappings([queued()], { pos: draft(headers) }), true)
  const withNet = [...headers, 'net_usd_month_end']
  assert.equal(autoMapColumns(withNet, 'POS').net_amount, 'net_usd_month_end')
})

test('ledger and monthly summaries require fields at their actual grain', () => {
  assert.deepEqual(
    autoMapColumns(['journal_id', 'posting_date', 'amount_usd'], 'GL'),
    {
      transaction_id: 'journal_id',
      date: 'posting_date',
      net_amount: 'amount_usd',
    },
  )
  assert.deepEqual(autoMapColumns(['month_end_date', 'revenue_usd'], 'Flash'), {
    date: 'month_end_date',
    gross_amount: 'revenue_usd',
  })
  assert.equal(MAPPING_FIELDS.GL.filter((field) => !field.optional).length, 4)
  assert.equal(
    MAPPING_FIELDS.GL.find((field) => field.id === 'store_key').optional,
    true,
    'GL may retain a valid unallocated journal without inventing a store',
  )
  assert.equal(
    MAPPING_FIELDS.Flash.filter((field) => !field.optional).length,
    2,
  )
})

test('GL sign basis comes from explicit configuration or the selected source-field contract', () => {
  assert.equal(effectiveGLAmountBasis({ net_amount: 'amount_usd' }), 'ledger')
  assert.equal(effectiveGLAmountBasis({ net_amount: 'revenue_usd' }), 'revenue')
  assert.equal(effectiveGLAmountBasis({ net_amount: 'Revenue USD' }), 'revenue')
  assert.equal(
    effectiveGLAmountBasis({ net_amount: 'revenue_usd' }, 'ledger'),
    'ledger',
  )
  assert.equal(
    effectiveGLAmountBasis({ net_amount: 'Amount' }, 'revenue'),
    'revenue',
  )
  const selected = queued('gl', 'GL')
  const glDraft = draft(
    ['journal_id', 'posting_date', 'journal_type', 'revenue_usd'],
    'GL',
  )
  glDraft.columns.net_amount = 'revenue_usd'
  const inferred = confirmedMappingSnapshot([selected], { gl: glDraft })[0]
  assert.equal(inferred.glAmountBasis, 'revenue')
  glDraft.glAmountBasis = 'ledger'
  const explicit = confirmedMappingSnapshot([selected], { gl: glDraft })[0]
  assert.equal(explicit.glAmountBasis, 'ledger')
})

test('sales net is optional, still auto-suggested, and invalid selections still require correction', () => {
  for (const source of ['POS', 'WEB']) {
    assert.equal(
      MAPPING_FIELDS[source].find((field) => field.id === 'net_amount')
        .optional,
      true,
    )
    for (const header of ['net_amount', 'Net Sales'])
      assert.equal(autoMapColumns([header], source).net_amount, header)
    const headers = MAPPING_FIELDS[source]
      .filter((field) => !field.optional)
      .map((field) => field.aliases[0])
    const incomplete = draft(headers, source)
    assert.equal(incomplete.columns.net_amount, undefined)
    assert.deepEqual(mappingIssues(source, incomplete), [])
    assert.equal(
      canConfirmMappings([queued('sales', source)], { sales: incomplete }),
      true,
    )
    incomplete.columns.net_amount = 'nonexistent_net'
    assert.deepEqual(mappingIssues(source, incomplete), ['net_amount'])
    assert.equal(
      canConfirmMappings([queued('sales', source)], { sales: incomplete }),
      false,
    )
  }
  assert.notEqual(
    MAPPING_FIELDS.GL.find((field) => field.id === 'net_amount').optional,
    true,
  )
  const glHeaders = ['journal_id', 'posting_date', 'store_key', 'journal_type']
  assert.deepEqual(mappingIssues('GL', draft(glHeaders, 'GL')), ['net_amount'])
})

test('confirmation checks every uploaded file, unassigned sources, invalid headers, and duplicate mappings', () => {
  const first = queued()
  const second = queued('pos-2')
  assert.equal(canConfirmMappings([], {}), false)
  assert.equal(canConfirmMappings([first], { pos: draft() }), true)
  assert.equal(canConfirmMappings([first, second], { pos: draft() }), false)
  assert.equal(
    canConfirmMappings([first, queued('unknown', '')], { pos: draft() }),
    false,
  )
  assert.equal(
    canConfirmMappings([first, queued('dim', 'Dim')], { pos: draft() }),
    true,
  )
  assert.equal(canConfirmMappings([queued('dim', 'Dim')], {}), false)
  const invalid = draft()
  invalid.columns.date = 'missing_header'
  assert.deepEqual(mappingIssues('POS', invalid), ['date'])
  invalid.columns.date = invalid.columns.transaction_id
  assert.deepEqual(mappingIssues('POS', invalid), ['date'])
  invalid.error = 'Unreadable file'
  assert.equal(canConfirmMappings([first], { pos: invalid }), false)
  assert.throws(
    () => confirmedMappingSnapshot([first], {}),
    /every required field/,
  )
  const drafts = { pos: draft(), 'pos-2': draft() }
  const snapshot = confirmedMappingSnapshot([first, second], drafts)
  assert.deepEqual(
    snapshot.map((entry) => entry.fileId),
    ['pos', 'pos-2'],
  )
  assert.equal(snapshot[0].source, 'POS')
  drafts.pos.columns.date = 'changed'
  assert.equal(snapshot[0].columns.date, 'posting_date')
})

test('CSV preview preserves date strings, leading zeros, quoted commas, newlines, and UTF-8', () => {
  const parsed = parseMappingPreview(
    buffer(
      '\uFEFFid,date,amount,note\r\n0001,01/31/2025,"1,250.00","Café, shop"\r\n0002,2025-01-31,100,"two\nlines"',
    ),
    'csv',
  )
  assert.deepEqual(parsed.headers, ['id', 'date', 'amount', 'note'])
  assert.deepEqual(parsed.rows[0], [
    '0001',
    '01/31/2025',
    '1,250.00',
    'Café, shop',
  ])
  assert.deepEqual(parsed.rows[1], ['0002', '2025-01-31', '100', 'two\nlines'])
  assert.equal(parsed.sheetName, null)
  assert.equal(
    parseMappingPreview(buffer('name,amount\nCafé € Việt Nam,12.50'), 'csv')
      .rows[0][0],
    'Café € Việt Nam',
  )
})

test('CSV preview detects semicolon exports and returns at most five original rows', () => {
  const parsed = parseMappingPreview(
    buffer(
      'id;date;amount\n' +
        Array.from(
          { length: 12 },
          (_, index) => `${index};31/01/2025;12,50`,
        ).join('\n'),
    ),
    'csv',
  )
  assert.deepEqual(parsed.headers, ['id', 'date', 'amount'])
  assert.equal(parsed.rows.length, 5)
  assert.equal(parsed.rows[0][2], '12,50')
  assert.equal(parsed.hasMoreRows, true)
})

test('XLSX preview uses the first worksheet and preserves Excel display formats', () => {
  const workbook = XLSX.utils.book_new()
  const sheet = XLSX.utils.aoa_to_sheet([
    ['receipt_no', 'posting_date', 'line_amount'],
    [1, 45688, 1200.5],
    ...Array.from({ length: 8 }, (_, index) => [index + 2, 45688, 50]),
  ])
  sheet.A2.z = '00000'
  sheet.B2.z = 'mm/dd/yyyy'
  sheet.C2.z = '$#,##0.00'
  XLSX.utils.book_append_sheet(workbook, sheet, 'POS January')
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([['ignored']]),
    'Second sheet',
  )
  const parsed = parseMappingPreview(
    XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }),
    'xlsx',
  )
  assert.equal(parsed.sheetName, 'POS January')
  assert.deepEqual(parsed.headers, [
    'receipt_no',
    'posting_date',
    'line_amount',
  ])
  assert.deepEqual(parsed.rows[0], ['00001', '01/31/2025', '$1,200.50'])
  assert.equal(parsed.rows.length, 5)
  assert.equal(parsed.hasMoreRows, true)
})

test('unreadable, empty, blank-header and duplicate-header files fail visibly; header-only exports remain mappable', () => {
  assert.throws(
    () => parseMappingPreview(buffer('not a workbook'), 'xlsx'),
    /not a valid XLSX/,
  )
  assert.throws(() => parseMappingPreview(buffer(''), 'csv'), /empty|headers/)
  assert.throws(
    () => parseMappingPreview(buffer('id,,amount\n1,2,3'), 'csv'),
    /no header/,
  )
  assert.throws(
    () => parseMappingPreview(buffer('id, ID ,amount\n1,2,3'), 'csv'),
    /Duplicate header/,
  )
  const parsed = parseMappingPreview(buffer('id,date,amount'), 'csv')
  assert.equal(parsed.rows.length, 0)
  assert.equal(parsed.hasMoreRows, false)
})

test('mapping review keeps the existing SQL paused and confirmation stores an independent payload', async () => {
  const store = createAppStore(undefined, { ingestionMode: 'mapping-preview' })
  let calls = 0
  store.attachProcessor(async () => {
    calls++
    return null
  })
  const file = queued()
  store.actions.setFiles([file])
  await store.whenSettled()
  assert.equal(calls, 0)
  assert.equal(store.getState().status, 'waiting')
  assert.equal(store.getState().canViewReconciliation, false)
  assert.throws(() => store.actions.confirmMappings(), /every required field/)
  store.actions.setFilePreview(file.id, file.file, file.source, preview())
  store.actions.confirmMappings()
  assert.equal(
    store.getState().confirmedMappings[0].columns.gross_amount,
    'line_amount',
  )
  await store.whenSettled()
  assert.equal(
    calls,
    0,
    'UI-only confirmation must not run SQL that ignores custom mappings',
  )
  const changed = {
    ...store.getState().mappingDrafts.pos.columns,
    date: undefined,
  }
  store.actions.setColumnMapping(file.id, changed)
  assert.equal(store.getState().confirmedMappings, null)
  assert.equal(
    canConfirmMappings(store.getState().files, store.getState().mappingDrafts),
    false,
  )
  store.dispose()
})

test('source edits, replacement, clearing, and stale previews cannot reuse an old confirmation', () => {
  const store = createAppStore(undefined, { ingestionMode: 'mapping-preview' })
  const file = queued()
  store.actions.setFiles([file])
  store.actions.setFilePreview(file.id, file.file, file.source, preview())
  store.actions.confirmMappings()
  const second = queued('pos-2')
  store.actions.setFiles([file, second])
  assert.equal(store.getState().confirmedMappings, null)
  assert.ok(store.getState().mappingDrafts.pos.preview)
  store.actions.setFiles([{ ...file, source: 'WEB' }])
  assert.deepEqual(store.getState().mappingDrafts, {})
  store.actions.setFilePreview(file.id, file.file, 'POS', preview())
  assert.deepEqual(
    store.getState().mappingDrafts,
    {},
    'ignore late preview for a previous source',
  )
  store.actions.setFiles([
    { ...file, file: new File(['replacement'], 'pos.csv') },
  ])
  store.actions.setFilePreview(file.id, file.file, 'POS', preview())
  assert.deepEqual(
    store.getState().mappingDrafts,
    {},
    'ignore late preview for a replaced file',
  )
  store.actions.setFiles([])
  store.actions.setPreviewError(file.id, file.file, 'POS', 'Late error')
  assert.deepEqual(store.getState().mappingDrafts, {})
  assert.equal(store.getState().confirmedMappings, null)
  store.dispose()
})
