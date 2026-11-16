import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { createAppStore } from '../src/lib/store.ts'
import {
  REFERENCE_FILE_NAME,
  selectActiveResult,
} from '../src/lib/excel-reference-session.ts'
import { selectExcelReference } from '../src/lib/excel-reference.ts'

const bytes = await readFile(
  new URL('../public/reference/excel-reference.xlsx', import.meta.url),
)
const arrayBuffer = () =>
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
const referenceFile = (name = REFERENCE_FILE_NAME) => ({
  name,
  arrayBuffer: async () => arrayBuffer(),
})
const deferred = () => {
  let resolve, reject
  const promise = new Promise((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}
const pendingFile = (name) => {
  const pending = deferred()
  return { ...pending, file: { name, arrayBuffer: () => pending.promise } }
}
const rawOnly = (state) => {
  const { excelReference: _reference, ...raw } = state
  return raw
}
const assertRawIdentity = (state, original) => {
  const raw = rawOnly(state)
  assert.deepEqual(raw, original)
  for (const key of Object.keys(original))
    assert.strictEqual(raw[key], original[key], `Raw field changed: ${key}`)
}

async function blockedRawStore() {
  const store = createAppStore()
  let runs = 0
  const record = {
    id: 'manual-shipping',
    sourceFingerprint: 'raw-shipping-v1',
    configurationVersion: 'raw-config-v1',
    fileId: 'GL',
    fileName: 'GL.csv',
    sheetName: 'CSV',
    sourceRow: 2,
    journalId: 'RAW-SHIP-01',
    journalType: 'MANUAL',
    postingDate: '2025-09-30',
    period: '2025-09',
    storeKey: 'S01',
    storeCode: 'NX001',
    channel: 'WEB',
    amountCents: -853149,
    revenueCents: 853149,
    sourceRef: 'MJ-SHIP-RAW',
    description: 'Phí vận chuyển có bảng kê',
    amountBasis: 'ledger',
    raw: {
      journalId: 'RAW-SHIP-01',
      postingDate: '2025-09-30',
      period: '2025-09',
      storeKey: 'S01',
      storeCode: 'NX001',
      channel: 'WEB',
      amount: '-8531.49',
      journalType: 'MANUAL',
      sourceRef: 'MJ-SHIP-RAW',
      description: 'Phí vận chuyển có bảng kê',
    },
    original: {
      postingDate: '2025-09-30',
      period: '2025-09',
      storeKey: 'S01',
      channel: 'WEB',
      amountCents: -853149,
      revenueCents: 853149,
    },
    staleCorrection: false,
  }
  store.actions.setFiles(
    ['POS', 'WEB', 'GL', 'Flash'].map((source) => ({
      id: source,
      source,
      file: new File(['header\nraw source'], `${source}.csv`),
    })),
  )
  store.attachProcessor(async (files, _period, options) => {
    runs++
    for (const file of files) options.onFileRegistered(file.id)
    options.onQueryStart()
    options.onGLSnapshot({
      runId: `blocked-raw-${runs}`,
      configurationVersion: 'raw-config-v1',
      complete: true,
      records: [record],
      transformations: [],
      diagnostics: [],
    })
    const originalMessage =
      'Ngày Flash không đọc được hoặc không phải ngày cuối tháng.'
    options.onFailure({
      runId: `blocked-raw-${runs}`,
      source: 'Flash',
      stage: 'validating',
      originalMessage,
      reasons: [
        {
          code: 'FLASH_DATE_INVALID',
          fields: ['month_end'],
          message: originalMessage,
          count: 157,
        },
      ],
      samples: [
        {
          fileName: 'Flash.csv',
          sourceRecord: 3,
          values: { month_end: 'invalid' },
        },
      ],
    })
    options.onProgress({
      runId: `blocked-raw-${runs}`,
      phase: 'validating',
      source: 'Flash',
      status: 'error',
      error: originalMessage,
    })
    throw new Error(originalMessage)
  })
  await store.whenSettled()
  const reviewCase = store.getState().reviewCases[0]
  assert.ok(reviewCase)
  store.actions.updateReviewCase(reviewCase.id, {
    classification: 'shipping',
    status: 'confirmed',
    purpose: 'Đã rà soát bảng kê phí vận chuyển Raw.',
    notes: 'Ghi chú thủ công cần giữ nguyên qua mọi lần xem thử.',
    evidence: 'Bảng kê hãng vận chuyển đã kiểm tra ngày 30/09.',
    evidenceReviewed: true,
    decision: 'Chấp thuận phân loại doanh thu phí vận chuyển.',
    nextStep: 'Theo dõi việc xử lý lỗi Flash trong Raw.',
    owner: 'Finance reviewer',
  })
  assert.equal(store.getState().status, 'error')
  assert.equal(store.getState().runFailure.source, 'Flash')
  assert.equal(store.getState().runFailure.reasons[0].count, 157)
  return { store, runs: () => runs }
}

test('each new session starts with Raw active and no retained reference workbook', () => {
  const first = createAppStore()
  const second = createAppStore()
  try {
    for (const store of [first, second]) {
      const state = store.getState()
      assert.equal(state.excelReference.enabled, false)
      assert.equal(state.excelReference.status, 'idle')
      assert.equal(state.excelReference.workbook, null)
      assert.equal(selectActiveResult(state).source, 'raw')
    }
  } finally {
    first.dispose()
    second.dispose()
  }
})

test('blocked Flash can preview the real workbook repeatedly without changing Raw or manual decisions', async () => {
  const { store, runs } = await blockedRawStore()
  const original = rawOnly(store.getState())
  try {
    for (let cycle = 0; cycle < 3; cycle++) {
      await store.actions.loadExcelReference(referenceFile())
      const state = store.getState()
      assertRawIdentity(state, original)
      assert.equal(runs(), 1)
      const active = selectActiveResult(state)
      assert.equal(active.source, 'excel')
      assert.equal(active.workbook.exceptions.length, 10)
      assert.equal(active.workbook.details.length, 39_062)
      assert.equal(
        active.workbook.exceptions.find((row) => row.id === 'EX-05').status,
        'Cần chứng từ',
      )
      assert.equal(state.reviewCases[0].status, 'confirmed')
      store.actions.setExcelReferencePeriod({
        start: '2025-09-01',
        end: '2025-09-30',
      })
      const september = selectActiveResult(store.getState())
      assert.equal(
        selectExcelReference(september.workbook, september.period)
          .unexplainedUSD,
        1250,
      )
      assertRawIdentity(store.getState(), original)
      store.actions.openExcelReference()
      store.actions.closeExcelReference()
      assertRawIdentity(store.getState(), original)
      store.actions.disableExcelReference()
      assertRawIdentity(store.getState(), original)
      const restored = selectActiveResult(store.getState())
      assert.equal(restored.source, 'raw')
      assert.strictEqual(restored.result, original.reconciliationData)
      assert.strictEqual(restored.exceptions, original.exceptionsData)
      assert.strictEqual(restored.period, original.period)
      assert.equal(store.getState().excelReference.workbook, null)
      assert.equal(runs(), 1)
    }
    assert.match(store.getState().reviewCases[0].notes, /Ghi chú thủ công/)
    assert.match(
      store.getState().reviewCases[0].evidence,
      /Bảng kê hãng vận chuyển/,
    )
    assert.equal(store.getState().reviewCases[0].evidenceReviewed, true)
    assert.match(store.getState().reviewCases[0].decision, /Chấp thuận/)
  } finally {
    store.dispose()
  }
})

test('turning preview off during a pending file read suppresses late success and progress', async () => {
  const { store, runs } = await blockedRawStore()
  const original = rawOnly(store.getState())
  const pending = pendingFile('late-success.xlsx')
  try {
    const loading = store.actions.loadExcelReference(pending.file)
    assert.equal(store.getState().excelReference.status, 'loading')
    store.actions.disableExcelReference()
    const disabled = store.getState().excelReference
    let updates = 0
    const unsubscribe = store.subscribe(() => updates++)
    pending.resolve(arrayBuffer())
    await loading
    assert.strictEqual(store.getState().excelReference, disabled)
    assert.equal(updates, 0)
    assert.equal(selectActiveResult(store.getState()).source, 'raw')
    assertRawIdentity(store.getState(), original)
    assert.equal(runs(), 1)
    unsubscribe()
  } finally {
    store.dispose()
  }
})

test('late read failures cannot restore errors after preview is disabled', async () => {
  const store = createAppStore()
  const pending = pendingFile('late-failure.xlsx')
  try {
    const loading = store.actions.loadExcelReference(pending.file)
    store.actions.disableExcelReference()
    const disabled = store.getState().excelReference
    pending.reject(new Error('Late file read failure'))
    await loading
    assert.strictEqual(store.getState().excelReference, disabled)
    assert.equal(store.getState().excelReference.error, null)
    assert.equal(selectActiveResult(store.getState()).source, 'raw')
  } finally {
    store.dispose()
  }
})

test('overlapping workbook reads publish only the newest successful workbook', async () => {
  const store = createAppStore()
  const oldSuccess = pendingFile('old-success.xlsx')
  const oldFailure = pendingFile('old-failure.xlsx')
  try {
    const first = store.actions.loadExcelReference(oldSuccess.file)
    const second = store.actions.loadExcelReference(oldFailure.file)
    await store.actions.loadExcelReference(referenceFile('newest.xlsx'))
    const newest = store.getState().excelReference
    assert.equal(newest.status, 'ready')
    assert.equal(newest.workbook.fileName, 'newest.xlsx')
    oldFailure.reject(new Error('Stale read failure'))
    oldSuccess.resolve(arrayBuffer())
    await Promise.all([first, second])
    assert.strictEqual(store.getState().excelReference, newest)
    assert.equal(selectActiveResult(store.getState()).source, 'excel')
    const freshSession = createAppStore()
    assert.equal(selectActiveResult(freshSession.getState()).source, 'raw')
    freshSession.dispose()
  } finally {
    store.dispose()
  }
})

test('disposing the real store cancels a pending reference read and its later notifications', async () => {
  const store = createAppStore()
  const pending = pendingFile('disposed.xlsx')
  const loading = store.actions.loadExcelReference(pending.file)
  store.dispose()
  const disposed = store.getState()
  pending.resolve(arrayBuffer())
  await loading
  assert.strictEqual(store.getState(), disposed)
  assert.equal(store.getState().excelReference.enabled, false)
  assert.equal(store.getState().excelReference.workbook, null)
})

test('default load fetches the bundled real workbook and remains independent of engine availability', async () => {
  const store = createAppStore()
  const savedFetch = globalThis.fetch
  const requests = []
  const dataset = await readFile(
    new URL(
      '../docs/source/Nexa_Home_Recon_Dataset_Final.xlsx',
      import.meta.url,
    ),
  )
  try {
    store.setEngineUnavailable('error', 'DuckDB unavailable for Raw')
    const original = rawOnly(store.getState())
    globalThis.fetch = async (url, options) => {
      requests.push({ url, signal: options.signal })
      return new Response(dataset, { status: 200 })
    }
    await store.actions.loadExcelReference()
    assert.equal(requests.length, 1)
    assert.equal(requests[0].url, '/demo/Nexa_Home_Recon_Dataset_Final.xlsx')
    assert.equal(requests[0].signal.aborted, false)
    const active = selectActiveResult(store.getState())
    assert.equal(active.source, 'excel')
    assert.equal(active.workbook.fileName, REFERENCE_FILE_NAME)
    assert.equal(active.workbook.exceptions.length, 7)
    assert.ok(active.workbook.dashboard.cells.length > 0)
    assert.equal(active.workbook.dashboard.manuals.length, 15)
    assert.equal(
      active.workbook.checks.find((row) => row.id === 'control-exceptions')
        .expectedUSD,
      7,
    )
    assert.ok(
      active.workbook.dashboard.validations.some(
        (row) => row.count === null && !row.status,
      ),
    )
    assert.equal(
      selectExcelReference(active.workbook, active.period).salesUSD,
      31_124_401,
    )
    assertRawIdentity(store.getState(), original)
    store.actions.disableExcelReference()
    assert.equal(requests[0].signal.aborted, true)
    assert.equal(selectActiveResult(store.getState()).source, 'raw')
    assertRawIdentity(store.getState(), original)
  } finally {
    globalThis.fetch = savedFetch
    store.dispose()
  }
})
