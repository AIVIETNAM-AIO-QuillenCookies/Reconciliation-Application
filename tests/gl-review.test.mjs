import assert from 'node:assert/strict'
import { before, test } from 'node:test'
import { createRequire } from 'node:module'
import {
  createDuckDB,
  NODE_RUNTIME,
  VoidLogger,
} from '@duckdb/duckdb-wasm/blocking'
import { ReconciliationEngine } from '../src/lib/ReconciliationEngine.ts'
import * as XLSX from 'xlsx'
import {
  synchronizeReviewCases,
  editReviewCase,
  previewCorrection,
  transferIssue,
} from '../src/lib/accounting-review.ts'
import { validateGLPatch } from '../src/lib/gl-review.ts'
import { createAppStore } from '../src/lib/store.ts'
import { autoMapColumns } from '../src/lib/data-mapping.ts'
import { parseMappingPreview } from '../src/lib/mapping-preview.ts'
import {
  createMasterDraft,
  defaultRelationship,
  masterSnapshot,
} from '../src/lib/master-data.ts'

const period = { start: '2025-01-01', end: '2025-12-31' }
const glHeader =
  'journal_id,posting_date,period,store_key,store_code,channel,journal_type,amount_usd,description,source_ref'
const systemJournals = [
  'SYS-POS,2025-09-05,2025-09,S01,S01,STORE,POS_DAILY,-100,Daily sales,POS-01',
  'SYS-WEB,2025-09-06,2025-09,999999,WEB,WEB,WEB_DELIVERY,-10,Delivered sales,WEB-01',
]
const adjustment =
  'JE20250904892,2025-09-30,2025-09,,,UNALLOCATED,MANUAL,-1250,ADJ-0925 điều chỉnh theo yêu cầu,MJ-ADJ-2509'
const transfer = [
  'TRANSFER-STORE,2025-06-30,2025-06,S19,NX019,STORE,MANUAL,3480,Chuyển kênh doanh thu,MJ-RCL-2506',
  'TRANSFER-WEB,2025-06-30,2025-06,999999,WEB,WEB,MANUAL,-3480,Chuyển kênh doanh thu,MJ-RCL-2506',
]
function files(extra = [], overrides = {}) {
  const data = {
    POS: 'receipt_no,line_no,store_key,business_date,posting_date,gross_usd_daily,net_usd_month_end,discount_usd_daily\nR1,1,S01,2025-09-05,2025-09-05,100,100,0',
    WEB: 'web_order_id,store_key,order_date,delivery_date,return_date,order_status,gross_usd_daily,net_usd_month_end,discount_usd_daily\nW1,999999,2025-09-06,2025-09-06,,Delivered,10,10,0',
    GL: [glHeader, ...systemJournals, ...extra].join('\n'),
    Flash: 'month_end_date,revenue_usd\n2025-09-30,110',
    ...overrides,
  }
  return Object.entries(data).map(([source, csv]) => ({
    id: source,
    source,
    file: new File([csv], `${source}.csv`, { type: 'text/csv' }),
  }))
}

let bindings
let engine
before(async () => {
  const require = createRequire(import.meta.url)
  bindings = await createDuckDB(
    {
      mvp: {
        mainModule: require.resolve('@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm'),
      },
      eh: {
        mainModule: require.resolve('@duckdb/duckdb-wasm/dist/duckdb-eh.wasm'),
      },
    },
    new VoidLogger(),
    NODE_RUNTIME,
  )
  await bindings.instantiate()
  bindings.open({ path: ':memory:' })
  const database = {
    registerFileText: async (path, text) =>
      bindings.registerFileText(path, text),
    registerFileBuffer: async (path, bytes) =>
      bindings.registerFileBuffer(path, bytes),
    dropFile: async (path) => bindings.dropFile(path),
    connect: async () => {
      const connection = bindings.connect()
      return {
        query: async (sql) => connection.query(sql),
        close: async () => connection.close(),
      }
    },
  }
  engine = new ReconciliationEngine(database, undefined, undefined, {
    schemaMode: 'accounting',
    onWarning() {},
  })
})

