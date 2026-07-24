import { onMounted, onUnmounted, ref } from 'vue'

/**
 * Reactive desktop/mobile detection backed by a CSS media query, not `window.innerWidth`
 * polling. Matrix vs. list are structurally different DOM trees (not a CSS show/hide pair),
 * so the mobile fallback (D-14) needs a real breakpoint signal to pick the initial view.
 */
export function useIsMobile(query = '(min-width: 640px)') {
  const mediaQuery =
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(query)
      : null
  const isDesktop = ref(mediaQuery?.matches ?? true)

  function onChange(event: MediaQueryListEvent) {
    isDesktop.value = event.matches
  }

  onMounted(() => {
    mediaQuery?.addEventListener('change', onChange)
  })

  onUnmounted(() => {
    mediaQuery?.removeEventListener('change', onChange)
  })

  return { isDesktop }
}
