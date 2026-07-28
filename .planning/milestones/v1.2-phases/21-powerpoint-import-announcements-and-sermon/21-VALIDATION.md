---
phase: 21
slug: powerpoint-import-announcements-and-sermon
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-24
---

# Phase 21 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from 21-RESEARCH.md "## Validation Architecture".

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest `^4.0.18` (already used across `src/`) — **not yet present in `functions/`** (Wave 0 gap) |
| **Config file** | `vitest.config.ts` (root, covers `src/`); `functions/vitest.config.ts` (new, Node env — Wave 0) |
| **Quick run command** | `npx vitest run <changed-test-file>` (root for `src/`; `cd functions && npx vitest run <file>` for `functions/`) |
| **Full suite command** | `npm run test:unit && npm run test:rules` (root) + `cd functions && npx vitest run` (once Wave 0 bootstraps it) |
| **Estimated runtime** | ~60s root suite; functions suite ~a few s once bootstrapped |

---

## Sampling Rate

- **After every task commit:** Run the changed test file (`npx vitest run <file>`; `cd functions && npx vitest run <file>` for Cloud Function code)
- **After every plan wave:** Run `npm run test:unit` (root) + `cd functions && npx vitest run`
- **Before `/gsd-verify-work 21`:** Full suite green — `npm run test:unit`, `npm run test:rules`, and the `functions/` vitest suite
- **Max feedback latency:** ~60 seconds

---

## Per-Requirement Verification Map

| Req ID | Behavior | Test Type | Automated Command | File Exists | Status |
|--------|----------|-----------|-------------------|-------------|--------|
| R010 | officeparser AST → `(TextSlide\|ImageSlide)[]` mapping correct for text-only / image-only / mixed fixture decks | unit (pure `mapAstToSlides`) | `cd functions && npx vitest run src/pptxParser.test.ts` | ❌ Wave 0 (needs `functions/vitest.config.ts` + fixtures) | ⬜ pending |
| R010 | `parsePptx` onCall rejects a corrupted/non-pptx upload with the friendly error AND never deletes the source | integration | `cd functions && npx vitest run src/pptxParser.test.ts -t "invalid file"` | ❌ Wave 0 | ⬜ pending |
| R011 | Announcement (Pre-Service) `IMPORTED` slot expands to `AssembledSlide[]` via `assembleSlideshow` | unit | `npx vitest run src/utils/__tests__/slideshowAssembler.test.ts` | ✅ exists — extend with IMPORTED cases | ⬜ pending |
| R011 | Direct image upload (no PPTX) produces the same deck shape | component | `npx vitest run src/components/__tests__/PptxImportModal.test.ts` | ❌ Wave 0 (new component) | ⬜ pending |
| R012 | Sermon (Message) `IMPORTED` slot renders as text/image cards in `SlideshowPreview.vue` | component | `npx vitest run src/components/__tests__/SlideshowPreview.test.ts` | ✅ exists — extend with `'image'` cardKind | ⬜ pending |
| R017 (supporting) | Auto-save fires on edits to imported slides | unit (reuse `useAutoSave`) | `npx vitest run src/composables/__tests__/useAutoSave.test.ts` | ✅ covers composable generically; new editor needs wiring test | ⬜ pending |
| R018 (supporting) | Import modal preview/confirm step + friendly error copy render | component | `npx vitest run src/components/__tests__/PptxImportModal.test.ts` | ❌ Wave 0 | ⬜ pending |

---

## Wave 0 Requirements

- [ ] `functions/package.json` — add `vitest` devDependency + a `"test"` script (none exists today)
- [ ] `functions/vitest.config.ts` — new config (Node environment, not jsdom)
- [ ] Fixture `.pptx` files under `functions/src/__fixtures__/`: (1) text-only deck, (2) image-only deck, (3) mixed text+image deck — **`user_setup`: authentic PowerPoint binaries must be human-provided** (Claude cannot fabricate valid `.pptx`); (4) intentionally-corrupted/non-pptx file for the error path — **executor-created**
- [ ] `src/firebase/index.ts` — Storage SDK init (`getStorage`, `connectStorageEmulator`) — blocks any client-side upload test
- [ ] `storage.rules` + `firebase.json` storage emulator config — blocks any Storage-rules test (reuses existing `@firebase/rules-unit-testing` devDependency; new test file `src/storage.rules.test.ts`)

---

## Manual-Only Verifications

- End-to-end PPTX import against the running app + emulator (21-06 human-verify checkpoint): upload a real sermon `.pptx`, confirm parsed native slides appear in the Message section, images render, and the uploaded source object still exists in Storage after both success and failure.
- `officeparser` dependency-legitimacy review (21-03 human-verify checkpoint): confirm MIT license, ~585K weekly downloads, real GitHub repo, 2019 origin before `npm install`.

---

## Notes

- Dimension 8 (Nyquist) applies because 21-RESEARCH.md carries a `## Validation Architecture` section and `config.json` has no `nyquist_validation: false` override.
- `functions/` cannot import from `src/`, so `TextSlide`/`ImageSlide` shapes are hand-mirrored in `functions/src/pptxParser.ts`; keep field names (`contentKind`, `body`, `imageUrl`, `altText`) identical (plan-checker WARNING — no automated parity test; cross-reference comments required in both files).