test('valid unallocated manual adjustment stays in company GL and remains unexplained', async () => {
  const result = await engine.run(files([adjustment]), period)
  assert.equal(result.GL_Finance, 1360)
  assert.equal(result.Unexplained, 1250)
  assert.equal(result.rowCounts.GL, 3)
  assert.equal(result.missingGLEntries, 0)
  assert.equal(result.glReview.complete, true)
  const record = result.glReview.records.find(
    (row) => row.journalId === 'JE20250904892',
  )
  assert.ok(record)
  assert.equal(record.storeKey, '-1')
  assert.equal(record.storeCode, null)
  assert.equal(record.channel, 'UNALLOCATED')
  assert.equal(record.amountCents, -125000)
  assert.equal(record.revenueCents, 125000)
  assert.equal(record.raw.storeKey, null)
  assert.equal(record.sourceRef, 'MJ-ADJ-2509')
  assert.equal(record.sourceRow, 4)
  assert.equal(record.fileName, 'GL.csv')
  assert.equal(result.glReview.diagnostics.length, 0)
})

test('paired channel transfer preserves both journal identities and signed channel impacts', async () => {
  const result = await engine.run(files(transfer), period)
  const records = result.glReview.records.filter(
    (record) => record.sourceRef === 'MJ-RCL-2506',
  )
  assert.equal(records.length, 2)
  assert.equal(new Set(records.map((record) => record.id)).size, 2)
  assert.deepEqual(
    Object.fromEntries(
      records.map((record) => [record.channel, record.revenueCents]),
    ),
    { STORE: -348000, WEB: 348000 },
  )
  assert.equal(result.GL_Finance, 110)
  assert.equal(
    records.reduce((total, record) => total + record.revenueCents, 0),
    0,
  )
})

test('normalization preserves negative refund revenue and retry does not invert again', async () => {
  const refund =
    'RETURN,2025-09-20,2025-09,999999,WEB,WEB,WEB_RETURN,25,Refund,RETURN-1'
  const selected = files([adjustment, refund])
  const first = await engine.run(selected, period)
  const second = await engine.run(selected, period)
  assert.equal(first.GL_Finance, 1335)
  assert.equal(second.GL_Finance, first.GL_Finance)
  assert.equal(
    second.glReview.records.find((row) => row.journalId === 'RETURN')
      .revenueCents,
    -2500,
  )
  assert.deepEqual(
    second.glReview.records.map((record) => [
      record.id,
      record.sourceFingerprint,
    ]),
    first.glReview.records.map((record) => [
      record.id,
      record.sourceFingerprint,
    ]),
  )
  assert.equal(
    second.glReview.transformations.length,
    first.glReview.transformations.length,
  )
  assert.equal(bindings.globFiles('reconcile_*').length, 0)
})

test('invalid financial fields block a complete result while publishing GL source diagnostics', async () => {
  for (const [field, replacement] of [
    ['amount_usd', 'not-an-amount'],
    ['posting_date', '2025-02-30'],
    ['journal_id', ''],
  ]) {
    const cells = adjustment.split(',')
    cells[glHeader.split(',').indexOf(field)] = replacement
    let snapshot
    await assert.rejects(
      engine.run(files([cells.join(',')]), period, undefined, {
        onGLSnapshot(value) {
          snapshot = value
        },
      }),
    )
    assert.ok(snapshot, `${field}: diagnostics snapshot survives failure`)
    assert.equal(snapshot.complete, false)
    assert.ok(
      snapshot.diagnostics.some((item) => item.field === field),
      field,
    )
    assert.ok(snapshot.records.some((record) => record.sourceRow === 4))
    assert.equal(bindings.globFiles('reconcile_*').length, 0)
  }
})

test('duplicate journal IDs block while shared source references are allowed', async () => {
  let snapshot
  await assert.rejects(
    engine.run(files([adjustment, adjustment]), period, undefined, {
      onGLSnapshot(value) {
        snapshot = value
      },
    }),
  )
  assert.ok(snapshot.diagnostics.some((item) => item.field === 'journal_id'))
  const result = await engine.run(files(transfer), period)
  assert.equal(result.glReview.complete, true)
})

