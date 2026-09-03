<script setup lang="ts">
// See .planning/codebase/CONCERNS.md (§ Component & Composable Concern Notes (R318) -> src/components/run/RunDisplaysPanel.vue)
// 114-03: replaced the fixed audience/confidence prop pair with a `displays`
// v-for (one row per SAVED assignment, any count/role mix) so multiple
// Audience monitors each get their own row; reopen/fullscreen now emit the
// display id (fingerprint), not a role.
import { computed } from 'vue'

interface DisplayItem {
  id: string
  role: 'audience' | 'confidence'
  label: string
  open: boolean
  closed: boolean
  fullscreen: boolean
}

type CardState = 'open' | 'closed' | 'closed-muted' | 'not-open'

const props = defineProps<{
  displays: DisplayItem[]
  live: boolean
  reassigning: boolean
}>()

const emit = defineEmits<{
  reopen: [id: string]
  fullscreen: [id: string]
  manage: []
}>()

function roleTitle(role: 'audience' | 'confidence'): string {
  return role === 'audience' ? 'Audience' : 'Confidence'
}

function cardState(display: DisplayItem): CardState {
  // A monitor unplug (reassigning) takes precedence over the per-role reopen chip:
  // a closed output falls to the muted "reassign" indicator, never a reopen button.
  if (display.closed && props.reassigning) return 'closed-muted'
  if (display.closed) return 'closed'
  // GREEN only once truly live AND the output is open (owner fix #4 honesty).
  if (props.live && display.open) return 'open'
  return 'not-open'
}

interface Row {
  id: string
  title: string
  testidSuffix: string
  label: string
  state: CardState
  fullscreen: boolean
}

/**
 * The FIRST assignment of a role keeps the plain role testid/title
 * (`run-display-audience`, "Audience") so the common single-Audience/
 * single-Confidence setup is unchanged; a second (or later) assignment
 * sharing a role gets a numbered suffix ("Audience 2", `run-display-audience-2`)
 * so multiple Audience monitors never collide.
 */
const rows = computed<Row[]>(() => {
  const seen: Record<string, number> = {}
  return props.displays.map((d) => {
    const n = (seen[d.role] = (seen[d.role] ?? 0) + 1)
    return {
      id: d.id,
      title: n === 1 ? roleTitle(d.role) : `${roleTitle(d.role)} ${n}`,
      testidSuffix: n === 1 ? d.role : `${d.role}-${n}`,
      label: d.label,
      state: cardState(d),
      fullscreen: d.fullscreen,
    }
  })
})
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
      <!-- One row per saved assignment (114-03) — any count/role mix. -->
      <div
        v-for="row in rows"
        :key="row.id"
        :data-testid="`run-display-${row.testidSuffix}`"
        class="flex items-start gap-3 rounded-md bg-white/5 border border-white/10 px-3 py-2.5"
      >
        <span
          class="mt-1 h-2.5 w-2.5 flex-none rounded-full"
          :class="row.state === 'open' ? 'bg-green-400' : 'bg-amber-400'"
          aria-hidden="true"
        ></span>
        <div class="min-w-0 flex-1">
          <p class="text-sm font-medium text-gray-100">{{ row.title }}</p>

          <!-- CLOSED (recovery): amber "… display closed" + a reassurance note. -->
          <template v-if="row.state === 'closed'">
            <p :data-testid="`run-display-closed-${row.testidSuffix}`" class="text-xs text-amber-200">
              {{ row.title }} display closed
            </p>
            <p class="text-xs text-amber-200/80">
              You won't lose your place — reopening returns to the current slide.
            </p>
          </template>

          <!-- CLOSED but a reassign is up: muted indicator, NO reopen chip (precedence). -->
          <p
            v-else-if="row.state === 'closed-muted'"
            :data-testid="`run-display-closed-${row.testidSuffix}-muted`"
            class="text-xs text-amber-200/80"
          >
            Reassign displays to reopen
          </p>

          <!-- OPEN (green): the assigned display label (nickname-or-fallback, R338). -->
          <p
            v-else-if="row.state === 'open'"
            :data-testid="`run-display-ready-${row.testidSuffix}`"
            class="text-xs text-gray-400 truncate"
          >
            {{ row.label }}
          </p>

          <!-- NOT OPEN: honest amber, never an alarming red. -->
          <p v-else class="text-xs text-gray-400">Not open</p>
        </div>

        <!-- The R274 one-click reopen — shown ONLY for a genuinely closed output that
             is not superseded by a reassign (which owns recovery via its banner). -->
        <button
          v-if="row.state === 'closed'"
          type="button"
          :data-testid="`run-display-reopen-${row.testidSuffix}`"
          :aria-label="`Reopen the ${row.title} display on its screen`"
          class="min-h-9 flex-none rounded-md bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 text-xs font-medium text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          @click="emit('reopen', row.id)"
        >
          Reopen
        </button>

        <!-- Per-display fullscreen (owner UAT): one click here sends THIS display
             fullscreen. Every display's button lives in this panel, so the operator
             never chases the mouse across monitors that may not even be visible.
             Shown only while the output is open (you can't fullscreen a closed
             window). Reliable: the click's gesture is delegated to the already-open
             window. Scales to any number of outputs. The button reflects REAL
             fullscreen state (reported by the output): once the display is
             fullscreen it shows a done ✓, and it flips BACK to the action the
             instant someone presses Escape out of fullscreen. -->
        <button
          v-if="row.state === 'open' && !row.fullscreen"
          type="button"
          :data-testid="`run-display-fullscreen-${row.testidSuffix}`"
          :aria-label="`Make the ${row.title} display fullscreen`"
          class="min-h-9 flex-none rounded-md bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 text-xs font-medium text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          @click="emit('fullscreen', row.id)"
        >
          Go fullscreen
        </button>
        <span
          v-else-if="row.state === 'open' && row.fullscreen"
          :data-testid="`run-display-fullscreen-done-${row.testidSuffix}`"
          class="inline-flex items-center gap-1 min-h-9 flex-none rounded-md bg-green-500/15 px-3 py-1.5 text-xs font-medium text-green-300"
        >
          <span class="h-1.5 w-1.5 rounded-full bg-green-400" aria-hidden="true"></span>
          Fullscreen
        </span>
      </div>

    </div>
  </section>
</template>
