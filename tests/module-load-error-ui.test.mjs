import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { JSDOM, VirtualConsole } from 'jsdom'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'

const CHUNK_FAILURE =
  'Failed to fetch dynamically imported module: http://localhost:5173/node_modules/.vite/deps/xlsx.js?v=8c41938a'

test('failed downloads explain themselves in Vietnamese: stale app files offer a reload, a dropped connection asks to check the network', async () => {
  // jsdom reports location.reload() as an unimplemented navigation.
  const navigations = []
  const virtualConsole = new VirtualConsole()
  virtualConsole.on('jsdomError', (error) => {
    if (/Not implemented: navigation/.test(error.message))
      navigations.push(error.message)
  })
  const dom = new JSDOM(
    '<!doctype html><html><body><main id="test-root"></main></body></html>',
    { url: 'http://localhost/', pretendToBeVisual: true, virtualConsole },
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
      cacheDir: 'node_modules/.vite-tests/module-load-error-ui',
      plugins: [react()],
      resolve: {
        alias: { '@': fileURLToPath(new URL('../src', import.meta.url)) },
      },
      server: { middlewareMode: true, hmr: false, ws: false, watch: null },
      optimizeDeps: { noDiscovery: true },
      appType: 'custom',
    })
    const { act, createElement: h } = await import('react')
    const { createRoot } = await import('react-dom/client')
    const { MemoryRouter } = await import('react-router-dom')
    const { createAppStore, AppStoreContext } =
      await server.ssrLoadModule('/src/lib/store.ts')
    const { ExcelReferenceDialog } = await server.ssrLoadModule(
      '/src/components/excel-reference/ExcelReferenceControls.tsx',
    )
    const { LocalizedError } = await server.ssrLoadModule(
      '/src/components/LocalizedError.tsx',
    )
    store = createAppStore()
    root = createRoot(document.getElementById('test-root'))
    const render = (node) =>
      act(async () =>
        root.render(
          h(
            MemoryRouter,
            null,
            h(AppStoreContext.Provider, { value: store }, node),
          ),
        ),
      )
    const alert = () => document.querySelector('[role="alert"]')
    const buttons = (element) =>
      [...element.querySelectorAll('button')].map((button) =>
        button.textContent.trim(),
      )
    const visibleText = (element) => {
      const copy = element.cloneNode(true)
      copy.querySelectorAll('[data-technical]').forEach((node) => node.remove())
      return copy.textContent
    }

    // The reference session stores whatever its loader threw. A stale app file
    // fails after the download, when the xlsx parser is fetched on first use;
    // a rejected workbook read stands in for that failure here.
    const staleAppFile = {
      name: 'Nexa_Home_Recon_Dataset_Final.xlsx',
      arrayBuffer: async () => {
        throw new TypeError(CHUNK_FAILURE)
      },
    }
    await render(h(ExcelReferenceDialog))
    await act(() => store.actions.loadExcelReference(staleAppFile))
    assert.equal(store.getState().excelReference.status, 'error')
    assert.equal(store.getState().excelReference.error, CHUNK_FAILURE)
    assert.match(alert().textContent, /Không tải được một phần của ứng dụng/)
    assert.match(alert().textContent, /không được lưu lại/)
    assert.doesNotMatch(visibleText(alert()), /Failed to fetch/)
    assert.equal(
      alert().querySelector('[data-technical]').textContent,
      CHUNK_FAILURE,
      'the original browser error stays available for diagnosis',
    )
    assert.deepEqual(buttons(alert()), ['Tải lại trang'])
    const reload = alert().querySelector('button')
    assert.equal(reload.type, 'button')
    await act(async () => reload.click())
    assert.equal(navigations.length, 1, 'the button reloads the page')

    // A dropped connection while downloading the bundled workbook is a network
    // problem, not a stale app: Vietnamese advice and the dialog's own retry.
    for (const wording of ['Failed to fetch', 'Load failed']) {
      expose('fetch', async () => {
        throw new TypeError(wording)
      })
      await act(() => store.actions.loadExcelReference())
      assert.equal(alert().tagName, 'P')
      assert.match(
        alert().textContent,
        /^Không tải được workbook mẫu, có thể do mất kết nối mạng/,
      )
      assert.doesNotMatch(alert().textContent, new RegExp(wording))
      assert.deepEqual(buttons(alert()), [])
      assert.ok(
        [...document.querySelectorAll('button')].some(
          (button) => button.textContent.trim() === 'Mở workbook đi kèm',
        ),
        'the advice names a retry button that is on screen',
      )
    }

    // Ordinary reference errors keep their exact wording and no reload button.
    expose('fetch', async () => ({ ok: false }))
    await act(() => store.actions.loadExcelReference())
    assert.equal(alert().tagName, 'P')
    assert.equal(
      alert().textContent,
      'Không đọc được workbook đi kèm. Hãy chọn file Excel tham chiếu.',
    )
    assert.deepEqual(buttons(alert()), [])

    // Every LocalizedError host (engine banner, processing, mapping) gets the
    // same notice instead of advice to fix the uploaded CSV/XLSX.
    await act(async () => store.actions.disableExcelReference())
    await render(
      h(
        'div',
        { role: 'alert' },
        h(LocalizedError, { message: CHUNK_FAILURE }),
      ),
    )
    assert.match(alert().textContent, /Không tải được một phần của ứng dụng/)
    assert.doesNotMatch(visibleText(alert()), /CSV|XLSX|Failed to fetch/)
    assert.deepEqual(buttons(alert()), ['Tải lại trang'])
    await render(
      h(
        'div',
        { role: 'alert' },
        h(LocalizedError, { message: 'WASM unavailable' }),
      ),
    )
    assert.match(alert().textContent, /Engine dữ liệu cục bộ/)
    assert.deepEqual(buttons(alert()), [])
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
