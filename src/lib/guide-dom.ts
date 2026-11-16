/** Wait for real store/DOM changes. Timers are deadlines, never simulated processing. */
export function waitForGuide(
  predicate: () => boolean,
  signal: AbortSignal,
  subscribe?: (listener: () => void) => () => void,
  timeout = 45_000,
): Promise<void> {
  signal.throwIfAborted()
  return new Promise((resolve, reject) => {
    let finished = false
    let unsubscribe: (() => void) | undefined
    const observer = new MutationObserver(check)
    const timer = setTimeout(
      () =>
        finish(
          new Error(
            'Hết thời gian chờ giao diện hoặc xử lý. Kiểm tra cấu hình rồi thử lại.',
          ),
        ),
      timeout,
    )
    function finish(error?: unknown) {
      if (finished) return
      finished = true
      clearTimeout(timer)
      observer.disconnect()
      unsubscribe?.()
      signal.removeEventListener('abort', abort)
      if (error) reject(error)
      else resolve()
    }
    function check() {
      try {
        if (predicate()) finish()
      } catch (error) {
        finish(error)
      }
    }
    function abort() {
      finish(signal.reason ?? new DOMException('Aborted', 'AbortError'))
    }
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
    })
    unsubscribe = subscribe?.(check)
    signal.addEventListener('abort', abort, { once: true })
    check()
  })
}

export const guideTarget = (name: string) =>
  document.querySelector<HTMLElement>(`[data-tour="${name}"]`)
function illustrateTarget(target: HTMLElement) {
  document
    .querySelector('[data-guide-current-target]')
    ?.removeAttribute('data-guide-current-target')
  target.setAttribute('data-guide-current-target', 'true')
}

/** Only the action layer scrolls. The overlay observes geometry without moving it. */
export function revealGuideTarget(target: HTMLElement) {
  const box = target.getBoundingClientRect()
  const viewport = window.visualViewport
  const bounds = {
    left: viewport?.offsetLeft ?? 0,
    top: viewport?.offsetTop ?? 0,
    right: (viewport?.offsetLeft ?? 0) + (viewport?.width ?? window.innerWidth),
    bottom:
      (viewport?.offsetTop ?? 0) + (viewport?.height ?? window.innerHeight),
  }
  for (
    let parent = target.parentElement;
    parent && parent !== document.body;
    parent = parent.parentElement
  ) {
    const style = getComputedStyle(parent)
    const clipsX = /auto|scroll|hidden|clip/.test(
      style.overflowX || style.overflow,
    )
    const clipsY = /auto|scroll|hidden|clip/.test(
      style.overflowY || style.overflow,
    )
    if (!clipsX && !clipsY) continue
    const clip = parent.getBoundingClientRect()
    if (clipsX) {
      bounds.left = Math.max(bounds.left, clip.left)
      bounds.right = Math.min(bounds.right, clip.right)
    }
    if (clipsY) {
      bounds.top = Math.max(bounds.top, clip.top)
      bounds.bottom = Math.min(bounds.bottom, clip.bottom)
    }
  }
  if (
    box.top < bounds.top ||
    box.bottom > bounds.bottom ||
    box.left < bounds.left ||
    box.right > bounds.right
  ) {
    target.scrollIntoView?.({
      block: 'nearest',
      inline: 'nearest',
      behavior: 'instant',
    })
  }
}
function paint(signal: AbortSignal) {
  signal.throwIfAborted()
  return new Promise<void>((resolve, reject) => {
    const abort = () => {
      cancelAnimationFrame(frame)
      reject(signal.reason)
    }
    const frame = requestAnimationFrame(() => {
      signal.removeEventListener('abort', abort)
      resolve()
    })
    signal.addEventListener('abort', abort, { once: true })
  })
}
export async function clickGuideTarget(name: string, signal: AbortSignal) {
  await waitForGuide(() => {
    const target = guideTarget(name)
    return !!target && !target.matches(':disabled')
  }, signal)
  const target = guideTarget(name)!
  illustrateTarget(target)
  revealGuideTarget(target)
  target.focus({ preventScroll: true })
  // Radix controls use pointer/mouse handlers as well as click. Dispatch the
  // normal sequence so selects and tabs exercise those same handlers.
  if (typeof PointerEvent !== 'undefined')
    target.dispatchEvent(
      new PointerEvent('pointerdown', {
        bubbles: true,
        button: 0,
        pointerType: 'mouse',
        pointerId: 1,
      }),
    )
  target.dispatchEvent(
    new MouseEvent('mousedown', { bubbles: true, button: 0 }),
  )
  await paint(signal)
  if (typeof PointerEvent !== 'undefined')
    target.dispatchEvent(
      new PointerEvent('pointerup', {
        bubbles: true,
        button: 0,
        pointerType: 'mouse',
        pointerId: 1,
      }),
    )
  target.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, button: 0 }))
  target.click()
  await paint(signal)
}

/** Resume an interrupted dropdown without toggling an already open menu shut. */
export async function openGuideTarget(name: string, signal: AbortSignal) {
  await waitForGuide(() => !!guideTarget(name), signal)
  if (guideTarget(name)?.getAttribute('aria-expanded') !== 'true')
    await clickGuideTarget(name, signal)
}

/** Native setters dispatch the same input/change events used by the React forms. */
export function fillGuideTarget(name: string, value: string) {
  const element = guideTarget(name)
  if (!(
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement ||
    element instanceof HTMLSelectElement
  ))
    throw new Error(`Không tìm thấy trường nhập: ${name}`)
  illustrateTarget(element)
  const prototype =
    element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : element instanceof HTMLSelectElement
        ? HTMLSelectElement.prototype
        : HTMLInputElement.prototype
  Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(element, value)
  element.dispatchEvent(
    new Event(element instanceof HTMLSelectElement ? 'change' : 'input', {
      bubbles: true,
    }),
  )
}
