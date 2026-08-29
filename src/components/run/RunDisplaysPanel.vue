<script setup lang="ts">
/**
 * RunDisplaysPanel — the additive Displays panel (R276, State C), PURE
 * presentation. It renders the NEW per-output cards (Audience / Confidence /
 * Stage-off) reachable from the header "Manage" affordance: each real output
 * shows a colorblind-safe dot+word status and a Reopen action; Stage is a
 * DISABLED "Off" placeholder only (no 3rd-output build — 97-CONTEXT out-of-scope).
 *
 * It does NOT own the Phase 96 recovery machinery — the tested recovery banners
 * and rows (the closed-output / reopen / reassign / fallback / blocked / partial
 * testids) stay INLINE in the redesigned parent (97-09) with their exact testids
 * so RunControlView.output.test.ts stays green. This panel is additive only.
 *
 * Pure props-in/emits-out: no store, channel, getScreenDetails, or monitorConfig
 * side-effect. The parent supplies each card's open/label + the live flag and
 * maps @reopen(role) / @manage back onto its own reopen/manage handlers.
 *
 * Per 97-UI-SPEC owner fix #4, dots are GREEN only once live AND the output is
 * open; pre-live they read muted/amber "Not open" (never an alarming red).
 */

interface OutputCard {
  open: boolean
  label: string
}

const props = defineProps<{
  audience: OutputCard
  confidence: OutputCard
  live: boolean
}>()

const emit = defineEmits<{
  reopen: [role: 'audience' | 'confidence']
  manage: []
}>()

function isGreen(card: OutputCard): boolean {
  return props.live && card.open
}
</script>

<template>
  <section
    data-testid="run-displays-panel"
    class="rounded-lg bg-[#141624] border border-white/10 p-4 text-gray-100"
  >
    <header class="flex items-center justify-between mb-3">
      <h3 class="text-sm font-semibold text-gray-100">Displays</h3>
      <button
        type="button"
        data-testid="run-displays-manage"
        class="min-h-9 rounded-md px-3 py-1.5 text-xs font-medium text-indigo-300 hover:text-indigo-200 hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        @click="emit('manage')"
      >
        Manage
      </button>
    </header>

    <div class="space-y-2">
      <!-- AUDIENCE card -->
      <div
        data-testid="run-display-audience"
        class="flex items-center gap-3 rounded-md bg-white/5 border border-white/10 px-3 py-2.5"
      >
        <span
          class="h-2.5 w-2.5 flex-none rounded-full"
          :class="isGreen(audience) ? 'bg-green-400' : 'bg-amber-400'"
          aria-hidden="true"
        ></span>
        <div class="min-w-0 flex-1">
          <p class="text-sm font-medium text-gray-100">Audience</p>
          <p class="text-xs text-gray-400 truncate">
            {{ isGreen(audience) ? audience.label : audience.open ? audience.label : 'Not open' }}
          </p>
        </div>
        <button
          type="button"
          data-testid="run-display-reopen-audience"
          class="min-h-9 flex-none rounded-md bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 text-xs font-medium text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          @click="emit('reopen', 'audience')"
        >
          Reopen
        </button>
      </div>

      <!-- CONFIDENCE card -->
      <div
        data-testid="run-display-confidence"
        class="flex items-center gap-3 rounded-md bg-white/5 border border-white/10 px-3 py-2.5"
      >
        <span
          class="h-2.5 w-2.5 flex-none rounded-full"
          :class="isGreen(confidence) ? 'bg-green-400' : 'bg-amber-400'"
          aria-hidden="true"
        ></span>
        <div class="min-w-0 flex-1">
          <p class="text-sm font-medium text-gray-100">Confidence</p>
          <p class="text-xs text-gray-400 truncate">
            {{ isGreen(confidence) ? confidence.label : confidence.open ? confidence.label : 'Not open' }}
          </p>
        </div>
        <button
          type="button"
          data-testid="run-display-reopen-confidence"
          class="min-h-9 flex-none rounded-md bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 text-xs font-medium text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          @click="emit('reopen', 'confidence')"
        >
          Reopen
        </button>
      </div>

      <!-- STAGE: disabled 'Off' placeholder only — no 3rd output built. -->
      <div
        data-testid="run-display-stage-off"
        aria-disabled="true"
        class="flex items-center gap-3 rounded-md bg-white/[0.02] border border-white/5 px-3 py-2.5 opacity-60 cursor-default"
      >
        <span class="h-2.5 w-2.5 flex-none rounded-full bg-gray-600" aria-hidden="true"></span>
        <div class="min-w-0 flex-1">
          <p class="text-sm font-medium text-gray-400">Stage</p>
          <p class="text-xs text-gray-500">Off</p>
        </div>
      </div>
    </div>
  </section>
</template>
