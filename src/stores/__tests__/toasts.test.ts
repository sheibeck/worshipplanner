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

  it('push appends { id, message } and returns the id', () => {
    const store = useToasts()
    const id = store.push('Save failed.')
    expect(id).toBe('mock-uuid-1')
    expect(store.toasts).toEqual([{ id: 'mock-uuid-1', message: 'Save failed.' }])
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
    expect(store.toasts).toEqual([{ id: idB, message: 'Second failure.' }])
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
    expect(store.toasts).toEqual([{ id: idB, message: 'Second failure.' }])
  })
})
