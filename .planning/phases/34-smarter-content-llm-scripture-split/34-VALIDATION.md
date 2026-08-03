---
phase: 34
slug: smarter-content-llm-scripture-split
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-03
---

# Phase 34 — Validation Strategy

> Seeded from `34-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest + `@vue/test-utils` (already project dependencies — no install) |
| **Config file** | `vite.config.ts` (inline test config; no separate `vitest.config.ts` for the app suite) |
| **Quick run** | `npx vitest run src/utils/__tests__/scriptureBoundaries.test.ts src/utils/__tests__/claudeApi.test.ts src/components/__tests__/CongregationalEditor.test.ts` |
| **Full suite** | `npx vitest run src/` |
| **Type gate** | `npm run type-check` (**`vue-tsc --build`** — the `-p tsconfig.app.json` form silently skips test files and is NOT sufficient) |

**Baseline that is NOT a defect:** `src/storage.rules.test.ts` + `src/views/__tests__/RosterView.test.ts` = 9 tests / 2 files.

**`npm run test:rules` is NOT a gate** — no `firestore.rules` change is in scope.

---

## Sampling Rate

- **Per task commit:** the quick-run command above
- **Per wave merge:** `npx vitest run src/` **and** `npm run type-check`
- **Phase gate:** full suite green against the 2-file baseline, plus `npm run build`

---

## Per-Task Verification Map

> Threat Ref is `—` throughout, with one substantive note: this phase's *entire* security posture is
> the byte-match/bounds validation. There is no new endpoint and no new secret — the existing proxy
> and ESV path are untouched. The "threat" being mitigated is **the model altering scripture**, and
> the mitigation is structural (see below), not a rules or auth change.

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| TBD | — | 0 | R064 boundary computation | unit | `npx vitest run src/utils/__tests__/scriptureBoundaries.test.ts` | ❌ W0 | ⬜ pending |
| TBD | — | 0 | R064 marker embed + round-trip | unit | same file | ❌ W0 | ⬜ pending |
| TBD | — | 0 | R064 `validateSplitResult()` — every failure mode | unit | `npx vitest run src/utils/__tests__/claudeApi.test.ts` | ❌ W0 (extend) | ⬜ pending |
| TBD | — | 0 | R064 SDK call shape (model id, `output_config.format`, **no** `thinking`/`effort`) | unit | same file | ❌ W0 (extend) | ⬜ pending |
| TBD | — | 0 | R064 failure → `null` + toast, `sections.value` unmutated | unit + component | `npx vitest run src/components/__tests__/CongregationalEditor.test.ts` | ❌ W0 (extend) | ⬜ pending |
| TBD | — | — | R064 manual flow unaffected (regression) | component | same file | ✅ exists — must pass **unmodified** | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/utils/__tests__/scriptureBoundaries.test.ts` — new. Boundary computation and marker
      embedding, including a **Psalm-136-shaped fixture** (repeated semicolon-joined refrain) since
      that is the archetypal responsive reading and the shape most likely to expose a boundary bug.
- [ ] Extend `src/utils/__tests__/claudeApi.test.ts` — `validateSplitResult()` must be tested against
      **each individual failure mode**, not just a happy path: out-of-range index, non-integer index,
      overlapping sections, gap between sections, doesn't start at 0, doesn't end at max, wrong
      speaker enum, empty sections array.
      ★ **This is the phase's core guarantee.** R064's whole claim is that altered scripture is
      *structurally impossible*. A validation function with only a happy-path test does not establish
      that, and would be the single most misleading form of green in this phase.
- [ ] Extend `src/components/__tests__/CongregationalEditor.test.ts` — affordance wiring, the
      failure-toast path, and the manual-flow regression.
- [ ] **Spike (flagged by research, not a design question):** confirm whether `messages.parse()`
      needs a different Vitest mock shape than the existing `messages.create` mock. Resolve before
      writing the call-shape tests.

*Framework install: none required.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| **Split quality and determinism on real passages** | R064 | Requires a live Anthropic API call with real credentials. **No live API access in this session**, and simulating it with a fixture would give false confidence about *model* behaviour — which is precisely what is being checked. The ROADMAP asks for this explicitly ("validate Haiku split determinism empirically against real passages"). | Run the split on **Psalm 136** (repeated congregational refrain — the archetypal case) and **Psalm 24** (natural call-and-response). For each: run it **more than once** and compare. Confirm (a) every section's text matches the ESV source exactly, (b) no split falls mid-sentence, (c) the LEADER/CONGREGATION assignment is sensible, and (d) repeated runs on the same passage give a stable result. A split that validates but varies run-to-run is a usability problem, not a correctness one — note it either way. |
| The AI affordance never blocks the manual path | R064 | "Additive and never blocking" is a judgment about real interaction. | With the network off (or the API key invalid), open the congregational editor, attempt an AI split, confirm the failure is announced via toast, and confirm you can still build the reading entirely by hand exactly as before. |
| A failed split never partially applies | R064 | Depends on real API failure timing. | Force a mid-call failure; confirm `sections` is unchanged — not half-populated. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
