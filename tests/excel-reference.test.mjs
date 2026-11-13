import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import * as XLSX from 'xlsx'
import {
  parseExcelReference,
  referenceDetailsFor,
  referencePeriodMonths,
  selectExcelReference,
  sumReferenceUSD,
} from '../src/lib/excel-reference.ts'

// This is the actual workbook supplied by the user, copied unchanged for the app.
const bytes = await readFile(
  new URL('../public/reference/excel-reference.xlsx', import.meta.url),
)
const fileName = 'bang-cau-noi&nhat-ki-ngoai-le (1).xlsx'
const workbook = await parseExcelReference(bytes, fileName)
const year = { start: '2025-01-01', end: '2025-12-31' }
const month = (value) => ({ start: `${value}-01`, end: `${value}-28` })
const close = (actual, expected, tolerance = 0.000001) =>
  assert.ok(
    Math.abs(actual - expected) < tolerance,
    `Expected ${actual} to be within ${tolerance} of ${expected}`,
  )

function changedWorkbook(change) {
  const copy = XLSX.read(bytes, { type: 'array' })
  // Keep one real detail record for targeted validation tests; no invented totals.
  const data = XLSX.utils.sheet_to_json(copy.Sheets.Chi_tiet, { header: 1 })
  copy.Sheets.Chi_tiet = XLSX.utils.aoa_to_sheet(data.slice(0, 2))
  change(copy)
  return XLSX.write(copy, { type: 'array', bookType: 'xlsx' })
}

test('real workbook imports all three sources with original provenance and no FX conversion', () => {
  assert.equal(workbook.fileName, fileName)
  assert.equal(workbook.bridgeRows.length, 15)
  assert.equal(workbook.exceptions.length, 10)
  assert.equal(workbook.details.length, 39_062)
  assert.equal(workbook.sheets.Chi_tiet.skippedHeaderRows.length, 11)
  assert.equal(workbook.details[0].sourceRow, 2)
  assert.equal(workbook.details[0].values.Tien_te, 'EUR')
  assert.equal(workbook.details[0].values.Ty_gia_ngay, 0.91508)
  assert.equal(workbook.details[0].usd, -228.97451588932114)
  assert.equal(
    workbook.details.some((row) => row.code === 'Ma_khoan'),
    false,
  )
  assert.deepEqual(
    workbook.bridgeRows.map((row) => row.kind),
    [
      'sales',
      ...Array(11).fill('adjustment'),
      'bridge_total',
      'finance',
      'check',
    ],
  )
  assert.equal(workbook.checks.length, 58)
  assert.deepEqual(
    workbook.checks.filter((row) => !row.passed),
    [],
  )
  assert.equal(workbook.toleranceUSD, 0.01)
})

test('year KPIs come from the 12 monthly source columns; Cả năm is a control only', () => {
  const result = selectExcelReference(workbook, year)
  close(result.salesUSD, 31_124_401)
  close(result.financeUSD, 28_698_496.23)
  close(result.varianceUSD, 2_425_904.77)
  close(result.shippingUSD, 94_766.95)
  close(result.unexplainedUSD, 1250)
  close(result.bridgeResidualUSD, 0)
  const discount = result.bridgeRows.find((row) =>
    row.detailCodes.includes('DISCOUNT'),
  )
  close(discount.amountUSD, -1_834_297.4729808571)
  assert.notEqual(
    discount.amountUSD,
    Math.round(discount.amountUSD * 100) / 100,
  )
})

test('each monthly and annual bridge adjustment is supported by its USD detail column', () => {
  for (const bridge of workbook.bridgeRows.filter(
    (row) => row.detailCodes.length,
  )) {
    const details = referenceDetailsFor(workbook, bridge.id, year)
    assert.ok(details.length, bridge.label)
    for (const sourceMonth of workbook.months) {
      close(
        sumReferenceUSD(
          details
            .filter((row) => row.month === sourceMonth)
            .map((row) => row.usd),
        ),
        bridge.monthly[sourceMonth],
      )
    }
    close(sumReferenceUSD(details.map((row) => row.usd)), bridge.annual)
  }
  const rounding = workbook.details.find((row) => row.code === 'ROUND')
  assert.equal(rounding.values.USD_bao_cao, 108469)
  assert.equal(rounding.values.USD_chinh_xac, 108468.61975486974)
  assert.equal(rounding.usd, -0.38024513026175555)
  const shipping = workbook.bridgeRows.find((row) =>
    row.detailCodes.includes('SHIP'),
  )
  assert.equal(referenceDetailsFor(workbook, shipping.id, year).length, 12)
})

