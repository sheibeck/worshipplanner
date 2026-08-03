<template>
  <div class="relative" data-testid="slide-action-menu">
    <button
      ref="triggerRef"
      type="button"
      class="p-1 rounded-md text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors"
      :aria-haspopup="'menu'"
      :aria-expanded="open ? 'true' : 'false'"
      aria-label="Slide options"
      :data-testid="`slide-action-trigger-${entryId}`"
      @click.stop="onTriggerClick"
    >
      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
        <circle cx="12" cy="5" r="1.5" />
        <circle cx="12" cy="12" r="1.5" />
        <circle cx="12" cy="19" r="1.5" />
      </svg>
    </button>

    <div v-if="open" class="fixed inset-0 z-10" @click="close" />

    <Transition
      enter-active-class="transition duration-100 ease-out"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition duration-75 ease-in"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div
        v-if="open"
        ref="panelRef"
        role="menu"
        class="absolute right-0 top-full mt-1 w-40 origin-top-right rounded-lg border border-gray-700 bg-gray-800 shadow-xl z-20 overflow-hidden"
        :data-testid="`slide-action-panel-${entryId}`"
        @keydown="onPanelKeydown"
      >
        <button
          v-for="item in items"
          :key="item.key"
          type="button"
          role="menuitem"
          class="block w-full px-3 py-2 text-left text-sm transition-colors hover:bg-gray-700"
          :class="
            item.tone === 'nav'
              ? 'text-indigo-400 hover:text-indigo-300'
              : item.tone === 'destructive'
                ? 'text-red-400 hover:text-red-300'
                : 'text-gray-200'
          "
          :data-testid="`slide-action-item-${item.key}`"
          @click="onItemClick(item)"
        >{{ item.label }}</button>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
/**
 * SlideActionMenu.vue — the codebase's first real ARIA menu (33-UI-SPEC.md
 * § Phase-Specific Component Contracts §2, markup reproduced verbatim from
 * that authoritative source). Presentational and parent-controlled: `open`
 * is owned by the caller (`SlideGrid.vue` tracks a single `openMenuEntryId`),
 * which is what makes "exactly one menu open at a time" enforceable one
 * level up rather than by cross-card coordination. This component renders
 * the list it is given (`items`, produced by `slideActionMenuItems` in
 * `./slideDisplay`) — it never decides what is in it.
 *
 * ARIA contract — no in-repo precedent existed before this component. A
 * whole-repo grep for `role="menu"` / `aria-haspopup` / `role="listbox"`
 * returned zero matches prior to this file. The trigger is a real `<button>`
 * with `aria-haspopup="menu"` and `aria-expanded`; the panel is `role="menu"`
 * with `role="menuitem"` buttons. Escape closes and returns focus to the
 * trigger via the panel's own `@keydown` handler (not a global listener), so
 * it only fires while focus is actually inside the panel.
 *
 * Deliberate, stated gap: no arrow-key roving-tabindex navigation. This
 * matches the codebase's one other dropdown (`ServiceEditorView.vue`'s Add
 * Element menu, which has no ARIA semantics at all) and the already-
 * documented absence of keyboard slide reordering (SortableJS provides
 * none). Tab order falls through native DOM/button order — sufficient, not
 * optimal, and recorded as a decision rather than an oversight.
 *
 * `@click.stop` on the trigger is the exact idiom `SlideCard.vue`'s drag
 * grip already established: the click must never bubble to the card's own
 * select handler, so opening the menu never re-fires selection.
 *
 * WR-03: opening the panel moves focus onto its first `menuitem`. The
 * trigger `<button>` and the `role="menu"` panel `<div>` are DOM siblings,
 * not ancestor/descendant, and nothing previously moved focus into the
 * panel when `open` became `true` — so `onPanelKeydown`'s `Escape` handler
 * (bound to the panel's own `@keydown`) never received the event until the
 * user had separately tabbed focus into the panel. Focusing the first item
 * on open both fixes Escape and matches the WAI-ARIA menu-button pattern's
 * expectation that opening a menu moves focus onto it.
 */
import { ref, nextTick, watch } from 'vue'
import type { MenuItem, MenuItemKey } from './slideDisplay'

const props = defineProps<{
  /** The `GroupSlideEntry.id` this menu belongs to — feeds every data-testid and the toggle emit payload. */
  entryId: string
  /** Pre-computed by the caller via `slideActionMenuItems` — this component renders a list, it does not decide what's in it. */
  items: MenuItem[]
  /** Parent-controlled open state — this component holds none of its own. */
  open: boolean
}>()

const emit = defineEmits<{
  toggle: [entryId: string]
  select: [key: MenuItemKey]
}>()

const triggerRef = ref<HTMLButtonElement | null>(null)
const panelRef = ref<HTMLElement | null>(null)

watch(
  () => props.open,
  async (isOpen) => {
    if (!isOpen) return
    await nextTick()
    panelRef.value?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus()
  },
)

function onTriggerClick(): void {
  emit('toggle', props.entryId)
}

function close(): void {
  emit('toggle', props.entryId)
}

function onItemClick(item: MenuItem): void {
  emit('select', item.key)
}

function onPanelKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Escape') return
  emit('toggle', props.entryId)
  triggerRef.value?.focus()
}
</script>
