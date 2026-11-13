import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as XLSX from 'xlsx'
import {
  parseMappingPreview,
  parseDimMappingPreviews,
} from '../src/lib/mapping-preview.ts'
import {
  workbookToCSV,
  workbookToSheets,
  csvFromHeaderRow,
} from '../src/lib/spreadsheet.ts'
import {
  HeaderRowError,
  isValidHeaderRow,
  MAX_HEADER_ROW,
} from '../src/lib/header-row.ts'
import { createAppStore } from '../src/lib/store.ts'
import { onboardingStepReady } from '../src/lib/onboarding.ts'

function flashWorkbook(headerRow = 5) {
  const rows = Array.from({ length: headerRow - 1 }, (_, index) =>
    index === 0
      ? ['Sales flash report']
      : index === 1
        ? ['Generated', '2025-12-31']
        : [],
  )
  rows.push(
    ['month_end_date', 'revenue_usd'],
    ...Array.from({ length: 8 }, (_, index) => [
      `2025-${String(index + 1).padStart(2, '0')}-28`,
      `${index + 1}00.00`,
    ]),
  )
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet(rows),
    'Sales Flash',
  )
  return XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })
}

test('metadata produces a recoverable header warning; selecting row 5 updates headers and sample rows', () => {
  const bytes = flashWorkbook()
  assert.throws(
    () => parseMappingPreview(bytes, 'xlsx'),
    (error) =>
      error instanceof HeaderRowError &&
      /Column B has no header/.test(error.message),
  )
  const preview = parseMappingPreview(bytes, 'xlsx', 5)
  assert.equal(preview.headerRow, 5)
  assert.deepEqual(preview.headers, ['month_end_date', 'revenue_usd'])
  assert.deepEqual(preview.rows[0], ['2025-01-28', '100.00'])
  assert.equal(preview.rows.length, 5)
  assert.equal(preview.hasMoreRows, true)
  assert.equal(preview.sheetName, 'Sales Flash')
})

test('header rows beyond the old seven-row preview window work without a hardcoded offset', () => {
  const preview = parseMappingPreview(flashWorkbook(25), 'xlsx', 25)
  assert.deepEqual(preview.headers, ['month_end_date', 'revenue_usd'])
  assert.equal(preview.headerRow, 25)
  assert.equal(preview.rows.length, 5)
  assert.throws(
    () => parseMappingPreview(flashWorkbook(), 'xlsx', 100),
    HeaderRowError,
  )
})

test('full Excel ingestion starts at the selected header and ignores errors in excluded metadata', async () => {
  const workbook = XLSX.read(flashWorkbook(), { type: 'array' })
  const sheet = workbook.Sheets['Sales Flash']
  sheet.A1 = { t: 'e', v: 7 }
  sheet.A2 = { t: 'n', f: '1+1' }
  const bytes = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })
  const csv = await workbookToCSV(bytes, undefined, 5)
  assert.ok(csv.startsWith('month_end_date,revenue_usd'))
  assert.equal(csv.includes('Generated'), false)
  assert.equal(
    csv.trim().split(/\r?\n/).length,
    9,
    'all eight data rows are processed, beyond the sample',
  )
  sheet.B6 = { t: 'e', v: 7 }
  await assert.rejects(
    workbookToCSV(
      XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }),
      undefined,
      5,
    ),
    /Excel error at B6/,
  )
})

test('metadata-only columns do not become phantom blank headers and spreadsheet coordinates remain correct', async () => {
  const workbook = XLSX.utils.book_new()
  const sheet = XLSX.utils.aoa_to_sheet([
    ['Metadata title', '', '', '', '', 'Printed by Finance'],
    [],
    [],
    [],
  ])
  XLSX.utils.sheet_add_aoa(
    sheet,
    [
      ['month_end_date', 'revenue_usd'],
      ['2025-01-31', '123.45'],
    ],
    { origin: 'B5' },
  )
  XLSX.utils.book_append_sheet(workbook, sheet, 'Flash')
  const bytes = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })
  const preview = parseMappingPreview(bytes, 'xlsx', 5)
  assert.deepEqual(preview.headers, ['month_end_date', 'revenue_usd'])
  assert.equal(preview.startColumn, 1)
  assert.equal(preview.headerRow, 5)
  const csv = await workbookToCSV(bytes, undefined, 5)
  assert.ok(csv.startsWith('month_end_date,revenue_usd'))
  assert.equal(csv.includes('Printed by Finance'), false)
})

