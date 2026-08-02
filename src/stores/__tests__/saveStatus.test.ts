import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useSaveStatus } from '@/stores/saveStatus'
import { useToasts } from '@/stores/toasts'

describe('useSaveStatus', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('entryFor on an unregistered key returns status idle and creates no entry', () => {
    const store = useSaveStatus()
    expect(store.entryFor('unknown')).toEqual({ status: 'idle' })
    expect(Object.keys(store.entries).length).toBe(0)
  })

  it('one surface never overwrites another — set(a) then set(b) leaves entryFor(a) unchanged', () => {
    const store = useSaveStatus()
    store.set('a', { status: 'saving' })
    store.set('b', { status: 'saved', savedAt: new Date() })
    expect(store.entryFor('a').status).toBe('saving')
  })

  it('with zero entries, mostUrgent is null', () => {
    const store = useSaveStatus()
    expect(store.mostUrgent).toBeNull()
  })

  it('with a at saved and b at saving, mostUrgent is b\'s entry', () => {
    const store = useSaveStatus()
    store.set('a', { status: 'saved', savedAt: new Date() })
    store.set('b', { status: 'saving' })
    expect(store.mostUrgent).toEqual({ status: 'saving' })
  })

  it('with a at error and b at saving, mostUrgent is a\'s entry', () => {
    const store = useSaveStatus()
    store.set('a', { status: 'error', errorText: "Couldn't save your changes — they're still here. Try again." })
    store.set('b', { status: 'saving' })
    expect(store.mostUrgent).toEqual({
      status: 'error',
      errorText: "Couldn't save your changes — they're still here. Try again.",
    })
  })

  it('with a and b both at saving, mostUrgent returns the same entry regardless of insertion order', () => {
    const forward = useSaveStatus(createPinia())
    forward.set('a', { status: 'saving' })
    forward.set('b', { status: 'saving' })
    const forwardWinnerKey = forward.entryFor('a').status === forward.mostUrgent?.status ? 'a' : 'b'

    const backward = useSaveStatus(createPinia())
    backward.set('b', { status: 'saving' })
    backward.set('a', { status: 'saving' })
    const backwardWinnerKey = backward.entryFor('a').status === backward.mostUrgent?.status ? 'a' : 'b'

    // Both orderings must resolve to the same (lexicographically-first) key.
    expect(forwardWinnerKey).toBe('a')
    expect(backwardWinnerKey).toBe('a')
  })

  it('clear(a) removes the key entirely; entryFor(a) reads idle again and mostUrgent excludes it', () => {
    const store = useSaveStatus()
    store.set('a', { status: 'saving' })
    store.set('b', { status: 'pending' })
    store.clear('a')

    expect(store.entryFor('a')).toEqual({ status: 'idle' })
    expect(Object.keys(store.entries)).toEqual(['b'])
    expect(store.mostUrgent).toEqual({ status: 'pending' })
  })

  it('a determinism test inserting the same two same-status surfaces in both orders across two fresh Pinia instances picks the same surface both times', () => {
    const instanceA = useSaveStatus(createPinia())
    instanceA.set('zeta', { status: 'error', errorText: 'z-error' })
    instanceA.set('alpha', { status: 'error', errorText: 'a-error' })

    const instanceB = useSaveStatus(createPinia())
    instanceB.set('alpha', { status: 'error', errorText: 'a-error' })
    instanceB.set('zeta', { status: 'error', errorText: 'z-error' })

    // "alpha" sorts before "zeta" lexicographically — both instances must
    // agree on the same winner regardless of which was set() first.
    expect(instanceA.mostUrgent).toEqual({ status: 'error', errorText: 'a-error' })
    expect(instanceB.mostUrgent).toEqual({ status: 'error', errorText: 'a-error' })
  })

  it('entryFor returns a fresh idle object each time, not a shared singleton a consumer could mutate', () => {
    const store = useSaveStatus()
    const first = store.entryFor('unknown')
    first.status = 'saving'
    const second = store.entryFor('unknown')
    expect(second.status).toBe('idle')
  })

  describe('edge-triggered failure toast (R041)', () => {
    it('a not-error -> error transition pushes exactly one toast whose message is the entry\'s errorText', () => {
      const store = useSaveStatus()
      const toasts = useToasts()
      store.set('a', { status: 'saving' })
      store.set('a', { status: 'error', errorText: 'Custom failure text.' })

      expect(toasts.toasts).toHaveLength(1)
      expect(toasts.toasts[0]!.message).toBe('Custom failure text.')
    })

    it('a second set() call while already error pushes no further toast', () => {
      const store = useSaveStatus()
      const toasts = useToasts()
      store.set('a', { status: 'saving' })
      store.set('a', { status: 'error', errorText: 'First failure.' })
      store.set('a', { status: 'error', errorText: 'First failure.' })

      expect(toasts.toasts).toHaveLength(1)
    })

    it('leaving error (e.g. to pending) and failing again raises a toast for the new episode', () => {
      const store = useSaveStatus()
      const toasts = useToasts()
      store.set('a', { status: 'saving' })
      store.set('a', { status: 'error', errorText: 'First failure.' })
      store.set('a', { status: 'pending' })
      store.set('a', { status: 'error', errorText: 'Second failure.' })

      expect(toasts.toasts).toHaveLength(2)
      expect(toasts.toasts.map((t) => t.message)).toEqual(['First failure.', 'Second failure.'])
    })

    it('no non-error status ever pushes a toast — idle, pending, saving and saved are all silent', () => {
      const store = useSaveStatus()
      const toasts = useToasts()
      store.set('a', { status: 'idle' })
      store.set('a', { status: 'pending' })
      store.set('a', { status: 'saving' })
      store.set('a', { status: 'saved', savedAt: new Date() })

      expect(toasts.toasts).toHaveLength(0)
    })

    it('two surfaces failing independently push two separate toasts', () => {
      const store = useSaveStatus()
      const toasts = useToasts()
      store.set('a', { status: 'error', errorText: 'a failed.' })
      store.set('b', { status: 'error', errorText: 'b failed.' })

      expect(toasts.toasts).toHaveLength(2)
    })

    it('falls back to the generic copy when errorText is undefined', () => {
      const store = useSaveStatus()
      const toasts = useToasts()
      store.set('a', { status: 'error' })

      expect(toasts.toasts[0]!.message).toBe("Couldn't save your changes — they're still here. Try again.")
    })
  })
})
