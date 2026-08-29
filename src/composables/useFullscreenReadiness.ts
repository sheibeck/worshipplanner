// Read-only Automatic Fullscreen readiness composable (Phase 98, R285/R287).
// Small single-purpose composable shape (ref + exposed functions + own
// onMounted/onUnmounted lifecycle) — NOT useOutputWindow.ts's large
// options-object form (98-PATTERNS.md).
//
// This composable is READ-ONLY: it must NEVER call requestFullscreen() —
// that remains useOutputWindow.ts's job (attemptAutoFullscreen), the runtime
// consumer of the grant this phase helps the operator create. Regressing
// that boundary is threat T-98-03 (Elevation of Privilege).
import { ref, onMounted, onUnmounted, type Ref } from 'vue'

export type FullscreenReadiness = 'checking' | 'ready' | 'not-ready' | 'unsupported'

/**
 * Reuses the EXACT descriptor + cast from useOutputWindow.ts's
 * attemptAutoFullscreen — do not re-derive it. Resolves 'ready' when the
 * permission state is 'granted', 'not-ready' for any other resolved state,
 * and 'unsupported' when the query throws or navigator.permissions is
 * absent (R285).
 */
async function checkReadiness(): Promise<Exclude<FullscreenReadiness, 'checking'>> {
  try {
    const status = await navigator.permissions.query(
      { name: 'fullscreen', allowWithoutGesture: true } as unknown as PermissionDescriptor,
    )
    return status.state === 'granted' ? 'ready' : 'not-ready'
  } catch {
    return 'unsupported'
  }
}

export interface UseFullscreenReadinessReturn {
  status: Ref<FullscreenReadiness>
  recheck: () => Promise<void>
}

/**
 * Owns a reactive `status` initialized to 'checking', runs an initial check
 * on mount, and exposes `recheck()` for the "Confirm fullscreen support"
 * button. A window `focus` listener re-runs the check while `status !==
 * 'ready'` (RESEARCH Self-Correction Strategy / Open Question 3: re-query on
 * return rather than depending on a PermissionStatus 'change' event, since
 * the browser must fully restart for a registry/profile/JSON policy change
 * to take effect). If a recheck after a prior 'ready' resolves to
 * non-granted, status degrades back to 'not-ready' — no silently-stale
 * 'ready'.
 */
export function useFullscreenReadiness(): UseFullscreenReadinessReturn {
  const status = ref<FullscreenReadiness>('checking')

  async function recheck(): Promise<void> {
    status.value = 'checking'
    status.value = await checkReadiness()
  }

  function onFocus(): void {
    if (status.value !== 'ready') {
      void recheck()
    }
  }

  onMounted(() => {
    void recheck()
    window.addEventListener('focus', onFocus)
  })

  onUnmounted(() => {
    window.removeEventListener('focus', onFocus)
  })

  return { status, recheck }
}