test('CSV header selection preserves quoted multiline records, leading zeros, and original values', async () => {
  const bytes = new TextEncoder().encode(
    '"Sales\nmetadata",,\nreceipt,date,amount\n0001,01/31/2025,"1,250.00"',
  ).buffer
  assert.throws(() => parseMappingPreview(bytes, 'csv'), HeaderRowError)
  const preview = parseMappingPreview(bytes, 'csv', 2)
  assert.deepEqual(preview.headers, ['receipt', 'date', 'amount'])
  assert.deepEqual(preview.rows[0], ['0001', '01/31/2025', '1,250.00'])
  const csv = await csvFromHeaderRow(bytes, 2)
  assert.ok(csv.startsWith('receipt,date,amount'))
  assert.equal(csv.includes('metadata'), false)
  assert.deepEqual(
    parseMappingPreview(new TextEncoder().encode(csv).buffer, 'csv').rows[0],
    preview.rows[0],
  )
})

test('Excel preview and ingestion share canonical dates and export times for both workbook calendars', async () => {
  for (const date1904 of [false, true]) {
    const workbook = XLSX.utils.book_new()
    workbook.Workbook = { WBProps: { date1904 } }
    const day = 45688 - (date1904 ? 1462 : 0)
    const sheet = XLSX.utils.aoa_to_sheet([
      ['Metadata'],
      ['receipt_no', 'business_date', 'exported_at', 'line_amount', 'currency'],
      [1, day, day + (10 * 3600 + 15 * 60 + 30.125) / 86400, 65.37, 'AUD'],
    ])
    sheet.A3.z = '00000'
    sheet.B3.z = 'dd/mm/yyyy'
    sheet.C3.z = 'dd/mm/yyyy hh:mm:ss.000'
    sheet.D3.z = '$#,##0.00'
    XLSX.utils.book_append_sheet(workbook, sheet, 'Raw')
    const bytes = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })
    const preview = parseMappingPreview(bytes, 'xlsx', 2)
    assert.equal(preview.rows[0][1], '31/01/2025')
    assert.equal(preview.rows[0][3], '$65.37')
    assert.deepEqual(preview.normalizedRows[0], [
      '00001',
      '2025-01-31',
      '2025-01-31 10:15:30.125',
      '65.37',
      'AUD',
    ])
    const csv = await workbookToCSV(bytes, undefined, 2)
    const ingested = parseMappingPreview(
      new TextEncoder().encode(csv).buffer,
      'csv',
    )
    assert.deepEqual(ingested.rows, preview.normalizedRows)
    assert.deepEqual(ingested.normalizedRows, preview.normalizedRows)
  }
})

test('CSV preview and ingestion preserve the same ambiguous dates and invalid timestamps for SQL validation', async () => {
  const bytes = new TextEncoder().encode(
    'receipt_no;business_date;exported_at;line_amount;discount_amount;currency\n' +
      'R1;01/02/2025;31/01/2025 12:13:14;65,37;7,85;AUD\n' +
      'R2;31/02/2025;not-a-timestamp;0;0;USD',
  ).buffer
  const preview = parseMappingPreview(bytes, 'csv')
  const csv = await csvFromHeaderRow(bytes)
  const ingested = parseMappingPreview(
    new TextEncoder().encode(csv).buffer,
    'csv',
  )
  assert.deepEqual(preview.normalizedRows, preview.rows)
  assert.deepEqual(ingested.rows, preview.rows)
  assert.equal(ingested.rows[1][1], '31/02/2025')
  assert.equal(ingested.rows[1][2], 'not-a-timestamp')
})

