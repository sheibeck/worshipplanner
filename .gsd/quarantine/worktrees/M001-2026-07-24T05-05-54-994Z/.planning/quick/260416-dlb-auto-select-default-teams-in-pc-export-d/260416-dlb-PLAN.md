---
phase: quick-260416-dlb
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/views/ServiceEditorView.vue
autonomous: true
requirements:
  - QUICK-260416-DLB
must_haves:
  truths:
    - "When the PC export dialog opens, the 9 ALWAYS-pre-checked teams appear with checkboxes already checked (when present in the fetched PC teams list)"
    - "When the service has 'Choir' in localService.teams, the Choir PC team is also pre-checked"
    - "When the service has 'Orchestra' in localService.teams, the Orchestra PC team is also pre-checked (existing behavior preserved)"
    - "Teams not in the always-list and not on the service remain unchecked"
    - "Substring matching is case-insensitive (e.g., PC team 'worship vocals' matches default 'Worship Vocals')"
    - "When the user changes the service type and PC teams are re-fetched, the same defaulting logic applies"
  artifacts:
    - path: "src/views/ServiceEditorView.vue"
      provides: "Default-team pre-selection logic in dialog open + onServiceTypeChange paths"
      contains: "DEFAULT_PC_TEAM_NAMES"
    - path: "src/views/ServiceEditorView.vue"
      provides: "Helper that decides whether a fetched PC team should be pre-selected"
      contains: "shouldPreselectPcTeam"
  key_links:
    - from: "openExportDialog()"
      to: "selectedPcTeamIds.value initialization"
      via: "shouldPreselectPcTeam helper consuming pcTeams + localService.teams"
      pattern: "shouldPreselectPcTeam"
    - from: "onServiceTypeChange()"
      to: "selectedPcTeamIds.value initialization"
      via: "same shouldPreselectPcTeam helper"
      pattern: "shouldPreselectPcTeam"
---

<objective>
Pre-check default Planning Center teams in the PC export dialog so the user does not have to click 9+ checkboxes every time. Mirror the existing Orchestra conditional pattern for Choir.

Purpose: Reduce repetitive clicks during the weekly export workflow. The same set of teams is selected nearly every Sunday; the few exceptions (Choir, Orchestra) are already encoded in `localService.teams`.

Output: Modified `src/views/ServiceEditorView.vue` with a single shared pre-selection helper used in both the dialog-open and service-type-change paths.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@.planning/STATE.md
@src/views/ServiceEditorView.vue

<interfaces>
<!-- Existing state and functions in ServiceEditorView.vue that this plan touches. -->

```ts
// Local state (around line 914)
const pcTeams = ref<Array<{ id: string; name: string }>>([])
const selectedPcTeamIds = ref<string[]>([])

// localService.teams shape — string[] containing values from AVAILABLE_TEAMS:
//   const AVAILABLE_TEAMS = ['Choir', 'Orchestra', 'Communion', 'Special']
// (line 871) — these are the conditional team flags toggled in the service editor.

// Two functions both initialize selectedPcTeamIds after fetching pcTeams:
//   openExportDialog()         — line ~1530
//   onServiceTypeChange()      — line ~1582

// Current pre-selection logic (DUPLICATED in both functions, lines 1562-1568 and 1597-1603):
selectedPcTeamIds.value = pcTeams.value
  .filter((pcTeam) =>
    (localService.value?.teams ?? []).some(
      (svcTeam) => svcTeam.toLowerCase() === pcTeam.name.toLowerCase(),
    ),
  )
  .map((t) => t.id)
```

This existing logic ONLY pre-selects PC teams whose names exactly equal one of the conditional flags on `localService.teams` (Choir/Orchestra/Communion/Special). It does NOT pre-select the workhorse teams (Vocals/Band/Sound/Projection/etc.).

