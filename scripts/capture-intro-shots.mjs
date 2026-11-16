// Regenerates the screenshots shown in steps 3–7 of the product introduction
// (src/assets/intro/*.webp) from the real app in “Tạm xem theo Excel” mode.
//
//   npm run build
//   npx vite preview --port 4319 --strictPort
//   node scripts/capture-intro-shots.mjs [appUrl] [chromePath]
//
// appUrl defaults to http://localhost:4319/; Chrome is taken from CHROME_PATH or
// the usual install locations. Screens are captured at 1280×800 CSS pixels and
// 2× density. Element boxes (percent of each image) are written to
// tmp/intro-shot-boxes.json so callout boxes in src/lib/product-intro.ts can be
// checked after a layout change.
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const appUrl = process.argv[2] ?? 'http://localhost:4319/'
const chromePath =
  process.argv[3] ??
  process.env.CHROME_PATH ??
  [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ].find((candidate) => existsSync(candidate))
if (!chromePath) throw new Error('Set CHROME_PATH to a Chrome or Edge binary.')
const outDir = path.join(root, 'src/assets/intro')
await mkdir(outDir, { recursive: true })
await mkdir(path.join(root, 'tmp'), { recursive: true })

const WIDTH = 1280
const HEIGHT = 800
const SCALE = 2
const port = 9337
const profile = await mkdtemp(path.join(tmpdir(), 'reconcile-capture-'))
const chrome = spawn(chromePath, [
  '--headless=new',
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`,
  '--no-first-run',
  '--disable-gpu',
  '--hide-scrollbars',
  'about:blank',
])
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
let target
for (let attempt = 0; attempt < 50 && !target; attempt++) {
  await sleep(200)
  try {
    const pages = await (await fetch(`http://127.0.0.1:${port}/json`)).json()
    target = pages.find((page) => page.type === 'page')
  } catch {
    /* Chrome is still starting. */
  }
}
if (!target) throw new Error('Chrome did not start.')
const socket = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((resolve) =>
  socket.addEventListener('open', resolve, { once: true }),
)
let id = 0
const pending = new Map()
const errors = []
socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data)
  if (message.id && pending.has(message.id)) {
    pending.get(message.id)(message)
    pending.delete(message.id)
  }
  if (message.method === 'Runtime.exceptionThrown')
    errors.push(message.params.exceptionDetails.text)
})
const send = (method, params = {}) =>
  new Promise((resolve) => {
    const next = ++id
    pending.set(next, resolve)
    socket.send(JSON.stringify({ id: next, method, params }))
  })
async function evaluate(expression) {
  const response = await send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  })
  if (response.result?.exceptionDetails)
    throw new Error(JSON.stringify(response.result.exceptionDetails))
  return response.result?.result?.value
}
async function waitFor(expression, timeout = 60_000) {
  const until = Date.now() + timeout
  while (Date.now() < until) {
    if (await evaluate(expression)) return
    await sleep(250)
  }
  throw new Error(`Timed out waiting for ${expression}`)
}
const boxesOf = (clip, selectors) => `(() => {
  const c = document.querySelector(${JSON.stringify(clip)}).getBoundingClientRect()
  const boxes = []
  for (const selector of ${JSON.stringify(selectors)})
    document.querySelectorAll(selector).forEach((element, index) => {
      const b = element.getBoundingClientRect()
      const left = Math.max(b.left, c.left), top = Math.max(b.top, c.top)
      const right = Math.min(b.right, c.right), bottom = Math.min(b.bottom, c.bottom)
      if (right - left < 4 || bottom - top < 4) return
      boxes.push({
        selector, index,
        text: (element.getAttribute('aria-label') || element.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 60),
        box: [left, top, right - left, bottom - top].map((value, i) =>
          +(((i % 2 ? value - (i === 1 ? c.top : 0) : value - (i === 0 ? c.left : 0)) / (i % 2 ? c.height : c.width)) * 100).toFixed(2)),
      })
    })
  return JSON.stringify({ x: c.left, y: c.top, width: c.width, height: c.height, boxes })
})()`
const shots = []
async function capture(name, clip, selectors) {
  await evaluate('document.fonts.ready.then(() => true)')
  await sleep(900)
  const info = JSON.parse(await evaluate(boxesOf(clip, selectors)))
  const image = await send('Page.captureScreenshot', {
    format: 'webp',
    quality: 86,
    clip: {
      x: info.x,
      y: info.y,
      width: info.width,
      height: info.height,
      scale: 1,
    },
  })
  await writeFile(
    path.join(outDir, `${name}.webp`),
    Buffer.from(image.result.data, 'base64'),
  )
  shots.push({
    name,
    width: Math.round(info.width * SCALE),
    height: Math.round(info.height * SCALE),
    boxes: info.boxes,
  })
  console.log(
    `${name}.webp`,
    Math.round(info.width * SCALE),
    '×',
    Math.round(info.height * SCALE),
  )
}
async function visit(hash, ready) {
  await evaluate(`location.hash = ${JSON.stringify(hash)}; true`)
  await waitFor(ready)
  await evaluate(
    "document.activeElement?.blur(); document.querySelectorAll('*').forEach((element) => { if (element.scrollTop) element.scrollTop = 0 }); true",
  )
  await sleep(1200)
}

