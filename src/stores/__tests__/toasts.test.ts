import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useToasts } from '@/stores/toasts'

let uuidCounter = 0

describe('useToasts', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    uuidCounter = 0
    vi.stubGlobal('crypto', {
      randomUUID: vi.fn(() => `mock-uuid-${++uuidCounter}`),
    })
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('push appends { id, message, variant } and returns the id', () => {
    const store = useToasts()
    const id = store.push('Save failed.')
    expect(id).toBe('mock-uuid-1')
    // Task 1 widens Toast with a `variant` field (defaults to 'error') —
    // the id/message shape and 6000ms default timer stay exactly as before.
    expect(store.toasts).toEqual([{ id: 'mock-uuid-1', message: 'Save failed.', variant: 'error' }])
  })

  it('auto-dismisses a toast 6000ms after it is pushed', () => {
    const store = useToasts()
    store.push('Save failed.')
    expect(store.toasts).toHaveLength(1)

    vi.advanceTimersByTime(5999)
    expect(store.toasts).toHaveLength(1)

    vi.advanceTimersByTime(1)
    expect(store.toasts).toHaveLength(0)
  })

  it('dismiss removes a toast immediately', () => {
    const store = useToasts()
    const id = store.push('Save failed.')
    store.dismiss(id)
    expect(store.toasts).toHaveLength(0)
  })

  it('dismiss on an id that is already gone is a no-op and does not throw', () => {
    const store = useToasts()
    const id = store.push('Save failed.')
    store.dismiss(id)
    expect(() => store.dismiss(id)).not.toThrow()
    expect(store.toasts).toHaveLength(0)
  })

  it('dismiss twice with the same id does not throw and leaves remaining toasts untouched', () => {
    const store = useToasts()
    const idA = store.push('First failure.')
    const idB = store.push('Second failure.')
    store.dismiss(idA)
    expect(() => store.dismiss(idA)).not.toThrow()
    expect(store.toasts).toEqual([{ id: idB, message: 'Second failure.', variant: 'error' }])
  })

  it('two toasts pushed at t=0 and t=1000 are removed at t=6000 and t=7000 respectively', () => {
    const store = useToasts()
    const idA = store.push('First failure.')
    vi.advanceTimersByTime(1000)
    const idB = store.push('Second failure.')

    // t=6000: idA's timer fires (armed at t=0), idB's (armed at t=1000) has not yet.
    vi.advanceTimersByTime(5000)
    expect(store.toasts.map((t) => t.id)).toEqual([idB])

    // t=7000: idB's timer fires.
    vi.advanceTimersByTime(1000)
    expect(store.toasts).toHaveLength(0)
  })

  it('two toasts pushed 1000ms apart dismiss 1000ms apart — each timer is independent', () => {
    const store = useToasts()
    const idA = store.push('First failure.')
    vi.advanceTimersByTime(1000)
    store.push('Second failure.')

    vi.advanceTimersByTime(4999) // t=5999 overall: idA has 1ms left, idB has 1001ms left
    expect(store.toasts.map((t) => t.id)).toContain(idA)

    vi.advanceTimersByTime(1) // t=6000: idA's timer fires
    expect(store.toasts.map((t) => t.id)).not.toContain(idA)
    expect(store.toasts).toHaveLength(1)
  })

  it('a toast whose auto-dismiss fires after its id was already manually dismissed does not remove a different toast', () => {
    const store = useToasts()
    const idA = store.push('First failure.') // idA's orphaned timer will fire at t=6000
    vi.advanceTimersByTime(3000) // t=3000
    store.dismiss(idA) // manually dismissed well before its 6000ms timer fires
    const idB = store.push('Second failure.') // idB's timer will fire at t=9000

    // Advance past idA's orphaned timer (t=6000) but well before idB's (t=9000).
    vi.advanceTimersByTime(3001) // t=6001
    expect(store.toasts).toEqual([{ id: idB, message: 'Second failure.', variant: 'error' }])
  })

  // ── Phase 104 (R309/R310) — the generalized surface ──────────────────────

  it('push(message, { variant }) records the chosen variant and still arms no timer when autoDismissMs is not passed', () => {
    const store = useToasts()
    store.push('Heads up.', { variant: 'info' })
    expect(store.toasts).toEqual([{ id: 'mock-uuid-1', message: 'Heads up.', variant: 'info' }])

    // opts was passed but autoDismissMs was left undefined — sticky, no timer.
    vi.advanceTimersByTime(60_000)
    expect(store.toasts).toHaveLength(1)
  })

  it('push(message, { variant, autoDismissMs }) arms a timer for exactly that duration', () => {
    const store = useToasts()
    store.push('Saved.', { variant: 'success', autoDismissMs: 3000 })

    vi.advanceTimersByTime(2999)
    expect(store.toasts).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(store.toasts).toHaveLength(0)
  })

  it('setSticky inserts a keyed item with no auto-dismiss timer', () => {
    const store = useToasts()
    store.setSticky('monitor-reassign', { variant: 'warning', heading: 'Your monitor setup changed' })

    expect(store.toasts).toHaveLength(1)
    expect(store.toasts[0]).toMatchObject({
      key: 'monitor-reassign',
      variant: 'warning',
      heading: 'Your monitor setup changed',
    })

    vi.advanceTimersByTime(60_000)
    expect(store.toasts).toHaveLength(1)
  })

  it('setSticky called twice with the same key replaces the item in place (no stacking)', () => {
    const store = useToasts()
    store.setSticky('monitor-reassign', { variant: 'warning', heading: 'First heading' })
    const idAfterFirst = store.toasts[0]!.id
    store.setSticky('monitor-reassign', { variant: 'warning', heading: 'Second heading' })

    expect(store.toasts).toHaveLength(1)
    expect(store.toasts[0]!.id).toBe(idAfterFirst)
    expect(store.toasts[0]!.heading).toBe('Second heading')
  })

  it('clearSticky removes the keyed item and is a no-op on an absent key', () => {
    const store = useToasts()
    store.setSticky('monitor-reassign', { variant: 'warning', heading: 'Your monitor setup changed' })
    store.clearSticky('monitor-reassign')
    expect(store.toasts).toHaveLength(0)

    expect(() => store.clearSticky('never-existed')).not.toThrow()
    expect(store.toasts).toHaveLength(0)
  })

  it('dismissing a keyed sticky by its id also clears it, and a later clearSticky for the same key is a harmless no-op', () => {
    const store = useToasts()
    const id = store.setSticky('monitor-reassign', { variant: 'warning', heading: 'Your monitor setup changed' })
    store.dismiss(id)
    expect(store.toasts).toHaveLength(0)

    expect(() => store.clearSticky('monitor-reassign')).not.toThrow()
    expect(store.toasts).toHaveLength(0)
  })

  it('clearSticky before manual dismiss is also race-safe: a later dismiss(id) on the already-cleared id is a harmless no-op', () => {
    const store = useToasts()
    const id = store.setSticky('monitor-reassign', { variant: 'warning', heading: 'Your monitor setup changed' })
    store.clearSticky('monitor-reassign')
    expect(store.toasts).toHaveLength(0)

    expect(() => store.dismiss(id)).not.toThrow()
    expect(store.toasts).toHaveLength(0)
  })

  it('sticky items carry a key so the host can distinguish them from transient items, which carry none', () => {
    const store = useToasts()
    store.push('A transient failure.')
    store.setSticky('monitor-reassign', { variant: 'warning', heading: 'Your monitor setup changed' })

    const transient = store.toasts.find((t) => t.message === 'A transient failure.')
    const sticky = store.toasts.find((t) => t.key === 'monitor-reassign')
    expect(transient?.key).toBeUndefined()
    expect(sticky?.key).toBe('monitor-reassign')
  })
})
