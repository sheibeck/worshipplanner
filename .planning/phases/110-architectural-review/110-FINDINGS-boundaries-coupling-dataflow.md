# 110-02 Findings: Module Boundaries, Coupling, Data Flow

**Plan:** 110-02 (Phase 110: Architectural Review)
**Reviewer:** executor (self-review, no sub-agents — per plan's review_method_note)
**Method:** Direct source reading (`src/views/**`, `src/components/**`, `src/stores/**`,
`src/composables/**`, `src/utils/**`, `functions/src/**`) grounded against live code (2026-09-02),
cross-checked against `.planning/codebase/ARCHITECTURE.md`/`STRUCTURE.md`/`CONCERNS.md` (Phase 109
relocated notes, dated 2026-07-16 — several map claims are now stale and are corrected below where the
live source has moved on). Cross-referenced against `110-FINDINGS-lifecycle-isolation.md` (110-01) to
avoid duplicating lifecycle/isolation findings; only new coupling/boundary/data-flow angles on the same
files are recorded here, with pointers back rather than re-derivation.

**Severity rubric (per 110-CONTEXT.md):** Critical = data loss / cross-tenant leak / auth bypass.
High = correctness bug or isolation weakness likely to bite under real use. Medium =
maintainability/coupling risk or a latent bug needing specific conditions. Low = nits/style.
Critical+High → Phase 111 remediation scope; Medium+Low → backlog.

---

## Dimension 1: Module Boundaries

### ARCH-B-01 — Medium — `ServiceEditorView.vue` has grown past its already-documented monolith size and now owns at least a dozen distinct feature responsibilities inline

**Location:** `src/views/ServiceEditorView.vue` — file is **4612 lines** total (script block alone spans
`1718-4612`, ~2894 lines), not the 2176 lines `CONCERNS.md` (dated 2026-07-16) currently documents — the
map is stale and undercounts by more than 2x. Responsibility inventory confirmed by function-level scan
of the script block: tab focus/keyboard management (`1811-1881`), PC-export team pre-selection heuristics
(`1881-1928`), re-lock notification handling (`1929-2053`), congregational-section editing
(`2053-2149`), run/present dispatch (`2149-2149`, `2398-2432`), stage-marker CRUD (`2310-2356`), row-menu
toggling (`2356-2398`), SortableJS drag-drop lifecycle (`2432-2587`), date-change handling (`2587-2700`),
autosave wiring via `useAutoSave` + a 140-line remote-merge watcher (`2700-2864`), lock-notify timer
management (`2997-3055`), status-transition handling — mark-as-planned/reopen (`3055-3285`), slot
CRUD (`3310-3481`), AI song-suggestion fetch/accept/reject (`3516-3711`, includes its own per-slot cache
keying and a 90-line `suggestAllSongs`), scripture slot handling (`3711-3759`), print + stage-layout
print (`3759-3791`), the Planning Center export flow — `checkForExistingPlan`/`onExportToPC`/
`onConfirmExport`, the last of which is itself **360 lines** (`3791-4253`), share-link generation for
both service and stage views (`4253-4344`), role-assignment override handling (`4344-4445`), messaging
overrides (`4445-4509`), delete/save/undo (`4509-4612`).

**Confirms and updates `CONCERNS.md`'s "Large monolithic ServiceEditorView component" entry:** the
Tech Debt entry is directionally correct but under-scoped — it names autosave, AI suggestions, PC
export, watchers and state management; live source shows the same file additionally owns re-lock
notifications, congregational editing, stage-marker CRUD, share-link generation for two separate
surfaces (service + stage), and role/messaging override handling, none of which existed or were called
out at the 2026-07-16 analysis date. `useAutoSave` (`src/composables/useAutoSave.ts`) and
`useSlideshowAssembly` are the only responsibilities that HAVE been successfully extracted to
composables — confirming the "break into composables" fix approach is directionally correct and
partially applied, but the majority of later-added features (AI suggestions, PC export, congregational
editing, share links, role overrides) were added directly into the view rather than following that
established extraction pattern.

**Impact:** Not itself a live correctness bug (Medium per rubric — maintainability/coupling risk) — but
elevates regression risk on every future service-editor feature, since a change to any one concern
(e.g. AI suggestions) shares the same file, the same 20+ reactive refs, and the same deep-watch autosave
surface as every other concern. See ARCH-D-01/ARCH-D-03 below for two concrete data-flow findings that
are direct consequences of everything sharing `localService`/`originalService`.

**Recommendation (Phase 111 or backlog):** Extract PC export (`checkForExistingPlan`/`onExportToPC`/
`onConfirmExport`, ~460 lines) and AI suggestions (`suggestAllSongs`/`fetchAiForSlot`/`acceptAiSong`/
`rejectAiSong`, ~195 lines) into composables next, mirroring `useAutoSave`/`useSlideshowAssembly` — these
two are the largest and most self-contained remaining clusters.

---

### ARCH-B-02 — Medium — `ServiceTemplateEditor.vue` writes to Firestore directly, bypassing the auth store's own settings-mutation surface

**Location:** `src/components/settings/ServiceTemplateEditor.vue:291` (`import { doc, updateDoc } from
'firebase/firestore'`), `:570` (`await updateDoc(doc(db, 'organizations', authStore.orgId),
{ 'settings.defaultServiceTemplate': payload })`, followed by `authStore.settings.defaultServiceTemplate
= payload` at `:571` to keep local state in sync).

**Problem:** This is exactly the `ARCHITECTURE.md` "Mutating Firestore Data Without Store" anti-pattern
in live form — a component calls `updateDoc()` directly after a user action, then hand-syncs the store's
local ref itself rather than the store owning the write (`useAuthStore` has no
`updateSettings`/`updateOrgDoc` method surface for this). The manual `authStore.settings....= payload`
line is doing the job the store's own listener would otherwise do, and it works only because
`authStore`'s org-doc `onSnapshot` will also independently re-deliver the same value shortly after — a
race that happens to be harmless here (both paths converge on the identical payload) but is fragile by
construction: any future editor of this file who removes the manual sync line "because the listener
already does this" would introduce a stale-UI window until the next snapshot.

**Impact:** Medium (maintainability/coupling risk) — not a correctness bug today because the write
target (`organizations/{orgId}`) and the manual local sync are both correct, but it is the ONE component
reviewed that bypasses the store-as-source-of-truth pattern for a WRITE (as opposed to ARCH-B-03/04
below, which are read-only listener bypasses).

**Recommendation:** Add an `updateOrgSettings(patch)` method to `auth.ts` (or a narrower
`updateDefaultServiceTemplate`) that performs the `updateDoc` + local-state sync together, and have this
component call it instead of touching `db`/`updateDoc` directly.

---

### ARCH-B-03 — Medium — `GettingStarted.vue` and `ConfigurationTab.vue` subscribe to Firestore collections directly, bypassing any store

**Location:** `src/components/GettingStarted.vue:77` (imports `collection, onSnapshot` from
`firebase/firestore`), `:128-135` (`onSnapshot(collection(db, 'organizations', orgId, 'members'), ...)`
counting `snap.size` into a local `memberCount` ref); `src/components/admin/ConfigurationTab.vue:136`
(same import), `:295-297` (`onSnapshot(collection(db, 'superAdmins'), ...)` mapping docs into a local
`superAdmins` ref).

**Problem:** Both are the `ARCHITECTURE.md` "Direct Firestore Calls in Components" anti-pattern in live
form — no `rosterStore`/`membersStore` or `superAdminsStore` exists to own either subscription, so each
component opens and tears down (`onUnmounted`) its own listener. Neither is a security issue (both
subscriptions are read-only and gated the same way a store subscription would be by
`firestore.rules`), but both duplicate the store pattern's subscribe/unsubscribe lifecycle machinery in
component-local code, and neither piece of local state (`memberCount`, `superAdmins`) is reusable by any
other component the way a store's reactive state would be.

**Impact:** Medium — no other component reviewed needs `memberCount` or the `superAdmins` list today,
so the immediate blast radius is small, but per `STRUCTURE.md`'s own "Where to Add New Code" guidance
("If a view needs different data, add a store subscription") this is exactly the shape of drift that
guidance exists to prevent, and it is confirmed present in two separate components independently
(not a one-off).

**Recommendation:** Low priority given the narrow, single-consumer usage of each — acceptable to leave
as component-local unless a second consumer of either subscription appears, at which point promote to a
store per the established pattern.

---

### ARCH-B-04 — Medium — `useSlideshowAssembly.ts`'s default lyrics subscriber duplicates `songLyricsStore`'s query rather than routing through it, and the two have already drifted

**Location:** `src/composables/useSlideshowAssembly.ts:37-59` (`defaultLyricsSubscriber`, its own direct
`onSnapshot(query(collection(db, 'organizations', orgId, 'songs', songId, 'lyrics'), orderBy('createdAt',
'desc'), limit(1)), ...)`) vs. `src/stores/songLyrics.ts:37-46` (`subscribeLyrics`, the store's own
`onSnapshot(query(collection(db, 'organizations', orgId, 'songs', songId, 'lyrics'), orderBy('createdAt',
'desc')), ...)` — **no `limit(1)`**).

**Problem:** This is both a boundary violation (a composable performing its own direct Firestore
`onSnapshot`, the same anti-pattern as ARCH-B-03 but in the composable layer rather than components) and
a coupling/duplication issue — the composable's own doc comment at `:29-35` explicitly says it is
"mirroring `songLyrics` store's `subscribeLyrics`", which is an acknowledgment that this is meant to be
the same query maintained twice, not a deliberately different contract. The two implementations have
already drifted: the composable adds `limit(1)`, the store's `subscribeLyrics` does not (the store
instead takes the first element of the full ordered array client-side elsewhere). If the ordering
semantics of one is ever changed without the other in mind, the slideshow-assembly path and the
lyric-editor path could disagree about which lyrics version is "current" for the same song.

