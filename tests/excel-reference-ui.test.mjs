import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { JSDOM } from 'jsdom'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'

test('Excel source replaces all result screens and disabling restores the blocked Raw run', async () => {
  const dom = new JSDOM(
    '<!doctype html><html><body><main id="test-root"></main></body></html>',
    { url: 'http://localhost/', pretendToBeVisual: true },
  )
  const saved = new Map()
  const expose = (name, value) => {
    if (!saved.has(name))
      saved.set(name, Object.getOwnPropertyDescriptor(globalThis, name))
    Object.defineProperty(globalThis, name, {
      configurable: true,
      writable: true,
      value,
    })
  }
  for (const name of [
    'window',
    'document',
    'navigator',
    'Node',
    'HTMLElement',
    'Element',
    'Event',
    'MouseEvent',
    'KeyboardEvent',
    'CustomEvent',
    'MutationObserver',
    'DocumentFragment',
    'Document',
    'NodeFilter',
    'FocusEvent',
    'ShadowRoot',
    ...Object.getOwnPropertyNames(dom.window).filter((name) =>
      /^(HTML|SVG).*Element$/.test(name),
    ),
  ])
    expose(name, name === 'window' ? dom.window : dom.window[name])
  expose('getComputedStyle', dom.window.getComputedStyle.bind(dom.window))
  expose(
    'requestAnimationFrame',
    dom.window.requestAnimationFrame.bind(dom.window),
  )
  expose(
    'cancelAnimationFrame',
    dom.window.cancelAnimationFrame.bind(dom.window),
  )
  expose('IS_REACT_ACT_ENVIRONMENT', true)
  const originalMeasure = dom.window.HTMLElement.prototype.getBoundingClientRect
  dom.window.HTMLElement.prototype.getBoundingClientRect = function () {
    if (this.classList.contains('recharts-responsive-container'))
      return {
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: 760,
        bottom: 220,
        width: 760,
        height: 220,
        toJSON() {},
      }
    return originalMeasure.call(this)
  }
  expose(
    'ResizeObserver',
    class {
      constructor(callback) {
        this.callback = callback
      }
      observe(target) {
        this.callback([{ target, contentRect: target.getBoundingClientRect() }])
      }
      unobserve() {}
      disconnect() {}
    },
  )
  dom.window.HTMLElement.prototype.scrollTo = () => {}
  let server, root, store
  try {
    server = await createServer({
      configFile: false,
      cacheDir: 'node_modules/.vite-tests/excel-reference-ui',
      plugins: [
        react(),
        {
          name: 'test-independent-excel-engine',
          enforce: 'pre',
          load(id) {
            if (id.replaceAll('\\', '/').endsWith('/src/hooks/useDuckDB.tsx'))
              return `export const DuckDBProvider = ({ children }) => children;
                export function useDuckDB() { return { status: 'error', database: null, error: new Error('WASM unavailable'), retry() {} } }`
          },
        },
      ],
      resolve: {
        alias: { '@': fileURLToPath(new URL('../src', import.meta.url)) },
      },
      server: { middlewareMode: true, hmr: false, ws: false, watch: null },
      optimizeDeps: { noDiscovery: true },
      appType: 'custom',
    })
    const React = await import('react')
    const { createRoot } = await import('react-dom/client')
    const { MemoryRouter, Routes, Route } = await import('react-router-dom')
    const { act, createElement: h } = React
    const { createAppStore, AppStoreContext } =
      await server.ssrLoadModule('/src/lib/store.ts')
    const { ExcelReferenceButton, ExcelReferenceBanner, ExcelReferenceDialog } =
      await server.ssrLoadModule(
        '/src/components/excel-reference/ExcelReferenceControls.tsx',
      )
    const { PageInformationProvider, PageInformationButton } =
      await server.ssrLoadModule('/src/components/PageInformation.tsx')
    const { AppLayout } = await server.ssrLoadModule(
      '/src/components/layout/AppLayout.tsx',
    )
    const { GuideWorkspace } = await server.ssrLoadModule(
      '/src/components/guide/GuideWorkspace.tsx',
    )
    const pages = await Promise.all(
      [
        ['Dashboard', '/'],
        ['ExceptionLog', '/exceptions'],
        ['DataProcessing', '/processing?sheet=Chi_tiet'],
        ['Methodology', '/methodology'],
        ['AccountingReview', '/accounting-review'],
      ].map(async ([name, path]) => {
        const module = await server.ssrLoadModule(`/src/pages/${name}.tsx`)
        return { component: module[name], path }
      }),
    )
    store = createAppStore()
    let rawRuns = 0
    store.attachProcessor(async () => {
      rawRuns++
      throw new Error('RAW FLASH SENTINEL')
    })
    store.actions.setFiles(
      ['POS', 'WEB', 'GL', 'Flash'].map((source) => ({
        id: source,
        source,
        file: new File(['fixture'], `${source}.csv`),
      })),
    )
    await store.whenSettled()
    assert.equal(store.getState().status, 'error')
    const raw = store.getState()
    let bytes = await readFile(
      new URL('../public/reference/excel-reference.xlsx', import.meta.url),
    )
    expose('fetch', async (url) => {
      assert.match(String(url), /demo\/Nexa_Home_Recon_Dataset_Final\.xlsx$/)
      return {
        ok: true,
        arrayBuffer: async () =>
          bytes.buffer.slice(
            bytes.byteOffset,
            bytes.byteOffset + bytes.byteLength,
          ),
      }
    })
    root = createRoot(document.getElementById('test-root'))
    const render = async ({ component, path }) =>
      act(async () => {
        root.render(
          h(
            PageInformationProvider,
            null,
            h(
              MemoryRouter,
              { key: path, initialEntries: [path] },
              h(
                AppStoreContext.Provider,
                { value: store },
                h(ExcelReferenceButton),
                h(ExcelReferenceBanner),
                h(ExcelReferenceDialog),
                h(PageInformationButton, { page: path, scope: path }),
                h(component),
              ),
            ),
          ),
        )
      })
    const button = (text) =>
      [...document.querySelectorAll('button')].find(
        (element) => element.textContent.trim() === text,
      )
    const click = async (element) => {
      assert.ok(element)
      await act(async () => element.click())
    }
    await render(pages[0])
    assert.match(document.body.textContent, /RAW FLASH SENTINEL/)
    const ready = new Promise((resolve, reject) => {
      const unsubscribe = store.subscribe(() => {
        const reference = store.getState().excelReference
        if (reference.status === 'ready' || reference.status === 'error') {
          unsubscribe()
          if (reference.error) reject(new Error(reference.error))
          else resolve()
        }
      })
    })
    await act(async () => {
      button('Tạm xem theo Excel').click()
      await ready
    })
    assert.equal(store.getState().excelReference.enabled, true)
    assert.equal(store.getState().excelReference.status, 'ready')
    const progress = document.querySelector(
      '[aria-label="Tiến trình xem thử Excel"]',
    )
    assert.ok(progress)
    assert.equal(progress.querySelectorAll('li').length, 4)
    assert.match(progress.textContent, /58 kiểm tra/)
    assert.match(progress.textContent, /10 ngoại lệ/)
    assert.equal(progress.querySelectorAll('a').length, 6)
    await click(button('Hiển thị dashboard'))
    assert.equal(document.querySelector('[role="dialog"]'), null)
    await click(button('Excel tham chiếu'))
    await click(button('File & tiến trình'))
    assert.ok(document.querySelector('[role="dialog"]'))
    assert.ok(
      document.querySelector('input[aria-label="Chọn workbook tham chiếu"]'),
    )
    await click(document.querySelector('[aria-label="Ẩn tiến trình xem thử"]'))
    const workbook = store.getState().excelReference.workbook
    const salesKpi = () =>
      document.querySelector('[aria-label="Doanh số Sales Flash"] strong')
        .textContent
    assert.match(salesKpi(), /31\.124\.401,00/)
    assert.equal(document.querySelector('.dash-footer'), null)
    assert.equal(document.querySelector('.dash-filters .dash-scope'), null)
    await click(document.querySelector('[aria-label="Thông tin trang"]'))
    const overviewInformation = document.querySelector(
      '.page-information-dialog',
    )
    assert.ok(overviewInformation)
    assert.match(
      overviewInformation.textContent,
      /Quy ước chênh lệch và ngưỡng kiểm tra/,
    )
    assert.match(overviewInformation.textContent, /200 USD/)
    await click(document.querySelector('[aria-label="Đóng thông tin trang"]'))
    assert.equal(document.querySelector('.page-information-dialog'), null)
    assert.match(
      document.querySelector('[aria-label="Chênh lệch GL − Flash"] strong')
        .textContent,
      /[−-]2\.425\.904,77/,
    )
    const runsBeforeFiltering = rawRuns
    const tab = (name) =>
      [...document.querySelectorAll('[role="tab"]')].find((element) =>
        element.textContent.endsWith(name),
      )
    const selectTab = async (name) => {
      const target = tab(name)
      assert.ok(target)
      await act(async () =>
        target.dispatchEvent(
          new dom.window.MouseEvent('mousedown', { bubbles: true, button: 0 }),
        ),
      )
      assert.equal(target.getAttribute('aria-selected'), 'true')
    }
    assert.equal(
      document
        .querySelector('[aria-label="Các trang dashboard"]')
        .querySelectorAll('[role="tab"]').length,
      4,
    )
    await click(button('Bộ lọc khác'))
    assert.equal(
      document.querySelector('select[aria-label="Quốc gia"]').disabled,
      true,
    )
    await click(button('Đóng bộ lọc'))
    const changeMonth = async (label, month) => {
      const select = document.querySelector(`select[aria-label="${label}"]`)
      assert.ok(select)
      await act(async () => {
        select.value = month
        select.dispatchEvent(new dom.window.Event('change', { bubbles: true }))
      })
    }
    await changeMonth('Từ tháng', '2025-09')
    await changeMonth('Đến tháng', '2025-09')
    const septemberSales = workbook.bridgeRows.find(
      (row) => row.kind === 'sales',
    ).monthly['2025-09']
    assert.equal(
      salesKpi(),
      new Intl.NumberFormat('vi-VN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(septemberSales),
    )
    assert.equal(store.getState().period, raw.period)
    assert.deepEqual(store.getState().excelReference.period, {
      start: '2025-01-01',
      end: '2025-12-31',
    })
    for (const name of [
      'Cầu nối chênh lệch',
      'Đối soát chi tiết',
      'Hoàn trả & chất lượng',
      'Tổng quan',
    ]) {
      await selectTab(name)
      assert.equal(
        document.querySelector('[aria-label="Từ tháng"]').value,
        '2025-09',
      )
      assert.equal(
        document.querySelector('[aria-label="Đến tháng"]').value,
        '2025-09',
      )
      assert.equal(
        document.querySelector('[data-dashboard-source]').dataset
          .dashboardSource,
        'excel',
      )
      assert.equal(rawRuns, runsBeforeFiltering)
      if (name === 'Hoàn trả & chất lượng') {
        const cancelled = new Set(
          workbook.details
            .filter((row) => row.code === 'CANCEL' && row.month === '2025-09')
            .map((row) => row.transactionId),
        ).size
        assert.equal(
          document
            .querySelector('[aria-label="Đơn online bị hủy"] .financial-value')
            .textContent.trim(),
          String(cancelled),
        )
        assert.equal(
          document
            .querySelector('[aria-label="Tỷ lệ hàng trả"] .financial-value')
            .textContent.trim(),
          '—',
        )
        assert.equal(
          document
            .querySelector(
              '[aria-label="Dòng POS trùng bị loại"] .financial-value',
            )
            .textContent.trim(),
          '0',
        )
      }
    }
    await selectTab('Cầu nối chênh lệch')
    const shippingRank = [
      ...document.querySelectorAll(
        '[aria-label="Xếp hạng độ lớn ảnh hưởng"] button',
      ),
    ].find(
      (element) =>
        element.querySelector('span')?.textContent === 'Phí vận chuyển',
    )
    assert.ok(shippingRank)
    const shippingSource = workbook.bridgeRows.find((row) =>
      row.detailCodes.includes('SHIP'),
    )
    const septemberShippingMagnitude = Math.abs(
      shippingSource.monthly['2025-09'],
    )
    assert.notEqual(
      septemberShippingMagnitude,
      Object.values(shippingSource.monthly).reduce(
        (sum, amount) => sum + Math.abs(amount),
        0,
      ),
    )
    assert.equal(
      shippingRank.querySelector('strong').textContent,
      new Intl.NumberFormat('vi-VN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(septemberShippingMagnitude),
      'ranking magnitude must use the selected months, not the full year',
    )
    await click(shippingRank)
    const detailDialog = document.querySelector('[role="dialog"]')
    assert.ok(detailDialog)
    assert.match(detailDialog.textContent, /Chi_tiet/)
    assert.match(detailDialog.textContent, /Dòng nguồn/)
    assert.match(detailDialog.textContent, /File/)
    assert.match(detailDialog.textContent, /Sheet \/ bảng/)
    const headers = [...detailDialog.querySelectorAll('thead th')].map(
      (cell) => cell.textContent,
    )
    const detailRows = [...detailDialog.querySelectorAll('tbody tr')].filter(
      (row) => row.textContent.includes('Chi_tiet'),
    )
    assert.equal(
      detailRows.length,
      workbook.details.filter(
        (row) => row.code === 'SHIP' && row.month === '2025-09',
      ).length,
    )
    for (const row of detailRows) {
      const cells = row.querySelectorAll('td')
      assert.equal(
        cells[headers.findIndex((header) => header.includes('Sheet / bảng'))]
          .textContent,
        'Chi_tiet',
      )
      assert.equal(
        cells[headers.findIndex((header) => header === 'Tháng')].textContent,
        '2025-09',
      )
      assert.ok(
        Number(
          cells[headers.findIndex((header) => header.includes('Dòng nguồn'))]
            .textContent,
        ) > 1,
      )
    }
    await click(
      detailDialog.querySelector(
        '[data-slot="sheet-content"] button[data-slot="sheet-close"]',
      ) ??
        [...detailDialog.querySelectorAll('button')].find(
          (element) => element.textContent.trim() === 'Đóng',
        ),
    )
    await selectTab('Đối soát chi tiết')
    assert.match(
      document.body.textContent,
      /Cần dữ liệu POS, WEB, GL và bảng cửa hàng × ngày/,
    )
    await selectTab('Tổng quan')
    assert.ok(
      document.querySelector(
        '[aria-label="Sales Flash và GL theo tháng, USD"]',
      ),
    )
    await click(button('Đặt lại'))
    assert.match(salesKpi(), /31\.124\.401,00/)
    assert.equal(rawRuns, runsBeforeFiltering)
    // The native month selector is the keyboard-accessible chart drill path.
    await changeMonth('Xem chi tiết tháng doanh thu', '2025-09')
    assert.equal(
      document.querySelector('[aria-label="Từ tháng"]').value,
      '2025-09',
    )
    assert.equal(
      document.querySelector('[aria-label="Đến tháng"]').value,
      '2025-09',
    )
    const monthDialog = document.querySelector('[role="dialog"]')
    assert.ok(monthDialog)
    assert.match(monthDialog.textContent, /Đối soát tháng 2025-09/)
    assert.match(monthDialog.textContent, /Sales Flash USD/)
    assert.equal(rawRuns, runsBeforeFiltering)
    await click(
      [...monthDialog.querySelectorAll('button')].find(
        (element) => element.textContent.trim() === 'Đóng',
      ),
    )
    await click(button('Đặt lại'))
    assert.match(salesKpi(), /31\.124\.401,00/)
    for (const page of pages) {
      await render(page)
      assert.match(
        document.body.textContent,
        /(?:Kết quả tham chiếu Excel|Excel tham chiếu)/,
      )
      assert.doesNotMatch(document.body.textContent, /RAW FLASH SENTINEL/)
      assert.equal(store.getState().files, raw.files)
      assert.equal(store.getState().runFailure, raw.runFailure)
      assert.equal(store.getState().pipelineProgress, raw.pipelineProgress)
      assert.equal(store.getState().reviewCases, raw.reviewCases)
    }
    // Rules & Data Model reads as the conventions document with live workbook facts.
    await render(pages[3])
    const conventionPaper = document.querySelector(
      '.reference-methodology .cd-paper',
    )
    assert.ok(conventionPaper)
    assert.match(conventionPaper.textContent, /Áp dụng · Excel tham chiếu/)
    assert.match(conventionPaper.textContent, /Ba bảng của workbook tham chiếu/)
    assert.match(conventionPaper.textContent, /Workbook · USD/)
    assert.match(conventionPaper.textContent, /31\.124\.401,00/)
    assert.match(conventionPaper.textContent, /28\.698\.496,23/)
    assert.ok(
      conventionPaper.textContent.includes(
        `${workbook.bridgeRows.length} dòng`,
      ),
    )
    assert.match(conventionPaper.textContent, /kiểm tra/)
    assert.doesNotMatch(conventionPaper.textContent, /RAW FLASH SENTINEL/)
    await click(
      document.querySelector('button[aria-label="Phóng to tài liệu"]'),
    )
    assert.ok(
      document
        .querySelector('.reference-methodology .cd-shell')
        .classList.contains('is-expanded-view'),
    )
    assert.ok(document.querySelector('.expand-backdrop'))
    await act(async () =>
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })),
    )
    assert.equal(document.querySelector('.is-expanded-view'), null)
    assert.equal(document.querySelector('.expand-backdrop'), null)
    for (const path of [
      '/processing?run=raw-old&table=gl_clean',
      '/processing?sheet=gl_clean',
    ]) {
      await render({ ...pages[2], path })
      const unavailable = document.querySelector('.excel-reference-view')
      assert.match(
        unavailable.textContent,
        /Chưa có dữ liệu tương ứng trong file tham chiếu\./,
      )
      assert.doesNotMatch(unavailable.textContent, /Kết quả tham chiếu Excel/)
      assert.ok(!unavailable.textContent.includes(workbook.fileName))
      await click(document.querySelector('[aria-label="Thông tin trang"]'))
      assert.ok(
        document
          .querySelector('[role="dialog"]')
          .textContent.includes(workbook.fileName),
      )
      await click(document.querySelector('[aria-label="Đóng thông tin trang"]'))
      assert.doesNotMatch(document.body.textContent, /RAW FLASH SENTINEL/)
      assert.equal(document.querySelector('table'), null)
      const sourceLink = [...unavailable.querySelectorAll('a')].find(
        (link) => link.getAttribute('href') === '/processing?sheet=Cau_noi',
      )
      assert.ok(sourceLink)
      await click(sourceLink)
      assert.ok(document.querySelector('table'))
      assert.match(document.querySelector('table').textContent, /Khoản mục/)
      assert.equal(
        document.querySelectorAll('tbody tr').length,
        workbook.sheets.Cau_noi.rows.length,
      )
    }
    await render(pages[1])
    assert.match(document.body.textContent, /EX-05/)
    assert.match(document.body.textContent, /Cần chứng từ/)
    await render(pages[0])
    await click(button('Tắt xem thử · Raw'))
    assert.doesNotMatch(document.body.textContent, /Kết quả tham chiếu Excel/)
    assert.match(document.body.textContent, /RAW FLASH SENTINEL/)
    assert.equal(store.getState().status, 'error')
    assert.equal(store.getState().period, raw.period)
    assert.equal(store.getState().files, raw.files)
    // A source update can arrive while a drawer is open. Its old Excel data
    // must disappear immediately when the active source becomes Raw.
    await act(async () => store.actions.loadExcelReference())
    await click(button('Hiển thị dashboard'))
    await click(button('Excel tham chiếu'))
    const sourceDialog = document.querySelector('[role="dialog"]')
    assert.ok(sourceDialog)
    assert.match(sourceDialog.textContent, /Nguồn Excel tham chiếu/)
    await act(async () => store.actions.disableExcelReference())
    assert.equal(document.querySelector('[role="dialog"]'), null)
    assert.equal(
      document.querySelector('[data-dashboard-source]').dataset.dashboardSource,
      'raw',
    )
    assert.match(document.body.textContent, /RAW FLASH SENTINEL/)
    assert.equal(rawRuns, runsBeforeFiltering)
    assert.equal(store.getState().files, raw.files)
    assert.equal(store.getState().runFailure, raw.runFailure)

    // The default action now reads the full Nexa dataset. Keep the preceding
    // legacy three-sheet regression, then verify all four real dashboard tabs.
    bytes = await readFile(
      new URL(
        '../public/demo/Nexa_Home_Recon_Dataset_Final.xlsx',
        import.meta.url,
      ),
    )
    await act(async () => {
      button('Tạm xem theo Excel').click()
      await new Promise((resolve, reject) => {
        const unsubscribe = store.subscribe(() => {
          const reference = store.getState().excelReference
          if (reference.status === 'ready' || reference.status === 'error') {
            unsubscribe()
            if (reference.error) reject(new Error(reference.error))
            else resolve()
          }
        })
      })
    })
    const nexa = store.getState().excelReference.workbook
    assert.ok(nexa.dashboard)
    assert.equal(nexa.fileName, 'Nexa_Home_Recon_Dataset_Final.xlsx')
    await click(button('Hiển thị dashboard'))
    assert.match(salesKpi(), /31\.124\.401,00/)
    assert.ok(
      document.querySelector('[data-widget-id="overview-matrix"] tbody tr'),
    )
    assert.doesNotMatch(
      document.querySelector('[data-widget-id="overview-matrix"]').textContent,
      /Chưa có bảng Flash và GL phân bổ theo kênh/,
    )
    await selectTab('Cầu nối chênh lệch')
    assert.ok(
      document.querySelector('[aria-label="Xếp hạng độ lớn ảnh hưởng"] button'),
    )
    await selectTab('Đối soát chi tiết')
    const detail = document.querySelector('[data-tour="dashboard-detail"]')
    assert.ok(Number(detail.dataset.cellCount) > 0)
    assert.equal(detail.querySelectorAll('.dash-empty').length, 0)
    assert.ok(
      document.querySelector(
        '[data-widget-id="detail-store-trend"] .recharts-wrapper',
      ),
    )
    assert.ok(
      document.querySelector(
        '[data-widget-id="detail-online-trend"] .recharts-wrapper',
      ),
    )
    assert.ok(
      document.querySelector('[data-widget-id="detail-stores"] tbody tr'),
    )
    await selectTab('Hoàn trả & chất lượng')
    const quality = document.querySelector('[data-tour="dashboard-quality"]')
    assert.equal(quality.dataset.cancelledOrders, '124')
    assert.equal(quality.dataset.duplicateExports, '12')
    assert.equal(quality.dataset.manualJournals, '15')
    assert.equal(
      document
        .querySelector('[aria-label="Tỷ lệ hàng trả"] .financial-value')
        .textContent.trim(),
      '2,21%',
    )
    assert.ok(
      document.querySelector(
        '[data-widget-id="quality-return-rate"] .recharts-wrapper',
      ),
    )
    assert.equal(
      document.querySelectorAll('[aria-label="bút toán tay"] tbody tr').length,
      15,
    )
    assert.match(
      document.querySelector('[data-widget-id="quality-manuals"]').textContent,
      /Chưa xác minh · tham chiếu Excel/,
    )
    const checks = document.querySelector('[data-widget-id="quality-checks"]')
    assert.ok(
      nexa.dashboard.validations.some(
        (row) => row.count == null && !row.status,
      ),
    )
    assert.match(checks.textContent, /Chưa đánh giá/)
    assert.ok(checks.querySelectorAll('tbody tr').length > 0)
    const unknownCheck = [...checks.querySelectorAll('tbody tr')].find((row) =>
      row.textContent.includes('Chưa đánh giá'),
    )
    assert.equal(unknownCheck.querySelectorAll('td')[1].textContent, '—')
    assert.doesNotMatch(quality.textContent, /Chưa có dữ liệu để tính/)

    // The source workspace keeps the precise source value available while
    // presenting readable money and human-readable sheet labels.
    await render({ ...pages[2], path: '/processing?sheet=Cau_noi' })
    const processing = document.querySelector('.reference-processing')
    assert.ok(processing)
    const bridgeTab = processing.querySelector('button[aria-label="Cau_noi"]')
    assert.match(bridgeTab.textContent, /Cầu nối doanh thu/)
    assert.equal(bridgeTab.getAttribute('aria-pressed'), 'true')
    const originalMoney = nexa.bridgeRows.find(
      (row) => row.kind === 'adjustment',
    ).monthly['2025-01']
    const readableMoney = processing.querySelector(
      `td[title="${String(originalMoney)}"]`,
    )
    assert.ok(readableMoney)
    assert.equal(
      readableMoney.textContent,
      new Intl.NumberFormat('vi-VN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(originalMoney),
    )
    assert.equal(readableMoney.title, String(originalMoney))
    await click(processing.querySelector('button[aria-label="Chi_tiet"]'))
    assert.match(
      processing.querySelector('button[aria-label="Chi_tiet"]').textContent,
      /Chi tiết giao dịch/,
    )
    assert.equal(
      processing
        .querySelector('button[aria-label="Chi_tiet"]')
        .getAttribute('aria-pressed'),
      'true',
    )
    assert.deepEqual(
      [...processing.querySelectorAll('thead th')]
        .slice(1)
        .map((column) => column.textContent),
      nexa.sheets.Chi_tiet.columns,
    )

    await render(pages[4])
    const accounting = document.querySelector('.reference-accounting')
    assert.ok(accounting)
    const manualList = accounting.querySelector(
      '[aria-label="Danh sách bút toán tay trong workbook"]',
    )
    const manualRows = [...manualList.querySelectorAll('tbody tr')]
    assert.equal(manualRows.length, 15)
    for (const manual of nexa.dashboard.manuals) {
      const row = manualRows.find((entry) =>
        entry.textContent.includes(manual.journalId),
      )
      assert.ok(row, `missing supplied manual journal ${manual.journalId}`)
      assert.ok(row.querySelector(`td[title="${String(manual.revenueUSD)}"]`))
    }
    const priorityCases = nexa.exceptions.filter((row) =>
      /chứng từ|evidence|chưa giải thích/i.test(
        `${row.status} ${row.category}`,
      ),
    )
    for (const exception of priorityCases) {
      const link = accounting.querySelector(
        `a[href="/exceptions?id=${encodeURIComponent(exception.id)}"]`,
      )
      assert.ok(link)
      assert.match(link.textContent, new RegExp(exception.id))
      assert.ok(
        link.textContent.includes(exception.status),
        'priority status remains the supplied unverified Excel status',
      )
    }
    assert.doesNotMatch(
      accounting.textContent,
      /Mã tham chiếu chưa xác nhận đủ chứng từ/,
    )
    await click(document.querySelector('[aria-label="Thông tin trang"]'))
    const accountingInformation = document.querySelector(
      '.page-information-dialog',
    )
    assert.ok(accountingInformation)
    assert.match(accountingInformation.textContent, /Bút toán tay và chứng từ/)
    assert.match(
      accountingInformation.textContent,
      /Mã tham chiếu chưa xác nhận đủ chứng từ/,
    )
    await click(document.querySelector('[aria-label="Đóng thông tin trang"]'))
    assert.equal(document.querySelector('.page-information-dialog'), null)

    await render(pages[1])
    const exceptionPage = document.querySelector('.reference-exceptions')
    assert.ok(exceptionPage)
    const exceptionRegion = exceptionPage.querySelector(
      '[aria-label="Ngoại lệ tham chiếu Excel"]',
    )
    const exceptionRows = [...exceptionRegion.querySelectorAll('tbody tr')]
    assert.equal(exceptionRows.length, 7)
    assert.deepEqual(
      exceptionRows.map((row) => row.querySelector('td button').textContent),
      nexa.exceptions.map((row) => row.id),
    )
    assert.deepEqual(
      exceptionRows.map(
        (row) => row.querySelector('td:last-child').textContent,
      ),
      nexa.exceptions.map((row) => row.status),
    )
    assert.doesNotMatch(
      exceptionPage.textContent,
      /Nhật ký tham chiếu không xác nhận hoặc đóng/,
    )
    await click(document.querySelector('[aria-label="Thông tin trang"]'))
    const exceptionInformation = document.querySelector(
      '.page-information-dialog',
    )
    assert.ok(exceptionInformation)
    assert.match(
      exceptionInformation.textContent,
      /Ngoại lệ Excel và hồ sơ Raw/,
    )
    assert.match(
      exceptionInformation.textContent,
      /Nhật ký tham chiếu không xác nhận hoặc đóng/,
    )
    assert.doesNotMatch(
      exceptionInformation.textContent,
      /Bút toán tay và chứng từ/,
    )
    assert.doesNotMatch(
      exceptionInformation.textContent,
      /Mã tham chiếu chưa xác nhận đủ chứng từ/,
    )
    await click(document.querySelector('[aria-label="Đóng thông tin trang"]'))
    const exceptionSearch = exceptionPage.querySelector('input[type="search"]')
    await act(async () => {
      Object.getOwnPropertyDescriptor(
        dom.window.HTMLInputElement.prototype,
        'value',
      ).set.call(exceptionSearch, 'EX-05')
      exceptionSearch.dispatchEvent(
        new dom.window.Event('input', { bubbles: true }),
      )
    })
    assert.equal(exceptionRegion.querySelectorAll('tbody tr').length, 1)
    assert.equal(
      exceptionRegion.querySelector('tbody tr td button').textContent,
      'EX-05',
    )
    assert.ok(
      exceptionRegion.textContent.includes(
        nexa.exceptions.find((row) => row.id === 'EX-05').status,
      ),
    )
    assert.equal(rawRuns, runsBeforeFiltering)
    // Verify the actual application chrome, not only isolated result pages.
    await act(async () => {
      root.render(
        h(
          MemoryRouter,
          { initialEntries: ['/processing'] },
          h(
            AppStoreContext.Provider,
            { value: store },
            h(
              GuideWorkspace,
              null,
              h(
                Routes,
                null,
                h(
                  Route,
                  { element: h(AppLayout) },
                  h(Route, {
                    path: '/processing',
                    element: h(pages[2].component),
                  }),
                ),
              ),
            ),
          ),
        ),
      )
    })
    assert.equal(document.querySelector('.excel-source-banner'), null)
    assert.ok(
      document.querySelector(
        '.app-main.app-compact-workspace .reference-processing',
      ),
    )
    assert.ok(
      document.querySelector(
        '.app-header [aria-label="Workbook Excel đang xem"]',
      ),
    )
    assert.equal(
      document.querySelectorAll('[aria-label="Thông tin trang"]').length,
      1,
    )
    assert.doesNotMatch(
      document.querySelector('.app-main').textContent,
      /WASM unavailable/,
    )
    await click(document.querySelector('[aria-label="Thông tin trang"]'))
    const workspaceInformation = document.querySelector('[role="dialog"]')
    assert.match(
      workspaceInformation.textContent,
      /Nexa_Home_Recon_Dataset_Final.xlsx/,
    )
    assert.match(workspaceInformation.textContent, /WASM unavailable/)
    await click(document.querySelector('[aria-label="Đóng thông tin trang"]'))
    await click(
      document.querySelector(
        '.app-header [aria-label="Tắt xem thử · Quay lại xử lý Raw"]',
      ),
    )
    assert.equal(store.getState().excelReference.enabled, false)
    assert.equal(
      document.querySelector(
        '.app-header [aria-label="Workbook Excel đang xem"]',
      ),
      null,
    )
    assert.match(
      document.querySelector('.app-main').textContent,
      /WASM unavailable/,
    )
    await render(pages[0])
    assert.match(document.body.textContent, /RAW FLASH SENTINEL/)
    assert.equal(store.getState().files, raw.files)
    assert.equal(store.getState().runFailure, raw.runFailure)
    assert.equal(store.getState().reviewCases, raw.reviewCases)
  } finally {
    if (root) {
      const { act } = await import('react')
      await act(async () => root.unmount())
    }
    store?.dispose()
    await server?.close()
    dom.window.close()
    for (const [name, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor)
      else delete globalThis[name]
    }
  }
})
