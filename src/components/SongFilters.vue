<template>
  <div class="flex flex-col sm:flex-row gap-3">
    <!-- Search input -->
    <div class="flex-1">
      <div class="relative">
        <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-4 w-4 text-gray-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
        <input
          type="text"
          :value="searchQuery"
          @input="$emit('update:searchQuery', ($event.target as HTMLInputElement).value)"
          placeholder="Search by title or CCLI number..."
          class="w-full rounded-md bg-gray-800 border border-gray-700 pl-9 pr-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
        />
      </div>
    </div>

    <!-- Filter dropdowns -->
    <div class="flex flex-wrap gap-2">
      <!-- VW Type filter -->
      <select
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

      <!-- Team tag filter -->
      <select
        :value="filterTag"
        @change="$emit('update:filterTag', ($event.target as HTMLSelectElement).value)"
        class="rounded-md bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
      >
        <option value="">All tags</option>
        <option v-for="tag in availableTags" :key="tag" :value="tag">{{ tag }}</option>
      </select>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  searchQuery: string
  filterVwType: 1 | 2 | 3 | 'uncategorized' | null
  filterKey: string
  filterTag: string
  availableKeys: string[]
  availableTags: string[]
}>()

const emit = defineEmits<{
  'update:searchQuery': [value: string]
  'update:filterVwType': [value: 1 | 2 | 3 | 'uncategorized' | null]
  'update:filterKey': [value: string]
  'update:filterTag': [value: string]
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
