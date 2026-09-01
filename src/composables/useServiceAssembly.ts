/** See ADR-0134 (docs/adr/0134-shared-service-load-read-only-assembly-slice-phase-95.md) */
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

  // See ADR-0134 (docs/adr/0134-shared-service-load-read-only-assembly-slice-phase-95.md)
  onMounted(() => {
    // See ADR-0135 (docs/adr/0135-service-subscription-key-the-service-source-off-the-same-res.md)
    // service source to `orgIdRef` and eliminates the bleed. Skipping when the org
    // already matches preserves the existing subscription (no redundant re-listen).
    const orgId = orgIdRef.value
    if (orgId && serviceStore.orgId !== orgId) {
      serviceStore.subscribe(orgId)
    }
  })

  return { serviceId, orgIdRef, localService, assembledSlideshow }
}
