<template>
  <div class="print:hidden">
  <AppShell>
    <div class="px-6 py-4">

      <!-- Loading skeleton -->
      <div v-if="serviceStore.isLoading" class="animate-pulse space-y-4">
        <div class="h-8 bg-gray-800 rounded w-64"></div>
        <div class="h-4 bg-gray-800 rounded w-48"></div>
        <div v-for="i in 9" :key="i" class="h-20 bg-gray-800 rounded"></div>
      </div>

      <!-- Service not found -->
      <div v-else-if="!localService" class="text-center py-16">
        <p class="text-gray-400 text-lg mb-4">Service not found</p>
        <router-link
          to="/services"
          class="text-indigo-400 hover:text-indigo-300 text-sm transition-colors"
        >
          &larr; Back to services
        </router-link>
      </div>

      <!-- Editor -->
      <template v-else>
        <!-- Back link -->
        <router-link
          to="/services"
          class="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-200 transition-colors mb-3"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to Services
        </router-link>

        <!-- Header -->
        <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-3">
          <div>
            <div class="flex items-center gap-3">
              <h1 v-if="!authStore.isEditor" class="text-xl font-semibold text-gray-100">{{ formattedDate }}</h1>
              <div v-else class="relative">
                <button
                  type="button"
                  class="text-xl font-semibold text-gray-100 hover:text-indigo-300 transition-colors cursor-pointer"
                  @click="($refs.dateInput as HTMLInputElement).showPicker()"
                >{{ formattedDate }}</button>
                <input
                  ref="dateInput"
                  type="date"
                  :value="localService.date"
                  class="absolute inset-0 opacity-0 w-0 h-0 pointer-events-none"
                  @change="onDateChange(($event.target as HTMLInputElement).value)"
                />
              </div>
              <!-- Status badge: editor gets clickable toggle, viewer gets static badge -->
              <button
                v-if="authStore.isEditor"
                type="button"
                class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border cursor-pointer hover:opacity-80 transition-opacity"
                :class="statusBadgeClasses[localService.status]"
                @click="toggleStatus"
              >
                <svg v-if="localService.status === 'planned'" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-3 w-3">
                  <path fill-rule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clip-rule="evenodd" />
                </svg>
                <svg v-else-if="localService.status === 'exported'" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-3 w-3">
                  <path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clip-rule="evenodd" />
                </svg>
                {{ localService.status === 'exported' ? 'Exported' : localService.status === 'planned' ? 'Planned' : 'Draft' }}
              </button>
              <span
                v-else
                class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border"
                :class="statusBadgeClasses[localService.status]"
              >
                {{ localService.status === 'exported' ? 'Exported' : localService.status === 'planned' ? 'Planned' : 'Draft' }}
              </span>
            </div>
          </div>

          <!-- Save area -->
          <div class="flex items-center gap-3">
            <!-- Autosave status indicator: editor only -->
            <template v-if="authStore.isEditor">
              <span
                v-if="autosaveStatus === 'pending' || autosaveStatus === 'saving'"
                class="text-xs text-gray-400 italic"
              >
                {{ autosaveStatus === 'saving' ? 'Saving...' : 'Saving soon...' }}
              </span>
              <span
                v-else-if="autosaveStatus === 'saved'"
                class="text-xs text-green-400"
              >
                Saved
              </span>
              <span
                v-else-if="isDirty"
                class="text-xs text-amber-400"
              >
                Unsaved changes
              </span>
            </template>

            <!-- Undo button (editor only, only visible when a previous snapshot exists) -->
            <button
              v-if="authStore.isEditor && previousService"
              type="button"
              @click="onUndo"
              title="Undo last save (Ctrl+Z)"
              class="print:hidden inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 transition-colors border border-gray-700"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
              Undo
            </button>

            <!-- Suggest All Songs button: editor only -->
            <button
              v-if="authStore.isEditor"
              type="button"
              @click="suggestAllSongs"
              :disabled="!hasSermonContext || aiSuggestingAll || isExportedLocked"
              :title="isExportedLocked ? 'Service is exported — cycle badge back to Draft to edit' : !hasSermonContext ? 'Add a sermon topic or passage for AI suggestions' : undefined"
              class="print:hidden inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-gray-200 bg-gray-800 hover:bg-gray-700 transition-colors border border-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-indigo-400" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2l1.5 4.5L18 8l-4.5 1.5L12 14l-1.5-4.5L6 8l4.5-1.5L12 2zM5 16l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3zM19 15l.75 2.25L22 18l-2.25.75L19 21l-.75-2.25L16 18l2.25-.75L19 15z"/>
              </svg>
              {{ aiSuggestingAll ? 'Suggesting...' : 'Suggest All Songs' }}
            </button>

            <!-- Export to PC button: shown when credentials configured, enabled only for planned services -->
            <button
              v-if="authStore.hasPcCredentials"
              type="button"
              data-testid="export-pc-btn"
              @click="onExportToPC"
              :disabled="isExporting || localService.status !== 'planned'"
              :title="localService.status === 'draft' ? 'Mark service as Planned to export' : localService.status === 'exported' ? 'Already exported to Planning Center' : undefined"
              class="print:hidden inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors border"
              :class="localService.status === 'exported'
                ? 'text-gray-500 bg-gray-800/50 border-gray-700 cursor-not-allowed'
                : localService.status !== 'planned'
                  ? 'text-gray-500 bg-gray-800/50 border-gray-700 cursor-not-allowed'
                  : isExporting
                    ? 'text-gray-400 bg-gray-800 border-gray-700 cursor-wait'
                    : 'text-gray-200 bg-gray-800 hover:bg-gray-700 border-gray-700'"
            >
              <!-- Spinner during export -->
              <svg v-if="isExporting" class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <!-- Check icon when already exported -->
              <svg v-else-if="localService.status === 'exported'" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <!-- Upload icon default -->
              <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              {{ isExporting ? 'Exporting...' : localService.status === 'exported' ? 'Exported' : 'Export to PC' }}
            </button>

            <!-- Copy for PC button: shown when NO credentials OR service is draft -->
            <button
              v-else
              type="button"
              data-testid="copy-pc-btn"
              @click="onCopyForPC"
              :disabled="!localService"
              class="print:hidden inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-gray-200 bg-gray-800 hover:bg-gray-700 transition-colors border border-gray-700"
            >
              <svg v-if="!pcCopied" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              {{ pcCopied ? 'Copied!' : 'Copy for PC' }}
            </button>

            <!-- Save button: editor only -->
            <button
              v-if="authStore.isEditor"
              type="button"
              @click="onSave"
              :disabled="!isDirty || isSaving"
              class="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-white transition-colors"
              :class="isDirty && !isSaving
                ? 'bg-indigo-600 hover:bg-indigo-500'
                : 'bg-indigo-600/40 cursor-not-allowed text-white/50'"
            >
              {{ isSaving ? 'Saving...' : 'Save' }}
            </button>
          </div>
        </div>

        <!-- Delete confirmation dialog -->
        <Teleport to="body">
          <div v-if="showDeleteConfirm" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
            <div class="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4">
              <h2 class="text-base font-semibold text-gray-100 mb-2">Delete service?</h2>
              <p class="text-sm text-gray-400 mb-6">This will permanently delete the service for <span class="text-gray-200">{{ formattedDate }}</span>. This cannot be undone.</p>
              <div class="flex justify-end gap-3">
                <button
                  type="button"
                  @click="showDeleteConfirm = false"
                  :disabled="isDeleting"
                  class="rounded-md px-4 py-2 text-sm font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 transition-colors border border-gray-700 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  @click="onDelete"
                  :disabled="isDeleting"
                  class="rounded-md px-4 py-2 text-sm font-medium text-white bg-red-700 hover:bg-red-600 transition-colors disabled:opacity-50"
                >
                  {{ isDeleting ? 'Deleting...' : 'Delete' }}
                </button>
              </div>
            </div>
          </div>
        </Teleport>

        <!-- Export dialog -->
        <Teleport to="body">
          <div v-if="showExportDialog" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
            <div class="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-6 w-full max-w-md mx-4">
              <h2 class="text-base font-semibold text-gray-100 mb-4">Export to Planning Center</h2>

              <!-- Loading state -->
              <div v-if="exportLoading" class="text-sm text-gray-400 py-4 text-center">Loading options...</div>

              <template v-else>
                <!-- Service Type -->
                <div class="mb-3">
                  <label class="block text-xs text-gray-400 mb-1">Service Type</label>
                  <select
                    v-model="exportSelectedServiceTypeId"
                    @change="onServiceTypeChange"
                    class="w-full bg-gray-800 border border-gray-700 text-gray-100 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option v-for="st in exportServiceTypes" :key="st.id" :value="st.id">{{ st.name }}</option>
                  </select>
                </div>

                <!-- Existing plan found -->
                <div v-if="existingPlan" class="mb-3 rounded-md bg-amber-900/20 border border-amber-800 px-3 py-2">
                  <p class="text-sm text-amber-300 mb-2">A plan already exists for this date: <span class="font-medium text-amber-200">{{ existingPlan.dates }}</span></p>
                  <div class="flex gap-2">
                    <button
                      type="button"
                      @click="exportMode = 'existing'"
                      class="px-3 py-1 rounded text-xs font-medium transition-colors"
                      :class="exportMode === 'existing'
                        ? 'bg-amber-700 text-amber-100 border border-amber-600'
                        : 'bg-gray-800 text-gray-400 border border-gray-700 hover:border-gray-600'"
                    >Add to existing plan</button>
                    <button
                      type="button"
                      @click="exportMode = 'new'"
                      class="px-3 py-1 rounded text-xs font-medium transition-colors"
                      :class="exportMode === 'new'
                        ? 'bg-indigo-700 text-indigo-100 border border-indigo-600'
                        : 'bg-gray-800 text-gray-400 border border-gray-700 hover:border-gray-600'"
                    >Create new plan</button>
                  </div>
                </div>

                <!-- Template (only for new plans) -->
                <div v-if="exportMode === 'new'" class="mb-3">
                  <label class="block text-xs text-gray-400 mb-1">Template</label>
                  <select
                    v-model="exportSelectedTemplateId"
                    class="w-full bg-gray-800 border border-gray-700 text-gray-100 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="">No template (blank plan)</option>
                    <option v-for="t in exportTemplates" :key="t.id" :value="t.id">{{ t.name }}</option>
                  </select>
                </div>

                <!-- PC Teams (D-04, D-05) -->
                <div v-if="pcTeams.length > 0" class="mb-3">
                  <label class="block text-xs text-gray-400 mb-1">Teams</label>
                  <div class="space-y-1">
                    <label
                      v-for="team in pcTeams"
                      :key="team.id"
                      class="flex items-center gap-2 text-sm text-gray-200 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        :value="team.id"
                        v-model="selectedPcTeamIds"
                        class="h-4 w-4 rounded border-gray-600 bg-gray-800 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-gray-900"
                      />
                      {{ team.name }}
                    </label>
                  </div>
                </div>

                <!-- Info for existing plan mode -->
                <p v-if="exportMode === 'existing'" class="text-xs text-gray-500 mb-3">Worship Song items are replaced. Scripture Reading items are replaced. Unmatched placeholders are removed. Extras are appended at the end.</p>

                <!-- Service Date (read-only) -->
                <div class="mb-4">
                  <label class="block text-xs text-gray-400 mb-1">Service Date</label>
                  <p class="text-sm text-gray-200">{{ formattedDate }}</p>
                </div>

                <!-- Error inside dialog -->
                <p v-if="exportError" class="text-red-400 text-sm mb-3">{{ exportError }}</p>

                <!-- Actions -->
                <div class="flex justify-end gap-3">
                  <button
                    type="button"
                    @click="showExportDialog = false; exportError = null"
                    :disabled="isExporting"
                    class="rounded-md px-4 py-2 text-sm font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 transition-colors border border-gray-700 disabled:opacity-50"
                  >Cancel</button>
                  <button
                    type="button"
                    @click="onConfirmExport"
                    :disabled="isExporting || !exportSelectedServiceTypeId"
                    class="rounded-md px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors disabled:opacity-50"
                  >{{ isExporting ? 'Exporting...' : exportMode === 'existing' ? 'Add to Plan' : 'Export' }}</button>
                </div>
              </template>
            </div>
          </div>
        </Teleport>

        <!-- Export success toast -->
        <div v-if="pcExported" class="mb-3 rounded-md bg-green-900/30 border border-green-800 px-4 py-2 text-sm text-green-400 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          Exported to Planning Center
        </div>

        <!-- Export error banner -->
        <div v-if="exportError" class="mb-3 rounded-md bg-red-900/30 border border-red-800 px-4 py-2 text-sm text-red-400 flex items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <span>{{ exportError }}</span>
          </div>
          <button @click="exportError = null" class="text-red-400 hover:text-red-300">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Teams configuration -->
        <div class="mb-3 rounded-lg bg-gray-900 border border-gray-800 p-3">
          <div class="flex items-center gap-4">
          <h2 class="text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">Teams</h2>
          <!-- Editor: checkboxes -->
          <div v-if="authStore.isEditor" class="flex flex-wrap items-center gap-4">
            <label
              v-for="team in AVAILABLE_TEAMS"
              :key="team"
              class="flex items-center gap-2 cursor-pointer"
            >
              <input
                type="checkbox"
                :checked="localService.teams.includes(team)"
                @change="toggleTeam(team)"
                :disabled="isExportedLocked"
                class="h-4 w-4 rounded border-gray-600 bg-gray-800 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-gray-900 disabled:opacity-50"
              />
              <span class="text-sm text-gray-200">{{ team }}</span>
            </label>
            <input
              v-if="localService.teams.includes('Special')"
              v-model="localService.name"
              type="text"
              placeholder="e.g. Good Friday, Easter"
              :disabled="isExportedLocked"
              class="rounded-md bg-gray-800 border border-gray-700 text-indigo-300 text-sm px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-gray-500 w-48 disabled:opacity-50"
            />
          </div>
          <!-- Viewer: read-only text list -->
          <div v-else class="flex flex-wrap items-center gap-2">
            <span
              v-for="team in localService.teams"
              :key="team"
              class="text-sm text-gray-200"
            >{{ team }}</span>
            <span v-if="localService.teams.length === 0" class="text-sm text-gray-500 italic">None</span>
          </div>
          </div>
        </div>

        <!-- Sermon Context (topic + passage) -->
        <div class="mb-3 rounded-lg bg-gray-900 border border-gray-800 p-3">
          <div class="flex items-start gap-4">
            <h2 class="text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap mt-1">Sermon Context</h2>
            <div class="flex-1 space-y-3">
              <div>
                <p class="text-xs text-gray-500 mb-1">Sermon Topic</p>
                <!-- Editor: editable input -->
                <input
                  v-if="authStore.isEditor"
                  v-model="localService.sermonTopic"
                  type="text"
                  placeholder="e.g. Grace and forgiveness, The prodigal son"
                  :disabled="isExportedLocked"
                  class="w-full rounded-md bg-gray-800 border border-gray-700 text-gray-100 placeholder-gray-500 text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
                />
                <!-- Viewer: read-only text -->
                <p v-else class="text-sm text-gray-200">{{ localService.sermonTopic || '—' }}</p>
              </div>
              <div>
                <p class="text-xs text-gray-500 mb-1">Sermon Passage</p>
                <!-- Editor: ScriptureInput -->
                <ScriptureInput
                  v-if="authStore.isEditor && !isExportedLocked"
                  :modelValue="localService.sermonPassage"
                  :sermonPassage="null"
                  :showOverlapWarning="false"
                  label="Sermon Passage"
                  @update:modelValue="onSermonPassageChange"
                />
                <!-- Exported lock: read-only passage -->
                <p v-else-if="authStore.isEditor && isExportedLocked" class="text-sm text-gray-200">
                  {{ localService.sermonPassage
                    ? `${localService.sermonPassage.book} ${localService.sermonPassage.chapter}:${localService.sermonPassage.verseStart}${localService.sermonPassage.verseEnd ? '-' + localService.sermonPassage.verseEnd : ''}`
                    : '—'
                  }}
                </p>
                <!-- Viewer: read-only text -->
                <p v-else class="text-sm text-gray-200">
                  {{ localService.sermonPassage
                    ? `${localService.sermonPassage.book} ${localService.sermonPassage.chapter}:${localService.sermonPassage.verseStart}${localService.sermonPassage.verseEnd ? '-' + localService.sermonPassage.verseEnd : ''}`
                    : '—'
                  }}
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- Dynamic Service Flow -->
        <div ref="slotContainerRef" class="space-y-1.5">
          <div
            v-for="(slot, index) in localService.slots"
            :key="slot.position + '-' + slot.kind + '-' + index"
            class="rounded-lg bg-gray-900 border border-gray-800 p-3 flex items-start gap-2"
          >
            <!-- Drag handle: editor only -->
            <div v-if="authStore.isEditor" class="cursor-grab active:cursor-grabbing text-gray-600 hover:text-gray-400 drag-handle flex-shrink-0 mt-0.5">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M7 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/>
              </svg>
            </div>

            <!-- Slot content -->
            <div class="flex-1 min-w-0">
              <!-- SONG slot -->
              <template v-if="slot.kind === 'SONG'">
                <div class="flex items-center justify-between gap-3 mb-1">
                  <p class="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    {{ slotLabel(slot, index) }}
                  </p>
                  <SongBadge
                    v-if="slot.songId"
                    :types="songStore.songs.find(s => s.id === slot.songId)?.vwTypes ?? []"
                  />
                </div>

                <!-- Assigned song display -->
                <div v-if="slot.songId" class="flex items-center justify-between gap-3 rounded-md bg-gray-800 border border-gray-700 px-3 py-2">
                  <div class="flex items-center gap-2 min-w-0 flex-1">
                    <p class="text-sm font-medium text-gray-100 truncate">{{ slot.songTitle }}</p>
                    <span class="text-gray-600 flex-shrink-0">&middot;</span>
                    <span class="text-xs text-gray-400 flex-shrink-0">{{ slot.songKey || '—' }}</span>
                    <template v-if="getCcliNumber(slot.songId)">
                      <span class="text-gray-700 flex-shrink-0">|</span>
                      <a
                        :href="`https://songselect.ccli.com/songs/${getCcliNumber(slot.songId)}`"
                        target="_blank"
                        rel="noopener"
                        class="text-xs text-indigo-400 hover:text-indigo-300 hover:underline flex-shrink-0"
                        @click.stop
                      >CCLI {{ getCcliNumber(slot.songId) }}</a>
                    </template>
                  </div>
                  <button
                    v-if="authStore.isEditor && !isExportedLocked"
                    type="button"
                    @click="onClearSong(index)"
                    class="text-gray-500 hover:text-gray-300 transition-colors flex-shrink-0"
                    title="Remove song"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <!-- AI draft song display: editor only -->
                <div
                  v-if="authStore.isEditor && aiDraftSongs.has(index)"
                  class="flex items-center justify-between gap-3 rounded-md bg-indigo-950/50 border border-indigo-800/60 px-3 py-2 mb-1"
                >
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-gray-300">{{ aiDraftSongs.get(index)?.songTitle }}</p>
                    <p class="text-xs text-indigo-400 mt-0.5">{{ aiDraftSongs.get(index)?.reason }}</p>
                  </div>
                  <div class="flex items-center gap-1 flex-shrink-0">
                    <!-- Accept button -->
                    <button
                      type="button"
                      @click="acceptAiSong(index)"
                      class="p-1 rounded text-green-400 hover:text-green-300 hover:bg-green-900/30 transition-colors"
                      title="Accept AI suggestion"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </button>
                    <!-- Reject button -->
                    <button
                      type="button"
                      @click="rejectAiSong(index)"
                      class="p-1 rounded text-gray-500 hover:text-gray-300 hover:bg-gray-700/50 transition-colors"
                      title="Reject AI suggestion"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>

                <!-- Song picker: editor only, hidden when exported -->
                <SongSlotPicker
                  v-if="authStore.isEditor && !isExportedLocked"
                  :requiredVwType="slot.requiredVwType"
                  :serviceTeams="localService.teams"
                  :currentSongId="slot.songId"
                  :songs="songStore.songs"
                  :aiSuggestions="aiPerSlotResults.get(index)"
                  :aiLoading="aiPerSlotLoading.get(index) ?? false"
                  :aiError="aiPerSlotError.get(index) ?? false"
                  :hasSermonContext="hasSermonContext"
                  @select="(song) => onSelectSong(index, song)"
                  @clear="onClearSong(index)"
                  @requestAiSuggestions="fetchAiForSlot(index)"
                />
                <!-- Viewer: show empty slot label if no song assigned -->
                <p v-else-if="!slot.songId" class="text-sm text-gray-500 italic">Song — Empty</p>
              </template>

              <!-- SCRIPTURE slot -->
              <template v-else-if="slot.kind === 'SCRIPTURE'">
                <div class="flex items-center gap-4">
                  <p class="text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">Scripture Reading</p>
                  <div class="flex-1">
                    <!-- Editor: ScriptureInput -->
                    <ScriptureInput
                      v-if="authStore.isEditor && !isExportedLocked"
                      :modelValue="slotToScriptureRef(slot)"
                      :sermonPassage="localService.sermonPassage"
                      :showOverlapWarning="true"
                      :showAiSuggest="true"
                      :sermonTopic="localService.sermonTopic ?? ''"
                      :recentScriptures="recentScriptureRefs"
                      label="Scripture Reading"
                      @update:modelValue="(ref) => onScriptureChange(index, ref)"
                    />
                    <!-- Exported lock: read-only -->
                    <p v-else-if="authStore.isEditor && isExportedLocked" class="text-sm text-gray-200">
                      {{ slotToScriptureRef(slot as ScriptureSlot)
                        ? `${slotToScriptureRef(slot as ScriptureSlot)?.book} ${slotToScriptureRef(slot as ScriptureSlot)?.chapter}:${slotToScriptureRef(slot as ScriptureSlot)?.verseStart}${slotToScriptureRef(slot as ScriptureSlot)?.verseEnd ? '-' + slotToScriptureRef(slot as ScriptureSlot)?.verseEnd : ''}`
                        : 'Scripture — Empty'
                      }}
                    </p>
                    <!-- Viewer: read-only text -->
                    <p v-else class="text-sm text-gray-200">
                      {{ slotToScriptureRef(slot)
                        ? `${slotToScriptureRef(slot)?.book} ${slotToScriptureRef(slot)?.chapter}:${slotToScriptureRef(slot)?.verseStart}${slotToScriptureRef(slot)?.verseEnd ? '-' + slotToScriptureRef(slot)?.verseEnd : ''}`
                        : 'Scripture — Empty'
                      }}
                    </p>
                  </div>
                </div>
              </template>

              <!-- PRAYER slot -->
              <template v-else-if="slot.kind === 'PRAYER'">
                <div class="flex items-center gap-2 mb-1">
                  <p class="text-xs font-semibold text-gray-400 uppercase tracking-wider">Prayer</p>
                  <span class="text-xs text-gray-600 italic">No assignment needed</span>
                </div>
                <!-- Editor: editable link fields -->
                <div v-if="authStore.isEditor && !isExportedLocked" class="flex items-center gap-2 mt-1">
                  <input
                    :value="(slot as NonAssignableSlot).linkLabel"
                    @input="(slot as NonAssignableSlot).linkLabel = ($event.target as HTMLInputElement).value"
                    type="text"
                    placeholder="Link label (optional)"
                    class="rounded-md bg-gray-800 border border-gray-700 text-gray-200 text-xs px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-gray-500 w-36"
                  />
                  <input
                    :value="(slot as NonAssignableSlot).linkUrl"
                    @input="(slot as NonAssignableSlot).linkUrl = ($event.target as HTMLInputElement).value"
                    type="url"
                    placeholder="https://..."
                    class="rounded-md bg-gray-800 border border-gray-700 text-gray-200 text-xs px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-gray-500 flex-1"
                  />
                  <a
                    v-if="(slot as NonAssignableSlot).linkUrl"
                    :href="(slot as NonAssignableSlot).linkUrl"
                    target="_blank"
                    rel="noopener"
                    class="text-indigo-400 hover:text-indigo-300 transition-colors flex-shrink-0"
                    title="Open link"
                    @click.stop
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>
                <!-- Viewer: read-only link -->
                <div v-else-if="(slot as NonAssignableSlot).linkUrl" class="flex items-center gap-2 mt-1">
                  <a
                    :href="(slot as NonAssignableSlot).linkUrl"
                    target="_blank"
                    rel="noopener"
                    class="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                  >{{ (slot as NonAssignableSlot).linkLabel || (slot as NonAssignableSlot).linkUrl }}</a>
                </div>
              </template>

              <!-- MESSAGE slot -->
              <template v-else-if="slot.kind === 'MESSAGE'">
                <div class="flex items-center gap-2 mb-1">
                  <p class="text-xs font-semibold text-gray-400 uppercase tracking-wider">Message</p>
                  <span class="text-xs text-gray-600 italic">No assignment needed</span>
                </div>
                <!-- Editor: editable link fields -->
                <div v-if="authStore.isEditor && !isExportedLocked" class="flex items-center gap-2 mt-1">
                  <input
                    :value="(slot as NonAssignableSlot).linkLabel"
                    @input="(slot as NonAssignableSlot).linkLabel = ($event.target as HTMLInputElement).value"
                    type="text"
                    placeholder="Link label (optional)"
                    class="rounded-md bg-gray-800 border border-gray-700 text-gray-200 text-xs px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-gray-500 w-36"
                  />
                  <input
                    :value="(slot as NonAssignableSlot).linkUrl"
                    @input="(slot as NonAssignableSlot).linkUrl = ($event.target as HTMLInputElement).value"
                    type="url"
                    placeholder="https://..."
                    class="rounded-md bg-gray-800 border border-gray-700 text-gray-200 text-xs px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-gray-500 flex-1"
                  />
                  <a
                    v-if="(slot as NonAssignableSlot).linkUrl"
                    :href="(slot as NonAssignableSlot).linkUrl"
                    target="_blank"
                    rel="noopener"
                    class="text-indigo-400 hover:text-indigo-300 transition-colors flex-shrink-0"
                    title="Open link"
                    @click.stop
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>
                <!-- Viewer: read-only link -->
                <div v-else-if="(slot as NonAssignableSlot).linkUrl" class="flex items-center gap-2 mt-1">
                  <a
                    :href="(slot as NonAssignableSlot).linkUrl"
                    target="_blank"
                    rel="noopener"
                    class="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                  >{{ (slot as NonAssignableSlot).linkLabel || (slot as NonAssignableSlot).linkUrl }}</a>
                </div>
              </template>

              <!-- HYMN slot -->
              <template v-else-if="slot.kind === 'HYMN'">
                <div class="mb-1">
                  <p class="text-xs font-semibold text-gray-400 uppercase tracking-wider">Hymn</p>
                </div>
                <!-- Editor: editable fields -->
                <div v-if="authStore.isEditor && !isExportedLocked" class="flex flex-wrap items-center gap-2 mt-1">
                  <input
                    :value="(slot as HymnSlot).hymnName"
                    @input="(slot as HymnSlot).hymnName = ($event.target as HTMLInputElement).value"
                    type="text"
                    placeholder="Hymn Name"
                    class="rounded-md bg-gray-800 border border-gray-700 text-gray-200 text-xs px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-gray-500 flex-1 min-w-32"
                  />
                  <input
                    :value="(slot as HymnSlot).hymnNumber"
                    @input="(slot as HymnSlot).hymnNumber = ($event.target as HTMLInputElement).value"
                    type="text"
                    placeholder="# (e.g. 337)"
                    class="rounded-md bg-gray-800 border border-gray-700 text-gray-200 text-xs px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-gray-500 w-24"
                  />
                  <input
                    :value="(slot as HymnSlot).verses"
                    @input="(slot as HymnSlot).verses = ($event.target as HTMLInputElement).value"
                    type="text"
                    placeholder="Verses (e.g. 1, 3, 4)"
                    class="rounded-md bg-gray-800 border border-gray-700 text-gray-200 text-xs px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-gray-500 w-36"
                  />
                </div>
                <!-- Viewer: read-only display -->
                <div v-else class="mt-1">
                  <template v-if="(slot as HymnSlot).hymnName">
                    <p class="text-sm text-gray-200">{{ (slot as HymnSlot).hymnName }}<template v-if="(slot as HymnSlot).hymnNumber"> #{{ (slot as HymnSlot).hymnNumber }}</template></p>
                    <p v-if="(slot as HymnSlot).verses" class="text-xs text-gray-400">vv. {{ (slot as HymnSlot).verses }}</p>
                  </template>
                  <p v-else class="text-sm text-gray-400 italic">Hymn — Empty</p>
                </div>
              </template>
            </div>

            <!-- Remove button: editor only, hidden when exported -->
            <button
              v-if="authStore.isEditor && !isExportedLocked"
              type="button"
              @click="removeSlot(index)"
              class="text-gray-600 hover:text-red-400 transition-colors flex-shrink-0 mt-0.5"
              title="Remove element"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <!-- Add Element button: editor only, hidden when exported -->
        <div v-if="authStore.isEditor && !isExportedLocked" class="mt-2 relative">
          <button
            type="button"
            @click="showAddMenu = !showAddMenu"
            class="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-gray-300 bg-gray-900 hover:bg-gray-800 transition-colors border border-gray-700 border-dashed"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add Element
          </button>

          <!-- Click-away backdrop -->
          <div
            v-if="showAddMenu"
            class="fixed inset-0 z-10"
            @click="showAddMenu = false"
          ></div>

          <!-- Dropdown menu (opens upward) -->
          <div
            v-if="showAddMenu"
            class="absolute left-0 bottom-full mb-1 w-44 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-20 overflow-hidden"
          >
            <button type="button" @click="addSlot('SONG', 2)" class="px-3 py-2 text-sm text-gray-200 hover:bg-gray-700 w-full text-left transition-colors">Song</button>
            <button type="button" @click="addSlot('SCRIPTURE')" class="px-3 py-2 text-sm text-gray-200 hover:bg-gray-700 w-full text-left transition-colors">Scripture Reading</button>
            <button type="button" @click="addSlot('PRAYER')" class="px-3 py-2 text-sm text-gray-200 hover:bg-gray-700 w-full text-left transition-colors">Prayer</button>
            <button type="button" @click="addSlot('MESSAGE')" class="px-3 py-2 text-sm text-gray-200 hover:bg-gray-700 w-full text-left transition-colors">Message</button>
            <button type="button" @click="addSlot('HYMN')" class="px-3 py-2 text-sm text-gray-200 hover:bg-gray-700 w-full text-left transition-colors">Hymn</button>
          </div>
        </div>

        <!-- Bottom actions: Print, Share, Delete -->
        <div class="mt-6 pt-4 border-t border-gray-800 flex flex-wrap items-center gap-2 print:hidden">
          <!-- Print button -->
          <button
            type="button"
            data-testid="print-btn"
            @click="onPrint"
            :disabled="!localService"
            class="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-gray-200 bg-gray-800 hover:bg-gray-700 transition-colors border border-gray-700"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print
          </button>

          <!-- Share button -->
          <button
            type="button"
            @click="onShare"
            :disabled="!localService || isSharing"
            class="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-gray-200 bg-gray-800 hover:bg-gray-700 transition-colors border border-gray-700"
          >
            <svg v-if="!shareCopied" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            {{ isSharing ? 'Sharing...' : shareCopied ? 'Link Copied!' : shareError ? shareError : 'Share' }}
          </button>

          <div class="flex-1" />

          <!-- Delete button: editor only -->
          <button
            v-if="authStore.isEditor"
            type="button"
            @click="showDeleteConfirm = true"
            class="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-red-400 bg-gray-800 hover:bg-gray-700 transition-colors border border-gray-700"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete
          </button>
        </div>
      </template>
    </div>
  </AppShell>
  </div>

  <!-- Print layout: hidden on screen, visible when printing -->
  <ServicePrintLayout
    v-if="localService"
    :service="localService"
    :songs="songStore.songs"
  />
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useServiceStore } from '@/stores/services'
import { useSongStore } from '@/stores/songs'
import { slotLabel, createSlot, reindexSlots } from '@/utils/slotTypes'
import { scripturesOverlap } from '@/utils/scripture'
import type { Service, SongSlot, ScriptureSlot, NonAssignableSlot, HymnSlot, ScriptureRef, SlotKind } from '@/types/service'
import type { VWType } from '@/types/song'
import AppShell from '@/components/AppShell.vue'
import SongBadge from '@/components/SongBadge.vue'
import SongSlotPicker from '@/components/SongSlotPicker.vue'
import ScriptureInput from '@/components/ScriptureInput.vue'
import ServicePrintLayout from '@/components/ServicePrintLayout.vue'
import { formatForPlanningCenter } from '@/utils/planningCenterExport'
import { fetchServiceTypes, fetchTemplates, fetchServiceTypeTeams, fetchPlans, fetchPlanItems, createPlan, fetchTemplateItems, addSlotAsItem, buildPlanTitle, createItem, updateItem, deleteItem, createPlanTime, fetchPlanTimes, addTeamToPlan, fetchPlanNeededPositionTeamIds } from '@/utils/planningCenterApi'
import { serverTimestamp } from 'firebase/firestore'
import Sortable from 'sortablejs'
import { getSongSuggestions } from '@/utils/claudeApi'
import type { AiSongSuggestion } from '@/utils/claudeApi'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const serviceStore = useServiceStore()
const songStore = useSongStore()

