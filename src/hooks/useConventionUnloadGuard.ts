import { useEffect } from 'react'
import {
  hasUnexportedConventions,
  hasUnsavedDraft,
  type ConventionState,
} from '@/lib/convention-document'

/**
 * Session-only conventions are lost on reload. Warn while a draft is unsaved
 * or a saved session version has not been exported, on every page.
 */
export function useConventionUnloadGuard(conventions: ConventionState) {
  const guard =
    hasUnsavedDraft(conventions) || hasUnexportedConventions(conventions)
  useEffect(() => {
    if (!guard) return
    const unload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', unload)
    return () => window.removeEventListener('beforeunload', unload)
  }, [guard])
}
