---
phase: 9
slug: pc-song-import-tag-management
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-11
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | PC song fetch | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | Song mapping | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | Upsert logic | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | Soft delete | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | Filter hidden | unit | `npx vitest run` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/utils/__tests__/pcSongImport.test.ts` — PC import mapping tests
- [ ] `src/stores/__tests__/songs.test.ts` — extend with soft-delete and filter tests

*Existing vitest infrastructure covers framework setup.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| PC import UI flow | Import modal | Requires PC credentials + live API | Click Import from PC, verify preview, confirm import |
| Hidden songs toggle | Soft delete UI | Visual verification | Delete song, verify hidden, toggle view, verify visible |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