// ── Constants ─────────────────────────────────────────────────────────────────

const AVAILABLE_TEAMS = ['Choir', 'Orchestra', 'Communion', 'Special']

// Teams that should be pre-checked in the PC export dialog every time, regardless
// of what the service has flagged. Matched as case-insensitive substrings against
// the team name fetched from Planning Center, because PC names may vary slightly
// (e.g. "Worship Vocals" vs "Worship - Vocals").
const DEFAULT_PC_TEAM_NAMES = [
  'Preacher and Deacon and other Leaders',
  'Scripture Reading',
  'Worship Vocals',
  'Worship Band',
  'Pray-er',
  'Sanctuary Sound',
  'Livestream Sound',
  'Projection',
  'Livestream Camera',
] as const

/**
 * Decide whether a Planning Center team should be pre-checked when the export
 * dialog opens. Returns true if EITHER:
 *   (a) the PC team name contains any DEFAULT_PC_TEAM_NAMES entry (case-insensitive substring), OR
 *   (b) any conditional team flag on the service exactly matches the PC team name (case-insensitive).
 * Case (b) preserves the existing pre-Quick behavior for Orchestra / Choir / Communion / Special.
 */
function shouldPreselectPcTeam(pcTeamName: string, serviceTeams: readonly string[]): boolean {
  const lowerName = pcTeamName.toLowerCase()
  const matchesDefault = DEFAULT_PC_TEAM_NAMES.some((d) => lowerName.includes(d.toLowerCase()))
  if (matchesDefault) return true
  return serviceTeams.some((svcTeam) => svcTeam.toLowerCase() === lowerName)
}

