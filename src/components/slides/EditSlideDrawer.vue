<template>
  <Teleport to="body">
    <!-- See ADR-0102 (docs/adr/0102-must-actively-drop-it-26-research-md-pitfall-7-26-ui-spec-md.md) -->
    <Transition
      enter-active-class="transition-transform duration-250 ease-out"
      enter-from-class="translate-x-full"
      enter-to-class="translate-x-0"
      leave-active-class="transition-transform duration-200 ease-in"
      leave-from-class="translate-x-0"
      leave-to-class="translate-x-full"
    >
      <div
        v-if="isOpenAndResolvable"
        ref="panelRef"
        class="fixed inset-y-0 right-0 z-50 w-full max-w-[480px] bg-gray-900 border-l border-gray-800 shadow-2xl flex flex-col"
        data-testid="edit-slide-drawer"
        tabindex="-1"
      >
        <!-- Header — 16px padding (md token), not SongSlideOver's 20px (no 20px in this spec). -->
        <div class="flex items-center justify-between gap-3 px-4 py-4 border-b border-gray-800 shrink-0">
          <!-- D2 (260805-bvo): the drawer has ONE body and ONE fixed title —
               do not relabel or reintroduce a second mode-dependent title. -->
          <h2 class="text-sm font-medium text-gray-100" data-testid="edit-slide-drawer-title">Edit Slide Details</h2>
          <div class="flex items-center gap-2">
            <span class="text-xs text-gray-400" data-testid="drawer-status">{{ statusText }}</span>
            <button
              type="button"
              class="p-1.5 rounded-md text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors"
              aria-label="Close"
              data-testid="edit-slide-drawer-close"
              @click="onClose"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <!-- Body — scrolls on its own; header stays fixed above it. 16px padding/section-gap (md token). -->
        <div class="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          <!-- R054: song groups are read-only in the Slides tab — this notice
               names why (30-CONTEXT.md); Phase 33-09 moved the "Edit in
               song"/"Edit in scripture" navigation onto the 3-dot menu, so
               this notice no longer pairs with an in-body link, only with
               the menu items it names. Muted informational idiom, matching
               this drawer's own helper captions — not an error/warning
               colour. -->
          <!-- ★ R036 shares this ONE slot — the single permitted exception to
               D-06's "one banner". This drawer is a fixed overlay that COVERS the
               sticky page banner, so without a notice a locked drawer is a
               stripped body with no explanation anywhere on screen.
               ★ Never two notices stacked: when multiple restrictions hold,
               precedence is pending-render > song-group > serviceLocked.
               Pending-render (R236) wins over serviceLocked because it is the
               more specific and more actionable warning (an in-flight render
               that will discard any edit made now); isSongGroup and
               isPendingRender cannot co-occur (mutually exclusive slot kinds),
               so between song-group and serviceLocked the song-group message
               still wins, exactly as before (it names the more specific and
               more actionable restriction — a song's slides stay non-editable
               here even after a reopen).
               ★ The `:data-testid` is DYNAMIC so `drawer-song-readonly-notice`
               keeps its exact meaning: present for a song group, absent
               otherwise. Both existing assertions in EditSlideDrawer.test.ts stay
               green with zero test churn — do not rename it. -->
          <div
            v-if="isPendingRender || isSongGroup || serviceLocked"
            class="rounded-md border px-3 py-2 text-[12px]"
            :class="isPendingRender ? 'border-amber-800 bg-amber-950 text-amber-200' : 'border-gray-700 bg-gray-800/50 text-gray-400'"
            :data-testid="isPendingRender ? 'drawer-pending-render-notice' : (isSongGroup ? 'drawer-song-readonly-notice' : 'drawer-service-locked-notice')"
            :aria-live="isPendingRender ? 'polite' : undefined"
          >{{ isPendingRender
              ? "This slide is still rendering. Wait until it's ready before customizing — changes made now would be lost when the render finishes."
              : isSongGroup
                ? "This song's slides come from the song itself — edit them on the Song Lyrics screen."
                : 'This service is locked — reopen it for editing to change this slide.' }}</div>

          <div class="flex items-center gap-1.5" data-testid="drawer-context-line">
            <span
              class="inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-medium"
              :class="kindBadgeClass"
              data-testid="drawer-kind-badge"
            >{{ kindLabel }}</span>
            <span class="truncate text-[13px] text-gray-300" data-testid="drawer-context-text">{{ contextText }}</span>
          </div>

          <div
            class="aspect-video rounded-md bg-gray-950 border border-gray-800 flex items-center justify-center overflow-hidden bg-cover bg-center"
            :style="[previewTypographyStyle, resolvedBackgroundUrl ? { backgroundImage: `url(${resolvedBackgroundUrl})` } : {}]"
            data-testid="drawer-preview"
          >
            <img
              v-if="isImage"
              :src="imageSrc"
              :alt="imageAlt"
              class="h-full w-full object-contain"
              data-testid="drawer-preview-image"
            />
            <!-- Static, non-interactive glyph — real playback belongs to PresentationViewer, not this drawer. -->
            <div
              v-else-if="isVideo"
              class="text-3xl text-gray-500"
              data-testid="drawer-preview-video-glyph"
              aria-hidden="true"
            >&#9654;</div>
            <p
              v-else
              class="text-center text-[13px] leading-normal text-gray-200 px-4 whitespace-pre-line"
              data-testid="drawer-preview-text"
            >{{ previewText }}</p>
          </div>

          <!-- The Slide Label input used to render here. It was removed: the
               entry `label` it wrote was never read back by anything — not the
               slide card, not the grid, not the projected slide, not the PPTX
               export — so it was a field users could fill in and never see
               again. `notes` is NOT dead (slideDisplay's `hasNotes` drives a
               card indicator) and keeps its own field further down. -->

          <!-- Phase 26-07: Slide Text — branch keyed on the STORED entry's
               `sourceRef.kind`, NEVER the resolved slide's `contentKind`
               (26-UI-SPEC.md § Slide Text, D-15). A PPTX-imported picture and
               a PPTX-imported text slide share `sourceRef.kind: 'imported'`
               despite differing `contentKind` ('image' vs 'text'), and a
               hand-written slide shares `contentKind: 'text'` with an
               imported text slide despite differing `sourceRef.kind` ('text'
               vs 'imported'). Branching on `contentKind` here would silently
               hand an imported picture a lyrics-editing route — do not
               "simplify" this to `contentKind`. Read-only for every kind
               except `text` (D-13's one exception, D-15: "the drawer IS its
               home") and, as of Phase 38-03, a Congregational-state scripture
               SECTION entry (D2) — a Reference-state scripture entry stays
               hard-locked exactly as Phase 30 left it; see the scripture
               branch below for that split. Omitted entirely for `video` —
               see the outer `v-if`. -->
          <div v-if="sourceKind && sourceKind !== 'video'" data-testid="drawer-slide-text-section">
            <label class="block text-xs font-medium text-gray-400 mb-1">Slide Text</label>

            <template v-if="sourceKind === 'lyric'">
              <p
                class="text-[13px] leading-normal text-gray-200 whitespace-pre-line"
                data-testid="drawer-slide-text-readonly"
              >{{ lyricLinesText }}</p>
              <p class="mt-1 text-xs text-gray-500" data-testid="drawer-slide-text-caption">{{ SONG_TEXT_CAPTION }}</p>
            </template>

            <template v-else-if="sourceKind === 'copyright'">
              <div class="text-[13px] leading-normal text-gray-200 space-y-0.5" data-testid="drawer-copyright-block">
                <p data-testid="drawer-copyright-title">{{ copyrightSlide?.title }}</p>
                <p data-testid="drawer-copyright-authors">{{ copyrightSlide?.authors.join(', ') }}</p>
                <p data-testid="drawer-copyright-ccli">{{ copyrightSlide?.ccliSongNumber }}</p>
                <p data-testid="drawer-copyright-license">{{ copyrightSlide?.ccliLicenseNumber }}</p>
              </div>
              <p class="mt-1 text-xs text-gray-500" data-testid="drawer-slide-text-caption">{{ SONG_TEXT_CAPTION }}</p>
            </template>

            <template v-else-if="sourceKind === 'scripture'">
              <!-- Phase 38-03 (D2): a Congregational-state SECTION entry
                   (sectionFromEntry non-null) is an ordinary editable slide —
                   no write-back-to-the-reading path, no per-slide override
                   concept, no route-out button. A Reference-state entry
                   (sectionFromEntry null) is completely unchanged: the
                   read-only block, the caption and the route out to the
                   congregational-reading editor stay exactly as Phase 30/34-07
                   left them. -->
              <template v-if="sectionFromEntry">
                <!-- Phase 38-03 Task 3: the speaker control sits ABOVE the
                     passage field so the drawer's own order matches the
                     projected slide's order (presentation-speaker, then
                     presentation-congregational-section). Deliberately NOT
                     routed through the debounced `body` machinery — it's a
                     discrete two-value choice, not a stream of keystrokes,
                     and doing so would risk a flip being lost to a pending
                     flush for a different field. -->
                <div class="mb-2 flex items-center gap-2" data-testid="drawer-speaker-row">
                  <span class="text-xs font-medium text-gray-400">Speaker</span>
                  <button
                    v-if="canMutate"
                    type="button"
                    data-testid="drawer-speaker-toggle"
                    class="text-xs font-semibold uppercase tracking-wider px-2 py-1 rounded transition-colors"
                    :class="speakerToggleColorClass"
                    @click="onSpeakerToggle"
                  >{{ speakerLabel }}</button>
                  <span v-else class="text-[13px] text-gray-300" data-testid="drawer-speaker-readonly">{{ speakerLabel }}</span>
                </div>
                <textarea
                  v-if="canMutate"
                  v-model="localBody"
                  rows="3"
                  class="w-full rounded-md bg-gray-800 border border-gray-700 text-gray-100 placeholder-gray-500 text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
                  data-testid="drawer-slide-text-editable-scripture"
                ></textarea>
                <p
                  v-else
                  class="text-[13px] leading-normal text-gray-200 whitespace-pre-line"
                  data-testid="drawer-slide-text-readonly"
                >{{ scripturePassageText }}</p>
              </template>
              <template v-else>
                <p
                  class="text-[13px] leading-normal text-gray-200 whitespace-pre-line"
                  data-testid="drawer-slide-text-readonly"
                >{{ scripturePassageText }}</p>
                <p class="mt-1 text-xs text-gray-500" data-testid="drawer-slide-text-caption">{{ SCRIPTURE_TEXT_CAPTION }}</p>
                <!-- 34-07 (owner UAT F1): the route out of this read-only block
                     — opens the congregational-reading editor (ServiceEditorView's
                     modal, same relay the 3-dot menu's edit-in-scripture uses).
                     No free-text scripture override; canMutate-gated like the
                     drawer's other mutation controls.

                     Relabelled 2026-08-05 (owner) in lockstep with the 3-dot
                     menu's 'edit-in-scripture' label in slideDisplay.ts — the
                     rationale lives there. These two controls fire the SAME
                     relay and open the SAME modal, so they must never drift
                     apart in wording; the owner reported only the menu, but a
                     button one panel away still saying "Edit scripture text"
                     would just relocate the confusion. The testid and the emit
                     name still say `edit-scripture-text` deliberately — they
                     are the wire contract SlidesTab and its tests bind to, and
                     renaming them would be churn with no user-visible effect. -->
                <button
                  v-if="canMutate"
                  type="button"
                  class="mt-2 px-2.5 py-1 rounded-md text-xs font-medium border border-gray-700 text-gray-300 hover:bg-gray-800 transition-colors"
                  data-testid="drawer-edit-scripture-text-btn"
                  @click="emit('edit-scripture-text')"
                >Congregational Reading</button>
              </template>
            </template>

            <template v-else-if="sourceKind === 'imported'">
              <!-- An imported picture's words ARE its picture, already shown
                   in the preview above — no separate read-only text block, no
                   caption, and (D-15) no link: there is no canonical text
                   behind an image entry to edit. -->
              <template v-if="!isImportedImageEntry">
                <p
                  class="text-[13px] leading-normal text-gray-200 whitespace-pre-line"
                  data-testid="drawer-slide-text-readonly"
                >{{ importedText }}</p>
                <p class="mt-1 text-xs text-gray-500" data-testid="drawer-slide-text-caption">{{ IMPORTED_TEXT_CAPTION }}</p>
              </template>
            </template>

            <template v-else-if="sourceKind === 'text'">
              <!-- D-13's one exception: no canonical source exists for a
                   hand-written slide, so the drawer IS its home. D2
                   (260805-bvo, owner-authorised reversal): this drawer now
                   has ONE body, and this is the only branch in it that is
                   ever editable — `lyric`/`copyright`/`scripture`/`imported`
                   above are unchanged. 33-UI-SPEC.md §4's details-vs-lyrics
                   mode split is superseded by this reversal; there is no
                   longer a caption pointing at a second mode, because there
                   is no second mode. -->
              <textarea
                v-if="canMutate"
                v-model="localBody"
                rows="3"
                class="w-full rounded-md bg-gray-800 border border-gray-700 text-gray-100 placeholder-gray-500 text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
                data-testid="drawer-slide-text-editable"
              ></textarea>
              <p
                v-else
                class="text-[13px] leading-normal text-gray-200 whitespace-pre-line"
                data-testid="drawer-slide-text-readonly"
              >{{ localBody }}</p>
            </template>
          </div>

          <!-- See ADR-0103 (docs/adr/0103-for-its-own-duration-25-review-fix-wr-01-so-offering-a.md) -->
          <div v-if="!isVideo" data-testid="drawer-audio-section">
            <label class="block text-xs font-medium text-gray-400 mb-1">Slide Audio</label>

            <!-- File row: whichever audio actually covers this slide right
                 now (the slide's own audio wins over the group bed, D-10).
                 Rendered regardless of isEditor so a viewer still hears/sees
                 what's attached — only the Remove control below is gated. -->
            <div v-if="audioState" class="rounded-md bg-gray-800 border border-gray-700 p-2" data-testid="audio-file-row">
              <div class="flex flex-wrap items-center gap-1.5">
                <span class="min-w-0 flex-1 truncate text-[13px] text-gray-200" data-testid="audio-file-name">{{ attachedAudioFileName }}</span>
                <!-- The shared AudioPlayer does not preload and reports no
                     duration today (26-UI-SPEC.md § Slide Audio) — this stays
                     unset rather than a placeholder/zero; see the ref's own
                     comment below. -->
                <span v-if="audioDurationText" class="text-[11px] text-gray-500" data-testid="audio-duration">{{ audioDurationText }}</span>
                <span v-if="audioFailed" class="text-[11px] font-medium text-red-400" data-testid="audio-unavailable">Unavailable</span>
                <button
                  v-if="canMutate"
                  type="button"
                  class="text-xs text-gray-500 hover:text-red-400 transition-colors"
                  data-testid="audio-remove"
                  @click="onRemoveAudio"
                >Remove</button>
              </div>
              <p v-if="audioState === 'group'" class="mt-1 text-[11px] text-gray-500" data-testid="audio-shared-caption">Shared with every other slide in this group</p>
              <!-- See ADR-0104 (docs/adr/0104-this-drawer-s-own-failure-state-26-research-md-pitfall-6.md) -->
              <AudioPlayer chromeless :src="attachedAudioUrl" :loop="loopChecked" @error="onAudioError" />
            </div>

            <!-- Attach affordance: only where nothing covers this slide yet
                 — the same empty-state markup pattern used by every other
                 audio-attach control in the slides area (same copy, same
                 file input) rather than a second upload UI. -->
            <div v-else-if="canMutate" data-testid="audio-attach">
              <div class="flex items-center gap-1.5">
                <label class="text-[11px] font-medium text-gray-400">Audio</label>
                <input
                  type="file"
                  accept="audio/*"
                  data-testid="audio-attach-input"
                  class="text-[11px] text-gray-400 file:mr-1 file:rounded file:border-0 file:bg-gray-700 file:px-2 file:py-0.5 file:text-gray-200 w-40"
                  @change="onAudioFileSelected"
                />
              </div>
            </div>

            <p v-if="audioUploadIsUploading" data-testid="audio-upload-progress" class="mt-1 text-[11px] text-indigo-400">
              Uploading... {{ Math.round(audioUploadProgress) }}%
            </p>
            <p v-if="audioUploadError" data-testid="audio-upload-error" class="mt-1 text-[11px] text-red-400">{{ audioUploadError }}</p>

            <!-- Loop (D-11): meaningful only where audio actually plays —
                 omitted entirely in the "nothing attached" state. -->
            <div v-if="audioState" class="mt-2 flex items-start gap-1.5" data-testid="audio-loop-row">
              <input
                id="edit-slide-drawer-audio-loop"
                type="checkbox"
                :checked="loopChecked"
                :disabled="loopDisabled || !canMutate"
                data-testid="audio-loop-checkbox"
                @change="onLoopToggle"
              />
              <div>
                <label for="edit-slide-drawer-audio-loop" class="text-xs text-gray-300">&#9635; Loop until the next slide</label>
                <p v-if="loopDisabled" class="text-[11px] text-gray-500" data-testid="audio-loop-disabled-note">Group music doesn't loop — it plays continuously across the group.</p>
              </div>
            </div>
          </div>

          <!-- Phase 33-07: Slide Background — ★ deliberately NOT wrapped in
               `!isVideo` the way Slide Audio immediately above it is. Two
               audio sources collide audibly; two visual layers do not, and a
               video's own picture already covers whatever is behind it
               (33-UI-SPEC.md §9 — a deliberate divergence from the audio
               precedent, do not "fix" it into matching). -->
          <div data-testid="drawer-background-section">
            <label class="block text-xs font-medium text-gray-400 mb-1">Slide Background</label>

            <!-- State 1: nothing resolved at any level. -->
            <template v-if="!resolvedBackgroundUrl">
              <p class="text-[11px] text-gray-500 mb-1.5">No background</p>
              <label
                v-if="canMutateBackground"
                class="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-gray-700 px-2.5 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:bg-gray-800"
                data-testid="background-attach"
              >
                &#65291; Add background
                <input
                  type="file"
                  accept="image/*"
                  class="hidden"
                  data-testid="background-attach-input"
                  @change="onBackgroundFileSelected"
                />
              </label>
            </template>

            <!-- State 2: the entry has none but a group or song supplies one. -->
            <template v-else-if="!ownBackgroundUrl">
              <div class="flex items-center gap-2 rounded-md bg-gray-800 border border-gray-700 p-2">
                <img :src="resolvedBackgroundUrl" class="h-8 w-8 rounded object-cover flex-none" alt="" />
                <span class="text-[11px] text-gray-400" data-testid="background-provenance">{{ backgroundSource === 'group' ? 'Inherited from group' : 'Inherited from song' }}</span>
                <button
                  v-if="canMutateBackground"
                  type="button"
                  class="ml-auto text-xs font-medium text-indigo-400 hover:text-indigo-300"
                  data-testid="background-set-override"
                  @click="onSetOverrideFromResolved"
                >Set for this slide only</button>
              </div>
            </template>

            <!-- State 3: the entry has its own. -->
            <template v-else>
              <div class="flex items-center gap-2 rounded-md bg-gray-800 border border-gray-700 p-2">
                <img :src="ownBackgroundUrl" class="h-8 w-8 rounded object-cover flex-none" alt="" data-testid="background-thumbnail" />
                <span class="min-w-0 flex-1 truncate text-[13px] text-gray-200" data-testid="background-filename">{{ backgroundFileName }}</span>
                <button
                  v-if="canMutateBackground"
                  type="button"
                  class="text-xs text-gray-500 hover:text-red-400 transition-colors"
                  data-testid="background-remove"
                  @click="onRemoveSlideBackground"
                >Remove</button>
              </div>
              <p v-if="lowerLevelBackgroundLabel" class="mt-1 text-[11px] text-gray-500" data-testid="background-remove-caption">Removing only this slide's background — the {{ lowerLevelBackgroundLabel }}'s still applies.</p>
            </template>

            <p v-if="backgroundUploadIsUploading" data-testid="background-upload-progress" class="mt-1 text-[11px] text-indigo-400">
              Uploading... {{ Math.round(backgroundUploadProgress) }}%
            </p>
            <p v-if="backgroundUploadError" data-testid="background-upload-error" class="mt-1 text-[11px] text-red-400">{{ backgroundUploadError }}</p>
          </div>

          <!-- R058: the per-slide "whole group" scope option is gone — both
               group-wide audio and a group-wide background are set one level
               up, from the group media panel above the grid
               (SlideGroupMusicControl + BackgroundControl). This hint used to
               live inside the audio "nothing attached" branch and named audio
               only, which left the identical question about backgrounds
               unanswered. It now sits below BOTH sections it speaks for, and
               is no longer conditioned on the audio empty state — the scope
               question is just as live once something is already attached. -->
          <p
            v-if="canMutate || canMutateBackground"
            class="text-[11px] text-gray-500"
            data-testid="audio-scope-hint"
          >For audio or a background across the whole group, use the group's music and background controls above the grid.</p>

          <div v-if="canMutate">
            <label class="block text-xs font-medium text-gray-400 mb-1" for="edit-slide-drawer-notes">Notes (operator only)</label>
            <textarea
              id="edit-slide-drawer-notes"
              v-model="localNotes"
              rows="3"
              class="w-full rounded-md bg-gray-800 border border-gray-700 text-gray-100 placeholder-gray-500 text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
              data-testid="drawer-notes-input"
            ></textarea>
          </div>

          <!-- Phase 26-09: footer action row — Duplicate (left) and Delete
               Slide (right), above a border-t divider (26-UI-SPEC.md §
               "Duplicate and Delete Slide"), matching SongSlideOver.vue's own
               "Delete Song" block placement convention. -->
          <div v-if="canMutate" class="border-t border-gray-800 pt-4" data-testid="drawer-footer-actions">
            <div v-if="!showDeleteConfirm" class="flex items-center justify-between">
              <button
                type="button"
                class="px-3 py-1.5 rounded-md text-sm font-medium border border-gray-700 text-gray-300 hover:bg-gray-800 transition-colors"
                data-testid="drawer-duplicate"
                @click="onDuplicate"
              >Duplicate</button>
              <button
                type="button"
                class="text-sm text-red-400 hover:text-red-300 transition-colors"
                data-testid="drawer-delete-trigger"
                @click="onDeleteTrigger"
              >Delete Slide</button>
            </div>
            <!-- Inline confirm block (Task 3) — matches SongSlideOver.vue's own
                 delete-confirm shell/button pair verbatim. NOT a separate
                 dialog. -->
            <div v-else class="rounded-lg bg-red-900/20 border border-red-800 p-4" data-testid="drawer-delete-confirm">
              <p class="text-sm text-gray-200 mb-3" data-testid="drawer-delete-confirm-body">{{ deleteConfirmBody }}</p>
              <div class="flex gap-2">
                <button
                  type="button"
                  class="px-3 py-1.5 rounded-md text-sm font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 border border-gray-700 transition-colors"
                  data-testid="drawer-delete-cancel"
                  @click="onCancelDelete"
                >Cancel</button>
                <button
                  type="button"
                  class="px-3 py-1.5 rounded-md text-sm font-medium text-white bg-red-700 hover:bg-red-600 transition-colors"
                  :disabled="isDeleting"
                  data-testid="drawer-delete-confirm-button"
                  @click="onConfirmDelete"
                >{{ isDeleting ? 'Deleting...' : 'Delete' }}</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
/** See ADR-0105 (docs/adr/0105-open-it-follows-the-selection-it-never-closes-itself-on-a.md) */
import { ref, computed, watch, onUnmounted, nextTick } from 'vue'
import type { ServiceSlot } from '@/types/service'
import type { AssembledSlide, ImageSlide, CopyrightSlide, ScriptureSlide, CongregationalSection } from '@/types/slide'
import type { SlideGroup, GroupSlideEntry } from '@/types/slideGroup'
import { useSlideGroups } from '@/stores/slideGroups'
import { useAuthStore } from '@/stores/auth'
import { cssVarsFor } from '@/utils/slideTypography'
import { KIND_BADGE_CLASSES, slotDisplayTitle, slideBodyText, bedAudioLabel, backgroundImageLabel, deleteSlideConfirmBody, speakerDisplayName } from './slideDisplay'
import { congregationalSectionFromRef } from '@/utils/scripture'
import { useUnsavedGuard } from '@/composables/useUnsavedGuard'
import { useMediaUpload } from '@/composables/useMediaUpload'
import { useBackgroundUpload } from '@/composables/useBackgroundUpload'
import AudioPlayer from '../AudioPlayer.vue'

const props = withDefaults(defineProps<{
  open: boolean
  /** The resolved stored entry behind the selection — null means "render nothing" (see header comment). */
  entry: GroupSlideEntry | null
  group: SlideGroup | null
  planItem: ServiceSlot | null
  assembledSlide: AssembledSlide | null
  /** One-based position of the selected slide within its group. */
  position: number
  /** Total slide count of the selected slide's group. */
  total: number
  orgId: string
  serviceId: string
  /** Gates the label/notes write controls (T-26-05-02) — a viewer still reads the slide's information. */
  isEditor: boolean
  /** See .planning/codebase/ARCHITECTURE.md (§ Component & Composable Behavioral Notes (R318) -> src/components/slides/EditSlideDrawer.vue). Defaults `false` — `mountDrawer`'s fixture omits it, so no fixture rewrite is needed. */
  serviceLocked?: boolean
  /**
   * Phase 33-07 — a menu-dispatched Duplicate/Delete request, keyed on a
   * changing `nonce` (not the `key` alone) so the same action can re-fire on
   * a repeat. Watched below; the delete key sets the EXISTING confirm state
   * and never calls the delete action directly (P-01). Defaults `null`, so
   * every pre-33-07 fixture is unaffected.
   */
  pendingAction?: { key: 'duplicate' | 'delete'; nonce: number } | null
  /** See .planning/codebase/CONCERNS.md (§ Component & Composable Concern Notes (R318) -> src/components/slides/EditSlideDrawer.vue). Defaults `[]` so every pre-existing fixture/mount is unaffected. */
  groupAssembledSlides?: AssembledSlide[]
}>(), { serviceLocked: false, pendingAction: null, groupAssembledSlides: () => [] })

const emit = defineEmits<{
  close: []
  /** Phase 26-09 Task 2: carries the freshly-minted copy's id, only once the write has actually succeeded — `SlidesTab.vue` relays it into `selectSlideById` so the panel follows the copy. */
  duplicate: [entryId: string]
  /** Phase 33-07 — fired once per handled `pendingAction` nonce so the parent (which owns the pending state) can clear it. */
  'pending-action-consumed': []
  /**
   * 34-07 (owner UAT F1) — the Slide Text section's scripture-route control.
   * Carries no payload: this drawer does not know the slot index, and must
   * not invent one — `SlidesTab.vue` already owns `selectedSlotArrayIndex`
   * and relays this into the same `requestEditInScripture()` the 3-dot
   * menu's `edit-in-scripture` key calls.
   */
  'edit-scripture-text': []
}>()

const slideGroupsStore = useSlideGroups()
const authStore = useAuthStore()

/**
 * R093 (46-04) — this drawer's ONE CSS-variable wrapper (key_links: three
 * render sites read `authStore.settings.slideTypography` via `cssVarsFor`,
 * this is the preview box's — the preview ONLY, never the whole drawer
 * chrome). Merged via the template's array `:style` binding with the
 * existing `resolvedBackgroundUrl` background-image style, so neither
 * clobbers the other.
 */
const previewTypographyStyle = computed(() => ({
  ...cssVarsFor(authStore.settings.slideTypography),
  fontFamily: 'var(--slide-font-family)',
}))

// ── Open/close, focus and Escape (Task 1) ──────────────────────────────────

const panelRef = ref<HTMLElement | null>(null)
let previouslyFocused: HTMLElement | null = null

/** Closed, or open with nothing resolvable behind the selection: render nothing. */
const isOpenAndResolvable = computed(() => props.open && props.entry !== null)

/**
 * R054: a song's slides are canonical, edited only from the Song Lyrics
 * screen — this drawer must offer no CRUD on them at all. Read from the
 * existing `planItem` prop; no new prop is threaded (30-03-PLAN.md key_links).
 */
const isSongGroup = computed(() => props.planItem?.kind === 'SONG')
/**
 * The one gating computed every mutation control in this drawer uses
 * (30-PATTERNS.md: a plain v-if, no new gating mechanism). R036 composes into
 * it rather than adding a second gate: label input, body textarea, audio scope
 * choice, attach, remove, loop checkbox, Notes, Duplicate and Delete Slide all
 * vanish together, while the preview, kind badge, context line, attached-audio
 * row and player all stay.
 */
const canMutate = computed(
  () => props.isEditor && !props.serviceLocked && !isSongGroup.value && !isPendingRender.value,
)

// See ADR-0106 (docs/adr/0106-confirmdiscard-is-instantiated-below-unsavedguard-task-3-but.md)
// the exposed `confirmDiscard` below.
function onClose(): void {
  if (!unsavedGuard.confirmDiscard()) return
  emit('close')
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    if (!unsavedGuard.confirmDiscard()) return
    emit('close')
  }
}

watch(
  isOpenAndResolvable,
  async (isOpen) => {
    if (isOpen) {
      // Remember what held focus before the panel opened — restored on close
      // rather than re-querying the grid for "the card that was selected"
      // afterward, since a selection change while the panel is open must not
      // disturb this bookkeeping (D-03: the panel follows the selection).
      previouslyFocused = (document.activeElement as HTMLElement | null) ?? null
      window.addEventListener('keydown', onKeydown)
      await nextTick()
      panelRef.value?.focus()
    } else {
      window.removeEventListener('keydown', onKeydown)
      previouslyFocused?.focus?.()
      previouslyFocused = null
    }
  },
  { immediate: true },
)

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
})