The plan replaces both copies with a single helper that pre-selects when EITHER:
  (a) the PC team name contains (case-insensitive substring) any of the always-list entries, OR
  (b) the PC team name matches a value in `localService.teams` (existing conditional behavior — covers Choir, Orchestra, Communion, Special).
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Add default-team constant and shared shouldPreselectPcTeam helper</name>
  <files>src/views/ServiceEditorView.vue</files>
  <behavior>
    - DEFAULT_PC_TEAM_NAMES array contains the 9 always-pre-check substrings, exactly as specified:
      ["Preacher and Deacon and other Leaders", "Scripture Reading", "Worship Vocals",
       "Worship Band", "Pray-er", "Sanctuary Sound", "Livestream Sound", "Projection",
       "Livestream Camera"]
    - shouldPreselectPcTeam(pcTeamName, serviceTeams) returns true if:
        a) pcTeamName.toLowerCase() contains any DEFAULT_PC_TEAM_NAMES entry .toLowerCase() as a substring, OR
        b) any serviceTeams entry .toLowerCase() === pcTeamName.toLowerCase() (preserves existing Orchestra/Choir/Communion/Special conditional pattern)
    - Helper is pure — no Vue reactivity inside, takes plain inputs, returns boolean
  </behavior>
  <action>
    1. Open `src/views/ServiceEditorView.vue`.
    2. Locate the `// ── Constants ──` block (around line 869, just above `const AVAILABLE_TEAMS`).
    3. Add a new constant immediately AFTER the existing `AVAILABLE_TEAMS` line:
       ```ts
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
       ```
    4. Add a pure helper function near the other small helpers in the script section
       (search for an appropriate spot — near top of `<script setup>` after the constants
       but before the reactive state, OR co-located right above `openExportDialog`):
       ```ts
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
       ```
    5. Do NOT touch `selectedPcTeamIds` or the two call sites yet — that is Task 2.
    6. Save and run the type checker to make sure the new symbols compile.
  </action>
  <verify>
    <automated>cd C:/projects/worshipplanner && npx vue-tsc --noEmit</automated>
  </verify>
  <done>
    `DEFAULT_PC_TEAM_NAMES` and `shouldPreselectPcTeam` exist in `ServiceEditorView.vue`,
    file type-checks cleanly, no other behavior changed yet (`selectedPcTeamIds` initializer
    in both functions still uses the old logic — Task 2 swaps it).
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Wire shouldPreselectPcTeam into both pcTeams initialization paths</name>
  <files>src/views/ServiceEditorView.vue</files>
  <behavior>
    - In `openExportDialog()` (~line 1561): after `pcTeams.value = await fetchServiceTypeTeams(...)`,
      `selectedPcTeamIds.value` is computed via `shouldPreselectPcTeam(team.name, localService.value?.teams ?? [])`.
    - In `onServiceTypeChange()` (~line 1596): same replacement.
    - Failure branches (the `} catch {}` blocks) still reset both `pcTeams` and `selectedPcTeamIds` to `[]` — unchanged.
    - When PC returns a team named "worship vocals" (lowercase), it is pre-selected (case-insensitive).
    - When PC returns a team named "Choir" AND the service has Choir in its teams array, it is pre-selected.
    - When PC returns a team named "Choir" AND the service does NOT have Choir, it is NOT pre-selected (conditional behavior).
    - When PC returns a team named "Some Random Team" not in defaults and not on service, it is NOT pre-selected.
  </behavior>
  <action>
    1. In `src/views/ServiceEditorView.vue`, locate `openExportDialog()` (around line 1530).
    2. Find the block (around line 1561-1568):
       ```ts
       pcTeams.value = await fetchServiceTypeTeams(appId, secret, exportSelectedServiceTypeId.value)
       selectedPcTeamIds.value = pcTeams.value
         .filter((pcTeam) =>
           (localService.value?.teams ?? []).some(
             (svcTeam) => svcTeam.toLowerCase() === pcTeam.name.toLowerCase(),
           ),
         )
         .map((t) => t.id)
       ```
       Replace the `selectedPcTeamIds.value = ...` assignment with:
       ```ts
       selectedPcTeamIds.value = pcTeams.value
         .filter((pcTeam) => shouldPreselectPcTeam(pcTeam.name, localService.value?.teams ?? []))
         .map((t) => t.id)
       ```
       (Keep the `pcTeams.value = await fetchServiceTypeTeams(...)` line and the `} catch {` block exactly as they are.)
    3. Locate `onServiceTypeChange()` (around line 1582). Find the equivalent block (around line 1596-1603) and apply the IDENTICAL replacement.
    4. Do not touch the `} catch {` blocks (lines ~1569-1573 and ~1604-1607) — the `pcTeams.value = []; selectedPcTeamIds.value = []` resets are correct.
    5. Do not touch `openExportDialog`'s early reset at line ~1538-1539 (`pcTeams.value = []; selectedPcTeamIds.value = []`) or the equivalent at line ~1589-1590 — those are pre-fetch state clears and stay.
    6. Run type-check, then a quick search to confirm only TWO call sites of `shouldPreselectPcTeam` exist and the old `.some((svcTeam) => svcTeam.toLowerCase() === pcTeam.name.toLowerCase())` substring no longer appears in this file.
  </action>
  <verify>
    <automated>cd C:/projects/worshipplanner && npx vue-tsc --noEmit && node -e "const fs=require('fs');const s=fs.readFileSync('src/views/ServiceEditorView.vue','utf8');const calls=(s.match(/shouldPreselectPcTeam\(/g)||[]).length;const oldPattern=s.includes('svcTeam.toLowerCase() === pcTeam.name.toLowerCase()');if(calls!==3){console.error('Expected 3 occurrences of shouldPreselectPcTeam (1 def + 2 call sites), found '+calls);process.exit(1)}if(oldPattern){console.error('Old inline matching pattern still present — should have been replaced');process.exit(1)}console.log('OK: 2 call sites wired, old pattern removed')"</automated>
  </verify>
  <done>
    Both `openExportDialog` and `onServiceTypeChange` use `shouldPreselectPcTeam`. The
    inline duplicated `.some((svcTeam) => svcTeam.toLowerCase() === pcTeam.name.toLowerCase())`
    matcher is gone. Type-check passes. Catch blocks still reset state to `[]`.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: Human verification against real PC account</name>
  <what-built>
    `DEFAULT_PC_TEAM_NAMES` constant + `shouldPreselectPcTeam` helper in `ServiceEditorView.vue`,
    wired into both PC team fetch paths so the 9 always-teams plus matching Choir/Orchestra
    are pre-checked when the export dialog opens.
  </what-built>
  <how-to-verify>
    1. Run the dev server: `cd C:/projects/worshipplanner && npm run dev`
    2. Open a service WITHOUT Choir or Orchestra in its teams. Click "Export to PC".
       - EXPECTED: The 9 default teams (Preacher and Deacon..., Scripture Reading,
         Worship Vocals, Worship Band, Pray-er, Sanctuary Sound, Livestream Sound,
         Projection, Livestream Camera) are pre-checked.
       - EXPECTED: Choir and Orchestra are NOT checked.
    3. Cancel the dialog. Edit the service and toggle Choir on. Click "Export to PC" again.
       - EXPECTED: All 9 defaults still pre-checked, AND Choir is now also pre-checked.
       - EXPECTED: Orchestra still NOT checked.
    4. Cancel. Toggle Orchestra on (in addition to Choir). Open Export to PC.
       - EXPECTED: 9 defaults + Choir + Orchestra all pre-checked.
    5. With dialog open, change the service type dropdown to a different service type.
       - EXPECTED: Pre-selection logic re-runs — same defaults pre-checked in the new list.
    6. Confirm none of the previously unchecked-by-default teams (e.g. "Special",
       random custom PC teams) are pre-checked unless the service has them flagged.
  </how-to-verify>
  <resume-signal>Type "approved" or describe what was wrong</resume-signal>
