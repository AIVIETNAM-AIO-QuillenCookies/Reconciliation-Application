import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { JSDOM } from 'jsdom'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'

test('dashboard expansion keeps live table state, isolates actions and preserves the active result across all four tabs', async (t) => {
  const dom = new JSDOM(
    '<!doctype html><html><body><main id="root"></main></body></html>',
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
  const measure = dom.window.HTMLElement.prototype.getBoundingClientRect
  let expandedWidth = 1250
  dom.window.HTMLElement.prototype.getBoundingClientRect = function () {
    if (!this.classList.contains('recharts-responsive-container'))
      return measure.call(this)
    const width = this.closest('.dash-expanded-body') ? expandedWidth : 650
    const height = this.closest('.dash-expanded-body') ? 620 : 240
    return {
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: width,
      bottom: height,
      width,
      height,
      toJSON() {},
    }
  }
  const observers = new Set()
  expose(
    'ResizeObserver',
    class {
      constructor(callback) {
        this.callback = callback
        this.targets = new Set()
        observers.add(this)
      }
      observe(target) {
        this.targets.add(target)
        this.callback([{ target, contentRect: target.getBoundingClientRect() }])
      }
      unobserve(target) {
        this.targets.delete(target)
      }
      disconnect() {
        this.targets.clear()
        observers.delete(this)
      }
    },
  )
  dom.window.HTMLElement.prototype.scrollTo = function (options) {
    if (typeof options === 'object') {
      this.scrollTop = options.top ?? this.scrollTop
      this.scrollLeft = options.left ?? this.scrollLeft
    }
  }
  let server, root, store
  try {
    server = await createServer({
      configFile: false,
      cacheDir: 'node_modules/.vite-tests/dashboard-expansion',
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
    const { MemoryRouter, useLocation } = await import('react-router-dom')
    const { DashboardWidgetProvider, DashboardWidget } =
      await server.ssrLoadModule(
        '/src/components/dashboard/DashboardWidgets.tsx',
      )
    const { DataTable } = await server.ssrLoadModule(
      '/src/components/dashboard/DashboardPrimitives.tsx',
    )
    root = createRoot(document.getElementById('root'))
    const click = async (element) => {
      assert.ok(element, 'the requested control exists')
      await act(async () => {
        element.focus()
        element.click()
      })
    }
    const settle = async () =>
      act(async () => new Promise((resolve) => requestAnimationFrame(resolve)))
    const resize = async () =>
      act(async () => {
        for (const observer of observers)
          for (const target of observer.targets)
            observer.callback([
              { target, contentRect: target.getBoundingClientRect() },
            ])
      })
    const escape = async () => {
      await act(async () =>
        document.activeElement.dispatchEvent(
          new dom.window.KeyboardEvent('keydown', {
            key: 'Escape',
            bubbles: true,
          }),
        ),
      )
      await settle()
    }
    const enterText = async (element, value) =>
      act(async () => {
        Object.getOwnPropertyDescriptor(
          dom.window.HTMLInputElement.prototype,
          'value',
        ).set.call(element, value)
        element.dispatchEvent(new dom.window.Event('input', { bubbles: true }))
      })
    const select = async (element, value) =>
      act(async () => {
        element.value = value
        element.dispatchEvent(new dom.window.Event('change', { bubbles: true }))
      })
    const closeExpanded = async () => {
      await click(document.querySelector('[aria-label="Đóng vùng phóng to"]'))
      await settle()
    }

    await t.test(
      'one centralized dialog moves the same table DOM and retains search, sort, page, scroll and focus',
      async () => {
        const rows = Array.from({ length: 26 }, (_, index) => ({
          id: `row-${index}`,
          name: `Dòng ${String(index).padStart(2, '0')}`,
          amount: index,
        }))
        let headerActions = 0,
          selected = 0
        const identity = { runId: 'table-state' }
        const table = () =>
          h(DataTable, {
            rows,
            label: 'kiểm chứng trạng thái',
            pageSize: 8,
            columns: [
              { key: 'name', label: 'Tên', value: (r) => r.name },
              {
                key: 'amount',
                label: 'Số tiền',
                value: (r) => r.amount,
                numeric: true,
              },
            ],
            onSelect: () => selected++,
          })
        const render = async (nextIdentity) =>
          act(async () =>
            root.render(
              h(
                DashboardWidgetProvider,
                {
                  sourceLabel: 'Web tính toán · Raw',
                  periodLabel: '2025-01 → 2025-12',
                  identity: nextIdentity,
                },
                h(
                  DashboardWidget,
                  {
                    id: 'state-table',
                    title: 'Bảng giữ trạng thái',
                    subtitle: 'USD · 26 dòng',
                    action: h(
                      'button',
                      {
                        'aria-label': 'Thao tác riêng',
                        onClick: () => headerActions++,
                      },
                      'Thao tác riêng',
                    ),
                  },
                  table(),
                ),
                h(
                  DashboardWidget,
                  { id: 'other-table', title: 'Bảng thứ hai' },
                  h('p', null, 'Nguồn chung'),
                ),
              ),
            ),
          )
        await render(identity)
        await click(document.querySelector('[aria-label="Thao tác riêng"]'))
        assert.equal(headerActions, 1)
        assert.equal(
          document.querySelector('[role="dialog"]'),
          null,
          'a header action must not expand its widget',
        )
        const input = document.querySelector(
          '[aria-label="Tìm trong kiểm chứng trạng thái"]',
        )
        await enterText(input, 'Dòng')
        const amountSort = [...document.querySelectorAll('th button')].find(
          (button) => button.textContent.includes('Số tiền'),
        )
        await click(amountSort)
        await click(amountSort)
        await click(
          document.querySelector(
            '[aria-label="Trang sau kiểm chứng trạng thái"]',
          ),
        )
        const scroll = document.querySelector(
          '[aria-label="kiểm chứng trạng thái"]',
        )
        scroll.scrollTop = 123
        const firstRow = () =>
          document.querySelector(
            '[aria-label="kiểm chứng trạng thái"] tbody tr',
          ).textContent
        const before = firstRow()
        assert.match(before, /Dòng 17/)
        const trigger = document.querySelector(
          '[aria-label="Phóng to Bảng giữ trạng thái"]',
        )
        await click(trigger)
        await settle()
        const dialog = document.querySelector('[role="dialog"]')
        assert.ok(dialog)
        assert.equal(document.querySelectorAll('[role="dialog"]').length, 1)
        assert.match(dialog.textContent, /Bảng giữ trạng thái/)
        assert.match(dialog.textContent, /Web tính toán · Raw/)
        assert.match(dialog.textContent, /2025-01 → 2025-12/)
        assert.equal(
          dialog.querySelector(
            '[aria-label="Tìm trong kiểm chứng trạng thái"]',
          ),
          input,
          'input DOM survives the move without remounting',
        )
        assert.equal(input.value, 'Dòng')
        assert.equal(firstRow(), before)
        assert.equal(scroll.scrollTop, 123)
        await act(async () => {
          input.dispatchEvent(
            new dom.window.MouseEvent('pointerdown', {
              bubbles: true,
              button: 0,
            }),
          )
          input.click()
          input.focus()
        })
        assert.equal(
          document.querySelector('[role="dialog"]'),
          dialog,
          'pointer actions on the moved live subtree stay inside the dialog',
        )
        assert.equal(
          document.activeElement.closest('[role="dialog"]'),
          dialog,
          'focus enters the expanded dialog',
        )
        await act(async () =>
          document
            .querySelector('[aria-label="Phóng to Bảng thứ hai"]')
            .focus(),
        )
        assert.equal(
          document.activeElement.closest('[role="dialog"]'),
          dialog,
          'focus cannot leave the expanded dialog for the background page',
        )
        await click(
          dialog.querySelector(
            '[aria-label="Trang sau kiểm chứng trạng thái"]',
          ),
        )
        assert.match(firstRow(), /Dòng 09/)
        scroll.scrollTop = 211
        await escape()
        assert.equal(document.querySelector('[role="dialog"]'), null)
        assert.equal(
          document.activeElement,
          trigger,
          'Escape restores focus to the opening button',
        )
        assert.equal(
          document.querySelector(
            '[aria-label="Tìm trong kiểm chứng trạng thái"]',
          ),
          input,
        )
        assert.equal(scroll.scrollTop, 211)
        assert.match(firstRow(), /Dòng 09/)
        await click(
          document.querySelector('[aria-label="Mở rộng Bảng giữ trạng thái"]'),
        )
        assert.equal(
          document.querySelector(
            '[role="dialog"] [aria-label="Tìm trong kiểm chứng trạng thái"]',
          ),
          input,
        )
        await closeExpanded()
        await click(trigger.closest('header'))
        assert.ok(
          document.querySelector('[role="dialog"]'),
          'the non-interactive header area also opens expansion',
        )
        await closeExpanded()
        await click(
          document.querySelector(
            '[aria-label="kiểm chứng trạng thái"] tbody button',
          ),
        )
        assert.equal(selected, 1)
        assert.equal(
          document.querySelector('[role="dialog"]'),
          null,
          'a table data action must not expand its card',
        )
        await click(trigger)
        await render({ runId: 'new-source' })
        await settle()
        assert.equal(
          document.querySelector('[role="dialog"]'),
          null,
          'a changed source identity dismisses the old expanded content',
        )
        await render(identity)
        await settle()
        assert.equal(
          document.querySelector('[role="dialog"]'),
          null,
          'returning to the same original source object must not resurrect its dismissed expansion',
        )
        assert.equal(
          document.querySelector(
            '[aria-label="Tìm trong kiểm chứng trạng thái"]',
          ),
          input,
          'source transitions preserve the live inline table without restoring an old dialog',
        )
      },
    )

    await t.test(
      'all four result tabs expand without changing filters or rerunning Raw; data drill replaces expansion with one inspector',
      async () => {
        const { Dashboard } = await server.ssrLoadModule(
          '/src/pages/Dashboard.tsx',
        )
        const { createAppStore, AppStoreContext } =
          await server.ssrLoadModule('/src/lib/store.ts')
        store = createAppStore()
        let processorRuns = 0
        store.attachProcessor(async () => {
          processorRuns++
          throw new Error('RAW EXPANSION SENTINEL')
        })
        store.actions.setFiles(
          ['POS', 'WEB', 'GL', 'Flash'].map((source) => ({
            id: source,
            source,
            file: new File(['fixture'], `${source}.csv`),
          })),
        )
        await store.whenSettled()
        const rawState = store.getState()
        const bytes = await readFile(
          new URL('../public/reference/excel-reference.xlsx', import.meta.url),
        )
        await store.actions.loadExcelReference({
          name: 'excel-reference.xlsx',
          arrayBuffer: async () =>
            bytes.buffer.slice(
              bytes.byteOffset,
              bytes.byteOffset + bytes.byteLength,
            ),
        })
        const workbook = store.getState().excelReference.workbook
        const referencePeriod = store.getState().excelReference.period
        const runCount = processorRuns
        let currentLocation
        function LocationObserver() {
          currentLocation = useLocation()
          return null
        }
        await act(async () =>
          root.render(
            h(
              MemoryRouter,
              {
                key: 'dashboard',
                initialEntries: ['/?tab=overview&from=2025-09&to=2025-09'],
              },
              h(
                AppStoreContext.Provider,
                { value: store },
                h(LocationObserver),
                h(Dashboard),
              ),
            ),
          ),
        )
        const tab = (label) =>
          [...document.querySelectorAll('[role="tab"]')].find((element) =>
            element.textContent.endsWith(label),
          )
        const activateTab = async (label) => {
          const target = tab(label)
          assert.ok(target)
          await act(async () =>
            target.dispatchEvent(
              new dom.window.MouseEvent('mousedown', {
                bubbles: true,
                button: 0,
              }),
            ),
          )
          assert.equal(target.getAttribute('aria-selected'), 'true')
        }
        for (const [label, minWidgets] of [
          ['Tổng quan', 5],
          ['Cầu nối chênh lệch', 4],
          ['Đối soát chi tiết', 4],
          ['Hoàn trả & chất lượng', 4],
        ]) {
          await activateTab(label)
          const icons = [
            ...document.querySelectorAll('button[aria-label^="Phóng to "]'),
          ]
          assert.ok(
            icons.length >= minWidgets,
            `${label} exposes expansion for every chart/table card`,
          )
          const expectedURL = currentLocation.search
          const trigger = icons[0]
          const inlineChartWidth = Number(
            trigger
              .closest('.dash-card')
              .querySelector('.recharts-surface')
              ?.getAttribute('width'),
          )
          await click(trigger)
          await settle()
          await resize()
          assert.equal(document.querySelectorAll('[role="dialog"]').length, 1)
          const expanded = document.querySelector('.dash-expanded-body')
          assert.ok(expanded)
          assert.ok(expanded.querySelector('.dash-widget-host'))
          if (label === 'Tổng quan') {
            const chart = expanded.querySelector('.recharts-surface')
            assert.ok(chart, 'the expanded revenue chart renders an SVG')
            assert.equal(Number(chart.getAttribute('width')), 1250)
            assert.ok(Number(chart.getAttribute('width')) > inlineChartWidth)
            expandedWidth = 1020
            await resize()
            assert.equal(
              Number(chart.getAttribute('width')),
              1020,
              'the live chart remeasures when its expanded container changes size',
            )
            expandedWidth = 1250
            await resize()
          }
          assert.match(
            document.querySelector('[role="dialog"]').textContent,
            /Excel tham chiếu/,
          )
          assert.match(
            document.querySelector('[role="dialog"]').textContent,
            /2025-09/,
          )
          await escape()
          assert.equal(document.querySelector('[role="dialog"]'), null)
          assert.equal(document.activeElement, trigger)
          assert.equal(currentLocation.search, expectedURL)
          assert.equal(store.getState().excelReference.workbook, workbook)
          assert.equal(store.getState().excelReference.period, referencePeriod)
          assert.equal(store.getState().files, rawState.files)
          assert.equal(processorRuns, runCount)
        }
        await activateTab('Tổng quan')
        const chartTrigger = document.querySelector(
          '[aria-label="Phóng to Sales Flash và GL theo tháng"]',
        )
        await click(chartTrigger)
        await settle()
        await resize()
        const month = document.querySelector(
          '.dash-expanded-body [aria-label="Xem chi tiết tháng doanh thu"]',
        )
        await select(month, '2025-09')
        await settle()
        assert.equal(
          document.querySelectorAll('[role="dialog"]').length,
          1,
          'the drill inspector replaces the expanded region instead of stacking dialogs',
        )
        assert.equal(document.querySelector('.dash-expanded-body'), null)
        assert.match(
          document.querySelector('[role="dialog"]').textContent,
          /Đối soát tháng 2025-09/,
        )
        await escape()
        assert.equal(document.querySelector('[role="dialog"]'), null)
        assert.equal(
          document.querySelector('[aria-label="Từ tháng"]').value,
          '2025-09',
        )
        assert.equal(
          document.querySelector('[aria-label="Đến tháng"]').value,
          '2025-09',
        )
        await click(
          document.querySelector(
            '[aria-label="Phóng to Sales Flash và GL theo tháng"]',
          ),
        )
        await act(async () => store.actions.disableExcelReference())
        await settle()
        assert.equal(
          document.querySelector('[role="dialog"]'),
          null,
          'switching from Excel dismisses its expanded region',
        )
        assert.equal(
          document.querySelector('[data-dashboard-source]').dataset
            .dashboardSource,
          'raw',
        )
        assert.equal(processorRuns, runCount)
        assert.equal(store.getState().files, rawState.files)
        assert.equal(store.getState().runFailure, rawState.runFailure)
      },
    )
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
