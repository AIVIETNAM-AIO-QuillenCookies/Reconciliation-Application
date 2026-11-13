import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createServer } from 'vite'

test(
  'DuckDB Worker startup failures reject, release the Worker and allow a shared retry',
  { timeout: 10_000 },
  async (t) => {
    const previousWorker = Object.getOwnPropertyDescriptor(globalThis, 'Worker')
    const workers = []
    let failure = { event: 'error', phase: 'INSTANTIATE' }
    class TestWorker extends EventTarget {
      terminated = false
      constructor(url) {
        super()
        this.url = url
        workers.push(this)
      }
      postMessage(request) {
        queueMicrotask(() => {
          if (failure?.phase === request.type) {
            const event = new Event(failure.event)
            Object.defineProperty(event, 'message', {
              value: 'Worker asset failed to load',
            })
            this.dispatchEvent(event)
            // Reproduce the library leaving its RPC promise pending on error.
            return
          }
          this.dispatchEvent(
            new MessageEvent('message', {
              data: { requestId: request.messageId, type: 'OK', data: null },
            }),
          )
        })
      }
      terminate() {
        this.terminated = true
      }
    }
    Object.defineProperty(globalThis, 'Worker', {
      configurable: true,
      writable: true,
      value: TestWorker,
    })
    const server = await createServer({
      configFile: false,
      cacheDir: 'node_modules/.vite-tests/duckdb-startup',
      server: { middlewareMode: true, hmr: false, ws: false, watch: null },
      optimizeDeps: { noDiscovery: true },
      appType: 'custom',
    })
    t.after(async () => {
      await server.close()
      if (previousWorker)
        Object.defineProperty(globalThis, 'Worker', previousWorker)
      else delete globalThis.Worker
    })
    const { getDuckDB } = await server.ssrLoadModule('/src/lib/duckdb.ts')

    const initial = getDuckDB()
    assert.equal(getDuckDB(), initial, 'concurrent consumers share startup')
    await assert.rejects(initial, /Worker asset failed to load/)
    assert.equal(workers.length, 1)
    assert.equal(workers[0].terminated, true)

    failure = { event: 'messageerror', phase: 'OPEN' }
    await assert.rejects(getDuckDB(), /Không thể đọc phản hồi/)
    assert.equal(workers.length, 2)
    assert.equal(workers[1].terminated, true)

    failure = null
    const database = await getDuckDB()
    assert.equal(await getDuckDB(), database)
    assert.equal(workers.length, 3, 'successful startup is reused')
    assert.equal(workers[2].terminated, false)
    await database.terminate()
  },
)
