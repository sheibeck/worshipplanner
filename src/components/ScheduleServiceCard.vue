<template>
  <!-- 260908-nq5: the card is NO LONGER a whole-surface link — that let real
       Confirm/Decline buttons live in Zone 3 next to a dedicated "Rehearse →"
       link-button. Navigation now happens ONLY by clicking that link. -->
  <div
    data-testid="schedule-card"
    class="flex flex-col sm:flex-row items-stretch gap-4 rounded-xl border p-4 transition-colors"
    :class="cardClass"
  >
    <!-- Zone 1 — Date block (126-UI-SPEC.md §4/§11: a vertical block at sm+,
         a single inline row above a hairline at mobile) -->
    <div class="w-full sm:w-[112px] sm:shrink-0 sm:border-r border-gray-800 sm:pr-4">
      <div class="flex sm:hidden items-center justify-between border-b border-gray-800 pb-2 mb-2">
        <span class="text-xs text-gray-400">
          <span class="font-semibold uppercase text-gray-500">{{ monthLabel }}</span>
          {{ dayNumber }} &middot; {{ weekdayLabel }}
        </span>
        <span v-if="isNextUp" data-testid="next-up-pill" class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-900/50 text-indigo-300 border border-indigo-800">
          Next up
        </span>
      </div>
      <div class="hidden sm:flex flex-col items-center justify-center text-center h-full">
        <span class="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{{ monthLabel }}</span>
        <span class="text-3xl font-mono font-semibold" :class="isNextUp ? 'text-indigo-400' : 'text-gray-100'">{{ dayNumber }}</span>
        <span class="text-xs text-gray-400">{{ weekdayLabel }}</span>
      </div>
    </div>

    <!-- Zone 2 — Middle -->
    <div class="flex-1 min-w-0 flex flex-col gap-1.5">
      <div class="flex items-center gap-2 justify-between">
        <h3 class="text-base font-semibold truncate" :class="isPast ? 'text-gray-500' : 'text-gray-100'">
          {{ title }}
        </h3>
        <span v-if="isNextUp" class="hidden sm:inline-flex shrink-0 items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-900/50 text-indigo-300 border border-indigo-800">
          Next up
        </span>
      </div>

      <!-- Time·venue and call time are omitted entirely — Service has no
           time-of-day/venue field yet (126-UI-SPEC.md Data Dependencies). -->

      <div class="flex flex-wrap items-center gap-1.5 mt-1">
        <span class="text-xs text-gray-500">You're on:</span>
        <span
          v-for="role in roles"
          :key="role"
          class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-800 border border-gray-700 text-xs text-gray-200 max-w-[10rem]"
        >
          <StageKindIcon :name="roleChipIcon(role)" class="h-3.5 w-3.5 text-gray-400 shrink-0" aria-hidden="true" />
          <span class="truncate">{{ role }}</span>
        </span>
      </div>

      <p class="text-xs text-gray-500">
        {{ songCount }} song{{ songCount === 1 ? '' : 's' }} &middot;
        {{ chartCount }} of {{ songCount }} charts &middot;
        {{ trackCount }} track{{ trackCount === 1 ? '' : 's' }}
      </p>

      <div class="flex items-center gap-1.5 text-xs" :class="readinessColorClass">
        <svg v-if="readiness.state === 'ready'" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <svg v-else-if="readiness.state === 'partial'" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
        <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>{{ readinessCopy }}</span>
      </div>
    </div>

    <!-- Zone 3 — Right: countdown, then an actions row with the volunteer's
         Confirm/Decline (slotted by My Schedule) to the LEFT of the real
         Rehearse link-button. -->
    <div class="w-full sm:w-auto sm:shrink-0 flex flex-col sm:items-end justify-center gap-2 sm:text-right mt-3 sm:mt-0 pt-3 sm:pt-0 border-t sm:border-t-0 border-gray-800">
      <span class="text-sm font-medium" :class="isNextUp ? 'text-indigo-300' : 'text-gray-300'">{{ countdown }}</span>
      <div class="flex flex-wrap sm:flex-nowrap items-center gap-2 sm:justify-end">
        <slot name="actions" />
        <router-link
          :to="to"
          :aria-label="ariaLabel"
          data-testid="rehearse-link"
          class="text-center inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium border transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-950"
          :class="ctaClass"
        >
          {{ isPast ? 'Open service' : 'Rehearse →' }}
        </router-link>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import StageKindIcon from '@/components/stage/StageKindIcon.vue'