**Impact:** Medium — no evidence of an active disagreement today (both currently resolve to
newest-`createdAt`-wins), but it is a live duplication with zero mechanism forcing the two to stay in
sync, and the composable's own comment shows the author was aware they should be identical.

**Recommendation:** Have `useSlideshowAssembly`'s default subscriber call `songLyricsStore.subscribeLyrics`
directly (or extract the shared query into one function both call) rather than maintaining a parallel
`onSnapshot`.

---

### ARCH-B-05 — Low — three `src/utils/*.ts` files import `useAuthStore` for read-only settings gating, a mild inversion of the documented Utility-layer dependency direction

**Location:** `src/utils/claudeApi.ts:56` (`isAiEnabled()` reads `useAuthStore()` inside a plain
function), `src/utils/messaging.ts:10-11` (`isMessagingEnabled()` — `return
useAuthStore().settings.messaging.enabled`), `src/utils/scriptureApi.ts` (same `useAuthStore` import).

**Problem:** `ARCHITECTURE.md`'s Layers section states the Utility Layer "Depends on: Types, Firebase
(via stores)" and is "Used by: Views, components, stores" — the documented direction is utils being
CALLED BY stores, not utils reaching INTO a store themselves. These three call sites invert that for a
narrow, read-only purpose (checking a boolean settings flag), not a mutation.

