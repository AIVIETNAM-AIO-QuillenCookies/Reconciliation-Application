import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  APP_CONVENTION_VALUES,
  ORIGINAL_CONVENTION_DOCUMENT,
  addParagraph,
  changedBlockIds,
  compareWithApplication,
  createConventionController,
  findBlock,
  hasUnexportedConventions,
  hasUnsavedDraft,
  initialConventionState,
  nextVersion,
  parseConventionDocument,
  replaceBlock,
  sectionNumbers,
  serializeConventionDocument,
  tableNumbers,
} from '../src/lib/convention-document.ts'
import { DEFAULT_EXCEPTION_THRESHOLD_CENTS } from '../src/lib/exceptions.ts'
import {
  STORE_MONTH_THRESHOLD_CENTS,
  STORE_MONTH_THRESHOLD_PERCENT,
  storeMonthBreaches,
} from '../src/lib/dashboard-model.ts'
import { REFERENCE_TOLERANCE_USD } from '../src/lib/excel-reference.ts'

const original = ORIGINAL_CONVENTION_DOCUMENT
const clone = (value) => JSON.parse(JSON.stringify(value))
const parameter = (document, id) =>
  findBlock(document, 'thresholds-table').items.find((item) => item.id === id)

test('the original conventions follow the report and contain no placeholders', () => {
  const text = serializeConventionDocument(original)
  assert.doesNotMatch(text, /\[Điền\]|CẦN XÁC NHẬN/)
  assert.equal(original.version, '1.0')
  assert.equal(original.revisions.length, 1)
  assert.equal(original.revisions[0].origin, 'original')
  assert.equal(
    findBlock(original, 'sign-formula').expression,
    'revenue_usd = − amount_usd',
  )
  assert.equal(
    findBlock(original, 'fx-formula').expression,
    'USD = amount_local ÷ usd_to_ccy',
  )
  assert.equal(parameter(original, 'materiality-amount').value, 200)
  assert.equal(parameter(original, 'materiality-percent').value, 1)
  assert.equal(parameter(original, 'rounding').value, 5)
  assert.equal(parameter(original, 'bridge-check').value, 1)
  const steps = findBlock(original, 'bridge-steps').steps
  assert.equal(steps[0].excelCode, 'sales')
  assert.equal(steps.at(-1).excelCode, 'finance')
  assert.equal(steps.length, 13)
  assert.deepEqual(
    original.sections.map((section) => section.content),
    [
      'text',
      'text',
      'text',
      'text',
      'text',
      'text',
      'text',
      'text',
      'text',
      'live',
      'revisions',
    ],
  )
})

test('sections and tables are numbered in reading order like the report', () => {
  const sections = sectionNumbers(original)
  assert.equal(sections.get('scope'), '1.')
  assert.equal(sections.get('recognition'), '3.')
  assert.equal(sections.get('recognition-timing'), '3.1')
  assert.equal(sections.get('recognition-fx'), '3.4')
  assert.equal(sections.get('application'), '6.')
  assert.equal(sections.get('revisions'), '7.')
  const tables = tableNumbers(original)
  assert.deepEqual(
    [...tables.entries()],
    [
      ['scope-sources', 1],
      ['structure-grain', 2],
      ['structure-joins', 3],
      ['timing-table', 4],
      ['journal-types', 5],
      ['thresholds-table', 6],
      ['bridge-steps', 7],
    ],
  )
})

