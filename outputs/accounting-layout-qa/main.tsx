import { createRoot } from 'react-dom/client'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from '../../src/components/layout/AppLayout'
import { AccountingReview } from '../../src/pages/AccountingReview'
import { ExceptionLog } from '../../src/pages/ExceptionLog'
import { DataProcessing } from '../../src/pages/DataProcessing'
import { createAppStore, AppStoreContext } from '../../src/lib/store'
import { mockExceptions } from '../../tests/fixtures/exceptions'
import '../../src/index.css'

// Local QA fixture only. No production source or uploaded financial data is used.
const store = createAppStore({ start: '2025-01-01', end: '2025-12-31' })
let run = 0
store.attachProcessor(async (_, __, options) => {
  run++
  const records = Array.from({ length: 72 }, (_, index) => {
    const id = `qa-record-${index}`
    const amountCents = index === 0 ? -125000 : -(23000 + index * 1971)
    const postingDate = `2025-09-${String((index % 28) + 1).padStart(2, '0')}`
    const journalId =
      index === 0
        ? 'JE20250904892'
        : `JE202509-${String(index + 1).padStart(5, '0')}-LONG-REFERENCE`
    const sourceRef = `MJ-INV-2025-09-${String(index + 1).padStart(5, '0')}-FINANCE-SUPPORTING-DOCUMENT`
    const raw = {
      journalId,
      postingDate,
      period: '2025-09',
      storeKey: null,
      storeCode: null,
      channel: 'UNALLOCATED',
      amount: String(amountCents / 100),
      journalType: 'MANUAL',
      sourceRef,
      description:
        index % 2
          ? 'Phí vận chuyển đơn hàng tháng 9, chờ hóa đơn từ đơn vị giao hàng để Finance xác minh và phân bổ.'
          : 'ADJ-0925 điều chỉnh theo yêu cầu — nội dung dài cần xem đầy đủ trong phần chi tiết.',
    }
    const original = {
      postingDate,
      period: '2025-09',
      storeKey: '-1',
      channel: 'UNALLOCATED',
      amountCents,
      revenueCents: -amountCents,
    }
    const correction = options.glCorrections?.find(
      (item) => item.recordId === id && item.active,
    )
    return {
      id,
      sourceFingerprint: `qa-fingerprint-${index}`,
      configurationVersion: 'qa-cfg-v1',
      fileId: 'GL',
      fileName: 'GL-QA-fixture.csv',
      sheetName: 'CSV',
      sourceRow: index + 2,
      sourceRecord: index + 1,
      journalId,
      journalType: 'MANUAL',
      storeCode: null,
      sourceRef,
      description: raw.description,
      amountBasis: 'ledger' as const,
      raw,
      original,
      staleCorrection: false,
      ...original,
      ...correction?.patch,
      revenueCents: -(correction?.patch.amountCents ?? amountCents),
    }
  })
  const snapshot = {
    runId: `qa-run-${run}`,
    configurationVersion: 'qa-cfg-v1',
    complete: true,
    records,
    expectedDaily: [],
    diagnostics: [],
    transformations: records.map((record) => ({
      id: `sign-${record.id}`,
      recordId: record.id,
      journalId: record.journalId,
      rule: 'GL_SIGN',
      sourceField: 'amount_usd',
      outputField: 'revenue_usd',
      before: record.raw.amount,
      after: String(record.revenueCents / 100),
      impactCents: record.revenueCents - record.amountCents,
    })),
  }
  options.onGLSnapshot?.(snapshot)
  const total = records.reduce((sum, record) => sum + record.revenueCents, 0)
  return {
    glReview: snapshot,
    exceptions: mockExceptions,
    schemaMode: 'accounting',
    compatibilityWarnings: [],
    dimTables: [],
    cents: {
      Flash_Sales: 10000,
      Discounts: 0,
      Cancellations: 0,
      Timing_Differences: 0,
      Returns: 0,
      Data_Errors: 0,
      GL_Finance: total,
    },
    Flash_Sales: 100,
    Discounts: 0,
    Cancellations: 0,
    Timing_Differences: 0,
    Returns: 0,
    Data_Errors: 0,
    GL_Finance: total / 100,
    Unexplained: (total - 10000) / 100,
    unexplainedCents: total - 10000,
    period: { start: '2025-01-01', end: '2025-12-31' },
    rowCounts: { POS: 1, WEB: 0, GL: records.length, Flash: 1 },
    dailyDifferences: [],
    dailyDifferenceCount: 0,
  }
})
store.actions.setFiles(
  ['POS', 'WEB', 'GL', 'Flash'].map((source) => ({
    id: source,
    source: source as 'POS' | 'WEB' | 'GL' | 'Flash',
    file: new File(['a\nb'], `${source}.csv`),
  })),
)
await store.whenSettled()
store.actions.closeProcessingPanel()
createRoot(document.getElementById('root')!).render(
  <AppStoreContext.Provider value={store}>
    <HashRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/accounting-review" element={<AccountingReview />} />
          <Route path="/exceptions" element={<ExceptionLog />} />
          <Route path="/processing" element={<DataProcessing />} />
          <Route
            path="*"
            element={<Navigate to="/accounting-review" replace />}
          />
        </Route>
      </Routes>
    </HashRouter>
  </AppStoreContext.Provider>,
)
