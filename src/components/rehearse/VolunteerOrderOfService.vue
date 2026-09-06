<template>
  <div class="max-w-2xl mx-auto px-4 sm:px-6 py-6">
    <div v-if="orderOfService.length">
      <div
        v-for="(slot, index) in orderOfService"
        :key="slot.id + '-' + index"
        class="py-2.5 border-b border-gray-800"
      >
        <!-- SONG slot -->
        <template v-if="slot.kind === 'SONG'">
          <p class="text-[11px] uppercase tracking-wider text-gray-500 mb-0.5">{{ slotLabel(slot, index) }}</p>
          <template v-if="slot.songId">
            <p class="text-base text-gray-100">{{ slot.songTitle }}</p>
            <p class="text-sm text-gray-400">Key: {{ slot.songKey }}</p>
          </template>
          <p v-else class="text-gray-500 italic text-sm">[not assigned]</p>
        </template>

        <!-- SCRIPTURE slot -->
        <template v-else-if="slot.kind === 'SCRIPTURE'">
          <p class="text-[11px] uppercase tracking-wider text-gray-500 mb-0.5">Scripture Reading</p>
          <template v-if="slot.book && slot.chapter && slot.verseStart && slot.verseEnd">
            <p class="text-base text-gray-100">{{ slot.book }} {{ slot.chapter }}:{{ slot.verseStart }}-{{ slot.verseEnd }}</p>
          </template>
          <p v-else class="text-gray-500 italic text-sm">[not assigned]</p>
        </template>

        <!-- PRAYER slot -->
        <template v-else-if="slot.kind === 'PRAYER'">
          <p class="text-[11px] uppercase tracking-wider text-gray-500">Prayer</p>
        </template>

        <!-- MESSAGE slot -->
        <template v-else-if="slot.kind === 'MESSAGE'">
          <p class="text-[11px] uppercase tracking-wider text-gray-500 mb-0.5">Message</p>
        </template>

        <!-- ANNOUNCEMENTS slot -->
        <template v-else-if="slot.kind === 'ANNOUNCEMENTS'">
          <p class="text-[11px] uppercase tracking-wider text-gray-500 mb-0.5">Announcements</p>
        </template>

        <!-- MISC slot -->
        <template v-else-if="slot.kind === 'MISC'">
          <p class="text-[11px] uppercase tracking-wider text-gray-500 mb-0.5">{{ miscLabel(slot) }}</p>
        </template>

        <!-- HYMN slot -->
        <template v-else-if="slot.kind === 'HYMN'">
          <p class="text-[11px] uppercase tracking-wider text-gray-500 mb-0.5">Hymn</p>
          <template v-if="slot.hymnName">
            <p class="text-base text-gray-100">{{ slot.hymnName }}<template v-if="slot.hymnNumber"> #{{ slot.hymnNumber }}</template></p>
            <p v-if="slot.verses" class="text-sm text-gray-400">vv. {{ slot.verses }}</p>
          </template>
          <p v-else class="text-gray-500 italic text-sm">[not assigned]</p>
        </template>

        <!-- R346/SEC-S-04: no per-item free-text (notes/body) render — the
             projection already strips it; this template reads no such
             field, matching ShareView.vue's discipline. -->
      </div>
    </div>

    <p v-else class="text-sm text-gray-500 text-center py-12">
      This service's order hasn't been built yet.
    </p>

    <!-- Who's Serving — a sibling of the slot list/empty copy above, not
         nested under it: an empty order can still carry role assignments. -->
    <div v-if="roleAssignments.length" class="mt-6 rounded-lg bg-gray-900 border border-gray-800 p-4">
      <h2 class="text-sm font-semibold text-gray-200 mb-2">Who's Serving</h2>
      <div v-for="role in roleAssignments" :key="role.roleId" class="py-1">
        <p class="text-xs text-gray-500 uppercase tracking-wider">{{ role.roleName }}</p>
        <p v-if="role.personNames?.length > 0" class="text-sm text-gray-200">
          {{ role.personNames.join(', ') }}
        </p>
        <p v-else class="text-gray-500 italic text-sm">[not assigned]</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Order of Service tab (R392, 127-UI-SPEC.md §4) — re-themes ShareView.vue's
// per-kind slot branching (lines 34-135) to dark gray-950 tokens. NOT a
// re-mount of ShareView.vue (that component is unauthenticated/light/
// print-oriented). Pure presentational: props in, no store reads, no
// Firestore. Fed by the Plan 01 rehearseAccess projection.
import { slotLabel, miscLabel } from '@/utils/slotTypes'
import type { ServiceSlot } from '@/types/service'
import type { RehearseRoleAssignment } from '@/utils/rehearseAccess'

defineProps<{
  orderOfService: ServiceSlot[]
  roleAssignments: RehearseRoleAssignment[]
}>()
</script>
