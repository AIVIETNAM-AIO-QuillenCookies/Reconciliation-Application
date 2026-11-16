import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import '@/workspace-information.css'

interface InformationEntry {
  id: string
  title: string
  children: ReactNode
}
interface InformationRegistry {
  register: (entry: InformationEntry) => void
  remove: (id: string) => void
}
const RegistryContext = createContext<InformationRegistry | null>(null)
const EntriesContext = createContext<InformationEntry[]>([])

export function PageInformationProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<InformationEntry[]>([])
  const register = useCallback((entry: InformationEntry) => {
    setEntries((previous) => [
      ...previous.filter((item) => item.id !== entry.id),
      entry,
    ])
  }, [])
  const remove = useCallback((id: string) => {
    setEntries((previous) => previous.filter((item) => item.id !== id))
  }, [])
  const registry = useMemo(() => ({ register, remove }), [register, remove])
  return (
    <RegistryContext.Provider value={registry}>
      <EntriesContext.Provider value={entries}>
        {children}
      </EntriesContext.Provider>
    </RegistryContext.Provider>
  )
}

/** Keep explanations available in the page's single information panel. */
export function InformationNote({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  const id = useId()
  const registry = useContext(RegistryContext)
  useEffect(() => {
    if (!registry) return
    registry.register({ id, title, children })
    return () => registry.remove(id)
  }, [registry, id, title, children])
  return null
}

export function PageInformationButton({
  page,
  scope,
}: {
  page: string
  scope: string
}) {
  const entries = useContext(EntriesContext)
  const [openScope, setOpenScope] = useState<string | null>(null)
  useEffect(() => setOpenScope(null), [scope])
  const open = openScope === scope
  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        className="page-information-trigger"
        aria-label="Thông tin trang"
        title="Thông tin trang"
        onClick={() => setOpenScope(scope)}
      >
        <Info size={18} aria-hidden="true" />
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => setOpenScope(next ? scope : null)}
      >
        <DialogContent
          className="page-information-dialog"
          closeLabel="Đóng thông tin trang"
        >
          <header>
            <span className="page-information-icon">
              <Info size={20} aria-hidden="true" />
            </span>
            <div>
              <DialogTitle>Thông tin · {page}</DialogTitle>
              <DialogDescription>
                Cơ sở tính, nguồn dữ liệu và cách sử dụng trang.
              </DialogDescription>
            </div>
          </header>
          <div className="page-information-body">
            {entries.map((entry) => (
              <section key={entry.id}>
                <h2>{entry.title}</h2>
                <div>{entry.children}</div>
              </section>
            ))}
            {!entries.length && <p>Trang này chưa có thông tin bổ sung.</p>}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
