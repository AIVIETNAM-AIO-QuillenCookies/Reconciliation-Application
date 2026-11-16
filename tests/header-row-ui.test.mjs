import assert from 'node:assert/strict'
import { test } from 'node:test'
import { format } from 'node:util'
import { fileURLToPath } from 'node:url'
import { JSDOM } from 'jsdom'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'

test('one header selector survives repeated parsing transitions and step changes for every source', async (t) => {
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
  expose(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
  const errors = []
  const originalError = console.error
  console.error = (...args) => {
    errors.push(format(...args))
  }
  let server, root, store
  try {
    server = await createServer({
      cacheDir: 'node_modules/.vite-tests/header-row-ui',
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
    const { MAX_HEADER_ROW } = await server.ssrLoadModule(
      '/src/lib/header-row.ts',
    )
    const sources = ['POS', 'WEB', 'GL', 'Flash', 'Dim']
    const files = sources.map((source) => ({
      id: `${source}-file`,
      source,
      headerRow: 5,
      file: new File(['placeholder'], `${source}.csv`),
    }))
    const preview = (source, headerRow) => ({
      headers:
        source === 'Dim'
          ? ['store_key', 'store_name']
          : MAPPING_FIELDS[source].map((field) => field.aliases[0]),
      rows: [],
      sheetName: null,
      headerRow,
      hasMoreRows: false,
    })
    store = createAppStore(undefined, { ingestionMode: 'wizard' })
    store.actions.setFiles(files)
    for (const file of files) {
      const sample = preview(file.source, 5)
      store.actions.setFilePreview(
        file.id,
        file.file,
        file.source,
        sample,
        file.source === 'Dim' ? [sample] : undefined,
      )
    }
    const act = React.act
    root = createRoot(document.getElementById('main-content'))
    await act(async () => {
      root.render(
        React.createElement(
          MemoryRouter,
          null,
          React.createElement(
            AppStoreContext.Provider,
            { value: store },
            React.createElement(OnboardingWizard),
          ),
        ),
      )
      store.actions.openOnboarding()
      store.actions.setOnboardingStep(0)
    })
    const input = () => document.querySelector('input[type="number"]')
    const button = (direction) =>
      document.querySelector(
        `button[aria-label="Use ${direction} row as header"]`,
      )
    function check(source, row) {
      assert.equal(
        [...document.querySelectorAll('label')].filter(
          (label) => label.textContent.trim() === 'Header Row Number',
        ).length,
        1,
        `${source}: exactly one selector should be visible`,
      )
      assert.equal(document.querySelectorAll('input[type="number"]').length, 1)
      assert.equal(input().value, String(row))
      assert.equal(
        typeof store.getState().files.find((file) => file.source === source)
          .headerRow,
        'number',
      )
      assert.equal(
        store.getState().files.length,
        sources.length,
        'changing a header never appends a file',
      )
    }
    async function finishPreview(source, headerRow, fail) {
      const job = pending.findLast(({ worker }) => !worker.terminated)
      assert.ok(job, 'a live parse should be pending')
      assert.equal(job.request.headerRow, headerRow)
      await act(async () => {
        job.worker.onmessage({
          data: fail
            ? { error: 'Column B has no header', errorKind: 'header-row' }
            : { previews: [preview(source, headerRow)] },
        })
      })
    }
    for (const [index, source] of sources.entries()) {
      await t.test(source, async () => {
        await act(async () => {
          store.actions.setOnboardingStep(index)
        })
        check(source, 5)
        await act(async () => {
          button('next').click()
        })
        check(source, 6)
        await finishPreview(source, 6, true)
        check(source, 6)
        for (let row = 7; row <= 9; row++) {
          await act(async () => {
            button('next').click()
          })
          check(source, row)
          await finishPreview(source, row, row < 9)
          check(source, row)
        }
        // Multiple clicks before React commits must each read the latest file value.
        await act(async () => {
          button('next').click()
          button('next').click()
          button('next').click()
        })
        check(source, 12)
        await finishPreview(source, 12, false)
        await act(async () => {
          button('previous').click()
        })
        check(source, 11)
        await finishPreview(source, 11, false)
        await act(async () => {
          const previous = button('previous')
          for (let click = 0; click < 12; click++) previous.click()
        })
        check(source, 1)
        assert.equal(button('previous').disabled, true)
        await finishPreview(source, 1, false)
        await act(async () => {
          store.actions.setHeaderRow(`${source}-file`, MAX_HEADER_ROW - 1)
        })
        await finishPreview(source, MAX_HEADER_ROW - 1, false)
        await act(async () => {
          button('next').click()
          button('next').click()
          button('next').click()
        })
        check(source, MAX_HEADER_ROW)
        assert.equal(button('next').disabled, true)
        await finishPreview(source, MAX_HEADER_ROW, false)
        await act(async () => {
          store.actions.setHeaderRow(`${source}-file`, 5)
        })
        await finishPreview(source, 5, false)
        check(source, 5)
      })
    }
    await t.test(
      'Master roles require explicit sheet assignments and share one header per sheet',
      async () => {
        const dim = store.getState().files.find((f) => f.source === 'Dim')
        const sheets = [
          {
            headers: ['Instructions'],
            rows: [['Read first']],
            sheetName: 'README',
            headerRow: 5,
            hasMoreRows: false,
          },
          {
            headers: ['Mã điểm bán', 'Finance'],
            rows: [['001', 'FIN']],
            sheetName: 'Arbitrary stores',
            headerRow: 3,
            hasMoreRows: false,
          },
          {
            headers: ['Ngày', 'Currency', 'Rate'],
            rows: [['2025-03-01', 'CAD', '1.4']],
            sheetName: 'Other rates',
            headerRow: 7,
            hasMoreRows: false,
          },
        ]
        await act(async () =>
          store.actions.setFilePreview(
            dim.id,
            dim.file,
            'Dim',
            sheets[0],
            sheets,
          ),
        )
        assert.ok(
          Object.values(
            store.getState().mappingDrafts[dim.id].master.roles,
          ).every((r) => r.usage === 'unconfigured' && r.sheetName === ''),
        )
        assert.equal(
          document.querySelectorAll('input[type="number"]').length,
          1,
        )
        const roleButton = (label) =>
          [
            ...document.querySelectorAll(
              'nav[aria-label="Reference roles"] button',
            ),
          ].find((b) => b.textContent.startsWith(label))
        async function choose(label, text) {
          await act(async () =>
            document.querySelector(`button[aria-label="${label}"]`).click(),
          )
          const option = [...document.querySelectorAll('[role="option"]')].find(
            (b) => b.textContent.trim() === text,
          )
          assert.ok(option, `${text} should be selectable`)
          await act(async () => option.click())
        }
        for (const role of [
          'Store Master',
          'Calendar',
          'FX Daily',
          'FX Month End',
        ]) {
          await act(async () => roleButton(role).click())
          await choose(`${role} usage`, 'Not used')
        }
        await act(async () => roleButton('Store Master').click())
        await choose('Store Master worksheet', 'Arbitrary stores')
        assert.equal(document.querySelector('input[type="number"]').value, '3')
        await choose('Store Master POS store ID column', 'Mã điểm bán')
        await choose('Store Master Finance store code column', 'Finance')
        assert.match(
          roleButton('Store Master').textContent,
          /Configuration ready/,
        )
        assert.equal(
          [...document.querySelectorAll('button')].find(
            (b) => b.textContent.trim() === 'Run reconciliation',
          ).disabled,
          true,
        )
        const tab = (text) =>
          [...document.querySelectorAll('[role="tab"]')].find(
            (b) => b.textContent.trim() === text,
          )
        await act(async () => tab('Relationship builder').click())
        assert.match(
          document.body.textContent,
          /POS.Store ID → Arbitrary stores.POS store ID/,
        )
        await act(async () =>
          [...document.querySelectorAll('button')]
            .find((b) => b.textContent.trim() === 'Add key pair')
            .click(),
        )
        assert.equal(
          store.getState().mappingDrafts[dim.id].master.roles.store
            .relationships[0].keys.length,
          2,
        )
        await act(async () =>
          document.querySelector('button[aria-label="Remove key 2"]').click(),
        )
        await act(async () => roleButton('FX Daily').click())
        await choose('FX Daily worksheet', 'Arbitrary stores')
        assert.equal(document.querySelector('input[type="number"]').value, '3')
        await act(async () => {
          button('next').click()
          button('next').click()
        })
        assert.equal(document.querySelector('input[type="number"]').value, '5')
        const current = store.getState().mappingDrafts[dim.id].master
        assert.equal(current.sheets['Other rates'].headerRow, 7)
        assert.deepEqual(current.roles.store.columns, {})
        assert.equal(
          current.roles.store.sheetName,
          current.roles.fxDaily.sheetName,
        )
        assert.equal(
          document.querySelectorAll('input[type="number"]').length,
          1,
        )
        const stale = pending.findLast(({ worker }) => !worker.terminated)
        await act(async () => roleButton('Store Master').click())
        assert.equal(document.querySelector('input[type="number"]').value, '5')
        // Replacement starts a new workbook draft; the old preview cannot assign roles.
        const next = {
          ...dim,
          id: 'replacement-master',
          file: new File(['replacement'], 'Replacement.xlsx'),
        }
        await act(async () =>
          store.actions.setFiles((previous) =>
            previous.map((f) => (f.id === dim.id ? next : f)),
          ),
        )
        await act(async () =>
          stale.worker.onmessage({ data: { previews: [sheets[1]] } }),
        )
        assert.equal(store.getState().mappingDrafts[dim.id], undefined)
        assert.equal(store.getState().mappingDrafts[next.id]?.master, undefined)
      },
    )
    await t.test(
      'automatic Master walkthrough operates real dropdowns and composite relationship controls',
      async () => {
        const { demonstrateGuideMaster } = await server.ssrLoadModule(
          '/src/lib/guide-master-actions.ts',
        )
        const { defaultRelationship } = await server.ssrLoadModule(
          '/src/lib/master-data.ts',
        )
        const dim = {
          id: 'guide-dim',
          source: 'Dim',
          headerRow: 1,
          file: new File(['fixture'], 'Guide master.xlsx'),
        }
        const roleSheets = {
          store: {
            name: 'Stores',
            columns: {
              pos_store_id: 'POS ID',
              finance_store_code: 'Finance ID',
            },
          },
          calendar: {
            name: 'Dates',
            columns: {
              date: 'Calendar date',
              period: 'Period',
              working_day: 'Working day',
            },
          },
          fxDaily: {
            name: 'Daily FX',
            columns: { date: 'Rate date', currency: 'Currency', rate: 'Value' },
          },
          fxMonthEnd: {
            name: 'Monthly FX',
            columns: {
              period: 'Rate month',
              currency: 'Currency',
              rate: 'Value',
            },
          },
        }
        const sheets = Object.values(roleSheets).map(({ name, columns }) => ({
          sheetName: name,
          headerRow: 1,
          headers: Object.values(columns),
          rows: [],
          hasMoreRows: false,
        }))
        const preset = {
          revision: 1,
          fileId: dim.id,
          sheets: Object.fromEntries(
            sheets.map((sheet) => [sheet.sheetName, { headerRow: 1 }]),
          ),
          roles: Object.fromEntries(
            Object.entries(roleSheets).map(([role, value]) => [
              role,
              {
                usage: 'enabled',
                sheetName: value.name,
                columns: value.columns,
                relationships: [
                  {
                    ...defaultRelationship(role),
                    id: `test-${role}`,
                    ...(role === 'calendar'
                      ? { outputs: ['working_day', 'period'] }
                      : {}),
                  },
                ],
              },
            ]),
          ),
        }
        await act(async () => {
          store.actions.setFiles((previous) => [
            ...previous.filter((file) => file.source !== 'Dim'),
            dim,
          ])
          store.actions.setFilePreview(
            dim.id,
            dim.file,
            'Dim',
            sheets[0],
            sheets,
          )
          store.actions.openSourceOnboarding('Dim')
        })
        const changes = []
        const unsubscribe = store.subscribe(() => {
          changes.push(
            structuredClone(
              store.getState().mappingDrafts[dim.id]?.master?.roles,
            ),
          )
        })
        const signal = new AbortController().signal
        try {
          for (const role of Object.keys(roleSheets)) {
            await act(async () =>
              demonstrateGuideMaster(role, preset, store.actions, signal),
            )
            assert.deepEqual(
              store.getState().mappingDrafts[dim.id].master.roles[role],
              preset.roles[role],
            )
            assert.equal(
              document
                .querySelector('[data-tour="master-tab-relationships"]')
                .getAttribute('aria-selected'),
              'true',
            )
            const relationship = preset.roles[role].relationships[0]
            assert.ok(
              document.querySelector(
                `[data-tour="master-relation-${relationship.id}"]`,
              ),
              'configured join should be visible in the real form',
            )
            for (const [index, key] of relationship.keys.entries()) {
              assert.equal(
                document
                  .querySelector(
                    `[data-tour="master-relation-${relationship.id}-key-type-${index}"]`,
                  )
                  .textContent.trim(),
                key.type,
              )
            }
          }
          assert.ok(
            changes.some(
              (roles) =>
                roles.store.usage === 'enabled' && roles.store.sheetName === '',
            ),
            'real usage selection should precede choosing its worksheet',
          )
          assert.ok(
            changes.some(
              (roles) =>
                roles.store.columns.pos_store_id === 'POS ID' &&
                !roles.store.columns.finance_store_code,
            ),
            'column mappings should be selected individually through their handlers',
          )
          assert.equal(
            changes.at(-1).fxDaily.relationships[0].keys.length,
            2,
            'daily FX retains the date AND currency join',
          )
          const beforeAbort = JSON.stringify(
            store.getState().mappingDrafts[dim.id].master.roles,
          )
          const cancelled = new AbortController()
          cancelled.abort(new Error('cancel Master demo'))
          await assert.rejects(
            demonstrateGuideMaster(
              'store',
              preset,
              store.actions,
              cancelled.signal,
            ),
            /cancel Master demo/,
          )
          assert.equal(
            JSON.stringify(store.getState().mappingDrafts[dim.id].master.roles),
            beforeAbort,
          )
        } finally {
          unsubscribe()
        }
      },
    )
    assert.deepEqual(
      errors.filter((message) =>
        /same key|unique.*key|not wrapped in act/i.test(message),
      ),
      [],
      'React should report no key collisions or unflushed updates',
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