test('review state requires real evidence and a decision; merely viewed is unresolved', async () => {
  const result = await engine.run(files([adjustment]), period)
  const cases = synchronizeReviewCases(result.glReview)
  assert.equal(cases.length, 1)
  const current = cases[0]
  assert.equal(current.classification, 'unexplained')
  assert.equal(current.evidence, '')
  assert.equal(current.evidenceReviewed, false)
  assert.equal(current.status, 'open')
  assert.throws(
    () =>
      editReviewCase(
        current,
        { evidenceReviewed: true },
        result.glReview.records,
      ),
    /bằng chứng/,
  )
  assert.throws(
    () =>
      editReviewCase(current, { status: 'confirmed' }, result.glReview.records),
    /quyết định|bằng chứng/,
  )
  const viewed = editReviewCase(
    current,
    { status: 'reviewed', notes: 'Đã xem; tiếp tục chờ Finance.' },
    result.glReview.records,
  )
  assert.equal(viewed.status, 'reviewed')
  assert.equal(viewed.evidenceReviewed, false)
  assert.equal(viewed.decision, '')
  const confirmed = editReviewCase(
    viewed,
    {
      classification: 'other',
      purpose: 'Điều chỉnh doanh thu đã được Finance giải thích',
      evidence: 'Biên bản Finance #42, được cung cấp trong phiên',
      evidenceReviewed: true,
      decision: 'Giữ khoản tại UNALLOCATED để theo dõi phân bổ riêng.',
      status: 'confirmed',
    },
    result.glReview.records,
  )
  assert.equal(confirmed.status, 'confirmed')
  assert.equal(confirmed.evidenceReviewed, true)
  assert.ok(confirmed.history.length > current.history.length)
  const changedEvidence = editReviewCase(
    { ...confirmed, status: 'in_progress' },
    { evidence: 'Chứng từ thay thế #43' },
    result.glReview.records,
  )
  assert.equal(changedEvidence.evidenceReviewed, false)
})

test('classification and notes never add GL revenue, retries reuse case identity and history', async () => {
  const selected = files([
    adjustment,
    'SHIPPING-1,2025-09-30,2025-09,999999,WEB,WEB,MANUAL,-42,Phí vận chuyển tháng 9,MJ-SHIP-2509',
    ...transfer,
  ])
  const first = await engine.run(selected, period)
  const initial = synchronizeReviewCases(first.glReview)
  assert.equal(initial.length, 3)
  assert.deepEqual(initial.map((item) => item.classification).sort(), [
    'channel_transfer',
    'shipping',
    'unexplained',
  ])
  const saved = initial.map((item) =>
    editReviewCase(
      item,
      { notes: 'Chờ xác minh', owner: 'Finance Ops' },
      first.glReview.records,
    ),
  )
  const second = await engine.run(selected, period)
  const synced = synchronizeReviewCases(second.glReview, saved)
  assert.equal(second.GL_Finance, first.GL_Finance)
  assert.equal(synced.length, saved.length)
  assert.deepEqual(
    synced.map((item) => item.id),
    saved.map((item) => item.id),
  )
  assert.deepEqual(
    synced.map((item) => item.history),
    saved.map((item) => item.history),
  )
  const channelCase = synced.find(
    (item) => item.classification === 'channel_transfer',
  )
  const records = second.glReview.records.filter((row) =>
    channelCase.recordIds.includes(row.id),
  )
  assert.equal(transferIssue(records), null)
  assert.match(transferIssue(records.slice(0, 1)), /hai journal/)
})

test('corrections require reason, preview exact cents and allocation consistency', async () => {
  const result = await engine.run(files([adjustment]), period)
  const record = result.glReview.records.find(
    (row) => row.journalId === 'JE20250904892',
  )
  assert.throws(
    () => previewCorrection(record, { amountCents: -130000 }, '', period),
    /lý do/,
  )
  assert.throws(
    () =>
      previewCorrection(record, { storeKey: 'S19' }, 'Có bằng chứng', period),
    /nhất quán|UNALLOCATED/,
  )
  assert.throws(
    () =>
      previewCorrection(record, { amountCents: 1.5 }, 'Có bằng chứng', period),
    /cent/,
  )
  const preview = previewCorrection(
    record,
    { amountCents: -130000, storeKey: 'S19', channel: 'STORE' },
    'Finance cung cấp bằng chứng phân bổ',
    period,
  )
  assert.equal(preview.before.revenueCents, 125000)
  assert.equal(preview.after.revenueCents, 130000)
  assert.equal(preview.totalGLDeltaCents, 5000)
  assert.equal(preview.unexplainedDeltaCents, 5000)
  assert.deepEqual(preview.impacts, [
    {
      period: '2025-09',
      channel: 'UNALLOCATED',
      beforeCents: 125000,
      afterCents: 0,
    },
    { period: '2025-09', channel: 'STORE', beforeCents: 0, afterCents: 130000 },
  ])
  assert.equal(record.amountCents, -125000)
  assert.equal(record.raw.amount, '-1250')
  assert.throws(
    () =>
      validateGLPatch(record, { postingDate: '2025-02-30' }, 'Có bằng chứng'),
    /Ngày/,
  )
})

