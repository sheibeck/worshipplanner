<script setup lang="ts">
// See .planning/codebase/ARCHITECTURE.md (§ Component & Composable Behavioral Notes (R318) -> src/components/run/RunTransportBar.vue)
defineProps<{
  /** Service progress 0–100 (fill width of the progress bar). */
  progress: number
  positionLabel: string
}>()

defineEmits<{
  prev: []
  next: []
}>()
</script>

<template>
  <footer class="run-transport" data-testid="run-transport">
    <!-- Previous / Next slide. -->
    <div class="run-transport__nav">
      <button
        type="button"
        class="run-transport__btn"
        data-testid="run-prev-btn"
        aria-label="Previous slide"
        @click="$emit('prev')"
      >
        ‹ Previous
      </button>
      <button
        type="button"
        class="run-transport__btn run-transport__btn--primary"
        data-testid="run-next-btn"
        aria-label="Next slide"
        @click="$emit('next')"
      >
        Next slide ›
      </button>
    </div>

    <!-- Keyboard legend (Space next, ↑↓ item, B black, Esc exit). -->
    <div class="run-transport__legend">
      <span class="run-transport__hint">
        <kbd class="run-kbd">Space</kbd>
        Next
      </span>
      <span class="run-transport__hint">
        <kbd class="run-kbd">↑ ↓</kbd>
        Item
      </span>
      <span class="run-transport__hint">
        <kbd class="run-kbd">B</kbd>
        Black
      </span>
      <span class="run-transport__hint">
        <kbd class="run-kbd">Esc</kbd>
        Exit
      </span>
    </div>

    <!-- Service progress bar + position label. -->
    <div class="run-transport__progress">
      <div class="run-transport__track" aria-hidden="true">
        <div
          class="run-transport__fill"
          data-testid="run-progress"
          :style="{ width: progress + '%' }"
        ></div>
      </div>
      <span class="run-transport__position" data-testid="run-position-label">
        {{ positionLabel }}
      </span>
    </div>
  </footer>
</template>

<style scoped>
.run-transport {
  /* Nocturne Run-scoped palette — local only. */
  --color-bar-bg: #141624;
  --color-surface: #232532;
  --color-text: #e9e9ed;
  --color-accent: #9184d9;
  --color-neutral-300: #cfd3e5;
  --color-neutral-400: #b2b6ca;
  --color-neutral-600: #75798c;
  --color-neutral-800: #3f424d;
  --color-neutral-900: #292b31;

  height: 54px;
  flex: none;
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 0 20px;
  background: var(--color-bar-bg);
  border-top: 1px solid var(--color-neutral-800);
  color: var(--color-text);
  font-family: Inter, system-ui, sans-serif;
}

.run-transport__nav {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.run-transport__btn {
  min-height: 44px;
  padding: 0 14px;
  background: var(--color-surface);
  border: 1px solid var(--color-neutral-800);
  border-radius: 8px;
  color: var(--color-text);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
}
.run-transport__btn:hover {
  border-color: var(--color-neutral-600);
}
.run-transport__btn--primary {
  background: var(--color-accent);
  border-color: transparent;
  color: #fff;
}
.run-transport__btn--primary:hover {
  filter: brightness(1.08);
}

.run-transport__legend {
  display: inline-flex;
  align-items: center;
  gap: 14px;
  font-size: 11px;
  color: var(--color-neutral-400);
}
.run-transport__hint {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.run-kbd {
  background: var(--color-neutral-900);
  color: var(--color-neutral-300);
  border-radius: 4px;
  padding: 2px 6px;
  font-family: ui-monospace, monospace;
  font-size: 11px;
}

.run-transport__progress {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-width: 200px;
}
.run-transport__track {
  flex: 1;
  height: 6px;
  background: var(--color-neutral-900);
  border-radius: 9999px;
  overflow: hidden;
}
.run-transport__fill {
  height: 100%;
  background: var(--color-accent);
  border-radius: 9999px;
  transition: width 0.2s ease;
}
.run-transport__position {
  font-size: 12px;
  color: var(--color-neutral-400);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
</style>
