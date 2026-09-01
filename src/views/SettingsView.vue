<template>
  <AppShell>
    <div class="px-6 py-8 max-w-4xl">
      <!-- Page header -->
      <div class="mb-6 pb-4 border-b border-gray-800">
        <h1 class="text-xl font-semibold text-gray-100">Settings</h1>
        <p v-if="authStore.orgName" class="text-sm text-gray-400 mt-1">{{ authStore.orgName }}</p>
      </div>

      <!-- Organization section -->
      <div class="rounded-lg bg-gray-900 border border-gray-800 p-4">
        <h2 class="text-sm font-semibold text-gray-300 mb-3">Organization</h2>

        <div>
          <label class="block text-xs text-gray-400 mb-1">Organization Name</label>
          <input
            v-model="editName"
            type="text"
            placeholder="Enter organization name"
            class="w-full sm:w-80 bg-gray-800 border border-gray-700 text-gray-100 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-gray-500"
            @keydown.enter="onSave"
          />
        </div>

        <div class="mt-3 flex items-center gap-3">
          <button
            type="button"
            @click="onSave"
            :disabled="isSaveDisabled"
            class="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white rounded-md px-4 py-2 text-sm font-medium transition-colors"
          >
            {{ isSaving ? 'Saving...' : savedFeedback ? 'Saved!' : 'Save' }}
          </button>
        </div>

        <p v-if="saveError" class="text-red-400 text-sm mt-2">{{ saveError }}</p>

        <!-- See ADR-0236 (docs/adr/0236-save-action-share-url-slug-r-02-d-18.md) -->
        <div class="mt-6 pt-6 border-t border-gray-800">
          <label class="block text-xs text-gray-400 mb-1">Share URL slug</label>
          <input
            v-model="editSlug"
            type="text"
            placeholder="Enter a URL slug"
            class="w-full sm:w-80 bg-gray-800 border border-gray-700 text-gray-100 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-gray-500"
            @keydown.enter="onSaveSlug"
          />
          <p class="text-xs text-gray-500 mt-1">
            {{ shareUrlHost }}/{{ liveSlugPreview }}/quarter1-2026 — used in every quarterly share link
          </p>
        </div>

        <div class="mt-3 flex items-center gap-3">
          <button
            type="button"
            @click="onSaveSlug"
            :disabled="isSlugSaveDisabled"
            class="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white rounded-md px-4 py-2 text-sm font-medium transition-colors"
          >
            {{ isSlugSaving ? 'Saving...' : slugSavedFeedback ? 'Saved!' : 'Save' }}
          </button>
        </div>

        <p v-if="slugSaveError" class="text-red-400 text-sm mt-2">{{ slugSaveError }}</p>
      </div>

      <!-- Planning Center Integration section -->
      <div class="rounded-lg bg-gray-900 border border-gray-800 p-4 mt-6">
        <h2 class="text-sm font-semibold text-gray-300 mb-3">Planning Center Integration</h2>

        <!-- Enable/disable toggle (R073/R089) — always visible, above the credentials
             block, so a church can always turn the integration back on. Display-only:
             it never calls onClearPcCredentials or touches pcAppId/pcSecret. -->
        <label
          class="flex items-center gap-3"
          :class="authStore.isEditor ? 'cursor-pointer' : 'opacity-60 cursor-not-allowed'"
        >
          <input
            v-model="pcEnabledInput"
            type="checkbox"
            :disabled="!authStore.isEditor"
            @change="onTogglePcEnabled"
            class="h-4 w-4 rounded border-gray-700 bg-gray-800 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-0"
          />
          <span class="text-sm text-gray-200">Enable Planning Center integration</span>
        </label>

        <p class="text-xs text-gray-500 mt-2">
          When off, roster import, song import, and Export to Planning Center are hidden, and the
          credentials below are hidden too. Your saved credentials and already-imported data are
          kept — turning this back on picks up right where you left off.
        </p>

        <p v-if="pcEnabledSavedFeedback" class="text-green-400 text-sm mt-2">Saved!</p>
        <p v-if="pcEnabledSaveError" class="text-red-400 text-sm mt-2">{{ pcEnabledSaveError }}</p>

        <!-- Existing credentials block, now conditionally hidden. Display condition
             only — the credentials themselves are retained, not cleared, when off. -->
        <div v-if="pcEnabledInput" class="mt-6 pt-6 border-t border-gray-800">
          <!-- Display mode: credentials saved and not editing -->
          <template v-if="authStore.hasPcCredentials && !editingPcCreds">
            <div class="space-y-2 mb-3">
              <div>
                <span class="text-xs text-gray-400">App ID: </span>
                <span class="font-mono text-sm text-gray-400">............</span>
              </div>
              <div>
                <span class="text-xs text-gray-400">Secret: </span>
                <span class="font-mono text-sm text-gray-400">............</span>
              </div>
            </div>

            <!-- Success feedback after saving -->
            <p v-if="pcSaveSuccess" class="text-green-400 text-sm mb-2">Credentials saved!</p>

            <div class="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                @click="startEditPcCreds"
                class="bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-md px-4 py-2 text-sm font-medium transition-colors"
              >
                Edit Credentials
              </button>
              <button
                type="button"
                @click="onClearPcCredentials"
                class="bg-red-900/20 hover:bg-red-900/40 text-red-400 rounded-md px-4 py-2 text-sm font-medium transition-colors"
              >
                Clear Credentials
              </button>
            </div>
          </template>

          <!-- Edit mode: no credentials yet, or editing existing -->
          <template v-else>
            <!-- Wrapped in a <form> so the password field is form-contained
                 (Chrome warns otherwise) and Enter submits. autocomplete is
                 off: these are third-party Planning Center API credentials,
                 not the user's own login, so browser password-save prompts
                 would be misleading. -->
            <form @submit.prevent="onSavePcCredentials">
              <div class="space-y-3">
                <div>
                  <label class="block text-xs text-gray-400 mb-1">App ID</label>
                  <input
                    v-model="pcAppIdInput"
                    type="text"
                    autocomplete="off"
                    placeholder="Your Planning Center App ID"
                    class="w-full sm:w-80 bg-gray-800 border border-gray-700 text-gray-100 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-gray-500"
                  />
                </div>
                <div>
                  <label class="block text-xs text-gray-400 mb-1">Secret</label>
                  <input
                    v-model="pcSecretInput"
                    type="password"
                    autocomplete="off"
                    placeholder="Your Planning Center Secret"
                    class="w-full sm:w-80 bg-gray-800 border border-gray-700 text-gray-100 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-gray-500"
                  />
                </div>
                <p class="text-xs">
                  <a
                    href="https://planningcenteronline.com/api_passwords"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="text-indigo-400 hover:text-indigo-300"
                  >
                    Generate at planningcenteronline.com/api_passwords
                  </a>
                </p>
              </div>

              <p v-if="pcValidationError" class="text-red-400 text-sm mt-2">{{ pcValidationError }}</p>
              <p v-if="pcSaveSuccess" class="text-green-400 text-sm mt-2">Credentials saved!</p>

              <div class="mt-3 flex items-center gap-2 flex-wrap">
                <button
                  type="submit"
                  :disabled="pcValidating || !pcAppIdInput.trim() || !pcSecretInput.trim()"
                  class="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white rounded-md px-4 py-2 text-sm font-medium transition-colors"
                >
                  {{ pcValidating ? 'Validating...' : 'Save & Validate' }}
                </button>
                <button
                  v-if="editingPcCreds"
                  type="button"
                  @click="cancelEditPcCreds"
                  class="bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-md px-4 py-2 text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </template>
        </div>
      </div>

      <!-- Vertical Worship section (D-15/D-16) -->
      <div class="rounded-lg bg-gray-900 border border-gray-800 p-4 mt-6">
        <h2 class="text-sm font-semibold text-gray-300 mb-3">Vertical Worship</h2>

        <label
          class="flex items-center gap-3"
          :class="authStore.isEditor ? 'cursor-pointer' : 'opacity-60 cursor-not-allowed'"
        >
          <input
            v-model="vwModeInput"
            type="checkbox"
            :disabled="!authStore.isEditor"
            @change="onToggleVwMode"
            class="h-4 w-4 rounded border-gray-700 bg-gray-800 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-0"
          />
          <span class="text-sm text-gray-200">Vertical Worship 1-2-3 methodology</span>
        </label>

        <p class="text-xs text-gray-500 mt-2">
          When off, all Vertical Worship 1-2-3 indicators are hidden across the app. Your song
          categories are kept and reappear when you turn it back on.
        </p>

        <!-- Always-visible inline explanation (mirrors the Songs-page VwExplainer copy). -->
        <div class="mt-4 rounded-md bg-gray-950/40 border border-gray-800 p-3">
          <p class="text-xs text-gray-400 mb-2">
            This app supports Vertical Worship which plans a service as a journey from gathering
            together toward pure adoration of God — moving from the horizontal (us, our testimony)
            to the vertical (God alone).
          </p>
          <ul class="text-xs text-gray-400 space-y-1.5 mb-2 list-disc list-inside">
            <li>
              <span class="font-medium text-gray-200">Type 1 — Call to Worship (Gather):</span>
              bright, inviting songs that gather the congregation.
            </li>
            <li>
              <span class="font-medium text-gray-200">Type 2 — Intimate (Testimony):</span>
              reflective songs that voice our shared response.
            </li>
            <li>
              <span class="font-medium text-gray-200">Type 3 — Ascription (Arrive):</span>
              songs of pure ascription and adoration directed to God.
            </li>
          </ul>
          <p class="text-xs text-gray-400">
            A common flow is 1 → 2 → 2 → 3, ending on a Type 3 so the service arrives at undivided
            worship. You can turn this methodology off anytime in Settings.
          </p>
        </div>

        <p v-if="vwSavedFeedback" class="text-green-400 text-sm mt-2">Saved!</p>
        <p v-if="vwSaveError" class="text-red-400 text-sm mt-2">{{ vwSaveError }}</p>
      </div>

      <!-- AI Features section (R073/R088) — explains before offering the switch.
           Phase 82 (R242/R243): the entire card is v-if-gated on the
           super-admin master gate (authStore.aiMasterEnabled) — when a
           super-admin has disabled AI for this org, the church's own AI
           panel is not rendered at all, not merely disabled. -->
      <div
        v-if="authStore.aiMasterEnabled"
        class="rounded-lg bg-gray-900 border border-gray-800 p-4 mt-6"
      >
        <h2 class="text-sm font-semibold text-gray-300 mb-3">AI Features</h2>

        <!-- Explanatory copy FIRST -->
        <p class="text-xs text-gray-400 mb-3">
          This app uses AI to speed up planning in a few places. Turn it off and these disappear —
          nothing else about your service plans changes.
        </p>
        <ul class="text-xs text-gray-400 space-y-1.5 mb-4 list-disc list-inside">
          <li>
            <span class="font-medium text-gray-200">Song suggestions:</span>
            Ranks songs from your library that fit the slot and sermon context.
          </li>
          <li>
            <span class="font-medium text-gray-200">Scripture discovery:</span>
            Finds and suggests scripture passages based on your sermon topic or passage.
          </li>
          <li>
            <span class="font-medium text-gray-200">Congregational reading split:</span>
            Proposes one starting split of Leader/Congregation/All sections, which you can always
            edit by hand.
          </li>
        </ul>

        <!-- Toggle SECOND -->
        <label
          class="flex items-center gap-3"
          :class="authStore.isEditor ? 'cursor-pointer' : 'opacity-60 cursor-not-allowed'"
        >
          <input
            v-model="aiEnabledInput"
            type="checkbox"
            :disabled="!authStore.isEditor"
            @change="onToggleAiEnabled"
            class="h-4 w-4 rounded border-gray-700 bg-gray-800 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-0"
          />
          <span class="text-sm text-gray-200">Enable AI features</span>
        </label>
        <p class="text-xs text-gray-500 mt-2">
          When off, the three features above are hidden throughout the app. Content an AI already
          generated (like an existing congregational split) is never changed and stays fully
          editable.
        </p>

        <p v-if="aiSavedFeedback" class="text-green-400 text-sm mt-2">Saved!</p>
        <p v-if="aiSaveError" class="text-red-400 text-sm mt-2">{{ aiSaveError }}</p>
      </div>

      <!-- Bible Translation section (R090) — explains before offering the choice,
           mirrors the AI Features card exactly (45-UI-SPEC.md).
           Phase 103 (R300): the entire card is v-if-gated on
           authStore.isBibleApiEnabled — when an org's Bible API is off there
           is no API-backed version list to configure, so the card is hidden
           entirely (never deletes the stored bibleVersion field or its save
           logic; an org later re-enabled shows the selector again with its
           prior value). -->
      <div
        v-if="authStore.isBibleApiEnabled"
        class="rounded-lg bg-gray-900 border border-gray-800 p-4 mt-6"
      >
        <h2 class="text-sm font-semibold text-gray-300 mb-3">Bible Translation</h2>

        <p class="text-xs text-gray-400 mb-3">
          Choose which Bible translation this church uses for new scripture passages. Existing
          slides keep the translation they were created with — changing this here never rewrites
          what's already on a slide.
        </p>

        <div class="space-y-2">
          <label
            class="flex items-center gap-3"
            :class="authStore.isEditor ? 'cursor-pointer' : 'opacity-60 cursor-not-allowed'"
          >
            <input
              v-model="bibleVersionInput"
              type="radio"
              value="ESV"
              name="bibleVersion"
              :disabled="!authStore.isEditor"
              @change="onChangeBibleVersion"
              data-testid="bible-version-esv"
              class="h-4 w-4 border-gray-700 bg-gray-800 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-0"
            />
            <span class="text-sm text-gray-200">ESV (English Standard Version)</span>
          </label>
          <label
            class="flex items-center gap-3"
            :class="authStore.isEditor ? 'cursor-pointer' : 'opacity-60 cursor-not-allowed'"
          >
            <input
              v-model="bibleVersionInput"
              type="radio"
              value="NLT"
              name="bibleVersion"
              :disabled="!authStore.isEditor"
              @change="onChangeBibleVersion"
              data-testid="bible-version-nlt"
              class="h-4 w-4 border-gray-700 bg-gray-800 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-0"
            />
            <span class="text-sm text-gray-200">NLT (New Living Translation)</span>
          </label>
        </div>

        <p v-if="bibleVersionSavedFeedback" class="text-green-400 text-sm mt-2">Saved!</p>
        <p v-if="bibleVersionSaveError" class="text-red-400 text-sm mt-2">{{ bibleVersionSaveError }}</p>
      </div>

      <!-- Slide Typography section (R093) — explains before offering the choice,
           mirrors the Bible Translation card pattern (46-UI-SPEC.md). -->
      <div class="rounded-lg bg-gray-900 border border-gray-800 p-4 mt-6">
        <h2 class="text-sm font-semibold text-gray-300 mb-3">Slide Typography</h2>

        <p class="text-xs text-gray-400 mb-3">
          Choose one font, weight, and size for every slide across your services — the Slides
          grid, the Edit Slide drawer preview, and the presenter all match. The printed Order of
          Service is unaffected.
        </p>

        <div class="space-y-3">
          <div>
            <label class="block text-xs text-gray-400 mb-1">Font family</label>
            <select
              v-model="slideFontFamilyInput"
              :disabled="!authStore.isEditor"
              @change="onChangeSlideFontFamily"
              data-testid="slide-font-family-select"
              class="w-full sm:w-80 bg-gray-800 border border-gray-700 text-gray-100 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option v-for="name in SLIDE_FONT_FAMILY_NAMES" :key="name" :value="name">{{ name }}</option>
            </select>
          </div>

          <div>
            <label class="block text-xs text-gray-400 mb-1">Weight</label>
            <select
              v-model.number="slideFontWeightInput"
              :disabled="!authStore.isEditor"
              @change="saveSlideTypography"
              data-testid="slide-font-weight-select"
              class="w-full sm:w-80 bg-gray-800 border border-gray-700 text-gray-100 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option v-for="weight in slideFontWeightOptions" :key="weight" :value="weight">{{ weight }}</option>
            </select>
          </div>

          <div>
            <label class="block text-xs text-gray-400 mb-1">Size</label>
            <div class="flex items-center gap-4">
              <label
                class="flex items-center gap-2"
                :class="authStore.isEditor ? 'cursor-pointer' : 'opacity-60 cursor-not-allowed'"
              >
                <input
                  v-model="slideFontScaleInput"
                  type="radio"
                  value="sm"
                  name="slideFontScale"
                  :disabled="!authStore.isEditor"
                  @change="saveSlideTypography"
                  data-testid="slide-font-scale-sm"
                  class="h-4 w-4 border-gray-700 bg-gray-800 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-0"
                />
                <span class="text-sm text-gray-200">Small</span>
              </label>
              <label
                class="flex items-center gap-2"
                :class="authStore.isEditor ? 'cursor-pointer' : 'opacity-60 cursor-not-allowed'"
              >
                <input
                  v-model="slideFontScaleInput"
                  type="radio"
                  value="md"
                  name="slideFontScale"
                  :disabled="!authStore.isEditor"
                  @change="saveSlideTypography"
                  data-testid="slide-font-scale-md"
                  class="h-4 w-4 border-gray-700 bg-gray-800 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-0"
                />
                <span class="text-sm text-gray-200">Medium</span>
              </label>
              <label
                class="flex items-center gap-2"
                :class="authStore.isEditor ? 'cursor-pointer' : 'opacity-60 cursor-not-allowed'"
              >
                <input
                  v-model="slideFontScaleInput"
                  type="radio"
                  value="lg"
                  name="slideFontScale"
                  :disabled="!authStore.isEditor"
                  @change="saveSlideTypography"
                  data-testid="slide-font-scale-lg"
                  class="h-4 w-4 border-gray-700 bg-gray-800 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-0"
                />
                <span class="text-sm text-gray-200">Large</span>
              </label>
            </div>
          </div>
        </div>

        <p v-if="slideTypographySavedFeedback" class="text-green-400 text-sm mt-2">Saved!</p>
        <p v-if="slideTypographySaveError" class="text-red-400 text-sm mt-2">{{ slideTypographySaveError }}</p>

        <!-- Live Preview panel — the card's visual focal point (UI-SPEC D2 flag). -->
        <div class="mt-4">
          <p class="text-xs text-gray-400 mb-1" data-testid="slide-typography-preview-label">Preview</p>
          <div
            class="rounded-md bg-gray-950/40 border border-gray-800 p-3 text-gray-100"
            data-testid="slide-typography-preview"
            :style="slideTypographyPreviewStyle"
          >
            Amazing grace, how sweet the sound
          </div>
        </div>
      </div>

      <!-- Messaging section (R130/R132/R133, Phase 58) — explains before offering
           the switch, mirrors the AI Features card exactly (58-UI-SPEC.md). -->
      <div class="rounded-lg bg-gray-900 border border-gray-800 p-4 mt-6">
        <h2 class="text-sm font-semibold text-gray-300 mb-3">Messaging</h2>

        <!-- Explanatory copy FIRST -->
        <p class="text-xs text-gray-400 mb-3">
          Send email to the volunteers assigned to a service — locked-service notices,
          share-link reminders, and one-off messages. Turn it off and no email goes out;
          nothing else about your service plans changes.
        </p>

        <!-- Toggle SECOND -->
        <label
          class="flex items-center gap-3"
          :class="authStore.isEditor ? 'cursor-pointer' : 'opacity-60 cursor-not-allowed'"
        >
          <input
            v-model="messagingEnabledInput"
            type="checkbox"
            :disabled="!authStore.isEditor"
            @change="onToggleMessagingEnabled"
            data-testid="messaging-enabled-toggle"
            class="h-4 w-4 rounded border-gray-700 bg-gray-800 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-0"
          />
          <span class="text-sm text-gray-200">Enable volunteer email messaging</span>
        </label>

        <p v-if="messagingSavedFeedback" class="text-green-400 text-sm mt-2">Saved!</p>
        <p v-if="messagingSaveError" class="text-red-400 text-sm mt-2">{{ messagingSaveError }}</p>

        <!-- Automatic email defaults sub-block — mirrors the PC Integration card's
             credential-reveal pattern exactly (v-if wrapping mt-6 pt-6 border-t). -->
        <div v-if="messagingEnabledInput" class="mt-6 pt-6 border-t border-gray-800">
          <p class="text-xs text-gray-400 mb-3">
            These are the starting values for every service — a planner can still override
            them per service while it's in Draft.
          </p>

          <label
            class="flex items-center gap-3"
            :class="authStore.isEditor ? 'cursor-pointer' : 'opacity-60 cursor-not-allowed'"
          >
            <input
              v-model="lockNotifyDefaultInput"
              type="checkbox"
              :disabled="!authStore.isEditor"
              @change="onToggleLockNotifyDefault"
              data-testid="messaging-lock-notify-toggle"
              class="h-4 w-4 rounded border-gray-700 bg-gray-800 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-0"
            />
            <span class="text-sm text-gray-200">Email everyone when a service is locked</span>
          </label>
          <p v-if="lockNotifySavedFeedback" class="text-green-400 text-sm mt-2">Saved!</p>
          <p v-if="lockNotifySaveError" class="text-red-400 text-sm mt-2">{{ lockNotifySaveError }}</p>

          <label
            class="flex items-center gap-3 mt-3"
            :class="authStore.isEditor ? 'cursor-pointer' : 'opacity-60 cursor-not-allowed'"
          >
            <input
              v-model="reminderEnabledInput"
              type="checkbox"
              :disabled="!authStore.isEditor"
              @change="onToggleReminderEnabled"
              data-testid="messaging-reminder-enabled-toggle"
              class="h-4 w-4 rounded border-gray-700 bg-gray-800 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-0"
            />
            <span class="text-sm text-gray-200">Send the service link before the service</span>
          </label>
          <p v-if="reminderEnabledSavedFeedback" class="text-green-400 text-sm mt-2">Saved!</p>
          <p v-if="reminderEnabledSaveError" class="text-red-400 text-sm mt-2">{{ reminderEnabledSaveError }}</p>

          <div v-if="reminderEnabledInput" class="mt-3">
            <label class="block text-xs text-gray-400 mb-1">Send it this many days before the service</label>
            <select
              v-model.number="reminderDaysBeforeInput"
              :disabled="!authStore.isEditor"
              @change="onChangeReminderDaysBefore"
              data-testid="messaging-reminder-days-select"
              class="w-full sm:w-80 bg-gray-800 border border-gray-700 text-gray-100 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option v-for="days in reminderDaysBeforeOptions" :key="days" :value="days">{{ days }}</option>
            </select>
            <p v-if="reminderDaysBeforeSavedFeedback" class="text-green-400 text-sm mt-2">Saved!</p>
            <p v-if="reminderDaysBeforeSaveError" class="text-red-400 text-sm mt-2">
              {{ reminderDaysBeforeSaveError }}
            </p>
          </div>

          <!-- From name / Reply-to removed (owner UAT 2026-08-17): outgoing
               volunteer emails now send from the app's own verified address with
               the organization's name as the display name, and Reply-to is
               auto-built from the sending editor — churches no longer configure
               either (they can't own the sending domain). See functions/src/index.ts
               `fromDisplayName` + the sendQueuedMessage From/Reply-To assembly. -->
        </div>

        <!-- Organization timezone — always visible, NOT gated by the kill-switch
             (conceptually org-wide, per 58-CONTEXT.md). -->
        <div class="mt-6 pt-6 border-t border-gray-800">
          <label class="block text-xs text-gray-400 mb-1">Organization timezone</label>
          <select
            v-model="timezoneInput"
            :disabled="!authStore.isEditor"
            @change="onChangeTimezone"
            data-testid="messaging-timezone-select"
            class="w-full sm:w-80 bg-gray-800 border border-gray-700 text-gray-100 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option v-for="tz in TIMEZONE_OPTIONS" :key="tz.value" :value="tz.value">{{ tz.label }}</option>
          </select>
          <p class="text-xs text-gray-500 mt-2">
            Used by the scheduled service-link reminder, once messaging is turned on above.
          </p>
          <p v-if="timezoneSavedFeedback" class="text-green-400 text-sm mt-2">Saved!</p>
          <p v-if="timezoneSaveError" class="text-red-400 text-sm mt-2">{{ timezoneSaveError }}</p>
        </div>
      </div>

    </div>
  </AppShell>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { doc, updateDoc, getDoc } from 'firebase/firestore'
import { db } from '@/firebase'
import { useAuthStore } from '@/stores/auth'
import AppShell from '@/components/AppShell.vue'
import { validatePcCredentials } from '@/utils/planningCenterApi'
import { deriveSlug, claimSlug } from '@/utils/slug'
import { normalizeOrgName, claimOrgName } from '@/utils/orgName'
import { SLIDE_FONTS, SLIDE_FONT_FAMILY_NAMES } from '@/config/slideFonts'
import { cssVarsFor, snapWeight, loadFontCss } from '@/utils/slideTypography'

const authStore = useAuthStore()

// ── Local state ────────────────────────────────────────────────────────────────

const editName = ref(authStore.orgName ?? '')
const isSaving = ref(false)
const savedFeedback = ref(false)
const saveError = ref<string | null>(null)

// See ADR-0236 (docs/adr/0236-save-action-share-url-slug-r-02-d-18.md)

const editSlug = ref('')
const persistedSlug = ref<string | null>(null)
const isSlugSaving = ref(false)
const slugSavedFeedback = ref(false)
const slugSaveError = ref<string | null>(null)

// ── PC credential state ────────────────────────────────────────────────────────

const editingPcCreds = ref(false)
const pcAppIdInput = ref('')
const pcSecretInput = ref('')
const pcValidating = ref(false)
const pcValidationError = ref<string | null>(null)
const pcSaveSuccess = ref(false)

// ── Vertical Worship toggle state (D-15/D-16) ─────────────────────────────────

const vwModeInput = ref(authStore.vwModeEnabled)
const vwSavedFeedback = ref(false)
const vwSaveError = ref<string | null>(null)

// ── AI Features toggle state (R073/R088) ───────────────────────────────────────

const aiEnabledInput = ref(authStore.settings.aiEnabled)
const aiSavedFeedback = ref(false)
const aiSaveError = ref<string | null>(null)

// ── Planning Center enable toggle state (R073/R089) ────────────────────────────

const pcEnabledInput = ref(authStore.settings.pcEnabled)
const pcEnabledSavedFeedback = ref(false)
const pcEnabledSaveError = ref<string | null>(null)

// ── Bible Translation choice state (R090) ───────────────────────────────────────

const bibleVersionInput = ref(authStore.settings.bibleVersion)
const bibleVersionSavedFeedback = ref(false)
const bibleVersionSaveError = ref<string | null>(null)

// ── Slide Typography choice state (R093) ────────────────────────────────────────
// No local defaults-merge/`?? ...` here — `authStore.settings.slideTypography`
// is already defaulted by `loadOrgContext`'s single merge point (46-02-SUMMARY.md).

const slideFontFamilyInput = ref(authStore.settings.slideTypography.fontFamily)
const slideFontWeightInput = ref(authStore.settings.slideTypography.fontWeight)
const slideFontScaleInput = ref(authStore.settings.slideTypography.fontScale)
const slideTypographySavedFeedback = ref(false)
const slideTypographySaveError = ref<string | null>(null)

// ── Messaging kill-switch + automatic email defaults state (R130/R132, Phase 58) ──
// IMPORTANT: seeded from authStore.settings.messaging.enabled, which resolves to
// `false` for a fresh org via DEFAULT_ORG_SETTINGS — the one deliberate divergence
// from aiEnabled/pcEnabled's default-true seed above (58-PATTERNS.md).

const messagingEnabledInput = ref(authStore.settings.messaging.enabled)
const messagingSavedFeedback = ref(false)
const messagingSaveError = ref<string | null>(null)

const lockNotifyDefaultInput = ref(authStore.settings.messaging.lockNotifyDefault)
const lockNotifySavedFeedback = ref(false)
const lockNotifySaveError = ref<string | null>(null)

const reminderEnabledInput = ref(authStore.settings.messaging.reminderEnabled)
const reminderEnabledSavedFeedback = ref(false)
const reminderEnabledSaveError = ref<string | null>(null)

const reminderDaysBeforeOptions = [1, 2, 3, 5, 7, 10, 14] as const
const reminderDaysBeforeInput = ref(authStore.settings.messaging.reminderDaysBefore)
const reminderDaysBeforeSavedFeedback = ref(false)
const reminderDaysBeforeSaveError = ref<string | null>(null)

// ── Organization timezone state (R133, Phase 58) ───────────────────────────────
// Curated shortlist (58-CONTEXT.md's "Claude's Discretion") rather than the full
// IANA list — labeled by common name, valued by IANA string.

const TIMEZONE_OPTIONS = [
  { value: 'America/New_York', label: 'Eastern (America/New_York)' },
  { value: 'America/Chicago', label: 'Central (America/Chicago)' },
  { value: 'America/Denver', label: 'Mountain (America/Denver)' },
  { value: 'America/Phoenix', label: 'Arizona, no DST (America/Phoenix)' },
  { value: 'America/Los_Angeles', label: 'Pacific (America/Los_Angeles)' },
  { value: 'America/Anchorage', label: 'Alaska (America/Anchorage)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii (Pacific/Honolulu)' },
] as const

const timezoneInput = ref(authStore.settings.timezone)
const timezoneSavedFeedback = ref(false)
const timezoneSaveError = ref<string | null>(null)

/** Per-family weight ramp (46-01's SLIDE_FONTS), re-derived every time the
 *  selected family changes — drives the Weight <select>'s option list. */
const slideFontWeightOptions = computed(
  () => SLIDE_FONTS[slideFontFamilyInput.value]?.weights ?? [400],
)

/** Live Preview panel style (UI-SPEC D2 visual focal point) — binds the SAME
 *  `cssVarsFor` the render sites (46-04) consume, so the preview always
 *  matches exactly what a slide will look like. A fetching previewed family
 *  keeps rendering the last successfully-loaded face via `font-display:
 *  swap` (no spinner); a failed asset falls through the native CSS stack
 *  (no custom error UI) — both per 46-UI-SPEC.md's covered UI Considerations
 *  rows, requiring no extra state here. */
const slideTypographyPreviewStyle = computed(() => {
  // IN-02 (46-REVIEW.md): pass cssVarsFor's output through unmodified — no
  // String(...) re-typing — matching the other three render sites exactly,
  // so this preview is a true single-source-of-truth match, not merely an
  // equivalent-looking one. The DOM's setProperty binding coerces a numeric
  // custom-property value the same as every other call site already relies
  // on (PresentationViewer.vue, SlideGrid.vue, EditSlideDrawer.vue).
  const vars = cssVarsFor({
    fontFamily: slideFontFamilyInput.value,
    fontWeight: slideFontWeightInput.value,
    fontScale: slideFontScaleInput.value,
  })
  return {
    ...vars,
    fontFamily: 'var(--slide-font-family)',
    fontWeight: 'var(--slide-font-weight)',
    fontSize: 'calc(1rem * var(--slide-font-scale))',
  }
})

// ── Computed ───────────────────────────────────────────────────────────────────

const isSaveDisabled = computed(() => {
  return (
    isSaving.value ||
    editName.value.trim() === '' ||
    editName.value.trim() === authStore.orgName
  )
})

// Sanitized live preview so the helper text's {slug} segment updates as the user types,
// before any save/claim happens.
const liveSlugPreview = computed(() => deriveSlug(editSlug.value) || 'your-church')

// The real origin the app is served from, so the slug helper text shows the
// actual share-link host (matches QuarterView's buildShareUrl) instead of a
// hard-coded "yourapp.com" placeholder. Strip the protocol for a cleaner hint.
const shareUrlHost = computed(() =>
  window.location.origin.replace(/^https?:\/\//, ''),
)

const isSlugSaveDisabled = computed(() => {
  const candidate = deriveSlug(editSlug.value)
  return isSlugSaving.value || candidate === '' || candidate === persistedSlug.value
})

// ── Sync editName if orgName changes externally (skip during save) ────────────

watch(
  () => authStore.orgName,
  (newName) => {
    if (newName !== null && !isSaving.value) {
      editName.value = newName
    }
  },
)

// ── Load the org's persisted slug (or derive a live default from orgName) ─────

async function loadOrgSlug() {
  if (!authStore.orgId) return
  try {
    const snap = await getDoc(doc(db, 'organizations', authStore.orgId))
    if (!snap.exists()) return
    const data = snap.data()
    const slug = (data.slug as string | undefined) ?? null
    persistedSlug.value = slug
    editSlug.value = slug ?? deriveSlug(authStore.orgName ?? '')
  } catch (err) {
    console.error('[SettingsView] load org slug error:', err)
  }
}

watch(
  () => authStore.orgId,
  (id) => {
    if (id) loadOrgSlug()
  },
  { immediate: true },
)

// See ADR-0237 (docs/adr/0237-keep-the-local-checkbox-in-sync-if-the-store-s-org-context-f.md)
watch(
  () => authStore.vwModeEnabled,
  (val) => {
    vwModeInput.value = val
  },
)

watch(
  () => authStore.settings.aiEnabled,
  (val) => {
    aiEnabledInput.value = val
  },
)

watch(
  () => authStore.settings.pcEnabled,
  (val) => {
    pcEnabledInput.value = val
  },
)

watch(
  () => authStore.settings.bibleVersion,
  (val) => {
    bibleVersionInput.value = val
  },
)

watch(
  () => authStore.settings.slideTypography,
  (val) => {
    slideFontFamilyInput.value = val.fontFamily
    slideFontWeightInput.value = val.fontWeight
    slideFontScaleInput.value = val.fontScale
  },
  { deep: true },
)

watch(
  () => authStore.settings.messaging,
  (val) => {
    messagingEnabledInput.value = val.enabled
    lockNotifyDefaultInput.value = val.lockNotifyDefault
    reminderEnabledInput.value = val.reminderEnabled
    reminderDaysBeforeInput.value = val.reminderDaysBefore
  },
  { deep: true },
)

watch(
  () => authStore.settings.timezone,
  (val) => {
    timezoneInput.value = val
  },
)

// ── Save action (Org name) ─────────────────────────────────────────────────────

async function onSave() {
  if (isSaveDisabled.value) return
  if (!authStore.orgId) return

  saveError.value = null
  isSaving.value = true

  try {
    const trimmed = editName.value.trim()
    // Names are unique across all orgs (owner decision 2026-08-17): claim the
    // normalized name via the create-only orgNames registry FIRST; a collision
    // with another org is rejected (claimOrgName is idempotent for our own name,
    // so re-saving or renaming back to a name we hold is not a false "taken").
    const claimed = await claimOrgName(normalizeOrgName(trimmed), authStore.orgId)
    if (!claimed) {
      saveError.value = 'That name is already taken — try a different one.'
      return
    }
    await updateDoc(doc(db, 'organizations', authStore.orgId), { name: trimmed })
    authStore.orgName = trimmed

    savedFeedback.value = true
    setTimeout(() => {
      savedFeedback.value = false
    }, 2000)
  } catch (err) {
    console.error('[SettingsView] save org name error:', err)
    saveError.value = 'Failed to save. Please try again.'
  } finally {
    isSaving.value = false
  }
}

// See ADR-0236 (docs/adr/0236-save-action-share-url-slug-r-02-d-18.md)

async function onSaveSlug() {
  if (isSlugSaveDisabled.value) return
  if (!authStore.orgId) return

  slugSaveError.value = null
  isSlugSaving.value = true

  try {
    const candidate = deriveSlug(editSlug.value)
    const claimed = await claimSlug(candidate, authStore.orgId)

    if (claimed !== candidate) {
      // The exact slug the user asked for is already claimed by another org — claimSlug's
      // retry loop silently reserved a numeric-suffixed fallback instead. For a manual
      // Settings edit that silent substitution would be surprising, so surface it as a
      // collision rather than accepting it (D-18: manual edits should be explicit).
      slugSaveError.value = 'That URL is already taken — try a different one.'
      return
    }

    await updateDoc(doc(db, 'organizations', authStore.orgId), { slug: claimed })
    persistedSlug.value = claimed
    editSlug.value = claimed
    // Keep the shared auth-store slug current so share links (e.g. the Schedule
    // page's Finalize & Share URL) reflect the new slug without a reload.
    authStore.orgSlug = claimed

    slugSavedFeedback.value = true
    setTimeout(() => {
      slugSavedFeedback.value = false
    }, 2000)
  } catch (err) {
    console.error('[SettingsView] save slug error:', err)
    slugSaveError.value = 'That URL is already taken — try a different one.'
  } finally {
    isSlugSaving.value = false
  }
}

// ── PC credential actions ──────────────────────────────────────────────────────

function startEditPcCreds() {
  // Do NOT pre-fill inputs with actual values (per plan pitfall 6)
  pcAppIdInput.value = ''
  pcSecretInput.value = ''
  pcValidationError.value = null
  editingPcCreds.value = true
}

function cancelEditPcCreds() {
  editingPcCreds.value = false
  pcAppIdInput.value = ''
  pcSecretInput.value = ''
  pcValidationError.value = null
}

async function onSavePcCredentials() {
  if (!authStore.orgId) return
  if (!pcAppIdInput.value.trim() || !pcSecretInput.value.trim()) return

  pcValidating.value = true
  pcValidationError.value = null
  pcSaveSuccess.value = false

  try {
    const result = await validatePcCredentials(pcAppIdInput.value.trim(), pcSecretInput.value.trim())

    if (!result.valid) {
      pcValidationError.value = result.error ?? 'Invalid credentials'
      return
    }

    // Save to Firestore
    await updateDoc(doc(db, 'organizations', authStore.orgId), {
      pcAppId: pcAppIdInput.value.trim(),
      pcSecret: pcSecretInput.value.trim(),
    })

    // Update auth store
    authStore.setPcCredentials(
      pcAppIdInput.value.trim(),
      pcSecretInput.value.trim(),
    )

    pcSaveSuccess.value = true
    editingPcCreds.value = false
    setTimeout(() => {
      pcSaveSuccess.value = false
    }, 2000)

    // Clear inputs
    pcAppIdInput.value = ''
    pcSecretInput.value = ''
  } catch (err) {
    console.error('[SettingsView] save PC credentials error:', err)
    pcValidationError.value = err instanceof Error ? err.message : 'Failed to save credentials'
  } finally {
    pcValidating.value = false
  }
}

async function onClearPcCredentials() {
  if (!authStore.orgId) return

  try {
    await updateDoc(doc(db, 'organizations', authStore.orgId), {
      pcAppId: null,
      pcSecret: null,
    })
    authStore.setPcCredentials(null, null)
    editingPcCreds.value = false
  } catch (err) {
    console.error('[SettingsView] clear PC credentials error:', err)
  }
}

// See ADR-0237 (docs/adr/0237-keep-the-local-checkbox-in-sync-if-the-store-s-org-context-f.md)

async function onToggleVwMode() {
  if (!authStore.orgId || !authStore.isEditor) return

  const newValue = vwModeInput.value
  vwSaveError.value = null

  try {
    // Lazy backfill (R073): write the nested leaf path, not the flat field.
    // The next time any organization saves this toggle it gains a nested
    // value; nothing else backfills and no migration script is ever run.
    // The flat field stays untouched and still readable by the dual-read.
    await updateDoc(doc(db, 'organizations', authStore.orgId), { 'settings.vwModeEnabled': newValue })
    authStore.vwModeEnabled = newValue

    vwSavedFeedback.value = true
    setTimeout(() => {
      vwSavedFeedback.value = false
    }, 2000)
  } catch (err) {
    console.error('[SettingsView] save vwModeEnabled error:', err)
    vwSaveError.value = 'Failed to save. Please try again.'
    // Revert the local checkbox to reflect the unsaved state
    vwModeInput.value = !newValue
  }
}

// ── AI Features toggle action (R073/R088) ──────────────────────────────────────
// Mirror-write template follows onToggleVwMode: a quoted dot-path leaf key, never
// a whole-map write, so a concurrent editor's write to a sibling settings.* key
// is never clobbered.

async function onToggleAiEnabled() {
  if (!authStore.orgId || !authStore.isEditor) return

  const newValue = aiEnabledInput.value
  aiSaveError.value = null

  try {
    await updateDoc(doc(db, 'organizations', authStore.orgId), { 'settings.aiEnabled': newValue })
    authStore.settings.aiEnabled = newValue

    aiSavedFeedback.value = true
    setTimeout(() => {
      aiSavedFeedback.value = false
    }, 2000)
  } catch (err) {
    console.error('[SettingsView] save aiEnabled error:', err)
    aiSaveError.value = 'Failed to save. Please try again.'
    // Revert the local checkbox to reflect the unsaved state
    aiEnabledInput.value = !newValue
  }
}

// ── Planning Center enable toggle action (R073/R089) ───────────────────────────
// Display-only companion to the existing credentials block. This handler never
// touches pcAppId/pcSecret and never calls onClearPcCredentials/setPcCredentials
// — stored credentials are retained, not cleared, when the integration is off.

async function onTogglePcEnabled() {
  if (!authStore.orgId || !authStore.isEditor) return

  const newValue = pcEnabledInput.value
  pcEnabledSaveError.value = null

  try {
    await updateDoc(doc(db, 'organizations', authStore.orgId), { 'settings.pcEnabled': newValue })
    authStore.settings.pcEnabled = newValue

    pcEnabledSavedFeedback.value = true
    setTimeout(() => {
      pcEnabledSavedFeedback.value = false
    }, 2000)
  } catch (err) {
    console.error('[SettingsView] save pcEnabled error:', err)
    pcEnabledSaveError.value = 'Failed to save. Please try again.'
    // Revert the local checkbox to reflect the unsaved state
    pcEnabledInput.value = !newValue
  }
}

// ── Bible Translation choice action (R090) ──────────────────────────────────────
// Mirror-write template follows onToggleAiEnabled/onTogglePcEnabled: a quoted
// dot-path leaf key, never a whole-map write. The control is a two-option
// exclusive radio (T-45-21) — only 'ESV'/'NLT' can ever be selected, so the
// revert-on-error can safely flip to "the other option", the same shape as
// the boolean toggles' `= !newValue` revert.
async function onChangeBibleVersion() {
  if (!authStore.orgId || !authStore.isEditor) return

  const newValue = bibleVersionInput.value
  bibleVersionSaveError.value = null

  try {
    await updateDoc(doc(db, 'organizations', authStore.orgId), {
      'settings.bibleVersion': newValue,
    })
    authStore.settings.bibleVersion = newValue

    bibleVersionSavedFeedback.value = true
    setTimeout(() => {
      bibleVersionSavedFeedback.value = false
    }, 2000)
  } catch (err) {
    console.error('[SettingsView] save bibleVersion error:', err)
    bibleVersionSaveError.value = 'Failed to save. Please try again.'
    // Revert the local radio selection to reflect the unsaved state
    bibleVersionInput.value = newValue === 'ESV' ? 'NLT' : 'ESV'
  }
}

// ── Slide Typography save action (R093) ─────────────────────────────────────────
// Writes all three leaf dot-paths in a single updateDoc call (never a whole-map
// write), then mirrors the whole object into authStore.settings.slideTypography
// (matching onSave's Services-template whole-object mirror, since family/weight/
// scale are always saved together as one selection, unlike the independent
// toggles above).

async function saveSlideTypography() {
  if (!authStore.orgId || !authStore.isEditor) return

  const previous = { ...authStore.settings.slideTypography }
  const newValue = {
    fontFamily: slideFontFamilyInput.value,
    fontWeight: slideFontWeightInput.value,
    fontScale: slideFontScaleInput.value,
  }
  slideTypographySaveError.value = null

  try {
    await updateDoc(doc(db, 'organizations', authStore.orgId), {
      'settings.slideTypography.fontFamily': newValue.fontFamily,
      'settings.slideTypography.fontWeight': newValue.fontWeight,
      'settings.slideTypography.fontScale': newValue.fontScale,
    })
    authStore.settings.slideTypography = newValue

    slideTypographySavedFeedback.value = true
    setTimeout(() => {
      slideTypographySavedFeedback.value = false
    }, 2000)
  } catch (err) {
    console.error('[SettingsView] save slideTypography error:', err)
    slideTypographySaveError.value = "Couldn't save your slide typography settings. Try again."
    // Revert the local selection to reflect the unsaved state
    slideFontFamilyInput.value = previous.fontFamily
    slideFontWeightInput.value = previous.fontWeight
    slideFontScaleInput.value = previous.fontScale
  }
}

// On family change: re-derive the weight ramp (slideFontWeightOptions above),
// snap an unreachable weight to 400 BEFORE saving (e.g. 300 selected, family
// switched to Lora which has no 300 — 46-UI-SPEC.md "partial" row), and
// on-demand load that family's face for the live Preview (the eager import
// in main.ts only covers the org's currently-saved default).
async function onChangeSlideFontFamily() {
  const snapped = snapWeight(slideFontFamilyInput.value, slideFontWeightInput.value)
  slideFontWeightInput.value = snapped
  // See ADR-0238 (docs/adr/0238-a-genuinely-failed-dynamic-import-here-would-otherwise-surfa.md)
  loadFontCss(slideFontFamilyInput.value, snapped).catch(() => {})
  await saveSlideTypography()
}

// ── Messaging kill-switch action (R130) ─────────────────────────────────────────
// Mirror-write template follows onToggleAiEnabled/onTogglePcEnabled verbatim: a
// quoted dot-path leaf key, never a whole-map write.

async function onToggleMessagingEnabled() {
  if (!authStore.orgId || !authStore.isEditor) return

  const newValue = messagingEnabledInput.value
  messagingSaveError.value = null

  try {
    await updateDoc(doc(db, 'organizations', authStore.orgId), { 'settings.messaging.enabled': newValue })
    authStore.settings.messaging.enabled = newValue

    messagingSavedFeedback.value = true
    setTimeout(() => {
      messagingSavedFeedback.value = false
    }, 2000)
  } catch (err) {
    console.error('[SettingsView] save messaging.enabled error:', err)
    messagingSaveError.value = 'Failed to save. Please try again.'
    // Revert the local checkbox to reflect the unsaved state
    messagingEnabledInput.value = !newValue
  }
}

// ── Automatic email defaults actions (R132) ─────────────────────────────────────

async function onToggleLockNotifyDefault() {
  if (!authStore.orgId || !authStore.isEditor) return

  const newValue = lockNotifyDefaultInput.value
  lockNotifySaveError.value = null

  try {
    await updateDoc(doc(db, 'organizations', authStore.orgId), {
      'settings.messaging.lockNotifyDefault': newValue,
    })
    authStore.settings.messaging.lockNotifyDefault = newValue

    lockNotifySavedFeedback.value = true
    setTimeout(() => {
      lockNotifySavedFeedback.value = false
    }, 2000)
  } catch (err) {
    console.error('[SettingsView] save messaging.lockNotifyDefault error:', err)
    lockNotifySaveError.value = 'Failed to save. Please try again.'
    lockNotifyDefaultInput.value = !newValue
  }
}

async function onToggleReminderEnabled() {
  if (!authStore.orgId || !authStore.isEditor) return

  const newValue = reminderEnabledInput.value
  reminderEnabledSaveError.value = null

  try {
    await updateDoc(doc(db, 'organizations', authStore.orgId), {
      'settings.messaging.reminderEnabled': newValue,
    })
    authStore.settings.messaging.reminderEnabled = newValue

    reminderEnabledSavedFeedback.value = true
    setTimeout(() => {
      reminderEnabledSavedFeedback.value = false
    }, 2000)
  } catch (err) {
    console.error('[SettingsView] save messaging.reminderEnabled error:', err)
    reminderEnabledSaveError.value = 'Failed to save. Please try again.'
    reminderEnabledInput.value = !newValue
  }
}

// See ADR-0239 (docs/adr/0239-reminderdaysbefore-must-persist-as-a-number-v-model-number-a.md)
async function onChangeReminderDaysBefore() {
  if (!authStore.orgId || !authStore.isEditor) return

  const previous = authStore.settings.messaging.reminderDaysBefore
  const newValue = Number(reminderDaysBeforeInput.value)
  reminderDaysBeforeSaveError.value = null

  try {
    await updateDoc(doc(db, 'organizations', authStore.orgId), {
      'settings.messaging.reminderDaysBefore': newValue,
    })
    authStore.settings.messaging.reminderDaysBefore = newValue

    reminderDaysBeforeSavedFeedback.value = true
    setTimeout(() => {
      reminderDaysBeforeSavedFeedback.value = false
    }, 2000)
  } catch (err) {
    console.error('[SettingsView] save messaging.reminderDaysBefore error:', err)
    reminderDaysBeforeSaveError.value = 'Failed to save. Please try again.'
    // Revert to the prior NUMERIC value, not a two-way flip.
    reminderDaysBeforeInput.value = previous
  }
}

// ── Organization timezone action (R133) ─────────────────────────────────────────
// Same triad as onChangeBibleVersion, adapted from a two-option radio to a
// <select>: revert-on-error restores the prior IANA string value.

async function onChangeTimezone() {
  if (!authStore.orgId || !authStore.isEditor) return

  const previous = authStore.settings.timezone
  const newValue = timezoneInput.value
  timezoneSaveError.value = null

  try {
    await updateDoc(doc(db, 'organizations', authStore.orgId), { 'settings.timezone': newValue })
    authStore.settings.timezone = newValue

    timezoneSavedFeedback.value = true
    setTimeout(() => {
      timezoneSavedFeedback.value = false
    }, 2000)
  } catch (err) {
    console.error('[SettingsView] save timezone error:', err)
    timezoneSaveError.value = 'Failed to save. Please try again.'
    timezoneInput.value = previous
  }
}
</script>
