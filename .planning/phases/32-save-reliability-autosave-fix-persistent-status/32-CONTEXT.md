# Phase 32: Save Reliability — Autosave Fix & Persistent Status - Context

**Gathered:** 2026-08-02
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous). Grey areas were proposed with recommendations and auto-accepted
under the STATE.md standing autonomy grant of 2026-07-30 (owner away; ordinary implementation
decisions proceed without approval). Every accepted answer below is Claude's recommendation, not an
owner statement — treat them as reversible defaults, not locked owner preferences.

<domain>
## Phase Boundary

Every mutation on the Service Order reliably fires autosave — including discrete one-shot actions
such as changing a song, and specifically the case that lands immediately after a prior save's own
Firestore echo. Alongside that, the app gains ONE persistent inline save-status indicator
(`Saving… / Saved HH:MM / failure`) shared by every autosaving surface, backed by a single
`useSaveStatus` aggregator, and a save **failure** raises a toast (success does not).

Requirements: **R039** (autosave fires on discrete mutations), **R040** (one persistent inline
status, one aggregator, ServiceEditorView stops hand-duplicating `useAutoSave`), **R041** (failure
toast, no success toast, `aria-live` status region).

**In scope:** the autosave repro + fix; extending `AutoSaveStatus` with `'error'`; the
`useSaveStatus` aggregator; the shared status component and its rollout to all four autosaving
surfaces; a minimal app-level toast host; migrating `ServiceEditorView.vue` off its inline
~150-line autosave duplicate onto `useAutoSave`.

**Out of scope:** any change to *what* gets saved or the Firestore document shape; the Phase 31
lock/reopen semantics (status is only rendered while `canEditService`); redesigning the header or
tab chrome (that is Phase 36); offline/queued saves.

</domain>

<decisions>
## Implementation Decisions

### Root-Cause Confirmation & Repro Discipline

- **A failing repro test is the first commit of this phase.** It must reproduce "pick a song
  immediately after a prior save's echo lands → no save fires." R039 mandates repro-before-fix, and
  the echo/`autosaveInitialized` hypothesis is MEDIUM confidence and has never been reproduced
  against the live app.
- **If the repro test passes (hypothesis disproved), STOP and widen.** The plan converts from a fix
  plan to a diagnostic plan; record the disproof in the SUMMARY. Do not ship a speculative rewrite
  onto a root cause that was never demonstrated.
- **The `ServiceEditorView` → `useAutoSave` migration happens only after the repro is green and the
  root cause is confirmed.** R040 names the de-duplication explicitly, so it is in scope — but
  migrating first would destroy the evidence the repro test is standing on.
- **Keep Phase 31's `autosaveErrorSource` reorder-vs-edit split.** Two producers genuinely need two
  recovery instructions ("try dragging again" — the order was reverted; "try again" — your text is
  still here). Carry the discriminator into the shared layer; do not flatten it to one message.

### The `useSaveStatus` Aggregator

- **Lives as a Pinia store at `src/stores/saveStatus.ts`** — consistent with the nine existing
  stores, and lets any surface read status without prop-drilling through the tab structure.
- **Sits strictly ABOVE `useAutoSave`, which is not rewritten.** `useAutoSave` keeps owning the
  debounce, the inflight guard, `flush()` and `cleanup()`; it *reports into* the store. The
  composable is already tested (`src/composables/__tests__/useAutoSave.test.ts`) and that coverage
  must survive the phase.
- **Status is keyed by surface id, with a derived "most urgent" rollup.** Several autosaving
  surfaces can be mounted simultaneously; a single global ref would let one surface's `saved`
  visually erase another's `saving`.
- **Extend `AutoSaveStatus` to `'idle' | 'pending' | 'saving' | 'saved' | 'error'`** and carry an
  optional error source. The absence of a failure state in today's union is precisely why
  `ServiceEditorView` had to hand-roll one.

### Status Indicator Placement & Presentation

- **Resolving the R040 wording conflict.** R040 says the status must be "anchored to the content
  being edited, never above the fold," while the phase success criterion says "visible without
  scrolling." Read literally these contradict. **Accepted reading: "above the fold" means "parked in
  the global app header, far from the content."** The status therefore goes in a **sticky sub-header
  of the editing surface itself** — anchored to its own content AND always on screen. This satisfies
  both sentences. Flag this reading in the plan; if the owner meant something else, this is the one
  decision in the phase most worth a second look.
- **Label text is `Saving…` / `Saved HH:MM` / the failure text** — a wall-clock timestamp, per
  R040's literal wording. Not relative time.
- **`Saved HH:MM` persists; it does NOT fade to idle after 3s.** "Persistent" is the requirement,
  and today's 3-second fade-to-idle (in both `useAutoSave` and the ServiceEditorView duplicate) is
  exactly the behaviour R040 replaces. The timestamp stays until the next change.
- **All four autosaving surfaces get it via one shared component**: `ServiceEditorView.vue`,
  `CongregationalEditor.vue`, `ScriptureSlideEditor.vue`, `SongLyricEditor.vue`. R040 says "every
  surface with autosave," so a ServiceEditorView-only rollout does not satisfy it.