try {
  await send('Page.enable')
  await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', {
    width: WIDTH,
    height: HEIGHT,
    deviceScaleFactor: SCALE,
    mobile: false,
  })
  await send('Page.navigate', { url: appUrl })
  // The introduction opens on every page load; close it so it does not cover the app.
  await waitFor(`!!document.querySelector('[data-tour="guide-defer"]')`)
  await evaluate(
    `document.querySelector('[data-tour="guide-defer"]').click(); true`,
  )
  await waitFor(`!document.querySelector('[data-tour="product-intro"]')`)
  const excel = '[aria-label="Tạm xem theo Excel"]'
  await waitFor(`!!document.querySelector('${excel}')`)
  await evaluate(`document.querySelector('${excel}').click(); true`)
  const showDashboard = `[...document.querySelectorAll('.excel-reference-dialog button')].find((button) => /Hiển thị dashboard/.test(button.textContent))`
  await waitFor(`!!${showDashboard}`)
  await evaluate('document.activeElement?.blur(); true')

  await capture('workbook-progress', '.excel-reference-dialog', [
    '.excel-reference-file',
    '.excel-reference-steps > li',
    '.excel-reference-dialog footer',
  ])
  await evaluate(`${showDashboard}.click(); true`)
  await waitFor("!document.querySelector('.excel-reference-dialog')")

  const main = '#main-content'
  const reference = [
    '.excel-reference-period',
    '.reference-stat',
    '.excel-reference-tabs',
    '.reference-search-field',
    '.excel-reference-table',
    '.excel-reference-table thead',
    '.excel-reference-table tbody tr',
    '.reference-review-main',
    '.reference-review-aside',
    '.excel-reference-footer',
  ]
  await visit(
    '#/processing',
    "!!document.querySelector('.reference-processing .excel-reference-table')",
  )
  await capture('workbook-tables', main, reference)
  await visit(
    '#/accounting-review',
    "!!document.querySelector('.reference-accounting .reference-case-card')",
  )
  await capture('review', main, reference)
  await visit(
    '#/exceptions',
    "!!document.querySelector('.reference-table-exceptions tbody tr')",
  )
  await capture('exceptions', main, reference)
  const document = [
    '[class*="cd-mode"]',
    '[class*="cd-toc"]',
    '[class*="cd-paper"]',
    '.cd-shell button',
    '.cd-shell table',
  ]
  await visit('#/methodology', "!!document.querySelector('.cd-shell')")
  await capture('rules-document', main, document)
  await evaluate(
    "[...document.querySelectorAll('.cd-shell button')].find((button) => /Thời điểm ghi nhận/.test(button.textContent)).click(); true",
  )
  await sleep(1500)
  await capture('rules-timing', main, document)
  const dashboard = [
    '[class*="dash-filter"]',
    '.dash-tab-list',
    '[class*="dash-kpi"]',
    '.dash-widget',
  ]
  for (const tab of ['overview', 'bridge', 'detail', 'quality']) {
    await visit(
      `#/?tab=${tab}`,
      `document.querySelector('[data-tour="dashboard"]')?.dataset.dashboardTab === '${tab}' && document.querySelector('[data-tour="dashboard"]')?.dataset.dashboardReady === 'true'`,
    )
    await capture(`dashboard-${tab}`, main, dashboard)
  }
  await writeFile(
    path.join(root, 'tmp/intro-shot-boxes.json'),
    JSON.stringify(shots, null, 1),
  )
  if (errors.length) console.warn('Page errors:', errors)
} finally {
  socket.close()
  chrome.kill()
  await sleep(500)
  await rm(profile, { recursive: true, force: true }).catch(() => {})
}
