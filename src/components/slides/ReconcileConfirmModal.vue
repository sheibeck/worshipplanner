<template>
  <Teleport to="body">
    <div
      v-if="isVisible"
      class="fixed inset-0 z-50 flex items-center justify-center"
      data-testid="reconcile-confirm-modal-overlay"
    >
      <!--
        Unlike the Edit Slide drawer (D-03: no scrim, because it's a
        live-editing surface that must stay non-blocking so the grid
        underneath remains clickable), this dialog DOES get a scrim. It is a
        decision-forcing confirmation about a whole group's slides, not
        something the user edits around — blocking the rest of the page while
        it's open is the right default here, the opposite of the drawer's.
      -->
      <div
        class="absolute inset-0 bg-black/50"
        data-testid="reconcile-confirm-modal-scrim"
      ></div>
      <!--
        The scrim above is deliberately inert — no click handler that closes
        the dialog. Only the two explicit actions below may resolve it; an
        accidental click beside a destructive confirmation must never apply
        or silently discard it.
      -->
      <div
        class="relative w-full max-w-md rounded-lg border border-gray-800 bg-gray-900 p-5 shadow-2xl"
        data-testid="reconcile-confirm-modal"
        role="dialog"
        aria-modal="true"
      >
        <h2 class="text-sm font-medium text-gray-100" data-testid="reconcile-confirm-modal-heading">{{ copy.heading }}</h2>
        <p class="mt-2 text-sm text-gray-300" data-testid="reconcile-confirm-modal-body">{{ copy.body }}</p>

        <!--
          D-06: no diff, no side-by-side, no per-slide list renders anywhere
          in this dialog. The exact counts and kinds already folded into
          `copy.body` (built by `reconciliationConfirmCopy`, 26-04) are the
          ENTIRE compensation for the diff view the user traded away — do not
          "improve" this later by adding one.
        -->

        <div class="mt-4 flex justify-end gap-2">
          <button
            type="button"
            class="rounded-md border border-gray-700 px-3 py-1.5 text-sm font-medium text-gray-300 transition-colors hover:bg-gray-800"
            data-testid="reconcile-confirm-modal-dismiss"
            @click="onDismiss"
          >Dismiss</button>
          <button
            type="button"
            class="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
            data-testid="reconcile-confirm-modal-apply"
            @click="onApply"
          >Apply source changes</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
/**
 * Reconciliation confirm dialog (Phase 26, R029/D-05..D-08) — closes the
 * cross-phase debt Phases 24 and 25 both deferred. A GROUP-level decision
 * (D-05), so it is its own component, never part of the Edit Slide drawer.
 *
 * Renders no diff, side-by-side, or per-slide list (D-06 — an explicit user
 * trade-away). Offers exactly two actions (D-07): `Apply source changes` and
 * `Dismiss`. Both intents carry nothing derived — the parent (`SlideGrid.vue`)
 * already holds the pending update and the plan item, and performs the two
 * writes itself using the divergence value carried on the pending update,
 * never one recomputed here.
 *
 * Takes the pending update and the plan item as props and renders through
 * the shared, already-unit-tested `reconciliationConfirmCopy` builder
 * (26-04) — this component assembles no wording of its own, so this suite
 * asserts wiring and rendering, not the copy's wording permutations again.
 */
import { computed, watch, onUnmounted } from 'vue'
import type { ServiceSlot } from '@/types/service'
import { reconciliationConfirmCopy, type PendingReconciliation } from './slideDisplay'

const props = defineProps<{
  /** Whether the dialog has been asked to open — combined with `pending`/`planItem` presence to derive actual visibility (Task 3: never openable against nothing). */
  open: boolean
  /** The pending reconciliation for the selected plan item, or null when none exists / it has disappeared. */
  pending: PendingReconciliation | null
  /** The plan item (ServiceSlot) the pending update belongs to. */
  planItem: ServiceSlot | null
}>()

const emit = defineEmits<{
  /** Take the source's version — the parent writes `pending.proposed` against `pending.freshSignature`. */
  apply: []
  /** Decline — durable per D-07; the parent records `pending.freshSignature` as declined. */
  dismiss: []
}>()

// Task 3 (T-26-06-04): render is conditional on a pending update AND its plan
// item actually being present, not merely on `open` — so there is no window
// in which this dialog's two actions could fire against a decision that no
// longer exists (another tab resolved it, or the parent's selection moved
// on). The parent additionally self-closes `open` in both cases; this guard
// is the backstop that makes the dialog's own render impossible regardless.
const isVisible = computed(() => props.open && props.pending !== null && props.planItem !== null)

const copy = computed(() => {
  if (!props.pending || !props.planItem) return { heading: '', body: '' }
  return reconciliationConfirmCopy(props.pending, props.planItem)
})

function onApply(): void {
  emit('apply')
}

function onDismiss(): void {
  emit('dismiss')
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.preventDefault()
    onDismiss()
  }
}

// Escape maps to Dismiss — the safe default, matching this application's
// existing Escape-as-cancel convention (e.g. `PresentationViewer`'s
// Escape-to-exit). The listener is bound only while the dialog is actually
// visible and removed both when it closes and on unmount (T-26-06-05) — this
// is a second, independently-teleported surface alongside the Edit Slide
// drawer, so a leaked listener here would fire against the wrong dialog.
watch(
  isVisible,
  (visible) => {
    if (visible) window.addEventListener('keydown', onKeydown)
    else window.removeEventListener('keydown', onKeydown)
  },
  { immediate: true },
)

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
})
</script>
