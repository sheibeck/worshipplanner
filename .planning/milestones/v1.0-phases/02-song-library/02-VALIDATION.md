---
phase: 2
slug: song-library
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-03
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.0.18 |
| **Config file** | `vite.config.ts` (test block) |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run --reporter=verbose`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 2-01-01 | 01 | 0 | SONG-01 | unit | `npx vitest run src/stores/__tests__/songs.test.ts -t "csv"` | ❌ W0 | ⬜ pending |
| 2-01-02 | 01 | 0 | SONG-01 | unit | `npx vitest run src/stores/__tests__/songs.test.ts -t "duplicate"` | ❌ W0 | ⬜ pending |
| 2-01-03 | 01 | 0 | SONG-01 | unit | `npx vitest run src/stores/__tests__/songs.test.ts -t "batch"` | ❌ W0 | ⬜ pending |
| 2-01-04 | 01 | 0 | SONG-02 | unit | `npx vitest run src/stores/__tests__/songs.test.ts -t "addSong"` | ❌ W0 | ⬜ pending |
| 2-01-05 | 01 | 0 | SONG-02 | unit | `npx vitest run src/stores/__tests__/songs.test.ts -t "deleteSong"` | ❌ W0 | ⬜ pending |
| 2-01-06 | 01 | 0 | SONG-03 | unit | `npx vitest run src/stores/__tests__/songs.test.ts -t "filter"` | ❌ W0 | ⬜ pending |
| 2-01-07 | 01 | 0 | SONG-03 | unit | `npx vitest run src/stores/__tests__/songs.test.ts -t "vwType filter"` | ❌ W0 | ⬜ pending |
| 2-01-08 | 01 | 0 | SONG-04 | unit | `npx vitest run src/stores/__tests__/songs.test.ts -t "arrangement"` | ❌ W0 | ⬜ pending |
| 2-01-09 | 01 | 0 | SONG-05 | unit | `npx vitest run src/components/__tests__/SongBadge.test.ts` | ❌ W0 | ⬜ pending |
| 2-01-10 | 01 | 0 | SONG-06 | unit | `npx vitest run src/stores/__tests__/songs.test.ts -t "teamTags"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/stores/__tests__/songs.test.ts` — stubs for SONG-01 through SONG-04, SONG-06 (mock Firestore + PapaParse)
- [ ] `src/components/__tests__/SongBadge.test.ts` — covers SONG-05 badge rendering
- [ ] `src/components/__tests__/CsvImportModal.test.ts` — covers SONG-01 column mapping and duplicate detection logic

*Existing infrastructure covers test framework (Vitest already configured in Phase 1).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Slide-over panel opens from right, song list visible behind | SONG-02 | Visual layout/z-index behavior | Click song row, verify panel slides in from right, list scrollable behind |
| CSV file picker opens OS dialog | SONG-01 | Browser file API / OS integration | Click "Import Songs", verify file dialog opens |
| Empty state renders correctly | SONG-03 | Visual layout check | Delete all songs, verify centered message with import button |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
