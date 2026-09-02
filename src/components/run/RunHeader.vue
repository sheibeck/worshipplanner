<script setup lang="ts">
// See .planning/codebase/ARCHITECTURE.md (§ Component & Composable Behavioral Notes (R318) -> src/components/run/RunHeader.vue)
import { computed } from 'vue'

const props = defineProps<{
  serviceHeading: string
  live: boolean
  rehearsing: boolean
  positionLabel: string
  clock: string
  elapsed: string
  audienceOpen: boolean
  confidenceOpen: boolean
  blackout: boolean
}>()

// Owner fix #7: green ONLY on a real go-live (live && !rehearsing).
const trulyLive = computed(() => props.live && !props.rehearsing)

const emit = defineEmits<{
  exit: []
  reopen: [role: 'audience' | 'confidence']
  // Owner UAT: the blackout toggle asks the parent (single writer) to flip the
  // projector-black state — the parent calls postBlackout(!blackout).
  'toggle-blackout': []
}>()

/** See ADR-0099 (docs/adr/0099-a-display-dot-is-a-reopen-affordance-only-when-it-represents.md) */
const audienceReopenable = computed(() => props.live && !props.audienceOpen)
const confidenceReopenable = computed(() => props.live && !props.confidenceOpen)

function onReopen(role: 'audience' | 'confidence') {
  const reopenable = role === 'audience' ? audienceReopenable.value : confidenceReopenable.value
  if (!reopenable) return // passive pre-live / already-open dot — never emit reopen
  emit('reopen', role)
}
</script>

<template>
  <header class="run-header" data-testid="run-header">
    <!-- LIVE status — three honest states (owner fix #4 + #7): green "Live" on a
         real go-live, YELLOW "Rehearsing" during a rehearsal, muted "Not open"
         before. Green (run-status--live) means the outputs are genuinely live. -->
    <span
      class="run-status"
      :class="
        trulyLive
          ? 'run-status--live'
          : rehearsing
            ? 'run-status--rehearsing'
            : 'run-status--idle'
      "
      data-testid="run-live-status"
      role="status"
    >
      <span class="run-status__dot" aria-hidden="true"></span>
      {{ trulyLive ? 'Live' : rehearsing ? 'Rehearsing' : 'Not open' }}
    </span>

    <!-- Service heading + position — run-service-name preserved for the control suite. -->
    <h1 class="run-header__title" data-testid="run-service-name">
      {{ serviceHeading }}
    </h1>
    <span class="run-header__position" data-testid="run-position">{{ positionLabel }}</span>

    <!-- Clock + elapsed timers (from useRunTimers, passed by the parent). -->
    <span class="run-header__timers">
      <span class="run-header__clock" data-testid="run-clock">{{ clock }}</span>
      <span class="run-header__sep" aria-hidden="true">·</span>
      <span class="run-header__elapsed" data-testid="run-elapsed">{{ elapsed }}</span>
    </span>

    <!-- Displays cluster: audience + confidence dots (green when open, amber/muted
         otherwise) that reopen their display on click. -->
    <div class="run-displays">
      <button
        type="button"
        class="run-display"
        :class="[
          audienceOpen ? 'run-display--open' : 'run-display--closed',
          audienceReopenable ? '' : 'run-display--static',
        ]"
        data-testid="run-display-dot-audience"
        :disabled="!audienceReopenable"
        :aria-label="
          audienceOpen
            ? 'Audience display open'
            : audienceReopenable
              ? 'Audience display not open — reopen'
              : 'Audience display not open'
        "
        @click="onReopen('audience')"
      >
        <span class="run-display__dot" aria-hidden="true"></span>
        Audience
      </button>
      <button
        type="button"
        class="run-display"
        :class="[
          confidenceOpen ? 'run-display--open' : 'run-display--closed',
          confidenceReopenable ? '' : 'run-display--static',
        ]"
        data-testid="run-display-dot-confidence"
        :disabled="!confidenceReopenable"
        :aria-label="
          confidenceOpen
            ? 'Confidence display open'
            : confidenceReopenable
              ? 'Confidence display not open — reopen'
              : 'Confidence display not open'
        "
        @click="onReopen('confidence')"
      >
        <span class="run-display__dot" aria-hidden="true"></span>
        Confidence
      </button>
    </div>

    <!-- BLACKOUT TOGGLE (owner UAT) — a single live-ops control replacing the old
         Black/Clear output panel. Shown ONLY when truly live (live && !rehearsing):
         a rehearsal opens no output windows, so there is nothing to black out. When
         NOT blacked out it reads "Go to black"; while blacked out it reads "Clear
         black" and shows an active (filled/ring) state so the operator sees at a
         glance that the projector is black. Emits toggle-blackout; the parent (single
         writer) flips it via postBlackout(!blackout). The `B` key toggles the same
         state via useRunControl.handleKeydown. -->
    <button
      v-if="trulyLive"
      type="button"
      class="run-blackout"
      :class="{ 'run-blackout--active': blackout }"
      data-testid="run-blackout-toggle"
      :aria-pressed="blackout ? 'true' : 'false'"
      :aria-label="
        blackout
          ? 'Clear black — restore the projector output'
          : 'Go to black — blank the projector output'
      "
      @click="$emit('toggle-blackout')"
    >
      {{ blackout ? 'Clear black' : 'Go to black' }}
    </button>

    <!-- End service / End rehearsal — run-exit-btn preserved so the existing exit
         assertions match; owner fix #7 relabels it while rehearsing. -->
    <button
      type="button"
      class="run-exit"
      data-testid="run-exit-btn"
      :aria-label="rehearsing ? 'End Rehearsal (Esc)' : 'End Service (Esc)'"
      @click="$emit('exit')"
    >
      {{ rehearsing ? 'End Rehearsal' : 'End Service' }}
    </button>
  </header>
