import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import * as XLSX from 'xlsx'
import { JSDOM } from 'jsdom'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import {
  INTRO_PHASES,
  INTRO_SAMPLE,
  INTRO_STEPS,
  claimIntroAutoOpen,
  introSourceRowTotal,
  introStepForPath,
  introStepIndex,
  introVarianceOfFlash,
  introVarianceOfGL,
  introVarianceUSD,
} from '../src/lib/product-intro.ts'
import { parseExcelReference } from '../src/lib/excel-reference.ts'
import { buildDashboardModel } from '../src/lib/dashboard-model.ts'

const sourceBytes = await readFile(
  new URL('../docs/source/Nexa_Home_Recon_Dataset_Final.xlsx', import.meta.url),
)
const workbook = XLSX.read(sourceBytes, { type: 'array' })
const cell = (sheet, address) => workbook.Sheets[sheet][address]?.v
const rows = (sheet) =>
  XLSX.utils.sheet_to_json(workbook.Sheets[sheet], { defval: '' })
const close = (actual, expected, label, tolerance = 0.005) =>
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${label}: ${actual} vs ${expected}`,
  )
const BRIDGE = '04a_Cau_noi_Flash_GL'
const MONTH_COLUMNS = 'CDEFGHIJKLMN'.split('')
// Excel serial dates.
const serial = (iso) => (Date.parse(iso) - Date.UTC(1899, 11, 30)) / 86_400_000
// What “Tạm xem theo Excel” reads, and the dashboard built from it.
const reference = await parseExcelReference(
  await readFile(
    new URL(
      '../public/demo/Nexa_Home_Recon_Dataset_Final.xlsx',
      import.meta.url,
    ),
  ),
  'Nexa_Home_Recon_Dataset_Final.xlsx',
)
const model = buildDashboardModel({
  source: 'excel',
  workbook: reference,
  filters: {
    startMonth: '2025-01',
    endMonth: '2025-12',
    channel: 'ALL',
    country: 'ALL',
  },
})
const shots = INTRO_STEPS.flatMap((step) => step.shots ?? [])
const shot = (id) => shots.find((item) => item.id === id)
const shotText = (id) =>
  shot(id)
    .callouts.map((callout) => `${callout.title} ${callout.text}`)
    .join(' ')
/** Pixel size from a WebP header (lossy, lossless or extended). */
function webpSize(buffer) {
  assert.equal(buffer.toString('ascii', 0, 4), 'RIFF')
  assert.equal(buffer.toString('ascii', 8, 12), 'WEBP')
  const chunk = buffer.toString('ascii', 12, 16)
  if (chunk === 'VP8 ')
    return {
      width: buffer.readUInt16LE(26) & 0x3fff,
      height: buffer.readUInt16LE(28) & 0x3fff,
    }
  if (chunk === 'VP8L') {
    const bits = buffer.readUInt32LE(21)
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 }
  }
  return {
    width: buffer.readUIntLE(24, 3) + 1,
    height: buffer.readUIntLE(27, 3) + 1,
  }
}

test('introduction figures match the cached values of the bundled Nexa Home workbook', () => {
  const sample = INTRO_SAMPLE
  close(sample.flashUSD, cell(BRIDGE, 'O8'), 'Flash')
  close(sample.glUSD, cell(BRIDGE, 'O21'), 'GL')
  close(introVarianceUSD(), cell(BRIDGE, 'C30'), 'GL − Flash')
  // The workbook and the dashboard divide by Flash; the report divides by GL.
  close(introVarianceOfFlash(), cell(BRIDGE, 'D30'), 'Δ / Flash', 0.000001)
  close(introVarianceOfGL() * 100, -8.45, 'Δ / GL %')
  assert.equal(sample.sheets, workbook.SheetNames.length)

  // Eleven adjustment lines between the Flash row and the bridge total.
  const adjustments = []
  for (let row = 9; cell(BRIDGE, `B${row}`) !== 'Doanh thu theo cầu nối'; row++)
    adjustments.push(row)
  assert.equal(adjustments.length, sample.bridgeAdjustments)
  close(sample.unexplainedUSD, cell(BRIDGE, 'O19'), 'ADJ-0925')
  assert.match(cell(BRIDGE, 'B19'), /ADJ-0925/)
  close(sample.bridgeCheckUSD, cell(BRIDGE, 'O22'), 'bridge check')
  close(sample.bridgeThresholdUSD, cell(BRIDGE, 'C26'), 'threshold')
  close(sample.januaryCheckUSD, cell(BRIDGE, 'C22'), 'January check')
  close(sample.januaryDiscountUSD, cell(BRIDGE, 'C9'), 'January discount')
  close(sample.groups.rulesUSD, cell(BRIDGE, 'C31'), 'rules')
  close(sample.groups.dataErrorsUSD, cell(BRIDGE, 'C32'), 'data errors')
  close(sample.groups.roundingUSD, cell(BRIDGE, 'C34'), 'rounding')
  // Ranking of adjustments by Σ |monthly impact|, as on the bridge page.
  const impact = adjustments.map((row) => ({
    label: cell(BRIDGE, `B${row}`),
    total: MONTH_COLUMNS.reduce(
      (sum, column) => sum + Math.abs(cell(BRIDGE, `${column}${row}`)),
      0,
    ),
  }))
  const all = impact.reduce((sum, item) => sum + item.total, 0)
  const top = impact.toSorted((a, b) => b.total - a.total)[0]
  assert.equal(top.label, 'Chiết khấu')
  close(sample.discountRank.usd, top.total, 'discount impact', 0.01)
  close(sample.discountRank.share, top.total / all, 'discount share', 0.00005)

  const pos = rows('02a_POS_chuan_hoa')
  const web = rows('02b_Web_chuan_hoa')
  const gl = rows('02c_GL_chuan_hoa')
  assert.deepEqual(sample.sourceRows, {
    pos: pos.length,
    web: web.length,
    gl: gl.length,
    flash: rows('02d_Flash_chuan_hoa').length,
  })
  assert.equal(introSourceRowTotal(), 33661)
  assert.equal(
    pos.filter((row) => Number(row.export_seq) > 1).length,
    sample.duplicatePOSLines,
  )
  assert.equal(
    gl.filter((row) => row.journal_type === 'MANUAL').length,
    sample.manualJournals,
  )
  close(
    gl.find((row) => row.journal_id === sample.firstManual.journal).revenue_usd,
    sample.firstManual.usd,
    sample.firstManual.journal,
  )
  for (const journal of ['JE20250603115', 'JE20250603117'])
    close(
      Math.abs(gl.find((row) => row.journal_id === journal).revenue_usd),
      sample.reclassUSD,
      journal,
    )

  const storeCells = rows('03a_Doi_soat_Cua_hang')
  const master = rows('01e_Master_Cua_Hang')
  const storeKeys = new Set(storeCells.map((row) => row.Store_Key))
  assert.equal(storeKeys.size, sample.stores)
  assert.equal(
    new Set(
      master
        .filter((row) => storeKeys.has(row.pos_store_id))
        .map((row) => row.country),
    ).size,
    sample.countries,
  )
  // The two store-day cells that do not match are the late posting of EX-06.
  const late = sample.lateCase
  const open = storeCells.filter((row) => row.Trang_Thai !== 'Khop')
  assert.equal(open.length, 2)
  assert.ok(open.every((row) => row.Store_Key === late.posStore))
  const [day, month, year] = late.soldOn.split('/')
  const [postDay, postMonth, postYear] = late.postedOn.split('/')
  assert.deepEqual(open.map((row) => row.Ngay_Ghi_Nhan).sort(), [
    serial(`${year}-${month}-${day}`),
    serial(`${postYear}-${postMonth}-${postDay}`),
  ])
  open.forEach((row) =>
    close(Math.abs(row.Chenh_Lech_NoiTe), late.usd, 'late posting'),
  )
  assert.equal(
    master.find((row) => row.pos_store_id === late.posStore).finance_store_code,
    late.financeStore,
  )

  const log = rows('05_Nhat_ky_ngoai_le')
  const category = (name) =>
    log.filter((row) => row['Phân loại'] === name).length
  assert.deepEqual(sample.exceptions, {
    total: log.length,
    dataErrors: category('Lỗi dữ liệu'),
    recognition: category('Quy tắc ghi nhận'),
    unexplained: category('Chưa giải thích được'),
  })
  const ex = (code) => log.find((row) => row['Mã'] === code)
  close(Math.abs(ex(late.code)['Ảnh hưởng (USD)']), late.usd, late.code)
  close(ex('EX-03')['Ảnh hưởng (USD)'], sample.ex03USD, 'EX-03')
})

test('screen figures match what Tạm xem theo Excel loads and the dashboards show', () => {
  const sample = INTRO_SAMPLE
  assert.deepEqual(sample.load, {
    sheets: 3 + reference.dashboard.sourceSheets.length,
    checks: reference.checks.length,
    bridgeLines: reference.bridgeRows.length,
    details: reference.details.length,
    months: reference.months.length,
  })
  assert.equal(reference.exceptions.length, sample.exceptions.total)
  close(model.totals.flashUSD, sample.flashUSD, 'Flash')
  close(model.totals.glUSD, sample.glUSD, 'GL')
  close(model.totals.rulesUSD, sample.groups.rulesUSD, 'rules')
  close(model.totals.dataErrorsUSD, sample.groups.dataErrorsUSD, 'errors')
  close(model.totals.roundingUSD, sample.groups.roundingUSD, 'rounding')
  close(model.totals.unexplainedUSD, sample.unexplainedUSD, 'unexplained')
  const detail = model.detail
  assert.deepEqual(
    {
      cells: detail.cellCount,
      rawMismatchCells: detail.rawCellCount,
      storesOverBefore: detail.beforeThresholdStores,
      storesOverAfter: detail.afterThresholdStores,
    },
    sample.detail,
  )
  assert.equal(detail.stores.length, sample.stores)
  assert.equal(detail.cells.length, 2)
  const quality = model.quality
  close(quality.returnsUSD, sample.quality.returnsUSD, 'returns')
  close(quality.returnRate, sample.quality.returnRate, 'return rate', 0.00005)
  assert.equal(quality.cancelledOrders, sample.quality.cancelled2025)
  assert.equal(quality.removedDuplicateLines, sample.duplicatePOSLines)
  assert.equal(quality.validations.length, sample.quality.validations)
  const peak = (key) =>
    Number(
      quality.monthly
        .toSorted((a, b) => (b[key] ?? 0) - (a[key] ?? 0))[0]
        .month.slice(5),
    )
  assert.equal(peak('returnRate'), sample.quality.returnPeakMonth)
  assert.equal(peak('cancelledOrders'), sample.quality.cancellationPeakMonth)
  const januaryCheck = model.checks.find(
    (check) => check.id === 'source-check-2025-01',
  )
  close(januaryCheck.actualUSD, sample.januaryCheckUSD, 'January check')
})

test('introduction steps, screenshots and callouts are consistent', async () => {
  assert.deepEqual(
    INTRO_STEPS.map((step) => step.id),
    [
      'welcome',
      'workflow',
      'workbook',
      'review',
      'exceptions',
      'rules',
      'dashboard',
      'start',
    ],
  )
  const screens = INTRO_STEPS.filter((step) => step.route)
  assert.deepEqual(
    screens.map((step) => step.route),
    ['/processing', '/accounting-review', '/exceptions', '/methodology', '/'],
  )
  for (const step of screens) {
    assert.equal(INTRO_STEPS[introStepForPath(step.route)], step)
    assert.ok(step.screen && step.shots?.length, step.id)
  }
  assert.ok(INTRO_STEPS.every((step) => !step.shots || step.route))
  // One workflow phase per screen step, in the order of the tour.
  assert.deepEqual(
    INTRO_PHASES.map((phase) => phase.step),
    screens.map((step) => step.id),
  )
  assert.equal(introStepIndex('start'), INTRO_STEPS.length - 1)

  assert.equal(new Set(shots.map((item) => item.id)).size, shots.length)
  for (const item of shots) {
    const file = new URL(`../src/assets/intro/${item.id}.webp`, import.meta.url)
    assert.ok(existsSync(file), `${item.id}.webp`)
    assert.deepEqual(webpSize(await readFile(file)), {
      width: item.width,
      height: item.height,
    })
    assert.ok(item.alt.length > 20, item.id)
    assert.ok(
      item.callouts.length >= 3 && item.callouts.length <= 5,
      `${item.id} has 3–5 callouts`,
    )
    assert.equal(
      new Set(item.callouts.map((callout) => callout.title)).size,
      item.callouts.length,
    )
    for (const { title, text, box } of item.callouts) {
      const [x, y, w, h] = box
      assert.ok(text.length > 20, title)
      assert.ok(x >= 0 && y >= 0 && w > 0 && h > 0, title)
      assert.ok(x + w <= 100.5 && y + h <= 100.5, `${title} stays inside`)
    }
  }

  const fragments = {
    'workbook-progress': [
      '8 sheet',
      '58 phép kiểm tra',
      '12 tháng',
      '15 khoản mục',
      '7 ngoại lệ',
      '390 dòng chi tiết',
    ],
    'workbook-tables': ['-161.714,77 USD'],
    review: [
      '1.250,00 USD',
      '15 bút toán tay',
      '-0,03 USD',
      '0,10 USD',
      'JE20250100572',
      '8.531,49 USD',
      '3.480 USD',
    ],
    exceptions: [
      '7 ngoại lệ trong kỳ: 2 lỗi dữ liệu, 4 do quy tắc ghi nhận, 1 cần chứng từ',
      '-41.464,77 USD',
    ],
    'dashboard-overview': [
      '31.124.401,00',
      '28.698.496,23',
      '-2.425.904,77',
      '-12.622,18',
      '1.250,00 USD',
    ],
    'dashboard-bridge': [
      '-2.414.533,58',
      '0,95 USD',
      '1.834.297,47 USD (47,41%)',
      '-0,04 USD',
    ],
    'dashboard-detail': [
      '5.120 ô',
      '5.037 ô lệch',
      'từ 49 xuống 1',
      '57 cửa hàng',
      '7.227,56 USD',
      'EX-06',
    ],
    'dashboard-quality': [
      '349.148,23 USD (2,21%)',
      '124 đơn online',
      '12 dòng POS',
      '15 bút toán tay',
      'tháng 7',
      'tháng 10',
      '41 phép kiểm tra',
    ],
  }
  for (const [id, expected] of Object.entries(fragments))
    for (const fragment of expected)
      assert.ok(shotText(id).includes(fragment), `${id}: ${fragment}`)
  const phases = INTRO_PHASES.flatMap((phase) => phase.points).join(' ')
  for (const fragment of [
    '21 sheet',
    'POS 17.124 dòng',
    '15 bút toán tay',
    '7 ngoại lệ gốc: 2 lỗi dữ liệu, 4 do quy tắc ghi nhận, 1 chưa giải thích',
    '21/11/2025',
    'qua 11 khoản',
  ])
    assert.ok(phases.includes(fragment), fragment)
})

test('the introduction opens by itself once per page load', () => {
  // Module state, not browser storage: a reload resets it, so every visit
  // shows the introduction again, while remounts within one load do not.
  assert.equal(claimIntroAutoOpen(), true)
  assert.equal(claimIntroAutoOpen(), false)
  assert.equal(claimIntroAutoOpen(), false)
})

test('introduction shows annotated screenshots, opens nothing heavy and keeps the workspace untouched', async () => {
  const dom = new JSDOM(
    '<!doctype html><html><body><main id="test-root"></main></body></html>',
    { url: 'http://localhost/#/', pretendToBeVisual: true },
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
  let fetches = 0
  expose('fetch', async (url) => {
    assert.match(String(url), /demo\/Nexa_Home_Recon_Dataset_Final\.xlsx$/)
    fetches++
    return new Response(sourceBytes)
  })
  let server, root
  try {
    server = await createServer({
      configFile: false,
      cacheDir: 'node_modules/.vite-tests/product-intro',
      plugins: [
        {
          name: 'intro-test-engine',
          enforce: 'pre',
          load(id) {
            // The guided session mounts an isolated engine; jsdom cannot run DuckDB.
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
    const { createElement: h, act } = await import('react')
    const { createRoot } = await import('react-dom/client')
    const { ProductIntroProvider } = await server.ssrLoadModule(
      '/src/components/intro/ProductIntro.tsx',
    )
    const { useProductIntro } = await server.ssrLoadModule(
      '/src/components/intro/intro-context.ts',
    )
    const { GuideWorkspace, useGuideWorkspace } = await server.ssrLoadModule(
      '/src/components/guide/GuideWorkspace.tsx',
    )
    const { AppStoreContext, createAppStore } =
      await server.ssrLoadModule('/src/lib/store.ts')
    const main = createAppStore(undefined, { ingestionMode: 'wizard' })
    const before = main.getState()
    let workspace
    function Launcher() {
      const intro = useProductIntro()
      workspace = useGuideWorkspace()
      return h(
        'button',
        { 'data-tour': 'test-launcher', onClick: () => intro.open() },
        'Hướng dẫn sử dụng',
      )
    }
    root = createRoot(document.getElementById('test-root'))
    const settle = () =>
      act(
        async () =>
          new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(resolve)),
          ),
      )
    const $ = (selector) => document.querySelector(selector)
    const $$ = (selector) => [...document.querySelectorAll(selector)]
    const click = async (selector) => {
      const target = typeof selector === 'string' ? $(selector) : selector
      assert.ok(target, String(selector))
      await act(async () => target.click())
      await settle()
    }
    const waitUntil = async (predicate, label, ms = 30_000) => {
      const until = Date.now() + ms
      while (!predicate() && Date.now() < until) await settle()
      assert.ok(predicate(), label)
    }
    const section = () => $('[data-tour="intro-content"]')?.dataset.section
    const shown = () => $('[data-tour="intro-shots"]')?.dataset.shot
    const image = () => $('[data-tour="intro-shots"] img')
    const spot = () => $('[data-tour="intro-shot-spot"]')
    const notes = () => $$('[data-tour="intro-callouts"] button')
    const pins = () => $$('[data-tour="intro-shots"] .pi-pin')
    await act(async () =>
      root.render(
        h(
          AppStoreContext.Provider,
          { value: main },
          h(GuideWorkspace, null, h(ProductIntroProvider, null, h(Launcher))),
        ),
      ),
    )
    await settle()
    await click('[data-tour="test-launcher"]')
    assert.ok($('[data-tour="product-intro"]'), 'introduction opens')
    assert.equal(section(), 'welcome')
    const dialog = () => $('[data-tour="product-intro"]').textContent
    assert.match(dialog(), /2\.425\.904,77/)
    assert.match(dialog(), /7,79% so với Sales Flash/)
    assert.match(dialog(), /8,45% so với GL/)
    assert.doesNotMatch(document.body.textContent, /trình diễn/i)
    // The welcome page has no header navigation; its own button moves on.
    assert.equal($('[data-tour="intro-next"]'), null)
    assert.equal($('[data-tour="intro-previous"]'), null)

    await click('[data-tour="intro-welcome-next"]')
    assert.equal(section(), 'workflow')
    assert.ok($('[data-tour="intro-next"]'), 'later steps keep Tiếp')
    assert.equal(
      $$('[data-tour="intro-workflow"] > li').length,
      INTRO_PHASES.length,
    )
    assert.equal(document.activeElement?.tagName, 'H2')
    await act(async () =>
      $('[data-tour="intro-content"]').dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
      ),
    )
    await settle()
    assert.equal(section(), 'workbook')

    // A screenshot of the real screen with numbered pins and notes.
    assert.equal(shown(), 'workbook-progress')
    assert.match(image().getAttribute('src'), /workbook-progress\.webp$/)
    assert.match(image().getAttribute('alt'), /Xem thử theo Excel/)
    const progress = shot('workbook-progress')
    assert.equal(notes().length, progress.callouts.length)
    assert.equal(pins().length, progress.callouts.length)
    assert.equal(spot(), null)
    await act(async () => notes()[1].focus())
    await settle()
    assert.ok(spot(), 'focusing a note spotlights its region')
    assert.equal(spot().style.left, `${progress.callouts[1].box[0]}%`)
    assert.equal(spot().style.top, `${progress.callouts[1].box[1]}%`)
    await act(async () => notes()[1].blur())
    await settle()
    assert.equal(spot(), null)
    await click(pins()[2])
    assert.equal(notes()[2].getAttribute('aria-pressed'), 'true')
    assert.equal(spot().style.top, `${progress.callouts[2].box[1]}%`)
    await click(pins()[2])
    assert.equal(spot(), null, 'a second click releases the highlight')
    await click('[data-tour="intro-shot-workbook-tables"]')
    assert.equal(shown(), 'workbook-tables')
    assert.match(image().getAttribute('src'), /workbook-tables\.webp$/)

    // The zoomed image is a nested dialog; Escape closes only that layer.
    await click('[data-tour="intro-shot-zoom"]')
    const zoomed = $('[data-tour="intro-shot-zoomed"]')
    assert.ok(zoomed)
    assert.match(zoomed.querySelector('img').getAttribute('src'), /tables/)
    await act(async () =>
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      ),
    )
    await settle()
    assert.equal($('[data-tour="intro-shot-zoomed"]'), null)
    assert.ok($('[data-tour="product-intro"]'), 'the introduction stays open')

    for (const step of ['review', 'exceptions', 'rules', 'dashboard']) {
      await click(`[data-tour="intro-nav-${step}"]`)
      const expected = INTRO_STEPS[introStepIndex(step)].shots
      assert.equal(shown(), expected[0].id)
      for (const item of expected.slice(1)) {
        await click(`[data-tour="intro-shot-${item.id}"]`)
        assert.equal(shown(), item.id)
        assert.match(
          image().getAttribute('src'),
          new RegExp(`${item.id}\\.webp$`),
        )
        assert.equal(notes().length, item.callouts.length)
      }
    }
    assert.equal(fetches, 0, 'the introduction never downloads the workbook')
    assert.equal(main.getState(), before)

    // “Mở trong ứng dụng” opens the same screen with the sample data.
    await click('[data-tour="intro-open-in-app"]')
    assert.equal($('[data-tour="product-intro"]'), null)
    assert.equal(window.location.hash, '#/')
    await waitUntil(
      () => main.getState().excelReference.status === 'ready',
      'sample opened in the app',
    )
    assert.equal(fetches, 1)
    assert.equal(main.getState().excelReference.enabled, true)
    assert.equal(
      main.getState().excelReference.panelOpen,
      false,
      'the loading panel closes once the app shows the screen',
    )
    await act(async () => main.actions.disableExcelReference())

    // Reopening starts over.
    await click('[data-tour="test-launcher"]')
    assert.equal(section(), 'welcome')
    await click('[data-tour="intro-nav-start"]')
    assert.equal(section(), 'start')
    assert.equal($('[data-tour="intro-next"]'), null)
    assert.match(
      $('[data-tour="guide-start-guided"]').textContent,
      /đồng ý sử dụng dữ liệu mẫu trong một phiên minh họa/,
    )
    await click('[data-tour="intro-import"]')
    assert.equal($('[data-tour="product-intro"]'), null)
    assert.equal(main.getState().onboardingOpen, true)
    await act(async () => main.actions.closeOnboarding())
    await click('[data-tour="test-launcher"]')
    await act(async () =>
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      ),
    )
    await settle()
    assert.equal($('[data-tour="product-intro"]'), null, 'Escape closes')
    await click('[data-tour="test-launcher"]')
    await click('[data-tour="intro-nav-start"]')
    await click('[data-tour="intro-finish"]')
    assert.equal($('[data-tour="product-intro"]'), null)
    await click('[data-tour="test-launcher"]')
    await click('[data-tour="intro-nav-start"]')
    await click('[data-tour="guide-start-guided"]')
    assert.ok(workspace.session, 'guided practice starts')
    await act(async () => workspace.exit())
    await settle()
    await act(async () => main.dispose())
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
