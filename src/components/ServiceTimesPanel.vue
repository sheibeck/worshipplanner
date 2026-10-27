<script setup lang="ts">
// Times tab panel. See ADR-0245 (docs/adr/0245-rehearsals-are-always-dated-defaults-prefill-the-add-form.md)
// and .planning/codebase/ARCHITECTURE.md (Component & Composable Behavioral Notes (R318) -> src/components/ServiceTimesPanel.vue).
import { computed, nextTick, onBeforeUnmount, ref } from 'vue'
import {
  formatRehearsalDateShort,
  formatWallClockTime,
  HM_RE,
  isDisplayableRehearsal,
  sortRehearsals,
  YMD_RE,
  type Rehearsal,
} from '@/utils/rehearsalTimes'

const props = withDefaults(
  defineProps<{
    rehearsals?: Rehearsal[]
    reportTime?: string
    serviceDate?: string
    canEdit: boolean
    defaultTimes?: string[]
  }>(),
  { rehearsals: () => [], reportTime: '', serviceDate: '', defaultTimes: () => [] },
)

const emit = defineEmits<{
  add: [payload: { date: string; time: string }]
  remove: [id: string]
  'date-change': [payload: { id: string; date: string }]
  'time-change': [payload: { id: string; time: string }]
  'report-time-change': [time: string]
}>()

const REVERT_MS = 4000

const inputBase =
  'bg-gray-800 text-gray-100 rounded-md px-2 py-1.5 text-sm border focus:outline-none focus:ring-1 w-full sm:w-auto'
const inputOk = 'border-gray-700 focus:ring-indigo-500'
const inputMissing = 'border-amber-700 focus:ring-amber-500'

function inputClass(value: string): string {
  return `${inputBase} ${value === '' ? inputMissing : inputOk}`
}

// Legacy (non-displayable) rows first in stored order so they are seen; dated rows follow in
// sortRehearsals order. Local partition keeps the shared sortRehearsals (undated-last) untouched.
const rows = computed<Rehearsal[]>(() => {
  const legacy = props.rehearsals.filter((r) => !isDisplayableRehearsal(r))
  const dated = sortRehearsals(props.rehearsals.filter(isDisplayableRehearsal))
  return [...legacy, ...dated]
})

const readOnlyRows = computed<Rehearsal[]>(() =>
  sortRehearsals(props.rehearsals.filter(isDisplayableRehearsal)),
)

const reportTimeHelper = computed(() => {
  const short = formatRehearsalDateShort(props.serviceDate)
  return short ? `Day-of call time on ${short}` : 'Day-of call time'
})

// Add form. The time follows defaultTimes[0] until the planner types or picks a chip.
const newDate = ref('')
const newTimeOverride = ref<string | null>(null)
const newTime = computed<string>({
  get: () => newTimeOverride.value ?? props.defaultTimes[0] ?? '',
  set: (v) => {
    newTimeOverride.value = v
  },
})
// Duplicate org defaults would collide as :key and double-press a chip.
const chipTimes = computed(() => [...new Set(props.defaultTimes)])
const canAdd = computed(() => props.canEdit && YMD_RE.test(newDate.value) && HM_RE.test(newTime.value))
const newDateInput = ref<HTMLInputElement | null>(null)

function focusAddDate(): void {
  void nextTick(() => newDateInput.value?.focus())
}

function onSubmitAdd(): void {
  if (!canAdd.value) return
  emit('add', { date: newDate.value, time: newTime.value })
  newDate.value = ''
  newTimeOverride.value = null
  focusAddDate()
}

// Reject-clear: an unchanged one-way binding is not repainted by Vue, so the DOM value is forced back.
const revert = ref<{ id: string; field: 'date' | 'time'; invalid: boolean } | null>(null)
let revertTimer: ReturnType<typeof setTimeout> | null = null

function clearRevert(): void {
  if (revertTimer !== null) clearTimeout(revertTimer)
  revertTimer = null
  revert.value = null
}