// ── Context line and preview ────────────────────────────────────────────────

const kindLabel = computed(() => props.assembledSlide?.slotKind ?? '')
const kindBadgeClass = computed(() =>
  props.assembledSlide ? KIND_BADGE_CLASSES[props.assembledSlide.slotKind] : '',
)
const contextText = computed(() => {
  const title = props.planItem ? slotDisplayTitle(props.planItem) : ''
  return `${title} · slide ${props.position} of ${props.total}`
})

const isImage = computed(() => props.assembledSlide?.slide.contentKind === 'image')
const isVideo = computed(() => props.assembledSlide?.slide.contentKind === 'video')
const imageSrc = computed(() => (props.assembledSlide?.slide as ImageSlide | undefined)?.imageUrl ?? '')
const imageAlt = computed(() => (props.assembledSlide?.slide as ImageSlide | undefined)?.altText ?? '')
const previewText = computed(() =>
  props.assembledSlide && !isImage.value && !isVideo.value ? slideBodyText(props.assembledSlide.slide) : '',
)

/**
 * Phase 33-07 (R055/R056/R057): the RESOLVED background url/source, read
 * straight off the already-assembled slide (`resolveEntryMedia`'s output,
 * 33-01) — never re-derived here. Feeds both the compact drawer preview
 * (§8's `background-image` treatment) and the Slide Background section (§5).
 */
