import assert from 'node:assert/strict'
import { test } from 'node:test'
import { format } from 'node:util'
import { fileURLToPath } from 'node:url'
import { JSDOM } from 'jsdom'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'

test('conventions document reads like the report, edits in session, versions, exports, resets and imports', async () => {
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
  const errors = []
  const originalError = console.error
  console.error = (...args) => {
    errors.push(format(...args))
  }
  const originalCreateURL = URL.createObjectURL
  const originalAnchorClick = dom.window.HTMLAnchorElement.prototype.click
  let downloaded = null
  URL.createObjectURL = (blob) => {
    downloaded = blob
    return 'blob:conventions'
  }
  dom.window.HTMLAnchorElement.prototype.click = () => {}
  let server, root, store
  try {
    server = await createServer({
      configFile: false,
      cacheDir: 'node_modules/.vite-tests/convention-document-ui',
      plugins: [
        react(),
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
    const { act, createElement: h } = React
    const { createAppStore, AppStoreContext } =
      await server.ssrLoadModule('/src/lib/store.ts')
    const { PageInformationProvider } = await server.ssrLoadModule(
      '/src/components/PageInformation.tsx',
    )
    const { Methodology } = await server.ssrLoadModule(
      '/src/pages/Methodology.tsx',
    )
    const { ORIGINAL_CONVENTION_DOCUMENT } = await server.ssrLoadModule(
      '/src/lib/convention-document.ts',
    )
    const { useConventionUnloadGuard } = await server.ssrLoadModule(
      '/src/hooks/useConventionUnloadGuard.ts',
    )
    const { useAppStore } = await server.ssrLoadModule('/src/lib/store.ts')
    function UnloadGuard() {
      useConventionUnloadGuard(useAppStore().conventions)
      return null
    }
    const unloadBlocked = () => {
      const event = new dom.window.Event('beforeunload', { cancelable: true })
      dom.window.dispatchEvent(event)
      return event.defaultPrevented
    }
    store = createAppStore()
    root = createRoot(document.getElementById('test-root'))
    let renders = 0
    const render = async () =>
      act(async () =>
        root.render(
          h(
            PageInformationProvider,
            null,
            h(
              MemoryRouter,
              { key: ++renders, initialEntries: ['/methodology'] },
              h(
                AppStoreContext.Provider,
                { value: store },
                h(UnloadGuard),
                h(Methodology),
              ),
            ),
          ),
        ),
      )
    const $ = (selector) => document.querySelector(selector)
    const button = (text, scope = document) =>
      [...scope.querySelectorAll('button')].find(
        (element) => element.textContent.trim() === text,
      )
    const click = async (element) => {
      assert.ok(element)
      await act(async () => element.click())
    }
    const type = async (element, value) => {
      assert.ok(element)
      const prototype =
        element instanceof dom.window.HTMLTextAreaElement
          ? dom.window.HTMLTextAreaElement.prototype
          : dom.window.HTMLInputElement.prototype
      await act(async () => {
        Object.getOwnPropertyDescriptor(prototype, 'value').set.call(
          element,
          value,
        )
        element.dispatchEvent(new dom.window.Event('input', { bubbles: true }))
      })
    }
    const conventions = () => store.getState().conventions

    // Raw workspace opens on the document tab; other tabs stay available.
    await render()
    assert.equal(
      unloadBlocked(),
      false,
      'the bundled original needs no warning',
    )
    const documentTab = document.getElementById('model-tab-document')
    assert.equal(documentTab.getAttribute('aria-selected'), 'true')
    assert.match(documentTab.textContent, /Tài liệu quy ước/)
    assert.equal($('#model-panel-document').hidden, false)
    assert.equal($('#model-panel-pipeline').hidden, true)
    assert.equal($('.mw-workspace').dataset.tab, 'document')
    assert.equal($('.cd-shell').dataset.print, 'on')
    const paper = () => $('.cd-paper')
    assert.match(paper().textContent, /Quy ước ghi nhận và đối soát doanh thu/)
    assert.match(paper().textContent, /Bảng 7\.\s*Trình tự khoản mục cầu nối/)
    assert.match(paper().textContent, /revenue_usd/)
    assert.equal(paper().querySelectorAll('.cd-formula-number').length, 3)
    assert.match($('.cd-status').textContent, /Bản gốc 1\.0/)
    assert.equal($('.cd-banner'), null)
    // The application column reads the engine, not the document.
    const thresholds = paper().querySelector('.cd-parameters')
    assert.match(thresholds.textContent, /Nhật ký ngoại lệ: không xét/)
    assert.match(thresholds.textContent, /Chặt hơn tài liệu/)
    // Raw live column maps steps to engine buckets without inventing amounts.
    assert.match(paper().textContent, /Timing_Differences/)
    assert.match(
      paper().textContent,
      /Chưa tách riêng · nằm trong Chưa giải thích/,
    )
    assert.match(paper().textContent, /Chưa có lần chạy thành công/)
    // Table of contents lists all sections.
    assert.equal(
      $('.cd-toc').querySelectorAll('button').length,
      ORIGINAL_CONVENTION_DOCUMENT.sections.length,
    )
    // “Phóng to” lifts the workspace above a dimmed backdrop; Escape or the
    // backdrop restores it, and the toggle keeps focus.
    const expandToggle = () => $('.mw-expand-toggle')
    await click(expandToggle())
    assert.ok($('.mw-workspace').classList.contains('is-expanded-view'))
    assert.ok(document.body.querySelector(':scope > .expand-backdrop'))
    assert.equal(expandToggle().getAttribute('aria-pressed'), 'true')
    assert.ok($('.mw-expand-close'))
    await click($('.mw-expand-close'))
    assert.equal(
      $('.mw-workspace').classList.contains('is-expanded-view'),
      false,
    )
    assert.equal($('.mw-expand-close'), null)
    await click(expandToggle())
    await act(async () =>
      dom.window.dispatchEvent(
        new dom.window.KeyboardEvent('keydown', { key: 'Escape' }),
      ),
    )
    assert.equal(
      $('.mw-workspace').classList.contains('is-expanded-view'),
      false,
    )
    assert.equal($('.expand-backdrop'), null)
    assert.equal(document.activeElement, expandToggle())
    await click(expandToggle())
    await click($('.expand-backdrop'))
    assert.equal(
      $('.mw-workspace').classList.contains('is-expanded-view'),
      false,
    )
    await click(button('Mở danh mục quy tắc'))
    assert.equal(
      document.getElementById('model-tab-rules').getAttribute('aria-selected'),
      'true',
    )
    assert.equal($('.cd-shell').dataset.print, 'off')
    await click(documentTab)

    // Edit mode: change a paragraph and a threshold, then save a version.
    await click(button('Chỉnh sửa'))
    assert.ok(conventions().draft)
    assert.match($('.cd-status').textContent, /Bản nháp 1\.1/)
    assert.ok($('.cd-draft-ribbon'))
    assert.equal(button('Lưu thay đổi').disabled, true)
    assert.equal(
      paper().querySelectorAll('.cd-edit-trigger').length,
      ORIGINAL_CONVENTION_DOCUMENT.sections.flatMap((s) => s.blocks).length,
    )
    await click($('[data-block-id="scope-intro"] .cd-edit-trigger'))
    await type(
      $('[data-block-id="scope-intro"] textarea'),
      'Phạm vi đã cập nhật theo quyết định của nhóm Finance.',
    )
    assert.equal(
      $('[data-block-id="scope-intro"]').dataset.marker,
      'draft',
      'unsaved edits are marked in the margin',
    )
    await click(button('Xong', $('[data-block-id="scope-intro"]')))
    assert.match(
      $('[data-block-id="scope-intro"]').textContent,
      /quyết định của nhóm Finance/,
    )
    await click($('[data-block-id="thresholds-table"] .cd-edit-trigger'))
    await type($('input[aria-label="Giá trị · Ngưỡng vượt — số tiền"]'), '300')
    assert.match(
      $('[data-block-id="thresholds-table"]').textContent,
      /Khác tài liệu/,
    )
    await click(button('Lưu thay đổi'))
    const dialog = () => $('[role="dialog"]')
    assert.match(dialog().textContent, /Ghi nhận phiên bản tài liệu/)
    assert.match(dialog().textContent, /2 khối nội dung thay đổi/)
    await click(button('Lưu phiên bản 1.1', dialog()))
    assert.match(dialog().textContent, /Hãy ghi nội dung thay đổi/)
    assert.equal(conventions().document.version, '1.0')
    await type(
      dialog().querySelector('textarea'),
      'Nâng ngưỡng vượt lên 300 USD.',
    )
    await type(dialog().querySelector('input'), 'Nhóm Finance')
    await click(button('Lưu phiên bản 1.1', dialog()))
    assert.equal(dialog(), null)
    assert.equal(conventions().document.version, '1.1')
    assert.equal(conventions().draft, null)
    assert.match($('.cd-status').textContent, /Bản 1\.1 · chỉ trong phiên/)
    assert.match($('.cd-banner[data-tone="warning"]').textContent, /Xuất JSON/)
    assert.deepEqual(
      [...paper().querySelectorAll('[data-marker="saved"]')].map(
        (element) => element.dataset.blockId,
      ),
      ['scope-intro', 'thresholds-table'],
    )
    const revisions = paper().querySelector('.cd-revisions')
    assert.match(revisions.textContent, /Nâng ngưỡng vượt lên 300 USD\./)
    assert.match(revisions.textContent, /Nhóm Finance/)
    assert.match(revisions.textContent, /Chưa xuất file/)
    assert.match($('[data-block-id="thresholds-table"]').textContent, /300 USD/)
    // Calculations keep using the engine value.
    assert.match(
      $('[data-block-id="thresholds-table"]').textContent,
      /Tổng quan: > 200 USD/,
    )
    await click(button('Đánh dấu thay đổi'))
    assert.equal(paper().querySelectorAll('[data-marker]').length, 0)
    await click(button('Đánh dấu thay đổi'))

    // The session document survives navigation (a fresh mount).
    await act(async () => root.render(null))
    await render()
    assert.match(
      $('[data-block-id="scope-intro"]').textContent,
      /quyết định của nhóm Finance/,
    )
    assert.match($('.cd-status').textContent, /Bản 1\.1/)

    // A draft also survives navigation and can be discarded.
    await click(button('Chỉnh sửa'))
    await click($('[data-block-id="timing-note"] .cd-edit-trigger'))
    await type($('[data-block-id="timing-note"] textarea'), 'Tạm thời.')
    await act(async () => root.render(null))
    await render()
    assert.match($('.cd-status').textContent, /Bản nháp 1\.2/)
    assert.match($('[data-block-id="timing-note"]').textContent, /Tạm thời\./)
    await click(button('Hủy'))
    assert.match(dialog().textContent, /Bỏ các thay đổi chưa lưu/)
    await click(button('Bỏ thay đổi', dialog()))
    assert.equal(conventions().draft, null)
    assert.doesNotMatch(
      $('[data-block-id="timing-note"]').textContent,
      /Tạm thời/,
    )

    // Reloading would lose the unexported session version.
    assert.equal(unloadBlocked(), true)
    // Export marks the session version as saved to a file.
    await click(button('Xuất JSON'))
    assert.ok(downloaded)
    const exported = await downloaded.text()
    assert.match(exported, /"version": "1\.1"/)
    assert.equal(conventions().exportedVersion, '1.1')
    assert.equal(unloadBlocked(), false)
    assert.equal($('.cd-banner[data-tone="warning"]'), null)
    assert.doesNotMatch(
      paper().querySelector('.cd-revisions').textContent,
      /Chưa xuất file/,
    )
    assert.match(
      $('.cd-banner[data-tone="success"]').textContent,
      /v1\.1\.json/,
    )

    // Reset returns to the report's original.
    await click(button('Khôi phục bản gốc'))
    await click(button('Khôi phục bản gốc', dialog()))
    assert.equal(conventions().document, ORIGINAL_CONVENTION_DOCUMENT)
    assert.match($('.cd-status').textContent, /Bản gốc 1\.0/)
    assert.equal(button('Khôi phục bản gốc'), undefined)

    // Import the exported file, then reject a broken one.
    const importFile = async (file) => {
      const input = $(
        'input[type="file"][aria-label="Chọn file JSON tài liệu quy ước"]',
      )
      Object.defineProperty(input, 'files', {
        configurable: true,
        value: [file],
      })
      await act(async () => {
        input.dispatchEvent(new dom.window.Event('change', { bubbles: true }))
        await new Promise((resolve) => setTimeout(resolve, 20))
      })
    }
    await importFile(new File([exported], 'quy-uoc-ghi-nhan-v1.1.json'))
    assert.equal(conventions().document.version, '1.1')
    assert.match(
      $('[data-block-id="scope-intro"]').textContent,
      /quyết định của nhóm Finance/,
    )
    assert.match($('.cd-banner[data-tone="success"]').textContent, /1\.1/)
    await importFile(new File(['{"schema":"x"}'], 'broken.json'))
    assert.match(
      $('.cd-banner[data-tone="error"]').textContent,
      /Không nhập được file/,
    )
    assert.equal(conventions().document.version, '1.1')
    assert.deepEqual(
      errors.filter((message) => !/Not implemented/.test(message)),
      [],
    )
  } finally {
    if (root) {
      const { act } = await import('react')
      await act(async () => root.unmount())
    }
    URL.createObjectURL = originalCreateURL
    dom.window.HTMLAnchorElement.prototype.click = originalAnchorClick
    console.error = originalError
    store?.dispose()
    await server?.close()
    dom.window.close()
    for (const [name, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor)
      else delete globalThis[name]
    }
  }
})