### Failure Toast (R041)

- **Build a minimal app-level toast host in `AppShell.vue`, driven by a small store.** No toast
  primitive exists in the app today — the "Export success toast" at `ServiceEditorView.vue:556`
  (`pcExported`) is an inline transient banner, not reusable. Keep the host small and hand-written;
  do not add a toast library for one use.
- **Failure only — no success toast.** R041 is explicit that at a 500ms debounce, success toasts are
  constant noise.
- **The inline error text stays even when a toast fires.** The toast is the interrupt; the inline
  text is the durable record of what to retry. Phase 31 built that text deliberately (with its
  two-producer messages) — do not delete it in favour of the toast.
- **`aria-live="polite"` on the inline status region; the failure toast is `role="alert"`
  (assertive).** Routine saves must not interrupt a screen reader mid-sentence; a save failure must.

### Claude's Discretion

- Exact debounce value for the Service Order surface. R041's text references 500ms while
  `useAutoSave` defaults to 800ms — pick one deliberately and state it, rather than letting the two
  numbers coexist unexplained.
- Component naming, file placement within `src/components/`, and Tailwind class choices.
- Whether the shared status component is one component with a variant prop or a component plus a
  thin per-surface wrapper.
- Toast dismissal timing and stacking behaviour.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`src/composables/useAutoSave.ts`** — the composable to build on. Deep watcher, debounce
  (default 800ms), inflight guard with reschedule, `flush()`, `cleanup()`, auto-`onUnmounted`.
  Statuses today: `idle | pending | saving | saved`. **No error state.** A `'saved'` status
  self-fades to `'idle'` after 3000ms (lines 89-93 and 144-148) — that fade is what R040 removes.
- **`src/composables/__tests__/useAutoSave.test.ts`** — existing coverage that must survive.
- **Three surfaces already on the composable**: `CongregationalEditor.vue`,
  `ScriptureSlideEditor.vue`, `SongLyricEditor.vue`. These are the cheap wins for R040's "every
  surface" clause.
- **`src/stores/`** — nine Pinia stores (`auth`, `importedSlides`, `quarters`, `roster`,
  `scriptureSlides`, `services`, `slideGroups`, `songLyrics`, `songs`). Established pattern for
  where `saveStatus` belongs.
- **`src/components/AppShell.vue`** — the app-level mount point for a toast host.

### Established Patterns

- Vue 3 `<script setup>` + TypeScript, Pinia for cross-component state, Tailwind utility classes.
- `data-testid` attributes for test targeting (e.g. `data-testid="autosave-error"` at
  `ServiceEditorView.vue:124`).
- Vitest + `@vue/test-utils`; assertions written as counts over the mounted subtree rather than by
  eye (the Phase 28 `SongLyricsTab.r035.test.ts` precedent).

### Integration Points

- **`src/views/ServiceEditorView.vue`** is the centre of the phase:
  - lines 96-136 — the current header "Save area" with `autosaveStatus`, `autosaveErrorSource`, the
    `canEditService` gate, and the Phase 31 comments that explicitly hand `aria-live` + persistence
    to Phase 32.
  - line 1429 — `autosaveStatus` ref, already typed with `'error'`.
  - lines 1437, 1998-2035, 2130-2180 — `autosaveInitialized`, the remote-merge watcher that resets
    it, and the hand-rolled debounce/save block. **This is the suspected root cause region and the
    ~150 lines R040 wants deleted.**
  - line 3467 `onSave()` — line 3482 destructures `updatedAt` out of the write payload, which is the
    specific mechanism the hypothesis blames.
- **`canEditService`** gates the status region — a locked (planned/exported) service has nothing
  dirty, so the indicator must stay absent there per 31-UI-SPEC §3.

</code_context>

<specifics>
## Specific Ideas

- The phase's own ROADMAP note is the sharpest instruction available and should be treated as
  binding: *"Write the failing repro test FIRST… do not rewrite blind. Build one `useSaveStatus`
  Pinia aggregator sitting ABOVE the existing, already-tested `useAutoSave` composable (not
  replacing it)."*
- `ServiceEditorView.vue` lines 2058-2066 carry a Phase 31 warning worth honouring during the
  migration: whatever the save path does, `autosaveStatus` must never be left stranded at
  `'saving'` — a rejection that skips the `'saved'` assignment strands it forever, and the
  remote-merge branch keys off that value.

</specifics>

<deferred>
## Deferred Ideas

- **Offline / queued saves** — retrying a failed save automatically, or queueing mutations while
  disconnected. R041 asks only that a failure be announced, not that it be recovered. Out of scope.
- **A general-purpose notification/toast system** beyond the single failure case (success toasts,
  info toasts, undo-in-toast). Build only what R041 needs; generalize later if a second caller
  appears.
- **Migrating the inline `pcExported` export banner onto the new toast host.** Tempting adjacency,
  but it is a Planning Center export concern and changing it here would put an unrequested
  behaviour change inside a save-reliability phase.
- **Header / tab chrome redesign** — Phase 36 owns the Service Order rebuild and the contextual
  action bars. Place the status where Phase 36 can move it, but do not pre-empt that work.

</deferred>
