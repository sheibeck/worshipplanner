<template>
  <div class="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
    <div class="px-6 py-4 border-b border-slate-200">
      <h2 class="text-sm font-semibold text-slate-900">Getting Started</h2>
      <p class="text-xs text-slate-500 mt-0.5">Get set up in a few quick steps</p>
    </div>
    <ul class="divide-y divide-slate-100">
      <li
        v-for="(step, index) in steps"
        :key="index"
        class="flex items-start gap-4 px-6 py-4"
      >
        <!-- Checkbox / checkmark -->
        <div class="shrink-0 mt-0.5">
          <div
            v-if="step.done"
            class="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div
            v-else
            class="w-5 h-5 rounded-full border-2 border-slate-300"
          ></div>
        </div>

        <!-- Content -->
        <div class="flex-1 min-w-0">
          <div class="flex items-center justify-between gap-2">
            <p
              class="text-sm font-medium"
              :class="step.done ? 'text-slate-400 line-through' : 'text-slate-900'"
            >
              {{ step.title }}
            </p>
            <!-- Arrow link for actionable steps -->
            <router-link
              v-if="step.to && !step.done"
              :to="step.to"
              class="shrink-0 text-indigo-600 hover:text-indigo-700 transition-colors"
              aria-label="Go to step"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </router-link>
          </div>
          <p
            class="text-xs mt-0.5"
            :class="step.done ? 'text-slate-300' : 'text-slate-500'"
          >
            {{ step.description }}
          </p>
        </div>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
const steps = [
  {
    title: 'Sign in to your account',
    description: 'You\'re signed in and ready to go.',
    done: true,
    to: null,
  },
  {
    title: 'Import your song library',
    description: 'Import songs from Planning Center CSV or add them manually.',
    done: false,
    to: '/songs',
  },
  {
    title: 'Plan your first service',
    description: 'Create a service plan with the Vertical Worship methodology.',
    done: false,
    to: '/services',
  },
  {
    title: 'Share with your team',
    description: 'Invite team members to collaborate.',
    done: false,
    to: null,
  },
]
</script>
