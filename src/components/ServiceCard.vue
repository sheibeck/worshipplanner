<template>
  <router-link :to="'/services/' + service.id" class="block">
    <div
      class="flex items-start gap-4 px-4 py-3 rounded-lg bg-gray-900 border border-gray-800 hover:bg-gray-800/50 transition-colors cursor-pointer"
    >
      <!-- Left: Date -->
      <div class="shrink-0 min-w-[80px] text-center">
        <p class="text-sm font-semibold text-gray-100">{{ formattedDate }}</p>
      </div>

      <!-- Center: Order of service in 3 sections -->
      <div class="flex-1 min-w-0">
        <!-- Opening worship (before MESSAGE) -->
        <ul class="space-y-0.5">
          <li
            v-for="slot in openingSlots"
            :key="slot.position"
            class="text-xs truncate"
            :class="slotTextClass(slot)"
          >
            <a
              v-if="slot.kind === 'SCRIPTURE' && slot.book"
              :href="esvLink(slot.book, slot.chapter!)"
              target="_blank"
              rel="noopener"
              class="text-indigo-400 hover:text-indigo-300 hover:underline"
              @click.stop
            >{{ slot.book }} {{ slot.chapter }}:{{ slot.verseStart }}-{{ slot.verseEnd }}</a>
            <span v-else>{{ slotLabel(slot) }}</span>
          </li>
        </ul>

        <!-- Divider + Message -->
        <div class="border-t border-gray-700/50 my-1.5"></div>
        <p class="text-xs truncate text-gray-300 font-medium">
          <span>Message</span>
          <template v-if="service.sermonPassage">
            <span class="text-gray-600 mx-1">—</span>
            <a
              :href="esvLink(service.sermonPassage.book, service.sermonPassage.chapter)"
              target="_blank"
              rel="noopener"
              class="text-indigo-400 hover:text-indigo-300 hover:underline"
              @click.stop
            >{{ service.sermonPassage.book }} {{ service.sermonPassage.chapter }}:{{ service.sermonPassage.verseStart }}-{{ service.sermonPassage.verseEnd }}</a>
          </template>
        </p>

        <!-- Divider + Sending song -->
        <div class="border-t border-gray-700/50 my-1.5"></div>
        <ul class="space-y-0.5">
          <li
            v-for="slot in sendingSlots"
            :key="slot.position"
            class="text-xs truncate"
            :class="slotTextClass(slot)"
          >
            <span>{{ slotLabel(slot) }}</span>
          </li>
        </ul>
      </div>

      <!-- Right: Status badge -->
      <div class="shrink-0">
        <span
          class="inline-block px-2 py-0.5 rounded text-xs font-semibold"
          :class="statusClass"
        >
          {{ service.status }}
        </span>
      </div>
    </div>
  </router-link>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Service, ServiceSlot } from '@/types/service'
import { esvLink } from '@/utils/scripture'

const props = defineProps<{
  service: Service
}>()

// Date formatting: "Sun, Mar 8" (with year if not current year)
const formattedDate = computed(() => {
  const [year, month, day] = props.service.date.split('-').map(Number)
  const d = new Date(year, month - 1, day)
  const currentYear = new Date().getFullYear()

  const options: Intl.DateTimeFormatOptions = {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }
  if (year !== currentYear) {
    options.year = 'numeric'
  }

  return d.toLocaleDateString('en-US', options)
})

const messageIndex = computed(() =>
  props.service.slots.findIndex((s) => s.kind === 'MESSAGE'),
)

const openingSlots = computed(() =>
  props.service.slots.slice(0, messageIndex.value),
)

const sendingSlots = computed(() =>
  props.service.slots.slice(messageIndex.value + 1),
)

function slotLabel(slot: ServiceSlot): string {
  switch (slot.kind) {
    case 'SONG':
      return slot.songTitle ?? 'Empty'
    case 'SCRIPTURE':
      return slot.book ? `${slot.book} ${slot.chapter}:${slot.verseStart}-${slot.verseEnd}` : 'Scripture — Empty'
    case 'PRAYER':
      return 'Prayer'
    case 'MESSAGE':
      return 'Message'
  }
}

function slotTextClass(slot: ServiceSlot): string {
  if (slot.kind === 'SONG') return slot.songTitle ? 'text-gray-400' : 'text-gray-500 italic'
  if (slot.kind === 'SCRIPTURE') return slot.book ? 'text-gray-400' : 'text-gray-500 italic'
  return 'text-gray-500'
}

// Static status class lookup (Tailwind v4 purge safety)
const statusClasses: Record<string, string> = {
  planned: 'bg-green-900/50 text-green-300 border border-green-800',
  draft: 'bg-gray-800 text-gray-400 border border-gray-700',
}
const statusClass = computed(
  () => statusClasses[props.service.status] ?? 'bg-gray-800 text-gray-400',
)
</script>
