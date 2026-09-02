<script setup lang="ts">
// See .planning/codebase/ARCHITECTURE.md (§ Component & Composable Behavioral Notes (R318) -> src/components/stage/StageKindIcon.vue)
defineProps<{
  /** Glyph name from `stageKindIcon()` / STAGE_KIND_META.icon. */
  name: string
}>()
</script>

<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.7"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <!-- Lead vocal: mic on a stand -->
    <template v-if="name === 'mic-stage'">
      <rect x="9" y="2.5" width="6" height="9" rx="3" />
      <path d="M6.5 10.5a5.5 5.5 0 0 0 11 0" />
      <path d="M12 16v3.5" />
      <path d="M8.5 21.5h7" />
    </template>

    <!-- Vocal / handheld mic -->
    <template v-else-if="name === 'mic'">
      <rect x="9" y="2.5" width="6" height="10" rx="3" />
      <path d="M6.5 11a5.5 5.5 0 0 0 11 0" />
      <path d="M12 16.5v4" />
    </template>

    <!-- Choir / group of people -->
    <template v-else-if="name === 'users'">
      <circle cx="8.5" cy="8" r="2.6" />
      <circle cx="16" cy="8.5" r="2.2" />
      <path d="M3.5 19c0-2.8 2.2-4.6 5-4.6s5 1.8 5 4.6" />
      <path d="M14.5 14.7c2.4.2 4 1.9 4 4.3" />
    </template>

    <!-- Guitar / bass (stringed) -->
    <template v-else-if="name === 'guitar'">
      <path d="M14.5 3.5l3.5 3.5" />
      <path d="M16.2 5.2l2.6-1.4 1.4 1.4-1.4 2.6" />
      <path d="M13 7l-5.3 5.3a4.2 4.2 0 1 0 3 3L16 10" />
      <circle cx="10" cy="14" r="1.6" />
    </template>

    <!-- Keys / piano -->
    <template v-else-if="name === 'piano'">
      <rect x="3.5" y="6" width="17" height="12" rx="1.5" />
      <path d="M8 6v7M12 6v7M16 6v7" />
      <path d="M3.5 13h17" />
    </template>

    <!-- Drums -->
    <template v-else-if="name === 'drum'">
      <ellipse cx="12" cy="9" rx="8" ry="3" />
      <path d="M4 9v5c0 1.7 3.6 3 8 3s8-1.3 8-3V9" />
      <path d="M9 11.5l-4 8M15 11.5l4 8" />
    </template>

    <!-- Orchestra / strings (violin) -->
    <template v-else-if="name === 'strings'">
      <path d="M15.5 2.5l3 3" />
      <path d="M16.8 4.2l1.8-1 1 1-1 1.8" />
      <path d="M14 5.5l-6.4 6.4" />
      <path d="M11.4 9.8a3.6 3.6 0 1 0-2.2 6.1 3.2 3.2 0 0 1-2.9 3.2 3 3 0 1 1-.4-4.6" />
      <path d="M7.6 12.2l3.6 3.6" />
    </template>

    <!-- Generic instrument / music stand -->
    <template v-else-if="name === 'music'">
      <path d="M9 18V5l10-2v13" />
      <circle cx="6.5" cy="18" r="2.5" />
      <circle cx="16.5" cy="16" r="2.5" />
    </template>

    <!-- DI box / power (plug) -->
    <template v-else-if="name === 'plug'">
      <path d="M9 2.5v5M15 2.5v5" />
      <path d="M6.5 7.5h11v3a5.5 5.5 0 0 1-11 0z" />
      <path d="M12 16v5.5" />
    </template>

    <!-- Monitor / amp (speaker) -->
    <template v-else-if="name === 'speaker'">
      <rect x="5" y="2.5" width="14" height="19" rx="2" />
      <circle cx="12" cy="14.5" r="3.7" />
      <circle cx="12" cy="6" r="1.2" />
    </template>

    <!-- Miscellaneous (box) -->
    <template v-else-if="name === 'box'">
      <path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5z" />
      <path d="M3.5 7.5 12 12l8.5-4.5" />
      <path d="M12 12v9" />
    </template>

    <!-- Communion (cup / chalice) -->
    <template v-else-if="name === 'cup'">
      <path d="M6 3.5h12l-1 6a5 5 0 0 1-10 0z" />
      <path d="M12 14.5v4" />
      <path d="M8.5 18.5h7" />
    </template>

    <!-- TV / screen -->
    <template v-else-if="name === 'tv'">
      <rect x="3" y="4" width="18" height="13" rx="2" />
      <path d="M8.5 21h7" />
      <path d="M10 17.5l-.4 3.5M14 17.5l.4 3.5" />
    </template>

    <!-- Power drop (bolt) -->
    <template v-else-if="name === 'bolt'">
      <path d="M13 2.5 4.5 13.5H11l-1 8L19 10.5h-6.5z" />
    </template>

    <!-- Neutral fallback dot -->
    <template v-else>
      <circle cx="12" cy="12" r="4.5" />
    </template>
  </svg>
</template>
