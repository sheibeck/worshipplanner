---
phase: quick-260919-mvw
quick_id: 260919-mvw
slug: vamp-audio-resolves-from-the-live-vamp-d
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/utils/slideshowAssembler.ts
  - src/utils/__tests__/slideshowAssembler.test.ts
  - src/composables/useSlideshowAssembly.ts
  - src/composables/__tests__/useSlideshowAssembly.test.ts
  - src/stores/vamps.ts
  - src/stores/__tests__/vamps.test.ts
  - .planning/codebase/ARCHITECTURE.md
autonomous: true
requirements: [R437, R438, R440]

must_haves:
  truths:
    - "A group whose `bedVampId` names a vamp that HAS an MP3 in the live vamp store plays that MP3 in Run the Service even when the group stores no `bedAudioUrl` (owner repro: assign a no-MP3 vamp, attach the MP3 later under Songs > Vamps) — the assembled slide's `audioUrl` is the vamp's `attachment.downloadUrl`, `audioFromBed` is true, `audioLoop` is true."
    - "After a vamp's MP3 is REPLACED, every group bed and every entry assigned to that vamp plays the NEW URL — whenever the live vamp has an attachment URL it wins over the stored `bedAudioUrl` / `audioUrl` snapshot (whose Storage object `setAttachment` deletes)."
    - "A vamp absent from the map (deleted, R440) or an absent map (no `vampsById` passed; a volunteer with no vamps read) falls back to the stored URLs exactly as today — the no-map output is byte-identical to the pre-change output."
    - "A magic-link volunteer opening the Rehearse view never gets a thrown error or a `console.error` from the vamps listener's `permission-denied`; the slideshow still renders from stored URLs."
    - "The ♪ badge in Run the Service still reads the stored `vampLabel` / `bedVampLabel` (`useRunControl.vampLabelFor` is untouched); the assembler is still a pure function with no store import."
  artifacts:
    - src/utils/slideshowAssembler.ts
    - src/composables/useSlideshowAssembly.ts
    - src/stores/vamps.ts
    - src/utils/__tests__/slideshowAssembler.test.ts
    - src/composables/__tests__/useSlideshowAssembly.test.ts
    - src/stores/__tests__/vamps.test.ts
  key_links:
    - "`useSlideshowAssembly` org watch -> `vampStore.subscribe(id)` (guarded on `vampStore.orgId !== id`) -> `vampStore.vamps` -> `vampsById` computed -> `assembleSlideshow(svc, { ..., vampsById })` -> `resolveEntryMedia` / `emitSyntheticReferenceFromGroup` -> `liveVampAudioUrl` -> `slide.audioUrl` -> RunControlView's AudioPlayer (already proven by RunControlView.audio.test.ts)."
    - "`vamps.ts` `onSnapshot(q, next, ignorePermissionDenied('vamps store'))` — the error slot is what keeps a volunteer's denied read silent; without it Firestore surfaces an uncaught listener error."
---

<objective>
Vamp audio must resolve from the LIVE vamp document at slideshow-assembly time, with the URL snapshot stored on the slide group / entry kept only as the fallback.