test('application values come from the engine constants, not from the document', () => {
  assert.equal(APP_CONVENTION_VALUES.storeMonthAmountUSD, 200)
  assert.equal(
    APP_CONVENTION_VALUES.storeMonthAmountUSD,
    STORE_MONTH_THRESHOLD_CENTS / 100,
  )
  assert.equal(APP_CONVENTION_VALUES.storeMonthPercent, 1)
  assert.equal(STORE_MONTH_THRESHOLD_PERCENT, 1)
  assert.equal(
    APP_CONVENTION_VALUES.exceptionLogAmountUSD,
    DEFAULT_EXCEPTION_THRESHOLD_CENTS / 100,
  )
  assert.equal(APP_CONVENTION_VALUES.excelBridgeToleranceUSD, 0.01)
  assert.equal(REFERENCE_TOLERANCE_USD, 0.01)
  // Exporting the constants did not change the store-month rule.
  assert.equal(storeMonthBreaches(200.01, 10_000), true)
  assert.equal(storeMonthBreaches(200, 10_000), false)
  assert.equal(storeMonthBreaches(300, 40_000), false)
  assert.equal(storeMonthBreaches(300, 0), false)
  assert.equal(storeMonthBreaches(-250, 20_000), true)
})

test('comparisons follow the edited document value and stay explicit about differences', () => {
  const amount = parameter(original, 'materiality-amount')
  assert.equal(compareWithApplication(amount).status, 'match')
  assert.equal(
    compareWithApplication({ ...amount, value: 300 }).status,
    'differs',
  )
  const percent = parameter(original, 'materiality-percent')
  assert.equal(compareWithApplication(percent).status, 'partial')
  assert.match(compareWithApplication(percent).text, /không xét điều kiện/)
  const bridge = parameter(original, 'bridge-check')
  assert.equal(compareWithApplication(bridge).status, 'stricter')
  assert.equal(
    compareWithApplication({ ...bridge, value: 0.01 }).status,
    'match',
  )
  assert.equal(
    compareWithApplication({ ...bridge, value: 0.001 }).status,
    'differs',
  )
  assert.equal(
    compareWithApplication(parameter(original, 'rounding')).status,
    'not-applied',
  )
  assert.equal(compareWithApplication(parameter(original, 'kpi-percent')), null)
})

test('versions, change detection and paragraphs', () => {
  assert.equal(nextVersion('1.0'), '1.1')
  assert.equal(nextVersion('1.9'), '1.10')
  assert.equal(nextVersion('2.3'), '2.4')
  assert.equal(nextVersion('bad'), '1.1')
  const edited = replaceBlock(original, 'scope', {
    ...findBlock(original, 'scope-intro'),
    text: 'Phạm vi mới.',
  })
  assert.deepEqual([...changedBlockIds(original, edited)], ['scope-intro'])
  const added = addParagraph(edited, 'scope', 'custom-a1')
  assert.deepEqual([...changedBlockIds(original, added)].sort(), [
    'custom-a1',
    'scope-intro',
  ])
  // Live and history sections never receive editable blocks.
  assert.equal(
    findBlock(addParagraph(original, 'application', 'custom-b2'), 'custom-b2'),
    undefined,
  )
})

