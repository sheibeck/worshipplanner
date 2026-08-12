<script setup lang="ts">
/**
 * Inline-editable MISC label pill (2026-08-12 owner request). Replaces the
 * separate MISC "label" input added in Phase 56 (R127): the colored badge pill
 * IS the editable surface — click it (or its pencil) to rename a Miscellaneous
 * item directly. Shared by BOTH the live service editor (ServiceEditorView.vue)
 * and the Edit-Template editor (ServiceTemplateEditor.vue) so the two can never
 * drift (the Phase-57 kindBadgeClass lesson).
 *
 * Display shows `modelValue` (trimmed) or the placeholder ("Miscellaneous"),
 * uppercased by the badge's own CSS — the STORED value keeps its real casing.
 * Plain text only: :value/v-model bindings + interpolation auto-escape; never
 * v-html.
 */
import { ref, nextTick } from 'vue'

const props = withDefaults(
  defineProps<{
    /** The custom label, or undefined when unset (shows the placeholder). */
    modelValue?: string
    /** When false, the pill is a static, non-interactive badge. */
    editable: boolean
    /** kindBadgeClass('MISC') output — the on-theme pill tint. */
    badgeClass: string
    /** Shown when no label is set; also the edit input's placeholder. */
    placeholder?: string
    /** testids: `${testidBase}-badge` (display) and `${testidBase}-input` (edit). */
    testidBase: string
  }>(),
  { placeholder: 'Miscellaneous' },
)

const emit = defineEmits<{ 'update:modelValue': [value: string | undefined] }>()

const editing = ref(false)
const draft = ref('')
const inputEl = ref<HTMLInputElement | null>(null)

function displayText(): string {
  return props.modelValue?.trim() || props.placeholder
}

async function startEdit(): Promise<void> {
  if (!props.editable) return
  draft.value = props.modelValue ?? ''
  editing.value = true
  await nextTick()
  inputEl.value?.focus()
  inputEl.value?.select()
}

// Commit is idempotent: Enter closes the input, which fires @blur → a second
// commit that the `!editing` guard turns into a no-op. Empty → undefined so the
// caller's stripUndefined drops the key (no persisted empty label).
function commit(): void {
  if (!editing.value) return
  editing.value = false
  const next = draft.value.trim() || undefined
  if (next !== (props.modelValue ?? undefined)) emit('update:modelValue', next)
}

// Escape: close WITHOUT emitting. Setting editing=false first makes the ensuing
// blur's commit a no-op (guard), so the draft is discarded.
function cancel(): void {
  editing.value = false
}
</script>

<template>
  <input
    v-if="editing"
    ref="inputEl"
    v-model="draft"
    type="text"
    :placeholder="placeholder"
    :data-testid="`${testidBase}-input`"
    class="w-full min-w-[7rem] rounded bg-gray-800 border border-gray-700 text-gray-200 text-xs px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-gray-500"
    @blur="commit"
    @keyup.enter="commit"
    @keyup.esc="cancel"
  />
  <button
    v-else-if="editable"
    type="button"
    class="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider hover:brightness-110 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition"
    :class="badgeClass"
    :data-testid="`${testidBase}-badge`"
    :title="`Rename this item (currently ${displayText()})`"
    :aria-label="`Rename this item, currently ${displayText()}`"
    @click="startEdit"
  >
    <span>{{ displayText() }}</span>
    <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
      <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  </button>
  <span
    v-else
    class="inline-flex items-center rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
    :class="badgeClass"
    :data-testid="`${testidBase}-badge`"
    >{{ displayText() }}</span>
</template>