import { roleChipIcon } from '@/utils/roleChipIcon'
import { countdownLabel, readinessOf } from '@/utils/myScheduleGrouping'
import type { RehearseSong } from '@/utils/rehearseAccess'

const props = defineProps<{
  serviceId: string
  title: string
  serviceDate: string
  songs: RehearseSong[]
  roles: string[]
  isNextUp: boolean
  isPast: boolean
}>()

const to = computed(() => `/volunteer/service/${props.serviceId}`)

// Local-midnight parse, matching ServiceCard.vue's own ymd-string convention
// (src/components/ServiceCard.vue:123-126) — never a date library.
const parsedDate = computed(() => {
  const [y, m, d] = props.serviceDate.split('-').map(Number) as [number, number, number]
  return new Date(y, m - 1, d)
})

const monthLabel = computed(() => parsedDate.value.toLocaleDateString('en-US', { month: 'short' }).toUpperCase())
const dayNumber = computed(() => parsedDate.value.getDate())
const weekdayLabel = computed(() => parsedDate.value.toLocaleDateString('en-US', { weekday: 'short' }))
const fullDateLabel = computed(() => parsedDate.value.toLocaleDateString('en-US', { month: 'long', day: 'numeric' }))

const countdown = computed(() => countdownLabel(props.serviceDate))

// Rule 1 deviation (mirrors myScheduleGrouping.ts's readinessOf fix, 126-02):
// the real SongAttachmentKind values are 'document' (PDF-family) / 'audio'
// (MP3-family) / 'link' — not the UI-SPEC's literal 'pdf'/'mp3' strings,
// which would never match a real attachment.
const songCount = computed(() => props.songs.length)
const chartCount = computed(
  () => props.songs.filter((s) => s.attachments.some((a) => a.kind === 'document')).length,
)
const trackCount = computed(() =>
  props.songs.reduce((sum, s) => sum + s.attachments.filter((a) => a.kind === 'audio').length, 0),
)

const readiness = computed(() => readinessOf(props.songs))

const readinessCopy = computed(() => {
  const r = readiness.value
  if (r.state === 'ready') return 'All rehearsal files ready'
  if (r.state === 'partial') return `${r.missingCount} song${r.missingCount === 1 ? '' : 's'} still missing media`
  return 'Waiting on charts from the leader'
})

// IN-03 (126-REVIEW): 'partial' (text-amber-400) and 'waiting' (previously
// text-amber-300) were a one-shade-of-amber difference most users can't
// perceive, undermining the three-state distinction color coding is meant to
// convey. 'waiting' ("nothing uploaded yet") reads as neutral, not a warning,
// so it gets a distinct gray treatment — distinguishable by color alone, not
// just icon shape.
const readinessColorClass = computed(() => {
  if (readiness.value.state === 'ready') return 'text-green-400'
  if (readiness.value.state === 'partial') return 'text-amber-400'
  return 'text-gray-400'
})

const cardClass = computed(() => {
  // No whole-card hover any more — the card isn't clickable (260908-nq5).
  if (props.isNextUp) return 'border-indigo-500/50 ring-1 ring-indigo-500/10 bg-gray-900'
  if (props.isPast) return 'border-gray-800/60 bg-gray-900/60'
  return 'border-gray-800 bg-gray-900'
})

// Rehearse is now a real bordered link-button in every state (260908-nq5).
const ctaClass = computed(() => {
  if (props.isPast) return 'border-gray-700 text-gray-300 hover:bg-gray-800'
  if (props.isNextUp) return 'border-indigo-500 text-indigo-200 hover:bg-indigo-600/20'
  return 'border-indigo-600 text-indigo-300 hover:bg-indigo-900/30'
})

// A11y: the visible "Rehearse →"/"Open service" text carries no date/context
// on its own in a screen-reader link list — the aria-label on the whole card
// carries it (126-UI-SPEC.md §4).
const ariaLabel = computed(() => {
  const verb = props.isPast ? 'Open service for' : 'Rehearse for'
  return `${verb} ${props.title}, ${fullDateLabel.value}, ${countdown.value.toLowerCase()}`
})
</script>
