import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  LoaderCircle,
  RotateCcw,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ReloadPageButton } from '@/components/LocalizedError'
import {
  isModuleLoadError,
  MODULE_LOAD_MESSAGE,
  RELOAD_DATA_NOTE,
} from '@/lib/module-load-error'
import '@/interactive-guide.css'

export interface GuideOverlayStep {
  id?: string
  chapter: number
  title: string
  why: string
  instruction: string
  result: string
  selector?: string
}

export interface GuideOverlayProps {
  step: GuideOverlayStep
  index: number
  total: number
  busy: boolean
  verified: boolean
  error?: string | null
  completed?: number
  action?: ReactNode
  onPrevious: () => void
  onNext: () => void
  onRetry: () => void
  onConfigure: () => void
  onRestart: () => void
  onExit: () => void
}

type Box = { left: number; top: number; width: number; height: number }
type Geometry = {
  target: Box | null
  panel: Box
  origin: { left: number; top: number }
}

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(value, Math.max(min, max)))

/** The controls join the current modal's DOM tree so its focus trap still works. */
export function GuideOverlay(props: GuideOverlayProps) {
  const {
    step,
    index,
    total,
    busy,
    verified,
    error,
    completed = index,
    action,
    onPrevious,
    onNext,
    onRetry,
    onConfigure,
    onRestart,
    onExit,
  } = props
  // Retrying cannot fetch a missing app file; the guide offers a reload first.
  const moduleLoadFailure = !!error && isModuleLoadError(error)
  const [host, setHost] = useState<HTMLElement | null>(null)
  const panelRef = useRef<HTMLElement>(null)
  const busyRef = useRef(busy)
  busyRef.current = busy
  const scheduleRef = useRef<(() => void) | null>(null)
  const [geometry, setGeometry] = useState<Geometry>({
    target: null,
    panel: { left: 16, top: 80, width: 352, height: 400 },
    origin: { left: 0, top: 0 },
  })

  useEffect(() => {
    let frame = 0
    let currentTarget: HTMLElement | null = null
    let currentHost: HTMLElement | null = null
    let observedPanel: HTMLElement | null = null
    let panelAnchor: { left: number; top: number } | null = null
    const resize =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(() => schedule())
    const measure = () => {
      frame = 0
      const dialogs = [
        // Searchable dropdown popovers also use role="dialog". They are not
        // workspaces: moving this portal into them makes it jump on every choice.
        ...document.querySelectorAll<HTMLElement>(
          '[data-slot="dialog-content"][data-state="open"], [data-slot="sheet-content"][data-state="open"]',
        ),
      ].filter((item) => !item.closest('[data-guide-panel]'))
      const nextHost = dialogs.at(-1) ?? document.body
      if (panelRef.current !== observedPanel) {
        if (observedPanel) resize?.unobserve(observedPanel)
        observedPanel = panelRef.current
        if (observedPanel) resize?.observe(observedPanel)
      }
      if (currentHost !== nextHost) {
        currentHost = nextHost
        panelAnchor = null
        setHost(nextHost)
      }
      let target: HTMLElement | null = null
      if (step.selector) {
        try {
          target =
            [
              ...document.querySelectorAll<HTMLElement>(
                busyRef.current &&
                  document.querySelector('[data-guide-current-target]')
                  ? '[data-guide-current-target]'
                  : step.selector,
              ),
            ].find((item) => {
              const box = item.getBoundingClientRect()
              return (
                box.width > 0 &&
                box.height > 0 &&
                getComputedStyle(item).visibility !== 'hidden'
              )
            }) ?? null
        } catch {
          /* An absent target keeps controls usable while a page loads. */
        }
      }
      if (target !== currentTarget) {
        if (currentTarget) resize?.unobserve(currentTarget)
        currentTarget = target
        if (target) resize?.observe(target)
      }
      const viewport = window.visualViewport
      const viewportLeft = viewport?.offsetLeft ?? 0
      const viewportTop = viewport?.offsetTop ?? 0
      const viewportRight =
        viewportLeft + (viewport?.width ?? window.innerWidth)
      const viewportBottom =
        viewportTop + (viewport?.height ?? window.innerHeight)
      const hostBox =
        nextHost === document.body ? null : nextHost.getBoundingClientRect()
      const bounds = {
        left: Math.max(viewportLeft, hostBox?.left ?? 0),
        top: Math.max(viewportTop, hostBox?.top ?? 0),
        right: Math.min(viewportRight, hostBox?.right ?? viewportRight),
        bottom: Math.min(viewportBottom, hostBox?.bottom ?? viewportBottom),
      }
      const width = Math.min(
        352,
        Math.max(220, bounds.right - bounds.left - 24),
      )
      const height = Math.min(
        panelRef.current?.offsetHeight || 420,
        Math.max(160, bounds.bottom - bounds.top - 24),
      )
      const rawTarget = target?.getBoundingClientRect()
      let targetBox: Box | null = null
      if (
        rawTarget &&
        rawTarget.bottom > bounds.top &&
        rawTarget.top < bounds.bottom &&
        rawTarget.right > bounds.left &&
        rawTarget.left < bounds.right
      ) {
        const left = Math.max(bounds.left + 3, rawTarget.left - 4)
        const top = Math.max(bounds.top + 3, rawTarget.top - 4)
        targetBox = {
          left,
          top,
          width: Math.max(
            0,
            Math.min(bounds.right - 3, rawTarget.right + 4) - left,
          ),
          height: Math.max(
            0,
            Math.min(bounds.bottom - 3, rawTarget.bottom + 4) - top,
          ),
        }
      }
      // Choose a position from the chapter's main target once. Only the
      // highlight/cursor follows individual automated fields and dropdowns.
      if (!panelAnchor) {
        let primary = targetBox
        try {
          const box = step.selector
            ? document.querySelector(step.selector)?.getBoundingClientRect()
            : null
          if (box && box.width > 0 && box.height > 0) primary = box
        } catch {
          /* Keep the default corner while a target is unavailable. */
        }
        let left = bounds.right - width - 12
        let top = bounds.bottom - height - 12
        if (primary) {
          if (primary.left + primary.width + width + 24 < bounds.right) {
            left = primary.left + primary.width + 12
            top = primary.top
          } else if (primary.left - width - 24 > bounds.left) {
            left = primary.left - width - 12
            top = primary.top
          } else if (
            primary.top + primary.height + height + 24 <
            bounds.bottom
          ) {
            top = primary.top + primary.height + 12
          } else if (primary.top - height - 24 > bounds.top) {
            top = primary.top - height - 12
          }
        }
        panelAnchor = {
          left: clamp(left, bounds.left + 12, bounds.right - width - 12),
          top: clamp(top, bounds.top + 12, bounds.bottom - height - 12),
        }
      }
      const next: Geometry = {
        target: targetBox,
        panel: {
          left: clamp(
            panelAnchor.left,
            bounds.left + 12,
            bounds.right - width - 12,
          ),
          top: clamp(
            panelAnchor.top,
            bounds.top + 12,
            bounds.bottom - height - 12,
          ),
          width,
          height: Math.max(160, bounds.bottom - bounds.top - 24),
        },
        origin: {
          left: hostBox ? hostBox.left + nextHost.clientLeft : 0,
          top: hostBox ? hostBox.top + nextHost.clientTop : 0,
        },
      }
      setGeometry((old) =>
        JSON.stringify(old) === JSON.stringify(next) ? old : next,
      )
    }
    function schedule() {
      if (!frame) frame = requestAnimationFrame(measure)
    }
    scheduleRef.current = schedule
    const observer = new MutationObserver((entries) => {
      if (
        entries.some(
          (entry) =>
            !(entry.target instanceof Element) ||
            !entry.target.closest('[data-guide-overlay]'),
        )
      )
        schedule()
    })
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: [
        'data-state',
        'data-guide-current-target',
        'hidden',
        'style',
        'class',
      ],
    })
    window.addEventListener('resize', schedule)
    window.addEventListener('scroll', schedule, true)
    window.visualViewport?.addEventListener('resize', schedule)
    window.visualViewport?.addEventListener('scroll', schedule)
    schedule()
    return () => {
      scheduleRef.current = null
      cancelAnimationFrame(frame)
      observer.disconnect()
      resize?.disconnect()
      window.removeEventListener('resize', schedule)
      window.removeEventListener('scroll', schedule, true)
      window.visualViewport?.removeEventListener('resize', schedule)
      window.visualViewport?.removeEventListener('scroll', schedule)
    }
  }, [step.selector, step.id, index])

  useEffect(() => {
    scheduleRef.current?.()
  }, [busy, verified, error])

  useEffect(() => {
    const shortcuts = (event: KeyboardEvent) => {
      const focused = event.target instanceof HTMLElement ? event.target : null
      if (focused?.closest('input,textarea,select,[contenteditable="true"]'))
        return
      if (event.altKey && event.key === 'ArrowRight' && verified && !busy) {
        event.preventDefault()
        onNext()
      }
      if (event.altKey && event.key === 'ArrowLeft' && index > 0 && !busy) {
        event.preventDefault()
        onPrevious()
      }
    }
    document.addEventListener('keydown', shortcuts)
    return () => document.removeEventListener('keydown', shortcuts)
  }, [onNext, onPrevious, verified, busy, index])

  if (!host) return null
  const local = (box: Box) => ({
    left: box.left - geometry.origin.left,
    top: box.top - geometry.origin.top,
    width: box.width,
    height: box.height,
  })
  const targetStyle = geometry.target ? local(geometry.target) : null
  return createPortal(
    <div data-guide-overlay className="guide-overlay">
      {targetStyle && (
        <div
          className="guide-highlight"
          style={targetStyle}
          aria-hidden="true"
        />
      )}
      <section
        ref={panelRef}
        className="guide-panel"
        style={{
          left: geometry.panel.left - geometry.origin.left,
          top: geometry.panel.top - geometry.origin.top,
          width: geometry.panel.width,
          maxHeight: geometry.panel.height,
        }}
        data-guide-panel
        data-tour="guide-controls"
        aria-label="Điều khiển hướng dẫn tương tác"
        aria-describedby="guide-current-instruction"
      >
        <header className="guide-panel-heading">
          <div>
            <p className="guide-eyebrow">CHƯƠNG {step.chapter}/9</p>
            <span>Tự làm theo hướng dẫn</span>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onExit}
            aria-label="Thoát hướng dẫn và quay về không gian ban đầu"
            title="Thoát hướng dẫn"
            data-tour="guide-exit"
          >
            <X size={16} />
          </Button>
        </header>
        <div
          className="guide-chapter-progress"
          role="progressbar"
          aria-label="Tiến độ hướng dẫn"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={Math.min(total, completed)}
        >
          <span
            style={{
              width: `${Math.min(100, Math.max(0, (completed / Math.max(1, total)) * 100))}%`,
            }}
          />
        </div>
        <div className="guide-panel-body">
          <div className="guide-step-heading">
            <span>
              Bước {index + 1}/{total}
            </span>
            {busy ? (
              <LoaderCircle
                size={15}
                className="guide-spinner"
                aria-label="Đang thực hiện"
              />
            ) : verified ? (
              <CheckCircle2 size={16} aria-label="Đã xác minh bước" />
            ) : null}
          </div>
          <h2>{step.title}</h2>
          <p className="guide-why">{step.why}</p>
          <div className="guide-instruction" id="guide-current-instruction">
            <strong>Thao tác của bạn</strong>
            <p>{step.instruction}</p>
          </div>
          {action && <div className="guide-step-action">{action}</div>}
          {verified && (
            <div className="guide-result" role="status">
              <CheckCircle2 size={15} aria-hidden="true" />
              <p>{step.result}</p>
            </div>
          )}
          {!verified && !busy && !error && (
            <p className="guide-waiting" role="status">
              Chờ thao tác và kiểm tra điều kiện thực tế trước khi chuyển bước.
            </p>
          )}
          {error && (
            <div className="guide-error" role="alert">
              <strong>Bước này chưa hoàn tất</strong>
              <p>
                {moduleLoadFailure
                  ? `${MODULE_LOAD_MESSAGE} ${RELOAD_DATA_NOTE}`
                  : error}
              </p>
              <div>
                {moduleLoadFailure && <ReloadPageButton variant="default" />}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onRetry}
                  disabled={busy}
                >
                  Thử lại
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onConfigure}
                  disabled={busy}
                >
                  Về cấu hình
                </Button>
              </div>
            </div>
          )}
        </div>
        <footer className="guide-panel-footer">
          <div className="guide-playback-controls">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onRestart}
              disabled={busy}
              title="Xem lại từ đầu"
              aria-label="Xem lại từ đầu"
              data-tour="guide-restart"
            >
              <RotateCcw size={15} />
            </Button>
          </div>
          <div className="guide-step-controls">
            <Button
              variant="ghost"
              size="sm"
              onClick={onPrevious}
              disabled={index === 0 || busy}
              data-tour="guide-previous"
            >
              <ArrowLeft size={14} />
              Bước trước
            </Button>
            <Button
              size="sm"
              onClick={onNext}
              disabled={!verified || busy}
              data-tour="guide-next"
            >
              {index === total - 1 ? 'Hoàn thành' : 'Bước tiếp'}
              <ArrowRight size={14} />
            </Button>
          </div>
          <p className="guide-shortcuts">
            Alt + ← / →: chuyển bước đã xác minh
          </p>
        </footer>
      </section>
    </div>,
    host,
  )
}