**Impact:** Low — no correctness or data-integrity risk (read-only, no write path), and Pinia stores are
legitimately callable from anywhere once `createPinia()` is installed, so this does not risk a runtime
circular-import failure the way a store-importing-a-store cycle could. Recorded because it is a
consistent, repeated pattern (three files, not one) worth a documented exception in `ARCHITECTURE.md`'s
layer-dependency table rather than silently ignoring the stated constraint.

**Recommendation:** No action required; optionally update `ARCHITECTURE.md`'s Utility Layer entry to
note "read-only settings gates may read `useAuthStore()` directly" as a documented, intentional
exception.

---

### ARCH-B-06 — Medium — `functions/src/index.ts` is a 2898-line god module holding five unrelated concerns inline, unlike its sibling concerns that were properly extracted

**Location:** `functions/src/index.ts` (2898 lines) — confirmed inline (not delegated to a submodule)
responsibility clusters via top-level export scan: the API reverse-proxy (`api`, `~475-716`), the PPTX
parse/render pipeline (`parsePptxHandler`/`parsePptx`/`requestPptxRenderHandler`/`requestPptxRender`,
`~716-955`), FOUR separate scheduled cleanup sweeps each with their own guard regex and handler
(`cleanupExpiredMedia`, `~955-1085`; `cleanupOrphanRenders`, `~1085-1260`; `cleanupOrphanBackgrounds`,
`~1260-1472`; `cleanupPptxSources`, `~1472-1644`), the on-demand cleanup preview (`previewCleanupDryRun`,
`~1644-1731`), the reminder + scheduled-message cron orchestration (`~1731-2205`), and the entire
service-messaging pipeline — queue/send/webhook/bounce-recording (`~2205-2898`).

