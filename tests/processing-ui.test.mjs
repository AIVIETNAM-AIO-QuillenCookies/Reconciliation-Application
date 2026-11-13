import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { JSDOM } from 'jsdom'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'

test('processing UI supports step review, join remediation, reopen, exact-run tables and invalidation', async (t) => {
  const dom = new JSDOM(
    '<!doctype html><html><body><main id="main-content" tabindex="-1"></main></body></html>',
    { url: 'http://localhost/', pretendToBeVisual: true },
  )
  const saved = new Map()
  const expose = (name, value) => {
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
    'DocumentFragment',
    'Document',
    'NodeFilter',
    'ShadowRoot',
    'MutationObserver',
    'Event',
    'MouseEvent',
    'KeyboardEvent',
    'CustomEvent',
    'FocusEvent',
    'AbortController',
    'AbortSignal',
    ...Object.getOwnPropertyNames(dom.window).filter((name) =>
      /^(HTML|SVG).*Element$/.test(name),
    ),
  ]) {
    if (!saved.has(name))
      expose(name, name === 'window' ? dom.window : dom.window[name])
  }
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
  expose(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
  dom.window.HTMLElement.prototype.scrollTo = () => {}
  let server, root, store
  try {
    server = await createServer({
      configFile: false,
      cacheDir: 'node_modules/.vite-tests/processing-ui',
      plugins: [
        react(),
        {
          name: 'test-ready-engine',
          enforce: 'pre',
          load(id) {
            if (id.replaceAll('\\', '/').endsWith('/src/hooks/useDuckDB.tsx'))
              return 'export function useDuckDB(){return {status:"ready",database:null}}'
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
    const { act, createElement: h } = React
    const { createAppStore, AppStoreContext } =
      await server.ssrLoadModule('/src/lib/store.ts')
    const progress = await server.ssrLoadModule(
      '/src/lib/processing-progress.ts',
    )
    const { ProgressView } = await server.ssrLoadModule(
      '/src/components/processing/ProgressView.tsx',
    )
    const { ProcessingDialog } = await server.ssrLoadModule(
      '/src/components/processing/ProcessingDialog.tsx',
    )
    const { DataProcessing } = await server.ssrLoadModule(
      '/src/pages/DataProcessing.tsx',
    )
    const { MasterDataConfigurator } = await server.ssrLoadModule(
      '/src/components/ingestion/MasterDataConfigurator.tsx',
    )
    const { MAPPING_FIELDS } = await server.ssrLoadModule(
      '/src/lib/data-mapping.ts',
    )
    store = createAppStore()
    root = createRoot(document.getElementById('main-content'))
    const render = async (component, path = '/') =>
      act(async () => {
        root.render(
          h(
            MemoryRouter,
            { key: path, initialEntries: [path] },
            h(AppStoreContext.Provider, { value: store }, component),
          ),
        )
      })
    const click = async (element) => {
      assert.ok(element)
      await act(async () => element.click())
    }
    const findButton = (text) =>
      [...document.querySelectorAll('button')].find((button) =>
        button.textContent.includes(text),
      )
    const join = {
      role: 'store',
      relationshipId: 'store-pos',
      source: 'POS',
      fileId: 'POS',
      referenceRows: 3,
      rowsBefore: 2,
      rowsAfter: 3,
      duplicateKeys: 1,
      blankReferenceKeys: 0,
      invalidReferenceKeys: 0,
      invalidSourceKeys: 0,
      unmatchedRows: 1,
      unmatchedSamples: ['["001"]'],
      errors: ['duplicate reference keys'],
    }
    await t.test(
      'failed relationship selects the precise draft and completed steps remain reviewable',
      async () => {
        let flow = progress.createProgressFlow('pipeline')
        flow = progress.reduceProgress(flow, {
          phase: 'registering',
          status: 'completed',
          runId: 'ui-run',
          metrics: [{ label: 'Tệp đã đọc', value: 4 }],
        })
        flow = progress.reduceProgress(flow, {
          phase: 'projecting',
          status: 'error',
          runId: 'ui-run',
          error: 'duplicate reference keys',
          source: 'POS',
          joins: [join],
        })
        let fixed
        await render(
          h(ProgressView, {
            flow,
            onFixJoin: (report) => {
              fixed = report
            },
          }),
        )
        assert.match(
          document.querySelector('[role="status"]').textContent,
          /chưa hoàn tất/,
        )
        assert.match(
          document.querySelector('.progress-detail').textContent,
          /Nhóm khóa trùng/,
        )
        assert.equal(
          document.querySelectorAll('.progress-step-icon.is-completed').length,
          1,
        )
        assert.ok(
          document.querySelectorAll('.progress-step-icon.is-waiting').length >
            0,
        )
        await click(findButton('Sửa cấu hình'))
        assert.equal(fixed.relationshipId, 'store-pos')
        const step = findButton('Đọc dữ liệu nguồn')
        step.focus()
        assert.strictEqual(document.activeElement, step)
        await click(step)
        assert.match(
          document.querySelector('.progress-detail').textContent,
          /Tệp đã đọc4/,
        )
        assert.equal(step.getAttribute('aria-current'), 'step')
        assert.equal(document.querySelector('[role="progressbar"]'), null)
      },
    )
    await t.test(
      'missing reference configuration opens the visual check and keeps draft when returning',
      async () => {
        store.dispose()
        store = createAppStore(undefined, { ingestionMode: 'wizard' })
        const files = ['POS', 'WEB', 'GL', 'Flash', 'Dim'].map((source) => ({
          id: source,
          source,
          file: new File(['k\nv'], source + '.csv'),
        }))
        store.actions.setFiles(files)
        for (const file of files) {
          const preview = {
            headers:
              file.source === 'Dim'
                ? ['code', 'ledger']
                : MAPPING_FIELDS[file.source].map((field) => field.aliases[0]),
            rows: [],
            sheetName: file.source === 'Dim' ? 'Reference' : null,
            headerRow: 1,
            hasMoreRows: false,
          }
          store.actions.setFilePreview(
            file.id,
            file.file,
            file.source,
            preview,
            file.source === 'Dim' ? [preview] : undefined,
          )
        }
        const original = store.getState().mappingDrafts.Dim.master
        await render(
          h(MasterDataConfigurator, { file: files.at(-1), onBusy() {} }),
        )
        await act(async () =>
          document
            .querySelector('#master-configuration-form')
            .dispatchEvent(
              new Event('submit', { bubbles: true, cancelable: true }),
            ),
        )
        assert.equal(
          store.getState().configurationProgress.status,
          'needs-configuration',
        )
        assert.ok(document.querySelector('.progress-error'))
        assert.equal(
          document.querySelectorAll('.progress-step-icon.is-completed').length,
          0,
        )
        await click(findButton('Quay lại cấu hình'))
        assert.ok(
          document.querySelector('[aria-label="Sơ đồ cấu hình tham chiếu"]'),
        )
        assert.deepEqual(store.getState().mappingDrafts.Dim.master, original)
        await act(async () => {
          store.actions.setMasterReference('Dim', 'store', {
            usage: 'enabled',
            sheetName: 'Reference',
            columns: { pos_store_id: 'code', finance_store_code: 'ledger' },
            relationships: [
              {
                id: 'repair-pos-store',
                source: 'POS',
                keys: [
                  {
                    sourceField: 'store_key',
                    referenceField: 'pos_store_id',
                    type: 'text',
                  },
                ],
                outputs: ['finance_store_code'],
                purpose: 'store-map',
                unmatched: 'error',
              },
            ],
          })
          store.actions.focusMasterConfiguration(
            'Dim',
            'store',
            'repair-pos-store',
          )
        })
        await render(
          h(MasterDataConfigurator, {
            key: 'repair',
            file: files.at(-1),
            onBusy() {},
          }),
        )
        const relationship = document.getElementById(
          'master-relationship-repair-pos-store',
        )
        assert.ok(relationship)
        assert.strictEqual(document.activeElement, relationship)
        assert.equal(
          store.getState().mappingDrafts.Dim.master.roles.store.columns
            .finance_store_code,
          'ledger',
        )
        await click(relationship.querySelector('label button'))
        const options = [...document.querySelectorAll('[role="option"]')]
        assert.equal(options.length, 4)
        await act(async () => {
          options[0].focus()
          options[0].dispatchEvent(
            new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }),
          )
        })
        assert.strictEqual(document.activeElement, options[1])
        await act(async () =>
          document.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
          ),
        )
      },
    )
    await t.test(
      'failed POS run preserves overlapping reason counts and original records in its exact-run workspace',
      async () => {
        await render(h('div'))
        store.dispose()
        store = createAppStore()
        const diagnostics = {
          runId: 'failed-pos-run',
          uniqueInvalidRows: 1,
          invalidKeyGroups: 1,
          branchCounts: {
            pos_staging: 3,
            q_POS_Cleaning: 2,
            q_POS_Dup_Rows: 1,
            fact_POS_final: 2,
          },
          currencyCounts: { AUD: 1 },
          validLocalMissingUsdRows: 1,
          duplicateConflictGroups: 0,
          reasons: [
            {
              code: 'POS_FX_MISSING',
              label: 'Thiếu tỷ giá FX',
              rowCount: 1,
              keyGroupCount: 1,
              samples: [
                {
                  sourceFile: 'pos-original.csv',
                  sourceRow: null,
                  sourceRecord: 2,
                  raw: {
                    line_amount: '65,37',
                    discount_amount: '7,85',
                    currency: 'AUD',
                  },
                  normalized: {
                    net_local: '57.52',
                    net_usd_month_end: null,
                    currency: 'AUD',
                  },
                },
              ],
            },
            {
              code: 'POS_USD_INVALID',
              label: 'USD null',
              rowCount: 1,
              keyGroupCount: 1,
              samples: [],
            },
          ],
        }
        store.attachProcessor(async (_, __, options) => {
          options.onProgress({
            phase: 'converting',
            status: 'error',
            runId: diagnostics.runId,
            error: '[POS_FX_MISSING] AUD 2025-06-30',
            diagnostics,
          })
          throw new Error('[POS_FX_MISSING] AUD 2025-06-30')
        })
        await act(async () => {
          store.actions.setFiles(
            ['POS', 'WEB', 'GL', 'Flash'].map((source) => ({
              id: source,
              source,
              file: new File(['a\nb'], source + '.csv'),
            })),
          )
          await store.whenSettled()
          store.actions.openProcessingPanel()
        })
        await render(h(ProcessingDialog))
        assert.match(document.body.textContent, /Thiếu tỷ giá FX/)
        assert.match(document.body.textContent, /Dòng lỗi duy nhất1/)
        assert.match(
          document.body.textContent,
          /Không cộng counts từng nguyên nhân/,
        )
        const link = [...document.querySelectorAll('a')].find((element) =>
          element.textContent.includes('Xem chẩn đoán POS'),
        )
        assert.equal(
          link.getAttribute('href'),
          '/processing?run=failed-pos-run',
        )
        await act(async () => store.actions.closeProcessingPanel())
        await render(h(DataProcessing), '/processing?run=failed-pos-run')
        assert.ok(
          document.querySelector('[data-pos-diagnostics="failed-pos-run"]'),
        )
        assert.match(document.body.textContent, /pos-original.csv/)
        assert.match(document.body.textContent, /65,37/)
        assert.match(document.body.textContent, /57.52/)
        assert.match(document.body.textContent, /Dòng vật lý chưa có/)
        assert.match(document.body.textContent, /Dòng xuất lặp bị loại1/)
        await render(h(DataProcessing), '/processing?run=stale-pos-run')
        assert.equal(document.querySelector('[data-pos-diagnostics]'), null)
        assert.doesNotMatch(document.body.textContent, /pos-original.csv/)
        await act(async () => store.actions.setFiles([]))
        await render(h(DataProcessing), '/processing?run=failed-pos-run')
        assert.equal(document.querySelector('[data-pos-diagnostics]'), null)
      },
    )
    const evidence = {
      runId: 'ui-run',
      posDiagnostics: {
        runId: 'ui-run',
        uniqueInvalidRows: 0,
        invalidKeyGroups: 0,
        branchCounts: {
          pos_staging: 3,
          q_POS_Cleaning: 2,
          q_POS_Dup_Rows: 1,
          fact_POS_final: 2,
        },
        currencyCounts: {},
        validLocalMissingUsdRows: 0,
        duplicateConflictGroups: 0,
        reasons: [],
      },
      period: { start: '2025-01-01', end: '2025-12-31' },
      previewLimit: 50,
      scope: 'test snapshot',
      sourceRowNote: 'test source',
      files: [],
      validations: [],
      ruleApplications: [],
      tables: [
        {
          id: 'expected_events',
          label: 'Recognition events',
          kind: 'logical',
          source: null,
          grain: 'One recognition event',
          rowCount: 80,
          truncated: true,
          columns: [
            { name: 'transaction_id', type: 'VARCHAR' },
            { name: 'revenue_usd', type: 'DECIMAL(18,2)' },
          ],
          rows: [{ transaction_id: 'UI-1', revenue_usd: '12.34' }],
        },
      ],
    }
    await t.test(
      'completion stays open, hides and reopens without rerun, with exact-run table links',
      async () => {
        await render(h('div'))
        store.dispose()
        store = createAppStore()
        let calls = 0
        store.attachProcessor(async (_, __, options) => {
          calls++
          options.onProgress({
            phase: 'evidence',
            status: 'completed',
            runId: evidence.runId,
            tableIds: ['expected_events'],
          })
          return { exceptions: [], evidence }
        })
        await act(async () => {
          store.actions.setFiles(
            ['POS', 'WEB', 'GL', 'Flash'].map((source) => ({
              id: source,
              source,
              file: new File(['a\nb'], source + '.csv'),
            })),
          )
          await store.whenSettled()
          store.actions.openProcessingPanel()
        })
        await render(h(ProcessingDialog))
        assert.ok(document.querySelector('[role="dialog"]'))
        assert.match(document.body.textContent, /Đã hoàn tất xử lý/)
        const link = [...document.querySelectorAll('a')].find((element) =>
          element.textContent.includes('Xem bảng:'),
        )
        assert.equal(
          link.getAttribute('href'),
          '/processing?run=ui-run&table=expected_events',
        )
        await click(findButton('Ẩn tiến trình'))
        assert.equal(document.querySelector('[role="dialog"]'), null)
        await act(async () => store.actions.openProcessingPanel())
        assert.match(document.body.textContent, /Đã hoàn tất xử lý/)
        assert.equal(calls, 1)
        await act(async () =>
          document.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
          ),
        )
        assert.equal(store.getState().processingPanelOpen, false)
      },
    )
    await t.test(
      'table workspace shows scope, schema and record inspector; stale-run links never show current rows',
      async () => {
        await render(
          h(DataProcessing),
          '/processing?run=ui-run&table=expected_events',
        )
        assert.match(document.body.textContent, /50 dòng mỗi bảng/)
        assert.ok(document.querySelector('[data-pos-diagnostics="ui-run"]'))
        assert.match(document.body.textContent, /Dòng lỗi duy nhất0/)
        assert.match(
          document.querySelector('.processing-table-tree').textContent,
          /80 dòng · 1 dòng đã giữ/,
        )
        await click(document.querySelector('.mw-row-number button'))
        assert.match(
          document.querySelector('.processing-data-inspector').textContent,
          /UI-1/,
        )
        await click(
          findButton('schema') ??
            document.querySelector('button[aria-pressed="false"]'),
        )
        assert.match(
          document.querySelector('.mw-data-table').textContent,
          /DECIMAL/,
        )
        await render(
          h(DataProcessing),
          '/processing?run=old-run&table=expected_events',
        )
        assert.match(document.body.textContent, /phiên cũ/)
        assert.equal(document.querySelector('[data-pos-diagnostics]'), null)
        assert.doesNotMatch(document.body.textContent, /UI-1/)
        await render(
          h(DataProcessing),
          '/processing?run=ui-run&table=expected_events',
        )
        await act(async () => store.actions.setFiles([]))
        assert.match(document.body.textContent, /Chưa có snapshot/)
        assert.equal(document.querySelector('.mw-data-table'), null)
        await render(h(ProcessingDialog))
        await act(async () => {
          store.setEngineUnavailable('error', 'WASM unavailable')
          store.actions.openProcessingPanel()
        })
        assert.match(document.body.textContent, /Bộ máy cục bộ chưa sẵn sàng/)
        assert.match(document.body.textContent, /WASM unavailable/)
        assert.ok(findButton('Khởi động lại engine'))
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