test('changed source invalidates an earlier case decision and retains its audit history', async () => {
  const result = await engine.run(files([adjustment]), period)
  const [initial] = synchronizeReviewCases(result.glReview)
  const saved = editReviewCase(
    initial,
    { notes: 'Bằng chứng phiên trước' },
    result.glReview.records,
  )
  const changed = await engine.run(
    files([adjustment.replace('-1250,', '-1500,')]),
    period,
  )
  const [next] = synchronizeReviewCases(changed.glReview, [saved])
  assert.equal(next.id, saved.id)
  assert.equal(next.stale, true)
  assert.equal(next.status, 'open')
  assert.equal(next.evidenceReviewed, false)
  assert.ok(next.history.length > saved.history.length)
  assert.equal(next.notes, saved.notes)
})

test('explicit revenue-basis mappings preserve the input sign on run, retry and preview', async () => {
  const gl = [
    glHeader,
    ...[...systemJournals, adjustment].map((row) => {
      const cells = row.split(',')
      cells[7] = String(-Number(cells[7]))
      return cells.join(',')
    }),
  ].join('\n')
  const selected = files([], { GL: gl })
  const mappings = await Promise.all(
    selected.map(async (entry) => ({
      fileId: entry.id,
      fileName: entry.file.name,
      source: entry.source,
      columns: autoMapColumns(
        parseMappingPreview(await entry.file.arrayBuffer(), 'csv').headers,
        entry.source,
      ),
      ...(entry.source === 'GL' ? { glAmountBasis: 'revenue' } : {}),
    })),
  )
  const result = await engine.run(selected, period, undefined, {
    columnMappings: mappings,
  })
  const retry = await engine.run(selected, period, undefined, {
    columnMappings: mappings,
  })
  assert.equal(result.GL_Finance, 1360)
  assert.equal(retry.GL_Finance, result.GL_Finance)
  const record = result.glReview.records.find(
    (row) => row.journalId === 'JE20250904892',
  )
  assert.equal(record.amountBasis, 'revenue')
  assert.equal(record.amountCents, -125000)
  assert.equal(record.revenueCents, 125000)
  assert.equal(record.raw.amount, '1250')
  const preview = previewCorrection(
    record,
    { amountCents: -130000 },
    'Chứng từ thay thế',
    period,
  )
  assert.equal(preview.after.revenueCents, 130000)
  assert.equal(preview.totalGLDeltaCents, 5000)
})

test('correction overlay recomputes effective GL once and undo restores raw financial results', async () => {
  const selected = files([adjustment])
  const original = await engine.run(selected, period)
  const record = original.glReview.records.find(
    (row) => row.journalId === 'JE20250904892',
  )
  const correction = {
    id: 'correction-test',
    recordId: record.id,
    sourceFingerprint: record.sourceFingerprint,
    configurationVersion: record.configurationVersion,
    patch: { amountCents: -130000, storeKey: 'S19', channel: 'STORE' },
    reason: 'Finance xác nhận khoản cần điều chỉnh theo chứng từ #42',
    appliedAt: '2026-11-12T10:00:00Z',
    active: true,
  }
  const updated = await engine.run(selected, period, undefined, {
    glCorrections: [correction],
  })
  const retry = await engine.run(selected, period, undefined, {
    glCorrections: [correction],
  })
  assert.equal(updated.GL_Finance, original.GL_Finance + 50)
  assert.equal(retry.GL_Finance, updated.GL_Finance)
  assert.equal(
    updated.glReview.records.length,
    original.glReview.records.length,
  )
  const effective = updated.glReview.records.find((row) => row.id === record.id)
  assert.equal(effective.storeKey, 'S19')
  assert.equal(effective.revenueCents, 130000)
  assert.deepEqual(effective.raw, record.raw)
  assert.deepEqual(effective.original, record.original)
  const undone = await engine.run(selected, period, undefined, {
    glCorrections: [{ ...correction, active: false }],
  })
  assert.equal(undone.GL_Finance, original.GL_Finance)
  assert.equal(undone.Unexplained, original.Unexplained)
  assert.deepEqual(
    undone.glReview.records.find((row) => row.id === record.id).raw,
    record.raw,
  )
  const changed = await engine.run(
    files([adjustment.replace('-1250,', '-1500,')]),
    period,
    undefined,
    { glCorrections: [correction] },
  )
  const stale = changed.glReview.records.find(
    (row) => row.journalId === record.journalId,
  )
  assert.equal(stale.staleCorrection, true)
  assert.equal(stale.revenueCents, 150000)
  assert.equal(stale.storeKey, '-1')
  assert.equal(changed.GL_Finance, 1610)
})