</template>

<style scoped>
.run-header {
  /* Nocturne Run-scoped palette — local only, never app-wide. */
  --color-header-bg: #1a1c2b;
  --color-surface: #232532;
  --color-text: #e9e9ed;
  --color-neutral-400: #b2b6ca;
  --color-neutral-600: #75798c;
  --color-neutral-800: #3f424d;
  --color-ok: #6fbf8b;
  --color-amber: #e0b23c;

  height: 58px;
  flex: none;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 0 20px;
  background: var(--color-header-bg);
  border-bottom: 1px solid var(--color-neutral-800);
  color: var(--color-text);
  font-family: Inter, system-ui, sans-serif;
}

/* LIVE status pill — colorblind-safe dot + word. */
.run-status {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.run-status__dot {
  height: 8px;
  width: 8px;
  flex: none;
  border-radius: 9999px;
}
.run-status--live {
  color: var(--color-ok);
  background: rgba(111, 191, 139, 0.12);
  border: 1px solid rgba(111, 191, 139, 0.4);
}
.run-status--live .run-status__dot {
  background: var(--color-ok);
}
.run-status--idle {
  color: var(--color-amber);
  background: rgba(224, 178, 60, 0.1);
  border: 1px solid rgba(224, 178, 60, 0.32);
}
.run-status--idle .run-status__dot {
  background: var(--color-amber);
}
/* Rehearsing (owner fix #7): YELLOW/amber — visually distinct from green "Live". */
.run-status--rehearsing {
  color: var(--color-amber);
  background: rgba(224, 178, 60, 0.14);
  border: 1px solid rgba(224, 178, 60, 0.45);
}
.run-status--rehearsing .run-status__dot {
  background: var(--color-amber);
}

.run-header__title {
  font-size: 18px;
  font-weight: 600;
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 22ch;
  margin: 0;
}
.run-header__position {
  font-size: 12px;
  color: var(--color-neutral-400);
  white-space: nowrap;
}

.run-header__timers {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--color-neutral-400);
  font-variant-numeric: tabular-nums;
}
.run-header__clock {
  color: var(--color-text);
}
.run-header__sep {
  color: var(--color-neutral-600);
}

.run-displays {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 12px;
}
.run-display {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 44px;
  padding: 0 8px;
  background: transparent;
  border: 0;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
}
.run-display__dot {
  height: 8px;
  width: 8px;
  flex: none;
  border-radius: 9999px;
}
.run-display--open {
  color: var(--color-ok);
}
.run-display--open .run-display__dot {
  background: var(--color-ok);
}
.run-display--closed {
  color: var(--color-amber);
}
.run-display--closed .run-display__dot {
  background: var(--color-amber);
}
.run-display:hover:not(:disabled) {
  background: var(--color-surface);
}
/* Passive status indicator (pre-live or already-open): no reopen affordance. */
.run-display--static {
  cursor: default;
}

/* Blackout toggle — a live-ops control. Neutral when the projector is showing,
   and a visible FILLED/ring active state while blacked out so the operator can
   tell at a glance the screens are black. */
.run-blackout {
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
.run-blackout:hover {
  border-color: var(--color-neutral-600);
}
.run-blackout--active {
  background: #000;
  color: #fff;
  border-color: rgba(255, 255, 255, 0.5);
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.35);
}

.run-exit {
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
.run-exit:hover {
  border-color: var(--color-neutral-600);
}
</style>