const statusBadgeClasses: Record<string, string> = {
  draft: 'bg-gray-800 text-gray-400 border-gray-700',
  planned: 'bg-yellow-900/50 text-yellow-300 border-yellow-800',
  exported: 'bg-green-900/50 text-green-300 border-green-800',
}

// ── Local state ────────────────────────────────────────────────────────────────

const localService = ref<Service | null>(null)
const originalService = ref<Service | null>(null)
const isSaving = ref(false)
const pcCopied = ref(false)

// ── Autosave state ─────────────────────────────────────────────────────────────
const previousService = ref<Service | null>(null)   // snapshot before last autosave (for undo)
const autosaveStatus = ref<'idle' | 'pending' | 'saving' | 'saved'>('idle')
let autosaveTimer: ReturnType<typeof setTimeout> | null = null
let autosaveInitialized = false                     // suppress first-load trigger
let autosaveSaving = false                          // inflight guard — prevents concurrent saves
const isSharing = ref(false)
const shareCopied = ref(false)
const shareError = ref<string | null>(null)
const showAddMenu = ref(false)
const showDeleteConfirm = ref(false)
const isDeleting = ref(false)

// ── Export to PC state ─────────────────────────────────────────────────────────

const isExporting = ref(false)
const pcExported = ref(false)       // green toast after success
const exportError = ref<string | null>(null)  // red banner on error