function showRevert(id: string, field: 'date' | 'time', invalid = false): void {
  clearRevert()
  revert.value = { id, field, invalid }
  revertTimer = setTimeout(() => {
    revert.value = null
    revertTimer = null
  }, REVERT_MS)
}

function onFieldChange(row: Rehearsal, field: 'date' | 'time', event: Event): void {
  const el = event.target as HTMLInputElement
  const current = row[field]
  const next = el.value
  if (current !== '' && next === '') {
    el.value = current
    showRevert(row.id, field)
    return
  }
  if (current === '' && next === '') return
  // A malformed value (e.g. a 5-digit year) would be dropped by the parent guard and leave the DOM out of sync.
  if (!(field === 'date' ? YMD_RE : HM_RE).test(next)) {
    el.value = current
    showRevert(row.id, field, true)
    return
  }
  clearRevert()
  if (field === 'date') emit('date-change', { id: row.id, date: next })
  else emit('time-change', { id: row.id, time: next })
}

function onReportTimeChange(event: Event): void {
  emit('report-time-change', (event.target as HTMLInputElement).value)
}

function onRemove(id: string): void {
  emit('remove', id)
  focusAddDate()
}

onBeforeUnmount(() => {
  if (revertTimer !== null) clearTimeout(revertTimer)
})
</script>