const resolvedBackgroundUrl = computed(() => props.assembledSlide?.slide.backgroundImageUrl)
const backgroundSource = computed(() => props.assembledSlide?.slide.backgroundSource)
/**
 * R236 — a slide sourced from a PPTX deck whose server-side render hasn't
 * produced a usable page yet. Composed into BOTH `canMutate` and
 * `canMutateBackground` below (a background is a per-slide customization
 * too) so an edit made now is never silently discarded when the render
 * flips pending -> ready.
 */
const isPendingRender = computed(() => props.assembledSlide?.slide.renderState === 'pending')

// ── Phase 26-07 Task 1: Slide Text, keyed on the STORED entry's sourceRef.kind ──
// (see the template comment above the section for why this must never branch
// on the resolved slide's contentKind instead).

/** The one decision key for the whole Slide Text section (D-15). `null` when nothing is selected. */
const sourceKind = computed(() => props.entry?.sourceRef.kind ?? null)

/**
 * Phase 38-03: `congregationalSectionFromRef` is the SINGLE predicate
 * deciding whether the selected scripture entry is a Congregational-state
 * section (editable, D2) or a Reference-state entry (still hard-locked,
 * Phase 30) — do not add a second inline speaker check anywhere in this
 * component. `null` for every non-scripture kind and for a Reference-state
 * scripture entry.
 */
