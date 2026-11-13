import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  buildERPReviewCSV,
  buildExceptionMailto,
  exceptionActionLabel,
  filterExceptions,
} from '../src/lib/exceptions.ts'
import { mockExceptions } from './fixtures/exceptions.ts'

test('keeps the three supplied cases and their exact signs, counts, and references', () => {
  const duplicate = mockExceptions.find((row) => row.id === 'EXC-001')
  assert.equal(duplicate.storeKey, 'NX007')
  assert.equal(duplicate.date.slice(5), '03-29')
  assert.equal(duplicate.duplicateLineCount, 12)
  assert.equal(duplicate.deltaCents, 1_262_200)
  const missing = mockExceptions.find((row) => row.id === 'EXC-002')
  assert.equal(missing.storeKey, 'NX057')
  assert.equal(missing.date.slice(5), '11-21')
  assert.equal(missing.deltaCents, 722_800)
  const manual = mockExceptions.find((row) => row.reference === 'ADJ-0925')
  assert.equal(manual.deltaCents, -125_000)
  assert.equal(manual.storeKey, null)
})

test('uses a strict absolute threshold, excluding equality for both signs', () => {
  const base = mockExceptions[0]
  const rows = [-20001, -20000, 0, 20000, 20001].map((deltaCents, i) => ({
    ...base,
    id: String(i),
    deltaCents,
  }))
  assert.deepEqual(
    filterExceptions(rows).map((row) => row.deltaCents),
    [-20001, 20001],
  )
  assert.throws(
    () => filterExceptions(rows, { thresholdCents: -1 }),
    /Threshold/,
  )
})

test('combines case-insensitive search tokens with category and threshold filters', () => {
  assert.deepEqual(
    filterExceptions(mockExceptions, {
      query: ' nx007 DATA error ',
      category: 'Data Error',
    }).map((row) => row.id),
    ['EXC-001'],
  )
  assert.deepEqual(
    filterExceptions(mockExceptions, { query: 'ADJ-0925' }).map(
      (row) => row.id,
    ),
    ['EXC-003'],
  )
  assert.equal(
    filterExceptions(mockExceptions, { query: 'NX057', category: 'Data Error' })
      .length,
    0,
  )
  assert.equal(
    filterExceptions(mockExceptions, { query: 'not-a-store' }).length,
    0,
  )
})

test('sorts by magnitude or date without mutating the input order', () => {
  const original = mockExceptions.map((row) => row.id)
  const ascending = filterExceptions(mockExceptions, {
    sort: { key: 'impact', direction: 'asc' },
  })
  assert.equal(ascending[0].id, 'EXC-009')
  assert.equal(ascending.at(-1).id, 'EXC-001')
  assert.equal(
    filterExceptions(mockExceptions, {
      sort: { key: 'date', direction: 'desc' },
    })[0].id,
    'EXC-002',
  )
  assert.deepEqual(
    mockExceptions.map((row) => row.id),
    original,
  )
})

test('dispatches contextual actions and builds a draft without inventing recipients', () => {
  assert.equal(
    exceptionActionLabel(mockExceptions[0]),
    'Generate IT Ticket (Email)',
  )
  assert.equal(exceptionActionLabel(mockExceptions[1]), 'Export CSV for ERP')
  assert.equal(
    exceptionActionLabel(mockExceptions[2]),
    'Send inquiry to Finance',
  )
  const draft = new URL(buildExceptionMailto(mockExceptions[0], true))
  assert.equal(draft.protocol, 'mailto:')
  assert.equal(draft.pathname, '')
  assert.deepEqual([...draft.searchParams.keys()], ['subject', 'body'])
  assert.match(
    draft.searchParams.get('subject'),
    /\[SAMPLE\].*Duplicate POS.*NX007/,
  )
  assert.match(draft.searchParams.get('body'), /Duplicate lines: 12/)
  assert.match(draft.searchParams.get('body'), /\+\$12,622\.00/)
  const finance = new URL(buildExceptionMailto(mockExceptions[2]))
  assert.match(finance.searchParams.get('body'), /ADJ-0925/)
  assert.match(finance.searchParams.get('body'), /-\$1,250\.00/)
  assert.throws(() => buildExceptionMailto(mockExceptions[1]), /ERP CSV/)
})

test('encodes email fields so user text cannot introduce an extra recipient header', () => {
  const row = {
    ...mockExceptions[0],
    reference: 'A&B?\r\nBcc=someone@example.com',
    description: 'A&B? #100%\nCafé đối soát',
  }
  const draft = new URL(buildExceptionMailto(row))
  assert.deepEqual([...draft.searchParams.keys()], ['subject', 'body'])
  assert.doesNotMatch(draft.searchParams.get('subject'), /[\r\n]/)
  assert.match(draft.searchParams.get('body'), /Café đối soát/)
})

test('CSV review export preserves signed cents, quotes text, and neutralizes spreadsheet formulas', () => {
  const row = {
    ...mockExceptions[2],
    storeKey: '=SUM(1,2)',
    description: 'A "quoted", multiline\r\ncase',
  }
  const csv = buildERPReviewCSV([row], true)
  assert.ok(csv.startsWith('\uFEFFrecord_type,'))
  assert.match(csv, /"'\=SUM\(1,2\)"/)
  assert.match(csv, /,-1250\.00,"USD",/)
  assert.match(csv, /"A ""quoted"", multiline\r\ncase"/)
  assert.match(csv, /"DRAFT_REVIEW_REQUIRED","SAMPLE"/)
  const selected = filterExceptions(mockExceptions, { category: 'Missing GL' })
  const allFiltered = buildERPReviewCSV(selected)
  assert.equal(allFiltered.split('\r\n').length - 2, selected.length)
  assert.doesNotMatch(allFiltered, /ADJ-0925/)
})
