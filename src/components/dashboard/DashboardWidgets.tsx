import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { Maximize2 } from 'lucide-react'
import { InformationNote } from '@/components/PageInformation'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'

type SourceIdentity = object | string | null
type ScrollPosition = { element: HTMLElement; top: number; left: number }
interface WidgetRegistration {
  id: string
  title: string
  subtitle?: string
  host: HTMLDivElement
  inlineSlot: HTMLDivElement
}
interface Expansion {
  widget: WidgetRegistration
  sourceIdentity: SourceIdentity
  trigger: HTMLElement | null
}
interface WidgetController {
  activeWidgetId: string | null
  register: (widget: WidgetRegistration) => () => void
  updateMetadata: (id: string, title: string, subtitle?: string) => void
  openExpanded: (id: string, trigger: HTMLElement | null) => void
  closeExpanded: () => void
}
const WidgetContext = createContext<WidgetController | null>(null)
const WidgetExpandedContext = createContext(false)

// This hook belongs to the widget provider's public API.
// oxlint-disable-next-line react/only-export-components
export function useDashboardWidgets() {
  const context = useContext(WidgetContext)
  return context ?? { activeWidgetId: null, closeExpanded: () => {} }
}

// oxlint-disable-next-line react/only-export-components
export function useDashboardWidgetExpanded() {
  return useContext(WidgetExpandedContext)
}

const scrollPositions = (host: HTMLDivElement): ScrollPosition[] =>
  [host, ...host.querySelectorAll<HTMLElement>('*')].map((element) => ({
    element,
    top: element.scrollTop,
    left: element.scrollLeft,
  }))
function restoreScroll(positions: ScrollPosition[] | undefined) {
  for (const position of positions ?? []) {
    position.element.scrollTop = position.top
    position.element.scrollLeft = position.left
  }
}

/** Reparent the same portal host: table state and React identity never change. */
function ExpandedWidgetBody({ widget }: { widget: WidgetRegistration }) {
  const slot = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const target = slot.current
    if (!target) return
    const inlineScroll = scrollPositions(widget.host)
    target.appendChild(widget.host)
    restoreScroll(inlineScroll)
    return () => {
      const latestScroll = scrollPositions(widget.host)
      widget.inlineSlot.appendChild(widget.host)
      restoreScroll(latestScroll)
    }
  }, [widget.host, widget.inlineSlot])
  return <div ref={slot} className="dash-expanded-body" />
}

export function DashboardWidgetProvider({
  children,
  sourceLabel,
  periodLabel,
  identity,
}: {
  children: ReactNode
  sourceLabel: string
  periodLabel: string
  identity: SourceIdentity
}) {
  const widgets = useRef(new Map<string, WidgetRegistration>())
  const returnFocus = useRef<HTMLElement | null>(null)
  const mounted = useRef(false)
  const [expansion, setExpansion] = useState<Expansion | null>(null)
  const [previousIdentity, setPreviousIdentity] = useState<SourceIdentity>(
    () => identity,
  )
  // Reset on the source transition itself, so returning to an earlier immutable
  // snapshot cannot revive a dialog that was dismissed when that source changed.
  if (previousIdentity !== identity) {
    setPreviousIdentity(identity)
    setExpansion(null)
  }
  const current = expansion?.sourceIdentity === identity ? expansion : null
  useLayoutEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  const register = useCallback((widget: WidgetRegistration) => {
    widgets.current.set(widget.id, widget)
    return () => {
      if (widgets.current.get(widget.id)?.host === widget.host)
        widgets.current.delete(widget.id)
      // Effects can re-register the same widget after metadata changes in this commit.
      // Only a widget that really disappeared must dismiss the shared expanded view.
      queueMicrotask(() => {
        if (mounted.current && !widgets.current.has(widget.id))
          setExpansion((previous) =>
            previous?.widget.id === widget.id ? null : previous,
          )
      })
    }
  }, [])
  const updateMetadata = useCallback(
    (id: string, title: string, subtitle?: string) => {
      const widget = widgets.current.get(id)
      if (!widget || (widget.title === title && widget.subtitle === subtitle))
        return
      const next = { ...widget, title, subtitle }
      widgets.current.set(id, next)
      setExpansion((previous) =>
        previous?.widget.id === id ? { ...previous, widget: next } : previous,
      )
    },
    [],
  )
  const closeExpanded = useCallback(() => setExpansion(null), [])
  const openExpanded = useCallback(
    (id: string, trigger: HTMLElement | null) => {
      const widget = widgets.current.get(id)
      if (widget) {
        returnFocus.current = trigger
        setExpansion({ widget, sourceIdentity: identity, trigger })
      }
    },
    [identity],
  )
  const context = useMemo<WidgetController>(
    () => ({
      activeWidgetId: current?.widget.id ?? null,
      register,
      updateMetadata,
      openExpanded,
      closeExpanded,
    }),
    [current?.widget.id, register, updateMetadata, openExpanded, closeExpanded],
  )
  return (
    <WidgetContext.Provider value={context}>
      {children}
      <Dialog
        open={!!current}
        onOpenChange={(open) => {
          if (!open) closeExpanded()
        }}
      >
        <DialogContent
          data-tour="dashboard-expanded"
          data-expanded-widget={current?.widget.id}
          className="dash-expanded-dialog"
          closeLabel="Đóng vùng phóng to"
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            const trigger = returnFocus.current
            if (trigger?.isConnected) trigger.focus({ preventScroll: true })
          }}
          onInteractOutside={(event) => {
            // The stable React portal is owned by its inline widget, while its DOM
            // is inside this dialog. Radix must treat its native interactions as inside.
            const target = event.detail.originalEvent.target
            if (
              !current ||
              (target instanceof Node && current.widget.host.contains(target))
            )
              event.preventDefault()
          }}
        >
          <header className="dash-expanded-heading">
            <div>
              <DialogTitle>
                {current?.widget.title ?? 'Phóng to khu vực'}
              </DialogTitle>
              <DialogDescription>
                {current?.widget.subtitle && (
                  <span>{current.widget.subtitle} · </span>
                )}
                <span>
                  {periodLabel} · {sourceLabel}
                </span>
              </DialogDescription>
            </div>
          </header>
          {current && <ExpandedWidgetBody widget={current.widget} />}
        </DialogContent>
      </Dialog>
    </WidgetContext.Provider>
  )
}

