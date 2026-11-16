import assert from 'node:assert/strict'
import { test } from 'node:test'
import { JSDOM } from 'jsdom'
import { clickGuideTarget } from '../src/lib/guide-dom.ts'

test('automatic guide clicks reveal only clipped controls and preserve the scroll position of visible fields', async () => {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', {
    pretendToBeVisual: true,
  })
  const saved = new Map()
  function expose(name, value) {
    saved.set(name, Object.getOwnPropertyDescriptor(globalThis, name))
    Object.defineProperty(globalThis, name, {
      configurable: true,
      writable: true,
      value,
    })
  }
  for (const name of [
    'window',
    'document',
    'HTMLElement',
    'Element',
    'MouseEvent',
    'Event',
    'MutationObserver',
  ])
    expose(name, name === 'window' ? dom.window : dom.window[name])
  expose('getComputedStyle', dom.window.getComputedStyle.bind(dom.window))
  expose(
    'requestAnimationFrame',
    dom.window.requestAnimationFrame.bind(dom.window),
  )
  expose(
    'cancelAnimationFrame',
    dom.window.cancelAnimationFrame.bind(dom.window),
  )
  const rect = (left, top, width, height) => ({
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON() {},
  })
  const scroller = document.createElement('div')
  scroller.style.overflow = 'auto'
  scroller.getBoundingClientRect = () => rect(20, 20, 400, 200)
  Object.defineProperties(scroller, {
    clientWidth: { value: 400 },
    clientHeight: { value: 200 },
    scrollWidth: { value: 400 },
    scrollHeight: { value: 800 },
  })
  document.body.appendChild(scroller)
  const target = document.createElement('button')
  target.dataset.tour = 'actual-control'
  scroller.appendChild(target)
  const reveals = []
  target.scrollIntoView = (options) => reveals.push(options)
  let clicks = 0
  target.addEventListener('click', () => clicks++)
  const signal = new AbortController().signal
  try {
    target.getBoundingClientRect = () => rect(40, 80, 160, 36)
    await clickGuideTarget('actual-control', signal)
    assert.equal(clicks, 1, 'the real handler still runs')
    assert.deepEqual(
      reveals,
      [],
      'an already visible field must not be repeatedly centered',
    )

    target.getBoundingClientRect = () => rect(40, 250, 160, 36)
    await clickGuideTarget('actual-control', signal)
    assert.equal(clicks, 2)
    assert.equal(
      reveals.length,
      1,
      'a control clipped by a nested form scroller must be revealed',
    )
    assert.equal(
      reveals[0].block,
      'nearest',
      'move only the minimum needed, never recenter each field',
    )

    document.body.appendChild(target)
    target.getBoundingClientRect = () =>
      rect(40, window.innerHeight + 40, 160, 36)
    await clickGuideTarget('actual-control', signal)
    assert.equal(
      reveals.length,
      2,
      'viewport clipping must also reveal the control',
    )
    assert.equal(reveals[1].block, 'nearest')

    target.getBoundingClientRect = () => rect(40, 80, 160, 36)
    target.setAttribute('role', 'option')
    await clickGuideTarget('actual-control', signal)
    assert.equal(
      reveals.length,
      2,
      'visible dropdown options should not scroll the surrounding form',
    )
    assert.equal(clicks, 4)
  } finally {
    dom.window.close()
    for (const [name, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor)
      else delete globalThis[name]
    }
  }
})
