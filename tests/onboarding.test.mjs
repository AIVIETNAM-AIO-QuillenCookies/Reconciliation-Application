import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as XLSX from 'xlsx'
import { createAppStore } from '../src/lib/store.ts'
import {
  MAPPING_FIELDS,
  autoMapColumns,
  confirmedMappingSnapshot,
} from '../src/lib/data-mapping.ts'
import {
  REFERENCE_ROLES,
  defaultRelationship,
  masterFingerprint,
} from '../src/lib/master-data.ts'
import {
  canCompleteOnboarding,
  firstIncompleteStep,
  onboardingStepReady,
} from '../src/lib/onboarding.ts'
import { parseDimMappingPreviews } from '../src/lib/mapping-preview.ts'

const selected = () =>
  ['POS', 'WEB', 'GL', 'Flash'].map((source) => ({
    id: source,
    source,
    file: new File(['header\nvalue'], `${source}.csv`),
  }))
const preview = (source) => ({
  headers: MAPPING_FIELDS[source].map((field) => field.aliases[0]),
  rows: [],
  sheetName: null,
  hasMoreRows: false,
})
function prepare(store, files = selected()) {
  store.actions.setFiles(files)
  for (const file of files)
    if (file.source !== 'Dim')
      store.actions.setFilePreview(
        file.id,
        file.file,
        file.source,
        preview(file.source),
      )
  return files
}

// Store coordination unit tests simulate an executed full-data engine response.
function reviewMaster(store) {
  const file = store.getState().files.find((f) => f.source === 'Dim')
  const master = store.getState().mappingDrafts[file.id].master
  for (const role of REFERENCE_ROLES)
    store.actions.setMasterReference(file.id, role, {
      ...master.roles[role],
      usage: 'not-used',
    })
  const rel = defaultRelationship('store')
  store.actions.setMasterReference(file.id, 'store', {
    usage: 'enabled',
    sheetName: Object.keys(master.sheets)[0],
    columns: { pos_store_id: 'store_key', finance_store_code: 'store_key' },
    relationships: [rel],
  })
  const state = store.getState()
  store.actions.setMasterValidation(file.id, {
    scope: 'full',
    passed: true,
    fingerprint: masterFingerprint(
      state.mappingDrafts[file.id].master,
      state.files,
      confirmedMappingSnapshot(state.files, state.mappingDrafts),
    ),
    errors: [],
    joins: [
      {
        role: 'store',
        relationshipId: rel.id,
        source: 'POS',
        fileId: 'POS',
        rowsBefore: 0,
        rowsAfter: 0,
        errors: [],
      },
    ],
  })
}

test('wizard blocks skipping an incomplete source and preserves drafts across Back and dismiss', async () => {
  const store = createAppStore(undefined, { ingestionMode: 'wizard' })
  let calls = 0
  store.attachProcessor(async () => {
    calls++
    return null
  })
  const files = selected()
  store.actions.openOnboarding()
  store.actions.setOnboardingStep(2)
  assert.equal(store.getState().onboardingStep, 0)
  store.actions.setFiles([files[0]])
  store.actions.setFilePreview('POS', files[0].file, 'POS', preview('POS'))
  assert.equal(
    onboardingStepReady(
      'POS',
      store.getState().files,
      store.getState().mappingDrafts,
    ),
    true,
  )
  store.actions.setOnboardingStep(1)
  assert.equal(store.getState().onboardingStep, 1)
  store.actions.setOnboardingStep(0)
  const columns = store.getState().mappingDrafts.POS.columns
  store.actions.closeOnboarding()
  store.actions.openOnboarding()
  assert.equal(store.getState().onboardingStep, 1)
  assert.deepEqual(store.getState().mappingDrafts.POS.columns, columns)
  await store.whenSettled()
  assert.equal(calls, 0)
  assert.throws(
    () => store.actions.completeOnboarding(),
    /all four required sources/,
  )
  store.dispose()
})

test('final completion closes the wizard and hands all per-file mappings to the processor once', async () => {
  const store = createAppStore(undefined, { ingestionMode: 'wizard' })
  const jobs = []
  store.attachProcessor(async (files, period, options) => {
    jobs.push({ files, period, options })
    files.forEach((file) => options.onFileRegistered(file.id))
    options.onQueryStart()
    return { exceptions: [], cents: {} }
  })
  prepare(store)
  await store.whenSettled()
  assert.equal(jobs.length, 0)
  assert.equal(
    firstIncompleteStep(store.getState().files, store.getState().mappingDrafts),
    4,
  )
  assert.equal(
    canCompleteOnboarding(
      store.getState().files,
      store.getState().mappingDrafts,
    ),
    true,
  )
  store.actions.openOnboarding()
  store.actions.completeOnboarding()
  assert.equal(store.getState().onboardingOpen, false)
  await store.whenSettled()
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].options.columnMappings.length, 4)
  assert.deepEqual(
    jobs[0].options.columnMappings[0].columns,
    autoMapColumns(preview('POS').headers, 'POS'),
  )
  assert.equal(store.getState().status, 'ready')
  store.actions.openOnboarding()
  store.actions.closeOnboarding()
  await store.whenSettled()
  assert.equal(
    jobs.length,
    1,
    'reviewing a completed import does not rerun SQL',
  )
  store.dispose()
})

