import assert from 'node:assert/strict'
import { readdir } from 'node:fs/promises'
import { preview } from 'vite'
import * as XLSX from 'xlsx'

// HTTP checks against the built dist, never the development server. These do
// not replace browser checks of Worker execution, layout or user interactions.
const server = await preview({
  preview: { host: '127.0.0.1', port: 4173, strictPort: false, open: false },
})

try {
  const address = server.httpServer.address()
  assert.ok(address && typeof address === 'object')
  const base = `http://127.0.0.1:${address.port}`
  const root = await fetch(`${base}/?release-check=1`)
  assert.equal(root.status, 200)
  assert.match(root.headers.get('content-type'), /text\/html/)
  const html = await root.text()
  assert.match(html, /lang="vi"/)
  assert.match(html, /id="root"/)
  assert.doesNotMatch(html, /\/src\/main\.tsx/)
  const entryAssets = [
    ...html.matchAll(/(?:src|href)="([^"?#]+\.(?:js|css))"/g),
  ].map((match) => match[1])
  assert.ok(entryAssets.some((path) => path.endsWith('.js')))
  assert.ok(entryAssets.some((path) => path.endsWith('.css')))

  const files = await readdir(new URL('../dist/assets/', import.meta.url))
  const workers = files.filter((name) => /\.worker-.*\.js$/.test(name))
  const wasm = files.filter((name) => name.endsWith('.wasm'))
  assert.equal(workers.length, 4, 'two spreadsheet and two DuckDB Workers')
  assert.equal(wasm.length, 2, 'DuckDB MVP and EH modules')
  const paths = [
    ...new Set([
      ...entryAssets,
      ...files
        .filter((name) => /\.(?:js|css)$/.test(name))
        .map((name) => `/assets/${name}`),
      ...wasm.map((name) => `/assets/${name}`),
      '/favicon.svg',
      '/reference/excel-reference.xlsx',
      '/demo/Nexa_Home_Recon_Dataset_Final.xlsx',
    ]),
  ]

  for (const path of paths) {
    const response = await fetch(new URL(path, base))
    assert.equal(response.status, 200, path)
    const mime = response.headers.get('content-type') ?? ''
    assert.doesNotMatch(mime, /text\/html/, `${path} must not return HTML`)
    const bytes = new Uint8Array(await response.arrayBuffer())
    assert.ok(bytes.length > 0, path)
    if (path.endsWith('.js')) assert.match(mime, /javascript/, path)
    if (path.endsWith('.css')) assert.match(mime, /text\/css/, path)
    if (path.endsWith('.wasm')) {
      assert.match(mime, /application\/wasm/, path)
      assert.deepEqual([...bytes.slice(0, 4)], [0, 97, 115, 109], path)
    }
    if (path.endsWith('.xlsx')) {
      // The adapter fetches arrayBuffer(), so XLSX needs valid ZIP bytes, not
      // a particular MIME. Vite preview may omit its optional Content-Type.
      assert.deepEqual([...bytes.slice(0, 2)], [80, 75], path)
    }
    if (path === '/demo/Nexa_Home_Recon_Dataset_Final.xlsx') {
      const workbook = XLSX.read(bytes, { type: 'array', bookSheets: true })
      assert.deepEqual(
        workbook.SheetNames,
        [
          '01a_Nguon_POS',
          '01b_Nguon_WEB',
          '01c_Nguon_GL',
          '01d_Nguon_Flash',
          '01e_Master_Cua_Hang',
          '01f_Master_Lich',
          '01g_Master_TyGia_Ngay',
          '01h_Master_TyGia_Thang',
          '02_Giao_Dich_Chung',
          '02a_POS_chuan_hoa',
          '02b_Web_chuan_hoa',
          '02c_GL_chuan_hoa',
          '02d_Flash_chuan_hoa',
          '03a_Doi_soat_Cua_hang',
          '03b_Doi_soat_Online',
          '03c_POS_Dong_trung',
          'QC_Summary',
          '04a_Cau_noi_Flash_GL',
          '04b_Truy_vet',
          '04c_So_sanh_ty_gia',
          '05_Nhat_ky_ngoai_le',
        ],
        'production guide resource retains the original 21-sheet source and reference workbook',
      )
    }
    console.log(`OK ${response.status} ${mime || '(no Content-Type)'} ${path}`)
  }
  console.log(
    'Production HTTP checks passed; browser execution is a separate check.',
  )
} finally {
  await new Promise((resolve, reject) => {
    server.httpServer.close((error) => (error ? reject(error) : resolve()))
    server.httpServer.closeAllConnections()
  })
}