// Export dialog state
const showExportDialog = ref(false)
const exportServiceTypes = ref<Array<{ id: string; name: string }>>([])
const exportTemplates = ref<Array<{ id: string; name: string }>>([])
const exportSelectedServiceTypeId = ref('')
const exportSelectedTemplateId = ref('')
const exportLoading = ref(false)
const existingPlan = ref<{ id: string; title: string; dates: string } | null>(null)
const exportMode = ref<'new' | 'existing'>('new')
const pcTeams = ref<Array<{ id: string; name: string }>>([])
const selectedPcTeamIds = ref<string[]>([])

// ── Computed: editing guard ─────────────────────────────────────────────────────

const isExportedLocked = computed(() =>
  localService.value?.status === 'exported'
)

// ── AI state ───────────────────────────────────────────────────────────────────

// Keyed by slot index — AI-drafted songs awaiting accept/reject
const aiDraftSongs = ref<Map<number, { songId: string; songTitle: string; songKey: string; reason: string }>>(new Map())
// Loading state for "Suggest All" bulk flow
const aiSuggestingAll = ref(false)
// Session cache keyed by sermon context + slot VW type (JSON.stringify)
const aiSongCache = ref(new Map<string, AiSongSuggestion[]>())
// Per-slot loading state for individual dropdown AI picks
const aiPerSlotLoading = ref(new Map<number, boolean>())
// Per-slot AI results for dropdown display
const aiPerSlotResults = ref(new Map<number, AiSongSuggestion[]>())
// Per-slot error state for dropdown display
const aiPerSlotError = ref(new Map<number, boolean>())

