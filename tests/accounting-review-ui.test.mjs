import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { JSDOM } from 'jsdom'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'

test('accounting review interacts with shared cases, explicit correction previews and GL-first diagnostics', async () => {
  const dom = new JSDOM(
    '<!doctype html><html><body><main id="test-root"></main></body></html>',
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
    'Event',
    'MouseEvent',
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
    if (!saved.has(name))
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
  const resizeObservers = []
  let layoutWidth = 1300
  dom.window.HTMLElement.prototype.getBoundingClientRect = function () {
    return {
      width: layoutWidth,
      height: 500,
      top: 0,
      left: 0,
      bottom: 500,
      right: layoutWidth,
      x: 0,
      y: 0,
      toJSON() {},
    }
  }
  expose(
    'ResizeObserver',
    class {
      constructor(callback) {
        this.callback = callback
        resizeObservers.push(this)
      }
      observe(target) {
        this.target = target
        this.callback([{ target, contentRect: { width: layoutWidth } }])
      }
      disconnect() {}
      unobserve() {}
    },
  )
  dom.window.HTMLElement.prototype.scrollTo = function (options) {
    this.scrollTop = typeof options === 'object' ? options.top || 0 : options
  }
  expose('IS_REACT_ACT_ENVIRONMENT', true)
  let server, root, store
  try {
    server = await createServer({
      configFile: false,
      cacheDir: 'node_modules/.vite-tests/accounting-review-ui',
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
    const { createAppStore, AppStoreContext } =
      await server.ssrLoadModule('/src/lib/store.ts')
    const { AccountingReview, AccountingExceptionCases } =
      await server.ssrLoadModule('/src/pages/AccountingReview.tsx')
    const { DataProcessing } = await server.ssrLoadModule(
      '/src/pages/DataProcessing.tsx',
    )
    const { ReconciliationRunStatus } = await server.ssrLoadModule(
      '/src/components/ReconciliationRunStatus.tsx',
    )
    const base = {
      id: 'adj-record',
      sourceFingerprint: 'source-v1',
      configurationVersion: 'cfg-v1',
      fileId: 'GL',
      fileName: 'GL.csv',
      sheetName: 'CSV',
      sourceRow: 4,
      sourceRecord: 3,
      journalId: 'JE20250904892',
      journalType: 'MANUAL',
      postingDate: '2025-09-30',
      period: '2025-09',
      storeKey: '-1',
      storeCode: null,
      channel: 'UNALLOCATED',
      amountCents: -125000,
      revenueCents: 125000,
      sourceRef: 'MJ-ADJ-2509',
      description: 'ADJ-0925 điều chỉnh theo yêu cầu',
      amountBasis: 'ledger',
      raw: {
        journalId: 'JE20250904892',
        postingDate: '2025-09-30',
        period: '2025-09',
        storeKey: null,
        storeCode: null,
        channel: 'UNALLOCATED',
        amount: '-1250',
        journalType: 'MANUAL',
        sourceRef: 'MJ-ADJ-2509',
        description: 'ADJ-0925 điều chỉnh theo yêu cầu',
      },
      original: {
        postingDate: '2025-09-30',
        period: '2025-09',
        storeKey: '-1',
        channel: 'UNALLOCATED',
        amountCents: -125000,
        revenueCents: 125000,
      },
      staleCorrection: false,
    }
    let runs = 0,
      mode = 'valid'
    store = createAppStore({ start: '2025-01-01', end: '2025-12-31' })
    store.attachProcessor(async (_, __, options) => {
      runs++
      const correction = options.glCorrections?.find(
        (c) => c.recordId === base.id && c.active,
      )
      const effective = {
        ...base,
        ...correction?.patch,
        revenueCents:
          correction?.patch.amountCents === undefined
            ? base.revenueCents
            : -correction.patch.amountCents,
      }
      const records =
        mode === 'removed'
          ? []
          : [
              effective,
              {
                ...base,
                id: 'system-record',
                journalId: 'SYS-01',
                journalType: 'POS',
                sourceFingerprint: 'sys-v1',
                description: 'Daily sales',
                channel: 'STORE',
                storeKey: 'S01',
                amountCents: -10000,
                revenueCents: 10000,
              },
            ]
      const snapshot = {
        runId: `ui-gl-${runs}`,
        configurationVersion: 'cfg-v1',
        complete: mode !== 'invalid',
        records,
        expectedDaily: [],
        transformations: [
          {
            id: 'sign-adj',
            rule: 'GL_SIGN',
            recordId: base.id,
            journalId: base.journalId,
            sourceField: 'amount_usd',
            outputField: 'revenue_usd',
            before: '-1250',
            after: '1250',
            impactCents: 250000,
          },
        ],
        diagnostics:
          mode === 'invalid'
            ? [
                {
                  id: 'amount-error',
                  code: 'GL_AMOUNT_INVALID',
                  recordId: base.id,
                  journalId: base.journalId,
                  field: 'amount_usd',
                  value: 'oops',
                  fileName: 'GL.csv',
                  sheetName: 'CSV',
                  sourceRow: 4,
                  reason: 'Số tiền không đọc được',
                  blocking: true,
                },
              ]
            : [],
      }
      options.onGLSnapshot(snapshot)
      if (mode === 'web-invalid') {
        const originalMessage =
          'WEB has invalid keys, dates, status, or USD amounts.'
        options.onFailure({
          runId: snapshot.runId,
          source: 'WEB',
          stage: 'validating',
          originalMessage,
          reasons: [
            {
              code: 'WEB_STATUS_INVALID',
              fields: ['order_status'],
              message: 'Trạng thái đơn hàng WEB chưa được hỗ trợ.',
              count: 1,
            },
          ],
          samples: [
            {
              fileName: 'WEB.csv',
              sourceRecord: 3,
              values: {
                order_id: 'WEB-ERROR-03',
                order_status: 'Pending review',
              },
            },
          ],
        })
        options.onProgress({
          runId: snapshot.runId,
          phase: 'validating',
          status: 'error',
          source: 'WEB',
          error: originalMessage,
        })
        throw new Error(originalMessage)
      }
      if (mode === 'invalid') {
        options.onProgress({
          runId: snapshot.runId,
          phase: 'validating',
          status: 'error',
          source: 'GL',
          error: '[GL_AMOUNT_INVALID] oops',
        })
        throw new Error('[GL_AMOUNT_INVALID] oops')
      }
      const total = records.reduce((sum, r) => sum + r.revenueCents, 0)
      return {
        glReview: snapshot,
        exceptions: [],
        schemaMode: 'accounting',
        compatibilityWarnings: [],
        dimTables: [],
        cents: {
          Flash_Sales: 10000,
          Discounts: 0,
          Cancellations: 0,
          Timing_Differences: 0,
          Returns: 0,
          Data_Errors: 0,
          GL_Finance: total,
        },
        Flash_Sales: 100,
        Discounts: 0,
        Cancellations: 0,
        Timing_Differences: 0,
        Returns: 0,
        Data_Errors: 0,
        GL_Finance: total / 100,
        Unexplained: (total - 10000) / 100,
        unexplainedCents: total - 10000,
        period: { start: '2025-01-01', end: '2025-12-31' },
        rowCounts: { POS: 1, WEB: 0, GL: records.length, Flash: 1 },
        dailyDifferences: [],
        dailyDifferenceCount: 0,
      }
    })
    await act(async () => {
      store.actions.setFiles(
        ['POS', 'WEB', 'GL', 'Flash'].map((source) => ({
          id: source,
          source,
          file: new File(['a\nb'], `${source}.csv`),
        })),
      )
      await store.whenSettled()
    })
    root = createRoot(document.getElementById('test-root'))
    const render = async (component, path = '/accounting-review') =>
      act(async () =>
        root.render(
          h(
            MemoryRouter,
            { key: path, initialEntries: [path] },
            h(AppStoreContext.Provider, { value: store }, component),
          ),
        ),
      )
    const button = (text) =>
      [...document.querySelectorAll('button')].find((el) =>
        el.textContent.includes(text),
      )
    const field = (text) =>
      [...document.querySelectorAll('.accounting-inspector label')]
        .find((el) => el.textContent.trim().startsWith(text))
        ?.querySelector('input,textarea,select')
    const filter = (text) =>
      [...document.querySelectorAll('.accounting-filters label')]
        .find((el) => el.textContent.trim().startsWith(text))
        ?.querySelector('input,select')
    const tab = (id) => document.getElementById(`inspector-tab-${id}`)
    const resize = async (width) => {
      layoutWidth = width
      await act(async () => {
        for (const observer of resizeObservers)
          if (observer.target?.isConnected)
            observer.callback([
              { target: observer.target, contentRect: { width } },
            ])
      })
    }
    const change = async (el, value) => {
      assert.ok(el)
      await act(async () => {
        Object.getOwnPropertyDescriptor(
          el.constructor.prototype,
          'value',
        ).set.call(el, value)
        el.dispatchEvent(
          new Event(el.tagName === 'SELECT' ? 'change' : 'input', {
            bubbles: true,
          }),
        )
      })
    }
    const click = async (el) => {
      assert.ok(el)
      await act(async () => el.click())
    }
    const dashboardReturn = '/?tab=detail&from=2025-09&to=2025-09'
    const dashboardRecord = new URLSearchParams({
      record: 'system-record',
      from: 'dashboard',
      returnTo: dashboardReturn,
    })
    await render(h(AccountingReview), `/accounting-review?${dashboardRecord}`)
    assert.match(
      document.querySelector('.accounting-inspector').textContent,
      /SYS-01/,
    )
    const dashboardBack = [...document.querySelectorAll('a')].find((link) =>
      link.textContent.includes('Quay lại dashboard'),
    )
    assert.equal(dashboardBack.getAttribute('href'), dashboardReturn)
    await render(h(AccountingReview))
    assert.equal(
      document.querySelector('.accounting-panels').dataset.layout,
      'split',
      'inspector sits alongside the table only when its actual container fits',
    )
    for (const width of [1086, 1160, 358]) {
      await resize(width)
      assert.equal(
        document.querySelector('.accounting-panels').dataset.layout,
        'drawer',
      )
      assert.equal(document.querySelector('.accounting-inspector').hidden, true)
    }
    await resize(1640)
    assert.equal(
      document.querySelector('.accounting-panels').dataset.layout,
      'split',
    )
    await resize(1300)
    assert.equal(
      document.querySelectorAll('.journal-button').length,
      1,
      'queue defaults to review cases, not all GL',
    )
    assert.match(document.body.textContent, /JE20250904892/)
    assert.match(document.body.textContent, /Chưa xác minh chứng từ/)
    const financialBeforeFilters = store.getState().reconciliationData.cents
    await change(filter('Tìm bút toán'), 'SYS-01')
    assert.equal(document.querySelectorAll('.journal-button').length, 0)
    await change(filter('Góc nhìn'), 'all')
    assert.equal(document.querySelectorAll('.journal-button').length, 1)
    assert.equal(
      document.querySelector('.journal-button').textContent,
      'SYS-01',
    )
    await click(button('Xóa bộ lọc'))
    assert.equal(
      document.querySelector('.journal-button').textContent,
      base.journalId,
    )
    assert.equal(
      store.getState().reconciliationData.cents,
      financialBeforeFilters,
      'table filters never alter financial results',
    )
    assert.equal(document.querySelector('.accounting-bulk-bar'), null)
    await click(document.querySelector('.journal-table input[type="checkbox"]'))
    assert.match(
      document.querySelector('.accounting-bulk-bar').textContent,
      /1 hồ sơ/,
    )
    await click(button('Bỏ chọn'))
    assert.equal(document.querySelector('.accounting-bulk-bar'), null)
    await click(tab('evidence'))
    assert.equal(
      field('Tôi đã rà soát').checked,
      false,
      'source reference never verifies evidence',
    )
    const caseId = store.getState().reviewCases[0].id
    await change(field('Ghi chú'), 'Finance đang tìm chứng từ gốc')
    const notesElement = field('Ghi chú')
    notesElement.focus()
    document.querySelector('.inspector-body').scrollTop = 210
    const priorRuns = runs
    await click(button('Lưu rà soát'))
    assert.equal(
      store.getState().reviewCases[0].notes,
      'Finance đang tìm chứng từ gốc',
    )
    assert.equal(runs, priorRuns, 'case edits do not rerun or change GL')
    assert.equal(
      field('Ghi chú'),
      notesElement,
      'saving the same case retains form elements',
    )
    assert.equal(
      document.activeElement,
      notesElement,
      'saving retains the active input',
    )
    assert.equal(document.querySelector('.inspector-body').scrollTop, 210)
    assert.equal(
      document.querySelector('.draft-indicator'),
      null,
      'saved changes are no longer dirty',
    )
    await click(button('Yêu cầu chứng từ'))
    assert.equal(field('Trạng thái').value, 'in_progress')
    assert.equal(
      field('Bước tiếp theo').value,
      store.getState().reviewCases[0].nextStep,
      'requesting evidence refreshes the clean form rather than leaving a stale next step',
    )
    assert.equal(
      field('Ghi chú'),
      notesElement,
      'external case updates keep the same input mounted',
    )
    assert.equal(document.querySelector('.draft-indicator'), null)
    const requestedStep = store.getState().reviewCases[0].nextStep
    const requestedHistory = store.getState().reviewCases[0].history
    await click(button('Yêu cầu chứng từ'))
    assert.strictEqual(
      store.getState().reviewCases[0].history,
      requestedHistory,
    )
    assert.match(
      document.body.textContent,
      /đã có yêu cầu chứng từ đang chờ xử lý/,
    )
    await click(button('Lưu rà soát'))
    assert.equal(store.getState().reviewCases[0].status, 'in_progress')
    assert.equal(store.getState().reviewCases[0].nextStep, requestedStep)
    await resize(1100)
    assert.equal(
      document.querySelector('.accounting-panels').dataset.layout,
      'drawer',
    )
    assert.equal(document.querySelector('.accounting-inspector').hidden, true)
    await click(document.querySelector('.journal-button'))
    assert.equal(document.querySelector('.accounting-inspector').hidden, false)
    assert.equal(
      document.querySelector('.accounting-inspector').getAttribute('role'),
      'dialog',
    )
    assert.equal(
      field('Ghi chú'),
      notesElement,
      'resize keeps the same case draft mounted',
    )
    await change(field('Ghi chú'), 'Bản nháp chưa lưu')
    let confirmations = 0
    dom.window.confirm = () => {
      confirmations++
      return false
    }
    const referenceSwitch = new dom.window.Event('reconcile:before-reference', {
      cancelable: true,
    })
    assert.equal(dom.window.dispatchEvent(referenceSwitch), false)
    assert.equal(referenceSwitch.defaultPrevented, true)
    assert.equal(confirmations, 1)
    assert.equal(field('Ghi chú').value, 'Bản nháp chưa lưu')
    await click(document.querySelector('[aria-label="Đóng chi tiết"]'))
    assert.equal(confirmations, 2)
    assert.equal(document.querySelector('.accounting-inspector').hidden, false)
    assert.equal(field('Ghi chú').value, 'Bản nháp chưa lưu')
    dom.window.confirm = () => true
    await click(document.querySelector('[aria-label="Đóng chi tiết"]'))
    assert.equal(document.querySelector('.accounting-inspector').hidden, true)
    await click(document.querySelector('.journal-button'))
    await click(tab('evidence'))
    assert.equal(
      field('Ghi chú').value,
      'Finance đang tìm chứng từ gốc',
      'confirmed discard restores the saved case',
    )
    await resize(1300)
    await change(filter('Góc nhìn'), 'all')
    await change(field('Ghi chú'), 'Chưa lưu trước khi đổi bút toán')
    document.querySelector('.inspector-body').scrollTop = 280
    dom.window.confirm = () => false
    const systemJournal = () =>
      [...document.querySelectorAll('.journal-button')].find(
        (el) => el.textContent === 'SYS-01',
      )
    await click(systemJournal())
    assert.equal(
      document.getElementById('review-inspector-title').textContent,
      base.journalId,
    )
    assert.equal(field('Ghi chú').value, 'Chưa lưu trước khi đổi bút toán')
    dom.window.confirm = () => true
    await click(systemJournal().closest('tr'))
    assert.equal(
      document.getElementById('review-inspector-title').textContent,
      'SYS-01',
    )
    assert.equal(
      document.querySelector('.inspector-body').scrollTop,
      0,
      'a new journal starts at the top',
    )
    await click(
      [...document.querySelectorAll('.journal-button')].find(
        (el) => el.textContent === base.journalId,
      ),
    )
    await click(tab('evidence'))
    assert.equal(field('Ghi chú').value, 'Finance đang tìm chứng từ gốc')
    await click(button('Xóa bộ lọc'))
    const statusBeforeConfirmation = store.getState().reviewCases[0].status
    await change(field('Trạng thái'), 'confirmed')
    await click(button('Lưu rà soát'))
    assert.equal(
      store.getState().reviewCases[0].status,
      statusBeforeConfirmation,
    )
    assert.match(document.body.textContent, /Xác nhận cần mục đích/)
    await change(field('Phân loại'), 'shipping')
    await change(field('Mục đích'), 'Phí giao hàng tháng 9 theo hóa đơn')
    await change(field('Bằng chứng /'), 'Invoice INV-09 bản gốc đã cung cấp')
    await click(field('Tôi đã rà soát'))
    await change(
      field('Nội dung quyết định'),
      'Finance xác nhận khoản phí giao hàng theo Invoice INV-09',
    )
    await change(field('Trạng thái'), 'confirmed')
    await click(button('Lưu rà soát'))
    assert.equal(store.getState().reviewCases[0].status, 'confirmed')
    await change(field('Bằng chứng /'), 'Invoice thay thế INV-09B')
    assert.equal(
      field('Tôi đã rà soát').checked,
      false,
      'replacement evidence clears reviewed flag',
    )
    assert.equal(
      field('Trạng thái').value,
      'in_progress',
      'changed decision requires explicit reconfirmation',
    )
    await click(button('Lưu rà soát'))
    await render(h(AccountingExceptionCases), '/exceptions')
    assert.match(document.body.textContent, /Phí vận chuyển/)
    assert.match(document.body.textContent, /hồ sơ còn mở/)
    await render(h(AccountingReview))
    await click(tab('correction'))
    assert.equal(
      store.getState().reviewCases[0].status,
      'in_progress',
      'opening panel does not resolve case',
    )
    await change(field('Số tiền GL gốc (USD)'), '-1300.00')
    await click(button('Xem trước ảnh hưởng'))
    assert.match(document.body.textContent, /Nhập lý do chỉnh sửa/)
    assert.equal(button('Áp dụng & tính lại'), undefined)
    await change(
      field('Lý do và căn cứ'),
      'Invoice INV-09B xác nhận số tiền 1300 USD',
    )
    await click(button('Xem trước ảnh hưởng'))
    assert.ok(document.querySelector('.accounting-preview'))
    assert.equal(runs, priorRuns, 'preview makes no financial mutation')
    assert.equal(store.getState().glCorrections.length, 0)
    await act(async () => {
      button('Áp dụng & tính lại').click()
      await store.whenSettled()
    })
    assert.equal(store.getState().glReview.records[0].revenueCents, 130000)
    assert.equal(
      store.getState().glReview.records[0].raw.amount,
      '-1250',
      'raw remains immutable',
    )
    await change(field('Lý do và căn cứ'), 'Hoàn tác kiểm tra lại hóa đơn gốc')
    await click(button('Xem trước hoàn tác'))
    assert.match(
      document.querySelector('.accounting-preview').textContent,
      /Hoàn tác về nguồn gốc/,
    )
    assert.equal(
      store.getState().glReview.records[0].revenueCents,
      130000,
      'undo preview is nonmutating',
    )
    assert.equal(
      tab('correction').getAttribute('aria-selected'),
      'true',
      'correction tab survives recalculation',
    )
    assert.ok(
      document.querySelector('.inspector-footer button[value="commit"]'),
      'apply and undo stay reachable in the fixed footer',
    )
    await act(async () => {
      button('Hoàn tác & tính lại').click()
      await store.whenSettled()
    })
    assert.equal(store.getState().glReview.records[0].revenueCents, 125000)
    mode = 'web-invalid'
    await act(async () => {
      store.actions.retry()
      await store.whenSettled()
    })
    await render(h(ReconciliationRunStatus))
    const alert = document.querySelector('[role="alert"]')
    assert.match(alert.textContent, /Đối soát đang bị chặn · Nguồn WEB/)
    assert.match(alert.textContent, /GL đã hợp lệ trong phiên này/)
    assert.match(alert.textContent, /Trạng thái đơn hàng WEB chưa được hỗ trợ/)
    assert.match(alert.textContent, /WEB_STATUS_INVALID/)
    assert.match(alert.textContent, /order_status/)
    assert.match(alert.textContent, /2025-01-01 → 2025-12-31/)
    assert.match(alert.textContent, new RegExp(store.getState().glReview.runId))
    assert.doesNotMatch(
      alert.textContent,
      /Hãy kiểm tra định dạng ngày và chọn trọn tháng/,
    )
    await click(button('Xem dòng lỗi'))
    assert.equal(alert.querySelector('details').open, true)
    assert.match(alert.textContent, /WEB-ERROR-03/)
    assert.ok(button('Sửa cấu hình nguồn WEB'))
    await act(async () => store.actions.closeProcessingPanel())
    await click(button('Mở tiến trình'))
    assert.equal(store.getState().processingPanelOpen, true)
    mode = 'invalid'
    await act(async () => {
      store.actions.retry()
      await store.whenSettled()
    })
    await render(h(DataProcessing), '/processing')
    assert.match(
      document.querySelector('.accounting-diagnostics').textContent,
      /GL_AMOUNT_INVALID/,
    )
    assert.match(document.body.textContent, /amount_usd/)
    assert.match(document.body.textContent, /dòng 4/)
    assert.equal(document.querySelector('.pos-diagnostics'), null)
    await render(h(DataProcessing), '/processing?run=previous-gl-run')
    assert.equal(
      document.querySelector('.accounting-diagnostics'),
      null,
      'a stale-run link must not expose diagnostics from the current GL snapshot',
    )
    assert.match(document.body.textContent, /Chưa thể mở bảng này/)
    mode = 'removed'
    await act(async () => {
      store.actions.retry()
      await store.whenSettled()
    })
    await render(
      h(AccountingReview),
      `/accounting-review?case=${encodeURIComponent(caseId)}`,
    )
    assert.match(
      document.querySelector('.accounting-inspector').textContent,
      /Nguồn hoặc cấu hình đã đổi/,
    )
    assert.match(
      document.querySelector('.accounting-inspector').textContent,
      /Finance đang tìm chứng từ gốc/,
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
