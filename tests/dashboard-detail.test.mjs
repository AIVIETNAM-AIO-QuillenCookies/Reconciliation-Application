import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { JSDOM } from 'jsdom'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'

test('dashboard detail tables search, sort, page and inspect; manual links preserve record and filter context', async () => {
  const dom = new JSDOM('<div id="root"></div>', {
    url: 'http://localhost/',
    pretendToBeVisual: true,
  })
  const saved = new Map()
  for (const name of [
    'window',
    'document',
    'navigator',
    'Node',
    'HTMLElement',
    'HTMLInputElement',
    'Element',
    'Event',
    'MouseEvent',
    'MutationObserver',
    'DocumentFragment',
    'Document',
    'NodeFilter',
    'FocusEvent',
    'ShadowRoot',
    'KeyboardEvent',
    'CustomEvent',
  ]) {
    saved.set(name, Object.getOwnPropertyDescriptor(globalThis, name))
    Object.defineProperty(globalThis, name, {
      configurable: true,
      writable: true,
      value: name === 'window' ? dom.window : dom.window[name],
    })
  }
  for (const [name, value] of [
    ['getComputedStyle', dom.window.getComputedStyle.bind(dom.window)],
    [
      'requestAnimationFrame',
      dom.window.requestAnimationFrame.bind(dom.window),
    ],
    ['cancelAnimationFrame', dom.window.cancelAnimationFrame.bind(dom.window)],
  ]) {
    saved.set(name, Object.getOwnPropertyDescriptor(globalThis, name))
    Object.defineProperty(globalThis, name, {
      configurable: true,
      writable: true,
      value,
    })
  }
  saved.set(
    'IS_REACT_ACT_ENVIRONMENT',
    Object.getOwnPropertyDescriptor(globalThis, 'IS_REACT_ACT_ENVIRONMENT'),
  )
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  let server, root
  try {
    server = await createServer({
      configFile: false,
      cacheDir: 'node_modules/.vite-tests/dashboard-detail',
      plugins: [react()],
      resolve: {
        alias: { '@': fileURLToPath(new URL('../src', import.meta.url)) },
      },
      server: { middlewareMode: true, hmr: false, ws: false, watch: null },
      optimizeDeps: { noDiscovery: true },
      appType: 'custom',
    })
    const { createElement: h, act } = await import('react')
    const { createRoot } = await import('react-dom/client')
    const { MemoryRouter } = await import('react-router-dom')
    const { DetailTab, QualityTab } = await server.ssrLoadModule(
      '/src/components/dashboard/DetailQualityTabs.tsx',
    )
    const { AppStoreContext } = await server.ssrLoadModule('/src/lib/store.ts')
    const stores = Array.from({ length: 25 }, (_, index) => ({
      storeKey: `NX${String(index).padStart(3, '0')}`,
      rawDeltaUSD: index * 10,
      normalizedDeltaUSD: index,
      ratio: index === 0 ? null : 0.02,
      magnitudeUSD: index + 100,
      status: index === 0 ? 'GL bằng 0' : 'Vượt ngưỡng',
      months: ['2025-09'],
      exceptionIds: [`exception-${index}`],
    }))
    const model = {
      available: true,
      source: 'raw',
      selectedMonths: ['2025-09'],
      detail: {
        available: true,
        reason: null,
        stores,
        cells: [],
        trend: [],
        onlineTrend: [],
        rawCellCount: 25,
        cellCount: 100,
        beforeThresholdStores: 25,
        afterThresholdStores: 24,
        onlineDeltaUSD: 0,
      },
      quality: {
        reason: null,
        returnsUSD: 0,
        returnRate: null,
        cancelledOrders: 0,
        removedDuplicateLines: 0,
        monthly: [],
        validations: [],
      },
    }
    const inspected = []
    const detailState = {
      excelReference: { enabled: false },
      reconciliationData: null,
      exceptionsData: [],
      period: { start: '2025-01-01', end: '2025-12-31' },
      status: 'ready',
      reviewCases: [],
      glReview: {
        complete: true,
        records: [
          {
            id: 'pos-selected',
            journalId: 'POS-SELECTED',
            journalType: 'POS_DAILY',
            storeKey: 'NX003',
            period: '2025-09',
            postingDate: '2025-09-15',
            revenueCents: 100000,
            fileName: 'GL.csv',
            sheetName: 'GL',
            sourceRow: 5,
          },
          {
            id: 'pos-other-month',
            journalId: 'POS-OTHER-MONTH',
            journalType: 'POS_DAILY',
            storeKey: 'NX003',
            period: '2025-08',
            postingDate: '2025-08-15',
            revenueCents: 100000,
          },
          {
            id: 'web-excluded',
            journalId: 'WEB-EXCLUDED',
            journalType: 'WEB_DAILY',
            storeKey: 'NX003',
            period: '2025-09',
            postingDate: '2025-09-15',
            revenueCents: 100000,
          },
        ],
      },
    }
    const detailStore = {
      getState: () => detailState,
      subscribe: () => () => {},
      actions: {},
    }
    root = createRoot(document.getElementById('root'))
    await act(async () =>
      root.render(
        h(
          MemoryRouter,
          {
            key: 'detail',
            initialEntries: ['/?tab=detail&from=2025-09&to=2025-09'],
          },
          h(
            AppStoreContext.Provider,
            { value: detailStore },
            h(DetailTab, {
              model,
              onInspect: (value) => inspected.push(value),
            }),
          ),
        ),
      ),
    )
    const storeTable = () =>
      document.querySelector('[aria-label="bảng cửa hàng"] table')
    assert.equal(storeTable().querySelectorAll('tbody tr').length, 20)
    assert.match(storeTable().textContent, /Không xác định/)
    const click = async (element) => {
      assert.ok(element)
      await act(async () => element.click())
    }
    await click(
      document.querySelector('[aria-label="Trang sau của bảng cửa hàng"]'),
    )
    assert.equal(storeTable().querySelectorAll('tbody tr').length, 5)
    const search = document.querySelector(
      '[aria-label="Tìm trong bảng cửa hàng"]',
    )
    await act(async () => {
      Object.getOwnPropertyDescriptor(
        dom.window.HTMLInputElement.prototype,
        'value',
      ).set.call(search, 'NX003')
      search.dispatchEvent(new dom.window.Event('input', { bubbles: true }))
    })
    assert.equal(storeTable().querySelectorAll('tbody tr').length, 1)
    await click(storeTable().querySelector('tbody button'))
    assert.equal(inspected[0].title, 'Cửa hàng NX003')
    assert.match(inspected[0].links[0].to, /q=exception-3/)
    const detailExceptionTarget = new URL(
      inspected[0].links[0].to,
      'http://localhost',
    )
    assert.equal(
      detailExceptionTarget.searchParams.get('record'),
      'exception-3',
    )
    assert.equal(detailExceptionTarget.searchParams.get('from'), 'dashboard')
    assert.equal(
      detailExceptionTarget.searchParams.get('returnTo'),
      '/?tab=detail&from=2025-09&to=2025-09',
    )
    assert.equal(
      inspected[0].rows.filter(
        (row) => row['Mã giao dịch / bút toán'] === 'POS-SELECTED',
      ).length,
      1,
    )
    assert.equal(
      inspected[0].rows.filter(
        (row) => row['Mã giao dịch / bút toán'] === 'POS-OTHER-MONTH',
      ).length,
      0,
    )
    assert.equal(
      inspected[0].rows.filter(
        (row) => row['Mã giao dịch / bút toán'] === 'WEB-EXCLUDED',
      ).length,
      0,
    )
    assert.match(inspected[0].description, /snapshot đầy đủ/)

    const state = {
      excelReference: { enabled: false },
      reconciliationData: null,
      exceptionsData: [],
      period: { start: '2025-01-01', end: '2025-12-31' },
      status: 'ready',
      glReview: {
        complete: true,
        records: [
          {
            id: 'j1',
            journalId: 'MANUAL-01',
            journalType: 'MANUAL',
            period: '2025-09',
            postingDate: '2025-09-30',
            storeKey: '-1',
            storeCode: null,
            channel: 'UNALLOCATED',
            revenueCents: 125000,
            description: 'Adjustment',
            sourceRef: 'DOC-REF',
          },
          {
            id: 'j2',
            journalId: 'MANUAL-02',
            journalType: 'MANUAL',
            period: '2025-08',
            postingDate: '2025-08-31',
            storeKey: 'S1',
            channel: 'STORE',
            revenueCents: 10000,
          },
        ],
      },
      reviewCases: [
        {
          id: 'case-j1',
          recordIds: ['j1'],
          evidenceReviewed: false,
          evidence: '',
          status: 'open',
          stale: false,
        },
      ],
    }
    const store = {
      getState: () => state,
      subscribe: () => () => {},
      actions: {},
    }
    await act(async () =>
      root.render(
        h(
          MemoryRouter,
          {
            key: 'quality',
            initialEntries: ['/?tab=quality&from=2025-09&to=2025-09'],
          },
          h(
            AppStoreContext.Provider,
            { value: store },
            h(QualityTab, {
              model,
              onInspect: (value) => inspected.push(value),
            }),
          ),
        ),
      ),
    )
    assert.match(document.body.textContent, /Chưa có bằng chứng/)
    assert.doesNotMatch(document.body.textContent, /MANUAL-02/)
    const journal = [...document.querySelectorAll('a')].find(
      (link) => link.textContent === 'MANUAL-01',
    )
    const target = new URL(journal.href)
    assert.equal(target.searchParams.get('record'), 'j1')
    assert.equal(target.searchParams.get('case'), 'case-j1')
    assert.equal(
      target.searchParams.get('returnTo'),
      '/?tab=quality&from=2025-09&to=2025-09',
    )
    assert.match(
      document.querySelector('[aria-label="Đơn online bị hủy"]').textContent,
      /0/,
    )
    assert.match(
      document.querySelector('[aria-label="Tỷ lệ hàng trả"]').textContent,
      /—/,
    )
    const { ReferenceExceptions } = await server.ssrLoadModule(
      '/src/components/excel-reference/ReferenceViews.tsx',
    )
    const reference = {
      fileName: 'reference.xlsx',
      months: Array.from(
        { length: 12 },
        (_, index) => `2025-${String(index + 1).padStart(2, '0')}`,
      ),
      bridgeRows: [],
      details: [],
      checks: [],
      toleranceUSD: 0.01,
      sheets: { Nhat_ky_ngoai_le: { columns: ['Mã', 'Mô tả'], rows: [] } },
      exceptions: [
        {
          id: 'EX-05',
          months: ['2025-09'],
          description: 'Khoản điều chỉnh chưa xác minh',
          owner: 'Finance',
          category: 'Chưa giải thích',
          status: 'Cần chứng từ',
          periodLabel: '2025-09',
          sourceRow: 7,
          impactUSD: 1250,
          values: { Mã: 'EX-05', 'Mô tả': 'Khoản điều chỉnh chưa xác minh' },
        },
        {
          id: 'EX-01',
          months: ['2025-03'],
          description: 'Dòng POS trùng',
          owner: 'IT',
          category: 'Lỗi dữ liệu',
          status: 'Cần sửa nguồn',
          periodLabel: '2025-03',
          sourceRow: 3,
          impactUSD: -100,
          values: { Mã: 'EX-01', 'Mô tả': 'Dòng POS trùng' },
        },
      ],
    }
    let sharedPeriodWrites = 0
    const renderReference = async (path) =>
      act(async () =>
        root.render(
          h(
            MemoryRouter,
            { key: path, initialEntries: [path] },
            h(ReferenceExceptions, {
              workbook: reference,
              period: { start: '2025-01-01', end: '2025-12-31' },
              setPeriod: () => sharedPeriodWrites++,
            }),
          ),
        ),
      )
    const referenceQuery = new URLSearchParams({
      id: 'EX-05',
      from: '2025-09',
      to: '2025-09',
      returnTo: '/?tab=bridge&from=2025-09&to=2025-09',
    })
    await renderReference(`/exceptions?${referenceQuery}`)
    assert.match(
      document.querySelector('[role="dialog"]').textContent,
      /EX-05 · Ngoại lệ tham chiếu/,
    )
    assert.doesNotMatch(
      document.querySelector('[role="dialog"]').textContent,
      /Dòng POS trùng/,
    )
    assert.equal(
      [...document.querySelectorAll('a')]
        .find((link) => link.textContent === 'Quay lại dashboard')
        .getAttribute('href'),
      '/?tab=bridge&from=2025-09&to=2025-09',
    )
    assert.equal(
      document.querySelector('[aria-label="Từ tháng tham chiếu"]').value,
      '2025-09',
    )
    await click(
      document.querySelector('[aria-label="Đóng ngoại lệ tham chiếu"]'),
    )
    const monthSelect = document.querySelector(
      '[aria-label="Từ tháng tham chiếu"]',
    )
    await act(async () => {
      Object.getOwnPropertyDescriptor(
        dom.window.HTMLSelectElement.prototype,
        'value',
      ).set.call(monthSelect, '2025-03')
      monthSelect.dispatchEvent(
        new dom.window.Event('change', { bubbles: true }),
      )
    })
    assert.equal(
      sharedPeriodWrites,
      0,
      'trace period controls must never mutate the shared Excel period',
    )
    assert.equal(
      document
        .querySelector('[aria-label="Ngoại lệ tham chiếu Excel"] tbody')
        .querySelectorAll('tr').length,
      2,
    )
    await renderReference(
      '/exceptions?id=EX-01&from=2025-09&to=2025-09&returnTo=//example.com',
    )
    assert.equal(document.querySelector('[role="dialog"]'), null)
    assert.match(
      document.body.textContent,
      /Ngoại lệ EX-01 nằm ngoài kỳ đang chọn/,
    )
    assert.equal(
      [...document.querySelectorAll('a')].find(
        (link) => link.textContent === 'Quay lại dashboard',
      ),
      undefined,
    )

    const { ExceptionLog } = await server.ssrLoadModule(
      '/src/components/dashboard/ExceptionLog.tsx',
    )
    const exceptions = Array.from({ length: 26 }, (_, index) => ({
      id: `exception-${index}`,
      storeKey: 'NX003',
      date: '2025-09-15',
      reference: `REF-${index}`,
      deltaCents: 100000 - index * 100,
      description: `Chi tiết ngoại lệ ${index}`,
      category: 'Missing GL',
      type: 'Missing GL',
      reviewCaseIds: index === 25 ? ['CASE-25'] : [],
    }))
    const renderExceptions = async (path) =>
      act(async () =>
        root.render(
          h(
            MemoryRouter,
            { key: path, initialEntries: [path] },
            h(ExceptionLog, {
              data: exceptions,
              reviewCases: [
                {
                  id: 'CASE-25',
                  status: 'open',
                  stale: false,
                  owner: 'Finance',
                  nextStep: 'Xem nguồn',
                },
              ],
            }),
          ),
        ),
      )
    const savedDashboard = '/?tab=detail&from=2025-09&to=2025-09&channel=STORE'
    const traceParams = new URLSearchParams({
      record: 'exception-25',
      threshold: '0',
      sort: 'impact',
      direction: 'desc',
      from: 'dashboard',
      returnTo: savedDashboard,
    })
    await renderExceptions(`/exceptions?${traceParams}`)
    assert.equal(document.querySelectorAll('.exception-detail-row').length, 1)
    assert.match(
      document.querySelector('.exception-detail-row').textContent,
      /Mã ngoại lệ: exception-25/,
    )
    assert.equal(
      document
        .querySelector('button[aria-label="Xem chi tiết REF-25"]')
        .getAttribute('aria-expanded'),
      'true',
    )
    assert.match(
      document.querySelector('.exception-footer').textContent,
      /Trang 2 \/ 2/,
    )
    const dashboardBack = [...document.querySelectorAll('a')].find(
      (link) => link.textContent === 'Quay lại dashboard',
    )
    assert.equal(dashboardBack.getAttribute('href'), savedDashboard)
    const accounting = new URL(
      document.querySelector('.exception-case-link').getAttribute('href'),
      'http://localhost',
    )
    const exceptionReturn = new URL(
      accounting.searchParams.get('returnTo'),
      'http://localhost',
    )
    assert.equal(accounting.searchParams.get('case'), 'CASE-25')
    assert.equal(exceptionReturn.searchParams.get('record'), 'exception-25')
    assert.equal(exceptionReturn.searchParams.get('threshold'), '0')
    assert.equal(exceptionReturn.searchParams.get('sort'), 'impact')
    assert.equal(exceptionReturn.searchParams.get('direction'), 'desc')
    assert.equal(exceptionReturn.searchParams.get('page'), '2')
    assert.equal(exceptionReturn.searchParams.get('returnTo'), savedDashboard)
    await renderExceptions(
      `${exceptionReturn.pathname}${exceptionReturn.search}`,
    )
    assert.match(
      document.querySelector('.exception-detail-row').textContent,
      /Mã ngoại lệ: exception-25/,
    )

    await renderExceptions(
      '/exceptions?record=exception-25&q=exception-25&threshold=0&returnTo=//example.com',
    )
    assert.equal(
      document.querySelectorAll('tbody tr:not(.exception-detail-row)').length,
      1,
    )
    assert.equal(document.querySelectorAll('.exception-detail-row').length, 1)
    assert.equal(
      [...document.querySelectorAll('a')].find(
        (link) => link.textContent === 'Quay lại dashboard',
      ),
      undefined,
    )
    await renderExceptions('/exceptions?record=NOT-FOUND&threshold=0')
    assert.equal(document.querySelectorAll('.exception-detail-row').length, 0)
    assert.match(document.body.textContent, /Không tìm thấy ngoại lệ NOT-FOUND/)
    await renderExceptions('/exceptions?record=exception-25&threshold=500000')
    assert.equal(document.querySelectorAll('.exception-detail-row').length, 0)
    assert.match(
      document.body.textContent,
      /Ngoại lệ exception-25 nằm ngoài bộ lọc đang chọn/,
    )
  } finally {
    if (root) {
      const { act } = await import('react')
      await act(async () => root.unmount())
    }
    if (server) await server.close()
    dom.window.close()
    for (const [name, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor)
      else delete globalThis[name]
    }
  }
})
