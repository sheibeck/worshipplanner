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
          <td class="px-2 py-2 text-sm font-semibold text-gray-900 whitespace-nowrap">
            {{ formatDateLabel(date) }}
          </td>
          <td v-for="role in roles" :key="role.id" class="px-2 py-2 text-sm text-gray-800">
            {{ peopleFor(date, role.id).join(', ') || '—' }}
          </td>
        </tr>
      </tbody>
    </table>
    <p v-if="dates.length === 0" class="text-gray-400 italic text-sm py-3">No service dates</p>
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
}>()

function peopleFor(date: string, roleId: string): string[] {
  return props.peopleFor(date, roleId)
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
</script>