test('confirmed GL master lookup retains explicitly unallocated rows and still rejects unknown allocated stores', async () => {
  const selected = files([adjustment])
  const masterFile = new File(
    ['Source,Finance\nS01,S01\n999999,999999'],
    'Stores.csv',
  )
  const preview = {
    ...parseMappingPreview(await masterFile.arrayBuffer(), 'csv'),
    sheetName: 'Stores',
  }
  const draft = createMasterDraft('master', [preview])
  for (const role of Object.values(draft.roles)) role.usage = 'not-used'
  draft.roles.store = {
    usage: 'enabled',
    sheetName: 'Stores',
    columns: { pos_store_id: 'Source', finance_store_code: 'Finance' },
    relationships: [{ ...defaultRelationship('store'), source: 'GL' }],
  }
  const options = { masterConfiguration: masterSnapshot(draft) }
  const result = await engine.run(
    [...selected, { id: 'master', source: 'Dim', file: masterFile }],
    period,
    undefined,
    options,
  )
  assert.equal(result.GL_Finance, 1360)
  assert.equal(
    result.glReview.records.find((row) => row.journalId === 'JE20250904892')
      .storeKey,
    '-1',
  )
  await assert.rejects(
    engine.run(
      [
        ...files([
          adjustment.replace(',,,UNALLOCATED,', ',UNKNOWN,UNKNOWN,STORE,'),
        ]),
        { id: 'master', source: 'Dim', file: masterFile },
      ],
      period,
      undefined,
      options,
    ),
    /no reference match|source rows|SOURCE|reference|khóa/i,
  )
})

test('constructed reference fixture reconciles 12 shipping entries, paired transfer and unexplained adjustment', async () => {
  // Acceptance fixture reproduces the documented group totals, not the missing workbook's individual rows.
  const shippingCents = Array.from({ length: 12 }, (_, index) =>
    index === 11 ? 676695 : 800000,
  )
  const shipping = shippingCents.map((cents, index) => {
    const month = String(index + 1).padStart(2, '0')
    return `SHIP-${index + 1},2025-${month}-28,2025-${month},999999,WEB,WEB,MANUAL,${(-cents / 100).toFixed(2)},Phí vận chuyển ${month},MJ-SHIP-25${month}`
  })
  const result = await engine.run(
    files([...shipping, ...transfer, adjustment]),
    period,
  )
  const cases = synchronizeReviewCases(result.glReview)
  const shippingCases = cases.filter(
    (item) => item.classification === 'shipping',
  )
  const shippingRecords = result.glReview.records.filter((record) =>
    shippingCases.some((item) => item.recordIds.includes(record.id)),
  )
  assert.equal(shippingCases.length, 12)
  assert.equal(
    shippingRecords.reduce((sum, record) => sum + record.revenueCents, 0),
    9476695,
  )
  const transferCase = cases.find(
    (item) => item.classification === 'channel_transfer',
  )
  assert.equal(transferCase.recordIds.length, 2)
  assert.equal(
    transferIssue(
      result.glReview.records.filter((row) =>
        transferCase.recordIds.includes(row.id),
      ),
    ),
    null,
  )
  assert.equal(
    cases.filter((item) => item.classification === 'unexplained').length,
    1,
  )
  assert.equal(result.GL_Finance, 96126.95)
  assert.equal(result.Unexplained, 96016.95)
  assert.equal(
    result.glReview.records.filter((record) => record.journalType === 'MANUAL')
      .length,
    15,
  )
})

