---
task: quick
slug: 260812-izz-remove-bpm-from-song-share-link-and-prin
type: execute
autonomous: true
files_modified:
  - src/views/ShareView.vue
  - src/components/ServicePrintLayout.vue
  - src/views/ServiceEditorView.vue
  - src/components/__tests__/ServicePrintLayout.test.ts
  - src/views/__tests__/ShareView.test.ts

must_haves:
  truths:
    - "BPM appears nowhere on the shared service link view."
    - "BPM appears nowhere on the printed service output."
    - "Every service item's per-item notes render on the share link, for all slot kinds (SONG/SCRIPTURE/PRAYER/MESSAGE/ANNOUNCEMENTS/MISC/HYMN)."
    - "Every service item's per-item notes render on the printed output, for all slot kinds."
    - "A newly added Miscellaneous item still defaults to 0 slides (already shipped under R123 — verified, not re-implemented)."
  artifacts:
    - src/views/ShareView.vue
    - src/components/ServicePrintLayout.vue
  key_links:
    - "buildServiceSnapshot (services.ts) spreads full slots into the snapshot, so slot.notes is already present on the public share document — the share view just needs to read it."
    - "Notes/body text is user-authored and the share link is PUBLIC — it must render via Vue text interpolation ({{ }} / :value), never v-html, so stored text cannot execute (T-quick-01)."
---

<objective>
Three focused tweaks to the WorshipPlanner service share/print surfaces:

1. Remove BPM (tempo) from the shared service link view and the printed service output.
2. Render each service item's per-item notes on BOTH the share link and the print, for every slot kind (they are currently missing or only partially shown).
3. Confirm a new Miscellaneous item defaults to 0 slides (already implemented under R123 — verify, do not re-implement).

Purpose: BPM is band-internal noise on a congregation/team-facing surface; per-item notes are what planners actually want the team to see; misc-0-slides was requested again and must be confirmed still true.

Output: BPM removed from two render surfaces; a single consolidated per-item notes line rendered on both surfaces for all kinds; a passing verification that MISC derives no slides.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
</execution_context>

<context>
@.planning/STATE.md
@./CLAUDE.md

# Render surfaces being edited
@src/views/ShareView.vue
@src/components/ServicePrintLayout.vue

# Data model + already-shipped behaviors (read for reference — the notes/body/label field
# semantics and the MISC 0-slide rule live here; do NOT change these files except the one
# ServicePrintLayout invocation in ServiceEditorView.vue noted in Task 1)
@src/types/service.ts

# Field semantics reference (do not edit):
# - slot.notes is the consolidated per-item free-text field for EVERY slot kind
#   (MediaAttachableSlot base, R122). slot.body is the legacy free-text for
#   MESSAGE/ANNOUNCEMENTS/MISC only. The editor's own helper reads them as
#   `slot.notes ?? slot.body` (ServiceEditorView.vue slotFreeText, ~line 2788).
# - buildServiceSnapshot (src/stores/services.ts:104-154) spreads full slots into the
#   share snapshot, so slot.notes is ALREADY present on the public share document.
# - MISC 0-slides is already implemented at src/utils/slideGroupMaterializer.ts:157-163
#   and tested at src/utils/__tests__/slideGroupMaterializer.test.ts:378-391.

# Testing/type-check commands are project-specific — see CLAUDE.md:
#   type-check gate: npm run type-check   (vue-tsc --build — also checks test files)
#   app test suite:  npx vitest run       (bare; excludes src/rules.test.ts)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Remove BPM from the share link and the print output</name>
  <files>src/views/ShareView.vue, src/components/ServicePrintLayout.vue, src/views/ServiceEditorView.vue, src/components/__tests__/ServicePrintLayout.test.ts</files>
  <action>
Remove every BPM display from both render surfaces.

ShareView.vue (SONG slot, ~line 39): the line currently reads the song key and BPM together —
change it to show ONLY the key. The paragraph text becomes "Key: " followed by the songKey
interpolation; delete the " | BPM: ..." portion and the slot.bpm interpolation entirely. Keep the
same class string (text-sm text-gray-500) and the surrounding v-if="slot.songId" template.

ServicePrintLayout.vue (SONG slot, ~lines 28-31): delete the separator span ("  |  ") and the
BPM span that renders getBpmForSlot(slot). Keep the "Key: {{ slot.songKey }}" span and its
preceding separator. In the script block: delete the now-dead getBpmForSlot function (~lines
131-144), remove the `songs` entry from defineProps (leaving only `service: Service`), and drop
the now-unused imports `SongSlot` and `Song` from their import lines. Do NOT remove `HymnSlot`,
`ScriptureRef`, `slotLabel`, `miscLabel`, or `formatScriptureRef` — they stay in use.

