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
              <!-- BL-01 / 31-PATTERNS § 4a row 1. This was gated on
                   `authStore.isEditor` alone, so the picker still rendered on a
                   `planned`/`exported` service: picking a Sunday mutated
                   `localService.date`, the 800ms debounce fired a full-document
                   `onSave`, and all three enforcement layers refused it — with
                   nothing on screen, because the autosave error line at :93
                   lives inside `v-if="canEditService"`. `canEditService` (not
                   `isLocked`) so a viewer keeps the same read-only branch it
                   always had — this is the class-D inverse, a swap, not a
                   deletion (31-UI-SPEC § 3). -->
              <h1 v-if="!canEditService" class="text-xl font-semibold text-gray-100">{{ formattedDate }}</h1>
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
              <!-- D-01: the status badge is NOT a control. The clickable editor
                   branch that used to sit here cycled draft -> planned ->
                   exported -> draft on a bare click, which let a user mark a
                   service "Exported" without ever exporting it and made
                   reopening an unlabelled click with no warning. Both are
                   deleted; status now moves only through the named actions
                   (Mark as Planned / Reopen for editing) and the real Planning
                   Center export. This <span> is the pre-existing viewer branch,
                   now rendered for everyone — a deletion, not a rewrite, which
                   is why its px-2 py-0.5 is untouched (31-UI-SPEC § 2).
                   It reads as status rather than button by subtraction: not a
                   <button>, not focusable, no cursor-pointer, no hover response.
                   Deliberately no role="status" (that is a live region) and no
                   title tooltip — the lock banner below is the explanation. -->
              <span
                class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border"
                :class="statusBadgeClasses[localService.status]"
                data-testid="service-status-pill"
              >
                <svg v-if="localService.status === 'planned'" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-3 w-3" aria-hidden="true">
                  <path fill-rule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clip-rule="evenodd" />
                </svg>
                <svg v-else-if="localService.status === 'exported'" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-3 w-3" aria-hidden="true">
                  <path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clip-rule="evenodd" />
                </svg>
                {{ statusLabel }}
              </span>
            </div>
          </div>

          <!-- Save area. R100 (48-03): QuarterView's button-cluster recipe
               (QuarterView.vue:13) applied verbatim — Mark as Planned and the
               action-bar items stack full-width below `sm` and sit inline at
               `sm` and above, matching the Schedule screen's existing
               convention (same breakpoint project-wide). -->
          <div class="flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-end gap-2 w-full sm:w-auto [&>*]:w-full sm:[&>*]:w-auto [&>*]:justify-center sm:[&>*]:justify-start">
            <!-- D-02: Mark as Planned — the draft half of the two named
                 transitions that replace the deleted cycle. Placed immediately
                 left of Export so the lifecycle reads left-to-right in the
                 order a planner performs it: suggest -> mark planned -> export.
                 Secondary treatment (gray, like its neighbours), NOT indigo:
                 Save is the row's only accent-filled control and a second
                 primary beside it competes with it.
                 Deliberately no confirm dialog (D-10 — reversible in one click
                 from the banner that appears in the same instant) and no
                 "your service is empty" completeness gate (that would be a new
                 product rule, not a lock layer). -->
            <button
              v-if="canEditService"
              type="button"
              data-testid="mark-planned-btn"
              :disabled="isTransitioning"
              class="print:hidden inline-flex items-center rounded-md px-3 py-2 text-sm font-medium text-gray-200 bg-gray-800 hover:bg-gray-700 transition-colors border border-gray-700 disabled:opacity-50"
              @click="onMarkAsPlanned"
            >
              Mark as Planned
            </button>

            <!-- 36-03 (R068): the one shared, declarative action bar
                 (ContextualActionBar.vue / buildActionBarItems, 36-02)
                 replaces the four unconditional buttons this comment block
                 used to sit above — Suggest All Songs, Export to PC (no more
                 Copy for PC fallback, owner follow-up), and Save now render
                 per-tab from `activeActionItems` instead of unconditionally
                 on every tab. Present (design 1a) also renders here while
                 the Slides tab is active, immediately left of Save, driven
                 by `slidesTabRef`. -->
            <ContextualActionBar :items="activeActionItems" />
          </div>
        </div>

        <!-- Failed-transition surface while DRAFT. The locked counterpart
             lives in the lock banner, because the autosave error line above
             is removed at locked statuses (31-04) — precisely when a failed
             Reopen fires.

             Owner follow-up (2026-08-05) moved this BELOW the button row
             instead of inline beside it, the same request and the same
             treatment the R071 note below already got. It matters more here
             than there: this string is the long one —
             "Couldn't save your changes — they're still here. Check your
             connection; editing again will retry." — and inline inside a
             `flex items-center gap-3` row it competed with the buttons for
             width and pushed the action bar around at the exact moment a save
             had just failed. Below the row it gets the full width and the
             buttons never move.

             Same testid, same copy, same `canEditService && lifecycleError`
             condition as before the move — the existing assertions
             (ServiceEditorView.test.ts:4445, :5147) check existence and text,
             never position, and pass unchanged. -->
        <div
          v-if="canEditService && lifecycleError"
          class="flex justify-end -mt-1 mb-3"
        >
          <span
            class="text-sm text-red-400"
            data-testid="lifecycle-error"
          >{{ lifecycleError }}</span>
        </div>

        <!-- 34-12/R071 note — owner follow-up moved it BELOW the button row
             instead of inline beside it ("can we put [it] under the buttons
             instead of alongside them"), at the same time `Copy for PC` was
             deleted entirely. Same testid, same copy, same live router-link
             as before the move.

             ★ THE TRAP: this note used to render only when a `copy-pc` item
             was in the action-bar list — a coupling that kept it off the
             Slides/Roles tabs for free (R068's own regression: `Suggest All
             Songs`/`Copy for PC` leaking onto every tab). Deleting `copy-pc`
             destroys that coupling, so `activeTab === 'service-order'` is
             now an EXPLICIT condition here, alongside the pre-existing
             `canEditService && !authStore.hasPcCredentials` gate — asserted
             absent on Slides and Roles in
             `ServiceEditorView.test.ts` (R068 regression suite).

             39-05 (R089): the org's integration toggle is now ALSO composed
             into this condition. Nudging a church to configure a feature it
             deliberately turned off is misleading, so the hint hides
             whenever Planning Center is disabled — regardless of tab or
             credential state. -->
        <div
          v-if="activeTab === 'service-order' && canEditService && !authStore.hasPcCredentials && authStore.settings.pcEnabled"
          class="flex justify-end -mt-1 mb-3"
        >
          <span
            data-testid="pc-credentials-missing-note"
            class="print:hidden text-xs text-gray-500"
          >
            Planning Center export needs credentials for this organization —
            <router-link :to="{ name: 'settings' }" class="text-indigo-400 hover:text-indigo-300 underline">configure them in Settings</router-link>.
          </span>
        </div>

        <!-- 32-05/32-UI-SPEC § 3: sticky save-status bar, mutually exclusive
             with the lock banner below (canEditService vs isLocked).

             34-10 (UAT F4) — repro: mark the service Planned, reopen it for
             editing, land on this element rendered with a full border/
             background/padding and nothing inside it (SaveStatusIndicator's
             idle branch renders nothing) — an empty bordered box pinned to
             the top of the scrollport.

             Rule being honored: 31-UI-SPEC E5, "don't render an empty box",
             already applied here by SlideGrid.vue:68-73 and :84-90 via
             `v-if` on the wrapper.

             Why THIS wrapper diverges from that mechanism: it contains the
             aria-live region below. Assistive technology announces
             MUTATIONS to a region it is already monitoring, not content a
             region was created already holding — unmounting this wrapper at
             idle (the v-if approach) would cost the first status
             announcement of every session, a real R041 regression traded
             for a cosmetic fix. So `v-if="canEditService"` stays (a viewer
             or a locked service still renders nothing here — a permission
             concern, not a status one), and instead only the CHROME is
             conditional on `serviceSaveStatusVisible`: at idle the element
             carries no classes at all — no border, no background, no
             padding, no margin, no sticky positioning — an empty block
             element around an empty block element, contributing zero
             height. The box is the chrome; removing the chrome removes the
             box and keeps the region mounted.

             34-07 (T-34-07-06) — ADDITIONALLY requires
             `congregationalSlotIndex === null`. A Teleported modal leaves
             this page mounted underneath it, and the clause above already
             keeps this region mounted at idle (34-10), so without this
             extra condition the congregational-editor modal's own
             SaveStatusIndicator (same `service:{serviceId}` surface id)
             would coexist with this one — two polite live regions carrying
             identical text, which double-announce and make a
             `[data-testid="save-status"]` selector ambiguous about which
             node it matched. Do NOT "simplify" this back to a permission-only
             gate, and do NOT fix the collision by giving the modal a
             different surface id — that would create two DISAGREEING
             statuses instead, which is worse.

             R102 (48-03): the wrapper's `flex items-center gap-2` is now
             UNCONDITIONAL (previously part of the serviceSaveStatusVisible
             ternary) so the relocated Undo link lays out correctly beside
             SaveStatusIndicator even at idle — only border/background/
             padding/sticky/mb-3 stay conditional on there being a status to
             report. This does not reintroduce the 31-UI-SPEC E5 empty-box
             regression: SaveStatusIndicator renders nothing visible at idle
             and the Undo link is `v-if="previousService"`-gated, so an idle
             service with no undo-able snapshot still renders a
             zero-visible-chrome `<div>`. -->
        <div
          v-if="canEditService && congregationalSlotIndex === null"
          :class="['flex items-center gap-2', serviceSaveStatusVisible
            ? 'sticky top-0 z-10 mb-3 rounded-md border border-gray-800 bg-gray-900 px-4 py-2'
            : '']"
          data-testid="service-save-status-bar"
        >
          <SaveStatusIndicator :surface-id="`service:${serviceId}`" />
          <!-- R102 (48-03): Undo relocated here from the header Save area —
               same gate (previousService; the wrapper already carries
               canEditService, so the redundant `canEditService &&` prefix is
               dropped), same onUndo handler, same Ctrl+Z keybinding, now
               rendered as a link beside the save-status text instead of a
               bordered button among the primary actions. -->
          <button
            v-if="previousService"
            type="button"
            data-testid="undo-link"
            title="Undo last save (Ctrl+Z)"
            class="text-xs text-indigo-400 hover:text-indigo-300 underline transition-colors"
            @click="onUndo"
          >Undo</button>
        </div>

        <!-- D-05/D-06: THE lock banner. One element, rendered once, and its
             "once" is guaranteed structurally — it sits here, outside all three
             v-show tab panels, so switching tabs cannot re-render or duplicate
             it. It is also directly beneath the status pill it explains.

             sticky top-0: <main> in AppShell is the scroll container and nothing
             between it and here sets overflow, so this pins to the top of the
             scrollport. A locked service is otherwise exactly the "saves were
             invisible above the fold" complaint waiting to happen — scroll to
             the bottom of the Service Order tab, find no Add Element, and have
             no explanation on screen. z-10 (not z-30) keeps it above page
             content but BELOW the sidebar (z-30), its backdrop (z-20) and every
             Teleported dialog (z-50). bg-amber-950 is opaque on purpose: page
             content scrolls underneath a sticky element and would otherwise
             read through the banner's own text.

             Viewers do NOT see it: a viewer cannot edit at any status, so
             "editing is locked" would explain a restriction that is not the
             reason they cannot edit, and would hand them a Reopen button they
             may not use — the dead affordance D-05 exists to eliminate.

             Deliberately not a live region: this is persistent page furniture,
             not an announcement, and aria-live here would re-announce on every
             reactive touch. The lock glyph is aria-hidden — the sentence
             already says "locked".

             ★ 31-04 fills in the read-only tab renderings beneath this. The
             banner ships HERE because lifecycleError needs a host that renders
             while locked, and the autosave error line above is removed at
             locked statuses. -->
        <div
          v-if="authStore.isEditor && isLocked"
          class="sticky top-0 z-10 mb-3 flex flex-wrap items-center gap-3 rounded-md border border-amber-800 bg-amber-950 px-4 py-3"
          data-testid="service-lock-banner"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
               class="h-4 w-4 flex-none text-amber-400" aria-hidden="true">
            <path fill-rule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clip-rule="evenodd" />
          </svg>

          <p class="min-w-0 flex-1 text-sm text-amber-200" data-testid="service-lock-banner-text">
            <span class="font-medium">{{ lockBannerLead }}</span>
            {{ lockBannerBody }}
          </p>

          <button
            type="button"
            data-testid="reopen-service-btn"
            :disabled="isTransitioning"
            class="flex-none rounded-md border border-amber-700 bg-amber-900/60 px-3 py-2 text-sm font-medium text-amber-100 transition-colors hover:bg-amber-900 disabled:opacity-50"
            @click="onReopenRequest"
          >
            Reopen for editing
          </button>

          <!-- Failed-transition surface while LOCKED. basis-full drops it to its
               own row beneath the copy and the Reopen button, which doubles as
               the retry affordance. text-red-300 (not red-400) because it sits
               on the opaque amber-950 fill rather than the gray-950 page. -->
          <p
            v-if="lifecycleError"
            class="basis-full text-sm text-red-300"
            data-testid="service-lock-banner-error"
          >{{ lifecycleError }}</p>
        </div>

        <!-- Delete confirmation dialog -->
        <Teleport to="body">
          <div v-if="showDeleteConfirm" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
            <div class="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4">
              <h2 class="text-base font-semibold text-gray-100 mb-2">Delete service?</h2>
              <p class="text-sm text-gray-400 mb-6" data-testid="delete-service-confirm-body">{{ deleteServiceConfirmBody }}</p>
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

        <!-- Slot delete confirmation dialog (D-14) -->
        <Teleport to="body">
          <div v-if="showSlotDeleteConfirm" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
            <div class="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4">
              <h2 class="text-base font-semibold text-gray-100 mb-2">{{ deleteConfirmHeading }}</h2>
              <p class="text-sm text-gray-400 mb-6">{{ deleteConfirmBody }}</p>
              <div class="flex justify-end gap-3">
                <button
                  type="button"
                  @click="showSlotDeleteConfirm = false; pendingDeleteIndex = null; pendingDeleteIsClear = false"
                  class="rounded-md px-4 py-2 text-sm font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 transition-colors border border-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  @click="confirmSlotDelete"
                  class="rounded-md px-4 py-2 text-sm font-medium text-white bg-red-700 hover:bg-red-600 transition-colors"
                >
                  Remove
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
                    class="inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors disabled:opacity-50"
                  ><span
                      v-if="isExporting"
                      data-testid="export-spinner"
                      aria-hidden="true"
                      class="h-4 w-4 border-2 border-white/70 border-t-transparent rounded-full animate-spin"
                    ></span>{{ isExporting ? 'Exporting...' : exportMode === 'existing' ? 'Add to Plan' : 'Export' }}</button>
                </div>
              </template>
            </div>
          </div>
        </Teleport>

        <!-- 34-07 (owner UAT F1) — the congregational-reading editor modal.
             Teleported to body, same scrim/panel shape as the export dialog
             above (an established pattern in this file, not a new one).
             `ServiceEditorView` is the only place that can host it: it owns
             `localService`, `canEditService` and the one `useAutoSave` over
             `localService`. Keyed on `congregationalSlot.id` (WR-04,
             34-PATTERNS.md) — `CongregationalEditor` seeds its editable
             state ONCE at mount and is not reactive to a later prop change,
             so swapping which slot is being edited MUST force a fresh
             instance or a save would silently misattribute to the first
             slot the instance ever saw. -->
        <Teleport to="body">
          <div
            v-if="congregationalSlot !== null"
            class="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
            data-testid="congregational-editor-modal"
          >
            <div class="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[85vh] flex flex-col">
              <div class="flex items-center justify-between gap-3 px-6 py-4 border-b border-gray-800 shrink-0">
                <h2 class="text-base font-semibold text-gray-100">Congregational Reading</h2>
                <div class="flex items-center gap-3">
                  <!-- R041/T-34-07-05: the shared indicator on the SAME
                       `service:{serviceId}` surface id the page's sticky bar
                       uses — one aggregator, one save path, one surface id,
                       status visible while this panel is open. -->
                  <SaveStatusIndicator :surface-id="`service:${serviceId}`" />
                  <button
                    type="button"
                    class="p-1.5 rounded-md text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors"
                    aria-label="Close"
                    data-testid="congregational-editor-close"
                    @click="closeCongregationalEditor"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              <div class="flex-1 overflow-y-auto px-6 py-4">
                <CongregationalEditor
                  :key="congregationalSlot.id"
                  data-testid="congregational-editor-panel"
                  :reference="slotToScriptureRef(congregationalSlot)"
                  :sections="congregationalSlot.congregationalSections ?? []"
                  @update:sections="onCongregationalSectionsChange(congregationalSlotIndex!, $event)"
                  @delete="onCongregationalDelete(congregationalSlotIndex!)"
                  @close="closeCongregationalEditor"
                />
              </div>
            </div>
          </div>
        </Teleport>

        <!-- R037 reopen confirm (D-10). Opened ONLY when the service carries
             real Planning Center export evidence; a `planned` service — or a
             legacy `exported` one that the deleted cycle hand-set — reopens on
             one click with no dialog. A dialog with nothing to warn about
             trains people to click through the one that matters.

             Shell copied from the delete-service confirm above (there is no
             shared confirm component in this repo; every one is a hand-rolled
             Teleport in its owning view), widened to max-w-md because this body
             runs two paragraphs.

             ★ The confirm button is INDIGO, not the red of the two delete
             confirms. Reopening deletes nothing and is reversible in one click.
             Colouring it red would teach users that red means "proceed", which
             is the desensitisation D-10 guards against. -->
        <Teleport to="body">
          <div v-if="showReopenConfirm" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
            <div class="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-6 w-full max-w-md mx-4"
                 data-testid="reopen-confirm-dialog">
              <h2 class="text-base font-semibold text-gray-100 mb-2">Reopen this service for editing?</h2>

              <p class="text-sm text-gray-400 mb-3" data-testid="reopen-confirm-pc-warning">
                {{ reopenPcWarning }}
              </p>
              <!-- This paragraph is true ONLY because the reopen keeps pcPlanId
                   (D-11). If that ever changes, this sentence changes with it. -->
              <p class="text-sm text-gray-400 mb-6">
                Edits you make now won't reach Planning Center until you export again.
                Re-exporting can update the same plan, so you won't create a duplicate.
              </p>

              <div class="flex justify-end gap-3">
                <button
                  type="button"
                  :disabled="isTransitioning"
                  @click="showReopenConfirm = false"
                  class="rounded-md px-4 py-2 text-sm font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 transition-colors border border-gray-700 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  data-testid="reopen-confirm-btn"
                  :disabled="isTransitioning"
                  @click="onConfirmReopen"
                  class="rounded-md px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors disabled:opacity-50"
                >
                  Reopen for editing
                </button>
              </div>
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

        <!-- Tab bar: Service Order / Slides / Roles (Roles tab is editor-only
             — Phase 16.2 removal decision). R069 (36-03): Slides sits between
             Service Order and Roles — a reposition of the existing three
             buttons, not a restyle; each button keeps its own class strings,
             `:class` expression and `@click` assignment unchanged. -->
        <div class="flex items-center gap-1 mb-3 border-b border-gray-800 pb-0">
          <button
            type="button"
            class="px-4 py-2 text-sm font-medium rounded-t-md transition-colors -mb-px border-b-2"
            :class="activeTab === 'service-order'
              ? 'text-indigo-300 border-indigo-500 bg-gray-900'
              : 'text-gray-400 border-transparent hover:text-gray-200 hover:border-gray-600'"
            @click="activeTab = 'service-order'"
          >
            Service Order
          </button>
          <!-- Slides tab: visible to viewers as well as editors (R031) — not
               gated like Roles below. Write controls inside the panel are
               gated separately by the editor flag SlidesTab receives. Label
               stays "Slides" here; the first tab was renamed to
               "Service Order" in Phase 27 (UI-SPEC Mockup Correction 5). -->
          <button
            type="button"
            class="px-4 py-2 text-sm font-medium rounded-t-md transition-colors -mb-px border-b-2"
            :class="activeTab === 'slides'
              ? 'text-indigo-300 border-indigo-500 bg-gray-900'
              : 'text-gray-400 border-transparent hover:text-gray-200 hover:border-gray-600'"
            @click="activeTab = 'slides'"
          >
            Slides
          </button>
          <button
            v-if="authStore.isEditor"
            type="button"
            class="px-4 py-2 text-sm font-medium rounded-t-md transition-colors -mb-px border-b-2"
            :class="activeTab === 'roles'
              ? 'text-indigo-300 border-indigo-500 bg-gray-900'
              : 'text-gray-400 border-transparent hover:text-gray-200 hover:border-gray-600'"
            @click="activeTab = 'roles'"
          >
            Roles
          </button>
        </div>

        <div v-show="activeTab === 'service-order'" data-testid="service-order-panel">
        <!-- Teams configuration -->
        <div class="mb-3 rounded-lg bg-gray-900 border border-gray-800 p-3">
          <div class="flex items-center gap-4">
          <h2 class="text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">Teams</h2>
          <!-- Editor: checkboxes. 31-UI-SPEC gate migration, CLASS B — this
               block carried no lock term at all, so an `isExportedLocked` grep
               never found it. Widened to `canEditService`; the viewer branch
               below (class E) now absorbs the locked editor too.
               The two `:disabled="isExportedLocked"` bindings that used to sit
               inside were CLASS C (pure) and are DELETED, not rewritten: D-05 is
               "removed, not disabled", this whole block is gone when locked, and
               `:disabled="canEditService"` would have disabled the controls
               exactly when editing IS allowed. Their orphaned
               `disabled:opacity-50` classes go with them. -->
          <div v-if="canEditService" class="flex flex-wrap items-center gap-4">
            <label
              v-for="team in AVAILABLE_TEAMS"
              :key="team"
              class="flex items-center gap-2 cursor-pointer"
            >
              <input
                type="checkbox"
                :checked="localService.teams.includes(team)"
                @change="toggleTeam(team)"
                class="h-4 w-4 rounded border-gray-600 bg-gray-800 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-gray-900"
              />
              <span class="text-sm text-gray-200">{{ team }}</span>
            </label>
            <input
              v-if="localService.teams.includes('Special')"
              v-model="localService.name"
              type="text"
              placeholder="e.g. Good Friday, Easter"
              class="rounded-md bg-gray-800 border border-gray-700 text-indigo-300 text-sm px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-gray-500 w-48"
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
                <!-- Editor: editable input. CLASS B (no lock term today) →
                     `canEditService`; D-07 locks sermon topic with no carve-out.
                     Its `:disabled="isExportedLocked"` was CLASS C (pure) and is
                     DELETED along with `disabled:opacity-50`. -->
                <input
                  v-if="canEditService"
                  v-model="localService.sermonTopic"
                  type="text"
                  placeholder="e.g. Grace and forgiveness, The prodigal son"
                  class="w-full rounded-md bg-gray-800 border border-gray-700 text-gray-100 placeholder-gray-500 text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <!-- Viewer: read-only text -->
                <p v-else class="text-sm text-gray-200">{{ localService.sermonTopic || '—' }}</p>
              </div>
              <div>
                <p class="text-xs text-gray-500 mb-1">Sermon Passage</p>
                <!-- Editor: ScriptureInput. CLASS A — the only true 1:1 shape. -->
                <ScriptureInput
                  v-if="canEditService"
                  :modelValue="localService.sermonPassage"
                  :sermonPassage="null"
                  :showOverlapWarning="false"
                  label="Sermon Passage"
                  @update:modelValue="onSermonPassageChange"
                />
                <!-- Lifecycle lock: read-only passage. CLASS D — this is the
                     INVERSE branch, so it keeps pointing at the locked state
                     (`isLocked`, now `planned` as well as `exported`). Rewriting
                     it to `canEditService` would delete the very rendering the
                     line above depends on and leave a locked editor with nothing. -->
                <p v-else-if="authStore.isEditor && isLocked" class="text-sm text-gray-200">
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

        <!-- Dynamic Service Flow. 260811-vsr: the item list fills the tab's content
             width, matching the Teams / Sermon Context blocks above it. (An earlier
             max-w-[1060px] cap from the mockup was removed — it applied only to this
             list while the chrome above stayed full-width, so the sections read as a
             constrained/narrow widget on wide screens. Owner feedback 2026-08-12.) -->
        <div class="space-y-1.5">
          <!-- R110: the key folds in `slotRenderNonce` (bumped in `onSlotSortEnd`
               after a drag). Vue does not allow a `:key` on a child of a
               `<template v-for>` — it must live on the template tag — so the nonce
               rides the group key here. A bump gives every section fragment a fresh
               key, forcing Vue to discard and rebuild the ref-bearing section-list
               container `<div>` (and its Sortable-orphaned child) from reactive
               state. `group.key` alone still uniquely identifies each section, so
               ordering/identity across sections is unchanged between bumps. -->
          <template v-for="group in slotSectionGroups" :key="`${group.key}-${slotRenderNonce}`">
            <!-- Section header: rendered unconditionally once per real section (UI-SPEC §1) —
                 never rendered for the trailing ungrouped bucket, which has no header. Structurally
                 a sibling of the section's list container, not a member of it, so it is excluded from
                 that section's Sortable instance without relying on a `draggable` selector. -->
            <div
              v-if="group.label"
              class="section-header flex items-center gap-2 pt-3 pb-1 first:pt-0"
              :data-testid="`section-header-${group.key}`"
            >
              <span class="text-[11px] uppercase tracking-[.14em] text-indigo-300/80">{{ group.label }}</span>
              <span class="h-px flex-1 bg-gradient-to-r from-gray-800 to-transparent"></span>
              <span class="text-[11px] text-gray-500" :data-testid="`section-slide-count-${group.key}`">{{ sectionSlideCount(group.entries) }} {{ sectionSlideCount(group.entries) === 1 ? 'slide' : 'slides' }}</span>
              <button
                v-if="canEditService"
                type="button"
                class="text-[11.5px] font-medium text-indigo-400 hover:text-indigo-300"
                :data-testid="`section-add-item-${group.key}`"
                @click="toggleSectionAdd(group.key as ServiceSection)"
              >＋ Add item</button>
            </div>

            <!-- No-Section band (260811-vsr): the trailing ungrouped/legacy bucket gets a
                 muted/dashed header so its items read as "not placed yet", clearly distinct
                 from the last real section (Post-Service). Rendered ONLY for the ungrouped
                 group and ONLY when non-empty. Deliberately NOT the `section-header-*` testid,
                 and carries NO slide-count or add-item control, so the "exactly 5 real
                 headers" and "no ungrouped count/add-item" assertions stay valid. A sibling
                 of the list container, never a member of its Sortable instance. -->
            <div
              v-if="group.key === 'ungrouped' && group.entries.length > 0"
              class="flex items-center gap-2 mt-3 mb-1 rounded-lg border border-dashed border-gray-700 px-3 py-1.5 text-gray-500"
              data-testid="no-section-band"
            >
              <span class="text-[11px] uppercase tracking-[.14em]">No Section</span>
              <span class="h-px flex-1 bg-gradient-to-r from-gray-800 to-transparent"></span>
            </div>

            <!-- Per-band inline add chip row (36-04, UI-SPEC §9 discretionary call: inline,
                 not a popover). A sibling of BOTH the header above and the section list
                 container below — never a member of either, so it never enters that
                 section's Sortable instance. `group.key` is safely cast: this row only ever
                 opens for a real section (`openSectionAddKey` is `ServiceSection | null` and
                 is only ever set from the add-item button above, itself gated on
                 `group.label`, i.e. never rendered for the trailing ungrouped bucket). -->
            <div
              v-if="canEditService && openSectionAddKey === group.key"
              class="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-gray-700 px-4 py-3"
              :data-testid="`section-add-menu-${group.key}`"
            >
              <button type="button" class="rounded-md border border-gray-700 px-2 py-1 text-[11px] font-medium text-gray-300 hover:bg-gray-800 transition-colors" :data-testid="`section-add-song-${group.key}`" @click="addSlot('SONG', 2, group.key as ServiceSection); openSectionAddKey = null">Song</button>
              <button type="button" class="rounded-md border border-gray-700 px-2 py-1 text-[11px] font-medium text-gray-300 hover:bg-gray-800 transition-colors" :data-testid="`section-add-scripture-${group.key}`" @click="addSlot('SCRIPTURE', undefined, group.key as ServiceSection); openSectionAddKey = null">Scripture</button>
              <button type="button" class="rounded-md border border-gray-700 px-2 py-1 text-[11px] font-medium text-gray-300 hover:bg-gray-800 transition-colors" :data-testid="`section-add-prayer-${group.key}`" @click="addSlot('PRAYER', undefined, group.key as ServiceSection); openSectionAddKey = null">Prayer</button>
              <button type="button" class="rounded-md border border-gray-700 px-2 py-1 text-[11px] font-medium text-gray-300 hover:bg-gray-800 transition-colors" :data-testid="`section-add-message-${group.key}`" @click="addSlot('MESSAGE', undefined, group.key as ServiceSection); openSectionAddKey = null">Message</button>
              <button type="button" class="rounded-md border border-gray-700 px-2 py-1 text-[11px] font-medium text-gray-300 hover:bg-gray-800 transition-colors" :data-testid="`section-add-announcements-${group.key}`" @click="addSlot('ANNOUNCEMENTS', undefined, group.key as ServiceSection); openSectionAddKey = null">Announcements</button>
              <button type="button" class="rounded-md border border-gray-700 px-2 py-1 text-[11px] font-medium text-gray-300 hover:bg-gray-800 transition-colors" :data-testid="`section-add-misc-${group.key}`" @click="addSlot('MISC', undefined, group.key as ServiceSection); openSectionAddKey = null">Miscellaneous</button>
            </div>

            <!-- Section list container: always rendered — populated or not — so it is always a live
                 Sortable drop target (UI-SPEC §1/§2). One Sortable instance is created per container
                 (Task 2); the ungrouped container gets no header and no `data-section`. -->
            <div
              :ref="el => setSectionListRef(group.key, el as Element | null)"
              class="space-y-1.5 rounded-lg transition-colors"
              :class="{ 'bg-indigo-950/20': dragOverSection === group.key }"
              :data-testid="`section-list-${group.key}`"
              :data-section="group.label ? group.key : undefined"
              role="list"
              :aria-label="group.label ? `${group.label} items` : 'Ungrouped items'"
            >
              <!-- Empty-section placeholder: also the live drop target (UI-SPEC §2). Excluded from
                   the `draggable: '.slot-item'` selector, so Sortable never treats it as a member. -->
              <div
                v-if="group.entries.length === 0"
                class="rounded-lg border border-dashed border-gray-800 p-4 text-center"
                :class="{ 'bg-indigo-950/20': dragOverSection === group.key }"
                :data-testid="`section-empty-${group.key}`"
              >
                <!-- ★ Locked variant (31-UI-SPEC E1). The Phase 29 second line
                     tells the user to drag an item in and to change a Section —
                     both dead instructions when the drag handles and the section
                     <select> are gone. Hiding the control while leaving the
                     instruction is worse than either, so the copy changes and the
                     second line drops entirely. The dashed border and the
                     drag-over :class stay: Sortable is destroyed when locked, so
                     `dragOverSection` never fires. -->
                <p class="text-sm text-gray-500">{{ canEditService ? 'No items yet' : 'No items in this section.' }}</p>
                <p v-if="canEditService" class="mt-1 text-xs text-gray-600">
                  {{ group.key === 'post-service'
                    ? 'Drag an item here, or set its Section to Post-Service — runs as people exit, e.g. a cycling announcement deck.'
                    : `Drag an item here, or set its Section to ${group.label}.` }}
                </p>
              </div>

              <template v-for="{ slot, index } in group.entries" :key="slot.id">
            <div
              class="slot-item rounded-lg bg-gray-900 border border-gray-800 p-3 flex flex-col sm:flex-row sm:items-start gap-2"
              :data-testid="`slot-${index}`"
              :data-slot-id="slot.id"
            >
            <!-- Drag handle: editor only, and only while editable. CLASS B — no
                 lock term today, which is why drag-reorder still worked on an
                 exported service. No placeholder gutter is left behind: the
                 viewer layout already ships without this element. -->
            <div v-if="canEditService" class="cursor-grab active:cursor-grabbing text-gray-600 hover:text-gray-400 drag-handle flex-shrink-0 mt-0.5">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M7 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/>
              </svg>
            </div>

            <!-- Zone 2 (260811-vsr): badge rail — ONE colored per-kind pill. Replaces
                 the per-kind inline slotLabel <p> headings. slotLabel(slot, index)
                 supplies the text; kindBadgeClass(kind) the on-theme tint. Fixed width
                 on desktop; a plain block above the field column on mobile (row is flex-col). -->
            <div class="flex-none sm:w-32 sm:pt-0.5">
              <span
                class="inline-flex items-center rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                :class="kindBadgeClass(slot.kind)"
                :data-testid="`slot-badge-${index}`"
              >{{ slotLabel(slot, index) }}</span>
            </div>

            <!-- Zone 3 (260811-vsr): field column — the per-kind selector/content
                 stacked above the consolidated full-width notes field. Walks back
                 Phase 54's sm:flex-row side-by-side; the notes field is full-width now. -->
            <div class="flex-1 min-w-0 flex flex-col gap-2">
              <!-- SONG slot -->
              <template v-if="slot.kind === 'SONG'">
                <div v-if="slot.songId && authStore.vwModeEnabled" class="flex items-center justify-end">
                  <SongBadge
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
                  <!-- Clear-song ×: CLASS A. The assigned-song row above keeps
                       title / key / CCLI link when locked. -->
                  <button
                    v-if="canEditService"
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

                <!-- AI draft song display: editor only. CLASS B — the lock term
                     is ADDED beside the existing data condition; drafts are
                     editor-only proposals and accepting one is a write. -->
                <div
                  v-if="canEditService && aiDraftSongs.has(index)"
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

                <!-- Song picker: editor only, hidden while locked. CLASS A.
                     The `v-else-if` below (class E) renders `Song — Empty` for
                     an unassigned slot, unchanged. -->
                <SongSlotPicker
                  v-if="canEditService"
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
                <div :data-scripture-slot-index="index">
                  <div class="flex-1">
                    <!-- Editor: ScriptureInput. CLASS A. -->
                    <ScriptureInput
                      v-if="canEditService"
                      :modelValue="slotToScriptureRef(slot)"
                      :sermonPassage="localService.sermonPassage"
                      :showOverlapWarning="true"
                      :showAiSuggest="true"
                      :sermonTopic="localService.sermonTopic ?? ''"
                      :recentScriptures="recentScriptureRefs"
                      label="Scripture Reading"
                      @update:modelValue="(ref) => onScriptureChange(index, ref)"
                    />
                    <!-- Lifecycle lock: read-only. CLASS D — INVERSE branch, so
                         it keeps pointing at the locked state (`isLocked`), now
                         reached at `planned` as well as `exported`. ME-02 — one
                         canonical formatter, not a second inline copy of the rule
                         that spelled out a null verseEnd as "Psalms 103:null". -->
                    <p v-else-if="authStore.isEditor && isLocked" class="text-sm text-gray-200">
                      {{ slotScriptureText(slot as ScriptureSlot) }}
                    </p>
                    <!-- Viewer: read-only text -->
                    <p v-else class="text-sm text-gray-200">
                      {{ slotScriptureText(slot) }}
                    </p>
                  </div>
                </div>

                <!-- R047: no slides editor here. The reference typed above IS
                     the scripture slide's source — entering or changing it
                     rebuilds the slot's one reference slide automatically,
                     exactly as changing a song replaces that song's slides.
                     The old "Edit Scripture Slides" panel fetched passage TEXT
                     into a separate reading document, which is Phase 34's
                     congregational-reading concern, not a slide source. -->
              </template>

              <!-- PRAYER slot (260811-vsr): no content beyond the badge + the shared
                   notes-canonical field below. linkUrl/linkLabel remain on the type +
                   in Firestore — UI removal only. The old label + "No assignment needed"
                   hint are replaced by the per-kind badge. -->
              <template v-else-if="slot.kind === 'PRAYER'">
              </template>

              <!-- MESSAGE / ANNOUNCEMENTS / MISC slot (260811-vsr): no content beyond the
                   badge + the shared notes-canonical field below. body/linkUrl/linkLabel
                   remain on the type + in Firestore, read via slotFreeText's notes ?? body
                   fallback. The old label + hint are replaced by the per-kind badge. -->
              <template v-else-if="slot.kind === 'MESSAGE' || slot.kind === 'ANNOUNCEMENTS' || slot.kind === 'MISC'">
                <!-- MISC custom label (R127, Phase 56): a DISTINCT compact "name"
                     input, above the shared notes field. Not a second notes box —
                     the type badge stays "Miscellaneous"; this names the item and
                     becomes the Planning Center title. `= value || undefined` on
                     empty lets stripUndefined drop the key (mirrors the notes
                     input below). Plain text only: :value + {{ }} auto-escape,
                     never v-html (T-56-01). -->
                <template v-if="slot.kind === 'MISC'">
                  <input
                    v-if="canEditService"
                    :value="(slot as NonAssignableSlot).label ?? ''"
                    @input="(slot as NonAssignableSlot).label = ($event.target as HTMLInputElement).value || undefined"
                    type="text"
                    placeholder="Miscellaneous"
                    data-testid="slot-misc-label-input"
                    class="w-full rounded-md bg-gray-800 border border-gray-700 text-gray-200 text-xs px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-gray-500"
                  />
                  <p v-else data-testid="slot-misc-label-text" class="text-sm text-gray-200">{{ miscLabel(slot as NonAssignableSlot) }}</p>
                </template>
              </template>

              <!-- HYMN slot -->
              <template v-else-if="slot.kind === 'HYMN'">
                <!-- Editor: editable fields. CLASS A. -->
                <div v-if="canEditService" class="flex flex-wrap items-center gap-2 mt-1">
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

              <!-- IMPORTED slot (Phase 21): badge carries the label; keep the empty-state hint. -->
              <template v-else-if="slot.kind === 'IMPORTED'">
                <p v-if="!(slot as ImportedSlot).importId" class="text-sm text-gray-400 italic">Imported Slides — Empty</p>
              </template>

                <!-- Consolidated notes-canonical field (260811-vsr): written ONCE for
                     every kind, now FULL-WIDTH and stacked in the field column (walks
                     back Phase 54's sm:w-64 side column). slot.notes takes NO cast —
                     notes? lives on the base MediaAttachableSlot. Plain text only:
                     :value + {{ }} auto-escape, never v-html (T-54-01). `= value ||
                     undefined` on empty lets stripUndefined drop it. -->
                <div>
                  <input
                    v-if="canEditService"
                    :value="slotFreeText(slot)"
                    @input="slot.notes = ($event.target as HTMLInputElement).value || undefined"
                    type="text"
                    :placeholder="notesPlaceholder(slot)"
                    data-testid="slot-notes-input"
                    class="w-full rounded-md bg-gray-800 border border-gray-700 text-gray-200 text-xs px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-gray-500"
                  />
                  <p v-else-if="slotFreeText(slot)" data-testid="slot-notes-text" class="text-xs text-gray-400 whitespace-pre-wrap">{{ slotFreeText(slot) }}</p>
                </div>
            </div>

            <!-- Per-row ⋯ menu (260811-vsr): editor only, hidden while locked
                 (D005/R007). CLASS A — the trigger AND every menu item are gated
                 v-if="canEditService" (T-vsr-01). Owns BOTH Move-to-section
                 (→ onSectionChange, replacing the inline <select>) and Delete
                 (→ removeSlot, replacing the inline ✕). Mirrors SlideActionMenu's
                 ARIA pattern INLINE (trigger + fixed backdrop + absolute role="menu"
                 panel); single-open keyed on slot.id. It lives INSIDE the .slot-item
                 (the Sortable ITEM, not a container) and only opens on click, so it
                 never joins a drag. -->
            <div v-if="canEditService" class="relative flex-shrink-0 mt-0.5">
              <button
                type="button"
                class="p-1 rounded-md text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors"
                :aria-haspopup="'menu'"
                :aria-expanded="openRowMenuId === slot.id ? 'true' : 'false'"
                aria-label="Row options"
                :data-testid="`row-menu-trigger-${slot.id}`"
                title="Row options"
                @click.stop="toggleRowMenu(slot.id)"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="12" cy="5" r="1.5" />
                  <circle cx="12" cy="12" r="1.5" />
                  <circle cx="12" cy="19" r="1.5" />
                </svg>
              </button>

              <!-- Outside-click backdrop -->
              <div v-if="openRowMenuId === slot.id" class="fixed inset-0 z-10" @click="openRowMenuId = null" />

              <!-- Menu panel -->
              <div
                v-if="openRowMenuId === slot.id"
                role="menu"
                class="absolute right-0 top-full mt-1 w-48 origin-top-right rounded-lg border border-gray-700 bg-gray-800 shadow-xl z-20 overflow-hidden py-1"
                :data-testid="`row-menu-panel-${slot.id}`"
              >
                <p class="px-3 pt-1 pb-0.5 text-[10px] uppercase tracking-wider text-gray-500">Move to section</p>
                <button
                  type="button"
                  role="menuitem"
                  class="block w-full px-3 py-1.5 text-left text-sm text-gray-200 hover:bg-gray-700 transition-colors"
                  :data-testid="`row-menu-move-${slot.id}-no-section`"
                  @click="onSectionChange(index, ''); openRowMenuId = null"
                >No section</button>
                <button
                  v-for="s in SERVICE_SECTIONS"
                  :key="s"
                  type="button"
                  role="menuitem"
                  class="block w-full px-3 py-1.5 text-left text-sm text-gray-200 hover:bg-gray-700 transition-colors"
                  :data-testid="`row-menu-move-${slot.id}-${s}`"
                  @click="onSectionChange(index, s); openRowMenuId = null"
                >{{ SERVICE_SECTION_LABELS[s] }}</button>
                <div class="my-1 h-px bg-gray-700"></div>
                <button
                  type="button"
                  role="menuitem"
                  class="block w-full px-3 py-1.5 text-left text-sm text-red-400 hover:bg-gray-700 hover:text-red-300 transition-colors"
                  :data-testid="`row-menu-delete-${slot.id}`"
                  @click="removeSlot(index); openRowMenuId = null"
                >Delete</button>
              </div>
            </div>
            </div>
              </template>
            </div>
          </template>
        </div>

        <!-- Add-to-service palette: editor only, hidden while locked. CLASS A.
             36-05: replaces the old Add Element dropdown with a single-state dashed
             chip row (UI-SPEC §8) — no open/closed state, every chip directly
             clickable. The tab does not read as broken with it gone while locked —
             the sticky lock banner is in view at every scroll position and says why. -->
        <div v-if="canEditService" class="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-gray-700 px-4 py-3" data-testid="add-to-service-palette">
          <span class="text-[11px] text-indigo-400">＋ Add to the service</span>
          <button type="button" class="rounded-md border border-gray-700 px-2 py-1 text-[11px] font-medium text-gray-300 hover:bg-gray-800 transition-colors" data-testid="palette-add-song" @click="addSlot('SONG', 2)">Song</button>
          <button type="button" class="rounded-md border border-gray-700 px-2 py-1 text-[11px] font-medium text-gray-300 hover:bg-gray-800 transition-colors" data-testid="palette-add-scripture" @click="addSlot('SCRIPTURE')">Scripture</button>
          <button type="button" class="rounded-md border border-gray-700 px-2 py-1 text-[11px] font-medium text-gray-300 hover:bg-gray-800 transition-colors" data-testid="palette-add-prayer" @click="addSlot('PRAYER')">Prayer</button>
          <button type="button" class="rounded-md border border-gray-700 px-2 py-1 text-[11px] font-medium text-gray-300 hover:bg-gray-800 transition-colors" data-testid="palette-add-message" @click="addSlot('MESSAGE')">Message</button>
          <button type="button" class="rounded-md border border-gray-700 px-2 py-1 text-[11px] font-medium text-gray-300 hover:bg-gray-800 transition-colors" data-testid="palette-add-announcements" @click="addSlot('ANNOUNCEMENTS')">Announcements</button>
          <button type="button" class="rounded-md border border-gray-700 px-2 py-1 text-[11px] font-medium text-gray-300 hover:bg-gray-800 transition-colors" data-testid="palette-add-misc" @click="addSlot('MISC')">Miscellaneous</button>
        </div>

        </div>

        <!-- Roles tab: seeded from the quarterly schedule for this service's date, editor-only data (CR-01/02/03/05) -->
        <div v-show="activeTab === 'roles'">
          <!-- Non-editor: no roster/quarters data was ever subscribed to (Pitfall 4) — read-only note only -->
          <div v-if="!authStore.isEditor" class="rounded-lg bg-gray-900 border border-gray-800 p-6 text-center">
            <p class="text-sm text-gray-400">Who's serving is visible via the shared service link.</p>
          </div>
          <template v-else>
            <!-- Empty state: no quarter covers this service's date -->
            <!-- ★ Locked variant (31-UI-SPEC E4): "assign roles manually below"
                 is a dead instruction once the override picker is gone. Copy
                 swap only — no restyle. -->
            <div v-if="!hasQuarterForServiceDate" class="rounded-lg bg-gray-900 border border-gray-800 p-4 mb-3">
              <p class="text-sm text-gray-400" data-testid="roles-no-schedule-note">
                {{ canEditService
                  ? 'No schedule found for this date — assign roles manually below.'
                  : 'No schedule found for this date.' }}
              </p>
            </div>

            <div class="space-y-2">
              <div
                v-for="assignment in resolvedRoleAssignments"
                :key="assignment.roleId"
                class="rounded-lg bg-gray-900 border border-gray-800 p-3"
              >
                <div class="flex items-center justify-between gap-3 flex-wrap">
                  <div class="flex items-center gap-2 min-w-0">
                    <p class="text-sm font-medium text-gray-100">{{ assignment.roleName }}</p>
                    <span
                      v-if="assignment.overriddenPersonIds !== null"
                      class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-900/40 text-amber-300 border border-amber-800"
                    >Overridden</span>
                  </div>
                  <!-- Reset to schedule: CLASS B. Its own line carried only a
                       DATA condition and was editor-only by ancestry (the
                       `<template v-else>` under the viewer branch above), so an
                       `isExportedLocked` grep never found it. The lock term is
                       ADDED beside the data condition, never substituted for it. -->
                  <button
                    v-if="canEditService && assignment.overriddenPersonIds !== null"
                    type="button"
                    @click="onResetRoleOverride(assignment.roleId)"
                    class="text-xs text-indigo-400 hover:text-indigo-300 transition-colors flex-shrink-0"
                  >
                    Reset to schedule
                  </button>
                </div>
                <p class="text-sm text-gray-300 mt-1">
                  {{ effectiveNames(assignment).length > 0 ? effectiveNames(assignment).join(', ') : 'Nobody scheduled' }}
                </p>
                <!-- Override picker: eligible people are those with this role
                     (mirrors QuarterGrid.vue's hasRole). CLASS B, and the most
                     surprising entry in the table — this div had NO `v-if` of any
                     kind, so nothing but ancestry kept it off a locked service.
                     D-06's "assignments render as names, no checkboxes" is
                     satisfied by removing it: the effective-names line above
                     already renders unconditionally and falls back to
                     `Nobody scheduled`, so no new markup is needed. The
                     "No eligible people have this role" caption goes with it — it
                     exists solely to explain an empty picker. -->
                <div v-if="canEditService" class="mt-2 flex flex-wrap gap-3" data-testid="role-override-picker">
                  <label
                    v-for="person in eligiblePeople(assignment.roleId)"
                    :key="person.id"
                    class="flex items-center gap-1.5 text-xs text-gray-300 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      :checked="assignment.effectivePersonIds.includes(person.id)"
                      @change="onToggleOverridePerson(assignment, person.id)"
                      class="h-3.5 w-3.5 rounded border-gray-600 bg-gray-800 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-gray-900"
                    />
                    {{ person.name }}
                  </label>
                  <span v-if="eligiblePeople(assignment.roleId).length === 0" class="text-xs text-gray-600 italic">No eligible people have this role</span>
                </div>
              </div>
              <p v-if="resolvedRoleAssignments.length === 0" class="text-sm text-gray-500 italic">No roles configured yet.</p>
            </div>
          </template>
        </div>

        <!-- Slides tab: the service-plan rail and (25-04) the slide grid.
             ServiceEditorView is the SOLE owner of useSlideshowAssembly() —
             SlidesTab and everything under it are prop-driven. The tab's own
             "▶ Present" CTA (D-05) sets the `presenting` flag below, reusing
             the same PresentationViewer mount the Service Order tab used to
             own via SlideshowPreview (removed, 27-05). -->
        <div v-show="activeTab === 'slides'">
          <SlidesTab
            v-if="localService"
            ref="slidesTabRef"
            :slots="localService.slots"
            :service-id="localService.id"
            :org-id="authStore.orgId!"
            :assembled-slideshow="assembledSlideshow"
            :groups-by-slot-id="groupsBySlotId"
            :is-editor="authStore.isEditor"
            :service-locked="isLocked"
            :groups-loading="slideGroupsStore.isLoading"
            :active="activeTab === 'slides'"
            :ensure-group-materialized="ensureGroupMaterialized"
            @navigate-to-scripture-editor="handleNavigateToScriptureEditor"
            @present="onPresent"
          />
          <PresentationViewer
            v-if="presenting"
            :slides="assembledSlideshow"
            :is-loading="slideshowLoading"
            :initial-index="presentStartIndex"
            @exit="presenting = false"
          />
        </div>

        <!-- Bottom actions: Delete only. Print and Share moved into the top
             ContextualActionBar (R101, 48-03) — see serviceEditorActionBar.ts's
             buildPrintItem/buildShareItem. Delete stays here deliberately,
             below the fold, away from the primary actions a destructive
             control must never sit beside. The `flex-1` spacer that used to
             push Delete past Print/Share is removed; `justify-end` on this
             row now does that job directly (Anti-Patterns / Pitfall 4). -->
        <div class="mt-6 pt-4 border-t border-gray-800 flex flex-wrap items-center justify-end gap-2 print:hidden">
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
import { ref, computed, watch, onMounted, onUnmounted, nextTick, type ComponentPublicInstance } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useServiceStore, ServiceLockedError } from '@/stores/services'
import { useSongStore } from '@/stores/songs'
import { useRosterStore } from '@/stores/roster'
import { useQuartersStore } from '@/stores/quarters'
import { useSlideGroups } from '@/stores/slideGroups'
import { useSaveStatus, hasVisibleSaveStatus } from '@/stores/saveStatus'
import { slotLabel, miscLabel, createSlot, reindexSlots, backfillSlotIds, groupBySection, flattenBySection, orderSlotsBySection } from '@/utils/slotTypes'
import { scripturesOverlap, scriptureRefFromSlot, formatScriptureReference, scriptureSlotAfterReferenceChange } from '@/utils/scripture'
import type { CongregationalSection } from '@/types/slide'
import { getPrimaryKey } from '@/utils/songSearch'
import { resolveServiceRoleAssignments, findQuarterForDate } from '@/utils/serviceRoles'
import type { ResolvedRoleAssignment } from '@/utils/serviceRoles'
import { SERVICE_SECTIONS, SERVICE_SECTION_LABELS } from '@/types/service'
import type { Service, ServiceSlot, SongSlot, ScriptureSlot, NonAssignableSlot, HymnSlot, ImportedSlot, ScriptureRef, SlotKind, ServiceSection } from '@/types/service'
import type { VWType } from '@/types/song'
import type { Person } from '@/types/roster'
import AppShell from '@/components/AppShell.vue'
import SaveStatusIndicator from '@/components/SaveStatusIndicator.vue'
import SongBadge from '@/components/SongBadge.vue'
import SongSlotPicker from '@/components/SongSlotPicker.vue'
import ScriptureInput from '@/components/ScriptureInput.vue'
import ServicePrintLayout from '@/components/ServicePrintLayout.vue'
import PresentationViewer from '@/components/PresentationViewer.vue'
import SlidesTab from '@/components/slides/SlidesTab.vue'
import CongregationalEditor from '@/components/CongregationalEditor.vue'
import ContextualActionBar from '@/components/ContextualActionBar.vue'
import { buildActionBarItems } from '@/views/serviceEditorActionBar'
import { useSlideshowAssembly } from '@/composables/useSlideshowAssembly'
import { useAutoSave } from '@/composables/useAutoSave'
import { fetchServiceTypes, fetchTemplates, fetchServiceTypeTeams, fetchPlans, fetchPlanItems, createPlan, fetchTemplateItems, addSlotAsItem, buildPlanTitle, createItem, updateItem, deleteItem, createPlanTime, fetchPlanNeededPositionTeamIds, fetchTeamPositions, addNeededPosition } from '@/utils/planningCenterApi'
import { serverTimestamp } from 'firebase/firestore'
import Sortable from 'sortablejs'
import { getSongSuggestions } from '@/utils/claudeApi'
import type { AiSongSuggestion } from '@/utils/claudeApi'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const serviceStore = useServiceStore()
const songStore = useSongStore()
const rosterStore = useRosterStore()
const quartersStore = useQuartersStore()
// R029/D-03 cascade target — the group delete cascade's scoped write action.
// Reads for the delete-warning copy go through useSlideshowAssembly's
// re-exposed groupsBySlotId below; the group-bed audio write (setGroupBedMedia)
// now lives entirely on the Slides tab (SlideGroupMusicControl.vue, SlideGrid.vue) —
// this view no longer wraps it (Phase 27-04).
const slideGroupsStore = useSlideGroups()
// R040: the shared, cross-surface save-status aggregator this view now
// reports into instead of hand-duplicating its own status ref.
const saveStatus = useSaveStatus()

// ── Roles tab state (Task 1: tab bar) ──────────────────────────────────────────
// Widened to add the Slides tab (Phase 25-03). Default value is unchanged —
// the editor still opens on the Service Order tab (renamed from 'music' in
// Phase 27, D-03); D-05's auto-selection is about which GROUP is selected
// once the Slides tab itself is opened, not about which tab opens first.
const activeTab = ref<'service-order' | 'roles' | 'slides'>('service-order')

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

// ── Autosave state ─────────────────────────────────────────────────────────────
// 32-05: the hand-rolled status/timer/initialized/saving refs are gone —
// `useAutoSave` (declared below) owns all of that.
const previousService = ref<Service | null>(null)   // snapshot before last autosave (for undo)
// BL-02: two producers, two recovery instructions — each writes its own
// sentence directly into useSaveStatus at its own call site.
const autosaveErrorSource = ref<'reorder' | 'autosave'>('reorder')
const isSharing = ref(false)
const shareCopied = ref(false)
const shareError = ref<string | null>(null)
const showDeleteConfirm = ref(false)
const isDeleting = ref(false)
// D-14: slot delete confirmation
const showSlotDeleteConfirm = ref(false)
const pendingDeleteIndex = ref<number | null>(null)
// D-14: tracks whether the pending delete is a "clear song" (true) vs remove slot (false)
const pendingDeleteIsClear = ref(false)

// D-16: element-type-aware delete-confirmation copy
const pendingSlotKind = computed<SlotKind | null>(() =>
  pendingDeleteIndex.value != null
    ? (localService.value?.slots[pendingDeleteIndex.value]?.kind ?? null)
    : null
)
const deleteConfirmHeading = computed(() =>
  pendingDeleteIsClear.value
    ? 'Remove this item?'                        // clear-song path keeps existing wording
    : 'Remove this element from the plan?'        // D-16 remove-element wording
)
// R029/D-03: the remove-element confirm body must name the TRUE loss —
// the live group's real slide count and whichever attached artefacts are
// genuinely present (a group bed audio, per-slide audio, or operator notes)
// — never a generic "this cannot be undone" alone, and never an
// invented/rounded number. A slot with no group names zero slides and makes
// no attached-media claim. There is no bed video to name (D-18) — the bed is
// audio-only, and a video slide is just one of the group's own slides,
// already counted in slideCount.
const deleteConfirmBody = computed(() => {
  if (pendingDeleteIsClear.value) {
    return 'This will delete the assigned song, scripture, or content from the plan. This cannot be undone.'
  }
  const label = pendingSlotKind.value ? elementLabel(pendingSlotKind.value) : 'this element'
  const slotId = pendingDeleteIndex.value != null
    ? localService.value?.slots[pendingDeleteIndex.value]?.id
    : undefined
  const group = slotId ? groupsBySlotId.value.get(slotId) : undefined
  const slideCount = group?.slides.length ?? 0
  const slideWord = slideCount === 1 ? 'slide' : 'slides'

  const attachments: string[] = []
  if (group?.bedAudioUrl) attachments.push('attached audio')
  if (group?.slides.some((s) => !!s.audioUrl)) attachments.push('per-slide audio')
  if (group?.slides.some((s) => !!s.notes?.trim())) attachments.push('operator notes')

  const mediaClause = attachments.length > 0
    ? ` along with its ${attachments.join(', ')}`
    : ', with no attached audio or notes'

  return `This will remove ${label} and its ${slideCount} ${slideWord}${mediaClause}. This cannot be undone.`
})

/**
 * D-15 — Delete stays available at every status, but must not stay un-warned.
 *
 * The reasoning that justifies NO friction on Reopen runs the opposite way
 * here: reopening is reversible, deleting is not. Delete is the only
 * irreversible action in this view, and for a service carrying export evidence
 * it silently orphans a live Planning Center plan and destroys the audit trail
 * D-11 exists to preserve. Warning is the mitigation; locking is not — forcing
 * a Reopen just to delete adds friction with no safety gain and strands the
 * "created by mistake" case behind two extra steps.
 *
 * Same `hasPcExportEvidence` computed as the reopen dialog. No new dialog, no
 * rules change (the rule's `allow delete` is deliberately unconditional).
 */
const deleteServiceConfirmBody = computed(() => {
  const base = `This will permanently delete the service for ${formattedDate.value}. This cannot be undone.`
  return hasPcExportEvidence.value
    ? `${base} This service was exported to Planning Center. Deleting it here does not remove that plan.`
    : base
})

// ── Scripture editor expansion state ──────────────────────────────────────────
/**
 * 34-07 (owner UAT F1) — which SCRIPTURE slot's congregational-reading editor
 * is open, or `null` when none is. Defaults `null` so no panel is open on
 * load.
 */
const congregationalSlotIndex = ref<number | null>(null)

/**
 * The one place that decides whether there is something to show — the
 * template's `v-if` and the mount's `:key` both read THIS, so they can never
 * disagree about whether a panel should be up. `null` whenever the index is
 * null or no longer resolves to a SCRIPTURE slot (e.g. the slot was removed
 * or changed kind while the modal was open).
 */
const congregationalSlot = computed<ScriptureSlot | null>(() => {
  const index = congregationalSlotIndex.value
  if (index === null || !localService.value) return null
  const slot = localService.value.slots[index]
  return slot && slot.kind === 'SCRIPTURE' ? slot : null
})

/**
 * Handles the "Set up congregational reading" request (relabelled from "Edit
 * scripture text" on 2026-08-05 — see slideDisplay.ts) relayed up
 * through SlidesTab's `navigate-to-scripture-editor` event (T-26-03-01: the
 * index is validated against the current plan item list and its kind before
 * touching any state, so an unhonourable request — out of range, or naming a
 * non-scripture plan item — is a no-op).
 *
 * ★ REVISED 34-07 (owner UAT F1) — the relay is REUSED, the handler body is
 * REPLACED. R047 had deleted the panel this relay used to reveal, which is
 * why it degraded to a tab-switch-plus-scroll. The owner's finding restored
 * a real destination: the scripture slide's edit route now opens the
 * congregational-reading editor as a modal over the Slides tab where the
 * request originated — dragging the user off to the Service Order tab to
 * reach it was the disorientation that made the feature read as absent.
 */
function handleNavigateToScriptureEditor(index: number): void {
  const slot = localService.value?.slots[index]
  if (!slot || slot.kind !== 'SCRIPTURE') return
  if (!canEditService.value) return
  congregationalSlotIndex.value = index
}

/** Closes the congregational-reading modal without writing anything. */
function closeCongregationalEditor(): void {
  congregationalSlotIndex.value = null
}

/**
 * `CongregationalEditor`'s `update:sections` — the same slot-mutation shape
 * `onScriptureChange` uses (spread + reassign the array index), so the
 * existing `useAutoSave(localService, ...)` is the one persistence path for
 * this write too. No save call of any kind belongs here.
 */
function onCongregationalSectionsChange(index: number, sections: CongregationalSection[]): void {
  if (!canEditService.value) return
  if (!localService.value) return
  const slot = localService.value.slots[index]
  if (!slot || slot.kind !== 'SCRIPTURE') return
  localService.value.slots[index] = {
    ...slot,
    congregationalSections: sections,
  } as ScriptureSlot
}

/**
 * `CongregationalEditor`'s `delete` — reverts the slot to a plain scripture
 * reference by dropping its `congregationalSections`. Consumers read
 * `congregationalSections ?? []` and the assembler renders reference-only when
 * empty, so clearing the field is the whole revert. Same slot-mutation shape
 * as `onCongregationalSectionsChange`, persisted through the one existing
 * `useAutoSave(localService, ...)` path — no save call belongs here.
 */
function onCongregationalDelete(index: number): void {
  if (!canEditService.value) return
  if (!localService.value) return
  const slot = localService.value.slots[index]
  if (!slot || slot.kind !== 'SCRIPTURE') return
  // Reverting to a plain reference means the field must be ABSENT, not
  // `undefined` — Firestore's updateDoc rejects an undefined field value. Mirror
  // the canonical drop in `scriptureSlotAfterReferenceChange` (spread + delete
  // the key) so the written slot looks exactly like one that never had a reading.
  const nextSlot: ScriptureSlot = { ...slot }
  delete nextSlot.congregationalSections
  localService.value.slots[index] = nextSlot
}


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

// ── R036 / R037 — the lifecycle lock seams ────────────────────────────────────
//
// `isLocked` widened the retired `isExportedLocked` (`=== 'exported'`) to
// `!== 'draft'`. ★ `isExportedLocked` is DELETED as of 31-04: it fired only at
// `exported` and never at `planned`, which is half of R036, and leaving a
// similarly-named computed alongside this one invites a future edit to reach for
// the wrong one. The per-line migration off it was a five-class job (31-UI-SPEC
// § gate migration) — a blind find-and-replace inverts three of the classes.

const isLocked = computed(() => localService.value !== null && localService.value.status !== 'draft')

const canEditService = computed(() => authStore.isEditor && !isLocked.value)

const statusLabel = computed(() =>
  localService.value?.status === 'exported'
    ? 'Exported'
    : localService.value?.status === 'planned'
      ? 'Planned'
      : 'Draft',
)

/**
 * ★ D-04 — the Planning Center warning gates on EVIDENCE, never on the status
 * string. Live data holds services sitting at `exported` that were hand-set
 * through the deleted three-way cycle and were never exported; telling those
 * users "Planning Center already has this plan" would be false, and a warning
 * users learn is sometimes false is one they learn to click through.
 *
 * ★ ONE computed, deliberately. It drives the lock banner's body, the reopen
 * confirm dialog AND the delete-confirm's Planning Center sentence (D-15). A
 * second copy of this predicate is how those three drift apart.
 */
const hasPcExportEvidence = computed(
  () => !!(localService.value?.pcExportedAt || localService.value?.pcPlanId),
)

// Conditional copy lives in computeds rather than template v-if branches,
// mirroring deleteConfirmBody's precedent below.
const lockBannerLead = computed(() =>
  localService.value?.status === 'exported'
    ? 'Exported — editing is locked.'
    : 'Planned — editing is locked.',
)

const lockBannerBody = computed(() =>
  hasPcExportEvidence.value
    ? 'Planning Center already has this plan. Reopen it for editing to change the order, slides or roles here.'
    : 'Reopen it for editing to change the order, slides or roles.',
)

/** Same locale/option shape as `formattedDate`, minus `weekday`. */
const reopenPcWarning = computed(() => {
  const exportedAt = localService.value?.pcExportedAt
  const toDate = (exportedAt as { toDate?: () => Date } | null | undefined)?.toDate
  const when = typeof toDate === 'function' ? toDate.call(exportedAt) : null
  if (when) {
    const formatted = when.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })
    return `This service was exported to Planning Center on ${formatted}. That plan is still there — reopening here does not change or remove it.`
  }
  // pcPlanId present but no usable pcExportedAt — same sentence, no date clause.
  return 'This service was exported to Planning Center. That plan is still there — reopening here does not change or remove it.'
})

// ── Sections (D005/R007/R043/R044) + live slideshow assembly (R005/R006 visible) ─

/**
 * `{ slot, index }` pairs (index = the slot's ABSOLUTE position in
 * `localService.slots`) grouped into `SERVICE_SECTIONS`-ordered buckets plus
 * a trailing `legacy`/ungrouped bucket, per `groupBySection` (29-02). The
 * ABSOLUTE index is what every existing per-slot handler in the template
 * (onClearSong, removeSlot, onSectionChange, aiDraftSongs, the scripture
 * panel, slotLabel, data-testid="slot-{index}") already keys on — grouping
 * for render never renumbers it to a per-section ordinal.
 */
const slotsBySection = computed(() => {
  const slots = localService.value?.slots ?? []
  return groupBySection(
    slots.map((slot, index) => ({ slot, index })),
    (entry) => entry.slot.section,
  )
})

/** One render group per `SERVICE_SECTIONS` member (always present, `label` set), plus a
 *  trailing ungrouped group (key `'ungrouped'`, `label: null`, no header) ONLY when legacy
 *  slots exist — matches `useSlideshowAssembly.ts`'s shipped "Ungrouped" placement. */
const slotSectionGroups = computed(() => {
  const grouped = slotsBySection.value
  const groups: Array<{ key: ServiceSection | 'ungrouped'; label: string | null; entries: { slot: ServiceSlot; index: number }[] }> =
    SERVICE_SECTIONS.map((section) => ({
      key: section,
      label: SERVICE_SECTION_LABELS[section],
      entries: grouped.sections[section],
    }))
  if (grouped.legacy.length > 0) {
    groups.push({ key: 'ungrouped', label: null, entries: grouped.legacy })
  }
  return groups
})

/** Highlight ref for the section a cross-section drag is currently hovering (UI-SPEC §3).
 *  Set by Sortable's `onMove` and cleared in `onEnd` — both wired in Task 2. Declared here
 *  because the template's `:class` binding on every section container reads it. */
const dragOverSection = ref<ServiceSection | 'ungrouped' | null>(null)

/** R110 render nonce. On a cross-section drag SortableJS physically moves the
 *  dragged `.slot-item` from the source `<ul>` into the target `<ul>` before
 *  `onEnd` fires; when the source section then empties, Vue tears down that
 *  container subtree without reclaiming the node it no longer physically owns,
 *  leaving a handler-less "No Section" phantom clone. Every section-list
 *  container `<div>` keys on `${group.key}-${slotRenderNonce}`, so bumping this
 *  after the reactive move forces Vue to discard and rebuild each container from
 *  state — reclaiming the orphan. Mirrors SlideGrid.vue's `gridRenderNonce`
 *  (the in-repo precedent), including its destroy-then-rebuild Sortable pairing. */
const slotRenderNonce = ref(0)

/** Ref-callback populating the per-section container element map Task 2's Sortable
 *  lifecycle watcher consumes. Declared here because the template wires the callback;
 *  Task 2 owns the watcher that turns this map into `Sortable.create` calls. */
const sectionListEls = ref(new Map<ServiceSection | 'ungrouped', HTMLElement>())
function setSectionListRef(key: ServiceSection | 'ungrouped', el: Element | ComponentPublicInstance | null): void {
  const htmlEl = el as HTMLElement | null
  if (htmlEl) {
    sectionListEls.value.set(key, htmlEl)
  } else {
    sectionListEls.value.delete(key)
  }
}

/** Editor-only per-slot section assignment — routes through the same localService
 *  mutation + autosave watcher every other slot field uses (no separate save path).
 *  Re-orders section-major (29-03/R044) so a section change through the dropdown
 *  produces the same array shape a drag does — the array order the editor renders and
 *  the array order that gets persisted can never disagree. */
function onSectionChange(index: number, value: string) {
  if (!canEditService.value) return
  if (!localService.value) return
  const slot = localService.value.slots[index]
  if (!slot) return
  slot.section = value === '' ? undefined : (value as ServiceSection)
  localService.value.slots = reindexSlots(orderSlotsBySection(localService.value.slots))
}

/** 260811-vsr: which row's ⋯ menu is open (keyed on the stable slot.id, so exactly
 *  one is open at a time — the single-open pattern SlideGrid uses). UI state only;
 *  the trigger toggles, the backdrop and every menu item close it. */
const openRowMenuId = ref<string | null>(null)
function toggleRowMenu(id: string): void {
  openRowMenuId.value = openRowMenuId.value === id ? null : id
}

const orgIdRef = computed(() => authStore.orgId)
/**
 * R036 — whether this session may write slide-group documents at all.
 *
 * ★ This is NOT only a UI concern, and narrowing it is not optional. The
 * `/slideGroups` Firestore rule rejects every write whose parent service is not
 * draft. `useSlideshowAssembly`'s materialization watcher runs with
 * `{ immediate: true }` — it writes on service LOAD, with no user action — as
 * does `rebuildOutcomes`. Leaving this as bare `isEditor` would therefore make
 * every locked service throw permission-denied the moment it opens, which is a
 * worse failure than the one the lock fixes.
 *
 * Suppressing the write is the right shape rather than carving an exception into
 * the rule: the rules layer cannot distinguish a load-time materialization from
 * a user edit, so the exception would have to be "allow any write", i.e. no lock.
 *
 * A service still loading has no status yet; `?? 'draft'` matches the rule's own
 * `resource.data.get('status','draft')` default so the two layers agree, and it
 * avoids wedging materialization behind a transient null.
 */
const canWriteSlideGroups = computed(
  () => authStore.isEditor && (localService.value?.status ?? 'draft') === 'draft',
)

const {
  assembledSlideshow,
  isLoading: slideshowLoading,
  groupsBySlotId,
  ensureGroupMaterialized,
  suppressMaterialization,
  drainGroupWrites,
} = useSlideshowAssembly(localService, orgIdRef, { canWrite: canWriteSlideGroups })
/** 36-03 — a ref to the mounted SlidesTab instance so the relocated header
 * Present button (design 1a) can read its exposed `canPresent` and fire its
 * exposed `onPresentClick()` without duplicating either the condition or the
 * emit logic that still lives inside SlidesTab itself. */
const slidesTabRef = ref<InstanceType<typeof SlidesTab> | null>(null)
const presenting = ref(false)
/** R061 — the flat deck index PresentationViewer should open on, set by
 * onPresent() BEFORE `presenting` flips true so the viewer never mounts
 * with a stale index. */
const presentStartIndex = ref(0)

/** D-05/R061 — `SlidesTab`'s present emit now carries a computed start
 * index; assign it first, then open the viewer, in that order. */
function onPresent(startIndex: number): void {
  presentStartIndex.value = startIndex
  presenting.value = true
}

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
// One Sortable instance PER SECTION list container (29-03/R044) — this codebase's
// first multi-instance Sortable and first use of SortableJS `group` (cross-section
// drag). Generalizes SlideGrid.vue's single-instance `canReorder` computed +
// `destroySortable()` guard (SlideGrid.vue:650-655,712-714) to a keyed
// `Map<ServiceSection | 'ungrouped', Sortable>` (PATTERNS.md "Multi-instance
// Sortable lifecycle").

// ★ R036: this computed carried NO lock term until 31-04, so drag-reorder worked
// on an exported service — a live defect, not a theoretical one. Composing
// `canEditService` in also gives the Sortable teardown for free: the watcher
// below already keys on `canReorder`, so the five per-section instances are
// `destroy()`ed the moment the service locks and re-created the moment it
// reopens. Without that pairing, hiding the handles would leave a reopened
// service undraggable until a page reload.
const canReorder = computed(() => canEditService.value && localService.value !== null)
const sectionSortables = new Map<ServiceSection | 'ungrouped', Sortable>()

function destroySectionSortables(): void {
  for (const instance of sectionSortables.values()) {
    instance.destroy()
  }
  sectionSortables.clear()
}

/** `'ungrouped'` has no `sections` bucket of its own — it maps to `grouped.legacy`. */
function bucketForKey(
  grouped: { sections: Record<ServiceSection, ServiceSlot[]>; legacy: ServiceSlot[] },
  key: ServiceSection | 'ungrouped',
): ServiceSlot[] {
  return key === 'ungrouped' ? grouped.legacy : grouped.sections[key]
}

async function onSlotSortEnd(evt: Sortable.SortableEvent): Promise<void> {
  dragOverSection.value = null
  // R036: second lock over the Sortable instance itself. The instances are
  // destroyed when `canReorder` goes false, so this is belt-and-braces — but a
  // drag already in flight when the status changes must not land a write.
  if (!canEditService.value) return
  if (!localService.value) return
  // Only the Draggable-suffixed indices honor the `draggable: '.slot-item'` selector.
  // `oldIndex`/`newIndex` count EVERY child of the container (with per-section
  // containers there ARE no other children today, but reading them here would still
  // be the same category of mistake) and must never be read in this handler — the
  // false comment that used to sit above this block claimed `draggable` scoped BOTH
  // drag eligibility AND this index math; it does not, and that belief is why this
  // bug survived three prior fix attempts.
  const oldDraggableIndex = evt.oldDraggableIndex
  const newDraggableIndex = evt.newDraggableIndex
  if (oldDraggableIndex == null || newDraggableIndex == null) return

  const fromKey = (evt.from.dataset.section as ServiceSection | undefined) ?? 'ungrouped'
  const toKey = (evt.to.dataset.section as ServiceSection | undefined) ?? 'ungrouped'
  if (fromKey === toKey && oldDraggableIndex === newDraggableIndex) return // genuine no-op

  // Work in the grouped model — never translate a per-section position into a
  // whole-array index by hand. This is what makes the destination position
  // unambiguous for a cross-section move.
  const grouped = groupBySection(localService.value.slots, (s) => s.section)
  const fromBucket = bucketForKey(grouped, fromKey)
  const moved = fromBucket.splice(oldDraggableIndex, 1)[0]
  if (!moved) return
  if (toKey !== 'ungrouped') {
    moved.section = toKey
  }
  // toKey === 'ungrouped' only happens when fromKey === 'ungrouped' too — the
  // ungrouped container's Sortable config sets `put: false`, so nothing can be
  // dropped INTO it from another container; this branch is a same-list reorder.
  // Leave `moved.section` untouched rather than silently reassigning a legacy or
  // out-of-union section value (T-29-06).
  const toBucket = bucketForKey(grouped, toKey)
  toBucket.splice(newDraggableIndex, 0, moved)

  const reindexed = reindexSlots(flattenBySection(grouped))
  localService.value.slots = reindexed

  // R110: reclaim any node SortableJS physically relocated across containers.
  // On a cross-section drag Sortable moves the dragged `.slot-item` into the
  // target `<ul>` before this handler runs; the reactive reassignment above is
  // correct, but Vue does not reconcile that stray node — when the source
  // section empties it removes the container subtree without reclaiming the
  // moved child, orphaning a handler-less "No Section" phantom. Tear the section
  // Sortables down FIRST, then bump the nonce so every keyed container `<div>`
  // is discarded and rebuilt from state (reclaiming the orphan). The teardown is
  // load-bearing, not belt-and-braces: the lifecycle watcher only creates a
  // Sortable when `!sectionSortables.has(key)`, so without clearing the map it
  // would leave the stale instances bound to the discarded elements and the
  // rebuilt containers with no Sortable at all (dead drag). This is exactly the
  // destroy-then-nonce pairing SlideGrid.vue uses (destroySortable + gridRenderNonce).
  destroySectionSortables()
  slotRenderNonce.value += 1

  // D-15: persist immediately rather than waiting on the 800ms debounce. A
  // cross-section move updates only the `slots` array field, so order and section
  // land in one write and cannot half-apply (T-29-07). This bypasses
  // `useAutoSave` entirely (32-RESEARCH Pattern 3 item 3) — it keeps writing
  // straight into `useSaveStatus` for the same surface id, as it always has.
  if (!serviceId.value) return
  // The reindexed assignment above also arms useAutoSave's own debounce for
  // this same mutation — cleanup() cancels it.
  autoSave.cleanup()
  saveStatus.set(surfaceId.value, { status: 'saving' })
  try {
    await serviceStore.updateService(serviceId.value, { slots: reindexed })
    originalService.value = JSON.parse(JSON.stringify(localService.value))
    saveStatus.set(surfaceId.value, { status: 'saved', savedAt: new Date() })
  } catch (err) {
    // CR-01 fix: do NOT restore a closure-captured pre-drag snapshot here.
    // SortableJS calls `onEnd` fire-and-forget (never awaited), so a second,
    // faster drag can start — and its write can succeed and persist — before
    // THIS drag's write settles. A stale pre-drag snapshot would then discard
    // that already-persisted second edit from local state, and because the
    // revert makes `localService` differ from `originalService` again, the
    // general 800ms debounce watcher would treat it as a new unsaved change
    // and silently re-write the stale array back over the successful edit.
    //
    // Instead, restore `originalService.value.slots` — the last known-good
    // PERSISTED state at the moment this catch runs. If nothing else wrote
    // in the meantime, that's identical to this drag's own pre-drag state
    // (today's simple case, unchanged). If a later drag/save already
    // succeeded, `originalService` already reflects it (every successful
    // write sets `originalService.value = clone(localService.value)`), so
    // this revert becomes a no-op against that newer state instead of
    // clobbering it — and because local now matches original exactly, the
    // debounce watcher's `isDirty` check is false, so it never re-arms and
    // never re-persists the reverted array (T-29-09 / CR-01).
    if (localService.value && originalService.value) {
      localService.value.slots = JSON.parse(JSON.stringify(originalService.value.slots))
    }
    autosaveErrorSource.value = 'reorder'
    // Copywriting Contract, verbatim — unchanged from Phase 31.
    saveStatus.set(surfaceId.value, {
      status: 'error',
      errorText: "Couldn't save this order — reverted. Try dragging again.",
    })
    console.error('[ServiceEditorView] reorder save failed:', err)
  }
}

watch(
  [() => sectionListEls.value, canReorder],
  ([elsMap, allowed]) => {
    const keys: (ServiceSection | 'ungrouped')[] = [...SERVICE_SECTIONS, 'ungrouped']
    for (const key of keys) {
      const el = allowed ? elsMap.get(key) : undefined
      if (el && !sectionSortables.has(key)) {
        sectionSortables.set(
          key,
          Sortable.create(el, {
            handle: '.drag-handle',
            draggable: '.slot-item',
            animation: 150,
            ghostClass: 'opacity-30',
            // Shared group name enables cross-section drag. The ungrouped container
            // allows items to be dragged OUT (pull) but never dropped back IN
            // (put: false) — legacy items can be re-sectioned, but nothing can be
            // dragged back into limbo.
            group: key === 'ungrouped' ? { name: 'service-slots', pull: true, put: false } : 'service-slots',
            onMove(moveEvt) {
              dragOverSection.value = (moveEvt.to.dataset.section as ServiceSection | undefined) ?? null
            },
            onEnd: onSlotSortEnd,
          }),
        )
      } else if (!el && sectionSortables.has(key)) {
        sectionSortables.get(key)?.destroy()
        sectionSortables.delete(key)
      }
    }
  },
  { deep: true, flush: 'post' },
)

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
  // R036 / 30-VERIFICATION I-01: gate the handler, not just the template. The
  // `v-if` above removes the control, but the handler stays reachable from the
  // input's own change event during the tick before a status flip re-renders —
  // and a lock enforced only by `v-if` inherits exactly the fragility I-01
  // documented for the Slides tab (BL-01).
  if (!canEditService.value) return
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

/**
 * 36-03 (R068) — the page-header's per-tab action list, replacing the four
 * unconditional buttons that used to render regardless of `activeTab`.
 * Threads the view's OWN existing state into `buildActionBarItems` (36-02);
 * `handlers` passes EXISTING functions by reference, except `onPresent`,
 * which contains no logic of its own — it only calls the exposed
 * `SlidesTab.onPresentClick()`, which still does the actual emitting.
 * `@present="onPresent"` on the `<SlidesTab>` element below still receives
 * that emit and still owns opening `PresentationViewer` at the computed
 * start index. Routing through the emit (not calling the view's own
 * `onPresent` directly from here) keeps the start-index computation in the
 * one place that owns it.
 */
const activeActionItems = computed(() =>
  buildActionBarItems(activeTab.value, {
    canEditService: canEditService.value,
    hasSermonContext: hasSermonContext.value,
    aiSuggestingAll: aiSuggestingAll.value,
    aiEnabled: authStore.settings.aiEnabled,
    hasPcCredentials: authStore.hasPcCredentials,
    pcEnabled: authStore.settings.pcEnabled,
    isExporting: isExporting.value,
    serviceStatus: localService.value?.status ?? 'draft',
    isDirty: isDirty.value,
    isSaving: isSaving.value,
    canPresent: slidesTabRef.value?.canPresent ?? false,
    // R101 (48-03): threaded so buildServiceOrderItems can build Print/Share
    // with the exact same gate/labels the page-bottom buttons used.
    isEditor: authStore.isEditor,
    isSharing: isSharing.value,
    shareCopied: shareCopied.value,
    shareError: shareError.value,
    handlers: {
      suggestAllSongs,
      onExportToPC,
      onSave,
      onPresent: () => slidesTabRef.value?.onPresentClick(),
      onPrint,
      onShare,
    },
  }),
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

// ── Autosave (useAutoSave / useSaveStatus, R040) ──────────────────────────────
// Declared before the remote-merge watcher below, whose immediate guard reads
// autoSave.status.value on first run.
const surfaceId = computed(() => `service:${serviceId.value}`)

// 34-10 (UAT F4): decides whether the sticky save-status bar's CHROME shows,
// not whether the bar exists at all — see the wrapper's own comment in the
// template for why those are different gates.
const serviceSaveStatusVisible = computed(() =>
  hasVisibleSaveStatus(saveStatus.entryFor(surfaceId.value)),
)

const autoSave = useAutoSave(
  localService,
  async () => {
    // No "just before the save" hook exists — this is the only point that
    // runs right before it (onUndo just needs it populated).
    previousService.value = JSON.parse(JSON.stringify(originalService.value))
    try {
      await onSave()
    } catch (err) {
      // handleAutosaveFailure writes the definitive useSaveStatus entry
      // itself (it knows about ServiceLockedError; the composable does not),
      // then this re-throws so the composable's own catch also lands on
      // 'error' (BL-02: never stranded at 'saving') without double-reporting
      // — see the watcher below.
      handleAutosaveFailure(err)
      throw err
    }
  },
  computed(() => isDirty.value && canEditService.value), // folds the lock in
)

// Declared before the watcher below (rather than down with the rest of the
// R037 transition state) because CR-03's `!editable` branch reads it —
// hoisting keeps that read after its own declaration rather than relying on
// the (currently true, but fragile) fact that `status` can't be 'error' on
// the watcher's own `{ immediate: true }` first run.
const lifecycleError = ref<string | null>(null)

// Reports status into the shared store; belt-and-braces (31-RESEARCH),
// cancels an already-armed timer the instant the lock engages (the
// Mark-as-Planned-while-typing race Phase 31 fixed). Skips 'error' —
// handleAutosaveFailure already wrote the definitive entry.
watch(
  [canEditService, () => autoSave.status.value],
  ([editable, status]) => {
    if (!editable) {
      autoSave.cleanup()
      // CR-03: an outstanding 'error' means a real, unsaved edit is still
      // sitting in localService — handleAutosaveFailure's "kept dirty"
      // branch deliberately never reverts it, precisely so it can be
      // retried. Silently reporting 'idle' here would make that edit vanish
      // with zero on-screen trace the instant the service locks: the status
      // bar disappears along with `canEditService` regardless of what this
      // writes, so route the failure into `lifecycleError` instead — it is
      // NOT gated behind `canEditService` in the locked banner path
      // (31-UI-SPEC § 1) — rather than reporting a falsely-clean 'idle'.
      // Leave the saveStatus entry itself untouched: it already holds the
      // definitive 'error' entry handleAutosaveFailure wrote, and
      // overwriting it to 'idle' would be exactly the "quieter indicator"
      // P-01 forbids.
      if (status === 'error') {
        lifecycleError.value =
          saveStatus.entryFor(surfaceId.value).errorText ??
          "Couldn't save your changes — they're still here. Try again."
        return
      }
      saveStatus.set(surfaceId.value, { status: 'idle' })
      return
    }
    if (status === 'error') return
    if (status === 'saved') {
      saveStatus.set(surfaceId.value, { status: 'saved', savedAt: new Date() })
      return
    }
    saveStatus.set(surfaceId.value, { status })
  },
  { immediate: true },
)

// An entry must not outlive its surface (E2 `partial` backstop).
watch(serviceId, (newId, oldId) => {
  if (oldId && oldId !== newId) saveStatus.clear(`service:${oldId}`)
})

// ── Watch for service store changes ───────────────────────────────────────────

watch(
  () => serviceStore.services,
  (services) => {
    const found = services.find((s) => s.id === serviceId.value)
    if (!found) return

    // R039: this snapshot is this client's OWN write settling (Firestore's
    // local `metadata.hasPendingWrites`, surfaced by the store), not a
    // change some other writer made. Local state is therefore already
    // correct, so merging it in — and resetting the guard below as if a
    // real remote change had arrived — would be a false positive: it is
    // exactly what let the very next discrete mutation land in the swallow
    // window. Only the already-loaded path is skipped; the initial-load
    // branch below must still run even mid-echo, or a service opened while
    // one of our own writes is in flight would never populate.
    if (localService.value && serviceStore.isOwnWriteEcho(serviceId.value)) return

    if (!localService.value) {
      // Initial load: populate from store, backfilling any missing slot ids
      // (D-01/R028) first. Both refs get the SAME backfilled value — if
      // originalService missed the ids, the JSON-stringified comparison
      // behind isDirty would never match again and the dirty indicator would
      // be permanently wrong.
      const backfilled = backfillSlotIds(found)
      localService.value = JSON.parse(JSON.stringify(backfilled))
      originalService.value = JSON.parse(JSON.stringify(backfilled))
      previousService.value = null
    } else if (
      autoSave.status.value === 'idle' ||
      autoSave.status.value === 'saved' ||
      // BL-02: a FAILED save must not close this branch for the life of the
      // component. `'error'` is admitted only once the local copy matches the
      // last persisted state — which both failure paths that revert (the
      // reorder catch, and `handleAutosaveFailure`'s ServiceLockedError branch)
      // guarantee — so re-admitting it can never discard unsaved work. A
      // transport failure that KEPT the user's text stays dirty and stays
      // excluded, which is the intended protection rather than an oversight.
      (autoSave.status.value === 'error' && !isDirty.value)
    ) {
      // Remote update arrived while user is not actively editing — apply it.
      // This is what makes two simultaneous viewers see each other's changes.
      // Guard: skip if the remote version matches what we already have (avoid
      // spurious re-renders after our own save completes).
      // Backfill against the CURRENT local service (not a fresh one) so an
      // id already held locally is reused rather than regenerated — a
      // one-argument backfill would mint a fresh id on every snapshot and
      // this comparison would never stabilize, re-anchoring every group on
      // every remote merge (R028).
      const backfilled = backfillSlotIds(found, localService.value)
      const remoteJson = JSON.stringify(backfilled)
      const localJson = JSON.stringify(localService.value)
      if (remoteJson !== localJson) {
        localService.value = JSON.parse(remoteJson)
        originalService.value = JSON.parse(remoteJson)
        // 32-05: no `autosaveInitialized`-equivalent reset needed — local and
        // original are now byte-identical, so the composable's own dirty
        // check suppresses the merge-induced trigger before any timer arms
        // (RESEARCH A2; Task 3 tests a genuine merge arms no save).
      }
    }
    // If the composable's status is 'pending' or 'saving', the user is
    // actively editing — do not overwrite their in-progress work. Their
    // save will win.
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

// ── Autosave failure handling ────────────────────────────────────────────────

/**
 * BL-02 — a rejected autosave must leave the view USABLE, never stranded at
 * 'saving'. useAutoSave's own catch is generic; this writes the definitive
 * useSaveStatus entry itself: ServiceLockedError can never succeed while
 * locked, so revert to originalService and report 'idle' (nothing to retry);
 * anything else may land on retry, so the edit is KEPT and the entry reports
 * 'error'. lifecycleError (not the shared status bar) is the surface —
 * 31-04's bar/banner slots are gone/present at exactly the right statuses.
 */
function handleAutosaveFailure(err: unknown): void {
  console.error('[ServiceEditorView] autosave failed:', err)
  if (err instanceof ServiceLockedError) {
    if (localService.value && originalService.value) {
      localService.value = JSON.parse(JSON.stringify(originalService.value))
    }
    lifecycleError.value =
      "This service is locked, so that change wasn't saved. Reopen it for editing and try again."
    saveStatus.set(surfaceId.value, { status: 'idle' })
    return
  }
  autosaveErrorSource.value = 'autosave'
  lifecycleError.value =
    "Couldn't save your changes — they're still here. Check your connection; editing again will retry."
  // Copywriting Contract, verbatim — never the caught error's own message (T-32-15).
  saveStatus.set(surfaceId.value, {
    status: 'error',
    errorText: "Couldn't save your changes — they're still here. Try again.",
  })
}

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
  // Roles tab data (Pitfall 4 / T-17-04-01 / CR-05): /services/:id has no
  // requiresEditor route guard, so a non-editor viewer can land here — the
  // editor-only roles/quarters/people collections must never be subscribed to
  // for a viewer (Phase 16.2 removal decision: no expanded viewer read access).
  if (authStore.isEditor) {
    if (!rosterStore.orgId) {
      rosterStore.subscribe(orgId)
    }
    if (!quartersStore.orgId) {
      quartersStore.subscribe(orgId)
    }
  }
}

// WR-01: authStore.isEditor resolves asynchronously (loadOrgContext runs off
// the auth-state-changed flow, not synchronously at mount), and /services/:id
// has no requiresEditor guard forcing waitForRole() first. If a real editor
// lands directly on this route before isEditor flips true, initStores() ran
// its one-time check with isEditor still false and never subscribed
// roster/quarters. Re-run initStores() when isEditor becomes true so the
// subscription retries once the role resolves; initStores()'s own
// `if (!rosterStore.orgId)` / `if (!quartersStore.orgId)` guards make this
// idempotent (no double-subscribe on repeated calls).
watch(
  () => authStore.isEditor,
  (isEditor) => {
    if (isEditor) {
      initStores()
    }
  },
)

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
  destroySectionSortables()
  // useAutoSave registers its own onUnmounted(cleanup). An entry must not
  // outlive its surface (E2 `partial` backstop) — clear it here.
  saveStatus.clear(surfaceId.value)
  // Don't unsubscribe serviceStore here — DashboardView may still be using it
})

// ── CCLI helper ────────────────────────────────────────────────────────────────

function getCcliNumber(songId: string): string | null {
  return songStore.songs.find((s) => s.id === songId)?.ccliNumber || null
}

// ── R037 status transitions ────────────────────────────────────────────────────
//
// D-01 deleted `toggleStatus`, the blind draft -> planned -> exported -> draft
// badge cycle that used to live here. Two named actions replace it, and there is
// deliberately no third: `exported` is reachable ONLY through a real Planning
// Center export (D-03).

const isTransitioning = ref(false)
// lifecycleError is declared earlier (with the autosave watcher block) —
// see CR-03's comment there for why.

/**
 * ★ Reflect a transition in the UI only AFTER the store write has resolved.
 *
 * Both `localService` and `originalService` are moved together: the status write
 * is already persisted at this point, so leaving `originalService` behind would
 * make `isDirty` true and hand the autosave watcher a full-document write
 * against a service that is now locked — a guaranteed rejection ~800ms later.
 */
function applyTransitionLocally(status: 'draft' | 'planned'): void {
  if (localService.value) localService.value.status = status
  if (originalService.value) originalService.value.status = status
}

/**
 * The `lastUsedAt` bump that used to live inside `onSave`, keyed on
 * `originalService.status === 'draft' && data.status === 'planned'`. Status no
 * longer moves through `onSave`, so that branch became unreachable; the
 * behaviour it implemented is not obsolete and moves here.
 *
 * A song counts as "used" only once the service it belongs to is actually
 * scheduled; merely editing songs on a draft, or the AI selector *showing* a
 * suggestion, must not age them.
 *
 * ★ ME-02 — this writes the SONG documents and nothing else. It used to route
 * each song through `serviceStore.assignSongToSlot`, which re-stamps the song
 * fields on a slot and writes the WHOLE `slots` array back. That was safe in the
 * pre-Phase-31 code because the bump ran BEFORE the normalizing write. Wave 3
 * moved it AFTER `onSave()` — which persists
 * `reindexSlots(orderSlotsBySection(...))` and syncs that normalized array into
 * `localService` — and `assignSongToSlot` does not read `localService` at all:
 * it reads the STORE's copy and writes it back, at an index derived from
 * `localService`. The two agree only once the snapshot for `onSave`'s write has
 * landed, so a drag-then-Mark-as-Planned could write the pre-drag array back
 * over the reorder that had just been persisted, and stamp the song fields at an
 * index computed against the NEW order. Latency compensation usually closes the
 * window, which made it intermittent rather than absent. Bumping the songs
 * directly removes the hazard rather than narrowing it, and drops N redundant
 * full-`slots` service writes (one per distinct song) that existed purely to
 * touch `lastUsedAt`.
 *
 * ★ ME-03 — because this no longer writes `slots`, it no longer has to precede
 * the status write. `/songs` is role-gated only (`firestore.rules:124-125`), so
 * a song write is legal at any service status. See `onMarkAsPlanned` for why
 * that lets the whole compensating-restore problem be deleted instead of solved.
 */
async function bumpScheduledSongsLastUsed(): Promise<void> {
  const svc = localService.value
  if (!svc) return
  const scheduledSongIds = new Set(
    svc.slots.filter((s) => s.kind === 'SONG' && (s as SongSlot).songId).map((s) => (s as SongSlot).songId!),
  )
  await Promise.all(
    [...scheduledSongIds].map((songId) =>
      songStore.updateSong(songId, { lastUsedAt: serverTimestamp() as never }),
    ),
  )
}

async function onMarkAsPlanned(): Promise<void> {
  if (!localService.value || isTransitioning.value) return
  lifecycleError.value = null
  isTransitioning.value = true
  try {
    // BL-02, second trigger. flush() disarms the timer and persists whatever
    // was pending while still draft/writable — a no-op when nothing is
    // pending (better under P-02 than the old unconditional onSave() call).
    // The cancel-on-lock watcher and the timer's own re-check cover the user
    // still typing during this awaited round trip.
    await autoSave.flush()
    // HI-01: the same "flush before the lock" reasoning as the autosave above,
    // for the OTHER write path out of this view. Assigning a song to a slot
    // changes `localService.slots`, which recomputes `rebuildOutcomes` and
    // issues a `replaceGroupSlides` transaction fire-and-forget via `void`.
    // Flipping the status straight through that window leaves the write to be
    // denied on arrival by the new /slideGroups rule — the user sees a normal
    // transition while that group's slides silently stay stale until the next
    // reopen. Draining first lets those writes land while the service is still
    // draft and therefore still writable.
    await drainGroupWrites()
    await serviceStore.markAsPlanned(localService.value.id)
    applyTransitionLocally('planned')

    // ★ ME-03 — the bump runs AFTER the transition has landed, not before it.
    //
    // It had to precede the status write only because it wrote `slots`, which
    // is illegal once locked; ME-02 removed that, and `/songs` is role-gated
    // only, so a song write is legal at any status. The two therefore still
    // cannot be atomic — but they no longer need to be, because the failure
    // that mattered is now unreachable rather than compensated: a rejected
    // `markAsPlanned` never reaches this line, so no song is ever aged for a
    // service that was never scheduled. `lastUsedAt` feeds the AI rotation
    // heuristics (`recentServiceSongIds`, the `songLibrary` payload), and a
    // wrongly-aged song is invisible to the user and has no undo — so deleting
    // the window beats capturing prior values and restoring them in a `catch`,
    // which would itself have to survive a second failure.
    //
    // Its own try/catch, and deliberately NOT re-raised: the transition the
    // user asked for has already succeeded and is already reflected on screen.
    // Reporting "Couldn't mark this service as Planned" here would be false.
    // The cost of a silent failure is one song looking less recently used than
    // it is, which self-corrects the next time it is scheduled.
    try {
      await bumpScheduledSongsLastUsed()
    } catch (bumpErr) {
      console.error('[ServiceEditorView] lastUsedAt bump failed after a successful transition:', bumpErr)
    }
  } catch (err) {
    console.error('Mark as Planned failed:', err)
    // ★ No optimistic flip: the pill, the banner and every gate are still
    // reading the OLD status here, and stay that way. Saying so on screen is
    // the whole point — a UI showing one status while the store holds another
    // is the "it didn't save" defect class this milestone exists to close.
    //
    // ME-03 — branch on the CAUSE. "Check your connection and try again" is
    // wrong advice for a store-guard refusal: the connection is fine, and
    // retrying fails identically until the user reloads. The raw
    // `ServiceLockedError` message is a developer string and must not be shown.
    lifecycleError.value =
      err instanceof ServiceLockedError
        ? 'This service changed status somewhere else. Reload to see where it stands.'
        : "Couldn't mark this service as Planned. Check your connection and try again."
  } finally {
    isTransitioning.value = false
  }
}

const showReopenConfirm = ref(false)

/**
 * D-10 — friction only where there are consequences.
 *
 * ★ Branches on EVIDENCE, not on the status string. A `planned` service and a
 * legacy `exported` one that the deleted cycle hand-set both reopen on one
 * click; only a service that genuinely reached Planning Center gets the dialog.
 * Gating on `status === 'exported'` instead would show those legacy rows a
 * warning that is simply false.
 */
function onReopenRequest(): void {
  if (!localService.value || isTransitioning.value) return
  if (hasPcExportEvidence.value) {
    showReopenConfirm.value = true
    return
  }
  void runReopen()
}

function onConfirmReopen(): void {
  void runReopen()
}

async function runReopen(): Promise<void> {
  if (!localService.value || isTransitioning.value) return
  lifecycleError.value = null
  isTransitioning.value = true
  try {
    await serviceStore.reopenService(localService.value.id)
    applyTransitionLocally('draft')
    showReopenConfirm.value = false
  } catch (err) {
    console.error('Reopen failed:', err)
    // ★ No optimistic flip. The pill, the banner and every gate keep showing
    // the OLD status; the banner's Reopen button is the retry. The dialog is
    // dismissed on the way out because the banner — which hosts lifecycleError
    // while locked — sits UNDERNEATH the overlay; leaving it open would strand
    // the message behind the thing that failed.
    lifecycleError.value = "Couldn't reopen this service. Check your connection and try again."
    showReopenConfirm.value = false
  } finally {
    isTransitioning.value = false
  }
}

// ── Team toggle ────────────────────────────────────────────────────────────────

// ★ R036 / 30-VERIFICATION I-01: every mutation entry point below returns early
// when the service is not editable, not merely when its control is hidden. A
// lifecycle lock enforced only by template `v-if` inherits the fragility I-01
// documented for the Slides tab — the control disappears, the write path does
// not. `canEditService` (not `isLocked`) is the guard so a viewer is refused by
// the same line.
function toggleTeam(team: string) {
  if (!canEditService.value) return
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

/** Per-band assembled-slide count for a section-band header's "{n} slides" caption
 *  (36-04, UI-SPEC §9). Deliberately mirrors `SlidePlanRail.vue`'s own per-row
 *  derivation — filtering `assembledSlideshow` by `AssembledSlide.slotIndex` — rather
 *  than reading `group.slides.length` off a `SlideGroup` document, because an
 *  unmaterialized group reads zero slides there while the grid (and this count)
 *  show the full fallback-path group. Takes the band's own `entries` (the same
 *  `{ slot, index }[]` shape `slotSectionGroups` already produces) rather than a bare
 *  `ServiceSection` key — same output as UI-SPEC §9's illustrative
 *  `sectionSlideCount(group.key)`, without re-deriving the section-to-slots mapping
 *  `slotSectionGroups` already computed. Builds one `Set` of the band's indices and
 *  filters once, rather than calling `.filter` per entry. */
function sectionSlideCount(entries: { slot: ServiceSlot; index: number }[]): number {
  const indices = new Set(entries.map((entry) => entry.index))
  return assembledSlideshow.value.filter((s) => indices.has(s.slotIndex)).length
}

/** 36-04 — which band's inline "＋ Add item" chip row is open (Task 2's UI). UI
 *  state only; performs no writes. */
const openSectionAddKey = ref<ServiceSection | null>(null)
function toggleSectionAdd(key: ServiceSection): void {
  openSectionAddKey.value = openSectionAddKey.value === key ? null : key
}

function addSlot(kind: SlotKind, vwType?: VWType, targetSection?: ServiceSection) {
  if (!canEditService.value) return
  if (!localService.value) return
  // New slot inherits the current last slot's section — on a fully sectioned
  // service it lands at the end of that section rather than in the ungrouped
  // bucket. `createSlot` omits the `section` key entirely when this is
  // `undefined` (a legacy, section-less service), preserving today's shape.
  // 36-04: an explicit `targetSection` (passed by a per-band "＋ Add item" chip)
  // bypasses that inherit-from-last-slot fallback entirely — this is what makes a
  // per-band add land correctly even into an EMPTY band, which has no "last slot
  // in this section" to inherit from.
  const currentSlots = localService.value.slots
  const section = targetSection ?? currentSlots[currentSlots.length - 1]?.section
  const newSlot = createSlot(kind, vwType, section)
  localService.value.slots.push(newSlot)
  localService.value.slots = reindexSlots(orderSlotsBySection(localService.value.slots))
}

// ── Consolidated free-text field (260811-vsr) ───────────────────────────────────
// Plain kinds (PRAYER/MESSAGE/ANNOUNCEMENTS/MISC) collapse to ONE field: the
// notes-canonical field. It READS `notes ?? body` (a legacy body-only slot still
// displays) and WRITES `notes`. `body` is undefined on selector kinds, so the
// expression collapses to `slot.notes` there — safe cast-free across the union.
function slotFreeText(slot: ServiceSlot): string | undefined {
  return slot.notes ?? (slot as NonAssignableSlot).body
}

// Per-kind placeholder for the consolidated field. Plain kinds get their own
// prompt; the selector kinds keep the Phase-54 "who leads / who sings what" text.
function notesPlaceholder(slot: ServiceSlot): string {
  switch (slot.kind) {
    case 'PRAYER': return 'Who is praying? (optional notes)'
    case 'ANNOUNCEMENTS': return 'Church-wide announcements'
    case 'MESSAGE': return 'Message notes or outline'
    case 'MISC': return 'Details'
    default: return 'Notes (e.g. who leads, who sings which parts)'
  }
}

// ── Per-kind badge tint (260811-vsr / DESIGN-SPEC) ──────────────────────────────
// The three-rail row's badge rail shows ONE colored pill per kind, mapped to the
// app's muted/dark gray+indigo theme (not the mockup's raw hex). Central helper so
// the template stays clean; badge text comes from slotLabel(slot, index).
function kindBadgeClass(kind: SlotKind): string {
  switch (kind) {
    case 'SONG': return 'bg-indigo-950 border border-indigo-800 text-indigo-300'
    case 'SCRIPTURE': return 'bg-cyan-950 border border-cyan-800 text-cyan-300'
    case 'ANNOUNCEMENTS':
    case 'MESSAGE': return 'bg-rose-950 border border-rose-900 text-rose-300'
    case 'PRAYER':
    case 'MISC': return 'bg-gray-800 border border-gray-600 text-gray-300'
    case 'HYMN': return 'bg-amber-950 border border-amber-900 text-amber-300'
    case 'IMPORTED': return 'bg-gray-800 border border-gray-700 text-gray-400'
    default: return 'bg-gray-800 border border-gray-600 text-gray-300'
  }
}

// ── Slot populated check (D-14) ────────────────────────────────────────────────
// NOTE: isSlotPopulated is known dead code — declared and never called since
// Phase 12-05 (flagged as IN-01 in 27-REVIEW.md). Kept internally consistent with
// the 43-03 UI change (MESSAGE moves from a link-based check to a body-based
// check) rather than revived or wired to anything new.

function isSlotPopulated(slot: ServiceSlot): boolean {
  if (slot.kind === 'SONG') {
    return (slot as SongSlot).songId != null
  }
  if (slot.kind === 'SCRIPTURE') {
    const s = slot as ScriptureSlot
    return !!(s.book || s.chapter || s.verseStart || s.verseEnd)
  }
  if (slot.kind === 'PRAYER') {
    const s = slot as NonAssignableSlot
    return !!(s.linkUrl?.trim() || s.linkLabel?.trim())
  }
  if (slot.kind === 'MESSAGE' || slot.kind === 'ANNOUNCEMENTS' || slot.kind === 'MISC') {
    const s = slot as NonAssignableSlot
    return !!s.body?.trim()
  }
  if (slot.kind === 'HYMN') {
    const s = slot as HymnSlot
    return !!(s.hymnName?.trim() || s.hymnNumber?.trim())
  }
  if (slot.kind === 'IMPORTED') {
    return (slot as ImportedSlot).importId != null
  }
  return false
}

// ── Slot remove (with D-14 confirmation gate) ──────────────────────────────────

function performRemoveSlot(index: number) {
  if (!localService.value) return
  localService.value.slots.splice(index, 1)
  localService.value.slots = reindexSlots(orderSlotsBySection(localService.value.slots))
}

function removeSlot(index: number) {
  if (!canEditService.value) return
  if (!localService.value) return
  const slot = localService.value.slots[index]
  if (!slot) return
  // D-15: confirm ALL element removals, including empty/blank rows
  pendingDeleteIndex.value = index
  pendingDeleteIsClear.value = false
  showSlotDeleteConfirm.value = true
}

function elementLabel(kind: SlotKind): string {
  switch (kind) {
    case 'SONG': return 'this song'
    case 'SCRIPTURE': return 'this scripture'
    case 'HYMN': return 'this hymn'
    case 'MESSAGE': return 'this message'
    case 'PRAYER': return 'this prayer'
    case 'ANNOUNCEMENTS': return 'this announcement'
    case 'MISC': return 'this miscellaneous item'
    case 'IMPORTED': return 'this imported deck'
    default: return 'this element'
  }
}

async function confirmSlotDelete() {
  if (!canEditService.value) return
  if (pendingDeleteIndex.value == null) return
  const index = pendingDeleteIndex.value
  if (pendingDeleteIsClear.value) {
    // Clear-song path (D-14/D-15): empties a SONG slot's assignment — this
    // is NOT a remove-element delete, so no group is deleted here (R029
    // scopes the cascade to actually removing the plan item).
    const slot = localService.value?.slots[index]
    if (slot?.kind === 'SONG') {
      const updated: SongSlot = { ...slot as SongSlot, songId: null, songTitle: null, songKey: null }
      localService.value!.slots[index] = updated
    }
  } else {
    // Remove-element path (R029/D-03): resolve the slot's own id BEFORE the
    // splice — after performRemoveSlot the anchor is gone. The group delete
    // is awaited FIRST; a failed delete must not leave the slot removed
    // locally while its group lingers, so on failure we leave the slot in
    // place and surface the failure the same way onToggleRoleOverride does
    // (console.error, no user-facing banner for this scoped-write class of
    // failure) rather than silently diverging local from remote.
    const slotId = localService.value?.slots[index]?.id
    // ME-04 (R045 membership): hold the materialize watcher off this slot for
    // the whole delete. Firestore drops the group from its LOCAL cache — and
    // raises onSnapshot — the instant deleteDoc is issued, while the await below
    // resolves only on server ack. Without the hold, the watcher sees a slot
    // with no group, re-creates the document, and the splice that follows
    // performs no second cascade — leaving an orphan group behind forever.
    const releaseMaterializationHold = slotId ? suppressMaterialization(slotId) : () => {}
    try {
      if (slotId && authStore.orgId) {
        await slideGroupsStore.deleteGroup(authStore.orgId, slotId)
      }
      performRemoveSlot(index)
    } catch (err) {
      console.error('Failed to delete slide group for removed slot:', err)
      showSlotDeleteConfirm.value = false
      pendingDeleteIndex.value = null
      pendingDeleteIsClear.value = false
      return
    } finally {
      releaseMaterializationHold()
    }
  }
  showSlotDeleteConfirm.value = false
  pendingDeleteIndex.value = null
  pendingDeleteIsClear.value = false
}

// ── Song assignment ────────────────────────────────────────────────────────────

function onSelectSong(
  index: number,
  song: { id: string; title: string; key: string },
) {
  if (!canEditService.value) return
  if (!localService.value) return
  const slot = localService.value.slots[index]
  if (!slot) return
  if (slot.kind === 'SONG') {
    const updated: SongSlot = { ...slot, songId: song.id, songTitle: song.title, songKey: song.key }
    localService.value.slots[index] = updated
  }
}

function onClearSong(index: number) {
  if (!canEditService.value) return
  if (!localService.value) return
  const slot = localService.value.slots[index]
  if (!slot) return
  if (slot.kind === 'SONG') {
    if ((slot as SongSlot).songId != null) {
      // D-14: slot has an assigned song — gate behind confirm dialog
      pendingDeleteIndex.value = index
      pendingDeleteIsClear.value = true
      showSlotDeleteConfirm.value = true
      return
    }
    // No song assigned — clear directly (no data loss)
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
  if (!canEditService.value) return
  if (!localService.value || !hasSermonContext.value) return
  aiSuggestingAll.value = true

  try {
    const sermonTopic = localService.value.sermonTopic ?? null
    const sermonPassage = localService.value.sermonPassage ?? null
    // Orchestra AI filter (D-06, D-09): when service is orchestra, only include orchestra-tagged songs
    // D-18: exclude hidden (soft-deleted) songs from AI base
    const isOrchestraService = (localService.value?.teams ?? []).includes('Orchestra')
    const base = songStore.aiCandidateSongs
    const librarySource = isOrchestraService
      ? base.filter((s) => s.tags.includes('Orchestra'))
      : base
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

      const key = getPrimaryKey(song)
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
  if (!canEditService.value) return
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

    // D-18: exclude hidden (soft-deleted) songs from AI base
    const isOrchestraService = (localService.value?.teams ?? []).includes('Orchestra')
    const base = songStore.aiCandidateSongs
    const librarySource = isOrchestraService
      ? base.filter((s) => s.tags.includes('Orchestra'))
      : base
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
  if (!canEditService.value) return
  const draft = aiDraftSongs.value.get(index)
  if (!draft) return
  onSelectSong(index, { id: draft.songId, title: draft.songTitle, key: draft.songKey })
  const newMap = new Map(aiDraftSongs.value)
  newMap.delete(index)
  aiDraftSongs.value = newMap
}

function rejectAiSong(index: number) {
  if (!canEditService.value) return
  const newMap = new Map(aiDraftSongs.value)
  newMap.delete(index)
  aiDraftSongs.value = newMap
}

// ── Scripture ──────────────────────────────────────────────────────────────────

/**
 * ME-02: the canonical primitive, not a private four-field variant.
 *
 * This used to require book + chapter + verseStart + verseEnd, while
 * `scriptureRefFromSlot` — the rule R047 derives the SLIDE from — requires only
 * book + chapter. A whole-chapter reading ("Psalms 103") or a single verse
 * ("Romans 8:28", where `parseScriptureInput` leaves verseEnd null) therefore
 * projected a correct slide while this row handed `null` to ScriptureInput: the
 * input rendered empty, the read-only lines rendered "Scripture — Empty", and
 * "Edit in scripture" scrolled to a blank field.
 */
function slotToScriptureRef(slot: ScriptureSlot): ScriptureRef | null {
  return scriptureRefFromSlot(slot)
}

/** Read-only rendering of a slot's reference — the same string the slide projects. */
function slotScriptureText(slot: ScriptureSlot): string {
  const ref = scriptureRefFromSlot(slot)
  return ref ? formatScriptureReference(ref) : 'Scripture — Empty'
}

function onScriptureChange(index: number, ref: ScriptureRef | null) {
  if (!canEditService.value) return
  if (!localService.value) return
  const slot = localService.value.slots[index]
  if (!slot) return
  if (slot.kind === 'SCRIPTURE') {
    // 34-05/34-07: `scriptureSlotAfterReferenceChange` owns both the
    // four-field reference write AND the rule that a reference change to a
    // different passage drops `congregationalSections` — a stored
    // congregational reading must never be projected under a passage it was
    // not derived from. Do not restate either rule here.
    localService.value.slots[index] = scriptureSlotAfterReferenceChange(slot, ref)
  }
}

function onSermonPassageChange(ref: ScriptureRef | null) {
  if (!canEditService.value) return
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

// ── Print ──────────────────────────────────────────────────────────────────────
// Copy for PC was removed per direct owner feedback on the running app
// ("let's get rid of the Copy for PC button all together, it's not useful
// at all") — see serviceEditorActionBar.ts's head comment for the accepted
// consequence (no export affordance at all for an uncredentialed org).

function onPrint() {
  window.print()
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
  // 39-05 (R089): belt-and-suspenders. Surface 1 (the action-bar item)
  // already hides when the integration is off, so this guard exists to
  // refuse invocation from a stale bundle or a residual DOM node — a
  // function-level check that survives independently of whether the
  // button rendered.
  if (!authStore.hasPcCredentials || !authStore.pcCredentials || !authStore.settings.pcEnabled) return

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

  // ME-01 — pre-flight against the STORED status, before any Planning Center
  // work. The Export button's own `:disabled` reads `localService.status`
  // (:196), which is this editor's copy and can disagree with what is stored:
  // two editors open the same `planned` service, A exports, and B's button is
  // still enabled. Without this check B's export runs the ENTIRE PC
  // conversation — creating or mutating a real plan — and only then hits the
  // store guard on the terminal write. The plan is left orphaned in Planning
  // Center with `pcPlanId` unrecorded and no audit trail, which is the loss
  // D-11 exists to prevent. Refusing here costs one array lookup and makes that
  // outcome unreachable.
  //
  // Reads the same source the guard does (`services.ts:134-136`), including its
  // `?? 'draft'` default for a legacy document with no status field.
  const storedStatus =
    serviceStore.services.find((s) => s.id === localService.value!.id)?.status ?? 'draft'
  if (storedStatus !== 'planned') {
    exportError.value =
      storedStatus === 'exported'
        ? 'This service has already been exported to Planning Center. Reload to see the current state.'
        : 'This service is no longer marked as Planned. Reload and try again.'
    return
  }

  isExporting.value = true
  exportError.value = null

  try {
    const { appId, secret } = authStore.pcCredentials
    const serviceTypeId = exportSelectedServiceTypeId.value
    const failures: string[] = []
    let planId: string

    // Collect our songs (SONG + HYMN) and scriptures from service slots.
    // IMPORTED slots (Phase 21) have no analogous PC item type and are
    // intentionally excluded from both buckets below — the 'existing plan'
    // branch below only ever touches songSlots/scriptureSlots (same as
    // PRAYER/MESSAGE), so IMPORTED is already skipped there without further
    // (slot as any) narrowing (RESEARCH Pitfall 2).
    const songSlots = localService.value.slots.filter(s => s.kind === 'SONG' || s.kind === 'HYMN')
    const scriptureSlots = localService.value.slots.filter(s => s.kind === 'SCRIPTURE')
    // The four remaining exportable kinds (IMPORTED stays excluded; SONG/HYMN/
    // SCRIPTURE are handled by the buckets above). `.filter` preserves service
    // slot order; these are APPENDED like the leftover passes in the
    // existing-plan and new-plan-with-template branches (LOCKED design).
    const otherSlots = localService.value.slots.filter(
      s => s.kind === 'PRAYER' || s.kind === 'MESSAGE' || s.kind === 'ANNOUNCEMENTS' || s.kind === 'MISC',
    )

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
        const NON_SCRIPTURE_REGULAR_TITLES = new Set(['message', 'prayer', 'announcements', 'miscellaneous'])
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
            slot, item.sequence, songStore.songs, authStore.settings.bibleVersion, localService.value.sermonPassage,
            item.length ?? undefined,
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
            slot, item.sequence, songStore.songs, authStore.settings.bibleVersion, localService.value.sermonPassage,
            item.length ?? undefined,
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
            songSlots[i]!, sequence, songStore.songs, authStore.settings.bibleVersion, localService.value.sermonPassage,
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
            scriptureSlots[i]!, sequence, songStore.songs, authStore.settings.bibleVersion, localService.value.sermonPassage,
          )
          sequence++
        } catch {
          failures.push('Scripture')
        }
      }

      // Sixth pass — append PRAYER/MESSAGE/ANNOUNCEMENTS/MISC slots (D-02:
      // appended like the leftover passes above; not title-matched/replaced).
      for (const slot of otherSlots) {
        try {
          await addSlotAsItem(
            appId, secret, serviceTypeId, planId,
            slot, sequence, songStore.songs, authStore.settings.bibleVersion, localService.value.sermonPassage,
          )
          sequence++
        } catch {
          failures.push(slot.kind)
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
              await addSlotAsItem(appId, secret, serviceTypeId, planId, songSlots[songIndex]!, sequence, songStore.songs, authStore.settings.bibleVersion, localService.value.sermonPassage, tItem.length)
              songIndex++
            } else if (isScriptureItem && scriptureIndex < scriptureSlots.length) {
              await addSlotAsItem(appId, secret, serviceTypeId, planId, scriptureSlots[scriptureIndex]!, sequence, songStore.songs, authStore.settings.bibleVersion, localService.value.sermonPassage, tItem.length)
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
            await addSlotAsItem(appId, secret, serviceTypeId, planId, songSlots[i]!, sequence, songStore.songs, authStore.settings.bibleVersion, localService.value.sermonPassage)
            sequence++
          } catch {
            const slot = songSlots[i]!
            failures.push(slot.kind === 'SONG' ? ((slot as any).songTitle ?? 'Song') : ((slot as any).hymnName ?? 'Hymn'))
          }
        }

        for (let i = scriptureIndex; i < scriptureSlots.length; i++) {
          try {
            await addSlotAsItem(appId, secret, serviceTypeId, planId, scriptureSlots[i]!, sequence, songStore.songs, authStore.settings.bibleVersion, localService.value.sermonPassage)
            sequence++
          } catch {
            failures.push('Scripture')
          }
        }

        // Append PRAYER/MESSAGE/ANNOUNCEMENTS/MISC slots (previously dropped in
        // the with-template path). Appended like the leftover passes above.
        for (const slot of otherSlots) {
          try {
            await addSlotAsItem(appId, secret, serviceTypeId, planId, slot, sequence, songStore.songs, authStore.settings.bibleVersion, localService.value.sermonPassage)
            sequence++
          } catch {
            failures.push(slot.kind)
          }
        }
      } else {
        for (const slot of localService.value.slots) {
          // IMPORTED slots reference PPTX/image decks with no analogous PC item
          // type; skip export entirely rather than falling through
          // addSlotAsItem's default MESSAGE-item branch and mislabeling it
          // (RESEARCH Pitfall 2) — no (slot as any) narrowing needed here since
          // we skip before ever reaching the label-building catch block below.
          if (slot.kind === 'IMPORTED') continue
          try {
            await addSlotAsItem(appId, secret, serviceTypeId, planId, slot, sequence, songStore.songs, authStore.settings.bibleVersion, localService.value.sermonPassage)
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

    // Add selected PC teams by creating one NeededPosition per team position.
    // PC requires a valid team_position_id — fetch each team's positions first.
    // Teams with no positions configured in PC are skipped silently.
    // For existing plans: skip teams that already have needed_positions to avoid duplicates.
    if (selectedPcTeamIds.value.length > 0) {
      let alreadyPresentTeamIds = new Set<string>()
      if (exportMode.value === 'existing') {
        alreadyPresentTeamIds = await fetchPlanNeededPositionTeamIds(appId, secret, serviceTypeId, planId)
      }
      for (const teamId of selectedPcTeamIds.value) {
        if (alreadyPresentTeamIds.has(teamId)) continue
        try {
          const positions = await fetchTeamPositions(appId, secret, teamId)
          for (const position of positions) {
            await addNeededPosition(appId, secret, serviceTypeId, planId, teamId, position.id)
          }
        } catch (err) {
          console.error(`[PC export] addNeededPosition failed for team ${teamId}:`, err)
          // Non-fatal: continue adding remaining teams
        }
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

    // ★ R036 (Rule 1 fix, 31-03): the write above flips the STORED status to
    // `exported`, after which the rules layer (31-01) and the store guard
    // (31-03) both refuse an ordinary update. Without mirroring these three
    // fields into the clean snapshot, `isDirty` stays true and the autosave
    // watcher fires a full-document `onSave` ~800ms later against a service
    // that is now locked — a guaranteed permission-denied write, every export.
    if (originalService.value) {
      originalService.value.pcExportedAt = localService.value.pcExportedAt
      originalService.value.pcPlanId = planId
      originalService.value.status = 'exported'
    }

    showExportDialog.value = false

    if (failures.length > 0) {
      exportError.value = `Plan ${exportMode.value === 'existing' ? 'updated' : 'created'} but ${failures.length} item(s) failed: ${failures.join(', ')}`
    } else {
      pcExported.value = true
      setTimeout(() => { pcExported.value = false }, 3000)
    }
  } catch (e) {
    // ME-01 — `assertWritable`'s message is written for developers ("R036:
    // refusing to update service svc-1 — its stored status is …"), and this
    // catch rendered it verbatim. By the time a ServiceLockedError can reach
    // here the Planning Center plan has ALREADY been created or updated, so the
    // copy has to say that: a user told only "try again" would export a second
    // time and duplicate the plan.
    if (e instanceof ServiceLockedError) {
      console.error('[ServiceEditorView] export write refused by the lock guard:', e)
      exportError.value =
        'The plan was written to Planning Center, but this service changed status before we ' +
        'could record it. Reload before exporting again — re-exporting now would create a duplicate plan.'
    } else {
      exportError.value = e instanceof Error ? e.message : 'Export failed'
    }
  } finally {
    isExporting.value = false
  }
}

async function onShare() {
  if (!localService.value || !serviceStore.orgId) return
  // WR-01 (48-REVIEW): re-entrancy guard — the action-bar button's own
  // `disabled: ctx.isSharing` is the primary defense, but this backstop
  // ensures a second concurrent invocation (e.g. a rapid double-click before
  // the disabled state re-renders) can never fire a second createShareToken
  // write while one is already in flight.
  if (isSharing.value) return
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

// ── Roles tab (Task 2) ──────────────────────────────────────────────────────────
// Editor-only: resolvedRoleAssignments/hasQuarterForServiceDate return empty/false
// for non-editors since rosterStore/quartersStore were never subscribed (Task 1).

const resolvedRoleAssignments = computed<ResolvedRoleAssignment[]>(() => {
  if (!authStore.isEditor || !localService.value) return []
  return resolveServiceRoleAssignments(localService.value, quartersStore.quarters, rosterStore.roles)
})

const hasQuarterForServiceDate = computed(() => {
  if (!authStore.isEditor || !localService.value) return false
  return findQuarterForDate(quartersStore.quarters, localService.value.date) !== undefined
})

function effectiveNames(assignment: ResolvedRoleAssignment): string[] {
  return assignment.effectivePersonIds.map(
    (id) => rosterStore.people.find((p) => p.id === id)?.name ?? id,
  )
}

// Eligibility mirrors QuarterGrid.vue's hasRole/availableUnassigned (person.roles.includes(roleId))
function eligiblePeople(roleId: string): Person[] {
  return rosterStore.activePeople.filter((p) => p.roles.includes(roleId))
}

// ★ R036: the Roles tab writes `roleAssignmentOverrides.{roleId}` through the
// store DIRECTLY, bypassing `localService`/autosave — so a template-only gate
// leaves the write path wide open. Both handlers guard. (The rules layer and the
// store guard already deny these writes on a locked service; the UI must not
// offer them, and must not fire a request it knows will be refused.)
async function onToggleOverridePerson(assignment: ResolvedRoleAssignment, personId: string) {
  if (!canEditService.value) return
  if (!localService.value) return
  const current = new Set(assignment.effectivePersonIds)
  if (current.has(personId)) {
    current.delete(personId)
  } else {
    current.add(personId)
  }
  const nextPersonIds = Array.from(current)

  // WR-02: optimistic local update. `assignment.effectivePersonIds` is derived
  // (via resolvedRoleAssignments) from localService.value, but without this it
  // only reflects a write once it round-trips through serviceStore.services.
  // Two rapid clicks on the same role's checkbox group (e.g. selecting two
  // different people) would otherwise both read the same stale
  // effectivePersonIds baseline, and the second write would silently clobber
  // the first. Mutating localService.value synchronously here means a
  // same-tick second click reads the just-applied state instead.
  if (!localService.value.roleAssignmentOverrides) {
    localService.value.roleAssignmentOverrides = {}
  }
  const previousOverride = localService.value.roleAssignmentOverrides[assignment.roleId]
  localService.value.roleAssignmentOverrides[assignment.roleId] = nextPersonIds

  try {
    await serviceStore.setRoleOverride(localService.value.id, assignment.roleId, nextPersonIds)
  } catch (err) {
    // Roll back the optimistic update so the UI doesn't show a state that
    // was never actually persisted.
    if (localService.value) {
      if (previousOverride === undefined) {
        delete localService.value.roleAssignmentOverrides[assignment.roleId]
      } else {
        localService.value.roleAssignmentOverrides[assignment.roleId] = previousOverride
      }
    }
    console.error('Failed to update role override:', err)
  }
}

async function onResetRoleOverride(roleId: string) {
  if (!canEditService.value) return
  if (!localService.value) return
  await serviceStore.clearRoleOverride(localService.value.id, roleId)
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
  // ★ 31-PATTERNS § 4a row 24 (BL-02). 31-04-SUMMARY recorded the decision to
  // leave this ungated because "the store guard already refuses it" — but this
  // phase made that refusal a THROW, so an ungated `onSave` is not a harmless
  // no-op, it is a rejected promise. Refusing here, like every other mutation
  // entry point in this file, is what makes the rejection unreachable rather
  // than merely caught.
  //
  // `canEditService`, not `isLocked`: a viewer is refused by the same line.
  // Note this cannot break `onMarkAsPlanned`'s flush — that awaits `onSave()`
  // while the service is still locally draft, before `applyTransitionLocally`.
  if (!canEditService.value) return
  if (!localService.value || !isDirty.value) return
  isSaving.value = true
  try {
    const { id, createdAt, updatedAt, ...data } = localService.value

    // The draft -> planned `lastUsedAt` bump that used to sit here has moved to
    // `bumpScheduledSongsLastUsed`, called by `onMarkAsPlanned`. D-01/D-02 took
    // status changes off this path entirely, so the `data.status === 'planned'`
    // condition this branch keyed on became unreachable — it would have looked
    // live while silently never firing again.

    // Persist the full slot array (reindexed) and other fields
    const normalizedSlots = reindexSlots(orderSlotsBySection(data.slots))
    const payload = {
      name: data.name,
      teams: data.teams,
      sermonPassage: data.sermonPassage,
      sermonTopic: data.sermonTopic ?? '',
      notes: data.notes,
      status: data.status,
      slots: normalizedSlots,
    }
    // CR-01: snapshot exactly what is about to be sent, so the "mark clean"
    // step below (after the WR-01 slots sync-back, which is also compared
    // against `normalizedSlots`, not the pre-normalization value) can tell a
    // genuinely-concurrent edit — made to localService while this write is
    // in flight — from that intentional sync-back.
    const sentSnapshot = JSON.stringify(payload)
    await serviceStore.updateService(id, payload)

    // WR-01: sync the just-persisted, normalized slot order back into
    // localService so display and persisted state agree in ORDER, not only
    // content — otherwise a legacy/corrupted document's first non-reorder
    // save silently reorders what's persisted without updating what's
    // displayed (self-heals on the next remote snapshot, but is a real,
    // avoidable mismatch until then).
    //
    // Guarded by reference equality against `data.slots` (captured before
    // any `await` above, including the scheduledSongIds loop and the write
    // itself): if something else reassigned `localService.value.slots` to a
    // NEW array during those awaits — most plausibly a reorder drag racing
    // this save, the same failure class CR-01 closed — the reference no
    // longer matches, and we must NOT clobber that newer, more current
    // array with this stale, pre-await snapshot. Skip the sync-back in that
    // case; the existing remote-merge watcher already reconciles any
    // resulting order mismatch on the next Firestore snapshot.
    if (localService.value && localService.value.slots === data.slots) {
      localService.value.slots = normalizedSlots
    }

    // Mark current local state as clean (don't overwrite localService — user
    // may still be typing) — but ONLY if it still matches exactly what was
    // just persisted above. CR-01: a distinct mutation made to localService
    // while the write was in flight (e.g. a different field edited between
    // the snapshot above and this line resolving) must NOT be marked clean
    // against a payload that never included it — doing so silently and
    // permanently drops that edit, because the next debounce timer's own
    // `isDirty` re-check would then see nothing to save. Leaving
    // originalService untouched in that case keeps isDirty accurately true,
    // so the still-armed follow-up timer performs a real save carrying the
    // concurrent edit instead of a false-positive no-op.
    if (
      localService.value &&
      JSON.stringify({
        name: localService.value.name,
        teams: localService.value.teams,
        sermonPassage: localService.value.sermonPassage,
        sermonTopic: localService.value.sermonTopic ?? '',
        notes: localService.value.notes,
        status: localService.value.status,
        slots: localService.value.slots,
      }) === sentSnapshot
    ) {
      originalService.value = JSON.parse(JSON.stringify(localService.value))
    }
  } finally {
    isSaving.value = false
  }
}

// ── Undo (restore previous autosave snapshot) ───────────────────────────────────

function onUndo() {
  // R036: restoring a pre-lock snapshot is a write, and it triggers an autosave
  // 800ms later that the store guard would then reject.
  if (!canEditService.value) return
  if (!previousService.value) return
  // Restore previous snapshot — triggers another autosave 800ms later.
  localService.value = JSON.parse(JSON.stringify(previousService.value))
  previousService.value = null
  autoSave.cleanup()
  saveStatus.set(surfaceId.value, { status: 'idle' })
}
</script>
