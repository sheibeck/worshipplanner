<template>
  <div class="rounded-lg bg-gray-900 border border-gray-800 hover:bg-gray-800/50 transition-colors cursor-pointer overflow-hidden">
    <!-- Clickable card body (navigates to editor) -->
    <router-link :to="'/services/' + service.id" class="block px-3 py-2.5">
      <!-- Top row: date + status -->
      <div class="flex items-center justify-between gap-2 mb-1.5">
        <div class="flex items-center gap-2 min-w-0">
          <p class="text-sm font-semibold text-gray-100">{{ formattedDate }}</p>
          <span v-if="isCommunion" class="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-900/50 text-amber-300 border border-amber-800">Communion</span>
        </div>
        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold shrink-0" :class="statusClass">
          <svg v-if="service.status === 'planned'" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-3 w-3">
            <path fill-rule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clip-rule="evenodd" />
          </svg>
          {{ service.status }}
        </span>
      </div>
      <!-- Team badges -->
      <div v-if="service.teams.length" class="flex flex-wrap gap-1 mb-1">
        <TeamTagPill v-for="team in service.teams" :key="team" :tag="team" />
      </div>
      <p v-if="service.name" class="text-xs font-medium text-indigo-300 mb-1.5 truncate">{{ service.name }}</p>

      <!-- Compact slot summary -->
      <div class="text-xs space-y-0.5">
        <template v-for="slot in openingSlots" :key="slot.position">
          <p class="truncate" :class="slotTextClass(slot)">{{ slotLabel(slot) }}</p>
        </template>
        <p class="text-gray-600 text-[10px] my-0.5">--- Message{{ service.sermonPassage ? ` — ${service.sermonPassage.book} ${service.sermonPassage.chapter}` : '' }} ---</p>
        <template v-for="slot in sendingSlots" :key="slot.position">
          <p class="truncate" :class="slotTextClass(slot)">{{ slotLabel(slot) }}</p>
        </template>
      </div>
    </router-link>

    <!-- Action footer: Share + Print (outside router-link to avoid navigation) -->
    <div class="flex items-center justify-end gap-1 px-3 py-1.5 border-t border-gray-800/50">
      <button type="button" @click="onShare" :disabled="isSharing" class="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors" title="Share">
        <svg v-if="!shareCopied" xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
        </svg>
        <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        {{ isSharing ? '...' : shareCopied ? 'Copied!' : 'Share' }}
      </button>
      <button type="button" @click="onPrint" class="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors" title="Print">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
        </svg>
        Print
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import type { Service, ServiceSlot } from '@/types/service'
import { useServiceStore } from '@/stores/services'
import TeamTagPill from '@/components/TeamTagPill.vue'

const props = defineProps<{
  service: Service
}>()

const router = useRouter()
const serviceStore = useServiceStore()

const isSharing = ref(false)
const shareCopied = ref(false)

const parsedDate = computed(() => {
  const [year, month, day] = props.service.date.split('-').map(Number)
  return new Date(year, month - 1, day)
})

// Date formatting: "Sun, Mar 8" (with year if not current year)
const formattedDate = computed(() => {
  const d = parsedDate.value
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }
  if (d.getFullYear() !== new Date().getFullYear()) {
    options.year = 'numeric'
  }
  return d.toLocaleDateString('en-US', options)
})

// First Sunday of the month = Communion Sunday
const isCommunion = computed(() => {
  const d = parsedDate.value
  return d.getDay() === 0 && d.getDate() <= 7
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
      return slot.songTitle ? `Song — ${slot.songTitle}` : 'Empty'
    case 'SCRIPTURE':
      return slot.book ? `Scripture — ${slot.book} ${slot.chapter}:${slot.verseStart}-${slot.verseEnd}` : 'Scripture — Empty'
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

async function onShare() {
  if (!serviceStore.orgId) return
  isSharing.value = true
  try {
    const token = await serviceStore.createShareToken(props.service, serviceStore.orgId)
    const url = `${window.location.origin}/share/${token}`
    await navigator.clipboard.writeText(url)
    shareCopied.value = true
    setTimeout(() => {
      shareCopied.value = false
    }, 2000)
  } catch (err) {
    console.error('Share failed:', err)
  } finally {
    isSharing.value = false
  }
}

function onPrint() {
  router.push('/services/' + props.service.id).then(() => {
    setTimeout(() => window.print(), 300)
  })
}
</script>