</task>

</tasks>

<verification>
  - `npx vue-tsc --noEmit` clean
  - The static check in Task 2's verify confirms exactly 2 call sites of `shouldPreselectPcTeam` (plus its definition = 3 occurrences) and the old inline matcher is gone
  - Human verification confirms all 9 default teams pre-check, Choir conditional works, Orchestra conditional preserved
</verification>

<success_criteria>
  - 9 listed teams pre-checked by default whenever the PC export dialog opens (case-insensitive substring match)
  - Choir pre-checked only when service has Choir in `localService.teams` (mirrors Orchestra)
  - Orchestra pre-checking unchanged from before this plan
  - Logic shared between dialog-open and service-type-change paths via single helper (no duplicated matching code)
  - Type-check passes
  - Human verification approved
</success_criteria>

<output>
After completion, create `.planning/quick/260416-dlb-auto-select-default-teams-in-pc-export-d/260416-dlb-SUMMARY.md` documenting:
  - The two new symbols (`DEFAULT_PC_TEAM_NAMES`, `shouldPreselectPcTeam`)
  - That the matching is case-insensitive substring (so "Worship Vocals" matches "worship vocals (acoustic)" too — note this as a future-edge case if PC names diverge significantly)
  - Confirmation that Orchestra conditional behavior is unchanged
</output>