test('real-engine shared store keeps review decisions and exceptions in one snapshot across apply, retry and undo', async () => {
  const store = createAppStore(period)
  let runs = 0
  store.attachProcessor((selected, dates, options) => {
    runs++
    return engine.processUploads(selected, dates, options)
  })
  store.actions.setFiles(files([adjustment]))
  await store.whenSettled()
  assert.equal(store.getState().status, 'ready', store.getState().error)
  const before = store.getState().reconciliationData
  const initialRunId = before.evidence.runId
  const record = store
    .getState()
    .glReview.records.find((row) => row.journalId === 'JE20250904892')
  const reviewCase = store.getState().reviewCases[0]
  const exception = store
    .getState()
    .exceptionsData.find((item) => item.reference === record.journalId)
  assert.ok(exception.reviewCaseIds.includes(reviewCase.id))
  assert.strictEqual(store.getState().exceptionsData, before.exceptions)
  const originalRuns = runs
  store.actions.updateReviewCase(reviewCase.id, {
    notes: 'Chờ Finance xác nhận',
    owner: 'Finance Ops',
    status: 'reviewed',
  })
  store.actions.requestReviewEvidence([reviewCase.id])
  assert.equal(
    runs,
    originalRuns,
    'classification and notes never trigger financial changes',
  )
  assert.strictEqual(store.getState().reconciliationData, before)
  assert.equal(store.getState().reviewCases[0].status, 'in_progress')
  assert.equal(
    store.getState().reviewCases[0].history.at(-1).action,
    'evidence_requested',
  )
  assert.throws(
    () =>
      store.actions.applyGLCorrection(record.id, { amountCents: -130000 }, ''),
    /lý do/,
  )
  const preview = store.actions.previewGLCorrection(
    record.id,
    { amountCents: -130000 },
    'Chứng từ Finance #42',
  )
  assert.equal(preview.complete, true)
  assert.equal(preview.totalGLDeltaCents, 5000)
  assert.equal(preview.unexplainedDeltaCents, 5000)
  assert.equal(runs, originalRuns)
  store.actions.applyGLCorrection(record.id, preview.patch, preview.reason)
  assert.equal(
    store.getState().reconciliationData,
    null,
    'all displayed financial outputs invalidate immediately',
  )
  assert.deepEqual(store.getState().exceptionsData, [])
  await store.whenSettled()
  const applied = store.getState()
  assert.equal(applied.status, 'ready', applied.error)
  assert.equal(applied.reconciliationData.GL_Finance, before.GL_Finance + 50)
  assert.equal(applied.reconciliationData.Unexplained, before.Unexplained + 50)
  assert.equal(
    applied.glReview.runId,
    applied.reconciliationData.evidence.runId,
  )
  assert.notEqual(applied.glReview.runId, initialRunId)
  assert.strictEqual(
    applied.exceptionsData,
    applied.reconciliationData.exceptions,
  )
  assert.equal(applied.glCorrections.filter((item) => item.active).length, 1)
  const histories = applied.reviewCases.map((item) => item.history)
  store.actions.retry()
  await store.whenSettled()
  assert.equal(
    store.getState().reconciliationData.GL_Finance,
    applied.reconciliationData.GL_Finance,
  )
  assert.equal(store.getState().glCorrections.length, 1)
  assert.deepEqual(
    store.getState().reviewCases.map((item) => item.history),
    histories,
  )
  const undoPreview = store.actions.previewGLUndo(
    record.id,
    'Hoàn tác thử nghiệm kiểm chứng',
  )
  assert.equal(undoPreview.totalGLDeltaCents, -5000)
  store.actions.undoGLCorrection(record.id, undoPreview.reason)
  assert.equal(store.getState().reconciliationData, null)
  await store.whenSettled()
  assert.equal(
    store.getState().reconciliationData.GL_Finance,
    before.GL_Finance,
  )
  assert.equal(
    store.getState().reconciliationData.Unexplained,
    before.Unexplained,
  )
  assert.equal(
    store.getState().glCorrections.filter((item) => item.active).length,
    0,
  )
  assert.equal(
    store.getState().reviewCases[0].history.at(-1).action,
    'correction_reverted',
  )
  store.dispose()
})

