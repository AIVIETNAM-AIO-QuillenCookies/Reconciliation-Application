import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import * as XLSX from 'xlsx'
import {
  EXCEL_DASHBOARD_SHEETS,
  readExcelDashboard,
} from '../src/lib/excel-dashboard.ts'

const workbook = XLSX.read(
  await readFile(
    new URL(
      '../docs/source/Nexa_Home_Recon_Dataset_Final.xlsx',
      import.meta.url,
    ),
  ),
  { type: 'array', cellFormula: true },
)
const dashboard = readExcelDashboard(workbook)
const year = (rows) => rows.filter((row) => row.month.startsWith('2025-'))
const sum = (values) => values.reduce((total, value) => total + value, 0)
const close = (actual, expected, tolerance = 0.000001) =>
  assert.ok(Math.abs(actual - expected) < tolerance, `${actual} vs ${expected}`)

test('Excel quality uses the PDF daily-USD basis and event dates over the complete dataset', () => {
  const quality = year(dashboard.quality)
  assert.equal(quality.length, 12)
  close(sum(quality.map((row) => row.returnsUSD)), 349148.2292053123)
  close(sum(quality.map((row) => row.deliveredUSD)), 15794489.27415754)
  close(
    sum(quality.map((row) => row.returnsUSD)) /
      sum(quality.map((row) => row.deliveredUSD)),
    0.022105699218560867,
  )
  assert.equal(sum(quality.map((row) => row.cancelledOrders)), 124)
  assert.equal(sum(quality.map((row) => row.removedDuplicateLines)), 12)
  assert.deepEqual(
    quality.map((row) => row.cancelledOrders),
    [8, 14, 5, 7, 13, 8, 9, 9, 6, 18, 13, 14],
  )
  close(
    quality.find((row) => row.month === '2025-07').returnRate,
    0.04202006512340929,
  )
  assert.match(dashboard.rules.join(' '), /net_usd_daily/)
})

test('Excel detail derives every store-day from full normalized data and retains physical source cells', () => {
  assert.ok(dashboard.cells.length > 5000)
  const cells = dashboard.cells.filter((row) => row.date.startsWith('2025-'))
  const caughtUp = cells.find(
    (row) => row.storeKey === '570' && row.date === '2025-12-02',
  )
  const late = cells.find(
    (row) => row.storeKey === '570' && row.date === '2025-11-21',
  )
  assert.equal(caughtUp.hasGL, true)
  assert.equal(late.hasGL, false)
  close(caughtUp.glUSD, 7227.56)
  assert.ok(late.expectedUSD > 7000)
  close(sum(cells.map((row) => row.glUSD)), 13185378.25)
  const headers = new Map(
    EXCEL_DASHBOARD_SHEETS.map((name) => [
      name,
      XLSX.utils.sheet_to_json(workbook.Sheets[name], {
        header: 1,
        range: 'A1:S1',
      })[0],
    ]),
  )
  for (const cell of cells) {
    assert.ok(cell.sources.length > 0)
    for (const source of cell.sources) {
      assert.ok(Number.isInteger(source.sourceRow) && source.sourceRow >= 2)
      assert.ok(headers.get(source.sheetName)?.includes(source.field))
    }
  }
})

test('Excel online GL excludes manual shipping and uses delivery less return journals', () => {
  close(
    sum(year(dashboard.online).map((row) => row.glUSD)),
    15766167.26 - 349066.23,
  )
  close(
    sum(year(dashboard.online).map((row) => row.recognizedUSD)),
    15766167.193480209 - 349066.19530742615,
  )
  assert.match(dashboard.rules.join(' '), /WEB_DELIVERY và WEB_RETURN/)
  assert.equal(dashboard.manuals.length, 15)
  close(sum(dashboard.manuals.map((row) => row.revenueUSD)), 96016.95)
  const transfer = dashboard.manuals.filter(
    (row) => row.sourceRef === 'MJ-RCL-2506',
  )
  assert.equal(transfer.length, 2)
  assert.equal(sum(transfer.map((row) => row.revenueUSD)), 0)
  assert.equal(
    dashboard.manuals.find((row) => row.sourceRef === 'MJ-ADJ-2509').revenueUSD,
    1250,
  )
})

test('Excel preview includes supplied channel totals and preserves unfinished QC cells', () => {
  close(
    sum(year(dashboard.flashChannels).map((row) => row.revenueUSD)),
    31124401,
  )
  close(
    sum(year(dashboard.glChannels).map((row) => row.revenueUSD)),
    28698496.23,
  )
  assert.deepEqual(dashboard.sourceSheets, [...EXCEL_DASHBOARD_SHEETS])
  assert.equal(
    dashboard.validations.filter((row) => row.status === 'Pass').length,
    15,
  )
  assert.ok(dashboard.validations.filter((row) => !row.status).length > 15)
  const uniqueWEB = dashboard.validations.find((row) =>
    row.label.includes('Khóa web_order_id duy nhất'),
  )
  assert.equal(uniqueWEB.count, null)
  assert.equal(uniqueWEB.actual, null)
  assert.equal(uniqueWEB.status, '')
  const missingGL = dashboard.validations.find((row) =>
    row.label.includes('Số mã bút toán thiếu'),
  )
  assert.equal(missingGL.actual, 0)
  assert.equal(missingGL.count, null)
  assert.equal(missingGL.status, '')
  const actualGL = dashboard.validations.find((row) =>
    row.label.includes('Tổng amount_usd'),
  )
  assert.equal(actualGL.actual, -28698496.23)
  assert.equal(actualGL.sourceSheet, 'QC_Summary')
  assert.ok(actualGL.sourceRow >= 2)
})

test('missing normalized inputs fail instead of manufacturing healthy zeros', () => {
  const missing = { ...workbook, Sheets: { ...workbook.Sheets } }
  delete missing.Sheets['02b_Web_chuan_hoa']
  assert.throws(
    () => readExcelDashboard(missing),
    /thiếu sheet 02b_Web_chuan_hoa/,
  )
  const broken = {
    ...workbook,
    Sheets: {
      ...workbook.Sheets,
      '02a_POS_chuan_hoa': {
        ...workbook.Sheets['02a_POS_chuan_hoa'],
        O2: { t: 's', v: '' },
      },
    },
  }
  assert.throws(
    () => readExcelDashboard(broken),
    /thiếu số hợp lệ ở net_usd_daily/,
  )
  assert.equal(workbook.Sheets['02a_POS_chuan_hoa'].O2.t, 'n')
})