ServiceEditorView.vue (~lines 1423-1427): the <ServicePrintLayout> element passes
`:songs="songStore.songs"`. Delete that one attribute line only; keep `v-if="localService"` and
`:service="localService"`. Do NOT touch the other `:songs="songStore.songs"` usage at ~line 1042
(a different component still needs it) and do NOT remove the songStore import/usage.

Leave buildServiceSnapshot's internal bpm computation (src/stores/services.ts) UNTOUCHED — the
`bpm` field it writes into the snapshot is no longer displayed but is harmless plumbing; removing
it would ripple into the services store test for no user-visible benefit. This is a deliberate,
scoped decision, not an omission.

ServicePrintLayout.test.ts: delete the test that asserts BPM renders ("renders BPM for a song slot
when available from arrangement", ~line 113). Remove the `songs` prop from every
mount(ServicePrintLayout, { props: { ... } }) call (the component no longer declares it), and delete
the now-unused mockSongs fixture. Do not weaken any other assertion.
  </action>
  <verify>
    <automated>npx vitest run src/components/__tests__/ServicePrintLayout.test.ts src/views/__tests__/ShareView.test.ts</automated>
  </verify>
  <done>No BPM text or getBpmForSlot reference remains in ShareView.vue or ServicePrintLayout.vue; ServicePrintLayout no longer declares a `songs` prop and ServiceEditorView no longer passes one; the two named test files pass.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Render per-item notes on the share link and the print, for every slot kind</name>
  <files>src/components/ServicePrintLayout.vue, src/views/ShareView.vue, src/components/__tests__/ServicePrintLayout.test.ts, src/views/__tests__/ShareView.test.ts</files>
  <behavior>
    - A SONG slot carrying notes ("Sarah leads") renders those notes on BOTH the share link and the print.
    - A SCRIPTURE / PRAYER / HYMN slot carrying notes renders them on both surfaces.
    - A MESSAGE / ANNOUNCEMENTS / MISC slot renders its consolidated free-text (notes, falling back to legacy body) exactly once on each surface — notes wins when both are present; no double-render.
    - A slot with neither notes nor body renders no notes paragraph (no empty element, no placeholder).
    - Notes text is rendered auto-escaped (text interpolation / :value), never via v-html (T-quick-01).
  </behavior>
  <action>
Render the consolidated per-item free-text once per slot row, for ALL slot kinds, on both surfaces.
The consolidated value is `slot.notes ?? slot.body` (the same rule the editor's slotFreeText uses):
notes is the canonical per-item field on every kind; body is the legacy fallback that only
MESSAGE/ANNOUNCEMENTS/MISC can carry.

ServicePrintLayout.vue: add a small script helper `slotFreeText(slot: ServiceSlot): string |
undefined` returning `slot.notes ?? (slot as NonAssignableSlot).body` (add `NonAssignableSlot` and
`ServiceSlot` to the existing `@/types/service` import). In the template, INSIDE the per-row
`v-for` div but AFTER all the per-kind <template> blocks, add ONE notes paragraph guarded by
`v-if="slotFreeText(slot)?.trim()"` that renders `{{ slotFreeText(slot) }}` with class
"whitespace-pre-wrap text-gray-700 mt-1". Then DELETE the three now-redundant per-kind free-text
blocks that currently render `slot.notes ?? slot.body` inside the MESSAGE (~64-66), ANNOUNCEMENTS
(~72-74) and MISC (~80-82) templates — the new universal paragraph replaces all three. Keep the
MESSAGE sermonPassage line, the MISC miscLabel line, and every other structured per-kind element.

ShareView.vue: mirror the same. serviceSnapshot slots are `any`, so no helper/cast is needed —
inline the expression. INSIDE the per-row `v-for` div and AFTER all per-kind <template> blocks, add
ONE notes paragraph guarded by `v-if="(slot.notes ?? slot.body)?.trim()"` rendering
`{{ slot.notes ?? slot.body }}` with class "whitespace-pre-wrap text-sm text-gray-700 mt-1" (this
matches the class the existing body paragraphs use, so the ShareView newline-preservation test at
~line 290 still finds a single p.whitespace-pre-wrap). Then DELETE the per-kind body paragraphs that
currently render `slot.body` inside MESSAGE (~64), ANNOUNCEMENTS (~70) and MISC (~76). Keep the
MESSAGE sermonPassage line (~61-63) and the MISC miscLabel line (~75).

SECURITY (T-quick-01): the share link is public and unauthenticated. Notes/body are user-authored.
Render ONLY via `{{ }}` interpolation (auto-escaped) — never introduce v-html for this text.

Tests — extend, do not just rely on existing:
- ServicePrintLayout.test.ts: keep the existing notes-canonical tests (notes-only MESSAGE,
  notes-only ANNOUNCEMENTS, notes-wins-over-body MISC) — they must still pass through the new
  universal paragraph. ADD one test proving a SONG slot with `notes: 'Sarah leads'` renders that
  text (a kind that previously showed no notes).
- ShareView.test.ts: ADD a test proving a SONG slot snapshot with `notes` renders that text on the
  share view, and a test proving a MESSAGE/ANNOUNCEMENTS slot with `notes` set renders the notes
  (not just legacy body). The existing MISC-no-body test (~295-312, expects no p.whitespace-pre-wrap)
  and the MESSAGE body-newline test (~274-293) must still pass unchanged.
  </action>
  <verify>
    <automated>npx vitest run src/components/__tests__/ServicePrintLayout.test.ts src/views/__tests__/ShareView.test.ts</automated>
  </verify>
  <done>Both surfaces render the consolidated per-item free-text once per row for every slot kind; MESSAGE/ANNOUNCEMENTS/MISC show notes-over-body with no double-render; a slot with no notes/body shows no paragraph; new SONG-notes tests pass on both surfaces; no v-html is used for notes.</done>
</task>

<task type="auto">
  <name>Task 3: Verify Miscellaneous items still default to 0 slides (no re-implementation)</name>
  <files>src/utils/slideGroupMaterializer.ts, src/utils/__tests__/slideGroupMaterializer.test.ts</files>
  <action>
This behavior already shipped under R123 (Phase 54) and is covered by tests — CONFIRM it, do not
rebuild it. Read src/utils/slideGroupMaterializer.ts around lines 157-163: deriveGroupEntries's
`case 'MISC': return []` is the single source of "a new Miscellaneous item derives no slides", and
buildInitialGroup (same file) feeds that through for brand-new slots. Confirm no other creation path
seeds a default slide for MISC (rebuildGroup's MISC branch, ~lines 947-949, is a deliberate no-op
that only preserves legacy/hand-added slides on EXISTING groups).

Run the existing materializer suite and confirm the MISC cases pass (the "deriveGroupEntries — MISC
(R123)" block at test lines 378-391 asserts a MISC slot derives an empty array). If, and only if,
you find a real gap where a newly added MISC item gets a non-zero default slide count, fix it at the
deriveGroupEntries MISC branch and add a covering test — otherwise make NO code change and record
that the behavior is confirmed already correct.
  </action>
  <verify>
    <automated>npx vitest run src/utils/__tests__/slideGroupMaterializer.test.ts</automated>
  </verify>
  <done>The materializer suite passes and the MISC-derives-empty-array assertion is green; either no change was needed (behavior confirmed) or a found gap was fixed with a covering test.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| authored notes/body → public share link | slot.notes / slot.body is planner-authored text rendered on an UNAUTHENTICATED public URL (ShareView), so any stored value reaches arbitrary viewers. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-quick-01 | Tampering/Elevation (stored XSS) | ShareView.vue notes rendering | medium | mitigate | Render notes/body only through Vue text interpolation ({{ }}) / :value binding, which auto-escapes. Never introduce v-html for this text. Verified by inspection of the added paragraphs in Task 2. |
</threat_model>

<verification>
Overall phase gate (run after all three tasks):
- `npm run type-check` is clean (vue-tsc --build — per CLAUDE.md this also typechecks the test files; the narrower `-p tsconfig.app.json` form is NOT sufficient evidence).
- `npx vitest run` (bare — excludes src/rules.test.ts per CLAUDE.md) passes with no NEW failures beyond the documented known-failing baseline (src/storage.rules.test.ts and src/views/__tests__/RosterView.test.ts).
- Manual spot check (optional, not a gate): open a shared service link and the print preview — BPM is absent for songs; a song/scripture/misc item with notes shows those notes.
</verification>

<success_criteria>
- BPM is displayed nowhere on the share link or the print output; no getBpmForSlot / `songs` prop remains on ServicePrintLayout.
- Per-item notes (notes ?? legacy body) render exactly once per row on both surfaces, for every slot kind, with notes winning over body and no paragraph when both are empty.
- Notes are auto-escaped (no v-html) on the public share link.
- MISC-defaults-to-0-slides is confirmed still true (materializer suite green).
- `npm run type-check` clean; `npx vitest run` green except the documented baseline.
</success_criteria>

<output>
Quick task — no SUMMARY file required. On completion, report the changed files and the test/type-check results.
</output>
