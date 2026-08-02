---
phase: 32
slug: save-reliability-autosave-fix-persistent-status
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-02
---

# Phase 32 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded from `32-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.0.18 + @vue/test-utils 2.4.6 |
| **Config file** | `vite.config.ts` (app suite — **excludes `src/rules.test.ts`**) |
| **Quick run command** | `npx vitest run src/views/__tests__/ServiceEditorView.test.ts src/composables/__tests__/useAutoSave.test.ts` |
| **Full suite command** | `npx vitest run src/` |
| **Type gate** | `npm run type-check` (**`vue-tsc --build`** — NOT `-p tsconfig.app.json`, which silently skips test files; see CLAUDE.md) |
| **Estimated runtime** | ~15s quick · ~90s full |

**No `firestore.rules` change is in scope**, so `npm run test:rules` is not a gate for this phase.

---

## Sampling Rate

- **After every task commit:** `npx vitest run <changed-test-file>`
- **After every plan wave:** `npx vitest run src/` **and** `npm run type-check`
- **Before `/gsd-verify-work`:** full suite green against a **freshly measured** baseline
- **Max feedback latency:** ~15 seconds (targeted run)

> ⚠ **Re-measure the failing baseline at phase-gate time.** STATE.md's "10-file baseline" predates the
> 2026-07-29 deletion of `.gsd/`, which removed 8 of those files. The current expected baseline is
> `src/storage.rules.test.ts` (needs the Storage emulator) and `src/views/__tests__/RosterView.test.ts`
> (stale assertion) — confirm rather than assume.

---

## Per-Task Verification Map

> Task IDs are assigned by the planner; this table is seeded by requirement and will be
> re-keyed to real task IDs during planning. Threat Ref is `—` throughout: this phase has no
> `<threat_model>` entries (no new attack surface — no rules change, no new network endpoint,
> no user-supplied text reaches any new sink).

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | 01 | 0 | R039 | — | N/A | unit/component | `npx vitest run src/views/__tests__/ServiceEditorView.test.ts -t "R039"` | ❌ W0 | ⬜ pending |
| TBD | 01 | 0 | R039 (reorder path) | — | N/A | unit/component | `npx vitest run src/views/__tests__/ServiceEditorView.test.ts -t "R039"` | ❌ W0 | ⬜ pending |
| TBD | 01 | — | R039 (no regression) | — | N/A | unit/component | `npx vitest run src/views/__tests__/ServiceEditorView.test.ts -t "remote-merge"` · `-t "BL-02"` | ✅ exists | ⬜ pending |
| TBD | 02 | 0 | R040 (`useAutoSave` error + no fade) | — | N/A | unit | `npx vitest run src/composables/__tests__/useAutoSave.test.ts` | ✅ exists, needs update | ⬜ pending |
| TBD | 02 | 0 | R040 (`useSaveStatus` store) | — | N/A | unit | `npx vitest run src/stores/__tests__/saveStatus.test.ts` | ❌ W0 | ⬜ pending |
| TBD | 03 | 0 | R040 (`SaveStatusIndicator.vue`) | — | N/A | component | `npx vitest run src/components/__tests__/SaveStatusIndicator.test.ts` | ❌ W0 | ⬜ pending |
| TBD | 04 | — | R040 (migration preserves behavior) | — | N/A | component | `npx vitest run src/views/__tests__/ServiceEditorView.test.ts` | ✅ exists | ⬜ pending |
| TBD | 05 | 0 | R041 (toast edge-trigger only) | — | N/A | unit | `npx vitest run src/stores/__tests__/toasts.test.ts` | ❌ W0 | ⬜ pending |
| TBD | 05 | 0 | R041 (`ToastHost.vue` contract) | — | N/A | component | `npx vitest run src/components/__tests__/ToastHost.test.ts` | ❌ W0 | ⬜ pending |
| TBD | 05 | — | R041 (toast mirrors inline text) | — | N/A | component | `npx vitest run src/components/__tests__/ToastHost.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] **The R039 repro test** — new describe block in `src/views/__tests__/ServiceEditorView.test.ts`.
      **This is the phase's mandated first commit** (R039: "a failing repro test must be written before
      any fix"). It must go RED before any fix lands, then GREEN after.
      ★ Research Pitfall 2: the existing `mockTimestamp` fixture has no enumerable fields and would
      silently produce a false-negative repro — the test must use a timestamp fixture that actually
      differs across emissions, or it will pass for the wrong reason.
- [ ] `src/stores/__tests__/saveStatus.test.ts` — new store, no existing coverage
- [ ] `src/stores/__tests__/toasts.test.ts` — new store, no existing coverage
- [ ] `src/components/__tests__/SaveStatusIndicator.test.ts` — new component
- [ ] `src/components/__tests__/ToastHost.test.ts` — new component
- [ ] `src/composables/__tests__/useAutoSave.test.ts` — **modify**, do not delete, the two fade-timer
      tests (Research Pitfall 5), and add the error-path test

*Framework install: not required — Vitest and @vue/test-utils are already configured.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| The repro reproduces against the **live** app, not only in jsdom | R039 | The root cause involves real Firestore `serverTimestamp()` resolution (null in the optimistic snapshot, then a real value on server ack) and real `onSnapshot` emission timing. jsdom simulates this; it does not prove it. | With `VITE_USE_EMULATORS=true` and the emulator running: open a draft service, edit a field so a save fires, wait for the echo, then immediately pick a song on a slot. Expect the pick to save. Before the fix, expect it not to. |
| `Saved HH:MM` persists rather than fading | R040 | The removed 3-second fade is a wall-clock behaviour; a fake-timer test proves the timer is gone but not that the rendered text stays put through a real idle period. | Make one edit, wait ≥10 real seconds without touching anything, confirm `Saved h:mm` is still on screen. |
| Sticky status bar stays visible while scrolling a long Service Order | R040 | "Visible without scrolling" is a layout property of a real viewport with real content height. | Open a service with enough items to scroll, scroll to the bottom, confirm the status bar is still pinned at the top of the editing surface. |
| Screen-reader announcement politeness | R041 | `aria-live="polite"` vs `role="alert"` behaviour is only observable in a real AT. | With a screen reader active: make an edit (routine save must not interrupt), then force a save failure (must interrupt). |
| Narrow-viewport toast and status-bar rendering | R040/R041 | Responsive breakpoints below `sm:` are not exercised by jsdom's fixed viewport. | Resize below 640px; confirm the toast is full-width minus 16px margins and the status text wraps rather than clipping. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
