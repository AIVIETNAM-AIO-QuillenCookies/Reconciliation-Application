import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import * as XLSX from 'xlsx'
import {
  createGuideReferenceFile,
  GUIDE_REFERENCE_OPTIONS,
} from '../src/lib/guide-reference.ts'
import {
  parseExcelReference,
  selectExcelReference,
  sumReferenceUSD,
} from '../src/lib/excel-reference.ts'
import { buildDashboardModel } from '../src/lib/dashboard-model.ts'

const source = XLSX.read(
  await readFile(
    new URL(
      '../public/demo/Nexa_Home_Recon_Dataset_Final.xlsx',
      import.meta.url,
    ),
  ),
  { type: 'array', cellFormula: true },
)
const file = createGuideReferenceFile(source)
const workbook = await parseExcelReference(
  await file.arrayBuffer(),
  file.name,
  undefined,
  GUIDE_REFERENCE_OPTIONS,
)
const year = { start: '2025-01-01', end: '2025-12-31' }
const close = (actual, expected, tolerance = 0.000001) =>
  assert.ok(Math.abs(actual - expected) < tolerance, `${actual} vs ${expected}`)

test('guide reference keeps every cached bridge value and original financial discrepancy', () => {
  assert.equal(workbook.bridgeRows.length, 15)
  for (const [index, row] of workbook.bridgeRows.entries()) {
    const physicalRow = index + 8
    assert.equal(
      row.label,
      source.Sheets['04a_Cau_noi_Flash_GL'][`B${physicalRow}`].v,
    )
    assert.equal(row.values.Source_Sheet, '04a_Cau_noi_Flash_GL')
    assert.equal(row.values.Source_Row, physicalRow)
    for (const [monthIndex, month] of workbook.months.entries()) {
      const address = XLSX.utils.encode_cell({
        r: physicalRow - 1,
        c: monthIndex + 2,
      })
      assert.equal(
        row.monthly[month],
        source.Sheets['04a_Cau_noi_Flash_GL'][address].v,
      )
    }
    assert.equal(
      row.annual,
      source.Sheets['04a_Cau_noi_Flash_GL'][`O${physicalRow}`].v,
    )
  }
  const result = selectExcelReference(workbook, year)
  close(result.salesUSD, 31_124_401)
  close(result.financeUSD, 28_698_496.23)
  close(result.shippingUSD, 94_766.95)
  close(result.unexplainedUSD, 1250)
  close(result.bridgeResidualUSD, -0.03182728)
  assert.equal(
    workbook.checks.find((row) => row.id === 'bridge-annual').passed,
    false,
  )
  assert.equal(
    workbook.checks.find((row) => row.id === 'source-check-2025-05').passed,
    false,
  )
  assert.equal(source.Sheets['04a_Cau_noi_Flash_GL'].C26.v, 0.1)
  assert.equal(workbook.toleranceUSD, 0.01)
  assert.equal(
    workbook.bridgeRows.some((row) => /balanc|bù trừ/i.test(row.label)),
    false,
  )
})

test('only seven source exceptions are carried over, including all unresolved statuses and original fields', () => {
  const original = XLSX.utils.sheet_to_json(
    source.Sheets['05_Nhat_ky_ngoai_le'],
  )
  assert.deepEqual(
    workbook.exceptions.map((row) => row.id),
    original.map((row) => row['Mã']),
  )
  for (const [index, row] of workbook.exceptions.entries()) {
    for (const [key, value] of Object.entries(original[index])) {
      assert.equal(row.values[key === 'Kỳ' ? 'Kỳ nguồn' : key], value)
    }
    assert.equal(row.status, original[index]['Trạng thái'])
    assert.equal(row.values.Source_Sheet, '05_Nhat_ky_ngoai_le')
    assert.equal(row.values.Source_Row, index + 2)
  }
  assert.equal(
    workbook.exceptions.find((row) => row.id === 'EX-05').status,
    'Chưa giải thích',
  )
  assert.deepEqual(
    workbook.exceptions.find((row) => row.id === 'EX-06').months,
    ['2025-11', '2025-12'],
  )
  assert.equal(
    workbook.exceptions.find((row) => row.id === 'EX-07').impactUSD,
    0,
  )
  const count = workbook.checks.find((row) => row.id === 'control-exceptions')
  assert.equal(count.expectedUSD, 7)
  assert.equal(count.passed, true)
})