test('store diagnostics remain reviewable while invalid source amounts block every dependent total', async () => {
  const store = createAppStore(period)
  store.attachProcessor((selected, dates, options) =>
    engine.processUploads(selected, dates, options),
  )
  store.actions.setFiles(files([adjustment.replace('-1250,', 'invalid,')]))
  await store.whenSettled()
  const blocked = store.getState()
  assert.equal(blocked.status, 'error')
  assert.equal(blocked.reconciliationData, null)
  assert.deepEqual(blocked.exceptionsData, [])
  assert.equal(blocked.glReview.complete, false)
  assert.ok(
    blocked.glReview.diagnostics.some(
      (item) => item.code === 'GL_AMOUNT_INVALID',
    ),
  )
  assert.equal(blocked.reviewCases.length, 1)
  const record = blocked.glReview.records.find(
    (row) => row.journalId === 'JE20250904892',
  )
  store.actions.applyGLCorrection(
    record.id,
    { amountCents: -125000 },
    'Finance xác nhận giá trị từ chứng từ gốc',
  )
  await store.whenSettled()
  assert.equal(store.getState().status, 'ready', store.getState().error)
  assert.equal(store.getState().reconciliationData.GL_Finance, 1360)
  assert.equal(
    store.getState().glReview.records.find((row) => row.id === record.id).raw
      .amount,
    'invalid',
  )
  store.actions.undoGLCorrection(record.id, 'Kiểm tra lại nguồn ban đầu')
  await store.whenSettled()
  assert.equal(store.getState().status, 'error')
  assert.equal(store.getState().reconciliationData, null)
  assert.equal(store.getState().glReview.complete, false)
  store.dispose()
})

test('exact preview includes a missing-GL change when relocating the only journal of a store-day', async () => {
  const store = createAppStore(period)
  store.attachProcessor((selected, dates, options) =>
    engine.processUploads(selected, dates, options),
  )
  store.actions.setFiles(files())
  await store.whenSettled()
  const before = store.getState().reconciliationData
  const record = store
    .getState()
    .glReview.records.find((row) => row.journalId === 'SYS-POS')
  const preview = store.actions.previewGLCorrection(
    record.id,
    { storeKey: 'S19' },
    'Finance yêu cầu rà soát phân bổ lại',
  )
  assert.equal(preview.complete, true)
  assert.equal(preview.totalGLDeltaCents, 0)
  assert.equal(
    preview.unexplainedDeltaCents,
    10000,
    'removing sole source-day GL creates -100 data error and +100 residual',
  )
  store.actions.applyGLCorrection(record.id, preview.patch, preview.reason)
  await store.whenSettled()
  assert.equal(store.getState().status, 'ready', store.getState().error)
  const after = store.getState().reconciliationData
  assert.equal(
    after.cents.GL_Finance - before.cents.GL_Finance,
    preview.totalGLDeltaCents,
  )
  assert.equal(
    after.unexplainedCents - before.unexplainedCents,
    preview.unexplainedDeltaCents,
  )
  assert.equal(after.missingGLEntries, 1)
  store.dispose()
})

test('GL trace coordinates retain physical CSV lines and XLSX sheet/header/blank-row positions', async () => {
  const multiline = adjustment.replace(
    'ADJ-0925 điều chỉnh theo yêu cầu',
    '"ADJ-0925\ndiễn giải nhiều dòng"',
  )
  const shipping =
    'SHIP-TRACE,2025-09-30,2025-09,999999,WEB,WEB,MANUAL,-10,Shipping trace,MJ-SHIP-TRACE'
  const csv = [
    glHeader,
    systemJournals[0],
    '',
    systemJournals[1],
    multiline,
    shipping,
  ].join('\n')
  const fromCSV = await engine.run(files([], { GL: csv }), period)
  const csvAdjustment = fromCSV.glReview.records.find(
    (row) => row.journalId === 'JE20250904892',
  )
  assert.equal(csvAdjustment.sourceRow, 5)
  assert.equal(
    fromCSV.glReview.records.find((row) => row.journalId === 'SHIP-TRACE')
      .sourceRow,
    7,
  )
  assert.equal(
    csvAdjustment.sourceValues.description,
    'ADJ-0925\ndiễn giải nhiều dòng',
  )

  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(
    book,
    XLSX.utils.aoa_to_sheet([
      ['Metadata outside selected data range'],
      [],
      [],
      glHeader.split(','),
      systemJournals[0].split(','),
      [],
      adjustment.split(','),
    ]),
    'GL_Source',
  )
  const selected = files()
  const gl = selected.find((entry) => entry.source === 'GL')
  gl.file = new File(
    [XLSX.write(book, { type: 'array', bookType: 'xlsx' })],
    'Finance.xlsx',
  )
  gl.headerRow = 4
  const fromXLSX = await engine.run(selected, period)
  const xlsxAdjustment = fromXLSX.glReview.records.find(
    (row) => row.journalId === 'JE20250904892',
  )
  assert.equal(xlsxAdjustment.sourceRow, 7)
  assert.equal(xlsxAdjustment.sheetName, 'GL_Source')
  assert.equal(xlsxAdjustment.fileName, 'Finance.xlsx')
  assert.equal(xlsxAdjustment.raw.amount, '-1250')
})