<template>
  <div class="space-y-4">
    <!-- Read-only: bare v-if so the editable branch can never render for a viewer (CR-02). -->
    <template v-if="!canEdit">
      <div
        v-if="reportTime"
        class="rounded-lg bg-gray-900 border border-gray-800 p-4"
      >
        <p class="text-sm text-gray-300" data-testid="times-readonly-report">
          <span class="text-gray-400">Report time:</span>
          <span class="text-gray-100"> {{ formatWallClockTime(reportTime) }}</span>
        </p>
      </div>
      <div
        v-if="readOnlyRows.length > 0"
        class="rounded-lg bg-gray-900 border border-gray-800 p-4"
      >
        <ul class="space-y-1" data-testid="times-readonly">
          <li v-for="r in readOnlyRows" :key="r.id" class="text-sm text-gray-100">
            {{ formatRehearsalDateShort(r.date) }}, {{ formatWallClockTime(r.time) }}
          </li>
        </ul>
      </div>
      <div
        v-if="!reportTime && readOnlyRows.length === 0"
        class="rounded-lg bg-gray-900 border border-gray-800 p-4"
        data-testid="times-readonly-empty"
      >
        <p class="text-sm font-medium text-gray-300">No times set</p>
        <p class="text-xs text-gray-400">
          The report time and any rehearsals will appear here once the planner adds them.
        </p>
      </div>
    </template>

    <template v-else>
      <section class="rounded-lg bg-gray-900 border border-gray-800 p-4" data-testid="report-time-section">
        <h2 class="text-sm font-semibold text-gray-300 mb-3">Report time</h2>
        <label class="block text-xs text-gray-400 mb-1" for="report-time-input">Report time</label>
        <input
          id="report-time-input"
          type="time"
          :value="reportTime"
          :disabled="!canEdit"
          data-testid="report-time-input"
          class="bg-gray-800 border border-gray-700 text-gray-100 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
          @change="onReportTimeChange"
        />
        <p class="text-xs text-gray-400 mt-1" data-testid="report-time-helper">{{ reportTimeHelper }}</p>
      </section>

      <section class="rounded-lg bg-gray-900 border border-gray-800 p-4" data-testid="rehearsals-section">
        <h2 class="text-sm font-semibold text-gray-300 mb-3">Rehearsals</h2>
        <p class="text-xs text-gray-400 mb-3">Every rehearsal needs a date and a time.</p>

        <div v-if="rows.length === 0" data-testid="rehearsals-empty">
          <p class="text-sm font-medium text-gray-300">No rehearsals yet</p>
          <p class="text-xs text-gray-400">Pick a date and time below, then choose Add rehearsal.</p>
        </div>
        <ul v-else class="space-y-2">
          <li v-for="row in rows" :key="row.id">
            <div
              class="flex flex-col gap-2 sm:flex-row sm:items-center"
              :data-testid="isDisplayableRehearsal(row) ? 'rehearsal-row' : 'rehearsal-row-needs-fix'"
            >
              <span
                v-if="!isDisplayableRehearsal(row)"
                data-testid="rehearsal-needs-fix-marker"
                class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-900/40 text-amber-300 border border-amber-800"
              >
                {{ row.date === '' ? 'Needs a date' : 'Needs a time' }}
              </span>
              <input
                type="date"
                :value="row.date"
                max="9999-12-31"
                :disabled="!canEdit"
                aria-label="Rehearsal date"
                data-testid="rehearsal-date-input"
                :class="inputClass(row.date)"
                @change="onFieldChange(row, 'date', $event)"
              />
              <input
                type="time"
                :value="row.time"
                :disabled="!canEdit"
                aria-label="Rehearsal time"
                data-testid="rehearsal-time-input"
                :class="inputClass(row.time)"
                @change="onFieldChange(row, 'time', $event)"
              />
              <button
                type="button"
                :disabled="!canEdit"
                data-testid="remove-rehearsal-btn"
                class="text-xs text-red-400 hover:text-red-300 transition-colors"
                @click="onRemove(row.id)"
              >
                Remove
              </button>
            </div>
            <p
              v-if="revert && revert.id === row.id"
              role="status"
              data-testid="rehearsal-revert-message"
              class="text-xs text-amber-300 mt-1"
            >
              {{
                revert.invalid
                  ? revert.field === 'date'
                    ? 'That date is not valid. Use a four-digit year.'
                    : 'That time is not valid.'
                  : revert.field === 'date'
                    ? 'A rehearsal needs a date. Use Remove to delete it.'
                    : 'A rehearsal needs a time. Use Remove to delete it.'
              }}
            </p>
          </li>
        </ul>

        <form
          :class="rows.length > 0 ? 'border-t border-gray-800 pt-3 mt-3' : ''"
          data-testid="add-rehearsal-form"
          @submit.prevent="onSubmitAdd"
        >
          <div class="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div>
              <label class="block text-xs text-gray-400 mb-1" for="new-rehearsal-date">Date</label>
              <input
                id="new-rehearsal-date"
                ref="newDateInput"
                v-model="newDate"
                type="date"
                max="9999-12-31"
                data-testid="new-rehearsal-date"
                :class="`${inputBase} ${inputOk}`"
              />
            </div>
            <div>
              <label class="block text-xs text-gray-400 mb-1" for="new-rehearsal-time">Time</label>
              <input
                id="new-rehearsal-time"
                v-model="newTime"
                type="time"
                data-testid="new-rehearsal-time"
                :class="`${inputBase} ${inputOk}`"
              />
            </div>
            <button
              type="submit"
              :disabled="!canAdd"
              data-testid="add-rehearsal-btn"
              class="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
            >
              Add rehearsal
            </button>
          </div>
          <div
            v-if="chipTimes.length > 1"
            class="flex flex-wrap items-center gap-2 mt-2"
            data-testid="rehearsal-default-chips"
          >
            <span class="text-xs text-gray-400">Default times:</span>
            <button
              v-for="t in chipTimes"
              :key="t"
              type="button"
              data-testid="rehearsal-default-chip"
              :aria-pressed="newTime === t"
              :class="[
                'rounded-full border bg-gray-800 px-3 py-1 text-xs hover:bg-gray-700 transition-colors',
                newTime === t ? 'border-indigo-500 text-indigo-300' : 'border-gray-700 text-gray-200',
              ]"
              @click="newTime = t"
            >
              {{ formatWallClockTime(t) }}
            </button>
          </div>
        </form>
      </section>
    </template>
  </div>
</template>
