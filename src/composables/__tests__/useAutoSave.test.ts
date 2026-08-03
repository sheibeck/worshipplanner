import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref, nextTick, computed } from 'vue'
import { useAutoSave } from '@/composables/useAutoSave'

describe('useAutoSave', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts with idle status', () => {
    const source = ref({ value: 'initial' })
    const saveFn = vi.fn().mockResolvedValue(undefined)
    const { status } = useAutoSave(() => source.value, saveFn)
    expect(status.value).toBe('idle')
  })

  it('suppresses the first watcher trigger (initialized guard)', async () => {
    const source = ref({ value: 'initial' })
    const saveFn = vi.fn().mockResolvedValue(undefined)
    const { status } = useAutoSave(() => source.value, saveFn)

    // Trigger the first change — should be suppressed
    source.value = { value: 'first-change' }
    await nextTick()

    expect(status.value).toBe('idle')
    vi.advanceTimersByTime(1000)
    expect(saveFn).not.toHaveBeenCalled()
  })

  it('debounces rapid changes into a single save after the debounce period', async () => {
    const source = ref({ value: 'initial' })
    const saveFn = vi.fn().mockResolvedValue(undefined)
    const { status } = useAutoSave(() => source.value, saveFn)

    // First change: suppressed by initialized guard
    source.value = { value: 'change-1' }
    await nextTick()

    // Subsequent rapid changes should debounce
    source.value = { value: 'change-2' }
    await nextTick()
    expect(status.value).toBe('pending')

    source.value = { value: 'change-3' }
    await nextTick()
    expect(status.value).toBe('pending')

    source.value = { value: 'change-4' }
    await nextTick()
    expect(status.value).toBe('pending')

    // Advance past debounce period (default 800ms)
    await vi.advanceTimersByTimeAsync(800)

    // Should have saved exactly once
    expect(saveFn).toHaveBeenCalledTimes(1)
    expect(status.value).toBe('saved')
  })

  it('coalesces two mutations in one debounce window into one save carrying the later value', async () => {
    const source = ref({ value: 'initial' })
    let observedValue = ''
    const saveFn = vi.fn().mockImplementation(() => {
      observedValue = source.value.value
      return Promise.resolve()
    })
    useAutoSave(() => source.value, saveFn)

    // Skip initialized guard
    source.value = { value: 'skip' }
    await nextTick()

    // Two mutations inside the same debounce window
    source.value = { value: 'first' }
    await nextTick()
    source.value = { value: 'second' }
    await nextTick()

    await vi.advanceTimersByTimeAsync(800)

    // Exactly one save, carrying the second (later) mutation — the debounce
    // coalesces, it never drops or reorders
    expect(saveFn).toHaveBeenCalledTimes(1)
    expect(observedValue).toBe('second')
  })

  it('transitions through idle -> pending -> saving -> saved, and saved persists', async () => {
    const source = ref({ value: 'initial' })
    let resolvePromise: () => void
    const saveFn = vi.fn().mockImplementation(
      () => new Promise<void>((resolve) => { resolvePromise = resolve }),
    )
    const { status } = useAutoSave(() => source.value, saveFn)

    // Start idle
    expect(status.value).toBe('idle')

    // Skip initialized guard
    source.value = { value: 'skip' }
    await nextTick()
    expect(status.value).toBe('idle')

    // Real change -> pending
    source.value = { value: 'real-change' }
    await nextTick()
    expect(status.value).toBe('pending')

    // Advance debounce -> saving
    vi.advanceTimersByTime(800)
    // Give microtask queue a tick for the async callback to start
    await vi.advanceTimersByTimeAsync(0)
    expect(status.value).toBe('saving')

    // Resolve the save -> saved
    resolvePromise!()
    await vi.advanceTimersByTimeAsync(0)
    expect(status.value).toBe('saved')

    // After 3 seconds -> still saved (the fade is gone; 'saved' is terminal
    // until the next pending transition)
    vi.advanceTimersByTime(3000)
    expect(status.value).toBe('saved')
  })

  it('prevents concurrent saves via inflight guard', async () => {
    const source = ref({ count: 0 })
    let resolveFirst: () => void
    let callCount = 0
    const saveFn = vi.fn().mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        return new Promise<void>((resolve) => { resolveFirst = resolve })
      }
      return Promise.resolve()
    })
    const { status } = useAutoSave(() => source.value, saveFn, undefined, { debounceMs: 100 })

    // Skip initialized guard
    source.value = { count: 1 }
    await nextTick()

    // Trigger a real change
    source.value = { count: 2 }
    await nextTick()

    // Advance past debounce — first save starts
    await vi.advanceTimersByTimeAsync(100)
    expect(saveFn).toHaveBeenCalledTimes(1)
    expect(status.value).toBe('saving')

    // Trigger another change while saving
    source.value = { count: 3 }
    await nextTick()
    expect(status.value).toBe('pending')

    // Advance debounce again — inflight guard should reschedule, not call saveFn
    await vi.advanceTimersByTimeAsync(100)
    // saveFn still called only once because saving is true
    expect(saveFn).toHaveBeenCalledTimes(1)

    // Resolve the first save
    resolveFirst!()
    await vi.advanceTimersByTimeAsync(0)

    // Now the rescheduled timer fires
    await vi.advanceTimersByTimeAsync(100)
    expect(saveFn).toHaveBeenCalledTimes(2)
  })

  it('a mutation dispatched while a save is in flight is not lost — the follow-up save observes the later value', async () => {
    const source = ref({ count: 0 })
    let resolveFirst: () => void
    let callCount = 0
    const observedValues: number[] = []
    const saveFn = vi.fn().mockImplementation(() => {
      callCount++
      observedValues.push(source.value.count)
      if (callCount === 1) {
        return new Promise<void>((resolve) => { resolveFirst = resolve })
      }
      return Promise.resolve()
    })
    const { status } = useAutoSave(() => source.value, saveFn, undefined, { debounceMs: 100 })

    // Skip initialized guard
    source.value = { count: 1 }
    await nextTick()

    // Trigger a real change — first save starts after debounce
    source.value = { count: 2 }
    await nextTick()
    await vi.advanceTimersByTimeAsync(100)
    expect(saveFn).toHaveBeenCalledTimes(1)
    expect(status.value).toBe('saving')

    // Trigger another change while saving — this mutation must not be lost
    source.value = { count: 3 }
    await nextTick()

    // Advance debounce again — inflight guard reschedules, doesn't call saveFn yet
    await vi.advanceTimersByTimeAsync(100)
    expect(saveFn).toHaveBeenCalledTimes(1)

    // Resolve the in-flight save — the reschedule fires the follow-up save
    resolveFirst!()
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(100)

    expect(saveFn).toHaveBeenCalledTimes(2)
    expect(observedValues[1]).toBe(3)
    expect(status.value).toBe('saved')
  })

  it('flush forces immediate save bypassing debounce', async () => {
    const source = ref({ value: 'initial' })
    const saveFn = vi.fn().mockResolvedValue(undefined)
    const { status, flush } = useAutoSave(() => source.value, saveFn)

    // Skip initialized guard
    source.value = { value: 'skip' }
    await nextTick()

    // Trigger a real change
    source.value = { value: 'change' }
    await nextTick()
    expect(status.value).toBe('pending')

    // Flush before debounce timer fires
    await flush()

    expect(saveFn).toHaveBeenCalledTimes(1)
    expect(status.value).toBe('saved')

    // Original debounce timer should have been cleared
    await vi.advanceTimersByTimeAsync(1000)
    expect(saveFn).toHaveBeenCalledTimes(1)
  })

  it('flush does nothing when status is not pending', async () => {
    const source = ref({ value: 'initial' })
    const saveFn = vi.fn().mockResolvedValue(undefined)
    const { flush } = useAutoSave(() => source.value, saveFn)

    // Flush when idle — should not save
    await flush()
    expect(saveFn).not.toHaveBeenCalled()
  })

  it('cleanup clears all pending timers', async () => {
    const source = ref({ value: 'initial' })
    const saveFn = vi.fn().mockResolvedValue(undefined)
    const { status, cleanup } = useAutoSave(() => source.value, saveFn)

    // Skip initialized guard
    source.value = { value: 'skip' }
    await nextTick()

    // Trigger a real change
    source.value = { value: 'change' }
    await nextTick()
    expect(status.value).toBe('pending')

    // Cleanup before debounce fires
    cleanup()

    // Advance past debounce — timer should have been cleared
    await vi.advanceTimersByTimeAsync(1000)
    expect(saveFn).not.toHaveBeenCalled()
  })

  it('skips save when isDirty is false', async () => {
    const source = ref({ value: 'initial' })
    const dirty = ref(false)
    const isDirty = computed(() => dirty.value)
    const saveFn = vi.fn().mockResolvedValue(undefined)
    const { status } = useAutoSave(() => source.value, saveFn, isDirty)

    // Skip initialized guard
    source.value = { value: 'skip' }
    await nextTick()

    // Change with isDirty = false — should not start debounce
    source.value = { value: 'change' }
    await nextTick()
    expect(status.value).toBe('idle')

    await vi.advanceTimersByTimeAsync(1000)
    expect(saveFn).not.toHaveBeenCalled()
  })

  it('skips save at timer fire when isDirty becomes false during debounce', async () => {
    const source = ref({ value: 'initial' })
    const dirty = ref(true)
    const isDirty = computed(() => dirty.value)
    const saveFn = vi.fn().mockResolvedValue(undefined)
    const { status } = useAutoSave(() => source.value, saveFn, isDirty)

    // Skip initialized guard
    source.value = { value: 'skip' }
    await nextTick()

    // Change with isDirty = true — should start debounce
    source.value = { value: 'change' }
    await nextTick()
    expect(status.value).toBe('pending')

    // Mark clean before debounce fires
    dirty.value = false

    // Advance past debounce — should skip save
    await vi.advanceTimersByTimeAsync(800)
    expect(saveFn).not.toHaveBeenCalled()
    expect(status.value).toBe('idle')
  })

  it('respects custom debounceMs option', async () => {
    const source = ref({ value: 'initial' })
    const saveFn = vi.fn().mockResolvedValue(undefined)
    useAutoSave(() => source.value, saveFn, undefined, { debounceMs: 200 })

    // Skip initialized guard
    source.value = { value: 'skip' }
    await nextTick()

    // Real change
    source.value = { value: 'change' }
    await nextTick()

    // Should not fire before 200ms
    await vi.advanceTimersByTimeAsync(199)
    expect(saveFn).not.toHaveBeenCalled()

    // Should fire at 200ms
    await vi.advanceTimersByTimeAsync(1)
    expect(saveFn).toHaveBeenCalledTimes(1)
  })

  it('saved status persists indefinitely until the next change (no fade)', async () => {
    const source = ref({ value: 'initial' })
    const saveFn = vi.fn().mockResolvedValue(undefined)
    const { status } = useAutoSave(() => source.value, saveFn)

    // Skip initialized guard
    source.value = { value: 'skip' }
    await nextTick()

    // Trigger change and let save complete
    source.value = { value: 'change' }
    await nextTick()
    await vi.advanceTimersByTimeAsync(800)
    expect(status.value).toBe('saved')

    // Advancing well past the old 3-second fade window — status must still
    // read 'saved'. R040 replaces the fade with a persistent Saved timestamp.
    vi.advanceTimersByTime(60000)
    expect(status.value).toBe('saved')
  })

  it('debounced-path save failure sets status to error, not stranded at saving', async () => {
    const source = ref({ value: 'initial' })
    const saveFn = vi.fn().mockRejectedValue(new Error('write failed'))
    const { status } = useAutoSave(() => source.value, saveFn)

    // Skip initialized guard
    source.value = { value: 'skip' }
    await nextTick()

    // Real change -> pending -> saving -> rejects -> error
    source.value = { value: 'change' }
    await nextTick()
    await vi.advanceTimersByTimeAsync(800)

    expect(status.value).toBe('error')
  })

  it('flush() save failure sets status to error, not stranded at saving', async () => {
    const source = ref({ value: 'initial' })
    const saveFn = vi.fn().mockRejectedValue(new Error('write failed'))
    const { status, flush } = useAutoSave(() => source.value, saveFn)

    // Skip initialized guard
    source.value = { value: 'skip' }
    await nextTick()

    // Arm a pending change
    source.value = { value: 'change' }
    await nextTick()
    expect(status.value).toBe('pending')

    await flush()

    expect(status.value).toBe('error')
  })

  // ── CR-01/CR-02 (32-REVIEW) ──────────────────────────────────────────────────
  //
  // These close the two Critical findings the review traced to the composable
  // itself. Both existing tests above ('a mutation dispatched while a save is
  // in flight is not lost' and 'prevents concurrent saves via inflight guard')
  // only assert the eventual, self-correcting outcome — never the intermediate
  // state in the exact window the bugs live in. That's precisely what let both
  // bugs ship with the composable's own suite green.

  it('CR-01: does not clobber a newer pending status when an earlier in-flight save resolves', async () => {
    const source = ref({ count: 0 })
    let resolveFirst: () => void
    let callCount = 0
    const saveFn = vi.fn().mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        return new Promise<void>((resolve) => { resolveFirst = resolve })
      }
      return Promise.resolve()
    })
    const { status } = useAutoSave(() => source.value, saveFn, undefined, { debounceMs: 100 })

    // Skip initialized guard
    source.value = { count: 1 }
    await nextTick()

    // First edit -> debounce -> saving (held open)
    source.value = { count: 2 }
    await nextTick()
    await vi.advanceTimersByTimeAsync(100)
    expect(saveFn).toHaveBeenCalledTimes(1)
    expect(status.value).toBe('saving')

    // A second, distinct edit lands while the first save is still in flight —
    // its own watcher trigger advances status to 'pending' and arms a
    // follow-up timer.
    source.value = { count: 3 }
    await nextTick()
    expect(status.value).toBe('pending')

    // Resolve the first save. Before the fix, the success handler
    // unconditionally wrote 'saved' right here — lying about the second,
    // still-unpersisted edit for up to a full debounce interval.
    resolveFirst!()
    await vi.advanceTimersByTimeAsync(0)

    expect(status.value).toBe('pending')
    expect(saveFn).toHaveBeenCalledTimes(1)
  })

  it("CR-01: flush()'s own success handler does not clobber a newer pending status either", async () => {
    const source = ref({ value: 'initial' })
    let resolveSave: () => void
    const saveFn = vi.fn().mockImplementation(
      () => new Promise<void>((resolve) => { resolveSave = resolve }),
    )
    const { status, flush } = useAutoSave(() => source.value, saveFn)

    // Skip initialized guard
    source.value = { value: 'skip' }
    await nextTick()

    source.value = { value: 'change' }
    await nextTick()
    expect(status.value).toBe('pending')

    const flushing = flush()
    await nextTick()
    expect(status.value).toBe('saving')

    // A distinct mutation lands while flush()'s own save is in flight — same
    // shape as the debounced-path case above, just reached via flush().
    source.value = { value: 'newer edit while flush is in flight' }
    await nextTick()
    expect(status.value).toBe('pending')

    resolveSave!()
    await flushing

    // Before the fix, flush()'s success handler unconditionally wrote
    // 'saved' here.
    expect(status.value).toBe('pending')
  })

  it("CR-02: flush() does not cancel a newer edit's just-armed timer when a previous save is still in flight", async () => {
    const source = ref({ count: 0 })
    let resolveFirst: () => void
    let callCount = 0
    const saveFn = vi.fn().mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        return new Promise<void>((resolve) => { resolveFirst = resolve })
      }
      return Promise.resolve()
    })
    const { status, flush } = useAutoSave(() => source.value, saveFn, undefined, { debounceMs: 100 })

    // Skip initialized guard
    source.value = { count: 1 }
    await nextTick()

    // First edit -> debounce -> saving (held open)
    source.value = { count: 2 }
    await nextTick()
    await vi.advanceTimersByTimeAsync(100)
    expect(saveFn).toHaveBeenCalledTimes(1)
    expect(status.value).toBe('saving')

    // A second, distinct edit lands while the first save is still in
    // flight — it arms its own follow-up timer.
    source.value = { count: 3 }
    await nextTick()
    expect(status.value).toBe('pending')

    // flush() is called while the first save is still in flight (e.g.
    // onMarkAsPlanned). Before the fix this cleared the just-armed timer
    // FIRST, then no-op'd on `if (saving) return` — the edit becomes
    // unreachable: no timer is armed, and this call already returned.
    await flush()

    // The armed timer must have survived flush()'s no-op.
    resolveFirst!()
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(100)

    expect(saveFn).toHaveBeenCalledTimes(2)
    expect(status.value).toBe('saved')
  })

})
