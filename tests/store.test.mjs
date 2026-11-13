import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createAppStore } from '../src/lib/store.ts'
import { inferSource } from '../src/lib/uploads.ts'

const period = { start: '2026-11-01', end: '2026-11-30' }
const selected = (tag = '') =>
  ['POS', 'WEB', 'GL', 'Flash'].map((source) => ({
    id: source + tag,
    source,
    file: new File(['header\nvalue'], `${source}${tag}.csv`),
  }))
const deferred = () => {
  let resolve, reject
  const promise = new Promise((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}

test('the supplied FY2025 dataset is the editable default reporting period', () => {
  const store = createAppStore()
  assert.deepEqual(store.getState().period, {
    start: '2025-01-01',
    end: '2025-12-31',
  })
  store.actions.setPeriod(period)
  assert.deepEqual(store.getState().period, period)
  const another = createAppStore()
  assert.deepEqual(another.getState().period, {
    start: '2025-01-01',
    end: '2025-12-31',
  })
  store.dispose()
  another.dispose()
})

test('waits for engine readiness and protects the latest files from stale completion and progress', async () => {
  const store = createAppStore(period)
  const jobs = []
  store.actions.setFiles(selected('A'))
  assert.equal(store.getState().status, 'waiting')
  const detach = store.attachProcessor((files, dates, options) => {
    const job = { files, dates, options, ...deferred() }
    jobs.push(job)
    return job.promise
  })
  await Promise.resolve()
  const oldPending = store.whenSettled()
  assert.equal(jobs.length, 1)
  store.actions.setFiles(selected('B'))
  await Promise.resolve()
  assert.equal(jobs[0].options.signal.aborted, true)
  jobs[0].options.onFileRegistered('POSA')
  assert.deepEqual(store.getState().registeredFileIds, [])
  jobs[0].resolve({ Flash_Sales: 999, exceptions: [{ id: 'stale' }] })
  await oldPending
  assert.equal(store.getState().reconciliationData, null)
  jobs[1].files.forEach((entry) => jobs[1].options.onFileRegistered(entry.id))
  jobs[1].options.onQueryStart()
  assert.equal(store.getState().status, 'running')
  const current = { Flash_Sales: 10, exceptions: [{ id: 'current' }] }
  jobs[1].resolve(current)
  await store.whenSettled()
  assert.equal(store.getState().status, 'ready')
  assert.strictEqual(store.getState().reconciliationData, current)
  assert.strictEqual(store.getState().exceptionsData, current.exceptions)
  detach()
  store.dispose()
})

test('registers all selected files per source before marking that source uploaded', async () => {
  const store = createAppStore(period)
  const job = deferred()
  let options
  store.attachProcessor((_, __, callbacks) => {
    options = callbacks
    return job.promise
  })
  const a = selected()[0]
  store.actions.setFiles([
    a,
    { ...a, id: 'POS2' },
    { ...a, id: 'unknown', source: '' },
  ])
  await Promise.resolve()
  assert.equal(options.canReconcile, false)
  options.onFileRegistered('POS')
  assert.equal(store.getState().filesUploaded.POS, false)
  options.onFileRegistered('POS2')
  assert.equal(store.getState().filesUploaded.POS, true)
  job.resolve(null)
  await store.whenSettled()
  assert.equal(store.getState().status, 'waiting')
  assert.ok(store.getState().missingSources.includes('source assignments'))
  store.dispose()
})

test('clearing or changing the period invalidates both views immediately, including late failures', async () => {
  const store = createAppStore(period)
  const jobs = []
  store.attachProcessor((files, dates, options) => {
    const job = { files, dates, options, ...deferred() }
    jobs.push(job)
    return job.promise
  })
  store.actions.setFiles(selected())
  await Promise.resolve()
  jobs[0].resolve({ exceptions: [{ id: 'old' }] })
  await store.whenSettled()
  assert.equal(store.getState().status, 'ready')
  store.actions.setPeriod({ start: '2026-12-01', end: '2026-12-31' })
  assert.equal(store.getState().reconciliationData, null)
  assert.deepEqual(store.getState().exceptionsData, [])
  await Promise.resolve()
  const oldPending = store.whenSettled()
  store.actions.setFiles([])
  jobs[1].reject(new Error('late query failure'))
  await oldPending
  assert.equal(store.getState().status, 'idle')
  assert.equal(store.getState().error, null)
  assert.deepEqual(store.getState().filesUploaded, {
    POS: false,
    WEB: false,
    GL: false,
    Flash: false,
    Dim: false,
  })
  store.dispose()
})

test('a processing failure clears results and can be retried without a new upload', async () => {
  const store = createAppStore(period)
  let attempts = 0
  store.attachProcessor(async (_, __, options) => {
    attempts++
    if (attempts === 1) throw new Error('Invalid CSV header')
    options.onQueryStart()
    return { exceptions: [] }
  })
  store.actions.setFiles(selected())
  await store.whenSettled()
  assert.equal(store.getState().error, 'Invalid CSV header')
  assert.equal(store.getState().status, 'error')
  assert.deepEqual(store.getState().exceptionsData, [])
  store.actions.retry()
  await store.whenSettled()
  assert.equal(store.getState().status, 'ready')
  assert.equal(store.getState().error, null)
  store.dispose()
})

test('Dim is optional for readiness, allowed as a fifth mapping, and inferred from the workbook name', async () => {
  const store = createAppStore(period)
  assert.deepEqual(store.getState().missingSources, [
    'POS',
    'WEB',
    'GL',
    'Flash',
  ])
  store.actions.setFiles(selected())
  assert.equal(store.getState().canViewReconciliation, true)
  const dim = {
    id: 'Dim',
    source: 'Dim',
    file: new File(['workbook'], 'Nexa_Home_Master_Data.xlsx'),
  }
  store.actions.setFiles([...selected(), dim])
  assert.equal(store.getState().canViewReconciliation, true)
  assert.deepEqual(store.getState().missingSources, [])
  assert.equal(inferSource(dim.file.name), 'Dim')
  store.actions.setFiles([dim])
  assert.equal(store.getState().canViewReconciliation, false)
  assert.deepEqual(store.getState().missingSources, [
    'POS',
    'WEB',
    'GL',
    'Flash',
  ])
  store.actions.setFiles([...selected(), { ...dim, source: '' }])
  assert.equal(store.getState().canViewReconciliation, false)
  store.dispose()
})