// ── Sortable ───────────────────────────────────────────────────────────────────

const slotContainerRef = ref<HTMLElement | null>(null)
let sortableInstance: Sortable | null = null

watch(slotContainerRef, (el) => {
  if (el && !sortableInstance) {
    sortableInstance = Sortable.create(el, {
      handle: '.drag-handle',
      animation: 150,
      ghostClass: 'opacity-30',
      onEnd(evt) {
        if (!localService.value || evt.oldIndex == null || evt.newIndex == null) return
        if (evt.oldIndex === evt.newIndex) return
        const slots = [...localService.value.slots]
        const moved = slots.splice(evt.oldIndex, 1)[0]
        if (!moved) return
        slots.splice(evt.newIndex, 0, moved)
        localService.value.slots = reindexSlots(slots)
        // Force Vue to re-render in sync with our data
        nextTick(() => {
          // After Vue re-renders, Sortable DOM will be correct
        })
      },
    })
  }
}, { flush: 'post' })

// ── Computed ───────────────────────────────────────────────────────────────────

const serviceId = computed(() => route.params.id as string)

const parsedDate = computed(() => {
  if (!localService.value?.date) return null
  const parts = localService.value.date.split('-').map(Number)
  const year = parts[0] ?? 0
  const month = parts[1] ?? 1
  const day = parts[2] ?? 1
  return new Date(year, month - 1, day)
})

const formattedDate = computed(() => {
  if (!parsedDate.value) return ''
  return parsedDate.value.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
})

function onDateChange(newDate: string) {
  if (!localService.value || !newDate) return
  localService.value.date = newDate
}

const isDirty = computed(() => {
  if (!localService.value || !originalService.value) return false
  return JSON.stringify(localService.value) !== JSON.stringify(originalService.value)
})

const hasSermonContext = computed(
  () => !!(localService.value?.sermonTopic?.trim() || localService.value?.sermonPassage),
)

const recentServiceSongIds = computed<string[]>(() => {
  const eightWeeksAgo = Date.now() - 8 * 7 * 24 * 60 * 60 * 1000
  const cutoff = new Date(eightWeeksAgo).toISOString().slice(0, 10) // YYYY-MM-DD
  const ids = new Set<string>()
  for (const service of serviceStore.services) {
    // services are ordered by date desc; skip current service
    if (service.id === serviceId.value) continue
    if (service.date < cutoff) break
    for (const slot of service.slots) {
      if (slot.kind === 'SONG') {
        const songId = (slot as SongSlot).songId
        if (songId) ids.add(songId)
      }
    }
  }
  return Array.from(ids)
})

const recentScriptureRefs = computed<ScriptureRef[]>(() => {
  const eightWeeksAgo = Date.now() - 8 * 7 * 24 * 60 * 60 * 1000
  const cutoff = new Date(eightWeeksAgo).toISOString().slice(0, 10) // YYYY-MM-DD
  const refs: ScriptureRef[] = []
  for (const service of serviceStore.services) {
    // services are ordered by date desc; skip current service
    if (service.id === serviceId.value) continue
    if (service.date < cutoff) break
    for (const slot of service.slots) {
      if (slot.kind === 'SCRIPTURE') {
        const s = slot as ScriptureSlot
        if (s.book && s.chapter && s.verseStart && s.verseEnd) {
          refs.push({ book: s.book, chapter: s.chapter, verseStart: s.verseStart, verseEnd: s.verseEnd })
        }
      }
    }
  }
  return refs
})

// ── Watch for service store changes ───────────────────────────────────────────

watch(
  () => serviceStore.services,
  (services) => {
    const found = services.find((s) => s.id === serviceId.value)
    if (!found) return

    if (!localService.value) {
      // Initial load: populate from store
      localService.value = JSON.parse(JSON.stringify(found))
      originalService.value = JSON.parse(JSON.stringify(found))
      // Reset autosave state when service first loads (or re-loads)
      autosaveInitialized = false
      previousService.value = null
      autosaveStatus.value = 'idle'
    } else if (autosaveStatus.value === 'idle' || autosaveStatus.value === 'saved') {
      // Remote update arrived while user is not actively editing — apply it.
      // This is what makes two simultaneous viewers see each other's changes.
      // Guard: skip if the remote version matches what we already have (avoid
      // spurious re-renders after our own save completes).
      const remoteJson = JSON.stringify(found)
      const localJson = JSON.stringify(localService.value)
      if (remoteJson !== localJson) {
        localService.value = JSON.parse(remoteJson)
        originalService.value = JSON.parse(remoteJson)
        // Reset autosaveInitialized so the watcher's first local mutation
        // after a remote merge is NOT mistakenly treated as user-initiated.
        autosaveInitialized = false
      }
    }
    // If autosaveStatus is 'pending' or 'saving', the user is actively editing —
    // do not overwrite their in-progress work. Their save will win.
  },
  { immediate: true, deep: true },
)

// ── AI sermon context watcher — clear caches on context change ─────────────────

watch(
  () => [localService.value?.sermonTopic, localService.value?.sermonPassage],
  () => {
    aiSongCache.value.clear()
    aiPerSlotResults.value.clear()
    aiPerSlotError.value.clear()
    aiPerSlotLoading.value.clear()
  },
  { deep: true },
)

// ── Autosave watcher ────────────────────────────────────────────────────────────

watch(
  localService,
  () => {
    // Skip: not loaded yet, or no actual change
    if (!localService.value || !originalService.value) return
    // Viewers cannot autosave
    if (!authStore.isEditor) return
    // Suppress the trigger that fires when service first loads from the store
    if (!autosaveInitialized) {
      autosaveInitialized = true
      return
    }
    if (!isDirty.value) return

    autosaveStatus.value = 'pending'

    if (autosaveTimer) clearTimeout(autosaveTimer)
    const scheduleAutosave = () => {
      autosaveTimer = setTimeout(async () => {
        if (!isDirty.value) {
          autosaveStatus.value = 'idle'
          return
        }
        // A save is already in flight — reschedule so this slot state gets saved
        if (autosaveSaving) {
          scheduleAutosave()
          return
        }
        // Snapshot pre-change state before saving (enables undo)
        previousService.value = JSON.parse(JSON.stringify(originalService.value))
        autosaveSaving = true
        autosaveStatus.value = 'saving'
        try {
          await onSave()
          autosaveStatus.value = 'saved'
          // Fade "Saved" indicator after 3 seconds
          setTimeout(() => {
            if (autosaveStatus.value === 'saved') autosaveStatus.value = 'idle'
          }, 3000)
        } finally {
          autosaveSaving = false
        }
      }, 800)
    }
    scheduleAutosave()
  },
  { deep: true },
)

// ── Init ───────────────────────────────────────────────────────────────────────

function initStores() {
  const orgId = authStore.orgId
  if (!orgId) return
  if (!serviceStore.orgId) {
    serviceStore.subscribe(orgId)
  }
  if (!songStore.orgId) {
    songStore.subscribe(orgId)
  }
}

onMounted(() => {
  initStores()

  // Ctrl+Z / Cmd+Z undo shortcut
  function handleUndoKey(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
      // Only intercept if undo is available (not inside a text input where browser undo should apply)
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (!previousService.value) return
      e.preventDefault()
      onUndo()
    }
  }
  document.addEventListener('keydown', handleUndoKey)
  onUnmounted(() => document.removeEventListener('keydown', handleUndoKey))
})

onUnmounted(() => {
  sortableInstance?.destroy()
  sortableInstance = null
  if (autosaveTimer) clearTimeout(autosaveTimer)
  autosaveSaving = false
  // Don't unsubscribe serviceStore here — DashboardView may still be using it
})

// ── CCLI helper ────────────────────────────────────────────────────────────────

function getCcliNumber(songId: string): string | null {
  return songStore.songs.find((s) => s.id === songId)?.ccliNumber || null
}

// ── Status toggle ──────────────────────────────────────────────────────────────

function toggleStatus() {
  if (!localService.value) return
  const current = localService.value.status
  if (current === 'draft') {
    localService.value.status = 'planned'
  } else if (current === 'planned') {
    localService.value.status = 'exported'
  } else {
    // exported -> draft
    localService.value.status = 'draft'
  }
}

// ── Team toggle ────────────────────────────────────────────────────────────────

function toggleTeam(team: string) {
  if (!localService.value) return
  const teams = localService.value.teams
  const idx = teams.indexOf(team)
  if (idx >= 0) {
    localService.value.teams = teams.filter((_, i) => i !== idx)
  } else {
    localService.value.teams = [...teams, team]
  }
}

// ── Dynamic slot add/remove ────────────────────────────────────────────────────

