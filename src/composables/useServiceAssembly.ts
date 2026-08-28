/**
 * Shared service-load + read-only assembly slice (Phase 95, R262/R263/R264
 * foundation — "reuse, don't fork").
 *
 * This composable owns ONLY the small load core the standalone output windows
 * and the in-app Run/control screen must resolve IDENTICALLY: the
 * `?org=`/`:serviceId` scoping, the `localService` initial-load watch, the
 * read-only `useSlideshowAssembly` (canWrite omitted), and the WR-02
 * org-mismatch subscribe gate (registered in its OWN `onMounted`).
 *
 * It deliberately holds NONE of the output-only lifecycle — no run channel, no
 * wake lock, no font gate, no cursor/fullscreen machinery — and, crucially, it
 * registers NO `onUnmounted` and NEVER calls `serviceStore.unsubscribeAll()`.
 * It is consumed by BOTH useOutputWindow (the standalone output windows, which
 * keep their own `unsubscribeAll()` teardown) AND RunControlView (a normal
 * in-app SPA route that shares the store with peers and must NOT tear the
 * subscription down on its unmount). Placing a store teardown here would kill
 * those peers' subscriptions.
 *
 * It MUST be called from inside a component `setup()` — it registers one
 * `onMounted` (the WR-02 subscribe gate) on the calling instance. Call it
 * FIRST in the consumer's setup so its `onMounted` runs before any later
 * `onMounted` (e.g. useOutputWindow opening its channel) — subscribe-before-
 * channel ordering is preserved by call order.
 */
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import type { Service } from '@/types/service'
import { useAuthStore } from '@/stores/auth'
import { useServiceStore } from '@/stores/services'
import { useSlideshowAssembly } from '@/composables/useSlideshowAssembly'

export function useServiceAssembly() {
  const route = useRoute()
  const authStore = useAuthStore()
  const serviceStore = useServiceStore()

  // ── Org + service scoping ──────────────────────────────────────────────────
  // serviceId from the route param; org from the ?org= query (the self-scoping
  // convention per 93-CONTEXT), falling back to the auth store's active org.
  const serviceId = computed(() => route.params.serviceId as string)
  const orgIdRef = computed(() => (route.query.org as string | undefined) ?? authStore.orgId ?? null)

  // Read-only viewer: the initial-load branch ONLY — no backfillSlotIds, no
  // JSON clone, no dirty tracking, no remote-merge (all editor machinery).
  const localService = ref<Service | null>(null)
  watch(
    () => serviceStore.services,
    (services) => {
      if (localService.value) return // initial-load only
      const found = services.find((s) => s.id === serviceId.value)
      if (found) {
        localService.value = found
      }
    },
    { immediate: true },
  )

  // In-window assembly — canWrite OMITTED so it stays its false default: a viewer
  // never attempts a materialize/rebuild write its Firestore rules would deny.
  const { assembledSlideshow } = useSlideshowAssembly(localService, orgIdRef)

  // ── Lifecycle: WR-02 subscribe gate ONLY (no unsubscribeAll) ────────────────
  onMounted(() => {
    // Service subscription — key the service source off the SAME resolved orgId
    // useSlideshowAssembly subscribes content to, not off "is the store fresh?".
    //
    // WR-02 (93-REVIEW): the old `!serviceStore.orgId` gate assumed a fresh Pinia
    // singleton (the standalone window.open path). But this is also a directly-
    // loadable SPA route: on a same-tab navigation where the store is ALREADY
    // subscribed to org X while this URL's `?org=` is Y, that gate skipped the
    // re-subscribe, leaving `services` sourced from X while the assembly reads Y —
    // a silent cross-org desync on the congregation surface (never-found service →
    // permanent black, or an X service assembled against Y's content maps). Gate on
    // an org MISMATCH instead: subscribe() is idempotent (it tears down the prior
    // listener first), so re-subscribing when the requested org differs re-keys the
    // service source to `orgIdRef` and eliminates the bleed. Skipping when the org
    // already matches preserves the existing subscription (no redundant re-listen).
    const orgId = orgIdRef.value
    if (orgId && serviceStore.orgId !== orgId) {
      serviceStore.subscribe(orgId)
    }
  })

  return { serviceId, orgIdRef, localService, assembledSlideshow }
}