test('JSON import round-trips and rejects structural or numeric tampering', () => {
  const roundTrip = parseConventionDocument(
    serializeConventionDocument(original),
  )
  assert.equal(roundTrip.ok, true)
  assert.deepEqual(roundTrip.document, original)

  const expectError = (mutate, pattern) => {
    const data = clone(original)
    mutate(data)
    const result = parseConventionDocument(JSON.stringify(data))
    assert.equal(result.ok, false)
    assert.match(result.error, pattern)
  }
  assert.match(parseConventionDocument('{oops').error, /JSON hợp lệ/)
  expectError((data) => (data.schema = 'other'), /không phải tài liệu/)
  expectError((data) => (data.schemaVersion = 2), /chưa được hỗ trợ/)
  expectError((data) => (data.version = 'v2'), /dạng số/)
  expectError((data) => data.sections.pop(), /cấu trúc gốc/)
  expectError(
    (data) => data.sections[0].blocks.splice(0, 1),
    /thiếu khối “scope-intro”/,
  )
  expectError(
    (data) => data.sections[0].blocks[2].columns.pop(),
    /cột của bảng/,
  )
  expectError((data) => {
    data.sections[0].blocks.push({ id: 'evil', kind: 'paragraph', text: 'x' })
  }, /không có trong cấu trúc/)
  expectError((data) => {
    const thresholds = data.sections.find(
      (section) => section.id === 'thresholds',
    )
    thresholds.blocks[1].items[3].value = -5
  }, /số không âm/)
  expectError((data) => {
    const thresholds = data.sections.find(
      (section) => section.id === 'thresholds',
    )
    thresholds.blocks[1].items[3].value = '200'
  }, /số không âm/)
  expectError((data) => (data.revisions = []), /không được để trống/)

  // Custom paragraphs are accepted; fixed mappings follow the original.
  const data = clone(original)
  data.sections[0].blocks.push({
    id: 'custom-x1',
    kind: 'paragraph',
    text: 'Đoạn bổ sung.',
  })
  const bridge = data.sections
    .find((section) => section.id === 'bridge')
    .blocks.find((block) => block.id === 'bridge-steps')
  bridge.steps[1].excelCode = 'FX'
  bridge.steps[1].rawBucket = 'Returns'
  const thresholds = data.sections.find(
    (section) => section.id === 'thresholds',
  )
  delete thresholds.blocks[1].items[3].appKey
  const parsed = parseConventionDocument(data)
  assert.equal(parsed.ok, true)
  assert.equal(findBlock(parsed.document, 'custom-x1').text, 'Đoạn bổ sung.')
  const step = findBlock(parsed.document, 'bridge-steps').steps[1]
  assert.equal(step.excelCode, 'DISCOUNT')
  assert.equal(step.rawBucket, 'Discounts')
  assert.equal(
    parameter(parsed.document, 'materiality-amount').appKey,
    'materiality-amount',
  )
})

test('the session controller drafts, versions, exports and resets without storage', () => {
  let state = initialConventionState()
  const controller = createConventionController(
    () => state,
    (next) => (state = next),
  )
  assert.equal(hasUnexportedConventions(state), false)
  controller.beginConventionEdit()
  assert.equal(state.draft, original)
  assert.equal(hasUnsavedDraft(state), false)
  // Saving an unchanged draft does not create a version.
  assert.equal(
    controller.saveConventionDocument({ note: 'x', author: '', date: 'd' })
      .version,
    '1.0',
  )
  assert.equal(state.draft, null)
  controller.beginConventionEdit()
  const thresholds = findBlock(state.draft, 'thresholds-table')
  controller.updateConventionDraft(
    replaceBlock(state.draft, 'thresholds', {
      ...thresholds,
      items: thresholds.items.map((item) =>
        item.id === 'bridge-check' ? { ...item, value: 0.5 } : item,
      ),
    }),
  )
  assert.equal(hasUnsavedDraft(state), true)
  const saved = controller.saveConventionDocument({
    note: '  Siết ngưỡng cầu nối.  ',
    author: ' Finance ',
    date: '2026-11-16T09:00:00.000Z',
  })
  assert.equal(saved.version, '1.1')
  assert.equal(state.draft, null)
  assert.deepEqual(state.document.revisions.at(-1), {
    version: '1.1',
    date: '2026-11-16T09:00:00.000Z',
    author: 'Finance',
    note: 'Siết ngưỡng cầu nối.',
    origin: 'session',
  })
  assert.equal(parameter(state.document, 'bridge-check').value, 0.5)
  assert.equal(parameter(original, 'bridge-check').value, 1)
  assert.equal(hasUnexportedConventions(state), true)
  controller.markConventionExported()
  assert.equal(hasUnexportedConventions(state), false)
  const exported = serializeConventionDocument(state.document)
  controller.resetConventionDocument()
  assert.equal(state.document, original)
  const imported = parseConventionDocument(exported)
  controller.importConventionDocument(imported.document)
  assert.equal(state.document.version, '1.1')
  assert.equal(hasUnexportedConventions(state), false)
})
