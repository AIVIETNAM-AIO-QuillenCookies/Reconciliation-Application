import assert from 'node:assert/strict'
import { test } from 'node:test'
import { format } from 'node:util'
import { fileURLToPath } from 'node:url'
import { JSDOM } from 'jsdom'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import { mockExceptions } from './fixtures/exceptions.ts'

test('workspace source entry, completion gates, zero results and exception review stay connected', async (t) => {
  // Let deferred focus/viewport work settle between views and modal transitions.
  t.afterEach(async () => {
    const { act } = await import('react')
    await act(
      async () => new Promise((resolve) => requestAnimationFrame(resolve)),
    )
  })
  const dom = new JSDOM(
    '<!doctype html><html><body><main id="main-content" tabindex="-1"></main></body></html>',
    { url: 'http://localhost/', pretendToBeVisual: true },
  )
  const saved = new Map()
  function expose(name, value) {
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
    'HTMLInputElement',
    'HTMLSelectElement',
    'HTMLButtonElement',
    'Element',
    'DocumentFragment',
    'Event',
    'MouseEvent',
    'KeyboardEvent',
    'CustomEvent',
    'MutationObserver',
    'AbortController',
    'AbortSignal',
  ])
    expose(
      name,
      name === 'window'
        ? dom.window
        : name === 'document'
          ? dom.window.document
          : dom.window[name],
    )
  for (const name of Object.getOwnPropertyNames(dom.window).filter((name) =>
    /^(HTML|SVG).*Element$/.test(name),
  ))
    expose(name, dom.window[name])
  for (const name of ['Document', 'NodeFilter', 'FocusEvent', 'ShadowRoot'])
    expose(name, dom.window[name])
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
  dom.window.HTMLElement.prototype.scrollTo = () => {}
  const pending = []
  expose(
    'Worker',
    class {
      terminated = false
      postMessage(request) {
        pending.push({ worker: this, request })
      }
      terminate() {
        this.terminated = true
      }
    },
  )
  const resizeObservers = []
  expose(
    'ResizeObserver',
    class {
      constructor(callback) {
        this.callback = callback
        resizeObservers.push(this)
      }
      observe(target) {
        this.target = target
        if (target.classList.contains('recharts-responsive-container'))
          this.callback([
            { target, contentRect: target.getBoundingClientRect() },
          ])
      }
      unobserve() {}
      disconnect() {}
    },
  )
  const errors = []
  const originalError = console.error
  console.error = (...args) => {
    errors.push(format(...args))
    if (errors.length > 30)
      throw new Error('Too many React errors: ' + errors.at(-1))
  }
  let server, root, store
  try {
    server = await createServer({
      cacheDir: 'node_modules/.vite-tests/workspace-ui',
      configFile: false,
      plugins: [
        react(),
        {
          // Behavioral regressions use stable English labels; the real dictionary
          // and technical-value preservation are verified by localization.test.mjs.
          name: 'test-stable-ui-language',
          enforce: 'pre',
          load(id) {
            if (id.replaceAll('\\', '/').endsWith('/src/lib/i18n.ts'))
              return `export const vi = (text) => text;
                export const viMessage = vi;
                export const explainError = vi;
                export const isVietnameseMessage = () => false;
                export const displayValue = (_, value) => value;
                export const TERMS = {};
                export function vt(parts, ...values) { return parts.reduce((text, part, index) => text + part + (values[index] ?? ''), '') }`
          },
        },
        {
          name: 'test-ready-duckdb',
          enforce: 'pre',
          load(id) {
            if (id.replaceAll('\\', '/').endsWith('/src/hooks/useDuckDB.tsx'))
              return 'export function useDuckDB() { return { status: "ready", database: null, error: null, retry() {} } }'
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
    const { MemoryRouter } = await import('react-router-dom')
    const { OnboardingWizard } = await server.ssrLoadModule(
      '/src/components/ingestion/OnboardingWizard.tsx',
    )
    const { createAppStore, AppStoreContext } =
      await server.ssrLoadModule('/src/lib/store.ts')
    const { MAPPING_FIELDS } = await server.ssrLoadModule(
      '/src/lib/data-mapping.ts',
    )
    const { DataIngestion } = await server.ssrLoadModule(
      '/src/pages/DataIngestion.tsx',
    )
    const { Dashboard } = await server.ssrLoadModule('/src/pages/Dashboard.tsx')
    const { PageInformationProvider, PageInformationButton } =
      await server.ssrLoadModule('/src/components/PageInformation.tsx')
    const { Methodology } = await server.ssrLoadModule(
      '/src/pages/Methodology.tsx',
    )
    const { ExceptionLog } = await server.ssrLoadModule(
      '/src/components/dashboard/ExceptionLog.tsx',
    )
    const { BRIDGE_KEYS } = await server.ssrLoadModule(
      '/src/lib/reconciliation-types.ts',
    )
    const act = React.act
    store = createAppStore(undefined, { ingestionMode: 'wizard' })
    root = createRoot(document.getElementById('main-content'))
    const render = (component, props = {}, wizard = false, path) =>
      root.render(
        React.createElement(
          PageInformationProvider,
          null,
          React.createElement(
            MemoryRouter,
            { key: path, initialEntries: path ? [path] : undefined },
            React.createElement(
              AppStoreContext.Provider,
              { value: store },
              React.createElement(PageInformationButton, {
                page: 'Không gian làm việc',
                scope: path ?? '/',
              }),
              React.createElement(component, props),
              wizard ? React.createElement(OnboardingWizard) : null,
            ),
          ),
        ),
      )
    const byText = (text) =>
      [...document.querySelectorAll('button')].find(
        (button) => button.textContent.trim() === text,
      )
    const makeFile = (source) => ({
      id: source,
      source,
      file: new File(['header\nvalue'], `${source}.csv`),
    })
    const preview = (source) => ({
      headers: MAPPING_FIELDS[source].map((field) => field.aliases[0]),
      rows: [],
      sheetName: null,
      hasMoreRows: false,
    })

    await t.test(
      'source cards open the requested source without auto-opening or bypassing completion',
      async () => {
        await act(async () => render(DataIngestion, {}, true))
        assert.equal(store.getState().onboardingOpen, false)
        assert.equal(document.querySelectorAll('section').length, 5)
        const trigger = document.querySelector(
          'button[aria-label="Add Sales Flash"]',
        )
        trigger.focus()
        await act(async () => trigger.click())
        assert.equal(store.getState().onboardingStep, 3)
        assert.equal(
          document
            .querySelector('[aria-current="step"]')
            .textContent.includes('Sales Flash'),
          true,
        )
        assert.equal(byText('Next Step').disabled, true)
        const flash = makeFile('Flash')
        await act(async () => {
          store.actions.setFiles([flash])
          store.actions.setFilePreview(
            flash.id,
            flash.file,
            flash.source,
            preview('Flash'),
          )
        })
        assert.equal(byText('Next Step').disabled, false)
        await act(async () => byText('Next Step').click())
        assert.equal(store.getState().onboardingStep, 4)
        assert.equal(byText('Run reconciliation').disabled, true)
        assert.throws(
          () => store.actions.completeOnboarding(),
          /all four required/,
        )
        await act(async () =>
          document
            .querySelector('button[aria-label="Close import wizard"]')
            .click(),
        )
        assert.equal(document.activeElement, trigger)
        assert.ok(store.getState().mappingDrafts.Flash.preview)
      },
    )

    await t.test(
      'source cards distinguish reading, header warning, mapping and ready drafts',
      async () => {
        const pos = makeFile('POS')
        await act(async () => store.actions.setFiles([pos]))
        assert.match(document.body.textContent, /Preview pending/)
        await act(async () =>
          store.actions.setPreviewError(
            pos.id,
            pos.file,
            pos.source,
            'Choose another header row',
            'header-row',
            1,
          ),
        )
        assert.match(document.body.textContent, /Needs attention/)
        await act(async () => store.actions.openSourceOnboarding('POS'))
        assert.equal(
          document.querySelectorAll('input[type="number"]').length,
          1,
        )
        assert.match(
          document.querySelector('[role="dialog"]').textContent,
          /Choose another header row/,
        )
        await act(async () => {
          store.actions.setFilePreview(
            pos.id,
            pos.file,
            pos.source,
            preview('POS'),
          )
          store.actions.setColumnMapping(pos.id, {})
          store.actions.closeOnboarding()
        })
        assert.match(document.body.textContent, /Needs mapping/)
        await act(async () =>
          store.actions.setFilePreview(
            pos.id,
            pos.file,
            pos.source,
            preview('POS'),
          ),
        )
        // Explicit edits are authoritative; reset the draft to apply suggestions again.
        await act(async () => {
          store.actions.resetFilePreview(pos.id)
          store.actions.setFilePreview(
            pos.id,
            pos.file,
            pos.source,
            preview('POS'),
          )
        })
        assert.match(document.body.textContent, /Mapping ready/)
      },
    )

    await t.test(
      'wizard retains its shell across upload, mapping, errors, multiple files and Master while scrolling only on context changes',
      async () => {
        await act(async () => {
          store.actions.setFiles([])
          store.actions.openSourceOnboarding('POS')
        })
        const frame = document.querySelector('[role="dialog"]')
        const header = frame.querySelector('.import-wizard-header')
        const footer = frame.querySelector('.import-wizard-footer')
        const navigation = frame.querySelector('.wizard-source-navigation')
        const panel = frame.querySelector('.wizard-content-body')
        const frameClass = frame.className
        const frameStyle = frame.getAttribute('style')
        const resets = []
        panel.scrollTo = ({ top }) => {
          resets.push(top)
          panel.scrollTop = top
        }
        const sameShell = () => {
          assert.strictEqual(document.querySelector('[role="dialog"]'), frame)
          assert.strictEqual(
            frame.querySelector('.import-wizard-header'),
            header,
          )
          assert.strictEqual(
            frame.querySelector('.import-wizard-footer'),
            footer,
          )
          assert.strictEqual(
            frame.querySelector('.wizard-source-navigation'),
            navigation,
          )
          assert.strictEqual(frame.querySelector('.wizard-content-body'), panel)
          assert.equal(frame.className, frameClass)
          assert.equal(frame.getAttribute('style'), frameStyle)
          assert.ok(frame.querySelector('.wizard-step-heading h2'))
          assert.ok(!panel.contains(header) && !panel.contains(footer))
          assert.ok(footer.querySelector('.wizard-footer-back'))
          assert.ok(footer.querySelector('.wizard-footer-next'))
        }
        assert.ok(frame.querySelector('.wizard-dropzone'))
        sameShell()
        const pos = makeFile('POS')
        panel.scrollTop = 180
        await act(async () => store.actions.setFiles([pos]))
        sameShell()
        assert.equal(panel.scrollTop, 0)
        assert.equal(resets.length, 1)
        assert.match(panel.textContent, /Reading/)
        const rowInput = panel.querySelector('input[type="number"]')
        rowInput.focus()
        panel.scrollTop = 210
        await act(async () =>
          store.actions.setFilePreview(
            pos.id,
            pos.file,
            pos.source,
            preview('POS'),
          ),
        )
        sameShell()
        assert.equal(panel.scrollTop, 210)
        assert.equal(resets.length, 1)
        assert.strictEqual(
          panel.querySelector('input[type="number"]'),
          rowInput,
        )
        assert.strictEqual(document.activeElement, rowInput)
        const savedColumns = { ...store.getState().mappingDrafts.POS.columns }
        await act(async () =>
          store.actions.setColumnMapping(pos.id, {
            ...savedColumns,
            net_amount: undefined,
          }),
        )
        assert.equal(panel.scrollTop, 210)
        assert.strictEqual(document.activeElement, rowInput)
        await act(async () =>
          store.actions.setPreviewError(
            pos.id,
            pos.file,
            pos.source,
            'Choose a header row',
            'header-row',
            1,
          ),
        )
        sameShell()
        assert.equal(panel.scrollTop, 210)
        assert.strictEqual(
          panel.querySelector('input[type="number"]'),
          rowInput,
        )
        await act(async () => store.actions.setHeaderRow(pos.id, 5))
        assert.equal(resets.length, 1)
        assert.strictEqual(
          panel.querySelector('input[type="number"]'),
          rowInput,
        )
        await act(async () =>
          store.actions.setFilePreview(pos.id, pos.file, pos.source, {
            ...preview('POS'),
            headerRow: 5,
          }),
        )
        const pos2 = {
          ...makeFile('POS'),
          id: 'POS-second',
          file: new File(['header\nvalue'], 'POS-second.csv'),
        }
        await act(async () => {
          store.actions.setFiles([...store.getState().files, pos2])
          store.actions.setFilePreview(
            pos2.id,
            pos2.file,
            pos2.source,
            preview('POS'),
          )
        })
        sameShell()
        assert.equal(resets.length, 1)
        assert.ok(panel.querySelector('[aria-label="POS file to map"]'))
        assert.equal(
          store.getState().files.find((file) => file.id === 'POS').headerRow,
          5,
        )
        const columnsBeforeNavigation = {
          ...store.getState().mappingDrafts.POS.columns,
        }
        await act(async () => store.actions.openSourceOnboarding('Flash'))
        sameShell()
        assert.equal(panel.scrollTop, 0)
        assert.equal(resets.length, 2)
        assert.strictEqual(
          document.activeElement,
          panel.querySelector('.wizard-step-heading h2'),
        )
        const flash = makeFile('Flash')
        await act(async () => {
          store.actions.setFiles([...store.getState().files, flash])
          store.actions.setFilePreview(
            flash.id,
            flash.file,
            flash.source,
            preview('Flash'),
          )
        })
        sameShell()
        assert.equal(panel.querySelectorAll('input[type="number"]').length, 1)
        const dim = {
          id: 'Dim',
          source: 'Dim',
          file: new File(['test-only fixture'], 'Master.xlsx'),
        }
        await act(async () => {
          store.actions.setFiles([...store.getState().files, dim])
          const reference = {
            headers: ['code', 'ledger'],
            rows: [],
            sheetName: 'Reference',
            headerRow: 1,
            hasMoreRows: false,
          }
          store.actions.setFilePreview(
            dim.id,
            dim.file,
            dim.source,
            reference,
            [reference],
          )
          store.actions.openSourceOnboarding('Dim')
        })
        sameShell()
        assert.ok(
          footer.querySelector(
            '.wizard-footer-secondary button[form="master-configuration-form"]',
          ),
        )
        const heading = panel.querySelector('.wizard-step-heading h2')
        await act(async () =>
          panel
            .querySelector('#master-configuration-form')
            .dispatchEvent(
              new Event('submit', { bubbles: true, cancelable: true }),
            ),
        )
        sameShell()
        assert.ok(panel.querySelector('.configuration-progress'))
        assert.strictEqual(
          panel.querySelector('.wizard-step-heading h2'),
          heading,
        )
        assert.deepEqual(
          store.getState().mappingDrafts.POS.columns,
          columnsBeforeNavigation,
        )
        await act(async () => store.actions.closeOnboarding())
      },
    )

    await t.test(
      'empty dashboard has no amounts and a successful zero snapshot renders zero',
      async () => {
        await act(async () => {
          store.actions.setFiles([])
          render(Dashboard)
        })
        for (const label of [
          'Doanh số Sales Flash',
          'Doanh thu GL',
          'Chênh lệch GL − Flash',
          'Ảnh hưởng lỗi dữ liệu',
          'Khoản chưa giải thích',
        ]) {
          const value = document.querySelector(
            `section[aria-label="${label}"] .financial-value`,
          )
          assert.equal(value.textContent, '\u2014')
        }
        assert.match(
          document.body.textContent,
          /Sẵn sàng kết nối doanh số với sổ cái/,
        )
        const files = ['POS', 'WEB', 'GL', 'Flash'].map(makeFile)
        const result = {
          schemaMode: 'accounting',
          compatibilityWarnings: [],
          dimTables: [],
          exceptions: mockExceptions,
          ...Object.fromEntries(BRIDGE_KEYS.map((key) => [key, 0])),
          cents: Object.fromEntries(BRIDGE_KEYS.map((key) => [key, 0])),
          Unexplained: 0,
          unexplainedCents: 0,
          duplicatePOSLines: 0,
          missingGLEntries: 0,
          duplicatePOSAdjustmentCents: 0,
          missingGLAdjustmentCents: 0,
          rowCounts: { POS: 0, WEB: 0, GL: 0, Flash: 0 },
          posPostingDateFallback: false,
          dailyDifferenceCount: 0,
          dailyDifferences: [],
          period: store.getState().period,
        }
        let processorRuns = 0
        await act(async () => {
          store.attachProcessor(async () => {
            processorRuns++
            return result
          })
          store.actions.setFiles(files)
          files.forEach((file) =>
            store.actions.setFilePreview(
              file.id,
              file.file,
              file.source,
              preview(file.source),
            ),
          )
          store.actions.completeOnboarding()
          await store.whenSettled()
        })
        for (const label of [
          'Doanh số Sales Flash',
          'Doanh thu GL',
          'Chênh lệch GL − Flash',
          'Ảnh hưởng lỗi dữ liệu',
          'Khoản chưa giải thích',
        ])
          assert.equal(
            document.querySelector(
              `section[aria-label="${label}"] .financial-value`,
            ).textContent,
            '0,00',
          )
        assert.doesNotMatch(
          document.body.textContent,
          /Δ \/ Flash: Không xác định/,
        )
        await act(async () =>
          document.querySelector('[aria-label="Thông tin trang"]').click(),
        )
        assert.match(
          document.querySelector('[role="dialog"]').textContent,
          /Δ \/ Flash: Không xác định/,
        )
        await act(async () =>
          document.querySelector('[aria-label="Đóng thông tin trang"]').click(),
        )
        const runsBeforeTabs = processorRuns
        const snapshotBeforeTabs = store.getState().reconciliationData
        const rawPeriodBeforeTabs = store.getState().period
        const selectMonth = async (label, value) => {
          const select = document.querySelector(`select[aria-label="${label}"]`)
          assert.ok(select)
          await act(async () => {
            select.value = value
            select.dispatchEvent(new Event('change', { bubbles: true }))
          })
        }
        await selectMonth('Từ tháng', '2025-09')
        await selectMonth('Đến tháng', '2025-09')
        for (const name of [
          'Cầu nối chênh lệch',
          'Đối soát chi tiết',
          'Hoàn trả & chất lượng',
          'Tổng quan',
        ]) {
          const target = [...document.querySelectorAll('[role="tab"]')].find(
            (element) => element.textContent.endsWith(name),
          )
          assert.ok(target)
          await act(async () =>
            target.dispatchEvent(
              new MouseEvent('mousedown', { bubbles: true, button: 0 }),
            ),
          )
          assert.equal(target.getAttribute('aria-selected'), 'true')
          assert.equal(
            document.querySelector('[aria-label="Từ tháng"]').value,
            '2025-09',
          )
          assert.equal(
            document.querySelector('[aria-label="Đến tháng"]').value,
            '2025-09',
          )
          assert.strictEqual(
            store.getState().reconciliationData,
            snapshotBeforeTabs,
          )
          assert.strictEqual(store.getState().period, rawPeriodBeforeTabs)
          assert.equal(processorRuns, runsBeforeTabs)
        }
        assert.deepEqual(store.getState().exceptionsData, mockExceptions)
        await act(async () => {
          byText('Đặt lại').click()
          store.actions.setColumnMapping('POS', {})
        })
        assert.equal(
          document.querySelector(
            'section[aria-label="Doanh số Sales Flash"] .financial-value',
          ).textContent,
          '\u2014',
        )
        assert.deepEqual(store.getState().exceptionsData, [])
      },
    )

    await t.test(
      'exception review keeps strict threshold, pagination and structured traceability',
      async () => {
        const boundary = {
          ...mockExceptions[0],
          id: 'BOUNDARY',
          reference: 'EXACT-200',
          deltaCents: 20_000,
        }
        const linked = {
          ...mockExceptions[0],
          reviewCaseIds: ['CASE-ONE'],
        }
        const extraRows = Array.from({ length: 23 }, (_, index) => ({
          ...mockExceptions[1],
          id: `BATCH-${index}`,
          reference: `BATCH-REF-${index}`,
          storeKey: 'NX999',
        }))
        const rows = [
          linked,
          ...mockExceptions.slice(1),
          ...extraRows,
          boundary,
        ]
        await act(async () =>
          render(ExceptionLog, {
            data: rows,
            reviewCases: [
              {
                id: 'CASE-ONE',
                owner: 'Lan – Finance',
                nextStep: 'Đối chiếu hóa đơn',
                status: 'in_progress',
                stale: false,
              },
            ],
          }),
        )
        assert.doesNotMatch(
          document.querySelector('tbody').textContent,
          /EXACT-200/,
        )
        assert.equal(document.querySelectorAll('tbody tr').length, 20)
        assert.match(document.body.textContent, /Lan – Finance/)
        assert.match(document.body.textContent, /Đối chiếu hóa đơn/)
        assert.match(document.body.textContent, /Đang xử lý/)
        const caseLink = document.querySelector('.exception-case-link')
        assert.ok(caseLink)
        const destination = new URL(
          caseLink.getAttribute('href'),
          'http://localhost',
        )
        assert.equal(destination.pathname, '/accounting-review')
        assert.equal(destination.searchParams.get('case'), 'CASE-ONE')
        const returnContext = new URL(
          destination.searchParams.get('returnTo'),
          'http://localhost',
        )
        assert.equal(returnContext.pathname, '/exceptions')
        assert.equal(returnContext.searchParams.get('tab'), 'differences')
        assert.equal(returnContext.searchParams.get('threshold'), '20000')
        const row = document.querySelector(
          'button[aria-label="Xem chi tiết POS-NX007-0329"]',
        )
        await act(async () => row.click())
        assert.equal(row.getAttribute('aria-expanded'), 'true')
        const detail = document.getElementById(
          row.getAttribute('aria-controls'),
        )
        assert.match(detail.textContent, /12 duplicate POS lines/)
        assert.match(detail.textContent, /EXC-001/)
        assert.match(detail.textContent, /không cộng số tiền hồ sơ/)
        let downloadedBlob
        const originalCreateURL = URL.createObjectURL
        const originalAnchorClick = dom.window.HTMLAnchorElement.prototype.click
        try {
          URL.createObjectURL = (blob) => {
            downloadedBlob = blob
            return 'blob:test-download'
          }
          dom.window.HTMLAnchorElement.prototype.click = () => {}
          await act(async () => byText('Xuất CSV').click())
          const csv = await downloadedBlob.text()
          const expected = rows.filter(
            (item) => Math.abs(item.deltaCents) > 20_000,
          )
          assert.ok(expected.length > 20)
          for (const item of expected)
            assert.ok(
              csv.includes(item.id),
              `Export includes ${item.id} beyond pagination`,
            )
          assert.ok(!csv.includes('EXACT-200'))
          assert.match(csv, /DRAFT_REVIEW_REQUIRED/)
        } finally {
          URL.createObjectURL = originalCreateURL
          dom.window.HTMLAnchorElement.prototype.click = originalAnchorClick
        }
        await act(async () =>
          document.querySelector('button[aria-label="Trang sau"]').click(),
        )
        assert.match(document.body.textContent, /Trang 2 \/ 2/)
        await act(async () => {
          const search = document.querySelector('.exception-search input')
          Object.getOwnPropertyDescriptor(
            HTMLInputElement.prototype,
            'value',
          ).set.call(search, 'NX057')
          search.dispatchEvent(new Event('input', { bubbles: true }))
        })
        assert.equal(document.querySelectorAll('tbody tr').length, 1)
        assert.match(
          document.querySelector('tbody').textContent,
          /GL-NX057-1121/,
        )
        assert.match(document.body.textContent, /Trang 1 \/ 1/)
        await act(async () => byText('Xóa bộ lọc').click())
        assert.equal(document.querySelectorAll('tbody tr').length, 20)
        await act(async () =>
          render(
            ExceptionLog,
            { data: rows },
            false,
            '/exceptions?tab=differences&q=NX057&category=Missing%20GL&threshold=0&sort=date&direction=asc&page=1&rows=10',
          ),
        )
        assert.equal(
          document.querySelector('.exception-search input').value,
          'NX057',
        )
        assert.equal(
          document.querySelector('select[aria-label="Loại ngoại lệ"]').value,
          'Missing GL',
        )
        assert.equal(
          document.querySelector('select[aria-label="Số dòng mỗi trang"]')
            .value,
          '10',
        )
        assert.equal(document.querySelectorAll('tbody tr').length, 1)
        assert.match(document.body.textContent, /\$0\.00/)
        assert.ok(document.querySelector('th[aria-sort="ascending"]'))
      },
    )
    await t.test(
      'Rules & Data Model renders without a run and exposes accounting rules without inventing evidence',
      async () => {
        await act(async () => {
          store.actions.setFiles([])
          render(Methodology)
        })
        await act(async () =>
          document.getElementById('model-tab-sources').click(),
        )
        assert.match(
          document.body.textContent,
          /Confirmed Master \/ Dim relationships/,
        )
        assert.match(
          document.body.textContent,
          /Run reconciliation to inspect the actual configuration/,
        )
        assert.ok(
          document.querySelector(
            'section[aria-label="Interactive data pipeline"]',
          ),
        )
        await act(async () =>
          document.getElementById('model-tab-evidence').click(),
        )
        assert.match(
          document.body.textContent,
          /Explore your next successful run/,
        )
        assert.doesNotMatch(document.body.textContent, /Full validation passed/)
      },
    )
    await t.test(
      'model workspace keeps tab selections contextual, filters real metadata, copies expressions and navigates between rules and nodes',
      async () => {
        const { methodologyRules } = await server.ssrLoadModule(
          '/src/lib/methodology.ts',
        )
        const tab = (id) => document.getElementById(`model-tab-${id}`)
        const inspector = () => document.querySelector('.mw-inspector')
        const heading = () => inspector().querySelector('h2').textContent
        const click = async (element) => {
          assert.ok(element)
          await act(async () => element.click())
        }
        const select = async (label, value) =>
          act(async () => {
            const element = document.querySelector(
              `select[aria-label="${label}"]`,
            )
            assert.ok(element)
            element.value = value
            element.dispatchEvent(new Event('change', { bubbles: true }))
          })
        const input = async (label, value) =>
          act(async () => {
            const element = document.querySelector(
              `input[aria-label="${label}"]`,
            )
            Object.getOwnPropertyDescriptor(
              HTMLInputElement.prototype,
              'value',
            ).set.call(element, value)
            element.dispatchEvent(new Event('input', { bubbles: true }))
          })
        await click(tab('pipeline'))
        await click(
          document.querySelector('.mw-canvas-world [data-node-id="vw_pos"]'),
        )
        assert.equal(heading(), 'POS keeper lines')
        await click(tab('rules'))
        assert.equal(heading(), 'Every rule has a reason')
        assert.equal(
          document.querySelectorAll('.mw-rule-row').length,
          methodologyRules.length,
        )
        const pickRule = (id) =>
          document.querySelector(`button[data-rule-id="${id}"]`)
        await click(pickRule('pos-dedup'))
        assert.equal(heading(), 'Keep the earliest POS export')
        assert.match(inspector().textContent, /Definition/)
        assert.doesNotMatch(inspector().textContent, /Applied/)
        await click(tab('pipeline'))
        assert.equal(heading(), 'POS keeper lines')
        await click(tab('rules'))
        assert.equal(heading(), 'Keep the earliest POS export')
        await input('Search rules', 'Normalize the finance sign')
        assert.equal(document.querySelectorAll('.mw-rule-row').length, 1)
        assert.equal(heading(), 'Every rule has a reason')
        await input('Search rules', 'no such rule 123')
        assert.match(
          document.querySelector('.mw-rule-browser').textContent,
          /No matching rules/,
        )
        await click(
          [...document.querySelectorAll('.mw-rule-browser button')].find(
            (b) => b.textContent.trim() === 'Clear filters',
          ),
        )
        await select('Filter rules by source', 'WEB')
        await select('Filter rules by group', 'Amounts')
        assert.equal(document.querySelectorAll('.mw-rule-row').length, 1)
        await click(pickRule('net-precedence'))
        assert.equal(heading(), 'Honor mapped net amounts')
        const clipboard = Object.getOwnPropertyDescriptor(
          navigator,
          'clipboard',
        )
        let copied
        Object.defineProperty(navigator, 'clipboard', {
          configurable: true,
          value: {
            writeText: async (value) => {
              copied = value
            },
          },
        })
        try {
          // Re-render exposes the supported clipboard capability.
          await click(tab('pipeline'))
          await click(tab('rules'))
          await click(
            [...inspector().querySelectorAll('summary')].find(
              (s) => s.textContent === 'Technical expression',
            ),
          )
          await click(
            inspector().querySelector('[aria-label="Copy expression"]'),
          )
          assert.equal(
            copied,
            methodologyRules.find((r) => r.id === 'net-precedence').technical,
          )
        } finally {
          if (clipboard)
            Object.defineProperty(navigator, 'clipboard', clipboard)
          else delete navigator.clipboard
        }
        await click(
          [...inspector().querySelectorAll('button')].find(
            (b) => b.textContent.trim() === 'POS keeper lines',
          ),
        )
        await act(async () => new Promise((resolve) => setTimeout(resolve, 40)))
        assert.equal(tab('pipeline').getAttribute('aria-selected'), 'true')
        assert.equal(heading(), 'POS keeper lines')
        await click(
          [...inspector().querySelectorAll('button')].find(
            (b) => b.textContent.trim() === 'Honor mapped net amounts',
          ),
        )
        assert.equal(tab('rules').getAttribute('aria-selected'), 'true')
        assert.equal(
          document.querySelectorAll('.mw-rule-row').length,
          methodologyRules.length,
        )
        assert.equal(heading(), 'Honor mapped net amounts')
      },
    )
    await t.test(
      'canvas controls pan, zoom, fit after resize, reset, select connections and expose mobile grouped navigation with a drawer',
      async () => {
        const click = async (e) => {
          assert.ok(e)
          await act(async () => e.click())
        }
        await click(document.getElementById('model-tab-pipeline'))
        const surface = document.querySelector('.mw-canvas-surface')
        const world = document.querySelector('.mw-canvas-world')
        const zoom = () =>
          Number(
            document
              .querySelector('output[aria-label="Canvas zoom"]')
              .textContent.replace('%', ''),
          )
        const button = (label) =>
          document.querySelector(`button[aria-label="${label}"]`)
        await click(button('Reset view'))
        assert.equal(zoom(), 100)
        await click(button('Zoom in'))
        assert.equal(zoom(), 120)
        await click(button('Zoom out'))
        assert.equal(zoom(), 100)
        const beforePan = world.style.transform
        await act(async () => {
          surface.dispatchEvent(
            new MouseEvent('pointerdown', {
              bubbles: true,
              clientX: 100,
              clientY: 100,
              button: 0,
            }),
          )
          surface.dispatchEvent(
            new MouseEvent('pointermove', {
              bubbles: true,
              clientX: 170,
              clientY: 130,
              button: 0,
            }),
          )
          surface.dispatchEvent(
            new MouseEvent('pointerup', { bubbles: true, button: 0 }),
          )
        })
        assert.notEqual(world.style.transform, beforePan)
        const observer = resizeObservers.findLast((o) => o.target === surface)
        assert.ok(observer)
        await act(async () =>
          observer.callback([{ contentRect: { width: 736, height: 450 } }]),
        )
        await click(button('Fit view'))
        const smallFit = zoom()
        assert.ok(smallFit < 100)
        await act(async () =>
          observer.callback([{ contentRect: { width: 980, height: 650 } }]),
        )
        await click(button('Fit view'))
        assert.ok(zoom() > smallFit)
        await act(async () =>
          surface.dispatchEvent(
            new KeyboardEvent('keydown', { key: '0', bubbles: true }),
          ),
        )
        assert.equal(zoom(), 100)
        const beforeKey = world.style.transform
        await act(async () =>
          surface.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
          ),
        )
        assert.notEqual(world.style.transform, beforeKey)
        await act(async () =>
          document
            .querySelector('[data-edge-id="pos-normalize"] [role="button"]')
            .dispatchEvent(new MouseEvent('click', { bubbles: true })),
        )
        assert.equal(
          document.querySelector('.mw-inspector h2').textContent,
          'Type & rank exports',
        )
        assert.match(
          document.querySelector('.mw-inspector').textContent,
          /Cardinality/,
        )
        const original = window.matchMedia
        window.matchMedia = (query) => ({
          matches: query.includes('1099'),
          addEventListener() {},
          removeEventListener() {},
        })
        try {
          const mobileGroup = [
            ...document.querySelectorAll('.mw-stage-group > button'),
          ].find((b) => b.textContent.startsWith('Sources'))
          await click(mobileGroup)
          if (mobileGroup.getAttribute('aria-expanded') !== 'true')
            await click(mobileGroup)
          await click(
            document.querySelector(
              '.mw-mobile-overview [data-node-id="raw_pos"]',
            ),
          )
          const dialog = document.querySelector('[role="dialog"]')
          assert.ok(dialog)
          assert.equal(
            dialog.querySelector('h2:not(.sr-only)').textContent,
            'POS source projection',
          )
          await click(
            [...dialog.querySelectorAll('button')].find(
              (b) => b.textContent.trim() === 'Close',
            ),
          )
          assert.equal(document.querySelector('[role="dialog"]'), null)
          await click(
            document.querySelector(
              '.mw-mobile-overview [data-node-id="raw_pos"]',
            ),
          )
          assert.ok(document.querySelector('[role="dialog"]'))
          window.matchMedia = () => ({ matches: false })
          await act(async () => window.dispatchEvent(new Event('resize')))
          assert.equal(document.querySelector('[role="dialog"]'), null)
        } finally {
          window.matchMedia = original
        }
      },
    )
    await t.test(
      'evidence selection follows the current table, filters and run without changing stored accounting results',
      async () => {
        let run = 0
        const table = (id, source, rows) => ({
          id,
          label:
            id === 'vw_pos' ? 'POS keeper lines' : 'Finance revenue journals',
          source,
          kind: 'normalized',
          grain: 'One retained source record',
          rowCount: rows.length,
          rows,
          truncated: false,
          columns: [
            'transaction_id',
            'source',
            'event_type',
            'revenue_usd',
          ].map((name) => ({ name, type: 'VARCHAR' })),
        })
        await act(async () => {
          store.attachProcessor(async (_, period) => ({
            exceptions: [],
            evidence: {
              runId: `ui-run-${++run}`,
              period,
              previewLimit: 50,
              scope: 'Bounded integration-test fixture',
              sourceRowNote: 'Fixture source records',
              files: [],
              validations: [],
              ruleApplications: [
                {
                  id: 'pos-dedup',
                  status: 'applied',
                  detail: 'Executed fixture evidence',
                },
              ],
              tables: [
                table('vw_pos', 'POS', [
                  {
                    transaction_id: '001',
                    source: 'POS',
                    event_type: 'sale',
                    revenue_usd: '89.00',
                    applied_rule_ids: 'net-precedence',
                    input_values: JSON.stringify({
                      gross_usd_daily: '100.00',
                      discount_usd_daily: '11.00',
                      net_usd_month_end: '89.00',
                    }),
                  },
                  {
                    transaction_id: '002',
                    source: 'POS',
                    event_type: 'sale',
                    revenue_usd: '178.00',
                  },
                ]),
                table('vw_gl', 'GL', [
                  {
                    transaction_id: 'J1',
                    source: 'GL',
                    event_type: 'journal',
                    revenue_usd: '267.00',
                  },
                ]),
              ],
            },
          }))
        })
        await act(async () => {
          const files = ['POS', 'WEB', 'GL', 'Flash'].map(makeFile)
          store.actions.setFiles(files)
          files.forEach((f) =>
            store.actions.setFilePreview(
              f.id,
              f.file,
              f.source,
              preview(f.source),
            ),
          )
          store.actions.completeOnboarding()
          await store.whenSettled()
        })
        const snapshot = JSON.stringify([
          store.getState().confirmedMappings,
          store.getState().reconciliationData,
        ])
        const click = async (e) => {
          assert.ok(e)
          await act(async () => e.click())
        }
        await click(document.getElementById('model-tab-rules'))
        await click(
          document.querySelector('button[data-rule-id="net-precedence"]'),
        )
        await click(document.getElementById('model-tab-evidence'))
        await click(
          document.querySelector(
            '[aria-label="Inspect record 2 from POS keeper lines"]',
          ),
        )
        assert.equal(
          document.querySelector('.mw-inspector h2').textContent,
          'Record 2',
        )
        assert.match(
          document.querySelector('.mw-inspector').textContent,
          /178.00/,
        )
        await act(async () => {
          const input = document.querySelector(
            '[aria-label="Search bounded preview"]',
          )
          Object.getOwnPropertyDescriptor(
            HTMLInputElement.prototype,
            'value',
          ).set.call(input, '001')
          input.dispatchEvent(new Event('input', { bubbles: true }))
        })
        assert.equal(
          document.querySelector('.mw-inspector h2').textContent,
          'POS keeper lines',
        )
        assert.equal(
          document.querySelectorAll('.mw-evidence .mw-data-table tbody tr')
            .length,
          1,
        )
        await click(
          document.querySelector('[aria-label="Clear evidence search"]'),
        )
        await click(
          document.querySelector(
            '[aria-label="Inspect record 1 from POS keeper lines"]',
          ),
        )
        await click(document.getElementById('model-tab-rules'))
        assert.equal(
          document.querySelector('.mw-inspector h2').textContent,
          'Honor mapped net amounts',
        )
        await click(document.getElementById('model-tab-evidence'))
        assert.equal(
          document.querySelector('.mw-inspector h2').textContent,
          'Record 1',
        )
        await act(async () => {
          const select = document.querySelector(
            '[aria-label="Table or logical view"]',
          )
          select.value = 'vw_gl'
          select.dispatchEvent(new Event('change', { bubbles: true }))
        })
        assert.equal(
          document.querySelector('.mw-inspector h2').textContent,
          'Finance revenue journals',
        )
        await click(
          document.querySelector(
            '[aria-label="Inspect record 1 from Finance revenue journals"]',
          ),
        )
        assert.equal(
          JSON.stringify([
            store.getState().confirmedMappings,
            store.getState().reconciliationData,
          ]),
          snapshot,
        )
        await act(async () => {
          store.actions.setPeriod({ start: '2025-03-01', end: '2025-03-31' })
          await store.whenSettled()
        })
        assert.equal(
          document.querySelector('.mw-inspector h2').textContent,
          'Look inside a record',
        )
      },
    )
    await t.test(
      'source inventory, record proof, presentation and printable snapshot remain read only and invalidate with data',
      async () => {
        const before = JSON.stringify(store.getState().reconciliationData)
        const runId = store.getState().reconciliationData.evidence.runId
        await act(async () =>
          document.getElementById('model-tab-rules').click(),
        )
        await act(async () =>
          document
            .querySelector(
              'button[aria-label="Inspect rule: Honor mapped net amounts"]',
            )
            .click(),
        )
        const sample = document.querySelector(
          'select[aria-label="Evidence record for selected rule"]',
        )
        assert.ok(sample)
        await act(async () => {
          sample.value = 'vw_pos:0'
          sample.dispatchEvent(new Event('change', { bubbles: true }))
        })
        const proof = document.querySelector('.mw-inspector .mw-record-proof')
        assert.ok(proof)
        assert.match(proof.textContent, /100.00/)
        assert.match(proof.textContent, /89.00/)
        assert.match(proof.textContent, /APPLIED LOGIC/)
        await act(async () =>
          [...document.querySelectorAll('.mw-inspector button')]
            .find((button) => button.textContent.trim() === 'POS keeper lines')
            .click(),
        )
        await act(async () =>
          [...document.querySelectorAll('.mw-inspector button')]
            .find(
              (button) =>
                button.textContent.trim() === 'Explore retained output rows',
            )
            .click(),
        )
        assert.equal(
          document
            .getElementById('model-tab-evidence')
            .getAttribute('aria-selected'),
          'true',
        )
        assert.equal(
          document.querySelector('[aria-label="Table or logical view"]').value,
          'vw_pos',
        )

        await act(async () =>
          document.getElementById('model-tab-sources').click(),
        )
        assert.match(
          document.querySelector('.mw-sources').textContent,
          /POS.csv/,
        )
        assert.match(
          document.querySelector('.mw-sources').textContent,
          /Field mapping/,
        )
        await act(async () =>
          document
            .querySelector(
              '.mw-sources button[aria-label="Inspect source POS"]',
            )
            .click(),
        )
        assert.equal(
          document.querySelector('.mw-inspector h2').textContent,
          'POS source projection',
        )
        const toggle = document.querySelector(
          'button[aria-label="Toggle presentation mode"]',
        )
        await act(async () => toggle.click())
        assert.equal(toggle.getAttribute('aria-pressed'), 'true')
        assert.ok(document.querySelector('.mw-workspace.mw-presentation'))
        await act(async () =>
          toggle.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
          ),
        )
        assert.equal(toggle.getAttribute('aria-pressed'), 'false')
        assert.equal(document.activeElement, toggle)
        const originalPrint = window.print
        let printed = 0
        try {
          window.print = () => printed++
          await act(async () =>
            document
              .querySelector(
                'button[aria-label="Print or save methodology as PDF"]',
              )
              .click(),
          )
          assert.equal(printed, 1)
        } finally {
          window.print = originalPrint
        }
        const printDocument = document.querySelector('.mw-print-document')
        assert.equal(printDocument.querySelectorAll('h2').length, 7)
        assert.ok(printDocument.textContent.includes(runId))
        assert.match(printDocument.textContent, /eDA_Sale, We Analyze/)
        assert.match(
          printDocument.textContent,
          /not included or independently verified/,
        )
        assert.equal(
          JSON.stringify(store.getState().reconciliationData),
          before,
        )
        await act(async () => store.actions.setFiles([]))
        assert.equal(
          document.querySelector(
            'select[aria-label="Evidence record for selected rule"]',
          ),
          null,
        )
        assert.ok(
          !document
            .querySelector('.mw-print-document')
            .textContent.includes(runId),
        )
        assert.match(
          document.querySelector('.mw-run-status').textContent,
          /no processed snapshot/,
        )
      },
    )
    assert.deepEqual(
      errors.filter((message) =>
        /same key|unique.*key|not wrapped in act/i.test(message),
      ),
      [],
    )
  } finally {
    if (root) {
      const { act } = await import('react')
      await act(async () => {
        root.unmount()
      })
    }
    store?.dispose()
    await server?.close()
    console.error = originalError
    dom.window.close()
    for (const [name, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor)
      else delete globalThis[name]
    }
  }
})