function addSlot(kind: SlotKind, vwType?: VWType) {
  if (!localService.value) return
  const newSlot = createSlot(kind, vwType)
  localService.value.slots.push(newSlot)
  localService.value.slots = reindexSlots(localService.value.slots)
  showAddMenu.value = false
}

function removeSlot(index: number) {
  if (!localService.value) return
  localService.value.slots.splice(index, 1)
  localService.value.slots = reindexSlots(localService.value.slots)
}

// ── Song assignment ────────────────────────────────────────────────────────────

function onSelectSong(
  index: number,
  song: { id: string; title: string; key: string },
) {
  if (!localService.value) return
  const slot = localService.value.slots[index]
  if (!slot) return
  if (slot.kind === 'SONG') {
    const updated: SongSlot = { ...slot, songId: song.id, songTitle: song.title, songKey: song.key }
    localService.value.slots[index] = updated
  }
}

function onClearSong(index: number) {
  if (!localService.value) return
  const slot = localService.value.slots[index]
  if (!slot) return
  if (slot.kind === 'SONG') {
    const updated: SongSlot = { ...slot, songId: null, songTitle: null, songKey: null }
    localService.value.slots[index] = updated
  }
}

// ── AI cache key ───────────────────────────────────────────────────────────────

function aiCacheKey(slotVwType: number): string {
  return JSON.stringify({
    topic: localService.value?.sermonTopic ?? '',
    passage: localService.value?.sermonPassage ?? null,
    slotVwType,
  })
}

// ── Suggest All Songs ──────────────────────────────────────────────────────────

async function suggestAllSongs() {
  if (!localService.value || !hasSermonContext.value) return
  aiSuggestingAll.value = true

  try {
    const sermonTopic = localService.value.sermonTopic ?? null
    const sermonPassage = localService.value.sermonPassage ?? null
    // Orchestra AI filter (D-06, D-09): when service is orchestra, only include orchestra-tagged songs
    const isOrchestraService = (localService.value?.teams ?? []).includes('Orchestra')
    const librarySource = isOrchestraService
      ? songStore.songs.filter((s) => s.teamTags.includes('Orchestra'))
      : songStore.songs
    const songLibrary = librarySource.map((s) => ({
      id: s.id,
      title: s.title,
      ccliNumber: s.ccliNumber,
      vwTypes: s.vwTypes,
      themes: s.themes,
      lastUsedAt: s.lastUsedAt,
    }))
    const recentIds = recentServiceSongIds.value

    // Accumulate accepted IDs across the batch so each call is aware of previous picks
    const batchAcceptedIds: string[] = []

    for (let i = 0; i < localService.value.slots.length; i++) {
      const slot = localService.value.slots[i]
      if (!slot || slot.kind !== 'SONG') continue
      const songSlot = slot as SongSlot

      // Collect already-selected song IDs from non-empty slots
      const alreadySelectedIds: string[] = []
      for (const s of localService.value.slots) {
        if (s.kind === 'SONG') {
          const id = (s as SongSlot).songId
          if (id) alreadySelectedIds.push(id)
        }
      }
      // Include batch picks so far
      for (const id of batchAcceptedIds) {
        if (!alreadySelectedIds.includes(id)) alreadySelectedIds.push(id)
      }

      const result = await getSongSuggestions({
        sermonTopic,
        sermonPassage,
        slotVwType: songSlot.requiredVwType,
        alreadySelectedSongIds: alreadySelectedIds,
        songLibrary,
        recentServiceSongIds: recentIds,
      })

      if (!result || result.length === 0) continue

      // Filter out songs already selected or drafted for other slots
      const suggestion = result.find((s) => !alreadySelectedIds.includes(s.songId) && !batchAcceptedIds.includes(s.songId))
      if (!suggestion) continue

      const song = songStore.songs.find((s) => s.id === suggestion.songId)
      if (!song) continue

      const key = song.arrangements[0]?.key ?? ''
      const newMap = new Map(aiDraftSongs.value)
      newMap.set(i, {
        songId: song.id,
        songTitle: song.title,
        songKey: key,
        reason: suggestion.reason,
      })
      aiDraftSongs.value = newMap

      // Track this ID for subsequent calls in the batch
      batchAcceptedIds.push(song.id)
    }
  } finally {
    aiSuggestingAll.value = false
  }
}

// ── Fetch AI suggestions for a single slot (called by SongSlotPicker emit) ──────

async function fetchAiForSlot(slotIndex: number) {
  if (!localService.value) return
  const slot = localService.value.slots[slotIndex]
  if (!slot || slot.kind !== 'SONG') return
  const songSlot = slot as SongSlot

  const cacheKey = aiCacheKey(songSlot.requiredVwType)

  // Check cache first
  if (aiSongCache.value.has(cacheKey)) {
    const cached = aiSongCache.value.get(cacheKey)!
    const newResults = new Map(aiPerSlotResults.value)
    newResults.set(slotIndex, cached)
    aiPerSlotResults.value = newResults
    return
  }

  // Set loading, clear any previous error
  const newLoading = new Map(aiPerSlotLoading.value)
  newLoading.set(slotIndex, true)
  aiPerSlotLoading.value = newLoading

  const newErrors = new Map(aiPerSlotError.value)
  newErrors.delete(slotIndex)
  aiPerSlotError.value = newErrors

  try {
    const alreadySelectedIds: string[] = []
    for (const s of localService.value.slots) {
      if (s.kind === 'SONG') {
        const id = (s as SongSlot).songId
        if (id) alreadySelectedIds.push(id)
      }
    }

    const isOrchestraService = (localService.value?.teams ?? []).includes('Orchestra')
    const librarySource = isOrchestraService
      ? songStore.songs.filter((s) => s.teamTags.includes('Orchestra'))
      : songStore.songs
    const result = await getSongSuggestions({
      sermonTopic: localService.value.sermonTopic ?? null,
      sermonPassage: localService.value.sermonPassage ?? null,
      slotVwType: songSlot.requiredVwType,
      alreadySelectedSongIds: alreadySelectedIds,
      songLibrary: librarySource.map((s) => ({
        id: s.id,
        title: s.title,
        ccliNumber: s.ccliNumber,
        vwTypes: s.vwTypes,
        themes: s.themes,
        lastUsedAt: s.lastUsedAt,
      })),
      recentServiceSongIds: recentServiceSongIds.value,
    })

    if (result) {
      // Cache and store results
      const newCache = new Map(aiSongCache.value)
      newCache.set(cacheKey, result)
      aiSongCache.value = newCache

      const newResultsMap = new Map(aiPerSlotResults.value)
      newResultsMap.set(slotIndex, result)
      aiPerSlotResults.value = newResultsMap
    } else {
      // null result means error/no suggestions
      const errMap = new Map(aiPerSlotError.value)
      errMap.set(slotIndex, true)
      aiPerSlotError.value = errMap
    }
  } catch {
    const errMap = new Map(aiPerSlotError.value)
    errMap.set(slotIndex, true)
    aiPerSlotError.value = errMap
  } finally {
    const loadingMap = new Map(aiPerSlotLoading.value)
    loadingMap.delete(slotIndex)
    aiPerSlotLoading.value = loadingMap
  }
}

// ── Accept / Reject AI draft songs ─────────────────────────────────────────────

function acceptAiSong(index: number) {
  const draft = aiDraftSongs.value.get(index)
  if (!draft) return
  onSelectSong(index, { id: draft.songId, title: draft.songTitle, key: draft.songKey })
  const newMap = new Map(aiDraftSongs.value)
  newMap.delete(index)
  aiDraftSongs.value = newMap
}

function rejectAiSong(index: number) {
  const newMap = new Map(aiDraftSongs.value)
  newMap.delete(index)
  aiDraftSongs.value = newMap
}

// ── Scripture ──────────────────────────────────────────────────────────────────

function slotToScriptureRef(slot: ScriptureSlot): ScriptureRef | null {
  if (!slot.book || !slot.chapter || !slot.verseStart || !slot.verseEnd) return null
  return {
    book: slot.book,
    chapter: slot.chapter,
    verseStart: slot.verseStart,
    verseEnd: slot.verseEnd,
  }
}

function onScriptureChange(index: number, ref: ScriptureRef | null) {
  if (!localService.value) return
  const slot = localService.value.slots[index]
  if (!slot) return
  if (slot.kind === 'SCRIPTURE') {
    localService.value.slots[index] = {
      ...slot,
      book: ref?.book ?? null,
      chapter: ref?.chapter ?? null,
      verseStart: ref?.verseStart ?? null,
      verseEnd: ref?.verseEnd ?? null,
    } as ScriptureSlot
  }
}

function onSermonPassageChange(ref: ScriptureRef | null) {
  if (!localService.value) return
  localService.value.sermonPassage = ref
}

// Keep for use in ScriptureInput overlap detection (via the component itself)
function checkScriptureOverlap(slot: ScriptureSlot): boolean {
  const reading = slotToScriptureRef(slot)
  const sermon = localService.value?.sermonPassage ?? null
  if (!reading || !sermon) return false
  return scripturesOverlap(reading, sermon)
}

// Suppress unused warning — this function is available for future template use
void checkScriptureOverlap

// ── Print & Copy for PC ────────────────────────────────────────────────────────

function onPrint() {
  window.print()
}

