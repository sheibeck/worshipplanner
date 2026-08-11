---
phase: 41-sharing-correctness
plan: 03
subsystem: sharing
tags: [firestore, share-tokens, pinia, transactions, composite-index]

# Dependency graph
requires:
  - phase: 41-sharing-correctness
    provides: "Plan 01's serviceShareLinks/{serviceId} rules block (null-resource read carve-out) and Plan 02's mintShareToken/pickAdoptableToken/shareTokenCreatedAtMillis utility"
provides:
  - "src/stores/services.ts — buildServiceSnapshot(service): ServiceSnapshot (exported, PII-guarded), writeSharePayload(service, orgIdValue, token), ensureShareLink(service, orgIdValue): Promise<string>, createShareToken retained as a thin wrapper"
  - "serviceShareLinks/{serviceId} identity document: { token, orgId, serviceId, createdAt, updatedAt }"
  - "shareLinkCache: Map<string, string | false> declared inside the store setup, ready for Plan 04's refresh hook"
affects: [41-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "runTransaction with a re-read of the target doc inside the transaction body, used as a create-if-absent convergence primitive for concurrent first-writes (not just optimistic-concurrency conflict avoidance)"
    - "Adopt-or-create resolved through the Plan 02 pure-utility boundary (pickAdoptableToken/mintShareToken) rather than reimplementing selection logic inline in the store"

key-files:
  created: []
  modified:
    - src/stores/services.ts
    - src/stores/__tests__/services.test.ts

key-decisions:
  - "ensureShareLink's steady-state branch (link doc already exists) skips the transaction entirely and returns early after writeSharePayload — the transaction is only reached on the adopt-or-mint path, which is what makes case 2's 'transaction set called exactly once across two calls' assertion meaningful"
  - "writeSharePayload always re-stamps both createdAt and updatedAt on the shareTokens/{token} doc via an unconditional setDoc (not a partial update) — idempotent/self-healing, and harmless because the authoritative creation record lives on serviceShareLinks, not shareTokens"
  - "shareLinkCache declared inside defineStore's setup function, not module scope, so each Pinia instance (and each test) gets an isolated cache"
  - "Test doubles for the transaction (mockTxGet/mockTxSet) are separate from the top-level getDoc mock, matching how the real runTransaction callback receives its own tx.get/tx.set — this is what let case 9 (concurrent-first-share backstop) override ONLY the transaction's read without disturbing the outer getDoc queue"

patterns-established:
  - "Pattern: when proving idempotency under a deterministic test double (this suite's crypto.getRandomValues stub always returns the same bytes), assert call counts on the side-effecting spy (transaction set, getDocs), never string equality between two independently-produced values — string equality passes vacuously"

requirements-completed: [R076, R078]

coverage:
  - id: D1
    description: "ensureShareLink resolves ONE stable token per service — reads serviceShareLinks/{serviceId} if present (steady state), else adopts the most recent compatible pre-existing shareTokens doc via pickAdoptableToken, else mints via mintShareToken — and the resolution is idempotent across repeat calls (proven by call-count, not string equality, per the deterministic crypto stub)"
    requirement: "R076"
    verification:
      - kind: unit
        ref: "src/stores/__tests__/services.test.ts#ensureShareLink > first share on a virgin service mints exactly one token and records it once"
        status: pass
      - kind: unit
        ref: "src/stores/__tests__/services.test.ts#ensureShareLink > repeat share returns the same token and mints nothing (R076 idempotency edge)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Adoption over pre-existing shareTokens documents picks the most recent compatible one (org-scoped, newest createdAt) and mints none; the equality-only query (where('serviceId','==',id), no orderBy/limit) needs no composite Firestore index"
    requirement: "R078"
    verification:
      - kind: unit
        ref: "src/stores/__tests__/services.test.ts#ensureShareLink > adoption picks the most recent of three pre-existing tokens and mints none (R078)"
        status: pass
      - kind: unit
        ref: "src/stores/__tests__/services.test.ts#ensureShareLink > adoption over exactly one candidate adopts it and mints none; over zero candidates mints exactly one (R078 empty edge)"
        status: pass
      - kind: unit
        ref: "src/stores/__tests__/services.test.ts#ensureShareLink > the adoption query is equality-only (no composite index)"
        status: pass
    human_judgment: false
  - id: D3
    description: "An adopted token round-trips byte-for-byte as the shareTokens document id — no case-folding, trimming, or normalization on either side"
    requirement: "R077"
    verification:
      - kind: unit
        ref: "src/stores/__tests__/services.test.ts#ensureShareLink > an adopted token is used verbatim as the document id (R077 encoding edge)"
        status: pass
    human_judgment: false
  - id: D4
    description: "No write is ever issued against organizations/{orgId}/services/{docId} from any ensureShareLink code path — proven as the absence of an updateDoc/setDoc against a services path, not merely the presence of the two forward writes"
    requirement: "R076"
    verification:
      - kind: unit
        ref: "src/stores/__tests__/services.test.ts#ensureShareLink > no write is ever issued against the service document (T-41-01)"
        status: pass
    human_judgment: false
  - id: D5
    description: "buildServiceSnapshot's PII guard survives extraction into a single shared function: personId is resolved to personNames via a Map only, never a raw Person (no email/phone/pcPersonId) — proven against a roster fixture that deliberately carries both"
    requirement: "R078"
    verification:
      - kind: unit
        ref: "src/stores/__tests__/services.test.ts#ensureShareLink > the PII guard holds on the create path (T-41-03, ROADMAP criterion 5)"
        status: pass
      - kind: unit
        ref: "src/stores/__tests__/services.test.ts#createShareToken > written payload contains no email/phone/pcPersonId keys anywhere (PII guard)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Two concurrent first-shares of the same never-shared service converge on a single token via runTransaction's create-if-absent re-read, rather than racing to overwrite each other's index entry (backstop must-have)"
    requirement: "R076"
    verification:
      - kind: unit
        ref: "src/stores/__tests__/services.test.ts#ensureShareLink > concurrent first-share convergence: a link created mid-flight wins over the local mint (backstop)"
        status: pass
    human_judgment: false
  - id: D7
    description: "createShareToken retains its exact name, two-argument signature and Promise<string> return as a thin delegating wrapper around ensureShareLink — both onShare() callers (ServiceEditorView.vue:3509, ServiceCard.vue:209) are unmodified and their existing tests keep passing untouched"
    requirement: "R076"
    verification:
      - kind: unit
        ref: "src/stores/__tests__/services.test.ts#createShareToken (7 pre-existing cases, adapted for the new getDoc call ordering)"
        status: pass
      - kind: other
        ref: "git diff --name-only 812de86~1 HEAD -- src/ → exactly src/stores/services.ts and src/stores/__tests__/services.test.ts"
        status: pass
    human_judgment: false

# Metrics
duration: ~35min
completed: 2026-08-07
status: complete
---

# Phase 41 Plan 03: Rework Share-Token Creation to Adopt-or-Create, Write-in-Place Summary

**`ensureShareLink` replaces "mint a fresh token and freeze a snapshot on every call" with "resolve one stable token per service — reading `serviceShareLinks/{serviceId}`, else adopting the most recent already-circulated `shareTokens` doc, else minting — then always writing the current payload in place," with a `runTransaction` re-read making concurrent first-shares converge on a single token.**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-08-07
- **Tasks:** 3
- **Files modified:** 2 (`src/stores/services.ts`, `src/stores/__tests__/services.test.ts`)

## Accomplishments
- Wave 0 blocker closed: `src/stores/__tests__/services.test.ts`'s `firebase/firestore` mock now exports `where`, `limit`, `getDocs` and `runTransaction` (with module-scope `mockTxGet`/`mockTxSet` spies mirroring the existing `mockUnsubscribe` pattern) — the first filtered Firestore query in the codebase now has mock scaffolding to run against.
- `buildServiceSnapshot(service): ServiceSnapshot` extracted as an exported module-level function, carrying the D-04/D-24 PII guard (`personId → personNames` via a `Map`, never a raw `Person`) forward unchanged, so the create path (this plan) and Plan 04's refresh path share exactly one snapshot builder.
- `ensureShareLink(service, orgIdValue): Promise<string>` — resolves the link doc if it exists (steady state, no transaction needed); otherwise queries `shareTokens` with an equality-only filter (`where('serviceId','==',id)`, no `orderBy`/`limit`), maps to `ShareTokenCandidate`, and calls `pickAdoptableToken` (Plan 02) falling back to `mintShareToken()`; persists through `runTransaction` with a re-read inside so a losing concurrent first-share adopts the winner's token instead of racing; always calls `writeSharePayload` afterward so an already-circulated link starts showing current data immediately.
- `createShareToken` retained as a one-line delegating wrapper — `ServiceEditorView.vue:3509` and `ServiceCard.vue:209` are unmodified, and their existing tests pass untouched.
- 9 new tests in a `describe('ensureShareLink', ...)` block covering all 9 numbered cases from the plan's `<action>`, plus the 7 pre-existing `createShareToken` cases adapted (via a local `beforeEach`) for `ensureShareLink`'s new first `getDoc` call. 55 baseline + 9 new = 64, 0 failing.
- Full app suite (`npx vitest run`): no NEW failing file beyond the documented 2-file baseline (`src/storage.rules.test.ts`, `src/views/__tests__/RosterView.test.ts`) plus the pre-existing `render-service` Vitest-version-mismatch already noted in `41-02-SUMMARY.md`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Wave 0 — extend the firebase/firestore mock with where, getDocs, limit and runTransaction** - `812de86` (test)
2. **Task 2: Extract buildServiceSnapshot, implement ensureShareLink, and delegate createShareToken to it** - `4dd3d29` (feat)
3. **Task 3: Prove token stability, adoption, verbatim token identity, and the absence of any service-document write** - `1b5e964` (test)

## Files Created/Modified
- `src/stores/services.ts` - Added `ServiceSnapshot` type, `buildServiceSnapshot`, `writeSharePayload`, `ensureShareLink`, `shareLinkCache`; `createShareToken` reduced to a thin wrapper; imports extended with `where`, `getDocs`, `runTransaction` (firebase/firestore) and `mintShareToken`, `pickAdoptableToken` (`@/utils/shareTokens`).
- `src/stores/__tests__/services.test.ts` - Mock preamble extended with `where`/`limit`/`getDocs`/`runTransaction` and module-scope `mockTxGet`/`mockTxSet`; `createShareToken` describe block adapted with a local `beforeEach`; new `describe('ensureShareLink', ...)` block with 9 cases.

## Decisions Made
- `ensureShareLink`'s "link already exists" branch returns early after `writeSharePayload`, never entering the transaction — this is what makes the idempotency test's "transaction set called exactly once across two calls" assertion meaningful, and it also means `getDocs` (the adoption scan) is never re-run once a link is established.
- Kept the transaction's `get`/`set` as separate mock spies (`mockTxGet`/`mockTxSet`) from the top-level `getDoc` mock, matching the real Firestore SDK shape (`runTransaction`'s callback receives its own transaction object) — this let the concurrent-first-share backstop test (case 9) override only the transaction's read without disturbing the outer `getDoc` queue used for the link-document read.
- `writeSharePayload` re-stamps both `createdAt` and `updatedAt` on every call via an unconditional full-document `setDoc` — documented in-code as deliberate (idempotent/self-healing; `shareTokens` is a payload surface, not the authoritative record, which is `serviceShareLinks/{serviceId}`).
- Proved stability by call-count, not string equality, throughout — the suite's deterministic `crypto.getRandomValues` stub (`arr[i] = i + 1`) means every mint produces the identical string, so a naive `token1 === token2` assertion would pass even under a regression that re-mints on every call.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `triggerSnapshot([service])` broke type-checking once `service` was cast to `Service`**
- **Found during:** Task 3 (`npm run type-check` after adding the `ensureShareLink` test block)
- **Issue:** The plan's action text says every case "seeds local state with `triggerSnapshot([makeService()])` where the service is needed in the array." I initially called `triggerSnapshot([service])` using the `Service`-typed (post-cast) variable. `triggerSnapshot`'s parameter type is `ReturnType<typeof makeService>[]`, whose `sermonPassage` field is the literal `null`, while `Service.sermonPassage` is `ScriptureRef | null` — a real type mismatch `vue-tsc --build` catches (and `vue-tsc -p tsconfig.app.json` would have silently missed, per CLAUDE.md's documented gate discipline).
- **Fix:** Removed the `triggerSnapshot(...)` calls from all 9 new cases. They were unnecessary in the first place: `ensureShareLink(service, orgIdValue)` takes `service` as a direct parameter and never reads from the store's local `services` ref, so seeding the store was dead weight, not just a type error. `store.subscribe('org-1')` calls were kept where present (harmless, and load-bearing for case 6's orderBy-reset assertion).
- **Files modified:** `src/stores/__tests__/services.test.ts`
- **Verification:** `npm run type-check` → 0 errors; `npx vitest run --dir src --exclude '**/rules.test.ts' src/stores/__tests__/services.test.ts` → 64/64 passing, unchanged.
- **Committed in:** `1b5e964` (Task 3 commit)

