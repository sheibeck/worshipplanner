<template>
  <!-- VW Type filter -->
  <select
    v-if="authStore.vwModeEnabled"
    :value="filterVwType ?? ''"
    @change="onVwTypeChange(($event.target as HTMLSelectElement).value)"
    class="rounded-md bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
  >
    <option value="">All types</option>
    <option value="1">Type 1</option>
    <option value="2">Type 2</option>
    <option value="3">Type 3</option>
    <option value="uncategorized">Uncategorized</option>
  </select>

  <!-- Key filter -->
  <select
    :value="filterKey"
    @change="$emit('update:filterKey', ($event.target as HTMLSelectElement).value)"
    class="rounded-md bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
  >
    <option value="">All keys</option>
    <option v-for="key in availableKeys" :key="key" :value="key">{{ key }}</option>
  </select>
</template>

<script setup lang="ts">
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()

defineProps<{
  filterVwType: 1 | 2 | 3 | 'uncategorized' | null
  filterKey: string
  availableKeys: string[]
}>()

const emit = defineEmits<{
  'update:filterVwType': [value: 1 | 2 | 3 | 'uncategorized' | null]
  'update:filterKey': [value: string]
}>()

function onVwTypeChange(value: string) {
  if (value === '') {
    emit('update:filterVwType', null)
  } else if (value === 'uncategorized') {
    emit('update:filterVwType', 'uncategorized')
  } else {
    emit('update:filterVwType', Number(value) as 1 | 2 | 3)
  }
}
</script>