const sectionFromEntry = computed(() =>
  props.entry ? congregationalSectionFromRef(props.entry.sourceRef) : null,
)

/**
 * Phase 38-03 Task 3: the readable speaker name shown by both the editable
 * toggle and its read-only fallback — reads `sectionFromEntry` (which itself
 * reads `props.entry`, a reactive prop), so a speaker flip landing on
 * `props.entry` updates what's displayed here without the drawer needing to
 * be reopened. Uses `slideDisplay.ts`'s single producer of these two words so
 * the drawer, the slide card and the projected slide can never drift into
 * three different spellings of the same two words.
 */
const speakerLabel = computed(() =>
  sectionFromEntry.value ? speakerDisplayName(sectionFromEntry.value.speaker) : '',
)

/**
 * R095 (Phase 47): the toggle's colour, widened from the old
 * indigo/amber binary (which collided with indigo's role as the UI-accent
 * colour, 47-UI-SPEC.md § Color) to the same sky/amber/violet used
 * everywhere else this speaker identity renders (presenter, grid eyebrow).
 */
const speakerToggleColorClass = computed(() => {
  const speaker = sectionFromEntry.value?.speaker
  if (speaker === 'LEADER') return 'text-sky-300 bg-sky-900/50'
  if (speaker === 'CONGREGATION') return 'text-amber-300 bg-amber-900/50'
  return 'text-violet-300 bg-violet-900/50'
})

