import { useEffect, useState, type ReactNode } from 'react'
import { useDuckDB } from '@/hooks/useDuckDB'
import { AppStoreContext, createAppStore } from '@/lib/store'

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [store] = useState(() =>
    createAppStore(undefined, { ingestionMode: 'wizard' }),
  )
  const engine = useDuckDB()

  useEffect(() => {
    if (engine.status !== 'ready') {
      store.setEngineUnavailable(engine.status, engine.error?.message ?? null)
      return
    }
    const database = engine.database
    return store.attachProcessor(async (files, period, options) => {
      const [
        { ReconciliationEngine },
        { decodeSpreadsheet, decodeDimSpreadsheet },
      ] = await Promise.all([
        import('@/lib/ReconciliationEngine'),
        import('@/lib/decode-spreadsheet'),
      ])
      return new ReconciliationEngine(
        database,
        decodeSpreadsheet,
        decodeDimSpreadsheet,
        { schemaMode: 'accounting' },
      ).processUploads(files, period, options)
    })
  }, [engine.status, engine.database, engine.error, store])

  return (
    <AppStoreContext.Provider value={store}>
      {children}
    </AppStoreContext.Provider>
  )
}