test('Master/Dim applies the selected row to every non-empty worksheet', async () => {
  const workbook = XLSX.utils.book_new()
  for (const name of ['dim_store', 'dim_date'])
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([
        ['Metadata'],
        [],
        ['key', 'value'],
        ['001', 'test'],
      ]),
      name,
    )
  const bytes = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })
  const previews = parseDimMappingPreviews(bytes, 'xlsx', 3)
  assert.deepEqual(
    previews.map((preview) => preview.headerRow),
    [3, 3],
  )
  assert.deepEqual(
    previews.map((preview) => preview.headers),
    [
      ['key', 'value'],
      ['key', 'value'],
    ],
  )
  const sheets = await workbookToSheets(bytes, undefined, 3)
  assert.deepEqual(
    sheets.map((sheet) => sheet.name),
    ['dim_store', 'dim_date'],
  )
  assert.ok(sheets.every((sheet) => sheet.csv.startsWith('key,value')))
})

test('per-file header changes clear stale mappings and errors, preserve other files, and reject old preview callbacks', () => {
  const store = createAppStore(undefined, { ingestionMode: 'wizard' })
  const file = {
    id: 'flash',
    source: 'Flash',
    file: new File([flashWorkbook()], 'Flash.xlsx'),
  }
  const other = {
    id: 'other',
    source: 'Flash',
    file: new File(['month_end_date,revenue_usd'], 'Other.csv'),
  }
  store.actions.setFiles([file, other])
  const otherPreview = {
    headers: ['month_end_date', 'revenue_usd'],
    rows: [],
    sheetName: null,
    hasMoreRows: false,
  }
  store.actions.setFilePreview(other.id, other.file, 'Flash', otherPreview)
  const originalOtherDraft = store.getState().mappingDrafts.other
  store.actions.setPreviewError(
    file.id,
    file.file,
    'Flash',
    'Column B has no header',
    'header-row',
  )
  assert.equal(store.getState().mappingDrafts.flash.errorKind, 'header-row')
  store.actions.setHeaderRow(file.id, 5)
  assert.equal(store.getState().mappingDrafts.flash, undefined)
  assert.equal(store.getState().mappingDrafts.other, originalOtherDraft)
  assert.equal(
    onboardingStepReady(
      'Flash',
      store.getState().files,
      store.getState().mappingDrafts,
    ),
    false,
  )
  store.actions.setFilePreview(file.id, file.file, 'Flash', otherPreview)
  store.actions.setPreviewError(
    file.id,
    file.file,
    'Flash',
    'Stale row 1 error',
    'header-row',
    1,
  )
  assert.equal(store.getState().mappingDrafts.flash, undefined)
  const currentPreview = parseMappingPreview(flashWorkbook(), 'xlsx', 5)
  store.actions.setFilePreview(file.id, file.file, 'Flash', currentPreview)
  assert.equal(
    store.getState().mappingDrafts.flash.columns.date,
    'month_end_date',
  )
  assert.equal(
    onboardingStepReady(
      'Flash',
      store.getState().files,
      store.getState().mappingDrafts,
    ),
    true,
  )
  store.actions.confirmMappings()
  assert.equal(
    store.getState().confirmedMappings.find((entry) => entry.fileId === file.id)
      .headerRow,
    5,
  )
  store.actions.setHeaderRow(file.id, 5)
  assert.ok(
    store.getState().confirmedMappings,
    'the same row does not discard valid mappings',
  )
  store.actions.closeOnboarding()
  store.actions.openOnboarding()
  assert.equal(
    store.getState().files.find((entry) => entry.id === file.id).headerRow,
    5,
  )
  store.actions.setHeaderRow(file.id, 12)
  store.actions.setFilePreview(file.id, file.file, 'Flash', currentPreview)
  store.actions.setPreviewError(
    file.id,
    file.file,
    'Flash',
    'Stale row 5 error',
    'header-row',
    5,
  )
  assert.equal(store.getState().confirmedMappings, null)
  assert.equal(store.getState().mappingDrafts.flash, undefined)
  assert.equal(store.getState().mappingDrafts.other, originalOtherDraft)
  store.dispose()
})

test('header row inputs are restricted to positive whole row numbers', () => {
  for (const row of [0, -1, 1.5, NaN, Infinity, MAX_HEADER_ROW + 1]) {
    assert.equal(isValidHeaderRow(row), false)
    assert.throws(
      () => parseMappingPreview(flashWorkbook(), 'xlsx', row),
      RangeError,
    )
  }
  assert.equal(isValidHeaderRow(1), true)
  assert.equal(isValidHeaderRow(MAX_HEADER_ROW), true)
})
