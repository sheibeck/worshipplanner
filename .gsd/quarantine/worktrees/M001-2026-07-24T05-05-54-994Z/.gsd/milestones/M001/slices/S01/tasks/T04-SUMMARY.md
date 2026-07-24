---
id: T04
parent: S01
milestone: M001
key_files:
  - src/components/LyricPasteDialog.vue
  - src/components/__tests__/LyricPasteDialog.test.ts
key_decisions:
  - Reused existing implementation that fully matched task plan — no modifications needed
duration: 
verification_result: passed
completed_at: 2026-07-24T04:33:21.404Z
blocker_discovered: false
---

# T04: Lyric Paste Dialog with live CCLI preview, confirm/discard guards, and store integration — 12 passing tests

**Lyric Paste Dialog with live CCLI preview, confirm/discard guards, and store integration — 12 passing tests**

## What Happened

## What Happened

Both `LyricPasteDialog.vue` and its test file already existed from a prior session with full implementations matching the task plan. Verified the implementation covers all plan requirements:

- **Modal dialog** via Teleport to body with backdrop click-to-close, matching SongSlideOver pattern
- **Props**: `open` (boolean), `songId` (string), `orgId` (string); emits `close` and `saved`
- **Layout**: textarea (left/top) with live parsed preview (right/bottom), responsive stacking via `flex-col md:flex-row`
- **Live preview**: reactively parses via `parseCCLIPaste()` — shows title, sections with labels, copyright info
- **Zero-sections warning**: "No sections detected — check that you copied the full lyrics from SongSelect"
- **Confirm flow**: calls `songLyricsStore.saveLyrics()` with parsed sections/copyright/performanceOrder, then `songStore.updateSong()` to set default performance order on the song doc, then emits `saved`
- **Cancel flow**: `window.confirm()` discard guard when textarea has content
- **Dark-first styling**: bg-gray-900 modal, bg-gray-800 textarea, gray-100 text, indigo accent buttons
- **State reset**: textarea clears when dialog reopens via `watch(props.open)`

## Verification

Ran `npx vitest run src/components/__tests__/LyricPasteDialog.test.ts --reporter=verbose` — all 12 tests pass (exit 0, 51s including environment setup).

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | npx vitest run src/components/__tests__/LyricPasteDialog.test.ts --reporter=verbose | 0 | pass | 51168ms |

## Failure Modes

This is a pure client-side UI component. External dependencies:
- **songLyricsStore.saveLyrics()** — Firestore write. On failure, the `try/finally` block resets `isSaving` so the button re-enables; the error propagates to the console. No user-facing error toast yet (deferred to integration slice).
- **songStore.updateSong()** — Firestore write. Same pattern; if it fails after saveLyrics succeeds, lyrics are saved but performanceOrder on the song doc is stale. Acceptable for initial slice — the performance order builder (T06) will allow manual correction.

## Load Profile

No runtime load dimension — this is a single-user modal dialog that fires one Firestore write on confirm. No pagination, pooling, or rate-limiting needed.

## Negative Tests

- `disables confirm when textarea is empty` — empty input cannot trigger save
- `shows warning when paste has no sections` — malformed input without section markers shows guidance message
- `prompts discard on cancel when textarea has content` — prevents accidental data loss
- `emits close on cancel when textarea is empty` — no spurious discard prompt on clean cancel
- `resets textarea when reopened` — stale content doesn't persist across dialog open/close cycles

## Diagnostics

No runtime observability surfaces — pure UI component. Inspect via Vue DevTools: component state (`rawText`, `parsed`, `isSaving`, `canConfirm`).

## Deviations

None — implementation matched plan exactly.

## Known Issues

None.

## Files Created/Modified

- `src/components/LyricPasteDialog.vue` — modal paste dialog with live CCLI preview and store integration
- `src/components/__tests__/LyricPasteDialog.test.ts` — 12 tests covering preview, confirm, cancel, discard guard, and reset

## Verification

Ran vitest on LyricPasteDialog.test.ts — all 12 tests pass (renders nothing when closed, renders textarea and confirm button when open, disables confirm when empty, shows parsed preview, enables confirm when sections parsed, shows copyright info, shows warning for no sections, calls saveLyrics and updateSong on confirm, emits saved after confirm, prompts discard on cancel with content, emits close on cancel when empty, resets textarea when reopened).

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `npx vitest run src/components/__tests__/LyricPasteDialog.test.ts --reporter=verbose` | 0 | pass | 51168ms |

## Deviations

None

## Known Issues

None

## Files Created/Modified

- `src/components/LyricPasteDialog.vue`
- `src/components/__tests__/LyricPasteDialog.test.ts`
