<template>
  <!-- R424/R426 — the Video output window. Phase 136 is the fullscreen slice
       ONLY: a slide sent here renders full-screen exactly like Audience, via
       the SAME shared render (no fork). Phase 137 adds the Banner mode +
       transparent-default render on top of this same component. -->
  <FullscreenSlideOutput role="video" testid="video" :channel-factory="props.channelFactory" />
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
