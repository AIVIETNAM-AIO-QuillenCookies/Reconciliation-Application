import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  completeCorrectionPreview,
  previewCorrection,
  synchronizeReviewCases,
} from '../src/lib/accounting-review.ts'

const period = { start: '2025-09-01', end: '2025-09-30' }
const record = {
  id: 'gl:one',
  sourceFingerprint: 'source',
  configurationVersion: 'config',
  fileId: 'GL',
  fileName: 'Ledger.csv',
  sheetName: 'GL',
  sourceRow: 2,
  journalId: 'J1',
  journalType: 'POS_DAILY',
  postingDate: '2025-09-05',
  period: '2025-09',
  storeKey: 'S01',
  storeCode: 'S01',
  channel: 'STORE',
  amountCents: -10000,
  revenueCents: 10000,
  sourceRef: 'POS1',
  description: 'Daily sales',
  amountBasis: 'ledger',
  raw: { amount: '-100.00' },
  original: {
    postingDate: '2025-09-05',
    period: '2025-09',
    storeKey: 'S01',
    channel: 'STORE',
    amountCents: -10000,
    revenueCents: 10000,
  },
  staleCorrection: false,
}
const snapshot = {
  runId: 'run',
  records: [record],
  transformations: [],
  diagnostics: [],
  configurationVersion: 'config',
  complete: true,
  expectedDaily: [
    { storeKey: 'S01', postingDate: '2025-09-05', revenueCents: 10000 },
  ],
}

test('allocation preview includes newly missing GL rather than claiming a zero residual delta', () => {
  const draft = previewCorrection(
    record,
    { storeKey: 'S02' },
    'Allocation proof',
    period,
  )
  const exact = completeCorrectionPreview(draft, snapshot, period)
  assert.equal(exact.complete, true)
  assert.equal(exact.totalGLDeltaCents, 0)
  assert.equal(exact.unexplainedDeltaCents, 10000)
  assert.equal(record.storeKey, 'S01')
})

test('moving a sole journal out of period previews GL and missing-GL bridge together', () => {
  const draft = previewCorrection(
    record,
    { postingDate: '2025-10-01' },
    'Posting evidence',
    period,
  )
  const exact = completeCorrectionPreview(draft, snapshot, period)
  assert.equal(exact.totalGLDeltaCents, -10000)
  assert.equal(exact.unexplainedDeltaCents, 0)
  assert.equal(exact.after.period, '2025-10')
  assert.equal(exact.patch.period, '2025-10')
})

test('a remaining zero-value journal still counts as a present GL group in preview', () => {
  const withOther = {
    ...snapshot,
    records: [
      record,
      {
        ...record,
        id: 'gl:zero',
        journalId: 'ZERO',
        amountCents: 0,
        revenueCents: 0,
      },
    ],
  }
  const draft = previewCorrection(
    record,
    { storeKey: 'S02' },
    'Allocation proof',
    period,
  )
  assert.equal(
    completeCorrectionPreview(draft, withOther, period).unexplainedDeltaCents,
    0,
  )
})

test('blocked or partial snapshots never advertise complete preview totals', () => {
  const draft = previewCorrection(
    record,
    { amountCents: -11000 },
    'Evidence',
    period,
  )
  assert.equal(
    completeCorrectionPreview(draft, { ...snapshot, complete: false }, period)
      .complete,
    false,
  )
  assert.equal(
    completeCorrectionPreview(
      draft,
      { ...snapshot, expectedDaily: undefined },
      period,
    ).complete,
    false,
  )
})

test('a correction on an otherwise valid system journal creates a persistent review audit case', () => {
  assert.equal(synchronizeReviewCases(snapshot).length, 0)
  const forced = synchronizeReviewCases(snapshot, [], [record.id])
  assert.equal(forced.length, 1)
  assert.deepEqual(forced[0].recordIds, [record.id])
  const rerun = synchronizeReviewCases({ ...snapshot, runId: 'retry' }, forced)
  assert.equal(rerun.length, 1)
  assert.equal(rerun[0].id, forced[0].id)
  assert.equal(rerun[0].stale, false)
  assert.equal(rerun[0].history.length, forced[0].history.length)
})