export function DashboardWidget({
  id,
  title,
  subtitle,
  children,
  action,
  className = '',
}: {
  id: string
  title: string
  subtitle?: string
  children: ReactNode
  action?: ReactNode
  className?: string
}) {
  const controller = useContext(WidgetContext)
  const register = controller?.register
  const updateMetadata = controller?.updateMetadata
  const inlineSlot = useRef<HTMLDivElement>(null)
  const [host] = useState(() =>
    typeof document === 'undefined' ? null : document.createElement('div'),
  )
  const expanded = controller?.activeWidgetId === id
  useLayoutEffect(() => {
    const target = inlineSlot.current
    if (!target || !host) return
    target.appendChild(host)
    const unregister = register?.({
      id,
      title: '',
      host,
      inlineSlot: target,
    })
    return () => {
      unregister?.()
      host.remove()
    }
  }, [register, host, id])
  useLayoutEffect(() => {
    updateMetadata?.(id, title, subtitle)
  }, [updateMetadata, id, title, subtitle])
  useLayoutEffect(() => {
    host?.setAttribute(
      'class',
      `dash-widget-host dash-widget-body${expanded ? ' is-expanded' : ''}`,
    )
    host?.setAttribute('data-widget-id', id)
    host?.setAttribute('data-expanded', String(expanded))
  }, [host, id, expanded])
  const open = (trigger: HTMLElement | null) =>
    controller?.openExpanded(id, trigger)
  return (
    <section
      className={`dash-card dash-widget ${className}`}
      data-widget-id={id}
      data-tour={`dashboard-widget-${id}`}
      data-widget-expanded={expanded ? 'true' : 'false'}
    >
      <header
        className="dash-card-heading dash-widget-heading"
        onClick={(event) => {
          const target = event.target as HTMLElement
          if (
            !controller ||
            target.closest(
              'button,a,input,select,textarea,[role="button"],label',
            )
          )
            return
          const trigger = event.currentTarget.querySelector<HTMLButtonElement>(
            '.dash-expand-button',
          )
          open(trigger)
        }}
      >
        <div className="dash-widget-title">
          <h2>
            {controller ? (
              <button
                type="button"
                className="dash-widget-title-button"
                aria-label={`Mở rộng ${title}`}
                onClick={(event) => open(event.currentTarget)}
              >
                {title}
              </button>
            ) : (
              title
            )}
          </h2>
          {subtitle && (
            <InformationNote title={title}>{subtitle}</InformationNote>
          )}
        </div>
        <div className="dash-widget-actions">
          {action}
          {controller && (
            <button
              type="button"
              className="dash-expand-button"
              data-tour={`dashboard-expand-${id}`}
              aria-label={`Phóng to ${title}`}
              title={`Phóng to ${title}`}
              onClick={(event) => open(event.currentTarget)}
            >
              <Maximize2 size={15} aria-hidden="true" />
            </button>
          )}
        </div>
      </header>
      <div ref={inlineSlot} className="dash-widget-slot">
        {!host && children}
        {expanded && (
          <div className="dash-widget-placeholder">
            Đang xem khu vực này trong vùng phóng to.
          </div>
        )}
      </div>
      {host &&
        createPortal(
          <WidgetExpandedContext.Provider value={expanded}>
            {children}
          </WidgetExpandedContext.Provider>,
          host,
        )}
    </section>
  )
}
