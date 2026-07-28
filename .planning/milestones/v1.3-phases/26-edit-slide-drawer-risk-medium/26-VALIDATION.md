---
phase: 26
slug: edit-slide-drawer
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-26
---

# Phase 26 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest + `@vue/test-utils` (already project dependencies — no install) |
| **Config file** | `vitest.config.ts`. `vitest.rules.config.ts` is the emulator-only rules config and is NOT used here. |
| **Quick run command** | `npx vitest run src/components/slides/__tests__/<Component>.test.ts` |
| **Full suite command** | `npx vitest run src/` |
| **Estimated runtime** | ~130s full suite |

> **Do NOT run `npm run test:rules`** and do not restart the Firebase emulator — a live user session
> may hold ports 8080/9199.

---

## Sampling Rate

- **After every task commit:** the affected component's quick-run command.
- **After every plan wave:** `npx vitest run src/`. This phase touches `SlidesTab.vue` and `SlideGrid.vue`,
  so Phase 25's whole `src/components/slides/` suite must stay green.
- **Before phase close:** full suite against the known baseline; `npm run type-check` = 0; `npm run build` succeeds.

### Known-failing baseline (do NOT try to fix in this phase)

`npx vitest run src/` fails in exactly **10 files**: 8 under `.gsd/quarantine/worktrees/**` (stale
duplicates — never run or fix), `src/storage.rules.test.ts` (needs the Storage emulator), and
`src/views/__tests__/RosterView.test.ts` (stale `"Roles config"` assertion). The failing **test count
flaps** run-to-run from the quarantined `rules.test.ts` copies. **Judge against the FILE SET, which
must not grow past 10.**

---

## Per-Requirement Verification Map

| Req / Decision | Behavior | Test Type | Automated Command | File |
|---|---|---|---|---|
| R033 / D-01 | Drawer is a fixed overlay; nothing underneath reflows; grid remains interactive (no scrim, D-03) | unit | `npx vitest run src/components/slides/__tests__/EditSlideDrawer.test.ts` | ❌ Wave 0 |
| D-03 | Drawer FOLLOWS selection — clicking another card swaps its contents, does not close it | unit | same, `-t "follows selection"` | ❌ Wave 0 |
| D-02 | Label / notes / audio scope / loop live-apply through the store, not a staged buffer | unit | same, `-t "live-apply"` | ❌ Wave 0 |
| **Seam** | Drawer resolves the selected entry via `selectedGroup.slides.find(e => e.id === selectedSlideId)` — `AssembledSlide.slide.id` equals `GroupSlideEntry.id` for a materialized group | unit | same, `-t "entry resolution"` | ❌ Wave 0 |
| **CAS** | Every write passes a **freshly-read** `baseSlides` — NOT one captured when the drawer opened (research Pitfall 2) | unit | `npx vitest run src/stores/__tests__/slideGroups.test.ts -t "compare-and-swap"` | ✅ extend |
| D-04 | `Duplicate` mints a new entry id that neither collides nor breaks reconciliation's by-`sectionId` matching | unit | `npx vitest run src/components/slides/__tests__/EditSlideDrawer.test.ts -t "duplicate"` | ❌ Wave 0 |
| D-12 | A **video** slide renders NO audio control at all | unit | same, `-t "video"` | ❌ Wave 0 |
| D-09/D-10/D-11 | "All slides in this group" writes the group bed; "This slide only" writes the entry; slide beats bed; loop is per-slide only | unit | same, `-t "audio scope"` | ❌ Wave 0 |
| D-15 | Per-kind affordance keyed on `sourceRef.kind` (NOT `contentKind` — PPTX text and image share `imported`) | unit | same, `-t "per-kind"` | ❌ Wave 0 |
| D-16 | Confirm before navigating away with unsaved edits | unit | same, `-t "unsaved"` | ❌ Wave 0 |
| R029 / D-05..D-08 | Reconciliation modal: **no diff view**, `Apply source changes` / `Dismiss`, copy names counts and kinds | unit | `npx vitest run src/components/slides/__tests__/ReconcileConfirmModal.test.ts` | ❌ Wave 0 |
| **D-07 durability** | `Dismiss` persists so the SAME unchanged signature does not re-prompt on reload, but a NEW divergence DOES re-prompt | unit | `npx vitest run src/stores/__tests__/slideGroups.test.ts -t "dismiss"` | ✅ extend |
| D-08 | Song-identity-swap copy names the OLD and the NEW song — requires the `PendingReconciliation` shape gap to be closed first | unit | `npx vitest run src/components/slides/__tests__/ReconcileConfirmModal.test.ts -t "song swap"` | ❌ Wave 0 |
| D-18 guard | Group bed remains audio-only: `git grep -n "bedVideoUrl" src/` returns nothing | grep | — | ✅ |

---

## Wave 0 Requirements

- [ ] `src/components/slides/__tests__/EditSlideDrawer.test.ts` — drawer behavior, per-kind shape, audio scope, duplicate/delete, unsaved-edit confirm
- [ ] `src/components/slides/__tests__/ReconcileConfirmModal.test.ts` — modal copy, two actions, song-swap variant
- [ ] Extend `src/stores/__tests__/slideGroups.test.ts` — durable dismissal + CAS-on-every-write
- [ ] Extend `src/components/slides/__tests__/SlideGrid.test.ts` / `SlidesTab.test.ts` — drawer mount and banner→modal launch

**Framework install:** none.

### Test-harness gotchas (have bitten this codebase repeatedly)

- Slide-overs/modals teleport to `<body>` → assert via `DOMWrapper` over `document.body`, plus `enableAutoUnmount(afterEach)`.
- `shallowMount` **auto-stubs `<Teleport>`** → needs `stubs: { teleport: false }`.
- `ServiceEditorView.test.ts` needs Pinia mocks for `scriptureSlides`, `importedSlides` **and** `slideGroups`.
- Composable tests leak watchers → wrap each invocation in its own `effectScope()`, stopped in `afterEach`.
- The autosave deep-watch leaks 800ms timers without `enableAutoUnmount`.
- **Tailwind v4** purges dynamically-built class names → static, fully-spelled-out class maps only.

---

## Manual-Only Verifications

| Behavior | Why Manual | Instructions |
|---|---|---|
| Drawer floats with nothing underneath reflowing (R033) | Layout/pixel judgment jsdom cannot assert | Open the drawer over a full grid; confirm no card shifts position |
| Grid stays clickable with the drawer open (no scrim, D-03) | Real pointer interaction | Click a different slide card while the drawer is open; the drawer should swap contents, not close or block |
| Reconciliation copy is concrete enough WITHOUT a diff (D-06) | The accepted trade-off of dropping the diff is a judgment call about whether the wording suffices | Trigger a reconciliation, read the warning, judge whether you could decide confidently from it alone |
| "Edit in song" / "Edit in scripture" land in the right place | Cross-view navigation | Follow each link from a lyric slide and a scripture slide |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or a Wave 0 dependency
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] No watch-mode flags (`vitest run`, never bare `vitest`)
- [ ] Failing-file set has not grown past the 10-file baseline
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
