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
      plugins: [react()],
      resolve: {
        alias: { '@': fileURLToPath(new URL('../src', import.meta.url)) },
      },
      server: { middlewareMode: true, hmr: false, ws: false, watch: null },
      optimizeDeps: { noDiscovery: true },
      appType: 'custom',
    })
    const React = await import('react')
    const { createRoot } = await import('react-dom/client')
    const { MemoryRouter } = await import('react-router-dom')
    const { act, createElement: h } = React
    const { createAppStore, AppStoreContext } =
      await server.ssrLoadModule('/src/lib/store.ts')
    const { ExcelReferenceButton, ExcelReferenceBanner, ExcelReferenceDialog } =
      await server.ssrLoadModule(
        '/src/components/excel-reference/ExcelReferenceControls.tsx',
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
    const bytes = await readFile(
      new URL('../public/reference/excel-reference.xlsx', import.meta.url),
    )
    expose('fetch', async (url) => {
      assert.match(String(url), /reference\/excel-reference\.xlsx$/)
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
            MemoryRouter,
            { key: path, initialEntries: [path] },
            h(
              AppStoreContext.Provider,
              { value: store },
              h(ExcelReferenceButton),
              h(ExcelReferenceBanner),
              h(ExcelReferenceDialog),
              h(component),
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
      assert.match(unavailable.textContent, /Kết quả tham chiếu Excel/)
      assert.ok(unavailable.textContent.includes(workbook.fileName))
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
