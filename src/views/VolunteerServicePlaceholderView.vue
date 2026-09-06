<template>
  <div class="min-h-screen bg-gray-950 flex items-center justify-center px-4">
    <div class="w-full max-w-sm">
      <div class="text-center mb-8">
        <h1 class="text-2xl font-semibold text-white tracking-tight">Worship Planner</h1>
        <p class="text-sm text-gray-400 mt-1">Rehearse view coming soon</p>
      </div>

      <div class="bg-gray-900 border border-gray-800 rounded-xl shadow-xl p-6 space-y-5">
        <p class="text-sm text-gray-400">This service's Rehearse view is coming soon.</p>
        <router-link to="/my-schedule" class="text-sm text-indigo-400 hover:text-indigo-300">
          Back to My Schedule
        </router-link>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Phase 126 (R382) — build-safe placeholder for the Phase 127 Rehearse
// view. No data fetch, no spinner: a static message + a link back to
// /my-schedule (registered by Plan 04, same phase). See src/router/index.ts
// for the route entry this view is wired to.
</script>
