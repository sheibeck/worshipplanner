/**
 * useLoopTimer — the single-active-timer primitive behind per-item Run loop
 * playback (Phase 106, R306/R308).
 *
 * Owns EXACTLY ONE interval id. `arm()` ALWAYS `disarm()`s first, so there is
 * never more than one live timer no matter how many times arm() is called in
 * a row (the T-106-03 leak/duplicate-timer mitigation) — this also means
 * arming resets the clock, which is exactly what makes a manual nav mid-
 * interval (useRunControl's postIndex → reconcileLoop → arm) restart the
 * interval from the new position instead of fighting a stale tick. `disarm()`
 * clears + nulls the id and is idempotent (safe to call when already
 * disarmed). `onUnmounted(disarm)` is registered on the calling instance so a
 * plain route-away/unmount can never leak a ticking interval even if the
 * caller (useRunControl.ts) forgets to disarm explicitly on every exit path —
 * defense-in-depth alongside its own confirmExit/endServiceTeardown disarms.
 *
 * MUST be called from inside a component setup() (it calls onUnmounted).
 */
import { ref, onUnmounted } from 'vue'
import type { Ref } from 'vue'

export interface UseLoopTimer {
  /** Arm a single interval, disarming any prior one first (never more than one live). */
  arm(intervalMs: number, tick: () => void): void
  /** Clear the active interval, if any. Idempotent. */
  disarm(): void
  /** True while a timer is currently armed — exposed for tests. */
  isArmed: Ref<boolean>
}

export function useLoopTimer(): UseLoopTimer {
  let intervalId: ReturnType<typeof setInterval> | null = null
  const isArmed = ref(false)

  function disarm() {
    if (intervalId != null) {
      clearInterval(intervalId)
      intervalId = null
    }
    isArmed.value = false
  }

  function arm(intervalMs: number, tick: () => void) {
    disarm()
    intervalId = setInterval(tick, intervalMs)
    isArmed.value = true
  }

  onUnmounted(disarm)

  return { arm, disarm, isArmed }
}