/**
 * R095: the next speaker in the 3-way cycle LEADER -> CONGREGATION -> ALL ->
 * LEADER. A single shared table (rather than three independent ternaries)
 * so there is exactly one place this ordering is expressed — widening it
 * again (a fourth role) would touch only this map.
 */
const NEXT_SPEAKER: Record<CongregationalSection['speaker'], CongregationalSection['speaker']> = {
  LEADER: 'CONGREGATION',
  CONGREGATION: 'ALL',
  ALL: 'LEADER',
}

/** See ADR-0107 (docs/adr/0107-flips-the-selected-section-entry-s-speaker-to-the-next-one-i.md) */
async function onSpeakerToggle(): Promise<void> {
  if (!canMutate.value) return
  if (!props.group || !props.entry) return
  const section = congregationalSectionFromRef(props.entry.sourceRef)
  if (!section) return
  const nextSpeaker = NEXT_SPEAKER[section.speaker]
  const entryId = props.entry.id
  const base = props.group.slides
  const next = base.map((e) => {
    if (e.id !== entryId) return e
    // Guard on the entry's own ref shape (same predicate the template and
    // `writeField` use), so this write can never be reached by a
    // Reference-state scripture entry or any other kind.
    if (e.sourceRef.kind !== 'scripture' || !congregationalSectionFromRef(e.sourceRef)) return e
    return { ...e, sourceRef: { ...e.sourceRef, speaker: nextSpeaker } }
  })
  try {
    await slideGroupsStore.replaceGroupSlides(props.orgId, props.group.slotId, next, props.group.sourceSignature, base)
  } catch (err) {
    console.error('Failed to flip section speaker:', err)
  }
}

/** `lyric`-kind entries resolve to a `LyricSlide` (has `sectionId`) — `slideBodyText` already narrows that shape and produces exactly what's needed (its joined lines), so this reuses it rather than re-deriving. */
const lyricLinesText = computed(() =>
  sourceKind.value === 'lyric' && props.assembledSlide ? slideBodyText(props.assembledSlide.slide) : '',
)

/** `copyright`-kind entries resolve to a `CopyrightSlide` — rendered from its own fields directly (title/authors/CCLI#/license#), since `slideBodyText`'s copyright branch returns only the title and isn't enough here. */
const copyrightSlide = computed(() =>
  sourceKind.value === 'copyright' ? (props.assembledSlide?.slide as CopyrightSlide | undefined) : undefined,
)

// See .planning/codebase/ARCHITECTURE.md (§ Component & Composable Behavioral Notes (R318) -> src/components/slides/EditSlideDrawer.vue, "scripturePassageText")
const scripturePassageText = computed(() => {
  if (sourceKind.value !== 'scripture' || !props.assembledSlide) return ''
  const slide = props.assembledSlide.slide as ScriptureSlide
  return slide.text || slide.reference
})

/** `imported`-kind entries whose resolved content is a picture render no separate words block (see template comment) — this is the ONE place content kind legitimately narrows behavior WITHIN an already-source-keyed branch, not a substitute for the source-kind key itself. */
const isImportedImageEntry = computed(
  () => sourceKind.value === 'imported' && props.assembledSlide?.slide.contentKind === 'image',
)

/** `imported`-kind entries whose resolved content is text — `slideBodyText`'s `text` branch (`slide.body`) is exactly the imported text, so this reuses it too. */
const importedText = computed(() => {
  if (sourceKind.value !== 'imported' || isImportedImageEntry.value || !props.assembledSlide) return ''
  return slideBodyText(props.assembledSlide.slide)
})

// Helper captions, verbatim from 26-UI-SPEC.md § Slide Text (Mockup Correction
// 8 removed the mockup's cut clause implying a per-service override — do not
// reintroduce that clause here).
const SONG_TEXT_CAPTION = "From the song's Lyrics tab — editing there updates every service using this song."
/**
 * 34-07 (owner UAT F1) — rewritten to name what the control below it opens:
 * the passage reference drives this slide, and the congregational-reading
 * editor is where the passage is fetched and split into Leader/Congregation
 * parts. Never mentions a lyrics route — a scripture entry has never had
 * one, and pointing at one is the exact confusion F1 reported.
 */
const SCRIPTURE_TEXT_CAPTION =
  'The passage reference drives this slide. Open the congregational-reading editor to fetch the passage and split it into Leader and Congregation parts.'
const IMPORTED_TEXT_CAPTION = 'From the imported file — re-import to change it.'

// ── Phase 26-08: Slide Audio — loop and the video omission (D-10..D-12) ──

/**
 * Which audio actually covers this slide right now, in the assembler's own
 * precedence order (D-10: a slide's own audio wins while it is up). `null`
 * means neither exists yet ("nothing attached").
 */
const audioState = computed<'slide' | 'group' | null>(() => {
  if (props.entry?.audioUrl) return 'slide'
  if (props.group?.bedAudioUrl) return 'group'
  return null
})

