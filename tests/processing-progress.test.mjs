import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  createProgressFlow,
  reduceProgress,
  failProgress,
  finishConfiguration,
  finishPipeline,
  progressEvidence,
} from '../src/lib/processing-progress.ts'
import {
  resolveProcessingTable,
  processingTableUrl,
} from '../src/lib/processing-workspace.ts'
import { createAppStore } from '../src/lib/store.ts'

const event = (phase, status = 'running', extra = {}) => ({
  phase,
  status,
  runId: 'run-a',
  ...extra,
})
const report = {
  role: 'store',
  relationshipId: 'store-pos',
  source: 'POS',
  fileId: 'p1',
  referenceRows: 3,
  duplicateKeys: 1,
  blankReferenceKeys: 0,
  invalidReferenceKeys: 0,
  invalidSourceKeys: 0,
  unmatchedRows: 1,
  unmatchedSamples: ['["S1"]'],
  rowsBefore: 2,
  rowsAfter: 3,
  errors: ['duplicate reference keys'],
}
test('progress changes only when reported and a failed stage leaves dependencies waiting', () => {
  let flow = createProgressFlow('pipeline')
  assert.ok(flow.steps.every((step) => step.status === 'pending'))
  flow = reduceProgress(
    flow,
    event('registering', 'completed', {
      metrics: [{ label: 'Tệp đã đọc', value: 4 }],
    }),
  )
  flow = reduceProgress(
    flow,
    event('dimensions', 'not-applicable', { detail: 'Không sử dụng Master' }),
  )
  flow = reduceProgress(
    flow,
    event('projecting', 'running', { joins: [report] }),
  )
  flow = reduceProgress(
    flow,
    event('projecting', 'error', { error: 'Duplicate reference keys' }),
  )
  assert.equal(flow.status, 'error')
  assert.equal(flow.steps[0].metrics[0].value, 4)
  assert.equal(flow.steps[1].status, 'not-applicable')
  assert.equal(flow.steps[2].status, 'error')
  assert.equal(flow.steps[2].joins[0].duplicateKeys, 1)
  assert.ok(flow.steps.slice(3).every((step) => step.status === 'waiting'))
  assert.strictEqual(reduceProgress(flow, event('evidence', 'completed')), flow)
})
test('configuration readiness is distinct from accounting completion and preserves real join evidence', () => {
  let flow = createProgressFlow('configuration', { fingerprint: 'fp' })
  flow = reduceProgress(flow, event('registering', 'completed'))
  flow = reduceProgress(flow, event('dimensions', 'completed'))
  flow = finishConfiguration(flow, {
    fingerprint: 'fp',
    scope: 'full',
    passed: false,
    joins: [report],
    errors: report.errors,
  })
  assert.equal(flow.status, 'needs-configuration')
  assert.equal(flow.currentStepId, 'projecting')
  assert.equal(flow.steps.at(-1).status, 'needs-configuration')
  assert.equal(progressEvidence(flow, { runId: 'run-a' }), undefined)
  const valid = finishConfiguration(createProgressFlow('configuration'), {
    fingerprint: 'fp',
    scope: 'full',
    passed: true,
    joins: [],
    errors: [],
  })
  assert.equal(valid.status, 'completed')
  assert.equal(progressEvidence(valid, { runId: 'run-a' }), undefined)
})

