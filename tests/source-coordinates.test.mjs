import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as XLSX from 'xlsx'
import { sourceRecordRows } from '../src/lib/source-coordinates.ts'
import { csvFromHeaderRow, workbookToCSV } from '../src/lib/spreadsheet.ts'
import { parseMappingPreview } from '../src/lib/mapping-preview.ts'
import {
  createMasterDraft,
  defaultRelationship,
  masterConfigurationIssues,
} from '../src/lib/master-data.ts'

test('direct CSV coordinates track physical starting lines through quoted newlines and empty lines', async () => {
  const file = new File(
    [
      '\uFEFFreceipt_no,note\r\nA,"two\r\nlines"\r\n\r\nB,"quoted ""note"""\r\n,\r\n',
    ],
    'POS.csv',
  )
  assert.deepEqual(await sourceRecordRows(file, 1), [2, 5, 6])
})

test('selected CSV headers track physical lines while matching blank-row removal during ingestion', async () => {
  const file = new File(
    [
      '"Metadata\ncontinued";;\n\nreceipt_no;note;amount\nA;"two\nlines";10\n\nB;next;20\n;;\n',
    ],
    'POS.csv',
  )
  assert.deepEqual(await sourceRecordRows(file, 3), [5, 8])
  const csv = await csvFromHeaderRow(await file.arrayBuffer(), 3)
  const parsed = parseMappingPreview(
    new TextEncoder().encode(csv).buffer,
    'csv',
  )
  assert.deepEqual(parsed.rows, [
    ['A', 'two\nlines', '10'],
    ['B', 'next', '20'],
  ])
})

test('XLSX coordinates retain actual first-sheet row numbers after blank rows and metadata are removed', async () => {
  const book = XLSX.utils.book_new()
  const sheet = XLSX.utils.aoa_to_sheet([['Metadata', '', '', '', '', 'Title']])
  XLSX.utils.sheet_add_aoa(
    sheet,
    [
      ['receipt_no', 'amount', 'note'],
      ['A', 10, 'two\nlines'],
      [],
      ['B', 0, 'zero is valid'],
      ['', '', ''],
      ['C', 30, 'next'],
    ],
    { origin: 'B5' },
  )
  XLSX.utils.book_append_sheet(book, sheet, 'Raw')
  XLSX.utils.book_append_sheet(
    book,
    XLSX.utils.aoa_to_sheet([['ignored'], ['other']]),
    'Other',
  )
  const file = new File(
    [XLSX.write(book, { type: 'array', bookType: 'xlsx' })],
    'POS.xlsx',
  )
  // Row 7 has no cells and is removed. Explicit string-empty cells on row 9
  // serialize as a delimiter-only imported record and must retain their row.
  assert.deepEqual(await sourceRecordRows(file, 5), [6, 8, 9, 10])
  const csv = await workbookToCSV(await file.arrayBuffer(), undefined, 5)
  assert.equal(
    parseMappingPreview(new TextEncoder().encode(csv).buffer, 'csv').rows
      .length,
    4,
  )
})

test('unrecognized CSV dialects or broken source files do not invent source coordinates', async () => {
  for (const [text, name] of [
    ['receipt,note\nA,"not closed', 'bad.csv'],
    ['sep=;\nreceipt;amount\nA;10', 'directive.csv'],
    ['not a workbook', 'bad.xlsx'],
    ['id\nA', 'single-column.csv'],
    ['id,amount\nA,10', 'unsupported.txt'],
  ])
    assert.equal(await sourceRecordRows(new File([text], name), 1), null, name)
})

test('POS conversion cannot silently select among multiple configured FX relationships for one basis', () => {
  const preview = {
    sheetName: 'FX',
    headers: ['date', 'currency', 'rate'],
    rows: [],
    hasMoreRows: false,
  }
  const config = createMasterDraft('master', [preview])
  for (const ref of Object.values(config.roles)) ref.usage = 'not-used'
  const ref = config.roles.fxDaily
  Object.assign(ref, {
    usage: 'enabled',
    sheetName: 'FX',
    columns: { date: 'date', currency: 'currency', rate: 'rate' },
    relationships: [defaultRelationship('fxDaily')],
  })
  assert.deepEqual(masterConfigurationIssues(config), [])
  ref.relationships.push(defaultRelationship('fxDaily'))
  assert.ok(
    masterConfigurationIssues(config).some((issue) =>
      /one POS relationship/.test(issue),
    ),
  )
  ref.relationships[1].source = 'WEB'
  assert.deepEqual(masterConfigurationIssues(config), [])
})
