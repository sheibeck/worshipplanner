// See .planning/codebase/ARCHITECTURE.md (§ Component & Composable Behavioral Notes (R318) -> src/composables/useLoopTimer.ts)
import { onUnmounted } from 'vue'

export interface UseLoopTimer {
  /** Arm a single interval, disarming any prior one first (never more than one live). */
  arm(intervalMs: number, tick: () => void): void
  /** Clear the active interval, if any. Idempotent. */
  disarm(): void
}

export function useLoopTimer(): UseLoopTimer {
  let intervalId: ReturnType<typeof setInterval> | null = null

  function disarm() {
    if (intervalId != null) {
      clearInterval(intervalId)
      intervalId = null
    }
  }

  function arm(intervalMs: number, tick: () => void) {
    disarm()
    intervalId = setInterval(tick, intervalMs)
  }

  onUnmounted(disarm)

  return { arm, disarm }
}