test('configuration changes invalidate bound corrections even when record source values are unchanged', async () => {
  const selected = files([adjustment])
  const original = await engine.run(selected, period)
  const record = original.glReview.records.find(
    (row) => row.journalId === 'JE20250904892',
  )
  const mappings = await Promise.all(
    selected.map(async (entry) => ({
      fileId: entry.id,
      fileName: entry.file.name,
      source: entry.source,
      columns: autoMapColumns(
        parseMappingPreview(await entry.file.arrayBuffer(), 'csv').headers,
        entry.source,
      ),
      ...(entry.source === 'GL' ? { glAmountBasis: 'ledger' } : {}),
    })),
  )
  const correction = {
    id: 'config-bound',
    recordId: record.id,
    sourceFingerprint: record.sourceFingerprint,
    configurationVersion: record.configurationVersion,
    patch: { amountCents: -150000 },
    reason: 'Điều chỉnh được duyệt cho cấu hình cũ',
    appliedAt: '2026-11-12T12:00:00Z',
    active: true,
  }
  const result = await engine.run(selected, period, undefined, {
    columnMappings: mappings,
    glCorrections: [correction],
  })
  const current = result.glReview.records.find((row) => row.id === record.id)
  assert.equal(current.sourceFingerprint, record.sourceFingerprint)
  assert.notEqual(current.configurationVersion, record.configurationVersion)
  assert.equal(current.staleCorrection, true)
  assert.equal(current.revenueCents, 125000)
  assert.equal(result.GL_Finance, original.GL_Finance)
})

test('source replacement reopens shared cases and refuses stale corrections without losing history', async () => {
  const store = createAppStore(period)
  store.attachProcessor((selected, dates, options) =>
    engine.processUploads(selected, dates, options),
  )
  store.actions.setFiles(files([adjustment]))
  await store.whenSettled()
  const record = store
    .getState()
    .glReview.records.find((row) => row.journalId === 'JE20250904892')
  const caseId = store.getState().reviewCases[0].id
  store.actions.applyGLCorrection(
    record.id,
    { amountCents: -130000 },
    'Correction approved for original source',
  )
  await store.whenSettled()
  store.actions.updateReviewCase(caseId, {
    classification: 'other',
    purpose: 'Finance confirmed business adjustment',
    evidence: 'Finance evidence supplied #42',
    evidenceReviewed: true,
    decision: 'Keep original allocation pending a separate allocation decision',
    status: 'confirmed',
  })
  const savedHistoryLength = store.getState().reviewCases[0].history.length
  store.actions.setFiles(files([adjustment.replace('-1250,', '-1500,')]))
  await store.whenSettled()
  const current = store.getState()
  assert.equal(current.status, 'ready', current.error)
  assert.equal(current.reconciliationData.GL_Finance, 1610)
  assert.equal(current.reviewCases[0].id, caseId)
  assert.equal(current.reviewCases[0].status, 'open')
  assert.equal(current.reviewCases[0].stale, true)
  assert.equal(current.reviewCases[0].evidenceReviewed, false)
  assert.ok(current.reviewCases[0].history.length > savedHistoryLength)
  assert.equal(
    current.glReview.records.find((row) => row.id === record.id)
      .staleCorrection,
    true,
  )
  assert.throws(
    () =>
      store.actions.updateReviewCase(caseId, {
        status: 'confirmed',
        evidenceReviewed: true,
      }),
    /chỉnh sửa|nguồn|Nguồn|Chỉnh sửa/,
  )
  store.dispose()
})