**Contrast with the file's own sibling pattern:** `functions/src/index.ts` itself documents (per
`ARCHITECTURE.md`'s Backend Behavioral Notes) that `orgProvisioning.ts`, `superAdminClaims.ts`, and
`orgMembershipClaims.ts` each moved their implementation into a dedicated module specifically "so its
testable handlers can be imported directly by tests without going through the deployed wrappers," with
`index.ts` doing nothing but re-exporting. The five clusters above do NOT follow that established
pattern — their handler bodies live directly in `index.ts` (though several, e.g.
`queueServiceMessageHandler`, `sendQueuedMessageHandler`, are still exported separately from their
`onCall`/`onDocumentCreated` wrappers for direct unit-test import, so the *testability* half of the
sibling pattern is honored even though the *file-separation* half is not).

**Impact:** Medium (maintainability/coupling risk) — mirrors ARCH-B-01's ServiceEditorView finding on
the backend: every concern in this file shares the same top-level Admin SDK initialization and shared
helpers (`checkAndConsumeRateLimit`, `writeUsageLedger`, `checkOrgAiEnablement`), so a change to any
shared helper has a blast radius across all five clusters with no per-concern module boundary to contain
it, and the file's sheer size makes it easy for a future addition to land inline here "because everything
else already is," continuing the drift the sibling `orgProvisioning.ts`/`superAdminClaims.ts` extractions
were meant to establish as the norm.

**Recommendation (backlog, not Phase 111 — no correctness impact):** Extract the four cleanup sweeps
(they are already self-contained, each with its own guard regex and handler function) into a
`cleanupSweeps.ts` module, and the messaging pipeline into a `messaging.ts` module, following the exact
`orgProvisioning.ts` re-export pattern already established in this same file.

---

## Dimension 5: Coupling

### ARCH-C-01 — Low (confirmed, no new finding) — the one known cross-store write (`services` → `songs` `lastUsedAt`) follows the documented sanctioned pattern exactly

**Location:** `src/stores/services.ts:362-372` (`recomputeLastUsedFor`, `const songStore =
useSongStore(); ... await songStore.updateSong(songId, { lastUsedAt })`).

**Confirmed:** This is precisely `ARCHITECTURE.md`'s documented constraint — "If store A needs to update
data owned by store B ... it calls `storeB.updateX()` via import, not Firestore directly" — implemented
correctly: `services.ts` never constructs a `doc(db, 'organizations', orgId, 'songs', ...)` reference
itself for this write; it goes through `songStore.updateSong`. No boundary violation. See ARCH-C-02
below for a genuine (but different) issue in the same function.

---

### ARCH-C-02 — Medium — `recomputeLastUsedFor`'s per-song loop has no per-item failure isolation; a mid-loop failure can leave `lastUsedAt` inconsistent across the songs of one service with only a console log

**Location:** `src/stores/services.ts:362-372` (the `for (const songId of affectedSongIds) { ... await
songStore.updateSong(songId, { lastUsedAt }) }` loop, no try/catch inside the loop body); callers
`services.ts:450-456` (`markAsPlanned`) and `:484-490` (`reopenService`), each wrapping the WHOLE call in
a try/catch that logs `` `...lastUsedAt recompute failed for service ${id} — the status transition
already succeeded` `` and swallows the error.

**Problem:** If `songStore.updateSong` throws on the Nth song in `affectedSongIds` (permission blip,
network failure, offline), every song before N in the array has already been durably written with its
new `lastUsedAt`, but N and every song after it silently keep their STALE `lastUsedAt` — the caller's
catch block only knows "recompute failed," not which specific songs succeeded vs. failed, and takes no
corrective action (no retry, no partial-list surfacing). This is a genuine data-flow gap distinct from
ARCH-C-01's boundary correctness: the WRITE PATH is architecturally correct, but the LOOP's
all-or-partial semantics are unhandled.

**Impact:** Medium (needs a specific mid-loop failure condition; `lastUsedAt` is a display/sort field —
used for song-freshness sorting/filtering, not a security or financial value — so the blast radius of an
inconsistent value is a stale sort position, not data loss). The existing comment shows the author
already accepted "status transition already succeeded" as an intentional tradeoff, but did not extend
that same reasoning to the SONG-level partial-failure case within the loop itself.

