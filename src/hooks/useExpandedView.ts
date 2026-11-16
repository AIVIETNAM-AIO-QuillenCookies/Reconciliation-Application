import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Floating “expanded” view: the element is lifted above a dimmed backdrop.
 * Escape closes it unless a modal dialog is open on top; app navigation is
 * inert meanwhile and focus returns to the toggle on close.
 */
export function useExpandedView() {
  const [expanded, setExpanded] = useState(false)
  const toggle = useRef<HTMLButtonElement>(null)
  const close = useCallback(() => setExpanded(false), [])
  useEffect(() => {
    if (!expanded) return
    const navigation = [
      ...document.querySelectorAll<HTMLElement>(
        '.app-sidebar, .app-header, .app-footer',
      ),
    ]
    const previous = navigation.map((element) => element.inert)
    navigation.forEach((element) => {
      element.inert = true
    })
    const keydown = (event: KeyboardEvent) => {
      if (
        event.key !== 'Escape' ||
        event.defaultPrevented ||
        document.querySelector('[data-slot="dialog-content"]')
      )
        return
      setExpanded(false)
    }
    window.addEventListener('keydown', keydown)
    const trigger = toggle.current
    return () => {
      window.removeEventListener('keydown', keydown)
      navigation.forEach((element, index) => {
        element.inert = previous[index]
      })
      trigger?.focus({ preventScroll: true })
    }
  }, [expanded])
  return { expanded, setExpanded, close, toggle }
}
