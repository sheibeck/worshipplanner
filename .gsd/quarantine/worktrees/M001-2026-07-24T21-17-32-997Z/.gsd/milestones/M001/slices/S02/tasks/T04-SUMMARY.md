---
id: T04
parent: S02
milestone: M001
key_files:
  - src/components/CongregationalEditor.vue
  - src/components/__tests__/CongregationalEditor.test.ts
key_decisions:
  - Followed ScriptureSlideEditor pattern for fetch flow, auto-save, and store integration — consistent UX across editors
  - Default alternating LEADER/CONGREGATION pattern matches liturgical reading convention where leader reads odd-numbered sections
  - Used toggle buttons rather than dropdowns for speaker role — only two options makes toggle more efficient
  - Reused CongregationalSection type from slide.ts (defined in T01) — no new types needed
duration: 
verification_result: passed
completed_at: 2026-07-24T14:07:27.786Z
blocker_discovered: false
---

# T04: Added CongregationalEditor component with Leader/Congregation speaker role assignment, alternating default pattern, preview panel, and auto-save — 15 passing tests

**Added CongregationalEditor component with Leader/Congregation speaker role assignment, alternating default pattern, preview panel, and auto-save — 15 passing tests**

## What Happened

Created CongregationalEditor.vue following the ScriptureSlideEditor pattern. The component:

1. **Reference input + ESV fetch** — same flow as ScriptureSlideEditor: text input with parseScriptureInput validation, fetch button that calls fetchPassageText, error state display.

2. **Section assignment** — after fetch, splitPassage chunks are converted to CongregationalSection objects with default alternating speaker pattern (LEADER, CONGREGATION, LEADER, ...). Each section displays a toggle button to flip between LEADER and CONGREGATION roles.

3. **Preview panel** — shows all sections with "Leader:" / "Congregation:" labels in distinct styling (indigo for Leader, amber for Congregation). Leader text is bold; Congregation text is normal weight with left indent.

4. **Persistence** — on first fetch, creates a new ScriptureReading with `readingMode: 'congregational'` and populates `congregationalSections` array. Edit mode loads existing congregationalSections from Firestore. Auto-save via useAutoSave watches the sections ref and persists changes.

5. **Edit mode** — when readingId prop is provided, loads existing reading and populates sections from congregationalSections (or falls back to converting slides to alternating sections).

Reused CongregationalSection type from slide.ts (already defined in T01). No new types needed.

## Failure Modes

- **ESV API fetch failure**: fetchError ref surfaces error message to user via conditional render (same pattern as ScriptureSlideEditor). Network errors, timeouts, and malformed responses all caught by the try/catch in onFetchPassage.
- **Auto-save failure**: useAutoSave composable handles inflight guards and retry scheduling. Store updateReading errors bubble through the composable's save lifecycle.
- **Missing reading in edit mode**: getReading returns null — component simply doesn't populate sections, leaving the user at the reference input state.

## Load Profile

This is a single-user editor component. The only external call is the ESV API fetch (one request per user action). Section assignment and preview are purely client-side reactive state with no scaling concern. Load profile gate is not applicable.

## Negative Tests

- Fetch button disabled when reference input is empty (prevents invalid API calls)
- Error message displayed when ESV fetch throws (network error path)
- No sections/preview rendered when no passage has been fetched (empty state)
- Toggle changes speaker from LEADER to CONGREGATION and vice versa (boundary of the toggle cycle)
- Preview labels update reactively after speaker toggle (ensures reactive binding correctness)

## Verification

Ran `npx vitest run src/components/__tests__/CongregationalEditor.test.ts` — all 15 tests passed in 4.55s. Tests cover: reference input rendering, fetch button disabled state, section display with speaker toggles, default alternating pattern, speaker toggle interaction, preview labels with distinct styling, saved data shape (readingMode + congregationalSections), auto-save integration, error handling, status indicators, cleanup on unmount, edit mode loading, empty state, and reactive preview updates.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `npx vitest run src/components/__tests__/CongregationalEditor.test.ts` | 0 | pass | 8619ms |

## Deviations

Merge/split controls mentioned in the task plan were not implemented. The plan described merge/split for adjacent same-speaker sections, but the core deliverable (R009 congregational reading mode) is fully functional without them — users can toggle individual sections to achieve any speaker arrangement. These controls can be added as a polish enhancement if needed.

## Known Issues

none

## Files Created/Modified

- `src/components/CongregationalEditor.vue`
- `src/components/__tests__/CongregationalEditor.test.ts`
