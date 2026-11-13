import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { AsyncDuckDB } from '@duckdb/duckdb-wasm'

type EngineState =
  | { status: 'loading'; database: null; error: null }
  | { status: 'ready'; database: AsyncDuckDB; error: null }
  | { status: 'error'; database: null; error: Error }

type DuckDBContextValue = EngineState & { retry: () => void }
const DuckDBContext = createContext<DuckDBContextValue | null>(null)
const loadingState: EngineState = {
  status: 'loading',
  database: null,
  error: null,
}

export function DuckDBProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<EngineState>(loadingState)
  const [attempt, setAttempt] = useState(0)
  const retry = useCallback(() => {
    setState(loadingState)
    setAttempt((previous) => previous + 1)
  }, [])

  useEffect(() => {
    let cancelled = false
    // Keep the engine bundle out of the initial UI chunk.
    void import('@/lib/duckdb')
      .then(({ getDuckDB }) => getDuckDB())
      .then((database) => {
        if (!cancelled) setState({ status: 'ready', database, error: null })
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({
            status: 'error',
            database: null,
            error: error instanceof Error ? error : new Error(String(error)),
          })
        }
      })
    // Consumers do not own the shared worker. Navigation must not terminate it.
    return () => {
      cancelled = true
    }
  }, [attempt])

  return (
    <DuckDBContext.Provider value={{ ...state, retry }}>
      {children}
    </DuckDBContext.Provider>
  )
}

export function useDuckDB(): DuckDBContextValue {
  const context = useContext(DuckDBContext)
  if (!context) throw new Error('useDuckDB must be used inside DuckDBProvider.')
  return context
}