**2. [Rule 1 - Bug] `mockTxGet.mockResolvedValueOnce({ exists: () => true, ... })` failed to type-check against its inferred default implementation**
- **Found during:** Task 3, same type-check pass
- **Issue:** `mockTxGet` is declared as `vi.fn(() => Promise.resolve({ exists: () => false, data: () => ({}) }))` (Task 1). TypeScript infers `exists`'s return type as the literal `false` from that default implementation, so overriding with `exists: () => true` in case 9 (concurrent-first-share backstop) failed with `Type 'true' is not assignable to type 'false'`.
- **Fix:** Added `as never` to the override object, matching the existing pattern already used for every `getDoc` override in this file (e.g. `vi.mocked(getDoc).mockResolvedValueOnce({...} as never)`).
- **Files modified:** `src/stores/__tests__/services.test.ts`
- **Verification:** `npm run type-check` → 0 errors.
- **Committed in:** `1b5e964` (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (both type-safety bugs caught by `npm run type-check`, no behavior change, no scope creep).
**Impact on plan:** Cosmetic — both fixes align the new tests with existing file conventions (`as never` casts) or simply remove an unnecessary call. No production code was touched by either fix.

## Issues Encountered
None beyond the deviations above.

## User Setup Required
None - no external service configuration required. Plan 01's `firestore.rules` deploy remains the owner's outstanding step (recorded in that plan's SUMMARY and STATE.md); this plan's code will not function against production Firestore until that deploy happens, by design (NO DEPLOYS standing grant).

## Next Phase Readiness

Plan 04 (the automatic refresh-on-edit hook, R077's remaining half) can now build directly on this plan's output:
- `ensureShareLink` and `createShareToken` are both exposed on the store's return object.
- `shareLinkCache: Map<string, string | false>` already exists inside the store setup, declared with exactly the semantics Plan 04 needs (`false` = "known unshared this session," so an ordinary autosave on a never-shared service can skip both the write and the read after the first lookup).
- `buildServiceSnapshot` and `writeSharePayload` are the two functions Plan 04's refresh hook will call directly — no further extraction needed.

**Concurrent-first-share convergence (Task 3 case 9, the phase's only backstop must-have): PASSES.** The transaction's own `get` spy (`mockTxGet`), separate from the outer `getDoc` mock, was overridden to simulate another client's write landing between `ensureShareLink`'s initial read and the transaction. The losing call correctly returned `winner-token`, never called `mockTxSet`, and wrote the payload to `winner-token` rather than its own locally-minted value. No caveats or weakened assertions were needed to make this pass.

---
*Phase: 41-sharing-correctness*
*Completed: 2026-08-07*

## Self-Check: PASSED

- FOUND: src/stores/services.ts
- FOUND: src/stores/__tests__/services.test.ts
- FOUND: .planning/phases/41-sharing-correctness/41-03-SUMMARY.md
- FOUND: 812de86
- FOUND: 4dd3d29
- FOUND: 1b5e964
- FOUND: 4a4ebc3