const attachedAudioUrl = computed(() => {
  if (audioState.value === 'slide') return props.entry?.audioUrl ?? ''
  if (audioState.value === 'group') return props.group?.bedAudioUrl ?? ''
  return ''
})

/** Derived from the stored address (not anything held only in memory) so a reload still shows a name — same helper the group music bar already uses. */
const attachedAudioFileName = computed(() => (attachedAudioUrl.value ? bedAudioLabel(attachedAudioUrl.value) : ''))

/**
 * The shared `AudioPlayer` does not preload (`preload="none"`) and exposes no
 * duration today — this stays permanently unset in this component rather
 * than a placeholder or a zero (26-UI-SPEC.md § Slide Audio: "record if this
 * turns out to be always absent in practice, rather than changing the shared
 * player to obtain it" — see Known Stubs in the plan's SUMMARY). Kept as a
 * real ref, not a hardcoded `false`, so a future duration source can
 * populate it without touching the template.
 */
const audioDurationText = ref<string | null>(null)

const loopChecked = computed(() => audioState.value === 'slide' && !!props.entry?.audioLoop)
/** D-11: a group bed never loops — disabled and unchecked whenever the group's shared music is what's shown. */
const loopDisabled = computed(() => audioState.value === 'group')

async function onLoopToggle(event: Event): Promise<void> {
  // ME-03: the R054/viewer lock, missed by the original sweep. This row is
  // gated only on `v-if="audioState"`, so a SONG group entry carrying its own
  // audioUrl (attachable before this phase, and still present in existing
  // documents) rendered an enabled checkbox whose write replaced the song
  // group's whole `slides` array from the Slides tab — exactly the CRUD R054
  // blocks — and the same control rendered enabled for a VIEWER on any group,
  // whose write Firestore rejects as an unhandled rejection.
  if (!canMutate.value) return
  // Belt-and-suspenders alongside the DOM `disabled` attribute — a group-bed
  // state must never be able to issue a loop write, no matter how the event
  // arrived.
  if (audioState.value !== 'slide' || !props.group || !props.entry) return
  const checked = (event.target as HTMLInputElement).checked
  const entryId = props.entry.id
  const base = props.group.slides
  const next = base.map((e) => (e.id === entryId ? { ...e, audioLoop: checked } : e))
  // Awaited (not `void`-discarded) so a rejected write reaches Vue's handler
  // the same way every other write in this drawer does, instead of surfacing as
  // a bare unhandled rejection.
  await slideGroupsStore.replaceGroupSlides(props.orgId, props.group.slotId, next, props.group.sourceSignature, base)
}

/** See ADR-0104 (docs/adr/0104-this-drawer-s-own-failure-state-26-research-md-pitfall-6.md) */
const audioFailed = ref(false)

function onAudioError(): void {
  audioFailed.value = true
}

watch(attachedAudioUrl, () => {
  audioFailed.value = false
})
watch(
  () => props.entry?.id,
  () => {
    audioFailed.value = false
  },
)

const {
  progress: audioUploadProgress,
  error: audioUploadError,
  isUploading: audioUploadIsUploading,
  uploadMedia: uploadAudioMedia,
  reset: resetAudioUpload,
} = useMediaUpload()

/** This-slide-only attach (R058: the only remaining attach route): writes the entry's own `audioUrl` through the fresh-base helper. */
async function attachSlideAudio(url: string): Promise<void> {
  if (!props.group || !props.entry) return
  const entryId = props.entry.id
  const base = props.group.slides
  const next = base.map((e) => (e.id === entryId ? { ...e, audioUrl: url } : e))
  await slideGroupsStore.replaceGroupSlides(props.orgId, props.group.slotId, next, props.group.sourceSignature, base)
}

async function onAudioFileSelected(event: Event): Promise<void> {
  if (!canMutate.value) return
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  resetAudioUpload()
  try {
    const url = await uploadAudioMedia(file, props.orgId)
    await attachSlideAudio(url)
  } catch {
    // uploadAudioMedia already set the composable's reactive `error` —
    // surfaced via audio-upload-error above. Deliberately no write on
    // failure, so a failed upload can never clear or overwrite an existing
    // attachment (matches SlideGroupMusicControl.vue's identical
    // no-emit-on-failure contract).
  }
}

/** Targets whichever audio is actually shown right now (`audioState`) — Remove always acts on what's covering the slide. */
async function onRemoveAudio(): Promise<void> {
  if (!canMutate.value) return
  if (audioState.value === 'slide') {
    await removeSlideAudio()
  } else if (audioState.value === 'group') {
    await removeGroupAudio()
  }
}

/** Writes the entry WITHOUT the `audioUrl` key (never the key set to `undefined`, per this plan's key_links) — leaves the group's shared music untouched. */
async function removeSlideAudio(): Promise<void> {
  if (!props.group || !props.entry) return
  const entryId = props.entry.id
  const base = props.group.slides
  const next = base.map((e) => {
    if (e.id !== entryId) return e
    const rest = { ...e }
    delete rest.audioUrl
    return rest
  })
  await slideGroupsStore.replaceGroupSlides(props.orgId, props.group.slotId, next, props.group.sourceSignature, base)
}

/** Clears the GROUP'S bed via the explicit `clearAudio` flag — an undefined URL is not a clear, since `stripUndefined()` would strip that intent before Firestore ever saw it (mirrors `SlideGrid.vue`'s own `onRemoveGroupMusic`). */
async function removeGroupAudio(): Promise<void> {
  if (!props.group) return
  await slideGroupsStore.setGroupBedMedia(props.orgId, props.group.slotId, {
    serviceId: props.serviceId,
    clearAudio: true,
  })
}

// ── Phase 33-07 Task 2: Slide Background — the three-state section (R055/R056/R057) ──

/** The entry's OWN background, read the same way every other own-vs-resolved comparison in this section reads it — never the resolved value. */
const ownBackgroundUrl = computed(() => props.entry?.backgroundImageUrl)

const backgroundFileName = computed(() => (ownBackgroundUrl.value ? backgroundImageLabel(ownBackgroundUrl.value) : ''))

// See .planning/codebase/ARCHITECTURE.md (§ Component & Composable Behavioral Notes (R318) -> src/components/slides/EditSlideDrawer.vue, "canMutateBackground")
const canMutateBackground = computed(() => props.isEditor && !props.serviceLocked && !isPendingRender.value)

// See .planning/codebase/ARCHITECTURE.md (§ Component & Composable Behavioral Notes (R318) -> src/components/slides/EditSlideDrawer.vue, "lowerLevelBackgroundLabel")
const lowerLevelBackgroundLabel = computed<'group' | 'song' | null>(() => {
  if (!ownBackgroundUrl.value) return null
  if (props.group?.backgroundImageUrl) return 'group'
  const songSourced = props.groupAssembledSlides.some((a) => a.slide.backgroundSource === 'song')
  return songSourced ? 'song' : null
})

const {
  progress: backgroundUploadProgress,
  error: backgroundUploadError,
  isUploading: backgroundUploadIsUploading,
  uploadBackground,
  reset: resetBackgroundUpload,
} = useBackgroundUpload()

/** Writes the entry's own `backgroundImageUrl` through the same fresh-base helper `attachSlideAudio` uses. */
async function attachSlideBackground(url: string): Promise<void> {
  if (!props.group || !props.entry) return
  const entryId = props.entry.id
  const base = props.group.slides
  const next = base.map((e) => (e.id === entryId ? { ...e, backgroundImageUrl: url } : e))
  await slideGroupsStore.replaceGroupSlides(props.orgId, props.group.slotId, next, props.group.sourceSignature, base)
}

