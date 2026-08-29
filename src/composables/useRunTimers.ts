import { computed, onMounted, onUnmounted, ref } from 'vue'

/**
 * useRunTimers — the Run screen's wall clock + elapsed-since-go-live timer (R281).
 *
 * A SINGLE ~1s setInterval, created in onMounted and cleared in onUnmounted
 * (mirroring RunControlView's stopRecoveryWatchers clearInterval + null-the-id
 * discipline), drives both a short wall-time `clock` string and an `elapsed`
 * (M:SS / H:MM:SS) string measured from the go-live origin.
 *
 * `startElapsed()` is idempotent: only the FIRST call (the first go-live OR the
 * first rehearse) records the origin; later calls are no-ops. `resetElapsed()`
 * clears the origin so `elapsed` reads '00:00' again.
 *
 * All formatting is padStart-based — NO Array.prototype.at (absent from the TS
 * lib target; see CLAUDE.md). Fake-timer friendly: advanceTimersByTime drives
 * both the clock and the elapsed count, so a mount/unmount harness can prove
 * the interval self-clears.
 */
export function useRunTimers() {
  // Reactive display surface consumed by RunHeader.
  const clock = ref('')
  const elapsedMs = ref(0)

  // Non-reactive bookkeeping: the go-live origin and the interval handle.
  let startedAt: number | null = null
  let id: ReturnType<typeof setInterval> | null = null

  const elapsed = computed(() => formatElapsed(elapsedMs.value))

  /** Record the go-live epoch ONCE — idempotent across repeated calls. */
  function startElapsed() {
    if (startedAt == null) startedAt = Date.now()
  }

  /** Clear the origin so elapsed returns to '00:00'. */
  function resetElapsed() {
    startedAt = null
    elapsedMs.value = 0
  }

  /** One tick: refresh the wall clock, and the elapsed count if started. */
  function tick() {
    clock.value = formatClock(new Date())
    if (startedAt != null) elapsedMs.value = Date.now() - startedAt
  }

  onMounted(() => {
    tick()
    id = setInterval(tick, 1000)
  })

  onUnmounted(() => {
    if (id != null) {
      clearInterval(id)
      id = null
    }
  })

  return { clock, elapsed, startElapsed, resetElapsed }
}

/** A short wall time, e.g. "9:05 AM". */
function formatClock(d: Date): string {
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

/**
 * Format an elapsed duration as M:SS, or H:MM:SS once past an hour.
 * padStart-based — no Array.prototype.at.
 */
function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const hh = Math.floor(totalSeconds / 3600)
  const mm = String(Math.floor((totalSeconds / 60) % 60)).padStart(2, '0')
  const ss = String(totalSeconds % 60).padStart(2, '0')
  return hh > 0 ? `${hh}:${mm}:${ss}` : `${mm}:${ss}`
}
