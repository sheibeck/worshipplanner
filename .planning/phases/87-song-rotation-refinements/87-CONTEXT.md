# Phase 87: Song & Rotation Refinements - Context

**Gathered:** 2026-08-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Three small, independent refinements: (R249) let a planner edit a song's Key, (R253) exclude the sermon
passage from the Scripture rotation tab, and (R256) confirm/correct the schedulable-roles "default count"
copy. No shared surface — each is isolated.
</domain>

<decisions>
## Implementation Decisions

### R249 — Editable song Key (owner: "Primary/first arrangement key")
- Songs have NO top-level `key`; the key lives on each `Arrangement` (`src/types/song.ts` — `Arrangement.key: string`).
  The current drawer only lets you PICK a primary via `primaryArrangementId` (a `<select>` shown only when
  `form.arrangements.length > 1`) — it never lets you EDIT a key.
- Add an **always-visible editable "Key" text input** in the song edit drawer (`SongSlideOver.vue`) bound to
  the **primary/first arrangement's** key — resolve the target arrangement as
  `primaryArrangementId ?? arrangements[0]`. For the common single-arrangement song this edits that sole
  arrangement's key; for a multi-arrangement song it edits the primary arrangement's key value.
- It persists through the existing song save/upsert path (write the edited value back onto the resolved
  arrangement in `form.arrangements`). Keep the existing "Primary key" selector for multi-arrangement songs
  (it selects WHICH arrangement is primary; the new field edits that arrangement's key VALUE).
- Edge: if a song has zero arrangements (shouldn't normally happen), the planner decides a safe fallback
  (e.g. create a default arrangement to hold the key, or hide the field) — do not crash.

### R253 — Scripture rotation excludes sermon (unambiguous)
- **Root cause:** `src/components/ScriptureRotationTable.vue` lines ~151–156 explicitly add
  `service.sermonPassage` to the rotation keys. Remove that block so ONLY `SCRIPTURE` slots
  (`slot.kind === 'SCRIPTURE'`, lines ~142–149) contribute to the rotation.
- Also fix the empty-state copy (line ~19: "Add scripture slots **or a sermon passage** to see rotation
  patterns") to drop the sermon-passage mention.
- Update `ScriptureRotationTable.test.ts` — remove/adjust any assertion that expects the sermon passage to
  appear; add a regression test proving a service's `sermonPassage` does NOT appear as a rotation row while
  its SCRIPTURE slots do.

### R256 — Schedulable-roles copy accuracy (verify-first; likely already satisfied)
- The current `RolesConfigPanel.vue` copy already reads: *"Schedulable roles grouped by Band, Tech, and
  Other. Default count is the number of volunteers the scheduler auto-fills for this role each service."*
  This is ACCURATE — v2.2's R246 already replaced the old "soft planning target, not a hard cap" wording
  (a `RolesConfigPanel.test.ts` assertion even proves those phrases are gone). A repo-wide grep for
  "soft planning target" / "hard cap" finds only that negative test + an unrelated `scheduler.ts` code
  comment.
- Therefore R256 is **satisfied-by-verification**: confirm no UI surface still calls the default count a
  "soft planning target" / "not a hard cap" (check RolesConfigPanel, the ServiceEditorView Roles section,
  QuarterView, any tooltip). If a straggler exists, correct it to describe the real behavior (the scheduler
  fills up to that count each service). If none exists, record R256 as verified-complete with no code change
  needed and keep/strengthen the negative-assertion test.
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/SongSlideOver.vue` — the song edit drawer; `form.arrangements`, `form.primaryArrangementId`,
  the "Primary key" `<select>` (~lines 217–234). Add the editable Key input here.
- `src/types/song.ts` — `Arrangement.key: string` (line 15); `Song.primaryArrangementId` (line 33); no
  top-level `Song.key`.
- `src/components/ScriptureRotationTable.vue` — the rotation table; `rotationEntries` computed (~135–171)
  with the sermon block at 151–156 to remove; empty-state copy at line 19.
- `src/components/RolesConfigPanel.vue` — the schedulable-roles description (lines 5–8, already accurate).
- Tests: `SongSlideOver.test.ts`, `ScriptureRotationTable.test.ts`, `RolesConfigPanel.test.ts`.

### Established Patterns
- Song edits flow through the drawer `form` → existing upsert/save; edit the arrangement in place.
- `service.sermonPassage: ScriptureRef` vs `SCRIPTURE` slots — the rotation must count only the latter.

### Integration Points
- SongSlideOver Key input ↔ the resolved primary arrangement in `form.arrangements` ↔ song save.
- ScriptureRotationTable ↔ `service.slots` (SCRIPTURE only), NOT `service.sermonPassage`.
</code_context>

<specifics>
## Specific Ideas

- Owner R249: "Allow us to update/edit the Key on each song." Scoped to the primary/first arrangement's key.
- Owner R253: "Scripture rotation tab seems to include Sermon scripture. This should only include scripture
  items added to the service plan." → remove the sermonPassage contribution.
- Owner R256: "'…Default count is a soft planning target, not a hard cap.' … it certainly seems to hard
  target this number. This is OK, we just need to make sure our description is accurate." → the copy is
  already accurate in source; verify and catch any straggler.
</specifics>

<deferred>
## Deferred Ideas

- Full per-arrangement key editing — owner chose the primary/first-arrangement key only.
- Changing the scheduler's count-targeting BEHAVIOR — R256 is copy-only; the behavior stays (owner said
  "This is OK").
</deferred>