async function onBackgroundFileSelected(event: Event): Promise<void> {
  if (!canMutateBackground.value) return
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  resetBackgroundUpload()
  try {
    const url = await uploadBackground(file, props.orgId)
    await attachSlideBackground(url)
  } catch {
    // uploadBackground already set the composable's reactive `error` —
    // surfaced via background-upload-error above. Deliberately no write on
    // failure, so a failed upload can never clear or overwrite an existing
    // background (matches the audio attach's identical contract).
  }
}

/** "Set for this slide only" — a copy-then-override of the CURRENTLY
 * RESOLVED url, not a fresh upload (this plan's key_links). */
async function onSetOverrideFromResolved(): Promise<void> {
  if (!canMutateBackground.value) return
  if (!resolvedBackgroundUrl.value) return
  await attachSlideBackground(resolvedBackgroundUrl.value)
}

/** Writes the entry WITHOUT the `backgroundImageUrl` key (never the key set to `undefined`), mirroring `removeSlideAudio`'s identical contract. */
async function onRemoveSlideBackground(): Promise<void> {
  if (!canMutateBackground.value) return
  if (!props.group || !props.entry) return
  const entryId = props.entry.id
  const base = props.group.slides
  const next = base.map((e) => {
    if (e.id !== entryId) return e
    const rest = { ...e }
    delete rest.backgroundImageUrl
    return rest
  })
  await slideGroupsStore.replaceGroupSlides(props.orgId, props.group.slotId, next, props.group.sourceSignature, base)
}

// ── Task 3: label/notes/body fields, applied live through a fresh-base write ──

type FieldName = 'label' | 'notes' | 'body'
type FieldStatus = 'idle' | 'saving' | 'saved' | 'error'

const DEBOUNCE_MS = 800
const SAVED_FLASH_MS = 1800

const localNotes = ref('')
/** Only meaningful when `sourceKind === 'text'` (D-13's one editable exception) — stays '' and unwritten-to for every other kind. */
const localBody = ref('')
const status = ref<FieldStatus>('idle')

/**
 * D-16's unsaved-edit guard, scoped over exactly the fields this drawer
 * debounce-writes (26-UI-SPEC.md § Slide Text, last paragraph). Captured
 * fresh whenever the edited entry changes and after every successful write
 * (see `captureGuardBaseline`), so `isDirty` reads true precisely while a
 * typed edit hasn't landed yet — never invents new confirm copy, reuses this
 * composable's existing wording verbatim.
 */
const unsavedGuard = useUnsavedGuard(() => ({
  notes: localNotes.value,
  body: localBody.value,
}))

function captureGuardBaseline(): void {
  unsavedGuard.capture()
}

const statusText = computed(() => {
  switch (status.value) {
    case 'saving':
      return 'Saving…'
    case 'saved':
      return 'Saved'
    case 'error':
      return 'Failed to save. Please try again.'
    default:
      return ''
  }
})

const debounceTimers: Record<FieldName, ReturnType<typeof setTimeout> | null> = { label: null, notes: null, body: null }
const pendingWrite: Record<FieldName, { entryId: string; value: string } | null> = { label: null, notes: null, body: null }
let savedFadeTimer: ReturnType<typeof setTimeout> | null = null
/** True while local fields are being set programmatically (open/entry-switch resync) — suppresses the write-scheduling watchers below. */
let syncing = false

function clearFieldTimer(field: FieldName): void {
  const timer = debounceTimers[field]
  if (timer !== null) {
    clearTimeout(timer)
    debounceTimers[field] = null
  }
}

function scheduleSavedFade(): void {
  if (savedFadeTimer !== null) clearTimeout(savedFadeTimer)
  savedFadeTimer = setTimeout(() => {
    if (status.value === 'saved') status.value = 'idle'
  }, SAVED_FLASH_MS)
}

/** See ADR-0108 (docs/adr/0108-the-fresh-base-write-t-26-05-01-26-research-md-pattern-2-pit.md) */
async function writeField(field: FieldName, entryId: string, value: string): Promise<void> {
  // R036: the single persistence point for label/notes/body. Guarding here (not
  // only `scheduleWrite`) also covers `flushField`/`flushAll`, so an edit typed
  // moments before the service locked cannot land after it.
  if (!canMutate.value) return
  if (!props.group) return
  status.value = 'saving'
  try {
    const base = props.group.slides
    const next = base.map((e) => {
      if (e.id !== entryId) return e
      if (field === 'body') {
        // Phase 26-07 Task 2: the value lives on the entry's SOURCE
        // REFERENCE (the `text`-kind's widened `body`, D-17), not a sibling
        // top-level key like `label`/`notes` — replace only `body` on that
        // NESTED object so every other member survives the write intact
        // (notably the short default `title` a hand-added slide is created
        // with, SlideGrid.vue's `onAddSlide`). Guards on `sourceRef.kind`
        // itself (only a `text`-kind entry ever schedules a body write) so
        // this never re-mints an unrelated source ref shape.
        if (e.sourceRef.kind === 'text') return { ...e, sourceRef: { ...e.sourceRef, body: value } }
        // Phase 38-03 Task 2: a Congregational-state scripture SECTION entry
        // writes its own `text`, never `body` — writing the wrong key would
        // silently discard every edit. Guarded on `congregationalSectionFromRef`
        // (the SAME single predicate the template branches on), so this can
        // never be reached by a Reference-state scripture entry or any other
        // kind, no matter which entry's write happens to land here.
        if (congregationalSectionFromRef(e.sourceRef)) return { ...e, sourceRef: { ...e.sourceRef, text: value } }
        return e
      }
      return { ...e, [field]: value }
    })
    await slideGroupsStore.replaceGroupSlides(props.orgId, props.group.slotId, next, props.group.sourceSignature, base)
    status.value = 'saved'
    scheduleSavedFade()
    // D-16: a fresh baseline after every successful write, so the unsaved
    // guard reads dirty ONLY while an edit is typed but not yet persisted.
    captureGuardBaseline()
  } catch (err) {
    console.error(`Failed to save slide ${field}:`, err)
    status.value = 'error'
  }
}

function scheduleWrite(field: FieldName, entryId: string, value: string): void {
  clearFieldTimer(field)
  pendingWrite[field] = { entryId, value }
  debounceTimers[field] = setTimeout(() => {
    debounceTimers[field] = null
    void commitWrite(field)
  }, DEBOUNCE_MS)
}

async function commitWrite(field: FieldName): Promise<void> {
  const pending = pendingWrite[field]
  if (!pending) return
  pendingWrite[field] = null
  await writeField(field, pending.entryId, pending.value)
}

/** Flushes a field's pending write immediately, bypassing its debounce timer — used when leaving the edited entry and on unmount, so a change in flight is never silently dropped. */
async function flushField(field: FieldName): Promise<void> {
  clearFieldTimer(field)
  await commitWrite(field)
}

async function flushAll(): Promise<void> {
  // See ADR-0109 (docs/adr/0109-sequential-not-promise-all-each-writefield-call-reads.md)
  await flushField('notes')
  await flushField('body')
}

/**
 * The stored words this drawer's `body` field seeds from — a `text`-kind
 * entry's own `body`, a Congregational-state scripture section entry's own
 * `text` (38-03 Task 2, via the SAME `congregationalSectionFromRef` predicate
 * the template and `writeField` use), or '' for every other kind that has no
 * words of its own.
 */
function bodySeed(entry: GroupSlideEntry | null): string {
  if (!entry) return ''
  if (entry.sourceRef.kind === 'text') return entry.sourceRef.body ?? ''
  const section = congregationalSectionFromRef(entry.sourceRef)
  return section ? section.text : ''
}

function resetLocalFields(entry: GroupSlideEntry | null): void {
  syncing = true
  localNotes.value = entry?.notes ?? ''
  localBody.value = bodySeed(entry)
  void nextTick().then(() => {
    syncing = false
  })
  captureGuardBaseline()
}

