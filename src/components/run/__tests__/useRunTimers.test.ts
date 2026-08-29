/**
 * useRunTimers — fake-timer coverage of the Run screen's clock + elapsed timer (R281).
 *
 * A tiny Host component runs the composable inside a real setup() so its
 * onMounted/onUnmounted hooks fire and the single interval is created + cleared.
 * Every case drives time with vi.useFakeTimers()/vi.setSystemTime — never real
 * time — so the suite is deterministic and a leaked interval would surface.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, enableAutoUnmount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { useRunTimers } from '@/composables/useRunTimers'

// onUnmounted must run so the interval is cleared between tests.
enableAutoUnmount(afterEach)

let capturedApi: ReturnType<typeof useRunTimers> | null = null

const Host = defineComponent({
  name: 'UseRunTimersHost',
  setup() {
    capturedApi = useRunTimers()
    return () => h('div')
  },
})

function mountHost() {
  return mount(Host)
}

beforeEach(() => {
  vi.useFakeTimers()
  // A fixed, non-midnight origin so the wall clock is a stable, non-empty string.
  vi.setSystemTime(new Date('2026-08-29T09:05:00'))
  capturedApi = null
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useRunTimers — wall clock', () => {
  it('is non-empty after mount and updates when the system time advances', () => {
    mountHost()
    const first = capturedApi!.clock.value
    expect(first).not.toBe('')

    // Advance the wall time by a minute, then let one tick fire.
    vi.setSystemTime(new Date('2026-08-29T09:06:00'))
    vi.advanceTimersByTime(1000)
    expect(capturedApi!.clock.value).not.toBe(first)
  })
})

describe('useRunTimers — elapsed since go-live', () => {
  it("reads '00:00' before startElapsed", () => {
    mountHost()
    expect(capturedApi!.elapsed.value).toBe('00:00')
  })

  it("reads '01:05' after startElapsed + 65s", () => {
    mountHost()
    capturedApi!.startElapsed()
    vi.advanceTimersByTime(65000)
    expect(capturedApi!.elapsed.value).toBe('01:05')
  })

  it("resetElapsed returns elapsed to '00:00'", () => {
    mountHost()
    capturedApi!.startElapsed()
    vi.advanceTimersByTime(65000)
    expect(capturedApi!.elapsed.value).toBe('01:05')

    capturedApi!.resetElapsed()
    expect(capturedApi!.elapsed.value).toBe('00:00')
  })

  it('startElapsed is idempotent — a second call keeps the FIRST origin', () => {
    mountHost()
    capturedApi!.startElapsed()
    vi.advanceTimersByTime(10000)
    // A second call 10s later must NOT reset the origin.
    capturedApi!.startElapsed()
    vi.advanceTimersByTime(55000)
    // Total from the first origin = 65s → 01:05 (not 00:55 from a reset origin).
    expect(capturedApi!.elapsed.value).toBe('01:05')
  })
})