test('POS stages remain explicit and diagnostics are retained only for the matching run', () => {
  let flow = createProgressFlow('pipeline')
  const ids = flow.steps.map((step) => step.id)
  assert.deepEqual(
    ids.slice(ids.indexOf('normalizing'), ids.indexOf('validating') + 1),
    [
      'normalizing',
      'classifying',
      'cleaning',
      'mapping',
      'converting',
      'validating',
    ],
  )
  const diagnostics = {
    runId: 'run-a',
    uniqueInvalidRows: 2,
    invalidKeyGroups: 1,
    branchCounts: { q_POS_Cleaning: 4 },
    currencyCounts: { AUD: 2 },
    validLocalMissingUsdRows: 2,
    duplicateConflictGroups: 0,
    reasons: [],
  }
  flow = reduceProgress(flow, event('converting', 'running', { diagnostics }))
  flow = reduceProgress(
    flow,
    event('converting', 'running', {
      diagnostics: { ...diagnostics, runId: 'stale' },
    }),
  )
  assert.strictEqual(
    flow.steps.find((step) => step.id === 'converting').diagnostics,
    diagnostics,
  )
  flow = reduceProgress(
    flow,
    event('converting', 'error', { error: '[POS_FX_MISSING]' }),
  )
  assert.strictEqual(
    flow.steps.find((step) => step.id === 'converting').diagnostics,
    diagnostics,
  )
  assert.equal(
    flow.steps.find((step) => step.id === 'validating').status,
    'waiting',
  )
})
test('missing configuration and cancellation do not invent success for unexecuted steps', () => {
  const incomplete = failProgress(
    createProgressFlow('configuration'),
    'Chưa chọn sheet',
    'needs-configuration',
  )
  assert.equal(incomplete.steps[0].status, 'needs-configuration')
  assert.ok(
    incomplete.steps.slice(1).every((step) => step.status === 'waiting'),
  )
  const cancelled = failProgress(
    createProgressFlow('configuration'),
    'Đã đóng',
    'cancelled',
  )
  assert.equal(cancelled.status, 'cancelled')
  assert.ok(cancelled.steps.every((step) => step.status === 'waiting'))
  const legacy = finishPipeline(createProgressFlow('pipeline'))
  assert.ok(legacy.steps.every((step) => step.status === 'not-applicable'))
})
test('output links resolve only a retained table in the exact run and never fall back from stale links', () => {
  const table = { id: 'expected_events', rows: [] }
  const evidence = { runId: 'run-a', tables: [table] }
  const completed = finishPipeline(createProgressFlow('pipeline'), evidence)
  assert.strictEqual(progressEvidence(completed, evidence), evidence)
  assert.equal(
    progressEvidence(completed, { ...evidence, runId: 'run-b' }),
    undefined,
  )
  assert.strictEqual(
    resolveProcessingTable(evidence, 'run-a', 'expected_events').table,
    table,
  )
  assert.match(
    resolveProcessingTable(evidence, 'old', 'expected_events').error,
    /phiên cũ/,
  )
  assert.match(
    resolveProcessingTable(evidence, 'run-a', 'missing').error,
    /không có preview/,
  )
  assert.match(
    resolveProcessingTable(undefined, 'run-a', 'expected_events').error,
    /Chưa có snapshot/,
  )
  assert.equal(
    processingTableUrl('run a', 'dim:Tỷ giá'),
    '/processing?run=run+a&table=dim%3AT%E1%BB%B7+gi%C3%A1',
  )
})
test('shared store keeps progress on hide/reopen and rejects previous-run progress after edits', async () => {
  const store = createAppStore()
  const jobs = []
  store.attachProcessor(
    (files, period, options) =>
      new Promise((resolve, reject) => jobs.push({ options, resolve, reject })),
  )
  store.actions.setFiles(
    ['POS', 'WEB', 'GL', 'Flash'].map((source) => ({
      id: source,
      source,
      file: new File(['a\nb'], source + '.csv'),
    })),
  )
  await Promise.resolve()
  jobs[0].options.onProgress(event('registering', 'completed'))
  store.actions.openProcessingPanel()
  store.actions.closeProcessingPanel()
  const saved = store.getState().pipelineProgress
  store.actions.openProcessingPanel()
  assert.strictEqual(store.getState().pipelineProgress, saved)
  store.actions.setPeriod({ start: '2025-03-01', end: '2025-03-31' })
  await Promise.resolve()
  const fresh = store.getState().pipelineProgress
  jobs[0].options.onProgress(event('evidence', 'completed'))
  assert.strictEqual(store.getState().pipelineProgress, fresh)
  assert.ok(fresh.steps.every((step) => step.status === 'pending'))
  jobs[0].resolve({ exceptions: [], evidence: { runId: 'old' } })
  jobs[1].options.onProgress(
    event('projecting', 'error', { error: 'bad mapping' }),
  )
  jobs[1].reject(new Error('bad mapping'))
  await store.whenSettled()
  assert.equal(store.getState().pipelineProgress.status, 'error')
  assert.equal(
    store
      .getState()
      .pipelineProgress.steps.find((step) => step.id === 'normalizing').status,
    'waiting',
  )
  store.actions.setFiles([])
  assert.equal(store.getState().pipelineProgress, null)
  assert.equal(store.getState().reconciliationData, null)
  store.dispose()
})
test('configuration callbacks are guarded by check ID, fingerprint and draft invalidation', () => {
  const store = createAppStore(undefined, { ingestionMode: 'wizard' })
  store.actions.setFiles([
    { id: 'dim', source: 'Dim', file: new File(['k\nv'], 'dim.csv') },
  ])
  const old = store.actions.beginConfigurationCheck('dim', 'fp1')
  const current = store.actions.beginConfigurationCheck('dim', 'fp2')
  const before = store.getState().configurationProgress
  store.actions.updateConfigurationProgress(
    old,
    event('projecting', 'completed'),
  )
  store.actions.finishConfigurationCheck(current, {
    fingerprint: 'fp1',
    passed: true,
    joins: [],
    errors: [],
    scope: 'full',
  })
  assert.strictEqual(store.getState().configurationProgress, before)
  store.actions.finishConfigurationCheck(current, {
    fingerprint: 'fp2',
    passed: true,
    joins: [],
    errors: [],
    scope: 'full',
  })
  store.actions.failConfigurationCheck(current, 'Closed', 'cancelled')
  assert.equal(store.getState().configurationProgress.status, 'completed')
  store.actions.setHeaderRow('dim', 2)
  assert.equal(store.getState().configurationProgress, null)
  store.actions.finishConfigurationCheck(current, {
    fingerprint: 'fp2',
    passed: true,
    joins: [],
    errors: [],
    scope: 'full',
  })
  assert.equal(store.getState().configurationProgress, null)
  store.dispose()
})
