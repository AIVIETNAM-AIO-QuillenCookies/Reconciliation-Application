import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  vi,
  viMessage,
  vt,
  displayValue,
  explainError,
} from '../src/lib/i18n.ts'
import { displayNodeById, displayRuleById } from '../src/lib/localized-model.ts'
import { modelNodes, methodologyRules } from '../src/lib/methodology.ts'

test('Vietnamese display labels preserve technical identifiers, formulas and uploaded values', () => {
  assert.notEqual(vi('Rules & Data Model'), 'Rules & Data Model')
  const file = 'Sales_report-NX007-001.csv'
  const text = vt`Inspect record ${2} from ${file}`
  assert.ok(text.includes(file))
  assert.ok(text.includes('2'))
  assert.equal(viMessage(file), file)
  assert.equal(displayValue('transaction_id', '000123'), '000123')
  assert.equal(displayValue('revenue_usd', '-450.00'), '-450.00')
  assert.notEqual(displayValue('order_status', 'returned'), 'returned')
  for (const rule of methodologyRules) {
    const display = displayRuleById.get(rule.id)
    assert.equal(display.id, rule.id)
    assert.equal(display.technical, rule.technical)
    assert.deepEqual(display.sourceIds, rule.sourceIds)
    assert.deepEqual(display.evidenceTables, rule.evidenceTables)
  }
  for (const node of modelNodes) {
    const display = displayNodeById.get(node.id)
    assert.equal(display.relation, node.relation)
    assert.deepEqual(
      display.fields.map((field) => field.name),
      node.fields.map((field) => field.name),
    )
  }
})

test('POS diagnostics use cause codes and never translate a composite validation error as dates only', () => {
  assert.match(
    explainError(
      'POS requires valid receipt/line/store keys, dates, export timestamps, and non-negative USD amounts. (10058 invalid rows or key groups.)',
    ),
    /từng nguyên nhân.*FX.*USD/,
  )
  assert.match(
    explainError('[POS_FX_MISSING] AUD 2025-06-30'),
    /Thiếu tỷ giá FX/,
  )
  assert.match(
    explainError('[POS_FX_DUPLICATE] AUD 2025-06-30'),
    /Khóa FX bị trùng/,
  )
  assert.match(
    explainError('[POS_POSTING_DATE] bad date'),
    /Ngày hoặc timestamp POS/,
  )
  assert.match(explainError('[POS_LOCAL_AMOUNT] invalid amount'), /Số tiền POS/)
  assert.match(explainError('[POS_USD_INVALID] USD not created'), /USD POS/)
  assert.match(explainError('[POS_STORE_LOOKUP] bad key'), /cửa hàng/)
  assert.match(
    explainError('Use valid ISO dates for the reporting period.'),
    /trọn tháng/,
  )
})

test('WEB and Flash composite validators do not accuse the reporting period', () => {
  const web = explainError(
    'WEB has invalid keys, dates, status, or USD amounts. Returned orders require delivery_date and return_date. (1 invalid rows or key groups.)',
  )
  const flash = explainError(
    'Flash requires a calendar month_end_date and non-negative revenue_usd. (1 invalid rows or key groups.)',
  )
  assert.match(web, /Nguồn WEB.*trạng thái.*số tiền/)
  assert.match(flash, /Nguồn Flash.*doanh thu/)
  assert.doesNotMatch(flash, /chọn trọn tháng/)
  assert.doesNotMatch(
    explainError('A procedure failed while reading period_metadata'),
    /trọn tháng/,
  )
  assert.match(
    explainError('The period end must be on or after its start.'),
    /Ngày kết thúc.*sau ngày bắt đầu/,
  )
})