async function onCopyForPC() {
  if (!localService.value) return
  const text = formatForPlanningCenter(localService.value, songStore.songs)
  if (navigator.clipboard) {
    await navigator.clipboard.writeText(text)
  }
  pcCopied.value = true
  setTimeout(() => {
    pcCopied.value = false
  }, 2000)
}

async function checkForExistingPlan() {
  if (!authStore.pcCredentials || !exportSelectedServiceTypeId.value || !localService.value?.date) {
    existingPlan.value = null
    return
  }
  const { appId, secret } = authStore.pcCredentials
  try {
    const plans = await fetchPlans(appId, secret, exportSelectedServiceTypeId.value, {
      after: localService.value.date,
      before: localService.value.date,
    })
    // sortDate is a full ISO datetime — match just the date portion
    const targetDate = localService.value.date
    const match = plans.find(p => p.sortDate?.startsWith(targetDate))
    existingPlan.value = match ?? null
    exportMode.value = existingPlan.value ? 'existing' : 'new'
  } catch {
    existingPlan.value = null
  }
}

async function onExportToPC() {
  if (!localService.value) return
  if (!authStore.hasPcCredentials || !authStore.pcCredentials) return

  showExportDialog.value = true
  exportError.value = null
  exportLoading.value = true
  existingPlan.value = null
  exportMode.value = 'new'
  pcTeams.value = []
  selectedPcTeamIds.value = []

  try {
    const { appId, secret } = authStore.pcCredentials
    exportServiceTypes.value = await fetchServiceTypes(appId, secret)

    // Default to service type whose name contains "Sunday", else first
    const sundayType = exportServiceTypes.value.find(t =>
      t.name.toLowerCase().includes('sunday')
    )
    exportSelectedServiceTypeId.value = sundayType?.id ?? exportServiceTypes.value[0]?.id ?? ''

    // Fetch templates for selected service type
    if (exportSelectedServiceTypeId.value) {
      exportTemplates.value = await fetchTemplates(appId, secret, exportSelectedServiceTypeId.value)
      exportSelectedTemplateId.value = exportTemplates.value[0]?.id ?? ''

      // Check if a plan already exists for this date
      await checkForExistingPlan()

      // Fetch PC teams for the selected service type and pre-select matching ones (D-04, D-05)
      try {
        pcTeams.value = await fetchServiceTypeTeams(appId, secret, exportSelectedServiceTypeId.value)
        selectedPcTeamIds.value = pcTeams.value
          .filter((pcTeam) => shouldPreselectPcTeam(pcTeam.name, localService.value?.teams ?? []))
          .map((t) => t.id)
      } catch {
        // Non-fatal: if teams cannot be fetched, export can still proceed without team add
        pcTeams.value = []
        selectedPcTeamIds.value = []
      }
    }
  } catch (e) {
    exportError.value = e instanceof Error ? e.message : 'Failed to load export options'
  } finally {
    exportLoading.value = false
  }
}

async function onServiceTypeChange() {
  if (!authStore.pcCredentials || !exportSelectedServiceTypeId.value) return
  const { appId, secret } = authStore.pcCredentials
  exportTemplates.value = []
  exportSelectedTemplateId.value = ''
  existingPlan.value = null
  exportMode.value = 'new'
  pcTeams.value = []
  selectedPcTeamIds.value = []
  try {
    exportTemplates.value = await fetchTemplates(appId, secret, exportSelectedServiceTypeId.value)
    exportSelectedTemplateId.value = exportTemplates.value[0]?.id ?? ''
    await checkForExistingPlan()
    try {
      pcTeams.value = await fetchServiceTypeTeams(appId, secret, exportSelectedServiceTypeId.value)
      selectedPcTeamIds.value = pcTeams.value
        .filter((pcTeam) => shouldPreselectPcTeam(pcTeam.name, localService.value?.teams ?? []))
        .map((t) => t.id)
    } catch {
      pcTeams.value = []
      selectedPcTeamIds.value = []
    }
  } catch {
    // silently ignore — user can still export without template
  }
}