test('period selection retains offsets, unexplained position and multi-month exception scopes', () => {
  const may = selectExcelReference(workbook, month('2025-05'))
  const june = selectExcelReference(workbook, month('2025-06'))
  const september = selectExcelReference(workbook, month('2025-09'))
  const timing = (result) =>
    result.bridgeRows.find((row) => row.detailCodes.includes('POS_TIMING'))
      .amountUSD
  close(timing(may), -41_464.784472934276)
  close(timing(june), 41_464.784472934276)
  assert.ok(may.exceptions.some((row) => row.id === 'EX-03'))
  assert.ok(june.exceptions.some((row) => row.id === 'EX-03'))
  assert.equal(
    june.exceptions.find((row) => row.id === 'EX-03').periodLabel,
    '05-06/2025',
  )
  close(may.unexplainedUSD, 0)
  close(september.unexplainedUSD, 1250)
  const ex05 = september.exceptions.find((row) => row.id === 'EX-05')
  assert.equal(ex05.status, 'Cần chứng từ')
  assert.equal(ex05.owner, 'Finance')
  assert.equal(ex05.resolution, 'Xin chứng từ và phê duyệt ADJ-0925.')
  const detail = september.details.find((row) => row.code === 'UNEXPLAINED')
  assert.equal(detail.transactionId, 'JE20250904892')
  assert.match(detail.sourceLine, /ADJ-0925/)
  for (const sourceMonth of workbook.months) {
    const result = selectExcelReference(workbook, month(sourceMonth))
    assert.deepEqual(result.months, [sourceMonth])
    assert.ok(result.details.every((row) => row.month === sourceMonth))
    assert.ok(
      result.exceptions.every((row) => row.months.includes(sourceMonth)),
    )
    assert.ok(result.exceptions.some((row) => row.id === 'EX-10'))
    close(result.bridgeResidualUSD, 0)
  }
})

test('unavailable or reversed periods do not expose a different source or annual data', () => {
  for (const period of [
    { start: '2026-01-01', end: '2026-12-31' },
    { start: '2025-12-31', end: '2025-01-01' },
    { start: '', end: '' },
  ]) {
    const result = selectExcelReference(workbook, period)
    assert.equal(result.available, false)
    assert.equal(result.salesUSD, 0)
    assert.deepEqual(result.details, [])
    assert.deepEqual(result.exceptions, [])
    assert.deepEqual(result.checks, [])
  }
})

test('a changed annual control never doubles results or changes monthly amounts', async () => {
  const result = await parseExcelReference(
    changedWorkbook((copy) => {
      copy.Sheets.Cau_noi.N2.v = 1
    }),
    fileName,
  )
  const selection = selectExcelReference(result, year)
  close(selection.salesUSD, 31_124_401)
  assert.equal(result.bridgeRows[0].annual, 1)
  assert.equal(
    result.checks.find((row) => row.id === 'annual-bridge-2').passed,
    false,
  )
})

test('arithmetic mismatches remain visible without generated balancing adjustments', async () => {
  const result = await parseExcelReference(
    changedWorkbook((copy) => {
      copy.Sheets.Cau_noi.B15.v += 25
    }),
    fileName,
  )
  const selection = selectExcelReference(result, month('2025-01'))
  close(selection.bridgeResidualUSD, -25)
  assert.equal(result.bridgeRows.length, workbook.bridgeRows.length)
  assert.equal(
    result.checks.find((row) => row.id === 'bridge-2025-01').passed,
    false,
  )
  close(selection.unexplainedUSD, 0)
})

test('corrupt files, missing sheets, invalid numeric cells and ambiguous periods fail explicitly', async () => {
  await assert.rejects(
    parseExcelReference(new Uint8Array([1, 2, 3]), fileName),
    /XLSX/,
  )
  await assert.rejects(
    parseExcelReference(
      changedWorkbook((copy) => {
        delete copy.Sheets.Cau_noi
      }),
      fileName,
    ),
    /Cau_noi/,
  )
  await assert.rejects(
    parseExcelReference(
      changedWorkbook((copy) => {
        copy.Sheets.Cau_noi.B2 = { t: 's', v: 'oops' }
      }),
      fileName,
    ),
    /dòng 2, 2025-01/,
  )
  assert.throws(
    () => referencePeriodMonths('05-13/2025', workbook.months),
    /không ánh xạ/,
  )
  assert.deepEqual(
    referencePeriodMonths('2025-05 – 2025-06', workbook.months),
    ['2025-05', '2025-06'],
  )
})

test('stage callbacks describe import independently of the Raw pipeline', async () => {
  const stages = []
  await parseExcelReference(
    changedWorkbook(() => {}),
    fileName,
    (stage) => stages.push(stage),
  )
  assert.deepEqual(stages, ['read', 'validate', 'prepare'])
})
