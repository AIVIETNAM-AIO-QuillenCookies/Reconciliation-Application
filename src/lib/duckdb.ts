import * as duckdb from '@duckdb/duckdb-wasm'
import mvpWasm from '@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url'
import mvpWorker from '@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url'
import ehWasm from '@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url'
import ehWorker from '@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url'

const bundles: duckdb.DuckDBBundles = {
  mvp: { mainModule: mvpWasm, mainWorker: mvpWorker },
  eh: { mainModule: ehWasm, mainWorker: ehWorker },
}

let databasePromise: Promise<duckdb.AsyncDuckDB> | undefined

async function initialize(): Promise<duckdb.AsyncDuckDB> {
  const bundle = await duckdb.selectBundle(bundles)
  if (!bundle.mainWorker)
    throw new Error('No compatible DuckDB worker is available.')

  // The single-threaded MVP/EH builds do not require COOP/COEP headers.
  const worker = new Worker(bundle.mainWorker)
  // The library clears pending RPCs on a Worker error without rejecting them.
  // Observe startup failures ourselves so a missing/invalid asset cannot leave
  // the UI loading forever and the singleton can be retried.
  let rejectWorkerFailure: (error: Error) => void = () => undefined
  const workerFailure = new Promise<never>((_, reject) => {
    rejectWorkerFailure = reject
  })
  const onWorkerError = (event: ErrorEvent) => {
    rejectWorkerFailure(
      new Error(event.message || 'Không thể tải Worker DuckDB. Hãy thử lại.'),
    )
  }
  const onMessageError = () => {
    rejectWorkerFailure(
      new Error('Không thể đọc phản hồi từ Worker DuckDB. Hãy thử lại.'),
    )
  }
  worker.addEventListener('error', onWorkerError)
  worker.addEventListener('messageerror', onMessageError)
  const database = new duckdb.AsyncDuckDB(
    new duckdb.ConsoleLogger(duckdb.LogLevel.WARNING),
    worker,
  )

  try {
    await Promise.race([
      (async () => {
        await database.instantiate(bundle.mainModule, bundle.pthreadWorker)
        await database.open({ path: ':memory:' })
      })(),
      workerFailure,
    ])
    return database
  } catch (error) {
    // Failed initialization must not leak a worker or poison subsequent retries.
    await database.terminate().catch(() => undefined)
    worker.terminate()
    throw error
  } finally {
    worker.removeEventListener('error', onWorkerError)
    worker.removeEventListener('messageerror', onMessageError)
  }
}

/** One database per app lifetime, including React StrictMode's effect replay. */
export function getDuckDB(): Promise<duckdb.AsyncDuckDB> {
  databasePromise ??= initialize().catch((error: unknown) => {
    databasePromise = undefined
    throw error
  })
  return databasePromise
}

/** A guide owns its own worker and SQL relations, separate from the real workspace. */
export const createIsolatedDuckDB = initialize

/**
 * Low-level file registration for callers outside the reconciliation pipeline.
 * This neither parses the file nor creates a SQL table. Callers own file cleanup;
 * ReconciliationEngine separately registers and releases its run-scoped files.
 */
export async function registerLocalFile(
  file: File,
  virtualName: string,
): Promise<void> {
  const database = await getDuckDB()
  await database.registerFileBuffer(
    virtualName,
    new Uint8Array(await file.arrayBuffer()),
  )
}

// Vite re-evaluates this module during HMR; release the replaced worker.
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    void databasePromise
      ?.then((database) => database.terminate())
      .catch(() => undefined)
    databasePromise = undefined
  })
}
