<template>
  <div class="flex flex-wrap items-center gap-3" data-testid="contextual-action-bar">
    <template v-for="item in items" :key="item.key">
      <button
        type="button"
        :disabled="item.disabled"
        :title="item.title"
        :data-testid="item.testId ?? `action-bar-item-${item.key}`"
        :class="[BASE_CLASS, toneClass(item.tone)]"
        @click="item.onClick"
      >
        <svg
          v-if="item.icon === 'ai-sparkle'"
          xmlns="http://www.w3.org/2000/svg"
          class="h-4 w-4 text-indigo-400"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            d="M12 2l1.5 4.5L18 8l-4.5 1.5L12 14l-1.5-4.5L6 8l4.5-1.5L12 2zM5 16l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3zM19 15l.75 2.25L22 18l-2.25.75L19 21l-.75-2.25L16 18l2.25-.75L19 15z"
          />
        </svg>
        <svg
          v-else-if="item.icon === 'spinner'"
          class="animate-spin h-4 w-4"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path
            class="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
        <svg
          v-else-if="item.icon === 'check'"
          xmlns="http://www.w3.org/2000/svg"
          class="h-4 w-4 text-green-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="2"
          aria-hidden="true"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        <svg
          v-else-if="item.icon === 'upload'"
          xmlns="http://www.w3.org/2000/svg"
          class="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="2"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
          />
        </svg>
        <span v-else-if="item.icon === 'present'" aria-hidden="true">&#9654;</span>
        <svg
          v-else-if="item.icon === 'print'"
          xmlns="http://www.w3.org/2000/svg"
          class="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="2"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
          />
        </svg>
        <svg
          v-else-if="item.icon === 'share'"
          xmlns="http://www.w3.org/2000/svg"
          class="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="2"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
          />
        </svg>
        {{ item.label }}
      </button>
    </template>
  </div>
</template>

<script setup lang="ts">
/**
 * ContextualActionBar.vue — the one shared action bar (36-02, R068). Owns no
 * state, no store access and no emits: `items` is a fully-computed
 * declarative list (produced by `buildActionBarItems`,
 * `src/views/serviceEditorActionBar.ts`) and every `onClick` is the caller's
 * own handler reference, dispatched verbatim. Matches `SlideActionMenu.vue`'s
 * own "renders a list, does not decide what's in it" precedent (33-UI-SPEC
 * §2) — this component goes one step further and owns no open/closed state
 * either, since a button row has none to own.
 *
 * The empty-list case (`items: []`, e.g. the Roles tab) needs no `v-if` gate:
 * the container carries no border/background/padding/margin — unlike the
 * save-status bar (`SaveStatusIndicator.vue`), which DOES need a gate because
 * its own chrome renders even at idle. An empty `<div class="flex items-center
 * gap-3">` with zero children contributes no visible box.
 *
 * `Save`'s padding normalises here from its old `px-4 py-2` to this bar's
 * declared `px-3 py-2` (36-UI-SPEC § Spacing Scale) — the one relocated
 * control this phase restyles. `＋ Add slide` (`SlideGrid.vue`) is explicitly
 * NOT restyled to match; it stays grid-local with its own pre-existing
 * `px-2.5 py-1.5`, per 36-UI-SPEC § Finding 2 / § Spacing Scale's exceptions
 * note.
 */
import type { ActionBarItem, ActionBarTone } from './actionBarItems'

defineProps<{ items: ActionBarItem[] }>()

const BASE_CLASS =
  'print:hidden inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors border disabled:opacity-50 disabled:cursor-not-allowed'

const TONE_CLASSES: Record<ActionBarTone, string> = {
  primary: 'text-white bg-indigo-600 hover:bg-indigo-500 border-transparent',
  destructive: 'text-red-300 bg-transparent hover:bg-red-950/30 border-red-800',
  default: 'text-gray-200 bg-gray-800 hover:bg-gray-700 border-gray-700',
}

function toneClass(tone?: ActionBarTone): string {
  return TONE_CLASSES[tone ?? 'default']
}
</script>
