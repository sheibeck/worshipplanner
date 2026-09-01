<script setup lang="ts">
/**
 * Per-item Run auto-advance / LOOP authoring control (R306/R307, Phase 106).
 *
 * Relocated (owner 2026-09-01) out of the Service Order slot rows into the
 * Slide editor: loop is a presentation concern, never a plan concern, and it
 * must NEVER apply to Song items — so it is only ever rendered in `SlideGrid`
 * for a MISC or ANNOUNCEMENTS plan item (that gate lives in SlideGrid, not
 * here). This component owns the whole checkbox / preset / custom-seconds UI
 * and its logic, and emits ONE `change` with the resulting loop object; the
 * parent chain (SlideGrid → SlidesTab → ServiceEditorView) persists it onto
 * `slot.loop` through the existing autosave path — no new save call, no rules
 * surface. `enabled: false` (not an absent object) is the "off" state, exactly
 * as the field's own contract defines.
 */
import { ref, computed, watch } from 'vue'
import type { ServiceSlot } from '@/types/service'

type SlotLoop = NonNullable<ServiceSlot['loop']>

const props = defineProps<{
  slot: ServiceSlot
  editable: boolean
}>()

const emit = defineEmits<{ change: [loop: SlotLoop] }>()

const PRESETS = [5, 10, 15, 20, 30, 60] as const

const enabled = computed(() => props.slot.loop?.enabled ?? false)
const intervalSeconds = computed(() => props.slot.loop?.intervalSeconds ?? 10)

// UI-only: honours an explicit "Custom…" pick even while the current interval
// still equals a preset (checking Loop defaults to 10s, a preset). Reset when
// the selected slot changes so a stale override can't leak between items.
const explicitCustom = ref(false)
watch(() => props.slot.id, () => { explicitCustom.value = false })

const preset = computed(() =>
  explicitCustom.value ? 'custom' : (PRESETS as readonly number[]).includes(intervalSeconds.value) ? String(intervalSeconds.value) : 'custom',
)

function onToggle(checked: boolean) {
  if (!props.editable) return
  if (checked) {
    emit('change', { enabled: true, intervalSeconds: props.slot.loop?.intervalSeconds ?? 10 })
  } else {
    explicitCustom.value = false
    emit('change', { enabled: false, intervalSeconds: props.slot.loop?.intervalSeconds ?? 10 })
  }
}

function onPresetChange(value: string) {
  if (!props.editable) return
  if (value === 'custom') {
    explicitCustom.value = true
    emit('change', { enabled: true, intervalSeconds: intervalSeconds.value })
    return
  }
  explicitCustom.value = false
  const parsed = Number(value)
  if (!Number.isNaN(parsed)) emit('change', { enabled: true, intervalSeconds: parsed })
}

/** Silent-normalize: non-numeric/empty/out-of-range clamps to 1–3600 on blur. */
function onCustomBlur(raw: string) {
  if (!props.editable) return
  const parsed = Number(raw)
  const fallback = props.slot.loop?.intervalSeconds ?? 10
  const base = raw.trim() !== '' && Number.isFinite(parsed) ? parsed : fallback
  emit('change', { enabled: true, intervalSeconds: Math.min(3600, Math.max(1, Math.round(base))) })
}
</script>

<template>
  <!-- Styled to match the panel's "+ Add music / + Add background" item
       controls: a gray-bordered pill at the same px-2.5 py-1.5 / text-xs scale,
       tinted indigo when Loop is on to read as an active state. -->
  <div class="flex flex-wrap items-center gap-2" data-testid="slot-loop-row">
    <label
      class="inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors"
      :class="enabled ? 'border-indigo-600 bg-indigo-950/40 text-indigo-200 hover:bg-indigo-950/60' : 'border-gray-700 text-gray-300 hover:bg-gray-800'"
    >
      <input
        type="checkbox"
        :checked="enabled"
        :disabled="!editable"
        class="h-3.5 w-3.5 rounded border-gray-600 bg-gray-800 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-gray-900"
        data-testid="slot-loop-checkbox"
        @change="onToggle(($event.target as HTMLInputElement).checked)"
      />
      Loop
    </label>

    <template v-if="enabled">
      <span class="text-xs text-gray-400">Every</span>
      <select
        :value="preset"
        :disabled="!editable"
        class="rounded-md border border-gray-700 bg-gray-800 px-2 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:bg-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        data-testid="slot-loop-preset"
        aria-label="Loop interval"
        @change="onPresetChange(($event.target as HTMLSelectElement).value)"
      >
        <option value="5">5s</option>
        <option value="10">10s</option>
        <option value="15">15s</option>
        <option value="20">20s</option>
        <option value="30">30s</option>
        <option value="60">60s</option>
        <option value="custom">Custom…</option>
      </select>

      <input
        v-if="preset === 'custom'"
        type="number"
        min="1"
        max="3600"
        step="1"
        :value="intervalSeconds"
        :disabled="!editable"
        placeholder="Seconds"
        class="w-20 rounded-md border border-gray-700 bg-gray-800 px-2 py-1.5 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        data-testid="slot-loop-custom-seconds"
        aria-label="Custom loop interval in seconds"
        title="Enter 1–3600 seconds"
        @blur="onCustomBlur(($event.target as HTMLInputElement).value)"
      />
    </template>
  </div>
</template>