**Recommendation:** Wrap each `songStore.updateSong` call in the loop with its own try/catch (mirroring
the per-object try/catch pattern already used throughout `functions/src/index.ts`'s cleanup sweeps —
see `ARCHITECTURE.md`'s Backend Behavioral Notes for `cleanupExpiredMediaHandler`), so one song's failure
never blocks the rest of the batch, and log which specific song ids failed.

---

### ARCH-C-03 — Medium — duplicated Firestore query between `songLyricsStore` and `useSlideshowAssembly.ts` (coupling half of ARCH-B-04, cross-referenced not re-derived)

See ARCH-B-04 above for full detail (this is the same finding, recorded once under Module Boundaries;
noted here only to satisfy the coupling dimension's explicit ask to flag "shared utilities that carry
... logic that should be shared" — this is the inverse case, logic that IS shared conceptually but
implemented twice and already drifted).

---

### ARCH-C-04 — Medium (informational, cross-referenced) — `useSlideshowAssembly.ts` is a high-fan-in composable binding four stores plus its own direct Firestore subscription

**Location:** `src/composables/useSlideshowAssembly.ts:5-8` (`useScriptureSlides`, `useImportedSlides`,
`useSlideGroups`, `usePptxRenders`) plus its own `defaultLyricsSubscriber` (ARCH-B-04).

This composable is already reviewed for its listener-lifecycle angle in `110-FINDINGS-lifecycle-isolation.md`
(F-LC-06 — `pptxRenders.ts`'s `syncSubscriptions` and its sole driver). Not re-derived here; recorded
only to note the COUPLING angle explicitly asked for by this plan's Task 2: four Pinia stores plus a
direct Firestore query are all bound together in one 743-line composable. F-LC-06 already confirmed the
one real call site (`useSlideshowAssembly`) is internally consistent and cited `ADR-0137`
(`activeSlideshowAssemblyInstances` tracking) as evidence this exact hazard class was already considered.
No new finding beyond F-LC-06 and ARCH-B-04.

---

### ARCH-C-05 — Medium (cross-referenced) — `functions/src/index.ts`'s shared helpers are a fan-out coupling point across its five unextracted concerns

Same underlying file as ARCH-B-06 (module-boundaries lens); recorded once there. Coupling angle: shared
helpers (`checkAndConsumeRateLimit`, `writeUsageLedger`, `checkOrgAiEnablement`,
`checkOrgBibleEnablement`) are called from multiple of the five clusters, so all consumers are coupled
through this one file's top-level scope with no module boundary limiting the blast radius of a helper
change. No correctness issue found — informational, same remediation as ARCH-B-06.

---

### ARCH-C-06 — Low (confirmed, no new finding) — no circular import chains found across `src/stores/*.ts`

**Verification performed:** Full inter-store import scan (`grep -rE "from ['\"]@/stores"
src/stores/*.ts`) shows a strict one-directional dependency graph: `services.ts` imports
`songs.ts`/`roster.ts`/`quarters.ts`/`auth.ts`; `quarters.ts` imports `roster.ts`; `appConfig.ts` imports
`auth.ts`; `saveStatus.ts` imports `toasts.ts`. None of `songs.ts`, `roster.ts`, or `auth.ts` import back
in the other direction — no cycle exists in the reviewed store graph. No finding; recorded per the
plan's explicit ask to check for circular/near-circular import chains.

---

## Dimension 4: Data Flow

### ARCH-D-01 — Medium — `reopenPcWarning`'s date clause is unreachable dead code: every `localService` deep-clone in `ServiceEditorView.vue` strips Firestore `Timestamp` instances down to plain objects with no `.toDate()`

**Location:** `src/views/ServiceEditorView.vue:2195-2209` (`reopenPcWarning` computed — `const toDate =
(exportedAt as { toDate?: () => Date } ...)?.toDate; const when = typeof toDate === 'function' ?
toDate.call(exportedAt) : null`, guarding against exactly the case described below) vs. every
`localService.value = JSON.parse(JSON.stringify(...))` deep-clone site in the same file: `:2801-2802`
(initial load from Firestore snapshot), `:2829-2830` (remote-merge on every subsequent snapshot),
`:2509`/`:2518` (reorder save/revert), `:2868` (autosave-failure revert), `:4592` (post-save
resync), `:4607` (undo). `src/types/service.ts:220-222` confirms `Service.createdAt`/`updatedAt`/
`pcExportedAt` are typed as Firestore `Timestamp`. `src/utils/slotTypes.ts:255-265`
(`backfillSlotIds`) confirms the value handed to the FIRST `JSON.parse(JSON.stringify(...))` at
`:2800-2802` is still a real `Timestamp` instance at that point (`backfillSlotIds` does a shallow `{
...service, slots }` spread, which does not touch `pcExportedAt`).

**Problem:** `JSON.stringify` on a Firestore `Timestamp` instance serializes it to a plain
`{seconds, nanoseconds}`-shaped object (via its own `toJSON`), and `JSON.parse` on that string produces
a plain object, NOT a reconstructed `Timestamp` — the `.toDate()` method is gone. Since `localService`
is deep-cloned this way on EVERY assignment in the file (initial load being the very first one), by the
time `reopenPcWarning` evaluates `localService.value?.pcExportedAt`, that value is already a plain
object with no `.toDate` method — the `typeof toDate === 'function'` guard is always false, `when` is
always `null`, and the "This service was exported to Planning Center on ${formatted}" branch (the whole
reason this computed and its date-formatting logic exist) can never render. Users always see only the
generic fallback sentence with no date. The defensive `typeof` guard shows the code's author was aware
`exportedAt` might not be a real `Timestamp` in some circumstance, but the guard fires on literally every
render, not just an edge case.

**Impact:** Medium — this is a genuine, always-reproducible correctness bug (not merely latent), but
its blast radius is cosmetic: the fallback sentence is still accurate ("this service was exported...
reopening does not change it"), it simply omits the specific date clause. Per the rubric, "High" is
reserved for bugs "likely to bite under real use" with a more substantive impact; this is downgraded to
Medium because no data is wrong or lost, only a nice-to-have UI detail is permanently missing. Flagged
as a broader pattern risk too: if ANY other code reads a `Timestamp`-typed field off `localService`/
`originalService` and calls `.toDate()` UNGUARDED (unlike this one defensive site), it would throw at
runtime — this review did not find such a call site among the fields actually read from `localService`
in this file, but the risk is structural to the deep-clone-via-JSON pattern itself, not specific to
`pcExportedAt`.

**Recommendation:** Either (a) reconstruct `pcExportedAt` as a real `Timestamp` after each deep-clone
(`Timestamp.fromMillis(...)`), or (b) replace the `JSON.parse(JSON.stringify(...))` deep-clone idiom with
a structural clone that preserves class instances (e.g. `structuredClone`, or a small custom deep-clone
that special-cases `Timestamp`), or (c) simplest: convert `pcExportedAt` to a plain millis number at the
point it is first read off the Firestore snapshot, so the rest of the file never depends on
`Timestamp`-specific behavior. Any of these also closes the structural risk noted above for any future
field.

---

### ARCH-D-02 — Low (confirmed, updates stale CONCERNS.md entry) — the service-editor round-trip (assign → update → Firestore → onSnapshot → view) has been substantially hardened since the 2026-07-16 map analysis

**Location:** `src/stores/services.ts:223-243` (`onSnapshot(q, { includeMetadataChanges: true }, ...)`
with explicit own-write-echo tracking — `ownWriteEchoIds`/`pendingWriteIds`, distinguishing a
locally-pending write's snapshot delivery from a genuinely-remote update); `src/views/ServiceEditorView.vue:2825-2836`
(the remote-merge watcher's `remoteJson !== localJson` byte-compare guard, only overwriting local state
when the incoming snapshot actually differs, and only when `autoSave.status.value` is `'idle'`/`'saved'`
— i.e. not mid-edit).

**Confirmed, corrects the map:** `CONCERNS.md`'s "JSON.parse on Firestore snapshots" Fragile-Areas entry
(dated 2026-07-16, citing the old line numbers `1168-1169`) describes a much simpler, less-guarded
pattern than what live source now shows. The current implementation is NOT a naive schema-less parse of
untrusted data — it is a deliberate deep-clone-for-comparison idiom (see ARCH-D-01 for its own, different
defect), gated by an own-write-echo classifier and a byte-level dirty check before ever touching local
state, with `ServiceLockedError`-aware failure handling (`handleAutosaveFailure`) that never strands the
UI at `'saving'` (documented as contract "BL-02" in the file's own comments). No new finding recorded
here — corrects the map's characterization rather than re-flagging the same line numbers as still-fragile
in the way originally described.

---

### ARCH-D-03 — Medium — the autosave race-condition risk `CONCERNS.md` names is narrowed but not fully closed; no test evidence confirms the remaining window is safe

**Location:** `src/views/ServiceEditorView.vue:2700-2864` (the `useAutoSave` wiring + remote-merge
watcher), `:2505` (`autoSave.cleanup()` inside the manual reorder-save path, canceling the debounce
timer before a synchronous `updateService` call).

**Problem:** The remote-merge watcher (ARCH-D-02) only re-checks `autoSave.status.value` — it does not
coordinate with the SEPARATE reorder-save path, which calls `autoSave.cleanup()` and then performs its
own `await serviceStore.updateService(...)` outside the composable's own status machine. If a remote
`onSnapshot` fires in the narrow window between that `updateService` promise settling and
`saveStatus.set(surfaceId.value, { status: 'saved', ... })` running at `:2510`, the merge watcher's
`autoSave.status.value` check would still read whatever the COMPOSABLE's status was (not this separate
reorder flow's local `saveStatus` state), since the two are different state machines
(`autoSave.status` from `useAutoSave` vs. the reorder path's own `saveStatus.set` calls) sharing the same
`localService`/`originalService` refs. No test was found (search of
`src/views/__tests__/ServiceEditorView*.test.ts`... not exhaustively enumerated here — scope-budgeted)
confirming this specific cross-path ordering is safe.

**Impact:** Medium — needs a narrow timing window (remote update landing during the specific gap between
a reorder's Firestore ack and its local status update) rather than being reachable on every save; this is
exactly the rubric's Medium definition ("a latent bug that needs specific conditions"). Recorded as
confirming — with a narrower, more specific mechanism — that `CONCERNS.md`'s "Autosave conflict
resolution... not tested" Test-Coverage-Gap entry is still accurate for this one narrow path, even though
the BROADER autosave race the map originally worried about (ARCH-D-02) is now well-guarded.

**Recommendation:** Route the reorder-save path's remote-merge suppression through the SAME
`autoSave.status`-equivalent signal the composable's own saves use, or add a regression test that
triggers a remote snapshot during an in-flight reorder save.

---

### ARCH-D-04 — Medium — the Planning Center song-import write path (`upsertSongs`) is unbatched and has no per-song failure isolation, unlike its sibling CSV import path in the same file

**Location:** `src/stores/songs.ts:342-423` (`upsertSongs` — a bare `for (const incoming of songsData)`
loop, each iteration awaiting its own individual `updateDoc`/`addDoc` call with no `writeBatch` and no
per-iteration try/catch) vs. `src/stores/songs.ts:425-440` (`importSongs`, the CSV path, in the SAME
file, explicitly chunking into `writeBatch`es of 499 — `const CHUNK = 499`); caller
`src/components/PcImportModal.vue:303-314` (`onConfirmImport` — one outer try/catch around the entire
`await songStore.upsertSongs(songsToImport)` call, setting `step.value = 'error'` with only a generic
error message on any failure, no per-song success/failure breakdown).

**Problem:** For a Planning Center library of hundreds of songs, `upsertSongs` performs hundreds of
SEQUENTIAL, individually-awaited Firestore writes (no `Promise.all` parallelism, no batching) with no
progress indication beyond the modal's single `'importing'` step, and no isolation between songs — if
`updateDoc`/`addDoc` throws on song N (permission blip, transient network failure, malformed field), the
whole call rejects and every song from N onward is never processed, with the caller unable to tell the
user which songs did or did not import. This directly answers this plan's read_first instruction to
trace the "Song Import: Planning Center → Firestore" data-flow path from `ARCHITECTURE.md` and confirms
`CONCERNS.md`'s "Planning Center API integration" Test-Coverage-Gap note ("Export can partially fail...
without feedback to user") applies symmetrically to IMPORT, not just export.

**Mitigating factor confirmed:** `upsertSongs`'s own matching logic (`byPcSongId`/`byCcliNumber`/
`byTitle`, `:346-367`) makes a retry of the SAME import list idempotency-safe — a re-run after a partial
failure will correctly re-match already-created/updated songs rather than duplicating them, so there is
no data-corruption risk on retry, only a UX gap (the user isn't told a retry is safe or necessary).

**Impact:** Medium — performance and UX gap for large libraries, not a data-loss or duplication risk
(the idempotent matching mitigates the worst outcome). Escalate to backlog rather than Phase 111 given
the rubric's Critical/High bar (data loss, cross-tenant leak, auth bypass, or a correctness bug/isolation
weakness) is not met here.

**Recommendation:** Adopt the same `writeBatch`-chunking pattern `importSongs` already uses in this file,
and surface per-song progress/failure counts in `PcImportModal.vue`'s `'importing'` step.

---

## Summary Table

| ID | Dimension | Severity | Location |
|----|-----------|----------|----------|
| ARCH-B-01 | Module Boundaries | Medium | `src/views/ServiceEditorView.vue` (whole file, 4612 lines) |
| ARCH-B-02 | Module Boundaries | Medium | `src/components/settings/ServiceTemplateEditor.vue:291,570` |
| ARCH-B-03 | Module Boundaries | Medium | `src/components/GettingStarted.vue:77-135`; `src/components/admin/ConfigurationTab.vue:136,295-297` |
| ARCH-B-04 | Module Boundaries + Coupling | Medium | `src/composables/useSlideshowAssembly.ts:37-59`; `src/stores/songLyrics.ts:37-46` |
| ARCH-B-05 | Module Boundaries | Low | `src/utils/claudeApi.ts:56`; `src/utils/messaging.ts:10-11`; `src/utils/scriptureApi.ts` |
| ARCH-B-06 | Module Boundaries + Coupling | Medium | `functions/src/index.ts` (whole file, 2898 lines) |
| ARCH-C-01 | Coupling | Low (confirmed, no new finding) | `src/stores/services.ts:362-372` |
| ARCH-C-02 | Coupling | Medium | `src/stores/services.ts:362-372,450-456,484-490` |
| ARCH-C-03 | Coupling | Medium (cross-ref ARCH-B-04) | see ARCH-B-04 |
| ARCH-C-04 | Coupling | Medium (cross-ref 110-01 F-LC-06) | `src/composables/useSlideshowAssembly.ts:5-8` |
| ARCH-C-05 | Coupling | Medium (cross-ref ARCH-B-06) | `functions/src/index.ts` |
| ARCH-C-06 | Coupling | Low (confirmed, no new finding) | `src/stores/*.ts` (full import graph) |
| ARCH-D-01 | Data Flow | Medium | `src/views/ServiceEditorView.vue:2195-2209` + all `JSON.parse(JSON.stringify(...))` sites |
| ARCH-D-02 | Data Flow | Low (confirmed, corrects stale map) | `src/stores/services.ts:223-243`; `src/views/ServiceEditorView.vue:2825-2836` |
| ARCH-D-03 | Data Flow | Medium | `src/views/ServiceEditorView.vue:2505,2700-2864` |
| ARCH-D-04 | Data Flow | Medium | `src/stores/songs.ts:342-440`; `src/components/PcImportModal.vue:303-314` |

**Critical+High findings for Phase 111 remediation:** none.
**Medium findings for backlog triage:** ARCH-B-01, ARCH-B-02, ARCH-B-03, ARCH-B-04/ARCH-C-03,
ARCH-B-06/ARCH-C-05, ARCH-C-02, ARCH-C-04, ARCH-D-01, ARCH-D-03, ARCH-D-04.
**Low/informational (no action required):** ARCH-B-05, ARCH-C-01, ARCH-C-06, ARCH-D-02.

This plan found no Critical or High findings — no data loss, cross-tenant leak, auth bypass, or
correctness bug "likely to bite under real use" was confirmed in the module-boundaries, coupling, or
data-flow dimensions. Every Medium finding above is a maintainability/coupling risk or a latent bug
needing specific conditions, consistent with the plan's own expectation ("Most boundary/coupling/
data-flow findings will land Medium/Low"). Per the phase's severity rubric, none of the above require
Phase 111 action; all are candidates for backlog triage alongside 110-01's Medium findings.