test('quality counts and journal traces come from real normalized source rows', () => {
  const details = (code) => workbook.details.filter((row) => row.code === code)
  assert.equal(details('CANCEL').length, 124)
  assert.equal(
    new Set(details('CANCEL').map((row) => row.transactionId)).size,
    124,
  )
  assert.equal(
    XLSX.utils
      .sheet_to_json(source.Sheets['01b_Nguon_WEB'])
      .filter((row) => row.order_status === 'Cancelled').length,
    139,
  )
  assert.equal(details('DUP_POS').length, 12)
  assert.equal(details('SHIP').length, 12)
  close(sumReferenceUSD(details('SHIP').map((row) => row.usd)), 94_766.95)
  assert.equal(details('UNEXPLAINED').length, 1)
  assert.equal(details('UNEXPLAINED')[0].transactionId, 'JE20250904892')
  assert.equal(details('UNEXPLAINED')[0].usd, 1250)
  for (const row of workbook.details.filter((row) => row.transactionId)) {
    assert.ok(source.Sheets[row.values.Source_Sheet])
    assert.ok(
      Number.isInteger(row.values.Source_Row) && row.values.Source_Row >= 2,
    )
    assert.match(row.sourceLine, /dòng/)
  }
  const model = buildDashboardModel({
    source: 'excel',
    workbook,
    filters: {
      startMonth: '2025-01',
      endMonth: '2025-12',
      channel: 'ALL',
      country: 'ALL',
    },
  })
  assert.equal(model.quality.cancelledOrders, 124)
  assert.equal(model.quality.removedDuplicateLines, 12)
})

test('aggregate drill-down never pretends to contain transactions and retains precise source cell links', () => {
  const aggregates = workbook.details.filter((row) => !row.transactionId)
  assert.equal(aggregates.length, 72)
  for (const row of aggregates) {
    assert.match(row.values.Loai_bang, /Tổng hợp tháng/)
    assert.match(row.sourceLine, /không phải giao dịch/)
    assert.equal(
      row.usd,
      source.Sheets[row.values.Source_Sheet][row.values.Source_Cell].v,
    )
  }
})

test('missing cached financial cells and missing source exceptions fail instead of becoming zero or passed', () => {
  const broken = {
    ...source,
    Sheets: {
      ...source.Sheets,
      '04a_Cau_noi_Flash_GL': {
        ...source.Sheets['04a_Cau_noi_Flash_GL'],
        C8: { t: 's', v: '' },
      },
    },
  }
  assert.throws(() => createGuideReferenceFile(broken), /thiếu kết quả số/)
  const missing = { ...source, Sheets: { ...source.Sheets } }
  delete missing.Sheets['05_Nhat_ky_ngoai_le']
  assert.throws(() => createGuideReferenceFile(missing), /thiếu sheet/)
})

test('all four Nexa dashboards use complete prepared data and scope months and channels consistently', () => {
  const filters = {
    startMonth: '2025-01',
    endMonth: '2025-12',
    channel: 'ALL',
    country: 'ALL',
  }
  const model = buildDashboardModel({ source: 'excel', workbook, filters })
  assert.equal(model.detail.available, true)
  assert.equal(model.detail.cellCount, 5120)
  assert.equal(model.detail.stores.length, 57)
  assert.equal(model.detail.cells.length, 2)
  assert.equal(model.detail.onlineTrend.length, 12)
  close(model.quality.returnRate, 0.022105699218560867)
  assert.equal(model.quality.validations.length, 41)
  assert.equal(
    model.quality.validations.filter((row) => row.status === 'Chưa đánh giá')
      .length,
    26,
  )
  assert.equal(model.matrix.length, 5)
  close(
    sumReferenceUSD(
      model.matrix
        .filter((row) => row.id.startsWith('gl-'))
        .map((row) => row.totalUSD),
    ),
    model.totals.glUSD,
  )
  const julyWeb = buildDashboardModel({
    source: 'excel',
    workbook,
    filters: {
      ...filters,
      startMonth: '2025-07',
      endMonth: '2025-07',
      channel: 'WEB',
    },
  })
  close(julyWeb.quality.returnRate, 0.04202006512340929)
  assert.equal(julyWeb.quality.cancelledOrders, 9)
  assert.equal(julyWeb.quality.removedDuplicateLines, null)
  assert.equal(julyWeb.detail.cellCount, null)
  assert.equal(julyWeb.detail.onlineTrend.length, 1)
  assert.ok(julyWeb.totals.flashUSD > 0)
  assert.equal(
    julyWeb.totals.deltaUSD,
    julyWeb.totals.glUSD - julyWeb.totals.flashUSD,
  )
  assert.equal(
    julyWeb.bridge.length,
    0,
    'workbook supplies no adjustment bridge by channel',
  )
  assert.equal(
    julyWeb.quality.validations.length,
    41,
    'QC source scope remains the whole workbook',
  )
  const store = buildDashboardModel({
    source: 'excel',
    workbook,
    filters: { ...filters, channel: 'STORE' },
  })
  assert.equal(store.quality.returnsUSD, null)
  assert.equal(store.quality.removedDuplicateLines, 12)
  assert.equal(store.detail.onlineDeltaUSD, null)
  assert.equal(store.detail.cellCount, 5120)
  const unallocated = buildDashboardModel({
    source: 'excel',
    workbook,
    filters: { ...filters, channel: 'UNALLOCATED' },
  })
  assert.equal(unallocated.totals.glUSD, 1250)
  assert.equal(unallocated.totals.flashUSD, null)
  assert.equal(unallocated.totals.deltaUSD, null)
  assert.equal(model.bridge[0].sourceRows[0].sheetName, '04a_Cau_noi_Flash_GL')
  assert.equal(model.bridge[0].sourceRows[0].sourceRow, 8)
})