Owner repro (local emulator, 2026-09-19): the "Key of C" vamp was assigned to the Scripture Reading group while it had no MP3 (Phase 142's no-MP3-assignable bed path), then an MP3 was attached under Songs > Vamps. In Run the Service the slide shows "♪ Vamp: Key of C" but plays nothing — `slideGroups/slot-2` holds `bedVampId` + `bedVampLabel` and NO `bedAudioUrl`, because the group only stores the URL captured at assignment time. The same snapshot design breaks after a vamp's MP3 is REPLACED: `src/stores/vamps.ts:96` `deleteObject()`s the superseded Storage object, so every group / entry still holding the old URL would play a dead link.

This refines 141-CONTEXT.md's R437 "denormalize, don't resolve live" decision by owner instruction: the LABELS stay denormalized (display-only, stale-after-rename by design, `useRunControl.vampLabelFor` unchanged), but the AUDIO URL is now live-resolved through a new optional `AssemblyInputs.vampsById` map, with the stored `entry.audioUrl` / `group.bedAudioUrl` as the deleted-vamp fallback — which is exactly what preserves R440 "delete-after-assign keeps the MP3" (a deleted vamp is simply absent from the map). The 141-CONTEXT line "Replaced MP3 after assignment: assigned slides keep the old URL … No propagation" is superseded by this task.

Purpose: a vamp plays whenever its library entry has an MP3, no matter whether the MP3 was attached before or after assignment, or replaced since.
Output: pure-assembler resolution + tests (Task 1); composable wiring, vamp-store listener hardening, tests, map-doc note, `npm run type-check` (Task 2). TDD per task (RED then GREEN commits, scope tag `260919-mvw`). No new dependencies, no `firestore.rules` change, no schema change. No Run-side test rewrite — `src/views/__tests__/RunControlView.audio.test.ts` already proves playback from `slide.audioUrl`.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@./CLAUDE.md
@.planning/phases/141-vamp-slide-assignment-live-playback/141-CONTEXT.md
@src/utils/slideshowAssembler.ts
@src/composables/useSlideshowAssembly.ts
@src/stores/vamps.ts
@src/types/vamp.ts
@src/types/slideGroup.ts
</context>

## Design (locked by the owner/orchestrator — implement exactly)

- **Resolution rule (both paths):** for an ENTRY, `liveUrl(entry.vampId) ?? entry.audioUrl` is the entry's own audio; for the GROUP BED, `liveUrl(group.bedVampId) ?? group.bedAudioUrl` is the bed URL, where `liveUrl(id)` = `inputs.vampsById?.get(id)?.attachment?.downloadUrl`, treated as absent when the map is absent, the vamp is absent, `attachment` is `null`, or `downloadUrl` is empty. Precedence stays two-level (entry-own wins over bed); `audioFromBed` = no entry-own URL AND a bed URL exists; a vamp-sourced bed loops (`audioFromBed && group.bedVampId`, the 260918-nm2 rule); entry-own audio loops only when `entry.audioLoop` (entry-level vamp assignment always stores `audioLoop: true` — `EditSlideDrawer.attachVampToSlide` — so nothing new is needed there). Video entries still get no audio.
- **Purity:** `slideshowAssembler.ts` gets NO store import — `vampsById` is data passed in, like every other `AssemblyInputs` map. Type it `ReadonlyMap<string, Vamp>` (a `Map` is assignable to it; the tests pass `new Map(...)`).
- **Composable:** only the `assembledSlideshow` computed (the single `assembleSlideshow(` call) receives `vampsById`. The three materializer `AssemblyInputs` literals (`materializationCandidates`, `ensureGroupMaterialized`, `rebuildOutcomes`) are unchanged — `buildInitialGroup` / `rebuildGroup` derive structure, not audio. The org watch subscribes the vamp store guarded on the STORE's own `orgId` (`vampStore.orgId !== id`), because `useVampStore.subscribe` is NOT idempotent — it tears down and re-creates the listener on every call, and `ServiceEditorView.vue:3177` / `SongsView.vue:440` also subscribe. The composable's `cleanup()` must NOT tear the vamp store down: the store is shared with those views and `resetOrgScopedStores` already owns church-switch teardown (the pptxRenders WR-02 lesson — a store-wide teardown from a per-instance cleanup kills sibling consumers).
- **Best-effort for volunteers:** `firestore.rules`' `/{collection}/{docId}` catch-all makes `vamps` `isOrgEditor`-read-only, so a magic-link volunteer in Rehearse (and a viewer-role member on `/services/:id`) gets `permission-denied` on the vamps listener. Add the project's existing `ignorePermissionDenied('vamps store')` (`src/utils/firestoreListener.ts`, precedent `src/stores/members.ts:29`) as `onSnapshot`'s third argument — permission-denied is swallowed silently, any other listener error still `console.error`s. `vamps` stays `[]`, so the assembler falls back to stored URLs.
- **Comments stay short** (CLAUDE.md): one line naming `260919-mvw` where behaviour changed; the rationale lives in the ARCHITECTURE.md paragraph, not inline.
- **Test commands:** targeted `npx vitest run <files>` per task (the full suite is ~9 min); `npm run type-check` once, at the end of Task 2. Never `--dir`.

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Assembler resolves vamp audio from the live vamp map, stored URLs as fallback (pure) + tests</name>
  <files>src/utils/slideshowAssembler.ts, src/utils/__tests__/slideshowAssembler.test.ts</files>
  <read_first>
    - src/utils/slideshowAssembler.ts lines 15-21 (type imports — add `Vamp`), lines 32-58 (`AssemblyInputs`; the optional `pptxRendersByImportId` doc comment is the style to mirror), lines 258-310 (`ResolvedGroupMedia` + `resolveEntryMedia(group, entry, song)`: lines 295-306 are the audio block to rewrite — `audioFromBed`, `resolvedAudioUrl`, the entry-own loop copy, the 260918-nm2 vamp-bed loop line), lines 354-398 (`emitFromGroup` — line 370 is the `resolveEntryMedia` call; `inputs` is in closure scope), lines 400-431 (`emitSyntheticReferenceFromGroup` — line 408 `const audioUrl = group.bedAudioUrl` and line 415 the vamp-bed loop spread are the second resolution site)
    - src/types/vamp.ts (`Vamp.attachment?: VampAttachment | null`; `VampAttachment.downloadUrl`)
    - src/types/slideGroup.ts lines 37-42 (`bedAudioUrl` / `bedVampId` / `bedVampLabel`), lines 76-85 (`audioUrl` / `audioLoop` / `vampId` / `vampLabel`)
    - src/utils/__tests__/slideshowAssembler.test.ts lines 1-25 (imports; `mockTimestamp` is defined near line 24), lines 111-141 (`makeInputs`, `makeSlideGroup`, `makeGroupSlideEntry`), lines 142-172 (`songSlot`, `scriptureSlot`), lines 463-475 (`makeCongregationalSection`), lines 2033-2219 (the `group-level vamp bed loops (260918-nm2)` describe — copy its fixture idioms; the case at 2080 "bedVampId with no bedAudioUrl resolves no audio" stays valid because it passes no map; the case at 2160-2219 shows the congregational-slot + synthetic `:ref` slide fixture)
  </read_first>
  <behavior>
    New describe `assembleSlideshow — vamp audio resolves from the live vamp doc (260919-mvw)` appended after the 260918-nm2 describe, with a local `makeVamp(overrides: Partial<Vamp> = {}): Vamp` fixture (id `vamp-1`, name `Key of C`, key `C`, `attachment` = a full `VampAttachment` whose `downloadUrl` is `https://cdn.example/key-of-c.mp3`, timestamps `mockTimestamp`, `createdBy: 'u1'`) and `import type { Vamp } from '@/types/vamp'`. All group-path cases use `songSlot({ id: 'slot-song-0', songId: 'song-1' })` + `makeSongLyrics()` + one lyric entry (`sourceRef: { kind: 'lyric', songId: 'song-1', sectionId: 'verse-1' }`) unless stated:
    - Owner repro: group `bedVampId: 'vamp-1'`, `bedVampLabel: 'Key of C · C'`, NO `bedAudioUrl`; `vampsById: new Map([['vamp-1', makeVamp()]])` -> `result[0].slide.audioUrl` is `https://cdn.example/key-of-c.mp3`, `result[0].audioFromBed` is `true`, `result[0].slide.audioLoop` is `true`.
    - Replaced MP3: group `bedVampId: 'vamp-1'` + stale `bedAudioUrl: 'https://cdn.example/old.mp3'`; live vamp URL `https://cdn.example/new.mp3` -> slide `audioUrl` is the NEW URL, `audioFromBed` true, `audioLoop` true.
    - R440 deleted vamp: group `bedVampId: 'vamp-1'` + stored `bedAudioUrl: 'https://cdn.example/kept.mp3'`; `vampsById: new Map()` (vamp absent) -> slide `audioUrl` is `https://cdn.example/kept.mp3`, `audioFromBed` true, `audioLoop` true.
    - Live vamp with `attachment: null` (MP3 removed) + stored `bedAudioUrl` -> stored URL still plays (fallback, not blank).
    - Entry-level: entry `vampId: 'vamp-1'`, `vampLabel`, `audioUrl: 'https://cdn.example/old.mp3'`, `audioLoop: true`; live vamp URL `https://cdn.example/new.mp3`; group has NO bed -> slide `audioUrl` is the NEW URL, `audioFromBed` is `false`, `audioLoop` is `true`. Same entry with `audioLoop` omitted -> `'audioLoop' in slide` is `false` (entry-own loop stays the stored flag).
    - Precedence intact: entry with plain uploaded `audioUrl: 'https://cdn.example/own.mp3'` (no `vampId`) inside a group whose `bedVampId` resolves live -> slide `audioUrl` is `own.mp3`, `audioFromBed` false, no `audioLoop` key.
    - Synthetic reference slide: `scriptureSlot({ id: 'slot-scripture-0', congregationalSections: [makeCongregationalSection()] })` with a group holding one scripture section entry (fixture idiom at lines 2160-2195), `bedVampId: 'vamp-1'`, NO `bedAudioUrl`, live vamp URL -> `result[0].slide.id` is `slot-scripture-0:ref`, its `audioUrl` is the live URL, `audioLoop` true, `audioFromBed` true.
    - Regression: for the owner-repro group WITH a stored `bedAudioUrl`, `assembleSlideshow(service, makeInputs({...}))` (no `vampsById` key) deep-equals `assembleSlideshow(service, makeInputs({..., vampsById: new Map()}))`, and the no-map slide `audioUrl` is the stored URL.
  </behavior>
  <action>
    RED: add the describe and `makeVamp` fixture per `<behavior>` to `src/utils/__tests__/slideshowAssembler.test.ts`. Run the file; the owner-repro, replaced-MP3, entry-level, and synthetic-reference cases fail (TS error on the unknown `vampsById` key counts — vitest still executes, the assertions fail). Commit `test(260919-mvw): failing tests — vamp audio resolves from the live vamp doc`.

    GREEN, `src/utils/slideshowAssembler.ts`:
    - Add `import type { Vamp } from '@/types/vamp'` beside the other type imports.
    - `AssemblyInputs`: add `vampsById?: ReadonlyMap<string, Vamp>` with a 2-3 line doc comment: live vamps keyed by `Vamp.id`; OPTIONAL — absent means stored URLs only; the stored `audioUrl` / `bedAudioUrl` remain the deleted-vamp fallback (R440); 260919-mvw.
    - Add a module-level helper `liveVampAudioUrl(vampId: string | undefined, inputs: AssemblyInputs): string | undefined` above `resolveEntryMedia`: returns `undefined` when `vampId` is falsy, otherwise `inputs.vampsById?.get(vampId)?.attachment?.downloadUrl || undefined` (the `|| undefined` collapses an empty string). One-line comment: live vamp URL wins over the stored snapshot (260919-mvw).
    - `resolveEntryMedia`: add a fourth parameter `inputs: AssemblyInputs`. Replace the audio block (lines 295-306) with: `const entryAudioUrl = liveVampAudioUrl(entry.vampId, inputs) ?? entry.audioUrl`; `const bedAudioUrl = liveVampAudioUrl(group.bedVampId, inputs) ?? group.bedAudioUrl`; `audioFromBed = !entryAudioUrl && !!bedAudioUrl`; `resolvedAudioUrl = entryAudioUrl ?? bedAudioUrl`; the entry-own loop line tests `entryAudioUrl` instead of `entry.audioUrl` and still requires `entry.audioLoop`; the `audioFromBed && group.bedVampId` loop line is unchanged. Keep the existing D-04 / 260918-nm2 comments, trimmed to one line each.
    - `emitFromGroup` line 370: pass `inputs` as the fourth argument.
    - `emitSyntheticReferenceFromGroup` line 408: `const audioUrl = liveVampAudioUrl(group.bedVampId, inputs) ?? group.bedAudioUrl`; the loop spread at 415 and `audioFromBed: !!audioUrl` at 428 are unchanged.
    - No store import, no reactivity, no other behaviour change. The file header's purity paragraph already covers the new map ("pre-loaded content maps").
    Run the test file; the whole file is green (including the 260918-nm2 and D-04 describes). Commit `fix(260919-mvw): assembler resolves vamp audio from the live vamp map, stored URLs as fallback`.

    Artifacts this task produces: `slideshowAssembler.ts` (+1 type import, +1 optional input, +1 helper, `resolveEntryMedia` audio block rewritten with a 4th param, 2 call-site touches); `slideshowAssembler.test.ts` (+1 describe of 8 cases, +1 `makeVamp` fixture, +1 type import).
  </action>
  <acceptance_criteria>
    - `grep -c 'vampsById?: ReadonlyMap<string, Vamp>' src/utils/slideshowAssembler.ts` -> 1
    - `grep -c "import type { Vamp } from '@/types/vamp'" src/utils/slideshowAssembler.ts` -> 1
    - `grep -c 'function liveVampAudioUrl' src/utils/slideshowAssembler.ts` -> 1 and `grep -c 'liveVampAudioUrl(' src/utils/slideshowAssembler.ts` -> 4 (definition + entry + bed + synthetic reference)
    - `grep -c 'resolveEntryMedia(group, entry, song, inputs)' src/utils/slideshowAssembler.ts` -> 1
    - `grep -c 'useVampStore\|from .@/stores/' src/utils/slideshowAssembler.ts` -> 0 (still pure)
    - `grep -c 'audioFromBed && group.bedVampId' src/utils/slideshowAssembler.ts` -> 1 (vamp-bed loop rule intact)
    - `grep -c '260919-mvw' src/utils/__tests__/slideshowAssembler.test.ts` -> >= 1 and `grep -c 'vampsById' src/utils/__tests__/slideshowAssembler.test.ts` -> >= 8
    - `npx vitest run src/utils/__tests__/slideshowAssembler.test.ts` exits 0
  </acceptance_criteria>
  <verify>
    <automated>npx vitest run src/utils/__tests__/slideshowAssembler.test.ts</automated>
  </verify>
  <done>Two commits (RED then GREEN). With a live vamp map, a `bedVampId`-only group and a `vampId` entry both resolve the vamp's current `downloadUrl` (bed loops, entry keeps its stored loop flag); a stale stored URL is overridden; a deleted / MP3-less vamp and an absent map fall back to the stored URLs byte-identically to today; the synthetic congregational reference slide follows the same rule; every pre-existing assembler test is green.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Composable passes live vampsById + subscribes the vamp store; vamp listener swallows permission-denied; tests, map doc, type-check</name>
  <files>src/composables/useSlideshowAssembly.ts, src/composables/__tests__/useSlideshowAssembly.test.ts, src/stores/vamps.ts, src/stores/__tests__/vamps.test.ts, .planning/codebase/ARCHITECTURE.md</files>
  <read_first>
    - src/composables/useSlideshowAssembly.ts lines 2-17 (imports — store imports 4-8), lines 121-125 (store instances), lines 140-153 (the `stopOrgWatch` org watch: `subscribeGroups(id)` at 148 is where the vamp subscribe goes), lines 155-169 (`scriptureReadingsById` / `importedDecksById` computeds — the shape `vampsById` mirrors), lines 410-421 (`assembledSlideshow` — the ONLY `assembleSlideshow(` call; add `vampsById`), lines 453-460 / 574-581 / 617-624 (the three materializer `AssemblyInputs` literals — leave unchanged), lines 716-743 (`cleanup()` — add nothing for vamps; note the WR-02 warning about store-wide teardown)
    - src/stores/vamps.ts lines 1-23 (imports), lines 36-57 (`subscribe` — `onSnapshot(q, next)` at 45 has no error callback; `unsubscribeAll`)
    - src/utils/firestoreListener.ts (`ignorePermissionDenied(context)` returns the onSnapshot error callback; `isPermissionDenied`)
    - src/stores/members.ts lines 20-32 (the precedent: `ignorePermissionDenied('members store memberCount')` as `onSnapshot`'s third argument)
    - src/views/ServiceEditorView.vue lines 3176-3179 (`if (!vampStore.orgId) vampStore.subscribe(orgId)` — the guard idiom) and src/views/SongsView.vue lines 436-448 (the other subscriber)
    - src/stores/orgScopedStores.ts lines 39-42 (vamp store already registered for church-switch teardown)
    - src/composables/__tests__/useSlideshowAssembly.test.ts lines 1-46 (imports + the scriptureSlides / importedSlides store stubs — the stub shape to copy for `@/stores/vamps`), lines 309-320 (`beforeEach` resets — add `vampsState.vamps = []`), lines 598-637 (the `slideGroups subscription (Task 1)` describe — copy its three cases' idiom: `useSlideshowAssembly(service, 'org-1')`, `await nextTick()`, `toHaveBeenCalledTimes(1)` / `toHaveBeenCalledWith('org-1')`, re-assigning `service.value` to prove no re-subscribe, `slideGroupsState.groups = [...]` seeding), lines 236-245 (`hymnSlot` fixture) and the `makeService` helper near line 220
    - src/stores/__tests__/vamps.test.ts lines 1-30 (the `firebase/firestore` mock — `onSnapshot: vi.fn((_query, callback) => …)` records only the 2nd arg; the 3rd arg is reachable via `vi.mocked(onSnapshot).mock.calls[0]![2]`), lines 80-86 (`beforeEach`), lines 107-155 (the `subscribe / onSnapshot` describe to extend)
    - .planning/codebase/ARCHITECTURE.md: the `### src/utils/slideshowAssembler.ts` entry (starts line 1189; ends just before `### src/utils/slideTypography.ts` at line 1222 — append the new paragraph there) and the `### src/composables/useSlideshowAssembly.ts` entry (starts line 2278; its "Module overview" paragraph at 2280-2288 gets one sentence). Line numbers shift after the first edit — locate by heading.
  </read_first>
  <behavior>
    `src/composables/__tests__/useSlideshowAssembly.test.ts` — new stub + new describe `vamp store subscription + live vamp audio (260919-mvw)`:
    - Stub: `const mockSubscribeVamps = vi.fn()`; `const vampsState = reactive<{ vamps: Vamp[] }>({ vamps: [] })`; `vi.mock('@/stores/vamps', () => ({ useVampStore: () => reactive({ vamps: vampsState.vamps, isLoading: false, orgId: null, subscribe: mockSubscribeVamps, unsubscribeAll: vi.fn() }) }))`; `import type { Vamp } from '@/types/vamp'`; `beforeEach` adds `vampsState.vamps = []`. A local `makeVamp()` fixture (same shape as Task 1's; `createdAt`/`updatedAt` `{} as never`).
    - `subscribes the vamp store once with the org id alongside groups`: hymn-slot service, `useSlideshowAssembly(service, 'org-1')`, `await nextTick()` -> `mockSubscribeVamps` called once with `'org-1'`; reassigning `service.value` to a renamed hymn -> still once.
    - `a bedVampId-only group plays the live vamp MP3 (owner repro)`: `vampsState.vamps = [makeVamp()]` (URL `https://cdn.example/key-of-c.mp3`); `slideGroupsState.groups = [group id/slotId 'slot-hymn-0', serviceId 'service-1', bedVampId 'vamp-1', bedVampLabel 'Key of C · C', slides: [{ id: 'entry-1', order: 0, sourceRef: { kind: 'text' } }], no bedAudioUrl]`; service `makeService([hymnSlot({ position: 0, id: 'slot-hymn-0' })])`; after `await nextTick()` -> `assembledSlideshow.value[0].slide.audioUrl` is the vamp URL, `.audioFromBed` true, `.slide.audioLoop` true.
    - `attaching the MP3 after assignment reaches the assembler live`: same group; `vampsState.vamps = [makeVamp({ attachment: null })]`; after setup `assembledSlideshow.value[0].slide.audioUrl` is `undefined`; then `vampsState.vamps.splice(0, 1, makeVamp())` (in-place, so the shared reactive array notifies); `await nextTick()` -> `audioUrl` is the vamp URL.
    - `a deleted vamp keeps the stored bed URL (R440)`: `vampsState.vamps = []`, group as above but WITH `bedAudioUrl: 'https://cdn.example/kept.mp3'` -> slide `audioUrl` is `kept.mp3`.
    `src/stores/__tests__/vamps.test.ts`, `subscribe / onSnapshot` describe, new case `passes an error handler that swallows permission-denied and logs anything else`: `store.subscribe('org-1')`; `const onError = vi.mocked(onSnapshot).mock.calls[0]![2] as (err: unknown) => void`; `expect(typeof onError).toBe('function')`; `const spy = vi.spyOn(console, 'error').mockImplementation(() => {})`; `expect(() => onError({ code: 'permission-denied' })).not.toThrow()`; `expect(spy).not.toHaveBeenCalled()`; `expect(store.vamps).toEqual([])`; `onError({ code: 'unavailable' })` -> `spy` called once; `spy.mockRestore()`.
  </behavior>
  <action>
    RED: add the `@/stores/vamps` stub, the `Vamp` type import, the `beforeEach` reset, the fixture, and the four composable cases; add the vamp-store error-handler case. Run both files; the subscription / live-audio cases and the error-handler case fail. Commit `test(260919-mvw): failing tests — composable subscribes vamps and passes vampsById; listener swallows permission-denied`.

    GREEN, `src/stores/vamps.ts`:
    - `import { ignorePermissionDenied } from '@/utils/firestoreListener'`.
    - `subscribe`: pass `ignorePermissionDenied('vamps store')` as `onSnapshot`'s third argument. One-line comment above: volunteers / viewers have no vamps read — stay quiet, the assembler falls back to stored URLs (260919-mvw).
    GREEN, `src/composables/useSlideshowAssembly.ts`:
    - `import { useVampStore } from '@/stores/vamps'` after the `usePptxRenders` import; `import type { Vamp } from '@/types/vamp'` with the type imports.
    - `const vampStore = useVampStore()` after `pptxRendersStore`.
    - In the org watch, directly after `slideGroupsStore.subscribeGroups(id)`: `if (vampStore.orgId !== id) vampStore.subscribe(id)`. One-line comment: 260919-mvw — live vamp URLs for the assembler; guarded on the store's orgId because the views subscribe too and `subscribe` replaces the listener; teardown belongs to `resetOrgScopedStores`, not `cleanup()`.
    - After `importedDecksById`: `const vampsById = computed<Map<string, Vamp>>(...)` building a `Map` keyed by `vamp.id` from `vampStore.vamps`.
    - `assembledSlideshow`: add `vampsById: vampsById.value` to the `assembleSlideshow` inputs. Leave the three materializer `AssemblyInputs` literals and `cleanup()` untouched.
    Run both test files; green (every pre-existing composable case included — the stub makes `useVampStore()` inert for them). Commit `fix(260919-mvw): composable passes live vampsById to the assembler and subscribes the vamp store; vamps listener swallows permission-denied`.

    Map doc (`.planning/codebase/ARCHITECTURE.md`, scoped `Edit`s only — never rewrite the file):
    - Assembler entry: append one paragraph at the end of the `### src/utils/slideshowAssembler.ts` entry (just before the `### src/utils/slideTypography.ts` heading): **`AssemblyInputs.vampsById` (quick 260919-mvw):** vamp audio is resolved from the LIVE vamp doc — `resolveEntryMedia` and the synthetic reference slide prefer `vampsById.get(entry.vampId | group.bedVampId)?.attachment?.downloadUrl` over the stored `entry.audioUrl` / `group.bedAudioUrl`; the stored URLs are the deleted-vamp fallback (R440) and the only source when the map is absent (no `vampsById` passed, or a volunteer whose vamps read is denied). Fixes the Phase 142 no-MP3-then-attach case and the replaced-MP3 dead link (`setAttachment` deletes the superseded Storage object). Labels (`vampLabel` / `bedVampLabel`) stay denormalized; loop rule unchanged (vamp bed loops, entry-own loops per `entry.audioLoop`). OPTIONAL, `ReadonlyMap`.
    - Composable entry: append one sentence to the "Module overview" paragraph: quick 260919-mvw — the org watch also subscribes `useVampStore` (guarded on the store's own `orgId`; never torn down in `cleanup()`, `resetOrgScopedStores` owns that; the listener swallows `permission-denied` via `ignorePermissionDenied`) and passes a `vampsById` computed to `assembleSlideshow` only — not to the materializer inputs.
    Include both doc edits in the GREEN commit.

    Type gate: run `npm run type-check` (vue-tsc --build — the CLAUDE.md gate; it also typechecks the test files). Must exit 0. Fix any error in the files this plan touches (an `orgId: null` stub field typed against the real store is the likeliest — widen the stub, do not touch the store types).

    Artifacts this task produces: `vamps.ts` (+1 import, +1 onSnapshot error arg, 1 comment line); `useSlideshowAssembly.ts` (+2 imports, +1 store instance, +1 guarded subscribe line, +1 `vampsById` computed, +1 input key); `useSlideshowAssembly.test.ts` (+1 store stub, +1 fixture, +1 describe of 4 cases); `vamps.test.ts` (+1 case); `ARCHITECTURE.md` (+1 paragraph, +1 sentence).
  </action>
  <acceptance_criteria>
    - `grep -c "ignorePermissionDenied('vamps store')" src/stores/vamps.ts` -> 1 and `grep -c "from '@/utils/firestoreListener'" src/stores/vamps.ts` -> 1
    - `grep -c "import { useVampStore } from '@/stores/vamps'" src/composables/useSlideshowAssembly.ts` -> 1
    - `grep -c 'if (vampStore.orgId !== id) vampStore.subscribe(id)' src/composables/useSlideshowAssembly.ts` -> 1
    - `grep -c 'const vampsById = computed' src/composables/useSlideshowAssembly.ts` -> 1 and `grep -c 'vampsById: vampsById.value' src/composables/useSlideshowAssembly.ts` -> 1 (exactly one input site)
    - `grep -c 'vampStore.unsubscribeAll' src/composables/useSlideshowAssembly.ts` -> 0 (no per-instance teardown of the shared store)
    - `grep -c "vi.mock('@/stores/vamps'" src/composables/__tests__/useSlideshowAssembly.test.ts` -> 1 and `grep -c '260919-mvw' src/composables/__tests__/useSlideshowAssembly.test.ts` -> >= 1
    - `grep -c 'permission-denied' src/stores/__tests__/vamps.test.ts` -> >= 1
    - `awk '/^### src\/utils\/slideshowAssembler.ts/{f=1} /^### src\/utils\/slideTypography.ts/{f=0} f' .planning/codebase/ARCHITECTURE.md | grep -c '260919-mvw'` -> 1
    - `awk '/^### src\/composables\/useSlideshowAssembly.ts/{f=1} /^\*\*`LyricsSubscriber`/{f=0} f' .planning/codebase/ARCHITECTURE.md | grep -c '260919-mvw'` -> 1
    - `git diff --stat HEAD~2 -- firestore.rules src/composables/useRunControl.ts` shows no change to either file
    - `npx vitest run src/composables/__tests__/useSlideshowAssembly.test.ts src/stores/__tests__/vamps.test.ts` exits 0
    - `npm run type-check` exits 0
  </acceptance_criteria>
  <verify>
    <automated>npx vitest run src/composables/__tests__/useSlideshowAssembly.test.ts src/stores/__tests__/vamps.test.ts && npm run type-check</automated>
  </verify>
  <done>Two commits (RED then GREEN). The composable subscribes the vamp store once per org (guarded on the store's `orgId`, no teardown in `cleanup()`), builds `vampsById` from `vampStore.vamps`, and passes it to the single `assembleSlideshow` call so a bedVampId-only group plays the live MP3 and an MP3 attached after assignment shows up reactively; a volunteer's `permission-denied` on the vamps listener is swallowed silently (other errors still logged); both ARCHITECTURE.md entries describe the live-resolution rule; `npm run type-check` and both targeted vitest runs are clean.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Firestore `organizations/{orgId}/vamps` -> client | Editor-only read (`firestore.rules` catch-all, unchanged); a volunteer / viewer listener is denied and must fail quietly |
| Vamp `attachment.downloadUrl` -> `<audio src>` | Org-authored Storage URL, same trust as today's stored `bedAudioUrl` / `audioUrl` snapshot |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-260919-mvw-01 | Information disclosure | `useVampStore.subscribe` from the Rehearse view | low | accept | Rules unchanged — a volunteer's read is denied server-side; the client only adds `ignorePermissionDenied` so the denial is silent, and the assembler falls back to the URLs the slide group already exposes to that volunteer |
| T-260919-mvw-02 | Tampering | `liveVampAudioUrl` -> `slide.audioUrl` | low | accept | The URL comes from the org's own editor-written vamps doc, the same origin and trust as the stored snapshot it replaces; no new input surface, no rules or schema change |
| T-260919-mvw-03 | Denial of service | `assembledSlideshow` recompute on every vamps snapshot | low | accept | One org-scoped listener already opened by the editor views; the `vampsById` computed is O(vamps) and the assembler is already re-run on every groups / lyrics snapshot |
</threat_model>

<verification>
- `npx vitest run src/utils/__tests__/slideshowAssembler.test.ts src/composables/__tests__/useSlideshowAssembly.test.ts src/stores/__tests__/vamps.test.ts` exits 0 (three files, all green).
- `npm run type-check` exits 0 (vue-tsc --build, tests included).
- `git log --oneline -4` shows the four `260919-mvw` commits (RED/GREEN per task).
- No change to `firestore.rules`, `src/types/*.ts`, `src/composables/useRunControl.ts`, or `src/views/__tests__/RunControlView.audio.test.ts`.
- Manual (owner, next local run — not gating): in the emulator repro, the Scripture Reading slide with "♪ Vamp: Key of C" now plays the MP3 attached after assignment; replacing the vamp's MP3 under Songs > Vamps changes what Run the Service plays without touching the slide.
</verification>

<success_criteria>
- A `bedVampId`-only group and a `vampId` entry both play the vamp's CURRENT `attachment.downloadUrl` in Run the Service, whether the MP3 was attached before or after assignment or replaced since.
- Stored `bedAudioUrl` / `audioUrl` remain the fallback when the vamp is deleted (R440), has no MP3, or the map is absent — the no-map output is byte-identical to the pre-change output.
- The assembler stays a pure function; the composable is the only place the vamp store is read; the vamp store is subscribed once per org and never torn down per instance.
- A volunteer's denied vamps read is silent; other listener errors still log.
- The ♪ label path and the Run-side audio tests are untouched and green; type-check clean.
</success_criteria>

<output>
Create `.planning/quick/260919-mvw-vamp-audio-resolves-from-the-live-vamp-d/260919-mvw-SUMMARY.md` when done
</output>
