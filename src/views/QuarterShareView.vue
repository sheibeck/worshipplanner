<template>
  <div class="min-h-screen bg-white text-gray-900 font-sans">
    <!-- Loading state -->
    <div v-if="isLoading" class="flex items-center justify-center min-h-screen">
      <p class="text-gray-500 text-sm">Loading...</p>
    </div>

    <!-- Not found state -->
    <div v-else-if="notFound" class="flex items-center justify-center min-h-screen px-4">
      <div class="text-center">
        <p class="text-gray-700 text-base mb-2">This shared schedule is no longer available or the link is invalid.</p>
        <p class="text-gray-400 text-sm">Please ask your worship leader to share the schedule again.</p>
      </div>
    </div>

    <!-- Quarter content -->
    <div v-else-if="quarterSnapshot" class="max-w-2xl mx-auto px-4 py-8 sm:px-6">
      <!-- Header -->
      <div class="mb-6">
        <h1 class="text-xl font-bold text-gray-900">{{ quarterSnapshot.label }}</h1>
        <p class="text-sm text-gray-600 mt-1">Volunteer Schedule</p>
      </div>

      <div class="border-b border-gray-200 mb-4"></div>

      <!-- Date list -->
      <div>
        <div
          v-for="date in quarterSnapshot.serviceDates"
          :key="date"
          class="py-2.5 border-b border-gray-100"
        >
          <p class="text-base font-medium text-gray-900 mb-1">{{ formatDateLabel(date) }}</p>
          <div v-for="role in sortedRoles" :key="role.id" class="py-0.5">
            <p class="text-xs text-gray-500 uppercase tracking-wider">{{ role.name }}</p>
            <p v-if="peopleFor(date, role.id).length > 0" class="text-sm text-gray-800">
              {{ peopleFor(date, role.id).join(', ') }}
            </p>
            <p v-else class="text-gray-400 italic text-sm">[not assigned]</p>
          </div>
        </div>
        <p v-if="quarterSnapshot.serviceDates.length === 0" class="text-gray-400 italic text-sm py-3">
          No service dates
        </p>
      </div>

      <!-- Footer -->
      <div class="mt-8 pt-4 border-t border-gray-200 text-center text-xs text-gray-400">
        Shared from WorshipPlanner
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/firebase'

// Read-only public shape written by quarters.ts::finalizeAndShare (Plan 06/10).
// Person names are pre-resolved into the calendar — no roster/auth access needed here.
interface QuarterSnapshotRole {
  id: string
  name: string
  group: string
}

interface QuarterSnapshot {
  label: string
  serviceDates: string[]
  roles: QuarterSnapshotRole[]
  calendar: Record<string, Record<string, string[]>>
}

// ── State ───────────────────────────────────────────────────────────────────

const isLoading = ref(true)
const notFound = ref(false)
const quarterSnapshot = ref<QuarterSnapshot | null>(null)

// ── Computed ────────────────────────────────────────────────────────────────

// Roles grouped Band/Tech/Other, mirroring QuarterGrid/RosterPrintLayout ordering.
const GROUP_ORDER = ['band', 'tech', 'other']

const sortedRoles = computed<QuarterSnapshotRole[]>(() => {
  if (!quarterSnapshot.value) return []
  return [...quarterSnapshot.value.roles].sort(
    (a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group),
  )
})

function peopleFor(date: string, roleId: string): string[] {
  return quarterSnapshot.value?.calendar[date]?.[roleId] ?? []
}

function formatDateLabel(date: string): string {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(year!, month! - 1, day!).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

// ── Mount ───────────────────────────────────────────────────────────────────

onMounted(async () => {
  const route = useRoute()
  const token = route.params.token as string | undefined
  try {
    const snap = token
      ? await getDoc(doc(db, 'shareTokens', token))
      : await getDoc(
          doc(
            db,
            'quarterShares',
            `${route.params.slug as string}__q${route.params.num as string}-${route.params.year as string}`,
          ),
        )
    if (!snap.exists()) {
      notFound.value = true
    } else {
      quarterSnapshot.value = snap.data().quarterSnapshot
    }
  } catch {
    notFound.value = true
  } finally {
    isLoading.value = false
  }
})
</script>
