---
phase: 6
slug: ai-assisted-service-suggesting-and-scripture-searching
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-04
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x (already installed) |
| **Config file** | `vite.config.ts` (test section, environment: jsdom) |
| **Quick run command** | `npx vitest run src/utils/__tests__/claudeApi.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/utils/__tests__/claudeApi.test.ts`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 6-01-01 | 01 | 1 | Type system | type-check | `npm run type-check` | ✅ | ⬜ pending |
| 6-01-02 | 01 | 1 | claudeApi utility | unit | `npx vitest run src/utils/__tests__/claudeApi.test.ts` | ❌ W0 | ⬜ pending |
| 6-02-01 | 02 | 2 | getSongSuggestions null on error | unit | `npx vitest run src/utils/__tests__/claudeApi.test.ts` | ❌ W0 | ⬜ pending |
| 6-02-02 | 02 | 2 | Song ID hallucination filtering | unit | `npx vitest run src/utils/__tests__/claudeApi.test.ts` | ❌ W0 | ⬜ pending |
| 6-03-01 | 03 | 2 | getScriptureSuggestions null on error | unit | `npx vitest run src/utils/__tests__/claudeApi.test.ts` | ❌ W0 | ⬜ pending |
| 6-03-02 | 03 | 2 | Invalid book name filtering | unit | `npx vitest run src/utils/__tests__/claudeApi.test.ts` | ❌ W0 | ⬜ pending |
| 6-03-03 | 03 | 2 | safeParseJsonArray handles prose | unit | `npx vitest run src/utils/__tests__/claudeApi.test.ts` | ❌ W0 | ⬜ pending |
| 6-04-01 | 04 | 3 | rankSongsForSlot unchanged | unit | `npx vitest run src/utils/__tests__/suggestions.test.ts` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/utils/__tests__/claudeApi.test.ts` — test stubs for all claudeApi.ts functions with mocked SDK
- [ ] `src/utils/claudeApi.ts` — utility file creation (tested by above)
- [ ] Framework install: none needed — Vitest already in devDependencies

*Existing infrastructure covers framework requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| AI Picks section renders in SongSlotPicker dropdown | Song suggestion UI | Requires live DOM + visual inspection | Open service editor, add sermon topic, click song slot picker, verify "AI Picks" section appears above rotation |
| "Suggest All Songs" fills empty slots inline | Bulk suggestion flow | Requires visual inspection of accept/reject UX | Click "Suggest All Songs" button, verify AI drafts appear with accept/reject actions |
| Scripture natural language search returns results | Scripture AI search | Requires live Claude API call | Enter "passages about forgiveness" in scripture search, verify 3-5 results with reasons |
| Loading shimmer displays correctly | Loading state | Visual only | Trigger AI call, verify shimmer placeholder appears on dark background |
| Error state shows retry link | Error handling | Requires simulated API failure | Remove API key, trigger AI, verify "Suggestions unavailable" with retry |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
