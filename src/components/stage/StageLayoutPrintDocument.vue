<script setup lang="ts">
/**
 * The tech team's printable STAGE LAYOUT sheet (quick task 2026-09-01):
 * hidden on screen, shown only when printing, and printed LANDSCAPE + BLACK
 * AND WHITE (see ServiceEditorView.printStageLayout, which injects the
 * `@page { size: landscape }` rule and toggles this doc in over the normal
 * service print). It pairs the high-contrast outline diagram with a large,
 * legible list of every marker grouped by placement, so a tech setting up the
 * stage can read it at a glance. Available whether the service is a draft or
 * locked/planned — printing is read-only.
 *
 * Pure/presentational (props only) — safe to render from the read-only,
 * possibly-locked editor.
 */
import { computed } from 'vue'
import type { Service, StageMarker } from '@/types/service'
import { stageMarkerTypeLabel } from '@/utils/stageLayout'
import StageLayoutView from '@/components/stage/StageLayoutView.vue'

const props = defineProps<{ service: Service }>()

const elements = computed<StageMarker[]>(() => props.service.stageLayout?.elements ?? [])

const formattedDate = computed(() => {
  const [y, m, d] = props.service.date.split('-').map(Number)
  if (!y || !m || !d) return props.service.date
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
})

interface Row {
  id: string
  type: string
  name: string
  note: string
}
function toRows(markers: StageMarker[]): Row[] {
  return markers.map((m) => ({
    id: m.id,
    type: stageMarkerTypeLabel(m) || '—',
    name: m.label || m.personName || '—',
    note: m.note ?? '',
  }))
}
const onstage = computed(() => toRows(elements.value.filter((m) => m.zone === 'onstage')))
const offstage = computed(() => toRows(elements.value.filter((m) => m.zone === 'offstage')))
</script>

<template>
  <div data-testid="stage-print-document" class="hidden bg-white p-6 font-sans text-black print:block">
    <div class="mb-4 border-b-2 border-gray-400 pb-2">
      <h1 class="text-2xl font-bold">
        Stage Layout <span class="font-normal text-gray-600">— {{ formattedDate }}</span>
      </h1>
    </div>

    <div v-if="elements.length === 0" class="text-base">No stage layout has been set up for this service.</div>

    <div v-else class="flex flex-col gap-5">
      <!-- Diagram: outline, black-and-white, larger labels -->
      <StageLayoutView :elements="elements" theme="light" :print="true" />

      <!-- Legible list grouped by placement -->
      <div class="grid grid-cols-2 gap-6 break-inside-avoid">
        <div>
          <h2 class="mb-1 border-b border-gray-400 text-base font-bold uppercase tracking-wide">On stage</h2>
          <p v-if="onstage.length === 0" class="text-sm italic">Nothing on the platform.</p>
          <ul v-else class="divide-y divide-gray-300">
            <li v-for="row in onstage" :key="row.id" class="py-1.5 text-[13px] leading-snug">
              <span class="font-semibold">{{ row.type }}</span>
              <span> — {{ row.name }}</span>
              <span v-if="row.note" class="block text-[12px] italic">{{ row.note }}</span>
            </li>
          </ul>
        </div>
        <div>
          <h2 class="mb-1 border-b border-gray-400 text-base font-bold uppercase tracking-wide">Off stage</h2>
          <p v-if="offstage.length === 0" class="text-sm italic">Nothing off the platform.</p>
          <ul v-else class="divide-y divide-gray-300">
            <li v-for="row in offstage" :key="row.id" class="py-1.5 text-[13px] leading-snug">
              <span class="font-semibold">{{ row.type }}</span>
              <span> — {{ row.name }}</span>
              <span v-if="row.note" class="block text-[12px] italic">{{ row.note }}</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>
