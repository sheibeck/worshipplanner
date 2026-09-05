<template>
  <div class="min-h-screen bg-white text-gray-900 font-sans">
    <!-- Loading state -->
    <div v-if="isLoading" class="flex items-center justify-center min-h-screen">
      <p class="text-gray-500 text-sm">Loading...</p>
    </div>

    <!-- Not found state -->
    <div v-else-if="notFound" class="flex items-center justify-center min-h-screen px-4">
      <div class="text-center">
        <p class="text-gray-700 text-base mb-2">This shared plan is no longer available or the link is invalid.</p>
        <p class="text-gray-400 text-sm">Please ask your worship leader to share the plan again.</p>
      </div>
    </div>

    <!-- Stage-only LANDSCAPE view (?view=stage): deliberately wide (not the
         plan's narrow max-w-2xl column) so the 16:10 room isn't squished into a
         cramped width — modest margins, capped so it's not absurd on ultrawide. -->
    <div v-else-if="serviceSnapshot && isStageView" class="mx-auto max-w-[1600px] px-6 py-8 sm:px-10">
      <div class="mb-6">
        <h1 class="text-xl font-bold text-gray-900">
          Stage Layout <span class="font-normal text-gray-600">— {{ formattedDate }}</span>
        </h1>
      </div>
      <div v-if="stageElements.length">
        <StageLayoutView :elements="stageElements" theme="light" :print="true" />
      </div>
      <p v-else class="text-gray-500 text-sm">No stage layout has been set up for this service.</p>
      <div class="mt-8 pt-4 border-t border-gray-200 text-center text-xs text-gray-400">
        Shared from WorshipPlanner
      </div>
    </div>

    <!-- Service plan content (portrait; stage layout is its own landscape share) -->
    <div v-else-if="serviceSnapshot" class="max-w-2xl mx-auto px-4 py-8 sm:px-6">
      <!-- Header -->
      <div class="mb-6">
        <h1 class="text-xl font-bold text-gray-900">{{ formattedDate }}</h1>
        <p v-if="serviceSnapshot.name" class="text-base text-gray-700 mt-0.5">{{ serviceSnapshot.name }}</p>
        <p class="text-sm text-gray-600 mt-1">{{ teamsDisplay }}</p>
      </div>

      <div class="border-b border-gray-200 mb-4"></div>

      <!-- Slot list -->
      <div>
        <div
          v-for="(slot, index) in serviceSnapshot.slots"
          :key="slot.position + '-' + slot.kind + '-' + index"
          class="py-2.5 border-b border-gray-100"
        >
          <!-- SONG slot -->
          <template v-if="slot.kind === 'SONG'">
            <p class="text-xs text-gray-500 uppercase tracking-wider mb-0.5">{{ slotLabel(slot, index) }}</p>
            <template v-if="slot.songId">
              <p class="text-base font-medium text-gray-900">{{ slot.songTitle }}</p>
              <p class="text-sm text-gray-500">Key: {{ slot.songKey }}</p>
            </template>
            <p v-else class="text-gray-400 italic text-sm">[not assigned]</p>
          </template>

          <!-- SCRIPTURE slot -->
          <template v-else-if="slot.kind === 'SCRIPTURE'">
            <p class="text-xs text-gray-500 uppercase tracking-wider mb-0.5">Scripture Reading</p>
            <template v-if="slot.book && slot.chapter && slot.verseStart && slot.verseEnd">
              <p class="text-base text-gray-900">{{ slot.book }} {{ slot.chapter }}:{{ slot.verseStart }}-{{ slot.verseEnd }}</p>
            </template>
            <p v-else class="text-gray-400 italic text-sm">[not assigned]</p>
          </template>

          <!-- PRAYER slot -->
          <template v-else-if="slot.kind === 'PRAYER'">
            <p class="text-xs text-gray-500 uppercase tracking-wider">Prayer</p>
          </template>

          <!-- MESSAGE slot -->
          <template v-else-if="slot.kind === 'MESSAGE'">
            <p class="text-xs text-gray-500 uppercase tracking-wider mb-0.5">Message</p>
            <p v-if="serviceSnapshot.sermonPassage" class="text-base text-gray-900">
              {{ formatScriptureRef(serviceSnapshot.sermonPassage) }}
            </p>
          </template>

          <!-- ANNOUNCEMENTS slot -->
          <template v-else-if="slot.kind === 'ANNOUNCEMENTS'">
            <p class="text-xs text-gray-500 uppercase tracking-wider mb-0.5">Announcements</p>
          </template>

          <!-- MISC slot -->
          <template v-else-if="slot.kind === 'MISC'">
            <p class="text-xs text-gray-500 uppercase tracking-wider mb-0.5">{{ miscLabel(slot) }}</p>
          </template>

          <!-- HYMN slot -->
          <template v-else-if="slot.kind === 'HYMN'">
            <p class="text-xs text-gray-500 uppercase tracking-wider mb-0.5">Hymn</p>
            <template v-if="slot.hymnName">
              <p class="text-base font-medium text-gray-900">{{ slot.hymnName }}<template v-if="slot.hymnNumber"> #{{ slot.hymnNumber }}</template></p>
              <p v-if="slot.verses" class="text-sm text-gray-500">vv. {{ slot.verses }}</p>
            </template>
            <p v-else class="text-gray-400 italic text-sm">[not assigned]</p>
          </template>

          <!-- R346/SEC-S-04: no per-item free-text (notes/body) render — an
               already-deployed legacy share doc can still carry it, so this is
               a render-side gate, not just a projection fix. -->
        </div>
      </div>

      <!-- R346/SEC-S-04: no service-level Notes section — same legacy-doc gate as above. -->

      <!-- Who's Serving section (names-only role snapshot; omitted for legacy shares with no roleAssignments) -->
      <div v-if="serviceSnapshot.roleAssignments?.length" class="mt-6 rounded-lg bg-gray-50 p-4">
        <h2 class="text-sm font-semibold text-gray-700 mb-2">Who's Serving</h2>
        <div
          v-for="role in serviceSnapshot.roleAssignments"
          :key="role.roleId"
          class="py-1"
        >
          <p class="text-xs text-gray-500 uppercase tracking-wider">{{ role.roleName }}</p>
          <p v-if="role.personNames?.length > 0" class="text-sm text-gray-800">
            {{ role.personNames.join(', ') }}
          </p>
          <p v-else class="text-gray-400 italic text-sm">[not assigned]</p>
        </div>
      </div>

      <!-- The stage layout is NOT on the portrait service-plan share (owner
           2026-09-01) — it has its own landscape "Share stage layout" link
           (?view=stage), rendered by the block above. -->

      <!-- Footer -->
      <div class="mt-8 pt-4 border-t border-gray-200 text-center text-xs text-gray-400">
        Shared from WorshipPlanner
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/firebase'
import { slotLabel, miscLabel } from '@/utils/slotTypes'
import { formatScriptureRef } from '@/utils/planningCenterExport'
import StageLayoutView from '@/components/stage/StageLayoutView.vue'
import type { ScriptureRef } from '@/types/service'
import type { PublicServiceSnapshot } from '@/stores/services'

// Static VW type label lookup (Tailwind v4 purge safety)
const vwTypeLabels: Record<number, string> = {
  1: 'Call to Worship',
  2: 'Intimate',
  3: 'Ascription',
}
// Used in template indirectly via slot data — keep for future use
void vwTypeLabels

// ── State ───────────────────────────────────────────────────────────────────

const route = useRoute()
const isLoading = ref(true)
const notFound = ref(false)
// WR-03 (118-REVIEW): typed (not `any`) so the render-side R346 security gate
// is compiler-enforced — a future `{{ slot.notes }}` or `{{ marker.note }}`
// re-add fails `npm run type-check` instead of silently rendering PII.
const serviceSnapshot = ref<PublicServiceSnapshot | null>(null)

// `?view=stage` renders a LANDSCAPE, stage-only public page (the "Share stage
// layout" link) instead of the portrait service plan — the two are separated,
// mirroring their separate print outputs.
// Optional-chained: a real route always has a `query` object, but some test
// route mocks omit it — never crash the whole share page over a missing query.
const isStageView = computed(() => route.query?.view === 'stage')
const stageElements = computed(() => serviceSnapshot.value?.stageLayout?.elements ?? [])

// ── Computed ────────────────────────────────────────────────────────────────

const formattedDate = computed(() => {
  if (!serviceSnapshot.value?.date) return ''
  // WR-03 (118-REVIEW): now that `serviceSnapshot` is typed (not `any`),
  // `noUncheckedIndexedAccess` sees `date.split('-')` as a variable-length
  // array — the `!`s below assert what was always true at runtime (the app
  // only ever writes a `YYYY-MM-DD` date string here).
  const [year, month, day] = serviceSnapshot.value.date.split('-').map(Number)
  return new Date(year!, month! - 1, day!).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
})

const teamsDisplay = computed(() => {
  if (!serviceSnapshot.value?.teams) return 'Standard Band'
  return serviceSnapshot.value.teams.join(' / ') || 'Standard Band'
})

// ── Mount ───────────────────────────────────────────────────────────────────

onMounted(async () => {
  // A stage-only share should print landscape too; inject the rule for this
  // page only (this component instance renders either the plan OR the stage).
  if (isStageView.value) {
    const style = document.createElement('style')
    style.textContent = '@page { size: landscape; margin: 0.4in; }'
    document.head.appendChild(style)
  }
  const token = route.params.token as string | undefined
  try {
    const snap = token
      ? await getDoc(doc(db, 'shareTokens', token))
      : await getDoc(
          doc(
            db,
            'serviceShares',
            `${route.params.slug as string}__service-${route.params.date as string}`,
          ),
        )
    if (!snap.exists()) {
      notFound.value = true
    } else {
      serviceSnapshot.value = snap.data().serviceSnapshot
    }
  } catch {
    notFound.value = true
  } finally {
    isLoading.value = false
  }
})
</script>
