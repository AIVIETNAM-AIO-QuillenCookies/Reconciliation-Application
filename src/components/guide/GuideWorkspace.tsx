import {
  createContext,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { DuckDBProvider } from '@/hooks/useDuckDB'
import { AppStoreProvider } from '@/components/AppStoreProvider'
import { createAppStore, type AppStore } from '@/lib/store'

/** A guided practice session: the user acts, the guide verifies each step. */
interface GuideSession {
  id: number
  store: AppStore
}
interface GuideWorkspaceValue {
  session: GuideSession | null
  start: () => void
  exit: () => void
}
const GuideWorkspaceContext = createContext<GuideWorkspaceValue | null>(null)

/** The original providers stay mounted. Sample data never enters their store or database. */
export function GuideWorkspace({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<GuideSession | null>(null)
  const originalHash = useRef('#/')
  const serial = useRef(0)
  function start() {
    if (!session) originalHash.current = window.location.hash || '#/'
    session?.store.dispose()
    window.location.hash = '#/'
    setSession({
      id: ++serial.current,
      store: createAppStore(undefined, { ingestionMode: 'wizard' }),
    })
  }
  function exit() {
    session?.store.dispose()
    window.location.hash = originalHash.current
    setSession(null)
  }
  return (
    <GuideWorkspaceContext.Provider value={{ session, start, exit }}>
      {session ? (
        <DuckDBProvider key={session.id} isolated>
          <AppStoreProvider instance={session.store}>
            {children}
          </AppStoreProvider>
        </DuckDBProvider>
      ) : (
        children
      )}
    </GuideWorkspaceContext.Provider>
  )
}
export function useGuideWorkspace() {
  const value = useContext(GuideWorkspaceContext)
  if (!value) throw new Error('GuideWorkspace is required')
  return value
}