watch(
  () => props.entry,
  async (entry, oldEntry) => {
    if (oldEntry && entry?.id !== oldEntry.id) {
      // Leaving the entry being edited — flush whatever is pending for IT
      // (captured entryId, not whatever is newly selected) before this
      // component's local fields move on to the new entry's values.
      await flushAll()
    }

    if (!oldEntry || entry?.id !== oldEntry.id) {
      resetLocalFields(entry ?? null)
      return
    }

    // Same entry, but its persisted value changed (a round trip from this
    // drawer's own write, or a concurrent edit) — re-sync only the field with
    // no write of its own still pending, so an in-flight edit is never
    // clobbered by a stale round trip.
    if (!pendingWrite.notes && entry && entry.notes !== oldEntry.notes) {
      syncing = true
      localNotes.value = entry.notes ?? ''
      void nextTick().then(() => {
        syncing = false
      })
    }
    if (!pendingWrite.body && entry) {
      const textChanged =
        entry.sourceRef.kind === 'text' &&
        oldEntry.sourceRef.kind === 'text' &&
        entry.sourceRef.body !== oldEntry.sourceRef.body
      // Phase 38-03 Task 2: a Congregational-state section entry's words
      // changing on the stored group re-syncs too, under the same
      // "only when nothing is pending" condition above.
      const newSection = congregationalSectionFromRef(entry.sourceRef)
      const oldSection = congregationalSectionFromRef(oldEntry.sourceRef)
      const sectionTextChanged = newSection && oldSection && newSection.text !== oldSection.text
      if (textChanged || sectionTextChanged) {
        syncing = true
        localBody.value = bodySeed(entry)
        void nextTick().then(() => {
          syncing = false
        })
      }
    }
    // Same entry, no local write in flight for anything that changed above —
    // re-capture so a concurrent OTHER agent's edit landing doesn't get
    // spuriously reported as "our" unsaved change.
    captureGuardBaseline()
  },
  { immediate: true },
)

watch(localNotes, (value) => {
  if (syncing || !props.entry) return
  scheduleWrite('notes', props.entry.id, value)
})

watch(localBody, (value) => {
  if (syncing || !props.entry) return
  // Phase 38-03 Task 2: widened to admit a Congregational-state scripture
  // SECTION entry as well (via the same predicate `writeField` guards on),
  // and no further — a Reference-state scripture entry and every other kind
  // still schedule no write from typing here.
  const isEditableBodyKind = props.entry.sourceRef.kind === 'text' || congregationalSectionFromRef(props.entry.sourceRef) !== null
  if (!isEditableBodyKind) return
  scheduleWrite('body', props.entry.id, value)
})

// Phase 33-09 (R051/R052): "Edit in song" and "Edit in scripture" — both real
// navigations away from this drawer's own entry — moved up to `SlidesTab.vue`'s
// `onMenuAction` (the 3-dot menu now triggers them, not an in-body link). The
// song-edit-link builder, the router import/instance, and the two handlers
// that used them (`onEditInSong`/`onEditInScripture`) are gone from this file
// entirely — see `SlidesTab.vue` for the relocated, behaviourally-unchanged
// route logic.

onUnmounted(() => {
  if (savedFadeTimer !== null) clearTimeout(savedFadeTimer)
  // Best-effort flush on unmount — a leaving user's in-flight edit is still
  // written rather than dropped (fire-and-forget: nothing can await this
  // component's own teardown).
  void flushAll()
})

// See .planning/codebase/ARCHITECTURE.md (§ Component & Composable Behavioral Notes (R318) -> src/components/slides/EditSlideDrawer.vue, "onDuplicate")
async function onDuplicate(): Promise<void> {
  if (!canMutate.value) return
  if (!props.group || !props.entry) return
  const base = props.group.slides
  const originalIndex = base.findIndex((e) => e.id === props.entry!.id)
  if (originalIndex < 0) return
  const copyId = crypto.randomUUID()
  const copy: GroupSlideEntry = { ...base[originalIndex]!, id: copyId }
  const withCopy = [...base.slice(0, originalIndex + 1), copy, ...base.slice(originalIndex + 1)]
  const renumbered = withCopy.map((e, i) => ({ ...e, order: i }))
  try {
    await slideGroupsStore.replaceGroupSlides(props.orgId, props.group.slotId, renumbered, props.group.sourceSignature, base)
    emit('duplicate', copyId)
  } catch (err) {
    console.error('Failed to duplicate slide:', err)
  }
}

// ── Phase 26-09 Task 3: Delete — behind an inline confirm naming what's lost ──

const showDeleteConfirm = ref(false)
const isDeleting = ref(false)

/**
 * The delete warning's exact wording (26-UI-SPEC.md's four-variant table,
 * Phase 24 D-03 precedent) — built by the pure display module from THIS
 * entry alone (its own audio/notes, never the group's shared bed music).
 */
const deleteConfirmBody = computed(() => (props.entry ? deleteSlideConfirmBody(props.entry) : ''))

function onDeleteTrigger(): void {
  if (!canMutate.value) return
  showDeleteConfirm.value = true
}

function onCancelDelete(): void {
  showDeleteConfirm.value = false
}

/**
 * See .planning/codebase/ARCHITECTURE.md (§ Component & Composable Behavioral Notes (R318) -> src/components/slides/EditSlideDrawer.vue, "Delete path").
 * No close-handling is added for the post-delete case: `SlidesTab.vue`'s
 * existing `selectedGroupSlideIds` watch already clears `selectedSlideId`
 * (and with it, `drawerOpen`) the moment it stops resolving against the
 * selected slot's assembled slides — adding a second close path here would
 * fight that seam, not complement it.
 */
async function onConfirmDelete(): Promise<void> {
  if (!canMutate.value) return
  if (!props.group || !props.entry) return
  const entryId = props.entry.id
  const base = props.group.slides
  const filtered = base.filter((e) => e.id !== entryId).map((e, i) => ({ ...e, order: i }))
  isDeleting.value = true
  try {
    await slideGroupsStore.replaceGroupSlides(props.orgId, props.group.slotId, filtered, props.group.sourceSignature, base)
    showDeleteConfirm.value = false
  } catch (err) {
    console.error('Failed to delete slide:', err)
  } finally {
    isDeleting.value = false
  }
}

// ── Phase 33-07 Task 3: the pendingAction seam for Duplicate/Delete from the menu ──

/**
 * Tracks the last handled nonce so a repeated `key` with an unchanged nonce
 * never re-fires — the transition is keyed on the CHANGING nonce, never on
 * the key's value alone (this plan's key_links).
 */
const lastHandledPendingActionNonce = ref<number | null>(null)

// See .planning/codebase/ARCHITECTURE.md (§ Component & Composable Behavioral Notes (R318) -> src/components/slides/EditSlideDrawer.vue, "Menu-dispatched delete")
watch(
  () => props.pendingAction,
  (action) => {
    if (!action || action.nonce === lastHandledPendingActionNonce.value) return
    lastHandledPendingActionNonce.value = action.nonce
    if (canMutate.value) {
      if (action.key === 'delete') {
        showDeleteConfirm.value = true
      } else if (action.key === 'duplicate') {
        void onDuplicate()
      }
    }
    emit('pending-action-consumed')
  },
)

// See ADR-0106 (docs/adr/0106-confirmdiscard-is-instantiated-below-unsavedguard-task-3-but.md)
defineExpose({ confirmDiscard: unsavedGuard.confirmDiscard })
</script>

<style scoped>
/*
 * R093 (46-04) — reads the `--slide-font-*` custom properties
 * `previewTypographyStyle` sets on the preview box above. Unlayered scoped
 * styles win over Tailwind's `@layer utilities` regardless of selector
 * specificity, so this overrides the template's fixed `text-[13px]` class
 * without touching it.
 * Size is fixed (R329) — the manual scale multiplier is retired; only
 * family/weight still vary.
 */
[data-testid='drawer-preview-text'] {
  font-weight: var(--slide-font-weight);
  font-size: 13px;
}
</style>