test('unmapped POS and WEB net do not block Next or completion; required fields still do', () => {
  const store = createAppStore(undefined, { ingestionMode: 'wizard' })
  prepare(store)
  store.actions.openOnboarding()
  store.actions.setOnboardingStep(0)
  for (const source of ['POS', 'WEB']) {
    const columns = { ...store.getState().mappingDrafts[source].columns }
    delete columns.net_amount
    store.actions.setColumnMapping(source, columns)
    assert.equal(
      onboardingStepReady(
        source,
        store.getState().files,
        store.getState().mappingDrafts,
      ),
      true,
    )
    store.actions.setOnboardingStep(source === 'POS' ? 1 : 2)
    assert.equal(store.getState().onboardingStep, source === 'POS' ? 1 : 2)
    for (const required of [
      'gross_amount',
      'discount',
      ...(source === 'POS' ? ['store_key', 'line_no'] : []),
    ]) {
      const missingRequired = { ...columns }
      delete missingRequired[required]
      store.actions.setColumnMapping(source, missingRequired)
      assert.equal(
        onboardingStepReady(
          source,
          store.getState().files,
          store.getState().mappingDrafts,
        ),
        false,
      )
    }
    store.actions.setColumnMapping(source, columns)
  }
  assert.equal(
    canCompleteOnboarding(
      store.getState().files,
      store.getState().mappingDrafts,
    ),
    true,
  )
  store.actions.completeOnboarding()
  for (const source of ['POS', 'WEB'])
    assert.equal(
      store
        .getState()
        .confirmedMappings.find((mapping) => mapping.source === source).columns
        .net_amount,
      undefined,
    )
  store.dispose()
})

test('a confirmed wizard batch waits for engine readiness and edits cancel stale processing', async () => {
  const store = createAppStore(undefined, { ingestionMode: 'wizard' })
  prepare(store)
  store.actions.completeOnboarding()
  assert.equal(store.getState().status, 'waiting')
  let options, resolve
  store.attachProcessor((_, __, callbacks) => {
    options = callbacks
    return new Promise((done) => {
      resolve = done
    })
  })
  await Promise.resolve()
  const pending = store.whenSettled()
  assert.equal(store.getState().status, 'registering')
  const columns = { ...store.getState().mappingDrafts.POS.columns }
  delete columns.date
  store.actions.setColumnMapping('POS', columns)
  assert.equal(options.signal.aborted, true)
  assert.equal(store.getState().confirmedMappings, null)
  options.onQueryStart()
  resolve({ exceptions: [{ id: 'stale' }] })
  await pending
  assert.equal(store.getState().status, 'waiting')
  assert.equal(store.getState().reconciliationData, null)
  assert.deepEqual(store.getState().exceptionsData, [])
  store.dispose()
})

test('Master/Dim is skippable but a selected workbook requires explicit roles, mappings and full validation', () => {
  const store = createAppStore(undefined, { ingestionMode: 'wizard' })
  const files = prepare(store)
  assert.equal(
    canCompleteOnboarding(
      store.getState().files,
      store.getState().mappingDrafts,
    ),
    true,
  )
  const dim = {
    id: 'Dim',
    source: 'Dim',
    file: new File(['workbook'], 'Master.xlsx'),
  }
  store.actions.setFiles([...files, dim])
  assert.equal(
    canCompleteOnboarding(
      store.getState().files,
      store.getState().mappingDrafts,
    ),
    false,
  )
  store.actions.setPreviewError(dim.id, dim.file, 'Dim', 'Invalid workbook')
  assert.throws(() => store.actions.completeOnboarding(), /master data/)
  const sheet = {
    headers: ['store_key'],
    rows: [['S01']],
    sheetName: 'dim_store',
    hasMoreRows: false,
  }
  store.actions.setFilePreview(dim.id, dim.file, 'Dim', sheet, [sheet])
  assert.equal(
    canCompleteOnboarding(
      store.getState().files,
      store.getState().mappingDrafts,
    ),
    false,
  )
  reviewMaster(store)
  assert.equal(
    canCompleteOnboarding(
      store.getState().files,
      store.getState().mappingDrafts,
    ),
    true,
  )
  store.actions.setFiles([...files, dim])
  assert.equal(
    store.getState().mappingDrafts.Dim.dimensionSheets[0].sheetName,
    'dim_store',
  )
  store.actions.setFiles(files)
  assert.equal(
    canCompleteOnboarding(
      store.getState().files,
      store.getState().mappingDrafts,
    ),
    true,
  )
  store.dispose()
})

test('master preview includes every non-empty worksheet and retains original displayed values', () => {
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([]), 'Empty')
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      ['store_code', 'store_key'],
      ['001', 'S01'],
    ]),
    'dim_store',
  )
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([['calendar_date'], ['01/31/2025']]),
    'dim_date',
  )
  const sheets = parseDimMappingPreviews(
    XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }),
    'xlsx',
  )
  assert.deepEqual(
    sheets.map((sheet) => sheet.sheetName),
    ['dim_store', 'dim_date'],
  )
  assert.deepEqual(sheets[0].rows[0], ['001', 'S01'])
  assert.equal(sheets[1].rows[0][0], '01/31/2025')
})

test('clearing a completed wizard import releases old dimension tables without processing unconfirmed facts', async () => {
  const store = createAppStore(undefined, { ingestionMode: 'wizard' })
  const jobs = []
  store.attachProcessor(async (files, _, options) => {
    jobs.push({ files, options })
    return files.length ? { exceptions: [] } : null
  })
  const files = prepare(store)
  const dim = { id: 'Dim', source: 'Dim', file: new File(['data'], 'dim.csv') }
  store.actions.setFiles([...files, dim])
  store.actions.setFilePreview('Dim', dim.file, 'Dim', {
    headers: ['store_key'],
    rows: [],
    sheetName: null,
    hasMoreRows: false,
  })
  reviewMaster(store)
  store.actions.completeOnboarding()
  await store.whenSettled()
  assert.equal(jobs.length, 1)
  store.actions.setFiles([])
  await store.whenSettled()
  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[1].files, [])
  assert.equal(jobs[1].options.canReconcile, false)
  assert.equal(store.getState().status, 'idle')
  store.dispose()
})
