import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { test } from 'node:test'
import { createServer } from 'vite'

test('guide lazily loads the canonical 21-sheet source over dev HTTP under a non-root base URL', async () => {
  const server = await createServer({
    base: '/reconcile-check/',
    // Like the other Vite-backed tests, keep a private dependency cache so a
    // test run never rewrites node_modules/.vite/deps under a running dev server.
    cacheDir: 'node_modules/.vite-tests/guide-assets',
    server: { host: '127.0.0.1', port: 0, open: false },
    optimizeDeps: { noDiscovery: true },
  })
  const originalFetch = globalThis.fetch
  try {
    await server.listen()
    const { port } = server.httpServer.address()
    const origin = `http://127.0.0.1:${port}`
    const requested = []
    let downloaded
    globalThis.fetch = async (url, options) => {
      requested.push(String(url))
      const response = await originalFetch(
        new URL(String(url), origin),
        options,
      )
      assert.equal(response.status, 200)
      assert.doesNotMatch(
        response.headers.get('content-type') ?? '',
        /text\/html/,
      )
      downloaded = Buffer.from(await response.clone().arrayBuffer())
      return response
    }
    const { loadGuideSample, GUIDE_SAMPLE_PATH } = await server.ssrLoadModule(
      '/src/lib/guide-sample.ts',
    )
    assert.deepEqual(
      requested,
      [],
      'importing the guide never fetches the sample',
    )
    assert.equal(GUIDE_SAMPLE_PATH, 'demo/Nexa_Home_Recon_Dataset_Final.xlsx')
    const sample = await loadGuideSample(new AbortController().signal)
    assert.deepEqual(requested, [
      '/reconcile-check/demo/Nexa_Home_Recon_Dataset_Final.xlsx',
    ])
    assert.equal(sample.workbook.SheetNames.length, 21)
    assert.deepEqual(
      sample.sourceExceptions.map((row) => row.id),
      ['EX-01', 'EX-02', 'EX-03', 'EX-04', 'EX-05', 'EX-06', 'EX-07'],
    )
    const source = await readFile(
      new URL(
        '../docs/source/Nexa_Home_Recon_Dataset_Final.xlsx',
        import.meta.url,
      ),
    )
    const sha = (bytes) => createHash('sha256').update(bytes).digest('hex')
    assert.equal(
      sha(downloaded),
      sha(source),
      'the public demo is the exact canonical source workbook',
    )
  } finally {
    globalThis.fetch = originalFetch
    await server.close()
  }
})
