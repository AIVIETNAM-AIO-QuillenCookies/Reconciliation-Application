import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { readFile } from 'node:fs/promises'
import { JSDOM } from 'jsdom'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'

test('guide introduction, gated controls, modal targeting and isolated replay preserve the original workspace', async () => {
  const dom = new JSDOM(
    '<!doctype html><html><body><main id="test-root"></main><button data-tour="target">Target</button></body></html>',
    {
      url: 'http://localhost/#/exceptions?category=manual',
      pretendToBeVisual: true,
    },
  )
  const saved = new Map()
  function expose(name, value) {
    if (saved.has(name)) return
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
    'CustomEvent',
    'KeyboardEvent',
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
  expose('localStorage', dom.window.localStorage)
  expose(
    'ResizeObserver',
    class {
      constructor(callback) {
        this.callback = callback
      }
      observe(target) {
        this.callback([{ target, contentRect: { width: 760, height: 260 } }])
      }
      disconnect() {}
      unobserve() {}
    },
  )
  let targetLeft = 100
  dom.window.HTMLElement.prototype.getBoundingClientRect = function () {
    const box =
      this.dataset.tour === 'target'
        ? { left: targetLeft, top: 90, width: 120, height: 35 }
        : this.dataset.tour === 'sub-action'
          ? { left: 600, top: 580, width: 120, height: 35 }
          : this.getAttribute('role') === 'dialog'
            ? { left: 60, top: 30, width: 900, height: 700 }
            : { left: 0, top: 0, width: 352, height: 400 }
    return {
      ...box,
      right: box.left + box.width,
      bottom: box.top + box.height,
      x: box.left,
      y: box.top,
      toJSON() {},
    }
  }
  const scrollRequests = []
  dom.window.HTMLElement.prototype.scrollIntoView = function (options) {
    scrollRequests.push({ target: this.dataset.tour, options })
  }
  let server, root
  try {
    server = await createServer({
      configFile: false,
      cacheDir: 'node_modules/.vite-tests/interactive-guide-ui',
      plugins: [
        {
          name: 'guide-test-engine',
          enforce: 'pre',
          load(id) {
            if (id.replaceAll('\\', '/').endsWith('/src/hooks/useDuckDB.tsx'))
              return `import { createElement, Fragment } from 'react'; export function DuckDBProvider({children}) { return createElement(Fragment, null, children) }; export function useDuckDB() { return {status: 'loading', database: null, error: null, retry() {}} }`
          },
        },
        react(),
      ],
      resolve: {
        alias: { '@': fileURLToPath(new URL('../src', import.meta.url)) },
      },
      server: { middlewareMode: true, hmr: false, ws: false, watch: null },
      optimizeDeps: { noDiscovery: true },
      appType: 'custom',
    })
    const { createElement: h, act, useContext } = await import('react')
    const { createRoot } = await import('react-dom/client')
    const { GuideOverlay } = await server.ssrLoadModule(
      '/src/components/guide/GuideOverlay.tsx',
    )
    const { GuideWorkspace, useGuideWorkspace } = await server.ssrLoadModule(
      '/src/components/guide/GuideWorkspace.tsx',
    )
    const { AppStoreContext, createAppStore, useAppStore } =
      await server.ssrLoadModule('/src/lib/store.ts')
    root = createRoot(document.getElementById('test-root'))
    const settle = () =>
      act(
        async () =>
          new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(resolve)),
          ),
      )
    const render = async (content) => {
      await act(async () => root.render(content))
      await settle()
    }
    const click = async (selector) => {
      const target = document.querySelector(selector)
      assert.ok(target, selector)
      await act(async () => target.click())
      await settle()
    }
    const events = []
    const overlay = {
      step: {
        id: 'import',
        chapter: 2,
        title: 'Nhập dữ liệu',
        why: 'Giữ dữ liệu nguồn.',
        instruction: 'Chọn file mẫu.',
        result: 'Đã đọc workbook.',
        selector: '[data-tour="target"]',
      },
      index: 1,
      total: 10,
      busy: false,
      verified: false,
      error: null,
      onPrevious: () => events.push('previous'),
      onNext: () => events.push('next'),
      onRetry: () => events.push('retry'),
      onConfigure: () => events.push('configure'),
      onRestart: () => events.push('restart'),
      onExit: () => events.push('exit'),
      action: h(
        'button',
        { 'data-tour': 'actual-import', onClick: () => events.push('import') },
        'Nạp workbook mẫu',
      ),
    }
    await render(h(GuideOverlay, overlay))
    scrollRequests.length = 0
    const panelPosition = () => {
      const panel = document.querySelector('[data-tour="guide-controls"]')
      return { left: panel.style.left, top: panel.style.top }
    }
    const initialPanelPosition = panelPosition()
    const subAction = document.createElement('button')
    subAction.dataset.tour = 'sub-action'
    subAction.dataset.guideCurrentTarget = 'true'
    await act(async () => document.body.appendChild(subAction))
    await render(h(GuideOverlay, { ...overlay, busy: true }))
    assert.deepEqual(
      panelPosition(),
      initialPanelPosition,
      'Play keeps the controls anchored while the illustrated action moves to another field',
    )
    assert.equal(document.querySelector('.guide-highlight').style.left, '596px')
    await render(h(GuideOverlay, { ...overlay, verified: true }))
    assert.deepEqual(
      panelPosition(),
      initialPanelPosition,
      'verification must not move the control panel back across the screen',
    )
    assert.deepEqual(
      scrollRequests,
      [],
      'overlay measurement must never scroll the page when busy or verified changes',
    )
    await act(async () => subAction.remove())
    await render(h(GuideOverlay, overlay))
    assert.equal(
      document.querySelector('[data-tour="guide-next"]').disabled,
      true,
    )
    await click('[data-tour="guide-next"]')
    assert.deepEqual(events, [])
    await click('[data-tour="actual-import"]')
    assert.deepEqual(events, ['import'])
    assert.equal(
      document.querySelector('[data-tour="guide-pause"]'),
      null,
      'the automatic demo controls are gone',
    )
    assert.equal(document.querySelector('.guide-cursor'), null)
    assert.equal(document.querySelector('.guide-speed'), null)
    assert.match(
      document.querySelector('[data-tour="guide-controls"]').textContent,
      /Tự làm theo hướng dẫn/,
    )
    assert.doesNotMatch(document.body.textContent, /trình diễn/i)
    const firstLeft = document.querySelector('.guide-highlight').style.left
    targetLeft = 210
    await act(async () => window.dispatchEvent(new Event('resize')))
    await settle()
    assert.notEqual(
      document.querySelector('.guide-highlight').style.left,
      firstLeft,
    )
    await render(h(GuideOverlay, { ...overlay, verified: true }))
    await click('[data-tour="guide-next"]')
    assert.equal(events.at(-1), 'next')
    const modal = document.createElement('section')
    modal.setAttribute('role', 'dialog')
    modal.dataset.state = 'open'
    modal.dataset.slot = 'dialog-content'
    await act(async () => document.body.appendChild(modal))
    await settle()
    assert.ok(
      modal.querySelector('[data-tour="guide-controls"]'),
      'guide controls stay inside current modal focus boundary',
    )
    const mainModalControls = modal.querySelector(
      '[data-tour="guide-controls"]',
    )
    const mainModalPosition = panelPosition()
    const popoverPortal = document.createElement('div')
    popoverPortal.setAttribute('data-radix-popper-content-wrapper', '')
    const popover = document.createElement('div')
    popover.setAttribute('role', 'dialog')
    popover.dataset.state = 'open'
    popover.getBoundingClientRect = () => ({
      left: 500,
      top: 380,
      width: 240,
      height: 160,
      right: 740,
      bottom: 540,
      x: 500,
      y: 380,
      toJSON() {},
    })
    popoverPortal.appendChild(popover)
    await act(async () => document.body.appendChild(popoverPortal))
    await settle()
    assert.equal(
      modal.querySelector('[data-tour="guide-controls"]'),
      mainModalControls,
      'opening a portaled Radix dropdown must keep the same guide panel in the app modal',
    )
    assert.equal(popover.querySelector('[data-tour="guide-controls"]'), null)
    assert.deepEqual(
      panelPosition(),
      mainModalPosition,
      'a small dropdown must not resize or reposition the guide panel',
    )
    await act(async () => {
      popover.dataset.state = 'closed'
    })
    await settle()
    await act(async () => popoverPortal.remove())
    await settle()
    assert.equal(
      modal.querySelector('[data-tour="guide-controls"]'),
      mainModalControls,
      'closing the dropdown must preserve guide controls and focus boundary',
    )
    assert.deepEqual(panelPosition(), mainModalPosition)

    const sheet = document.createElement('section')
    sheet.setAttribute('role', 'dialog')
    sheet.dataset.state = 'open'
    sheet.dataset.slot = 'sheet-content'
    await act(async () => document.body.appendChild(sheet))
    await settle()
    assert.ok(
      sheet.querySelector('[data-tour="guide-controls"]'),
      'a real app sheet still becomes the active guide focus boundary',
    )
    assert.equal(modal.querySelector('[data-tour="guide-controls"]'), null)
    await act(async () => sheet.remove())
    await settle()
    assert.ok(
      modal.querySelector('[data-tour="guide-controls"]'),
      'closing the sheet restores the underlying app modal host',
    )
    await render(h(GuideOverlay, { ...overlay, error: 'Thiếu sheet nguồn.' }))
    assert.match(
      modal.querySelector('[role="alert"]').textContent,
      /Thiếu sheet nguồn/,
    )
    await click('[data-tour="guide-controls"] [role="alert"] button')
    assert.equal(events.at(-1), 'retry')
    // A missing app file (e.g. the sample's xlsx library) offers a reload first.
    await render(
      h(GuideOverlay, {
        ...overlay,
        error:
          'Failed to fetch dynamically imported module: http://localhost/node_modules/.vite/deps/xlsx.js?v=0',
      }),
    )
    const chunkAlert = modal.querySelector('[role="alert"]')
    assert.match(chunkAlert.textContent, /Không tải được một phần của ứng dụng/)
    assert.doesNotMatch(chunkAlert.textContent, /Failed to fetch/)
    assert.deepEqual(
      [...chunkAlert.querySelectorAll('button')].map((button) =>
        button.textContent.trim(),
      ),
      ['Tải lại trang', 'Thử lại', 'Về cấu hình'],
    )
    await act(async () => modal.remove())
    await settle()
    assert.ok(document.body.querySelector('[data-tour="guide-controls"]'))
    await render(null)

    const original = createAppStore(undefined, { ingestionMode: 'wizard' })
    const originalFile = {
      id: 'real-pos',
      source: 'POS',
      file: new File(['receipt_no\nREAL'], 'real-pos.csv'),
    }
    original.actions.setFiles([originalFile])
    const originalState = original.getState()
    let context, activeStore, activeView
    function Probe() {
      context = useGuideWorkspace()
      activeStore = useContext(AppStoreContext)
      activeView = useAppStore()
      return h(
        'output',
        null,
        activeView.files.map((file) => file.file.name).join(','),
      )
    }
    await render(
      h(
        AppStoreContext.Provider,
        { value: original },
        h(GuideWorkspace, null, h(Probe)),
      ),
    )
    assert.equal(activeStore, original)
    await act(async () => context.start())
    await settle()
    assert.notEqual(activeStore, original)
    const firstSession = context.session
    assert.deepEqual(activeView.files, [])
    await act(async () =>
      activeView.setFiles([
        {
          id: 'sample-pos',
          source: 'POS',
          file: new File(['receipt_no\nSAMPLE'], 'sample-pos.csv'),
        },
      ]),
    )
    assert.equal(original.getState(), originalState)
    await act(async () => context.start())
    await settle()
    assert.notEqual(context.session.id, firstSession.id)
    assert.notEqual(context.session.store, firstSession.store)
    assert.deepEqual(
      activeView.files,
      [],
      'replay creates a fresh sample store',
    )
    assert.equal(original.getState(), originalState)
    await act(async () => context.exit())
    await settle()
    assert.equal(activeStore, original)
    assert.equal(activeView.files[0].file, originalFile.file)
    assert.equal(window.location.hash, '#/exceptions?category=manual')
    assert.equal(original.getState(), originalState)
    await act(async () => original.dispose())

    // Controller integration keeps the production script, sample parser, store,
    // mappings and reference adapter. SQL execution and the master-validation
    // response are injected boundaries; full-data DuckDB has separate tests.
    const { MemoryRouter, useLocation } = await import('react-router-dom')
    const {
      InteractiveGuideProvider,
      InteractiveGuideContext,
      GuideLauncher,
      GuideWorkspaceContent,
    } = await server.ssrLoadModule('/src/components/guide/InteractiveGuide.tsx')
    // As in App.tsx, the introduction sits outside the router.
    const { ProductIntroProvider } = await server.ssrLoadModule(
      '/src/components/intro/ProductIntro.tsx',
    )
    const { GUIDE_COLUMNS, GUIDE_SOURCE_SHEETS, prepareGuideGL } =
      await server.ssrLoadModule('/src/lib/guide-sample.ts')
    const { AccountingReview } = await server.ssrLoadModule(
      '/src/pages/AccountingReview.tsx',
    )
    const { Dashboard } = await server.ssrLoadModule('/src/pages/Dashboard.tsx')
    const { masterFingerprint } = await server.ssrLoadModule(
      '/src/lib/master-data.ts',
    )
    const { confirmedMappingSnapshot } = await server.ssrLoadModule(
      '/src/lib/data-mapping.ts',
    )
    const { clickGuideTarget, fillGuideTarget, guideTarget } =
      await server.ssrLoadModule('/src/lib/guide-dom.ts')
    const sourceBytes = await readFile(
      new URL(
        '../public/demo/Nexa_Home_Recon_Dataset_Final.xlsx',
        import.meta.url,
      ),
    )
    let blockFetch = true
    let fetchCount = 0
    let abortedFetches = 0
    expose('fetch', async (url, options = {}) => {
      assert.match(String(url), /demo\/Nexa_Home_Recon_Dataset_Final\.xlsx$/)
      fetchCount++
      if (blockFetch)
        return new Promise((_resolve, reject) =>
          options.signal.addEventListener(
            'abort',
            () => {
              abortedFetches++
              reject(options.signal.reason)
            },
            { once: true },
          ),
        )
      return new Response(sourceBytes)
    })
    let controllerWorkspace, controllerGuide, controllerStore
    let mapClicks = 0
    let actualViews = false
    function ControllerHarness() {
      controllerWorkspace = useGuideWorkspace()
      controllerGuide = useContext(InteractiveGuideContext)
      controllerStore = useContext(AppStoreContext)
      const app = useAppStore()
      const { pathname } = useLocation()
      function masterChoice(target, value) {
        return [
          h(
            'button',
            {
              key: target,
              'data-tour': target,
              'aria-expanded': 'false',
            },
            target,
          ),
          h(
            'button',
            {
              key: `${target}-option-${value}`,
              'data-tour': `${target}-option-${value}`,
            },
            value,
          ),
        ]
      }
      return h(
        'div',
        null,
        actualViews &&
          (pathname === '/accounting-review'
            ? h(AccountingReview)
            : pathname === '/'
              ? h(Dashboard)
              : h(GuideWorkspaceContent)),
        h(
          'button',
          { 'data-tour': 'dashboard-import', onClick: app.openOnboarding },
          'Nhập dữ liệu',
        ),
        ...Object.entries(GUIDE_COLUMNS).flatMap(([source, fields]) => {
          const file = app.files.find((entry) => entry.source === source)
          const draft = file && app.mappingDrafts[file.id]
          return [
            h(
              'select',
              {
                key: `sheet-${source}`,
                'data-tour': `source-sheet-${source}`,
                value: file?.sheetName ?? '',
                onChange: (event) =>
                  file && app.setSheetName(file.id, event.target.value),
              },
              h('option', { value: '' }, ''),
              h(
                'option',
                { value: GUIDE_SOURCE_SHEETS[source] },
                GUIDE_SOURCE_SHEETS[source],
              ),
            ),
            ...Object.entries(fields).flatMap(([field, column]) => [
              h(
                'button',
                {
                  key: `map-${source}-${field}`,
                  'data-tour': `mapping-${source}-${field}`,
                  onClick: () => mapClicks++,
                },
                column,
              ),
              h(
                'button',
                {
                  key: `option-${source}-${field}`,
                  'data-tour': `mapping-option-${source}-${field}-${draft?.preview?.headers.indexOf(column) ?? -1}`,
                  onClick: () =>
                    file &&
                    app.setColumnMapping(file.id, {
                      ...draft.columns,
                      [field]: column,
                    }),
                },
                column,
              ),
            ]),
          ]
        }),
        ...['store', 'calendar', 'fxDaily', 'fxMonthEnd'].map((role) =>
          h('button', { key: role, 'data-tour': `master-role-${role}` }, role),
        ),
        h('button', { 'data-tour': 'master-tab-mapping' }, 'Ánh xạ'),
        h('button', { 'data-tour': 'master-tab-relationships' }, 'Quan hệ'),
        ...Object.entries(controllerGuide.sample?.preset.roles ?? {}).flatMap(
          ([role, reference]) => [
            ...masterChoice(`master-usage-${role}`, reference.usage),
            ...masterChoice(`master-sheet-${role}`, reference.sheetName),
            ...Object.entries(reference.columns).flatMap(([field, column]) =>
              masterChoice(`master-column-${role}-${field}`, column),
            ),
            ...reference.relationships.flatMap((relationship) => {
              const target = `master-relation-${relationship.id}`
              return [
                h('div', { key: target, 'data-tour': target }),
                ...masterChoice(`${target}-source`, relationship.source),
                ...relationship.keys.flatMap((key, index) => [
                  ...masterChoice(
                    `${target}-source-key-${index}`,
                    key.sourceField,
                  ),
                  ...masterChoice(
                    `${target}-reference-key-${index}`,
                    key.referenceField,
                  ),
                  ...masterChoice(`${target}-key-type-${index}`, key.type),
                ]),
                ...masterChoice(`${target}-purpose`, relationship.purpose),
                ...masterChoice(`${target}-unmatched`, relationship.unmatched),
              ]
            }),
          ],
        ),
        h(
          'button',
          {
            'data-tour': 'master-validate',
            onClick: () => {
              const state = controllerStore.getState()
              const master = state.mappingDrafts['guide-dim'].master
              app.setMasterValidation('guide-dim', {
                scope: 'full',
                passed: true,
                errors: [],
                joins: Object.entries(master.roles).flatMap(([role, config]) =>
                  config.relationships.map((relationship) => ({
                    role,
                    relationshipId: relationship.id,
                    source: relationship.source,
                    fileId: state.files.find(
                      (file) => file.source === relationship.source,
                    ).id,
                    referenceRows: 1,
                    duplicateKeys: 0,
                    blankReferenceKeys: 0,
                    invalidReferenceKeys: 0,
                    invalidSourceKeys: 0,
                    unmatchedRows: 0,
                    unmatchedSamples: [],
                    rowsBefore: 1,
                    rowsAfter: 1,
                    errors: [],
                  })),
                ),
                fingerprint: masterFingerprint(
                  master,
                  state.files,
                  confirmedMappingSnapshot(state.files, state.mappingDrafts),
                ),
              })
            },
          },
          'Kiểm tra cấu hình',
        ),
      )
    }
    const controllerOriginal = createAppStore(undefined, {
      ingestionMode: 'wizard',
    })
    controllerOriginal.actions.setFiles([originalFile])
    const beforeGuide = controllerOriginal.getState()
    window.location.hash = '#/'
    await render(
      h(
        AppStoreContext.Provider,
        { value: controllerOriginal },
        h(
          GuideWorkspace,
          null,
          h(
            ProductIntroProvider,
            null,
            h(
              MemoryRouter,
              null,
              h(
                InteractiveGuideProvider,
                null,
                h(ControllerHarness),
                h(GuideLauncher),
              ),
            ),
          ),
        ),
      ),
    )
    assert.ok(
      document.querySelector('[data-tour="product-intro"]'),
      'each page load opens the introduction',
    )
    assert.equal(
      document.querySelector('[data-tour="guide-start-automatic"]'),
      null,
    )
    await click('[data-tour="guide-defer"]')
    assert.equal(document.querySelector('[data-tour="product-intro"]'), null)
    const waitUntil = async (predicate, label) => {
      const until = Date.now() + 12_000
      while (!predicate() && Date.now() < until) await settle()
      assert.ok(
        predicate(),
        `${label}: ${document.querySelector('[data-guide-panel]')?.textContent}`,
      )
    }
    const startGuided = async () => {
      await click('[data-tour="guide-launcher"]')
      assert.ok(document.querySelector('[data-tour="product-intro"]'))
      await click('[data-tour="intro-nav-start"]')
      await click('[data-tour="guide-start-guided"]')
      await waitUntil(() => controllerWorkspace.session, 'guided session')
    }
    const nextController = async () => {
      await waitUntil(
        () =>
          document.querySelector('[data-tour="guide-next"]')?.disabled ===
          false,
        'step should verify',
      )
      await click('[data-tour="guide-next"]')
    }
    const never = new AbortController().signal
    /** Radix tabs and selects react to the pointer/mouse sequence, not only click. */
    const press = async (name) => {
      await waitUntil(() => {
        const target = guideTarget(name)
        return !!target && !target.matches(':disabled')
      }, name)
      await act(async () => clickGuideTarget(name, never))
      await settle()
    }
    const fill = async (name, value) => {
      await waitUntil(() => !!guideTarget(name), name)
      await act(async () => fillGuideTarget(name, value))
      await settle()
    }
    /** What a user does on the real screens for each guided step. */
    const actAsUser = async (id) => {
      if (id === 'overview') await press('dashboard-import')
      else if (id === 'load') {
        await press('guide-load')
        await waitUntil(
          () =>
            controllerStore.getState().files.length === 5 &&
            !!controllerGuide.sample,
          'sample import',
        )
      } else if (id.startsWith('map-')) {
        const source = id.slice(4)
        await fill(`source-sheet-${source}`, GUIDE_SOURCE_SHEETS[source])
        const file = controllerStore
          .getState()
          .files.find((entry) => entry.source === source)
        for (const [field, column] of Object.entries(GUIDE_COLUMNS[source])) {
          const draft = controllerStore.getState().mappingDrafts[file.id]
          const columnIndex = draft.preview.headers.indexOf(column)
          assert.ok(columnIndex >= 0, `${source}.${column}`)
          await press(`mapping-${source}-${field}`)
          await press(`mapping-option-${source}-${field}-${columnIndex}`)
        }
        if (source === 'GL')
          await act(async () =>
            controllerStore.actions.setGLAmountBasis(file.id, 'ledger'),
          )
      } else if (id.startsWith('master-') || id === 'raw-run')
        await press('guide-action')
      else if (id === 'validate') await press('master-validate')
      else if (id.startsWith('table-') || id === 'exceptions') {
        await waitUntil(
          () =>
            id === 'exceptions'
              ? !!guideTarget('guide-source-exceptions')
              : guideTarget('guide-evidence')?.dataset.evidenceReady === 'true',
          id,
        )
        await press('guide-acknowledge')
      } else if (id === 'late') await press('guide-exception-EX-06')
      else if (id === 'manual') {
        await waitUntil(() => !!guideTarget('accounting-more-filters'), id)
        if (
          guideTarget('accounting-more-filters').getAttribute(
            'aria-expanded',
          ) !== 'true'
        )
          await press('accounting-more-filters')
        await fill('accounting-scope', 'all')
        await fill('accounting-journal-type', 'MANUAL')
      } else if (['shipping', 'transfer', 'adjustment'].includes(id)) {
        const journal = {
          shipping: 'JE20250100572',
          transfer: 'JE20250603115',
          adjustment: 'JE20250904892',
        }[id]
        await fill('accounting-search', journal)
        await press(`accounting-journal-${journal}`)
      } else if (id === 'notes') {
        await fill(
          'accounting-notes',
          'Đã rà soát MJ-ADJ-2509: doanh thu +1.250 USD chưa giải thích; Finance cần bổ sung chứng từ gốc.',
        )
        await press('accounting-save-review')
      } else if (id === 'evidence') await press('accounting-request-evidence')
      else if (id.startsWith('dash-')) {
        const tab = id.slice(5)
        const from =
          tab === 'overview' || tab === 'bridge' ? '2025-12' : '2025-01'
        await press(`dashboard-tab-${tab}`)
        await fill('dashboard-from', from)
        await waitUntil(
          () => guideTarget('dashboard')?.dataset.dashboardFrom === from,
          `${id} from`,
        )
        await fill('dashboard-to', '2025-12')
        await waitUntil(
          () => guideTarget('dashboard')?.dataset.dashboardTo === '2025-12',
          `${id} to`,
        )
        if (tab === 'bridge') await press('dashboard-bridge-row-bridge-10')
      } else if (id === 'expand') {
        await press('dashboard-expand-quality-cancellations')
        await waitUntil(() => !!guideTarget('dashboard-expanded'), id)
      } else if (id === 'close-expand') {
        const close = guideTarget('dashboard-expanded')?.querySelector(
          '[data-slot="dialog-close"]',
        )
        assert.ok(close, 'expanded widget close button')
        await act(async () => close.click())
        await settle()
      }
    }

    // Exiting while the sample is still downloading cancels it; nothing is imported.
    await startGuided()
    const cancelledSession = controllerWorkspace.session.id
    await waitUntil(() => controllerGuide.stepId === 'overview', 'overview')
    assert.equal(
      document.querySelector('[data-tour="guide-next"]').disabled,
      true,
      'guided mode waits for the user action',
    )
    await actAsUser('overview')
    await nextController()
    assert.equal(controllerGuide.stepId, 'load')
    assert.equal(
      controllerStore.getState().files.length,
      0,
      'guided mode does not import automatically',
    )
    await click('[data-tour="guide-load"]')
    await waitUntil(() => fetchCount === 1, 'lazy sample fetch')
    await click('[data-tour="guide-exit"]')
    await waitUntil(() => !controllerWorkspace.session, 'exit')
    assert.equal(
      document.querySelector('[data-tour="product-intro"]'),
      null,
      'the introduction opens once per page load, not again after practice',
    )
    assert.equal(abortedFetches, 1, 'exit cancels the sample download')
    assert.equal(controllerStore, controllerOriginal)
    assert.equal(controllerOriginal.getState(), beforeGuide)

    blockFetch = false
    await startGuided()
    assert.notEqual(controllerWorkspace.session.id, cancelledSession)
    const guidedSession = controllerWorkspace.session.id
    let rawRuns = 0
    await act(async () =>
      controllerStore.attachProcessor(async () => {
        rawRuns++
        throw new Error(
          '[WEB_FX_NOT_SUPPORTED] WEB có số tiền nội tệ chưa quy đổi; không thể coi nội tệ là USD.',
        )
      }),
    )
    const walk = async (until) => {
      for (
        let count = 0;
        count < 40 && controllerGuide.stepId !== until;
        count++
      ) {
        await waitUntil(
          () =>
            !!document.querySelector('[data-tour="guide-next"]') &&
            !document.querySelector('[data-guide-panel] .guide-spinner'),
          `${controllerGuide.stepId} ready`,
        )
        const id = controllerGuide.stepId
        await actAsUser(id)
        if (id === 'load') {
          assert.equal(fetchCount, 2)
          assert.equal(controllerGuide.sample.evidence.posRows, 17124)
          assert.equal(controllerGuide.sample.evidence.cancelledAll, 139)
          assert.equal(controllerGuide.sample.evidence.cancelled2025, 124)
          assert.equal(controllerOriginal.getState(), beforeGuide)
        }
        await nextController()
      }
    }
    await walk('excel-opt-in')
    assert.equal(controllerGuide.stepId, 'excel-opt-in')
    assert.equal(rawRuns, 1, 'one real processing request at the Raw step')
    assert.equal(controllerStore.getState().status, 'error')
    assert.match(controllerStore.getState().error, /WEB_FX_NOT_SUPPORTED/)
    assert.equal(
      controllerStore.getState().excelReference.enabled,
      false,
      'the Excel reference waits for explicit consent',
    )
    assert.equal(
      document.querySelector('[data-tour="guide-next"]').disabled,
      true,
    )
    await click('[data-tour="guide-action"]')
    await waitUntil(
      () => controllerStore.getState().excelReference.enabled,
      'explicit Excel reference opt-in',
    )
    assert.equal(controllerStore.getState().excelReference.status, 'ready')
    assert.equal(controllerOriginal.getState(), beforeGuide)
    const { createRequire } = await import('node:module')
    const { createDuckDB, VoidLogger, NODE_RUNTIME } =
      await import('@duckdb/duckdb-wasm/blocking')
    const require = createRequire(import.meta.url)
    const bindings = await createDuckDB(
      {
        mvp: {
          mainModule:
            require.resolve('@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm'),
        },
        eh: {
          mainModule:
            require.resolve('@duckdb/duckdb-wasm/dist/duckdb-eh.wasm'),
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
      dropFile: async (path) => bindings.dropFile(path),
      connect: async () => {
        const connection = bindings.connect()
        return {
          query: async (sql) => connection.query(sql),
          close: async () => connection.close(),
        }
      },
    }
    const snapshot = await prepareGuideGL(database, controllerGuide.sample)
    actualViews = true
    await act(async () => controllerStore.actions.setReviewSnapshot(snapshot))
    await nextController()
    const dashboardTabs = []
    for (
      let count = 0;
      count < 30 && !document.querySelector('[data-tour="guide-summary"]');
      count++
    ) {
      await waitUntil(
        () =>
          !!document.querySelector('[data-tour="guide-next"]') &&
          !document.querySelector('[data-guide-panel] .guide-spinner'),
        `${controllerGuide.stepId} ready`,
      )
      const id = controllerGuide.stepId
      await actAsUser(id)
      if (id.startsWith('dash-')) {
        await waitUntil(
          () =>
            document.querySelector('[data-tour="guide-next"]')?.disabled ===
            false,
          id,
        )
        const dashboard = document.querySelector('[data-tour="dashboard"]')
        dashboardTabs.push(dashboard.dataset.dashboardTab)
        assert.equal(dashboard.dataset.dashboardTo, '2025-12')
        assert.equal(
          dashboard.dataset.dashboardFrom,
          ['overview', 'bridge'].includes(dashboard.dataset.dashboardTab)
            ? '2025-12'
            : '2025-01',
        )
      }
      await nextController()
    }
    assert.deepEqual(dashboardTabs, ['overview', 'bridge', 'detail', 'quality'])
    assert.ok(document.querySelector('[data-tour="guide-summary"]'))
    assert.equal(controllerStore.getState().glReview.records.length, 6940)
    assert.equal(
      controllerStore
        .getState()
        .glReview.records.filter((row) => row.journalType === 'MANUAL').length,
      15,
    )
    assert.equal(controllerStore.getState().glCorrections.length, 0)
    const adjCase = controllerStore
      .getState()
      .reviewCases.find((item) =>
        item.recordIds.some((id) =>
          snapshot.records.some(
            (row) => row.id === id && row.journalId === 'JE20250904892',
          ),
        ),
      )
    assert.equal(adjCase.evidenceReviewed, false)
    assert.equal(
      adjCase.history.filter((event) => event.action === 'evidence_requested')
        .length,
      1,
    )
    assert.equal(controllerGuide.sample.sourceExceptions.length, 7)
    const audit = JSON.parse(
      document.querySelector('[data-tour="guide-audit"]').textContent,
    )
    assert.ok(audit.length > 0)
    assert.ok(audit.every((event) => event.actor === 'guide:guided'))
    actualViews = false
    await click('[data-tour="guide-summary-restart"]')
    await waitUntil(
      () => controllerWorkspace.session.id !== guidedSession,
      'replay starts a new sample session',
    )
    assert.equal(controllerStore.getState().files.length, 0)
    assert.equal(controllerStore.getState().excelReference.enabled, false)
    assert.equal(controllerOriginal.getState(), beforeGuide)

    // A wrong field mapping keeps the guided step closed until the user fixes it.
    await waitUntil(() => controllerGuide.stepId === 'overview', 'overview')
    await actAsUser('overview')
    await nextController()
    await actAsUser('load')
    await nextController()
    await actAsUser('map-POS')
    await waitUntil(
      () =>
        document.querySelector('[data-tour="guide-next"]')?.disabled === false,
      'POS mapping verifies',
    )
    await act(async () => {
      const pos = controllerStore
        .getState()
        .files.find((file) => file.source === 'POS')
      controllerStore.actions.setColumnMapping(pos.id, {
        ...GUIDE_COLUMNS.POS,
        transaction_id: 'line_no',
      })
    })
    await settle()
    assert.equal(
      document.querySelector('[data-tour="guide-next"]').disabled,
      true,
      'incorrect mapped field cannot pass a guided step',
    )
    const posHeaderIndex = controllerStore
      .getState()
      .mappingDrafts['guide-pos'].preview.headers.indexOf('receipt_no')
    await click(
      `[data-tour="mapping-option-POS-transaction_id-${posHeaderIndex}"]`,
    )
    await waitUntil(
      () =>
        document.querySelector('[data-tour="guide-next"]')?.disabled === false,
      'correct mapping restores guided verification',
    )
    await click('[data-tour="guide-exit"]')
    assert.equal(controllerOriginal.getState(), beforeGuide)
    assert.ok(mapClicks > 0, 'the user opened the field selectors')
    await act(async () => controllerOriginal.dispose())
  } finally {
    if (root) {
      const { act } = await import('react')
      await act(async () => root.unmount())
    }
    await server?.close()
    dom.window.close()
    for (const [name, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor)
      else delete globalThis[name]
    }
  }
})