async function onConfirmExport() {
  if (!localService.value) return
  if (!authStore.pcCredentials || !exportSelectedServiceTypeId.value) return

  isExporting.value = true
  exportError.value = null

  try {
    const { appId, secret } = authStore.pcCredentials
    const serviceTypeId = exportSelectedServiceTypeId.value
    const failures: string[] = []
    let planId: string

    // Collect our songs (SONG + HYMN) and scriptures from service slots
    const songSlots = localService.value.slots.filter(s => s.kind === 'SONG' || s.kind === 'HYMN')
    const scriptureSlots = localService.value.slots.filter(s => s.kind === 'SCRIPTURE')

    if (exportMode.value === 'existing' && existingPlan.value) {
      // ── Add to existing plan: replace placeholders, then append leftovers (D-02) ──
      planId = existingPlan.value.id

      const existingItems = await fetchPlanItems(appId, secret, serviceTypeId, planId)

      // First pass — classify placeholders into three buckets
      let songIndex = 0
      let scriptureIndex = 0
      const songMatches: Array<{ item: (typeof existingItems)[number]; slot: (typeof songSlots)[number] }> = []
      const scriptureMatches: Array<{ item: (typeof existingItems)[number]; slot: (typeof scriptureSlots)[number] }> = []
      const unmatchedPlaceholderIds: string[] = []

      for (const item of existingItems) {
        const titleLower = item.title.toLowerCase()
        // Match song placeholders (template) or actual song items created by a prior export.
        // Songs always have 'worship song' in their title (set by addSlotAsItem for SONG/HYMN).
        const isSongItem = titleLower.includes('worship song')
          || item.itemType === 'song'
          || item.itemType === 'song_arrangement'
        // Match scripture placeholders (template 'scripture reading' title), items created by a
        // prior export which now carry the 'Scripture - ' prefix, OR regular items that are not
        // known non-scripture slots (Message, Prayer).
        const NON_SCRIPTURE_REGULAR_TITLES = new Set(['message', 'prayer'])
        const isScriptureItem = titleLower.startsWith('scripture - ')
          || titleLower.includes('scripture reading')
          || (item.itemType === 'regular' && !NON_SCRIPTURE_REGULAR_TITLES.has(titleLower))

        if (isSongItem && songIndex < songSlots.length) {
          songMatches.push({ item, slot: songSlots[songIndex]! })
          songIndex++
        } else if (!isSongItem && isScriptureItem && scriptureIndex < scriptureSlots.length) {
          scriptureMatches.push({ item, slot: scriptureSlots[scriptureIndex]! })
          scriptureIndex++
        } else if (isSongItem || titleLower.includes('scripture reading')) {
          // Only push unmatched song items or explicit 'scripture reading' placeholders
          unmatchedPlaceholderIds.push(item.id)
        }
      }

      // Second pass — delete unmatched placeholders (non-fatal; D-02)
      for (const itemId of unmatchedPlaceholderIds) {
        try {
          await deleteItem(appId, secret, serviceTypeId, planId, itemId)
        } catch {
          // Non-fatal: leaving a stale placeholder is acceptable, do not block export
        }
      }

      // Third pass — delete matched song placeholders then recreate at same sequence
      for (const { item, slot } of songMatches) {
        try {
          await deleteItem(appId, secret, serviceTypeId, planId, item.id)
          await addSlotAsItem(
            appId, secret, serviceTypeId, planId,
            slot, item.sequence, songStore.songs, localService.value.sermonPassage,
          )
        } catch {
          const label = slot.kind === 'SONG'
            ? ((slot as any).songTitle ?? 'Song')
            : ((slot as any).hymnName ?? 'Hymn')
          failures.push(label)
        }
      }

      // Fourth pass — delete matched scripture placeholders then recreate at same sequence
      for (const { item, slot } of scriptureMatches) {
        try {
          await deleteItem(appId, secret, serviceTypeId, planId, item.id)
          await addSlotAsItem(
            appId, secret, serviceTypeId, planId,
            slot, item.sequence, songStore.songs, localService.value.sermonPassage,
          )
        } catch {
          failures.push('Scripture')
        }
      }

      // Fifth pass — append leftover (unmatched WorshipPlanner) slots at end
      let sequence = existingItems.length > 0
        ? Math.max(...existingItems.map((i) => i.sequence)) + 1
        : 1

      for (let i = songIndex; i < songSlots.length; i++) {
        try {
          await addSlotAsItem(
            appId, secret, serviceTypeId, planId,
            songSlots[i]!, sequence, songStore.songs, localService.value.sermonPassage,
          )
          sequence++
        } catch {
          const slot = songSlots[i]!
          failures.push(
            slot.kind === 'SONG' ? ((slot as any).songTitle ?? 'Song') : ((slot as any).hymnName ?? 'Hymn'),
          )
        }
      }

      for (let i = scriptureIndex; i < scriptureSlots.length; i++) {
        try {
          await addSlotAsItem(
            appId, secret, serviceTypeId, planId,
            scriptureSlots[i]!, sequence, songStore.songs, localService.value.sermonPassage,
          )
          sequence++
        } catch {
          failures.push('Scripture')
        }
      }
    } else {
      // ── Create new plan ──
      const templateId = exportSelectedTemplateId.value || undefined
      const baseTitle = buildPlanTitle(localService.value)
      planId = await createPlan(appId, secret, serviceTypeId, baseTitle)

      // Add plan times (service date determines sort_date)
      // PC treats times as UTC, so convert local times to UTC ISO strings
      if (localService.value.date) {
        const serviceDate = localService.value.date // YYYY-MM-DD

        // Helper: create a local Date for a given date string + hour/minute, return UTC ISO
        const toUtc = (dateStr: string, hours: number, minutes: number) =>
          new Date(new Date(dateStr + 'T00:00:00').setHours(hours, minutes, 0, 0))

        // Previous Wednesday
        const wed = new Date(serviceDate + 'T00:00:00')
        wed.setDate(wed.getDate() - ((wed.getDay() + 4) % 7))
        const wedStr = `${wed.getFullYear()}-${String(wed.getMonth() + 1).padStart(2, '0')}-${String(wed.getDate()).padStart(2, '0')}`

        await createPlanTime(appId, secret, serviceTypeId, planId, {
          startsAt: toUtc(wedStr, 18, 30).toISOString(),
          endsAt: toUtc(wedStr, 20, 30).toISOString(),
          timeType: 'rehearsal',
          name: 'Wednesday Rehearsal',
        }).catch(() => {})

        await createPlanTime(appId, secret, serviceTypeId, planId, {
          startsAt: toUtc(serviceDate, 8, 15).toISOString(),
          endsAt: toUtc(serviceDate, 10, 15).toISOString(),
          timeType: 'rehearsal',
          name: 'Sunday Rehearsal',
        }).catch(() => {})

        await createPlanTime(appId, secret, serviceTypeId, planId, {
          startsAt: toUtc(serviceDate, 10, 30).toISOString(),
          endsAt: toUtc(serviceDate, 12, 0).toISOString(),
          timeType: 'service',
        }).catch(() => {})
      }

      // Build items from template or slots directly
      let sequence = 1
      let songIndex = 0
      let scriptureIndex = 0

      if (templateId) {
        const templateItems = await fetchTemplateItems(appId, secret, serviceTypeId, templateId)
        templateItems.sort((a, b) => a.sequence - b.sequence)

        for (const tItem of templateItems) {
          const titleLower = tItem.title.toLowerCase()
          const isSongItem = titleLower.includes('worship song')
          const isScriptureItem = titleLower.startsWith('scripture - ') || titleLower.includes('scripture reading')

          try {
            if (isSongItem && songIndex < songSlots.length) {
              await addSlotAsItem(appId, secret, serviceTypeId, planId, songSlots[songIndex]!, sequence, songStore.songs, localService.value.sermonPassage, tItem.length)
              songIndex++
            } else if (isScriptureItem && scriptureIndex < scriptureSlots.length) {
              await addSlotAsItem(appId, secret, serviceTypeId, planId, scriptureSlots[scriptureIndex]!, sequence, songStore.songs, localService.value.sermonPassage, tItem.length)
              scriptureIndex++
            } else if (!isSongItem && !isScriptureItem) {
              await createItem(appId, secret, serviceTypeId, planId, {
                title: tItem.title,
                itemType: tItem.itemType === 'header' ? 'header' : 'regular',
                description: tItem.description,
                sequence,
                length: tItem.length,
              })
            }
            sequence++
          } catch (e) {
            failures.push(tItem.title)
          }
        }

        for (let i = songIndex; i < songSlots.length; i++) {
          try {
            await addSlotAsItem(appId, secret, serviceTypeId, planId, songSlots[i]!, sequence, songStore.songs, localService.value.sermonPassage)
            sequence++
          } catch {
            const slot = songSlots[i]!
            failures.push(slot.kind === 'SONG' ? ((slot as any).songTitle ?? 'Song') : ((slot as any).hymnName ?? 'Hymn'))
          }
        }

        for (let i = scriptureIndex; i < scriptureSlots.length; i++) {
          try {
            await addSlotAsItem(appId, secret, serviceTypeId, planId, scriptureSlots[i]!, sequence, songStore.songs, localService.value.sermonPassage)
            sequence++
          } catch {
            failures.push('Scripture')
          }
        }
      } else {
        for (const slot of localService.value.slots) {
          try {
            await addSlotAsItem(appId, secret, serviceTypeId, planId, slot, sequence, songStore.songs, localService.value.sermonPassage)
            sequence++
          } catch {
            const label = slot.kind === 'SONG' ? (slot as any).songTitle ?? 'Song'
              : slot.kind === 'HYMN' ? (slot as any).hymnName ?? 'Hymn'
              : slot.kind === 'SCRIPTURE' ? 'Scripture'
              : slot.kind
            failures.push(label)
          }
        }
      }
    }

    // Add selected PC teams to the plan (D-04). Non-fatal per partial-failure pattern.
    // Fetch plan times to supply the required time relationship to needed_positions.
    let planServiceTimeId: string | undefined
    try {
      const planTimes = await fetchPlanTimes(appId, secret, serviceTypeId, planId)
      planServiceTimeId = planTimes.find((t) => t.timeType === 'service')?.id ?? planTimes[0]?.id
    } catch {
      // Non-fatal: if plan times cannot be fetched, proceed without time relationship
    }
    // For existing plans, skip teams already present to avoid duplicates (BUG 2 fix).
    let existingTeamIds = new Set<string>()
    if (exportMode.value === 'existing') {
      try {
        existingTeamIds = await fetchPlanNeededPositionTeamIds(appId, secret, serviceTypeId, planId)
      } catch {
        // Non-fatal: if we can't fetch existing positions, proceed and let addTeamToPlan
        // fail non-fatally for any duplicates
      }
    }
    for (const teamId of selectedPcTeamIds.value) {
      if (existingTeamIds.has(teamId)) continue
      try {
        await addTeamToPlan(appId, secret, serviceTypeId, planId, teamId, planServiceTimeId)
      } catch {
        // Non-fatal: team-add failures do not block export completion
      }
    }

    // Mark service as exported in Firestore
    await serviceStore.updateService(localService.value.id, {
      pcExportedAt: serverTimestamp(),
      pcPlanId: planId,
      status: 'exported',
    })

    localService.value.pcExportedAt = new Date() as any
    localService.value.pcPlanId = planId
    localService.value.status = 'exported'

    showExportDialog.value = false

    if (failures.length > 0) {
      exportError.value = `Plan ${exportMode.value === 'existing' ? 'updated' : 'created'} but ${failures.length} item(s) failed: ${failures.join(', ')}`
    } else {
      pcExported.value = true
      setTimeout(() => { pcExported.value = false }, 3000)
    }
  } catch (e) {
    exportError.value = e instanceof Error ? e.message : 'Export failed'
  } finally {
    isExporting.value = false
  }
}

async function onShare() {
  if (!localService.value || !serviceStore.orgId) return
  isSharing.value = true
  try {
    const token = await serviceStore.createShareToken(localService.value, serviceStore.orgId)
    const url = `${window.location.origin}/share/${token}`
    await navigator.clipboard.writeText(url)
    shareCopied.value = true
    setTimeout(() => {
      shareCopied.value = false
    }, 2000)
  } catch (err) {
    console.error('Share failed:', err)
    shareError.value = 'Failed to create share link'
    setTimeout(() => {
      shareError.value = null
    }, 3000)
  } finally {
    isSharing.value = false
  }
}

// ── Delete ─────────────────────────────────────────────────────────────────────

async function onDelete() {
  if (!localService.value) return
  isDeleting.value = true
  try {
    await serviceStore.deleteService(serviceId.value)
    router.push('/services')
  } finally {
    isDeleting.value = false
    showDeleteConfirm.value = false
  }
}

// ── Save ───────────────────────────────────────────────────────────────────────

async function onSave() {
  if (!localService.value || !isDirty.value) return
  isSaving.value = true
  try {
    const { id, createdAt, updatedAt, ...data } = localService.value

    // Compare song IDs globally to update lastUsedAt for newly assigned songs
    if (originalService.value) {
      const original = originalService.value
      const newSongIds = new Set(
        localService.value.slots
          .filter((s) => s.kind === 'SONG' && (s as SongSlot).songId)
          .map((s) => (s as SongSlot).songId!),
      )
      const oldSongIds = new Set(
        original.slots
          .filter((s) => s.kind === 'SONG' && (s as SongSlot).songId)
          .map((s) => (s as SongSlot).songId!),
      )

      // Update lastUsedAt for newly added songs
      for (const songId of newSongIds) {
        if (!oldSongIds.has(songId)) {
          const songSlot = localService.value.slots.find(
            (s) => s.kind === 'SONG' && (s as SongSlot).songId === songId,
          ) as SongSlot
          await serviceStore.assignSongToSlot(id, localService.value.slots.indexOf(songSlot), {
            id: songId,
            title: songSlot.songTitle!,
            key: songSlot.songKey!,
          })
        }
      }
    }

    // Persist the full slot array (reindexed) and other fields
    await serviceStore.updateService(id, {
      name: data.name,
      teams: data.teams,
      sermonPassage: data.sermonPassage,
      sermonTopic: data.sermonTopic ?? '',
      notes: data.notes,
      status: data.status,
      slots: reindexSlots(data.slots),
    })

    // Mark current local state as clean (don't overwrite localService — user may still be typing)
    originalService.value = JSON.parse(JSON.stringify(localService.value))
  } finally {
    isSaving.value = false
  }
}

// ── Undo (restore previous autosave snapshot) ───────────────────────────────────

function onUndo() {
  if (!previousService.value) return
  // Restore previous snapshot — this will trigger another autosave after 0.5s
  localService.value = JSON.parse(JSON.stringify(previousService.value))
  previousService.value = null
  autosaveStatus.value = 'idle'
  if (autosaveTimer) {
    clearTimeout(autosaveTimer)
    autosaveTimer = null
  }
}
</script>
