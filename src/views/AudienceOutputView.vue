<template>
  <!-- R426 — thin wrapper delegating the entire fullscreen render + lifecycle to
       the shared FullscreenSlideOutput (extracted here in Phase 136 Plan 02) so
       Audience and Video share ONE render definition. The DOM this produces is
       byte-identical to the pre-extraction render: FullscreenSlideOutput renders
       its own root as this component's root, so `audience-output`/
       `audience-stage`/`audience-blackout`/`audience-reenter-fullscreen` and the
       whole existing test suite resolve unchanged. -->
  <FullscreenSlideOutput role="audience" testid="audience" :channel-factory="props.channelFactory" />
</template>

<script setup lang="ts">
import type { BroadcastChannelFactory } from '@/utils/runChannel'
import FullscreenSlideOutput from '@/components/output/FullscreenSlideOutput.vue'

/**
 * Testability seam (93-PATTERNS §4): the run-channel factory is injectable so
 * tests can drive `onState` deterministically with an in-memory fake. Production
 * passes nothing and `openRunChannel` uses the native BroadcastChannel. Forwarded
 * straight through to FullscreenSlideOutput.
 */
const props = defineProps<{
  channelFactory?: BroadcastChannelFactory
}>()
</script>
