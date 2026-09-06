<template>
  <div class="max-w-[1600px] mx-auto px-4 sm:px-6 py-6">
    <div v-if="stageMarkers.length">
      <StageLayoutView :elements="stageMarkers" theme="dark" :print="false" />
    </div>
    <p v-else class="text-gray-500 text-sm">No stage layout has been set up for this service.</p>
  </div>
</template>

<script setup lang="ts">
// Stage Layout tab (R393, 127-UI-SPEC.md §5) — embeds StageLayoutView
// read-only, verbatim (its own default theme is already 'dark') — zero
// marker-position remapping (v2.7 WYSIWYG bug avoidance). Pure data-plumbing:
// props in, no store reads, no Firestore. Fed by the Plan 01 rehearseAccess
// projection's stageLayout?.elements.
import { computed } from 'vue'
import StageLayoutView from '@/components/stage/StageLayoutView.vue'
import type { PublicStageMarker } from '@/stores/services'

const props = defineProps<{
  elements?: PublicStageMarker[]
}>()

const stageMarkers = computed(() => props.elements ?? [])
</script>
