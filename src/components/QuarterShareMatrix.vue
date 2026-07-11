<template>
  <div class="overflow-x-auto">
    <table class="w-full text-sm border-collapse">
      <thead>
        <tr>
          <th class="px-2 py-2 text-left text-xs font-normal text-gray-500 uppercase tracking-wider">
            Date
          </th>
          <th
            v-for="role in roles"
            :key="role.id"
            class="px-2 py-2 text-left text-xs font-normal text-gray-500 uppercase tracking-wider"
          >
            {{ role.name }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="date in dates" :key="date" class="border-b border-gray-100 hover:bg-gray-50">
          <td class="px-2 py-2 text-sm font-semibold text-gray-900">
            {{ formatDateLabel(date) }}
          </td>
          <td v-for="role in roles" :key="role.id" class="px-2 py-2 text-sm text-gray-800">
            {{ peopleFor(date, role.id).join(', ') || '—' }}
          </td>
        </tr>
      </tbody>
    </table>
    <!-- WR-05: distinguish "quarter genuinely has no service dates" from "a name filter
         matched zero dates" — the raw/unfiltered totalDateCount (mirroring the list view's
         quarterSnapshot.serviceDates.length check) decides which message applies. -->
    <p v-if="totalDateCount === 0" class="text-gray-400 italic text-sm py-3">No service dates</p>
    <p v-else-if="dates.length === 0" class="text-gray-400 italic text-sm py-3">
      {{ activeNameFilter ? `No dates found for ${activeNameFilter}` : 'No matching dates' }}
    </p>
  </div>
</template>

<script setup lang="ts">
// Presentational, read-only matrix — derives everything from the props passed in by
// QuarterShareView (which itself derives everything from the fetched snapshot). No
// Pinia store access here (D-24).
interface QuarterSnapshotRole {
  id: string
  name: string
  group: string
}

const props = defineProps<{
  roles: QuarterSnapshotRole[]
  dates: string[]
  peopleFor: (date: string, roleId: string) => string[]
  // WR-05: raw/unfiltered service-date count for the quarter, independent of any active name
  // filter narrowing `dates` — lets this component tell "genuinely empty quarter" apart from
  // "filter matched zero dates" instead of collapsing both into "No service dates".
  totalDateCount: number
  // Currently active name filter (if any), for the zero-match message.
  activeNameFilter?: string | null
}>()

function peopleFor(date: string, roleId: string): string[] {
  return props.peopleFor(date, roleId)
}

function formatDateLabel(date: string): string {
  // Compact label for the matrix's Date column — the quarter label already carries
  // the year, so weekday + month abbreviations keep the column narrow (and wrappable).
  const [year, month, day] = date.split('-').map(Number)
  return new Date(year!, month! - 1, day!).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}
</script>
