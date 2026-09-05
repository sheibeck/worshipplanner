# Phase 119: Architecture — Correctness, Batching & Store-Ownership Fixes - Context

**Gathered:** 2026-09-04
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous / yolo). Nine self-contained architecture findings from v2.8's
architectural review (backlog 999.4), each precisely specified by its ROADMAP success criterion + the
review doc. All are **behavior-preserving refactors / correctness fixes** — the overriding invariant is
that ordinary app behavior is unchanged and the app test suite stays green.

<domain>
## Phase Boundary

The nine ARCH findings that DON'T require touching module boundaries (R349-R357). Module-boundary /
god-module decomposition (ARCH-006/010, R358/R359) is Phase 120. No security-rules or Cloud-Functions
work (those were Phases 117-118).
</domain>

<decisions>
## Implementation Decisions

Each fix maps to one ARCH finding; the ROADMAP success criteria are the acceptance spec. Approach per item
(grounded in `.planning/milestones/v2.8-phases/110-architectural-review/110-ARCHITECTURE-REVIEW.md`):

- **R349 (ARCH-011)** — `recomputeLastUsedFor` (src/stores/services.ts:362-372): wrap each per-song
  update in its own try/catch so one failure doesn't abort the rest; log the failed song id(s). Keep the
  existing swallow-and-continue intent, just isolate per item.
- **R350 (ARCH-014)** — `upsertSongs` (src/stores/songs.ts:342-440): chunk into `writeBatch`es of ≤499
  exactly like the sibling CSV `importSongs`; surface per-song success/failure to the import UI
  (src/components/PcImportModal.vue:303-314) instead of one bad write silently stopping the rest. Retries
  are idempotency-safe (existing).
- **R351 (ARCH-009)** — `useSlideshowAssembly`'s `defaultLyricsSubscriber` (src/composables/
  useSlideshowAssembly.ts:37-59) must route through, or share one query function with,
  `songLyricsStore.subscribeLyrics` (src/stores/songLyrics.ts:37-46) — eliminating the `limit(1)` drift
  (one query has it, the other doesn't). Single source of truth for the query.
- **R352 (ARCH-012)** — `reopenPcWarning` (src/views/ServiceEditorView.vue:2195-2209): the JSON
  deep-clone idiom (`JSON.parse(JSON.stringify(...))`) strips the `pcExportedAt` Firestore `Timestamp` to
  a plain object with no `.toDate()`, so the date branch is unreachable dead code. EITHER fix the clone so
  the guard works and renders the real date, OR remove the dead branch. Prefer whichever is simpler and
  lowest-risk; if fixing the clone, be surgical — ServiceEditorView.vue is a 4600-line monolith, do not
  refactor beyond this site.
- **R353 (ARCH-002)** — `ServicesView.vue`'s org-switch watcher (src/views/ServicesView.vue:364-390):
  explicitly tear down `teamsStore` locally (defense-in-depth), matching the pattern already in
  RosterView/DashboardView/TeamView. Copy the established idiom.
- **R354 (ARCH-003)** — `SongLyricEditor.vue` (:848-856) and `ScriptureSlideEditor.vue` (:230-247):
  make the org-scoped subscription reactively re-subscribe/teardown when the org prop changes while
  mounted, instead of subscribing once on mount. Use a `watch(() => props.orgId, ..., {immediate:true})`
  teardown/re-subscribe idiom (the same one [[church-switch-resubscribe-fix]] established elsewhere).
- **R355 (ARCH-007)** — `ServiceTemplateEditor.vue:291,570`: stop calling `updateDoc()` on the org doc
  directly + hand-syncing `authStore.settings`. Add a new auth-store mutation method that does the write
  AND the local-state sync together, and call it. Follow the store-as-source-of-truth pattern used by
  other settings writes.
- **R356 (ARCH-008)** — `GettingStarted.vue`'s member-count `onSnapshot` (:77-135) and
  `ConfigurationTab.vue`'s super-admins `onSnapshot` (:136,295-297): move each into an owning store
  (existing or a small new one) so the subscribe/unsubscribe lifecycle isn't duplicated inline in a
  component. Match how other org-scoped stores expose subscribe(orgId)/reset.
- **R357 (ARCH-013)** — the autosave/reorder-save coordination window in ServiceEditorView.vue
  (:2505,2700-2864): add a regression TEST proving a remote snapshot arriving during an in-flight reorder
  save is handled safely (no stale overwrite, no lost edit). If the test exposes a real unguarded window,
  close it minimally; if the existing own-write-echo + dirty-check guards already cover it (ARCH-023 says
  the round-trip is substantially hardened), the deliverable is the proving test.

### Claude's Discretion
- Whether R356's listeners land in an existing store vs a small new one; the exact auth-store method name
  for R355; whether R352 fixes-the-clone vs removes-the-branch (pick the lower-risk one on inspection).
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets / patterns to COPY (these fixes are "make X match its sibling")
- CSV `importSongs` writeBatch chunking (src/stores/songs.ts) — the template for R350.
- RosterView/DashboardView/TeamView org-switch teardown watchers — the template for R353.
- The `watch(() => authStore.orgId, ..., {immediate:true})` re-subscribe idiom ([[church-switch-resubscribe-fix]]) — the template for R354.
- `songLyricsStore.subscribeLyrics` — the canonical query R351 must converge on.
- Existing org-scoped stores' subscribe(orgId)/reset shape (src/stores/orgScopedStores.ts) — the template for R356.

### Established Patterns
- Store-as-source-of-truth: components call store mutation methods, not `updateDoc()` directly (the
  pattern R355 restores).
- `resetOrgScopedStores()` (src/stores/orgScopedStores.ts) coordinates org-switch teardown centrally;
  R353 adds the local defense-in-depth layer on top.

### Integration Points
- src/stores/{services,songs,songLyrics,auth,orgScopedStores}.ts, src/composables/useSlideshowAssembly.ts,
  src/components/{PcImportModal,SongLyricEditor,ScriptureSlideEditor,GettingStarted}.vue,
  src/components/settings/ServiceTemplateEditor.vue, src/components/admin/ConfigurationTab.vue,
  src/views/{ServicesView,ServiceEditorView}.vue.

</code_context>

<specifics>
## Specific Ideas

- **Overriding invariant: behavior-preserving.** These are correctness/architecture fixes, not feature
  changes. The gate is the app suite (`npx vitest run`, EXCLUDES rules) + `npm run type-check` (full
  vue-tsc build per CLAUDE.md — several of these touch typed store interfaces). No `firestore.rules` or
  functions changes.
- **ServiceEditorView.vue is a 4600-line monolith** (R352, R357 touch it) — be surgical; do NOT start the
  decomposition here (that's Phase 120). Add tests near the affected logic.
- Full per-finding detail: `.planning/milestones/v2.8-phases/110-architectural-review/110-ARCHITECTURE-REVIEW.md` (ARCH-002/003/007/008/009/011/012/013/014).
- Several items are pure store/lifecycle refactors that are UI-adjacent but NOT UI-design — no UI-SPEC.

</specifics>

<deferred>
## Deferred Ideas

- ARCH-006/010 god-module decomposition (R358/R359) + ARCH-020 utils dependency inversion (R360) → Phase 120.
- The confirmed-sound ARCH-015..019/021..023 verification-note findings — no action (out of scope, see
  REQUIREMENTS Out of Scope).

</deferred>
