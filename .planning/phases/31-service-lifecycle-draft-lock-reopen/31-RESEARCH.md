# Phase 31: Service Lifecycle — Draft Lock & Reopen - Research

**Researched:** 2026-07-29
**Domain:** Firestore security rules (field-level diff, cross-document guards), three-layer write
enforcement in a Vue 3 / Pinia / Firestore app
**Confidence:** HIGH — the rules findings below were **executed against a live Firestore emulator**,
not reasoned about. 36 assertions across two throwaway probe suites, all passing at the final rule
shape. The probe files were deleted after the run; the plan must re-create the surviving assertions
as permanent tests in `src/rules.test.ts`.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01: The status badge stops being a control.** It becomes a non-clickable status pill.
  `toggleStatus` (`ServiceEditorView.vue:1796`) is DELETED. It is currently a blind three-way cycle
  — draft → planned → exported → draft — which is the source of two defects this phase must close:
  it lets a user mark a service "Exported" without ever exporting it, and it makes reopening an
  exported service an unlabelled click with no warning.

- **D-02: Explicit, named actions replace the cycle**, one per legal transition:

  | Status | Action shown |
  |---|---|
  | `draft` | **Mark as Planned** |
  | `planned` | **Reopen for editing** · **Export to Planning Center** (existing) |
  | `exported` | **Reopen for editing** |

- **D-03: `exported` is reachable ONLY through a real Planning Center export.** No hand-setting. The
  export flow is the only writer of that status, alongside `pcExportedAt` / `pcPlanId`.

- **D-04: The Planning Center warning gates on EVIDENCE, not on the status string.** Show it only when
  the service carries `pcExportedAt` / `pcPlanId`. Live data may contain services sitting at
  `exported` that were set by hand through the old cycle and were never exported; warning that
  "Planning Center holds the previously exported version" would be a lie for those, and a warning
  users learn is sometimes false is a warning they learn to click through. This also satisfies R037's
  third criterion ("reopening a never-exported service does not show that warning") without a data
  migration — the legacy rows self-correct the first time they are reopened.
  **Deliberately NOT chosen:** repairing the status on load. That would write to services the user
  never asked to change.

- **D-05: One banner, controls REMOVED not disabled.** A single persistent banner sits near the status
  pill: the service is locked, plus the Reopen action. Mutation controls are not rendered at all.
  This follows Phase 30's read-only precedent (the `Read-only — edit in Song Lyrics` badge on song
  groups): state the reason once, visibly, then do not render dead affordances. A screen of greyed-out
  buttons on every locked service was considered and rejected.

- **D-06: All three tabs lock.**
  - *Service Order* — rows render as plain text; no drag handles, no Add item, no song/scripture pickers.
  - *Slides* — no Add slide, no Import, no drag, no drawer edits, no group media.
  - *Roles* — assignments render as names; no checkboxes.

- **D-07: Notes and sermon topic lock too.** A carve-out for free-text metadata was offered and
  declined — R036 says the tabs are read-only and that is taken literally.

- **D-08: Non-editing actions stay live while locked** — Export/Copy to Planning Center, Present /
  preview, Print, and Share link.

- **★ D-09: The lock MUST permit the export write.** `Export to Planning Center` requires
  `status === 'planned'` (`ServiceEditorView.vue:150`), and the export itself writes `pcExportedAt`,
  `pcPlanId` and flips `status` to `exported`. A naive "no writes unless draft" rule at any of the
  three layers makes `exported` unreachable and breaks the primary workflow. This is the single most
  likely way to get this phase wrong.

- **D-10: Friction only where there are consequences.** Reopening a `planned` service is one click —
  nothing external depends on it. Reopening a service with real export evidence opens a confirm dialog
  carrying the Planning Center warning. "Always confirm" was rejected: a dialog with nothing to warn
  about trains people to click through the one that matters.

- **D-11: Reopening KEEPS both `pcExportedAt` and `pcPlanId`.** The export dialog already has an
  "existing plan" mode (`exportMode: 'new' | 'existing'`), so preserving the link lets a re-export
  update the same Planning Center plan instead of creating a duplicate. Clearing them would silently
  orphan the plan already sitting in Planning Center and lose the audit trail. It would also break
  D-04's evidence gate on a second reopen.

- **D-12: Forward-only.** Start at the next upcoming Sunday and walk forward until one has no plan.
  Nearest-in-either-direction was rejected: a new-service dialog defaulting to a date in the past is
  surprising, and a past Sunday with no plan usually means no service was held.

- **D-13: Bounded at ~52 Sundays, then fall back to today's `nextSunday()`.** The field is never blank,
  and the degenerate case degrades to exactly the behaviour that exists now.

- **D-14: The dialog needs the service list it does not currently have.** `NewServiceDialog.vue`
  computes `nextSunday()` with no knowledge of existing services and receives no service data.
  Deciding where the taken-dates set comes from (prop from `ServicesView.vue`, which already
  subscribes, vs. the store directly) is a planning decision — but the wiring is new work, not a
  one-line change.

### Claude's Discretion

- **How the three enforcement layers are structured**, and specifically how Firestore rules enforce the
  lock on the `slideGroups` collection, whose documents do not carry the service status. A rules-level
  `get()` on the parent service is a cross-document read with cost and latency implications. Flagged
  for research (see below).
- The store-guard layer's shape (per-action guard vs. a single wrapper).
- Exact banner copy and placement, within D-05.

### Deferred Ideas (OUT OF SCOPE)

- **Notes / sermon topic remaining editable after locking** — offered as a carve-out and declined.
  Recorded so the option is not silently re-litigated; revisit only if locking notes proves annoying
  in practice.
- **Repairing legacy hand-set `exported` statuses on load** — rejected under D-04 as an unrequested
  write. The evidence gate makes the repair unnecessary.
- **Whether a viewer (non-editor) sees the lock banner at all** — viewers already cannot edit, so the
  banner would explain a restriction that is not the reason they cannot edit. Left to Claude's
  discretion during planning; noted here so it is a considered choice rather than an oversight.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **R036** | A service is editable only while `draft`. At `planned`/`exported` the Service Order, Slides and Roles tabs are read-only. Three-layer enforcement — rules, store guard, UI — because `firestore.rules` has zero status guard today. | § "Finding 0" (the catch-all bypass that would silently void the rules layer), § "Verified rule — `/services`", § "Verified rule — `/slideGroups`", § "The three layers and how they compose" |
| **R037** | An editor can explicitly reopen a non-draft service, returning it to `draft`. When already `exported`, warn that Planning Center holds the previously exported version. | § "Verified rule — `/services`" branch 3 (reopen carve-out, executed as B5/B6/B15), § "Pitfall 4" (the evidence gate reads `pcExportedAt`/`pcPlanId`, which D-11 preserves) |
| **R038** | Creating a service defaults the date to the nearest Sunday that does not already have a service plan. | § "R038: the Sunday-search wiring" |
</phase_requirements>

---

## Summary

Two things were flagged for research. Both were answered by **executing rules against the Firestore
emulator**, and both answers contain a trap that reasoning alone would have missed.

**Research question 1 (field-level diff) is solved and verified** — `diff()`, `affectedKeys()`,
`hasOnly()`, `hasAll()` and `data.get(key, default)` all exist and behave as needed, and a rule built
from them correctly permits the reopen write and the export write while rejecting the payload-forgery
attack the CONTEXT warned about. But the actual blocker is upstream of the rule: **`firestore.rules:71-73`'s
`match /{collection}/{docId}` wildcard also matches `/organizations/{orgId}/services/{docId}`, and
Firebase rules are OR-evaluated.** A status guard added to the `/services/{docId}` block today would be a
complete no-op — proven by executing a rule that says `allow write: if false` on `/services` and watching
an editor's write to an `exported` service succeed anyway. This is the single highest-risk item in the
phase and it is invisible to code review; only an emulator test catches it.

The second trap: the obvious way to enforce D-03 ("`exported` only via a real export") is to require the
export write to touch `pcExportedAt` **and** `pcPlanId`. That **breaks re-export to the same Planning
Center plan** — which is exactly the flow D-11 exists to preserve. `MapDiff.affectedKeys()` reports only
keys whose *value changed*; writing `pcPlanId: 'plan-9'` over a stored `'plan-9'` does not appear in the
diff, so `hasAll(['pcPlanId'])` fails and the legitimate re-export is denied. Executed and confirmed
(probe D3 failed, then passed once corrected). Use `hasAll(['pcExportedAt'])` (a fresh `serverTimestamp()`
always changes) plus `request.resource.data.pcPlanId is string`.

**Research question 2 (`slideGroups`) is enforceable at the rules layer, and the recommendation is to do
it** — a `get()` on the parent service works, costs 2 extra billed document reads per slide write, and sits
comfortably inside the 10-call limit. But it **cannot ship alone**: `useSlideshowAssembly`'s materialization
watcher writes to `slideGroups` on `{ immediate: true }` whenever an editor merely *opens* a service, gated
only on `canWrite = isEditor`. Deploy the rule without narrowing `canWrite` in the same commit and every
locked service throws permission-denied on load — a worse failure than the one being fixed, and one that
ships green because `src/rules.test.ts` is excluded from the default vitest run.

**Primary recommendation:** Restructure `firestore.rules` so the wildcard catch-all excludes both
`services` and `slideGroups`; split `/services` `allow write` into `create`/`update`/`delete` following the
`quarterShares` precedent at `firestore.rules:117-118`; enforce `slideGroups` with a parent `get()`; and in
the *same commit* narrow `useSlideshowAssembly`'s `canWrite` to `isEditor && status === 'draft'`. Every rule
below is quoted verbatim from a shape that passed against the emulator.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Reject a mutating write to a non-draft service | **Database (Firestore rules)** | Store guard | R036 names rules as the layer that makes the lock non-bypassable. Only the server sees every client. |
| Reject a mutating write to a locked service's slide groups | **Database (Firestore rules)** | Store guard + composable `canWrite` | Same, but requires a cross-document read because the group doc has no status. |
| Prevent the app from *issuing* a doomed write | **Client store / composable** | — | The rules layer returns `permission-denied` *asynchronously*; without a client guard the UI shows optimistic state that silently reverts. Also the only place that can stop the automatic materialization watcher. |
| Not render dead mutation affordances | **Client component (UI)** | — | D-05. Cosmetic + intent-signalling only; never the enforcement boundary. |
| Legal status transitions (draft→planned, →exported, →draft) | **Database (rules)** | Client (which action buttons render) | Rules encode which transitions are legal; the UI encodes which are *offered* (D-02). |
| Planning Center export write | **Client (`onConfirmExport`)** | Rules carve-out | The export is a multi-step PC API conversation; only its terminal Firestore write is rules-relevant (D-09). |
| Next-free-Sunday computation | **Client (pure utility)** | — | Pure date math over an already-subscribed list. No new I/O. R038 is a default-value convenience, not an invariant. |

---

## Standard Stack

**No new packages.** This phase is entirely a change to `firestore.rules` plus existing Vue/Pinia code.
Everything needed is already a direct dependency.

### Core (already present — versions verified from `package.json` + installed tree)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `firebase` | `^12.0.0` (12.10.0 resolved) | Firestore client; `serverTimestamp`, `updateDoc`, `runTransaction` | Already the app's only backend `[VERIFIED: package.json + emulator run banner "Firestore (12.10.0)"]` |
| `@firebase/rules-unit-testing` | `^5.0.0` | Emulator-backed rules tests (`initializeTestEnvironment`, `assertSucceeds`, `assertFails`) | The repo's existing rules-test harness (`src/rules.test.ts`) `[VERIFIED: package.json, and executed in this session]` |
| `vitest` | `^4.0.18` (4.0.18) | Test runner, both configs | `[VERIFIED: package.json + run banner]` |
| `firebase-tools` (via `npx firebase`) | `15.18.0` | `emulators:exec`, `deploy --only firestore:rules` | `[VERIFIED: npx firebase --version]` |
| Java runtime | `25.0.2 LTS` | Required by the Firestore emulator's rules engine | `[VERIFIED: java -version]` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Rules-level `get()` on the parent service for `slideGroups` | Denormalise `status` onto every group document | Removes the cross-doc read, but adds a fan-out write on every transition and a second source of truth that can drift. See § "Research Question 2" for the costed verdict. |
| Rules-level enforcement for `slideGroups` | Store + UI enforcement only | Cheapest, but leaves the collection with the exact zero-enforcement property R036 exists to eliminate. Rejected. |
| A Cloud Function to own status transitions | — | Overkill; adds a deploy target, latency and a new failure mode for a two-branch state machine. Not considered further. |

**Installation:** none.

---

## Package Legitimacy Audit

**Not applicable — this phase installs no external packages.** Every dependency it touches is already
present in `package.json` and already in use by shipped code. No `[SLOP]` or `[SUS]` verdicts to report,
and no `checkpoint:human-verify` install gates are needed.

---

## ★ Finding 0 — the wildcard catch-all silently voids any `/services` status guard

**This is the finding that most changes the plan.** Read it before anything else.

`firestore.rules:71-73` currently reads:

```javascript
      // All other nested collections — editors only
      match /{collection}/{docId} {
        allow read, write: if isOrgEditor(orgId);
      }
```

`{collection}` is a single-segment wildcard. It matches `services`. It matches `slideGroups`. It matches
everything under `/organizations/{orgId}/`. And Firebase Security Rules are **OR-evaluated**:

> "If any of the `allow` rules for the method are satisfied, the request is allowed." …
> "Additionally, if a broader rule grants access, Security Rules grant access and ignore any more granular
> rules that might limit access."
> `[CITED: firebase.google.com/docs/rules/rules-language]`

**Executed proof (probe A1):** with a rules file whose `/services/{docId}` block said literally
`allow write: if false`, and today's catch-all left intact, an org editor's `updateDoc` renaming an
`exported` service **succeeded**. `[VERIFIED: Firestore emulator, 2026-07-29]`

**Executed fix (probe A2):** adding `&& collection != 'services'` to the catch-all restored the deny, and
a sibling collection (`songs`) remained writable through the catch-all. `[VERIFIED: emulator]`

Firestore rules have no "except" operator. The two viable fixes are (a) constrain the catch-all with
`collection != '…'` comparisons on the bound path variable, or (b) enumerate every remaining collection
explicitly. **(a) is the minimal, verified diff** — path-segment wildcards bind to a string and compare
normally.

Two consequences the planner must carry:

1. **The `/services/{docId}` block must then cover *every* operation**, because it is no longer backstopped
   by the catch-all. Today it grants only `read` + `write`; after exclusion it must grant `read`, `create`,
   `update` and `delete` or the app breaks. (Executed: B10 create, B13 delete, B14 viewer read.)
2. **Anyone auditing this diff by reading the `/services` block alone will conclude the lock works.** The
   defect lives 20 lines away in an unrelated-looking rule. The permanent test in `src/rules.test.ts`
   must assert the *deny*, not merely that the new block exists.

---

## Research Question 1 — field-level diff for the reopen transition

### The rules-language primitives (all verified by execution)

| Primitive | Availability | Behaviour observed |
|-----------|-------------|--------------------|
| `resource.data` | update/delete only | The **stored** document. On a `create` it is null — an `allow update` rule referencing it produces `evaluation error … Null value error`, which denies rather than crashes. Split `create` out. `[VERIFIED: emulator, probe B10]` |
| `request.resource.data` | create/update | The **post-write** document (full merged state, even for a partial `updateDoc`). `[CITED: firebase.google.com/docs/firestore/security/rules-conditions]` `[VERIFIED: B4, where a partial patch's unlisted keys were correctly absent from the diff]` |
| `request.resource.data.diff(resource.data)` | yes | Returns a `MapDiff`. `[VERIFIED]` |
| `.affectedKeys()` | yes | Returns a `Set` of **top-level** keys whose value differs. `[VERIFIED]` |
| `.hasOnly([...])` | yes | Strict subset test. A write touching one extra key fails. `[VERIFIED: B15 — reopen + `notes` edit rejected]` |
| `.hasAll([...])` | yes | Superset test. **Only sees keys whose value CHANGED** — see the trap below. `[VERIFIED: D3]` |
| `resource.data.get('status', 'draft')` | yes | Map default-read. Lets a legacy document with no `status` field be treated as `draft` instead of erroring. `[VERIFIED: B11]` |
| `request.resource.data.keys().hasAll([...])` | yes | Field-presence test, independent of value change. `[VERIFIED: E4]` |
| `x is string` | yes | Type test. `[VERIFIED: D-branch final run]` |

### ★ Trap: `affectedKeys()` reports CHANGED keys, not WRITTEN keys

The natural way to encode D-03 is "the export write must carry `pcExportedAt` and `pcPlanId`":

```javascript
&& keys().hasAll(['pcExportedAt','pcPlanId'])   // ← WRONG
```

**This denies the re-export flow that D-11 exists to enable.** After a reopen, `pcPlanId` is deliberately
preserved. Re-exporting to the *same* Planning Center plan writes the *same* `pcPlanId` value, so the key
does not appear in the diff and `hasAll` fails.

Executed: probe D3 seeded `{status:'planned', pcPlanId:'plan-9'}`, wrote `pcPlanId:'plan-9'` back alongside
a fresh `pcExportedAt` and `status:'exported'`, and the write was **denied**. Changing the constraint to
`hasAll(['pcExportedAt'])` + `request.resource.data.pcPlanId is string` made it pass while still denying the
evidence-free hand-set (D2). `[VERIFIED: emulator — one probe run red, one green]`

`pcExportedAt` is safe to require in `hasAll` because the client always writes a fresh
`serverTimestamp()` (`ServiceEditorView.vue:2611`), which always differs from the stored value.

### The verified `/services` rule

Every branch below was executed. Line references are to the shape that passed 15/15 in probe B and 4/4 in
probe D.

```javascript
      // Services — viewers read; editors write only while the STORED status is
      // draft, with two explicit carve-outs (reopen, Planning Center export).
      //
      // Note the read is of `resource.data.status` (STORED), never
      // `request.resource.data.status` (INCOMING) — reading the incoming value
      // would let any write that also sets `status: 'draft'` edit a locked
      // service, which is precisely the payload an attacker would send.
      match /services/{docId} {
        function storedStatus() { return resource.data.get('status', 'draft'); }
        function keys() { return request.resource.data.diff(resource.data).affectedKeys(); }

        allow read:   if isOrgMember(orgId);
        allow create: if isOrgEditor(orgId) && request.resource.data.status == 'draft';
        allow delete: if isOrgEditor(orgId);
        allow update: if isOrgEditor(orgId) && (
          // 1. Ordinary editing — allowed only while the STORED status is draft.
          //    This also covers the draft -> planned transition (D-02).
          storedStatus() == 'draft'

          // 2. D-09 — the Planning Center export write. planned -> exported,
          //    carrying real export evidence. `hasAll(['pcExportedAt'])` (not
          //    pcPlanId) because affectedKeys() only reports CHANGED keys and a
          //    re-export to the same plan writes an unchanged pcPlanId.
          || (storedStatus() == 'planned'
              && request.resource.data.status == 'exported'
              && keys().hasOnly(['status','pcExportedAt','pcPlanId','updatedAt'])
              && keys().hasAll(['pcExportedAt'])
              && request.resource.data.pcPlanId is string)

          // 3. R037 — Reopen. The ONLY status-reverting write. hasOnly() is what
          //    stops "reopen" being used to smuggle a slots rewrite alongside the
          //    status change. D-11's pcExportedAt/pcPlanId are untouched by design.
          || (request.resource.data.status == 'draft'
              && keys().hasOnly(['status','updatedAt']))
        );
      }
```

| # | Scenario | Expected | Result |
|---|----------|----------|--------|
| B1 | draft service, full field save | allow | ✓ |
| B2 | draft → planned | allow | ✓ |
| B3 | planned service, `slots` edit | **deny** | ✓ |
| **B4 ★** | exported service, `slots` edit **with `status:'draft'` smuggled into the same payload** | **deny** | ✓ |
| B5 | exported → draft, `status`+`updatedAt` only (Reopen) | allow | ✓ |
| B6 | planned → draft (Reopen) | allow | ✓ |
| **B7/D1 ★** | planned → exported + `pcExportedAt` + `pcPlanId` (D-09) | allow | ✓ |
| **D2 ★** | planned → exported with **no** pc evidence (D-03) | **deny** | ✓ |
| **D3 ★** | re-export to the **same** `pcPlanId` (D-11's whole point) | allow | ✓ *(only after the `hasAll` correction)* |
| B9 | exported → planned (illegal transition) | **deny** | ✓ |
| B10 | `create` with `status:'exported'` / with `status:'draft'` | deny / allow | ✓ |
| B11 | legacy doc with **no** `status` field, ordinary edit | allow (treated as draft) | ✓ |
| **B12 ★** | `roleAssignmentOverrides.{roleId}` dot-path write on planned / on draft | deny / allow | ✓ |
| B13 | delete a locked service | allow | ✓ |
| B14 | viewer read / viewer write | allow / deny | ✓ |
| B15 | Reopen **plus** a `notes` edit in the same write | **deny** | ✓ |
| B16 | rewriting an identical value on a locked service (empty diff) | **deny** | ✓ |
| D4 | draft → exported directly | allow *(residual hole, see below)* | ✓ |

**B12 matters more than its size suggests.** `setRoleOverride` writes the dot path
`roleAssignmentOverrides.${roleId}` (`services.ts:155-158`). `MapDiff` operates on **top-level** keys, so
that write surfaces in `affectedKeys()` as `roleAssignmentOverrides` — which is neither in the reopen
allowance nor the export allowance, so it is correctly denied on a locked service. No special handling
needed. `[VERIFIED]`

**Residual hole (D4), deliberate:** a `draft` service can be written straight to `exported` because
branch 1 short-circuits on the stored status. Closing it would require branch 1 to also constrain the
outgoing status, which fights the ordinary full-document `onSave` write (`ServiceEditorView.vue:2773-2781`
sends `status` on **every** save). Recommendation: leave it. D-03 is enforced by the UI no longer offering
the transition (D-01 deletes `toggleStatus`), and by the rules for the `planned → exported` edge which is
where the real attack surface is. Record it as an accepted gap rather than discovering it in review.

---

## Research Question 2 — enforcing the lock on `slideGroups`

### The three options, costed

| | Rules `get()` on parent | Denormalise `status` onto groups | Store + UI only |
|---|---|---|---|
| **Enforceable server-side** | Yes `[VERIFIED: C1–C4, E1–E7]` | Yes | **No** |
| **Extra billed reads per slide write** | **+2** (`exists()` + `get()`), on top of the 1 `isOrgEditor` already does → 3 total. Billed even when the write is rejected. `[CITED: rules-conditions — "you will be billed for reading documents even if your rules reject the request"]` | 0 | 0 |
| **`get()`/`exists()` quota headroom** | 3 of **10** per single-document request; **20** for transactions/batched writes with 10 per operation. `replaceGroupSlides`'s `runTransaction` path stays inside both. `[CITED: rules-conditions]` | n/a | n/a |
| **Latency** | One extra server-side document lookup per slide write. Not on any hot loop — slide writes are per-user-action. | none | none |
| **Fan-out cost** | none | **1 + N writes per transition.** N = groups per service. Default progression `1-2-2-3` builds **9 slots** (`slotTypes.ts:284-295`), and a group materializes only for slots that derive ≥1 slide (`useSlideshowAssembly.ts:291`), so N ≈ 4–9 typically. A `writeBatch` (500-op limit) covers it atomically. | none |
| **Drift risk** | none — single source of truth | **Real.** A group that materializes during a transition, or a batch that partially fails, leaves a group whose stamped status disagrees with its service. Also every create path (`materializeGroupIfMissing`, `setGroupBedMedia`'s skeleton) must stamp it. | none |
| **New failure modes** | orphan groups, groups missing `serviceId` — all found and handled below | second source of truth; transition write amplification | none |

### Verdict: use the rules-level `get()`

R036 exists specifically because "UI-only lock is bypassable" — shipping `slideGroups` with store+UI
enforcement only would reproduce the exact hole the requirement names, in the collection that holds the
majority of a service's content. Denormalisation trades one cheap read for a second source of truth and a
transition-time fan-out; that is a worse trade for a write volume this low. Two billed reads per slide
write is, at Firestore's read pricing, immaterial at this app's scale.

### On the structural obstacle (doc id is the SLOT id, not the service id)

The parallel pattern map correctly flags that `slideGroups/{docId}` is keyed by **slot** id, so the parent
service is reachable only through a `serviceId` **field**. The obstacle is real but **not disqualifying** —
it is a soundness ceiling, not a blocker:

- On **update/delete**, `resource.data.serviceId` is the *stored*, server-held value. Not spoofable.
  `[VERIFIED: C1/C2/E1]`
- Re-parenting is closable: `request.resource.data.serviceId == resource.data.serviceId` makes `serviceId`
  immutable, mirroring `quarterShares`'s `orgId` immutability at `firestore.rules:118`. Without it, an
  editor could flip a group from a draft parent to a locked one. `[VERIFIED: C7 showed the hole, E2 showed the fix]`
- On **create**, `request.resource.data.serviceId` **is** client-controlled and **is** spoofable. An editor
  can create `slideGroups/{aLockedServicesSlotId}` while claiming `serviceId: <someDraftService>`, and it
  will be accepted. `[VERIFIED: E6 — executed, succeeds]` Closing it would require the rule to confirm the
  slot id appears in the parent service's `slots` array, which the rules language cannot express (no search
  over a list of maps).

**Verdict on the residual hole: accept and document.** The attacker must already be an org **editor** — a
principal who can delete the entire service outright (B13), rewrite every song, and empty the roster. The
lock is a workflow guarantee against accident and stale UI, not a privilege boundary between an editor and
their own org's data. Nothing here is a cross-tenant issue.

### ★ The write the lock must NOT block, beyond D-09

`useSlideshowAssembly` writes to `slideGroups` **when an editor merely opens a service** — the
materialization watcher runs with `{ immediate: true }` (`useSlideshowAssembly.ts:317-323`) and calls
`materializeGroupIfMissing` for every slot that derives slides but has no document yet. It is gated on
`canWrite` alone, which `ServiceEditorView.vue:1366` supplies as `computed(() => authStore.isEditor)`
(`useSlideshowAssembly.ts:138-141`).

Three separate sites read that same flag and all three write:

| Site | Line | What it writes | Trigger |
|---|---|---|---|
| `materializationCandidates` → `materializeCandidates` | `:268`, `:305-323` | `materializeGroupIfMissing` (create) | **service load**, no user action |
| `ensureGroupMaterialized` | `:340` | `materializeGroupIfMissing` (create) | user action via `SlideGrid` |
| `rebuildOutcomes` → `applyRebuildOutcomes` | `:396`, `:430-459` | `replaceGroupSlides` (update) | **any change to a slot**, `{ immediate: true }` |

Deploy the `slideGroups` rule without narrowing `canWrite` and **every locked service throws
`permission-denied` on load**, unprompted. The default vitest suite excludes `src/rules.test.ts`
(`vite.config.ts` `test.exclude`), so this ships green.

**Recommendation — suppress materialization entirely for a locked service; do NOT carve it out.**
Narrow the single `canWrite` prop at `ServiceEditorView.vue:1366` to
`computed(() => authStore.isEditor && localService.value?.status === 'draft')`. One expression closes all
three sites plus four of the seven `SlideGrid` entry points, which funnel through
`props.ensureGroupMaterialized`.

Rationale for suppression over carve-out: a locked service's groups were already materialized while it was
a draft (that is what being planned means). Materializing *new* groups against a locked plan would mean
the slide deck is still changing after the plan was frozen — precisely what R036 forbids. The degenerate
case is a service locked before its slides ever rendered; it shows fewer slides until reopened, which is
honest. A carve-out permitting creates-but-not-updates would also be unenforceable at the rules layer for
the reason above (`serviceId` is spoofable on create), so it would be a client-side-only exception dressed
up as a rule.

### The verified `slideGroups` rule

```javascript
      // Slide groups — one doc per slot (doc id IS the slot id), so the parent
      // service is reachable only via the serviceId FIELD. Two extra billed
      // reads per write (exists + get); 3 of the 10-call budget once
      // isOrgEditor's own get() is counted.
      match /slideGroups/{groupId} {
        function svcPath(sid) {
          return /databases/$(database)/documents/organizations/$(orgId)/services/$(sid);
        }
        function parentDraft(sid) {
          return exists(svcPath(sid)) && get(svcPath(sid)).data.get('status','draft') == 'draft';
        }
        function parentGone(sid) { return !exists(svcPath(sid)); }

        allow read: if isOrgMember(orgId);

        allow create: if isOrgEditor(orgId)
          && request.resource.data.keys().hasAll(['serviceId'])
          && parentDraft(request.resource.data.serviceId);

        // serviceId is immutable (mirrors quarterShares' orgId immutability,
        // firestore.rules:118) — otherwise a group could be re-parented from a
        // draft service onto a locked one and edited through the seam.
        allow update: if isOrgEditor(orgId)
          && resource.data.keys().hasAll(['serviceId'])
          && request.resource.data.serviceId == resource.data.serviceId
          && parentDraft(resource.data.serviceId);

        // Delete is deliberately MORE permissive than update: an orphan (parent
        // service deleted) or a legacy doc with no serviceId must remain
        // deletable, or it is wedged in the database forever with no cleanup path.
        allow delete: if isOrgEditor(orgId)
          && (!resource.data.keys().hasAll(['serviceId'])
              || parentGone(resource.data.serviceId)
              || parentDraft(resource.data.serviceId));
      }
```

| # | Scenario | Expected | Result |
|---|----------|----------|--------|
| C1/E1 | slide write, parent draft | allow | ✓ |
| C2/E1 | slide write, parent planned | **deny** | ✓ |
| C3 | materialize (create), locked parent / draft parent | deny / allow | ✓ |
| C4/E5 | cascade delete, locked parent / draft parent | deny / allow | ✓ |
| **E2 ★** | re-parent a group by changing `serviceId` | **deny** | ✓ |
| **E3 ★** | orphan group (parent deleted): update / delete | deny / **allow** | ✓ |
| **E4 ★** | legacy group with no `serviceId`: update / delete | deny / **allow** | ✓ |
| **E6 ★** | create claiming a draft parent for a locked service's slot id | *allow* — **known residual hole** | ✓ |
| E7 | `setGroupBedMedia` merge-create under a locked parent | **deny** | ✓ |

**E3/E4 are why `delete` is written differently from `update`.** In an earlier probe iteration
(`parentDraft` without the `exists()` guard) a group whose parent service had been deleted produced
`Null value error` and was **neither updatable nor deletable** — permanently wedged, with no cleanup path
short of disabling rules. `[VERIFIED: probe C5]` The `parentGone` branch fixes it.

---

## The three layers and how they compose

### Layer boundaries

```
            USER ACTION                        AUTOMATIC (no user action)
                 |                                       |
                 v                                       v
    +-------------------------+          +------------------------------------+
    | Layer C — UI (D-05/D-06)|          | useSlideshowAssembly watchers      |
    | controls NOT RENDERED   |          |   materializationCandidates :268   |
    | banner states the reason|          |   rebuildOutcomes           :396   |
    +------------+------------+          |   ensureGroupMaterialized   :340   |
                 |                       +------------------+-----------------+
                 | (handler still callable — I-01)          |
                 v                                          | canWrite prop
    +-------------------------+                             | :1366  <-- NARROW HERE
    | Layer B — handler guard |<----------------------------+
    |  + STORE guard          |
    |  isEditable(serviceId)  |
    +------------+------------+
                 |
                 v  Firestore write
    +---------------------------------------------------------------+
    | Layer A — firestore.rules                                      |
    |                                                                |
    |   match /services/{docId}                                      |
    |     storedStatus()=='draft' ---------------------------> ALLOW |
    |     planned->exported + pc evidence (D-09) ------------> ALLOW |
    |     ->draft, status+updatedAt only (R037) -------------> ALLOW |
    |     everything else ------------------------------------> DENY |
    |                                                                |
    |   match /slideGroups/{groupId}                                 |
    |     get(parent).status=='draft' -----------------------> ALLOW |
    |     parent gone / no serviceId  --> delete only -------> ALLOW |
    |     everything else ------------------------------------> DENY |
    |                                                                |
    |   match /{collection}/{docId}   <-- MUST EXCLUDE BOTH ABOVE    |
    |     isOrgEditor && collection not in {services, slideGroups}   |
    +---------------------------------------------------------------+
```

### Composing with the Phase 30 R054 song-group lock — do NOT introduce a parallel mechanism

Phase 30 established two named booleans. The lifecycle lock should **narrow them**, not sit beside them:

| Existing seam | Location | Today | After |
|---|---|---|---|
| `canMutate` | `EditSlideDrawer.vue:432` | `props.isEditor && !isSongGroup` | `props.isEditor && !isSongGroup && props.serviceEditable` |
| `canReorder` | `SlideGrid.vue:596` | `props.isEditor && props.group !== null && !isSongGroup` | `… && props.serviceEditable` |
| `isExportedLocked` | `ServiceEditorView.vue:1288` | `status === 'exported'` | rename to `isServiceLocked`, `status !== 'draft'` |

Two reasons this is the right shape rather than a second flag threaded in parallel:

1. **The two locks have different scopes and must not collapse.** R054's song-group lock is *per-slot*
   (song groups only) and deliberately leaves **group-level media working** —
   `SlideGroupMusicControl` is gated on `isEditor` alone (`SlideGrid.vue:61-68`), which
   `30-VERIFICATION.md` truth 5 verifies as intentional. The lifecycle lock is *per-service* and per D-06
   **does** close group media. So `serviceEditable` must gate `SlideGroupMusicControl` too — a place
   `canMutate` does not currently reach.
2. **`isExportedLocked` is already wrong for this phase's purposes and is used ~15 times** in the Service
   Order template (`:453, :463, :492, :502, :510, :617, :666, :690, :703, :729, :776, :822, :867, :880, :897`).
   Widening the one computed converts all of them at once. Its tooltip copy at `:135` (*"cycle badge back
   to Draft to edit"*) describes the behaviour D-01 deletes and must change with it.

### ★ Gate the handlers, not just the templates (30-VERIFICATION I-01)

I-01 records that six of seven Slides-tab mutation entry points are guarded by template `v-if` **alone**;
only `onLoopToggle` has a handler-level guard (`EditSlideDrawer.vue:597`). That is not a defect today
because nothing is exposed. **It becomes one under a lifecycle lock**, for a reason specific to *this*
phase and not present in Phase 30: **the R054 lock is static for a given slot, but the lifecycle lock
flips while the component is mounted.** A user on the Slides tab clicks "Mark as Planned"; a debounced
label/notes write scheduled 300ms earlier (`EditSlideDrawer.vue:830` `scheduleWrite`) is still pending. The
template re-renders and hides the field, but the timer already holds its closure and fires into a now-locked
service. A `v-if` cannot cancel a pending timer.

Concretely, the plan must:
- Add `if (!canMutate.value) return` at the top of every handler listed in `31-PATTERNS.md` §4c, matching
  the shape already at `EditSlideDrawer.vue:597`.
- **Cancel or no-op pending debounced writes** when the lock engages, not merely hide their inputs.
- Do the same for the Service Order's `onSlotSortEnd` (`:1410`), which `31-PATTERNS.md` §4a records as
  having **no** lock at all today — drag-reorder currently works on an exported service.

### Where the store guard reads status from

`src/stores/services.ts` already holds `services: Ref<Service[]>` and each carries `status`. A guard can
therefore be a pure store-local lookup with no extra I/O:

```typescript
function isServiceEditable(id: string): boolean {
  const svc = services.value.find((s) => s.id === id)
  // Absent (not yet loaded) or legacy (no status) -> treat as editable, matching
  // the rules layer's resource.data.get('status','draft') default. The two layers
  // MUST agree on this default or the UI offers writes the server rejects.
  return !svc || (svc.status ?? 'draft') === 'draft'
}
```

The three writes that must **bypass** it: `createService` (always creates a draft), the export write, and
the reopen write. Recommendation: keep `updateService` unguarded as the low-level primitive and add
**named** actions — `markAsPlanned(id)`, `reopenForEditing(id)`, plus a guard inside the mutating actions
(`assignSongToSlot`, `clearSongFromSlot`, `setRoleOverride`, `clearRoleOverride`). A blanket guard inside
`updateService` would block the export and reopen writes, which is D-09's failure mode reproduced one
layer up.

`src/stores/slideGroups.ts` has a harder problem: **it does not know the service status** — its actions
take `(orgId, slotId, …)` and never see a `Service`. Its `SlideGroup` documents do carry `serviceId`
(`types/slideGroup.ts:37`), so the guard can cross-read `useServiceStore().services`. That introduces a
store→store dependency, for which `services.ts:120` (`useSongStore()` inside an action) is the in-repo
precedent.

---

## R038: the Sunday-search wiring

### Reuse `quarterDates.ts`? Partially — and there is a gotcha

`generateSundaysInQuarter(year, quarter)` (`src/utils/quarterDates.ts:11-24`) contains exactly the Sunday
arithmetic needed — `d.setDate(d.getDate() + ((7 - d.getDay()) % 7))` to advance to the first Sunday on or
after a date, then `+7` in a loop — and it is well tested. **But:**

- Its `fmtDate` helper (`:4-5`) is a **module-private `const`, not exported.** Any new function in that
  file can use it; a function in a *new* file cannot, and would duplicate a third copy of the same
  formatter (`NewServiceDialog.vue:142-145` and `ServicesView.vue:205-209` are copies one and two).
- `generateSundaysInQuarter` is quarter-bounded. D-13's ~52-Sunday forward walk crosses quarter and year
  boundaries, so it cannot be called directly.

**Recommendation:** add `nextFreeSunday(takenDates: string[], today?: Date): string` **to
`src/utils/quarterDates.ts`** — same file, so it reuses the private `fmtDate` rather than forking it, and
inherits the existing test file. Keep it pure and inject `today` for testability (the module's own header
comment already commits to "no `Date.now()`", so accept an optional injected date rather than reading the
clock unconditionally).

```typescript
/**
 * D-12/D-13: the next Sunday on or after `today` that is not already taken,
 * walking FORWARD only, bounded at 52 weeks. On exhaustion returns the plain
 * next Sunday — the field is never blank, and the degenerate case degrades to
 * exactly the pre-R038 behaviour.
 */
export function nextFreeSunday(takenDates: Iterable<string>, today: Date = new Date()): string {
  const taken = new Set(takenDates)
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  // Strictly forward: if today IS Sunday, start at the NEXT one, matching
  // NewServiceDialog's current nextSunday() (day === 0 -> +7).
  d.setDate(d.getDate() + (d.getDay() === 0 ? 7 : 7 - d.getDay()))
  const first = fmtDate(d)
  for (let i = 0; i < 52; i++) {
    const candidate = fmtDate(d)
    if (!taken.has(candidate)) return candidate
    d.setDate(d.getDate() + 7)
  }
  return first
}
```

Note the forward-only start: today's `nextSunday()` (`NewServiceDialog.vue:136-146`) uses
`day === 0 ? 7 : 7 - day`, i.e. a service created **on** a Sunday defaults to the *following* Sunday, not
today. That is existing behaviour and D-12/D-13 do not ask to change it — preserve it, and say so in the
test, so a future reader does not "fix" it.

### Wiring — prop from `ServicesView`, not store access in the dialog

`ServicesView.vue` already subscribes (`:338`) and already derives filtered lists from
`serviceStore.services` (`:213-241`). `NewServiceDialog` is a pure prop/emit component today
(`props: { open }`, emits `close` / `create`) with **zero** store imports.

**Recommendation: pass `:taken-dates="serviceStore.services.map(s => s.date)"` as a prop.** Reasons:

1. It keeps the dialog pure and unit-testable without a Pinia instance. The component currently has **no
   test file at all** (`src/components/__tests__/` has 21 files, none for `NewServiceDialog`); giving it
   one is far cheaper if it stays store-free.
2. `ServicesView` is the only mount site.
3. R038's date default must be recomputed **when the dialog opens**, and the existing
   `watch(() => props.open)` at `:174-181` is already exactly that trigger — `defaultForm()` just needs
   the taken set in scope.

**One trap in `defaultForm()`:** it derives `teams` from `sundayOrdinal(date)` (`:162-169`), and a separate
`watch(() => form.value.date)` (`:184-196`) *also* recomputes `teams` on every date change. Changing the
default date from "next Sunday" to "next free Sunday" changes which ordinal-of-month the dialog opens on,
so **the default team selection changes too**. That is arguably correct (the teams should match the actual
date), but it is a visible behavioural change beyond R038's wording. Flag it in the plan rather than let
it surface as a surprise in UAT.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| "Which fields did this write touch?" | Manual `request.resource.data.x == resource.data.x` chains per field | `request.resource.data.diff(resource.data).affectedKeys().hasOnly([...])` | A manual chain enumerates the fields you *thought of*; `hasOnly` is closed by default, so a field added to `Service` next month is denied automatically rather than silently permitted. Verified strict (B15). |
| Missing-field defaults in rules | `resource.data.status != null ? resource.data.status : 'draft'` | `resource.data.get('status', 'draft')` | Ternaries on a possibly-absent key still evaluate the key access. `.get()` is the built-in and is what makes legacy documents work (B11). |
| Cancelling a debounced write when the lock engages | A new "is a write pending" tracker | The existing handler-guard shape at `EditSlideDrawer.vue:597` (`if (!canMutate.value) return`) placed inside the debounce callback | The flag is already reactive; re-reading it at fire time is enough. A separate tracker is a second source of truth for the same fact. |
| Confirm dialog for Reopen (D-10) | A new shared `<ConfirmDialog>` component | The hand-rolled `<Teleport to="body">` blocks already in `ServiceEditorView.vue` (delete-confirm at `:211-237`, slot-delete at `:239-263`) | The repo has **no** shared confirm component and three in-file instances in this one view. Introducing an abstraction here is a refactor smuggled into a lock phase. |
| YYYY-MM-DD formatting | A fourth copy of the `y-m-d` padder | `fmtDate` inside `src/utils/quarterDates.ts` (add `nextFreeSunday` to that same file) | Three copies exist already (`quarterDates.ts:4`, `NewServiceDialog.vue:142`, `ServicesView.vue:205`). Do not make it four. |
| Optimistic-write rollback for the lock | Custom revert logic | Do not issue the write — Layer B | `onToggleOverridePerson` (`:2682-2720`) already shows how much code an optimistic-update rollback costs. Guarding before the write is strictly cheaper than reverting after `permission-denied`. |

**Key insight:** every "clever" thing this phase needs already exists as a rules-language builtin or an
in-repo seam. The failure mode here is not under-engineering — it is adding a fourth mechanism next to
three that already work.

---

## Common Pitfalls

### Pitfall 1 ★ — The wildcard catch-all makes the new rule a no-op
**What goes wrong:** the status guard is added to `/services/{docId}`, the diff reads correctly, code
review passes, and locked services remain fully editable in production.
**Why it happens:** `firestore.rules:71-73`'s `match /{collection}/{docId}` also matches `services`, and
rules are OR-evaluated. Nothing in the `/services` block hints at this.
**How to avoid:** add `&& collection != 'services' && collection != 'slideGroups'` to the catch-all in the
same commit; then extend the `/services` block to cover `create`/`update`/`delete` explicitly, since the
catch-all no longer backstops it.
**Warning signs:** the new `assertFails` test in `src/rules.test.ts` passes on the first try without the
catch-all change — that means the test is not exercising what you think.

### Pitfall 2 ★ — `hasAll(['pcPlanId'])` breaks re-export, which is D-11's whole purpose
**What goes wrong:** re-exporting a reopened service to the same Planning Center plan gets
`permission-denied`. Exporting to a *new* plan works, so it looks intermittent.
**Why it happens:** `affectedKeys()` reports only keys whose **value** changed. Re-writing an identical
`pcPlanId` is invisible to the diff.
**How to avoid:** `hasAll(['pcExportedAt'])` (always a fresh `serverTimestamp()`) plus
`request.resource.data.pcPlanId is string` for presence.
**Warning signs:** a rules test that only ever exports a service which had no prior `pcPlanId`.

### Pitfall 3 ★ — The `slideGroups` rule breaks service *loading*, not just editing
**What goes wrong:** opening any locked service floods the console with `permission-denied` from
`materializeGroupIfMissing` / `replaceGroupSlides`. No user action triggered it.
**Why it happens:** `useSlideshowAssembly`'s watchers run `{ immediate: true }` on mount, gated only on
`canWrite = isEditor`.
**How to avoid:** narrow `canWrite` at `ServiceEditorView.vue:1366` to
`isEditor && localService.value?.status === 'draft'` **in the same commit as the rule**.
**Warning signs:** the change is split across two commits "for reviewability" — the intermediate commit is
broken in production even if both are merged together, because rules deploy separately from the bundle.

### Pitfall 4 — Reading the INCOMING status instead of the STORED one
**What goes wrong:** `request.resource.data.status == 'draft'` used as the gate; any write that also sets
`status: 'draft'` edits a locked service — the exact payload an attacker sends.
**How to avoid:** gate branch 1 on `resource.data.get('status','draft')`. The incoming value appears only
inside the two narrow carve-outs, each constrained by `hasOnly`.
**Warning signs:** no test seeds a document at `exported` and then writes `{status:'draft', slots:[…]}` in
a single payload. That test (probe B4) is mandatory.

### Pitfall 5 — Orphan and legacy slide groups become permanently unwritable
**What goes wrong:** a group whose parent service was deleted, or a legacy group with no `serviceId`,
can be neither updated nor deleted — the rule errors on the missing document and denies everything.
**How to avoid:** `exists()`-guard the parent lookup, and make `allow delete` explicitly more permissive
than `allow update` (`parentGone(...)` / missing-`serviceId` branches).
**Warning signs:** rules tests only ever seed groups whose parent service exists.

### Pitfall 6 — Rules do not ship with the app
**What goes wrong:** the phase merges, `npm run build` deploys the bundle, and the lock is not enforced
because `firestore.rules` was never deployed. There is **no CI** in this repo (`.github/workflows` does
not exist `[VERIFIED: ls]`) — deployment is manual `firebase deploy --only firestore:rules`.
**How to avoid:** make the deploy an explicit task in the plan, and make the UAT step verify against the
deployed project, not the emulator.

### Pitfall 7 — The Delete button's status is undecided
**What goes wrong:** D-08 enumerates the non-editing actions that stay live (Export/Copy, Present, Print,
Share) and **does not mention Delete**. The proposed rule allows deleting a locked service (B13). If the
UI hides Delete under D-05's "controls removed", the rule and the UI disagree.
**How to avoid:** decide explicitly. Recommendation: **keep Delete available** — deleting a plan is not
*editing* it, and a locked service with no delete path is a dead end requiring a reopen-just-to-delete
dance. See Open Questions.

### Pitfall 8 — `onSave` writes `status` on every save
`ServiceEditorView.vue:2773-2781` sends `status: data.status` in the ordinary full-document save. This is
harmless under the proposed rule (branch 1 short-circuits on the stored status) but it is why branch 1
cannot also constrain the outgoing status, and therefore why the draft→exported residual hole (D4) exists.
Do not "tighten" branch 1 without re-running B1.

---

## Code Examples

### Reopen — the store action (R037 / D-11)

```typescript
// src/stores/services.ts
// The ONLY status-reverting write. Deliberately does NOT clear pcExportedAt or
// pcPlanId (D-11) — preserving them lets a re-export update the same Planning
// Center plan via exportMode:'existing' instead of creating a duplicate, and
// keeps D-04's evidence gate working on a second reopen.
//
// Writes status + updatedAt ONLY. The firestore.rules reopen carve-out is
// `hasOnly(['status','updatedAt'])`, so adding any other field here — however
// benign — turns this into a permission-denied. (Verified: probe B15.)
async function reopenForEditing(id: string): Promise<void> {
  if (!orgId.value) return
  await updateDoc(doc(db, 'organizations', orgId.value, 'services', id), {
    status: 'draft',
    updatedAt: serverTimestamp(),
  })
}
```

### The rules test shape (mirrors `src/rules.test.ts:585` exactly)

```typescript
// src/rules.test.ts — extends the existing describe/seedDoc/seedMembershipDoc harness.
it('denies a slots edit on a planned service', async () => {
  await seedMembershipDoc('orgA', 'userA', 'editor')
  await seedDoc('organizations/orgA/services/svc1', { status: 'planned', slots: [] })
  const db = testEnv.authenticatedContext('userA').firestore()
  await assertFails(
    updateDoc(doc(db, 'organizations', 'orgA', 'services', 'svc1'), {
      slots: [{ id: 'x' }],
      updatedAt: serverTimestamp(),
    }),
  )
})

it('★ denies a slots edit that smuggles status:draft into the same payload', async () => {
  await seedMembershipDoc('orgA', 'userA', 'editor')
  await seedDoc('organizations/orgA/services/svc1', { status: 'exported', slots: [] })
  const db = testEnv.authenticatedContext('userA').firestore()
  await assertFails(
    updateDoc(doc(db, 'organizations', 'orgA', 'services', 'svc1'), {
      status: 'draft',
      slots: [{ id: 'HACKED' }],
      updatedAt: serverTimestamp(),
    }),
  )
})
```

Note: the existing file imports `{ doc, getDoc, setDoc, deleteDoc }` from `firebase/firestore`
(`rules.test.ts:9`). The new tests additionally need `updateDoc` and `serverTimestamp` — `setDoc` without
`{merge:true}` is a full replace and will not produce the partial diffs these branches depend on.

### Narrowing `canWrite` (Pitfall 3)

```typescript
// src/views/ServiceEditorView.vue:1366
// canWrite gates THREE writing sites in useSlideshowAssembly (:268 materialization
// watcher, :340 ensureGroupMaterialized, :396 rebuild watcher). The first and third
// run { immediate: true } on mount — without the status term, every locked service
// throws permission-denied on LOAD once the slideGroups rule is deployed.
} = useSlideshowAssembly(localService, orgIdRef, {
  canWrite: computed(() => authStore.isEditor && localService.value?.status === 'draft'),
})
```

---

## Runtime State Inventory

Not a rename/refactor phase, but three categories of **existing stored data** interact with the new rule
and must be answered rather than assumed.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data — services with no `status` field | Unknown count. `createService` (`services.ts:74`) has always written `status:'draft'`, so this should be empty, but no audit was run. The rule handles it via `resource.data.get('status','draft')` — **no migration needed either way**. `[VERIFIED: probe B11 proves the handling; the count is ASSUMED zero]` | None — defensive default already in the rule. |
| Stored data — services at `exported` that were never really exported | Expected to exist; D-04 exists precisely because the old blind `toggleStatus` cycle could set it. These carry no `pcExportedAt`/`pcPlanId`. | **None (D-04 decision).** They reopen without a false warning and self-correct. Do **not** write a migration. |
| Stored data — `slideGroups` with no `serviceId` | Should be none: every create path writes it (`materializeGroupIfMissing` spreads `SlideGroupInput` which requires `serviceId`; `setGroupBedMedia`'s skeleton writes it at `slideGroups.ts:195`). Not audited. | If any exist they become **update-denied but delete-allowed** (E4). Recommend a one-off read-only audit query before deploy; no code change. |
| Live service config | None — no external service holds service status. | None. |
| OS-registered state | None. | None. |
| Secrets / env vars | None changed. `.env.local` is untouched by this phase. | None. |
| Build artifacts | None. `firestore.rules` is not bundled; it deploys separately (Pitfall 6). | Explicit `firebase deploy --only firestore:rules` task. |

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Firebase CLI (`npx firebase`) | `npm run test:rules`, rules deploy | ✓ | 15.18.0 | — |
| Java runtime | Firestore emulator's rules engine | ✓ | 25.0.2 LTS | — |
| Firestore emulator (port 8080) | rules tests | ✓ | **already running** in this environment | — |
| `.env.local` | full unit suite, build | ✓ present in main checkout | — | Symlink/copy per `CLAUDE.md` in any new worktree |
| `@firebase/rules-unit-testing` | rules tests | ✓ | ^5.0.0 | — |
| CI pipeline | automated rules deploy | ✗ | — | **No fallback — deploy is manual.** See Pitfall 6. |

**Note for the planner:** port 8080 was occupied by an already-running emulator during this research, so
`firebase emulators:exec` failed with *"Could not start Firestore Emulator, port taken"*. The workaround is
to run vitest directly against the live emulator with `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080`. Budget for
this — a developer with a dev emulator open cannot run `npm run test:rules` as written.

**Missing dependencies with no fallback:** CI. Rules correctness is enforced only by a human remembering to
run `npm run test:rules` and `firebase deploy --only firestore:rules`.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 4.0.18 |
| Unit config | `vite.config.ts` → `test.environment: 'jsdom'`, **excludes `src/rules.test.ts`** |
| Rules config | `vitest.rules.config.ts` → `environment: 'node'`, `testTimeout: 30000`, `fileParallelism: false` |
| Quick run command | `npx vitest run src/views/__tests__/ServiceEditorView.test.ts` |
| Full unit suite | `npm run test:unit -- --run` |
| Rules suite | `npm run test:rules` (needs the emulator; see Environment note for the port-conflict workaround) |

### Phase Requirements → Test Map

| Req | Behavior | Type | Command | File Exists? |
|-----|----------|------|---------|-------------|
| R036 | Locked service rejects a `slots` edit at the rules layer | rules | `npm run test:rules` | ✅ `src/rules.test.ts` (extend) |
| R036 ★ | Payload-forgery (`status:'draft'` + `slots`) rejected | rules | `npm run test:rules` | ✅ extend |
| R036 ★ | Catch-all no longer grants write to `services` / `slideGroups` | rules | `npm run test:rules` | ✅ extend |
| R036 | `slideGroups` write rejected under a locked parent | rules | `npm run test:rules` | ✅ extend |
| R036 | `setRoleOverride` dot-path write rejected on a locked service | rules | `npm run test:rules` | ✅ extend |
| R036 | Store guard refuses to issue writes for a locked service | unit | `npx vitest run src/stores/__tests__/services.test.ts` | ❓ verify a store test file exists — Wave 0 if not |
| R036 | Locked service renders no mutation controls on all three tabs | unit | `npx vitest run src/views/__tests__/ServiceEditorView.test.ts` | ✅ 2228 lines, `shallowMount` harness |
| R036 | `canMutate` / `canReorder` false when the service is locked | unit | `npx vitest run src/components/slides/` | ✅ existing drawer/grid suites |
| **R036 ★** | Opening a locked service issues **no** `slideGroups` write | unit | `npx vitest run src/composables/__tests__/useSlideshowAssembly.test.ts` | ✅ (Pitfall 3 regression guard — the highest-value new unit test in the phase) |
| R037 | Reopen writes `status`+`updatedAt` only and is accepted | rules | `npm run test:rules` | ✅ extend |
| R037 | Reopen preserves `pcExportedAt` / `pcPlanId` (D-11) | unit | `ServiceEditorView.test.ts` | ✅ |
| R037 | Warning shown only with pc evidence (D-04) | unit | `ServiceEditorView.test.ts` | ✅ |
| **D-09 ★** | Export write (planned→exported + pc fields) accepted | rules | `npm run test:rules` | ✅ extend |
| **D-11 ★** | **Re-export to the SAME `pcPlanId` accepted** | rules | `npm run test:rules` | ✅ extend — *this is the test that catches Pitfall 2* |
| R038 | `nextFreeSunday` skips taken Sundays, forward-only, bounded at 52 | unit | `npx vitest run src/utils/__tests__/quarterDates.test.ts` | ✅ existing file |
| R038 | Dialog defaults to the first free Sunday | unit | `npx vitest run src/components/__tests__/NewServiceDialog.test.ts` | ❌ **Wave 0 — no test file for this component** |

### Sampling Rate

- **Per task commit:** the narrowest relevant file, e.g. `npx vitest run src/utils/__tests__/quarterDates.test.ts`
- **Per wave merge:** `npm run test:unit -- --run` **plus** `npm run test:rules` — the rules suite does
  **not** run in the unit suite and a wave that touches `firestore.rules` is unverified without it.
- **Phase gate:** both suites green, plus `npx vue-tsc --build`, before `/gsd-verify-work`.

### Wave 0 Gaps

- [ ] `src/components/__tests__/NewServiceDialog.test.ts` — new file, covers R038
- [ ] Confirm a store test harness exists for `src/stores/services.ts`; create if absent
- [ ] Extend `src/rules.test.ts` imports with `updateDoc` + `serverTimestamp` (currently only
      `doc, getDoc, setDoc, deleteDoc` at `:9`)

**Known-good baseline to compare against (NOT defects):** `src/storage.rules.test.ts` (needs the Storage
emulator) and `src/views/__tests__/RosterView.test.ts` (stale assertion). 1757 tests pass otherwise.

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no (unchanged) | Firebase Auth, already in place |
| V3 Session Management | no | — |
| **V4 Access Control** | **yes — this is the whole phase** | Firestore Security Rules; **server-side** state-transition enforcement. The controlling principle: the client is not trusted to report the current status, hence `resource.data` not `request.resource.data`. |
| V5 Input Validation | partial | `hasOnly()` as an allowlist on the write payload — closed by default |
| V6 Cryptography | no | — |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation | Status here |
|---------|--------|---------------------|-------------|
| Client-asserted state ("I'm a draft, honest") | Spoofing | Read stored state (`resource.data`) as the gate | ✅ verified B4 |
| Field smuggling — a permitted transition carrying an unpermitted payload | Tampering | `diff().affectedKeys().hasOnly([...])` allowlist | ✅ verified B15 |
| Overly-broad rule shadowing a narrow one | Elevation of Privilege | Constrain the wildcard catch-all | ✅ verified A1/A2 — **and it is the live state of the repo today** |
| Cross-document reference forgery (`serviceId` on create) | Tampering | Immutable after create (E2); create-side is **not** closable in rules | ⚠️ **accepted residual** — attacker must already be an org editor |
| Illegal state transition (exported → planned) | Tampering | Enumerate legal edges only | ✅ verified B9 |
| Denial of service via wedged documents | Denial of Service | `exists()`-guarded parent lookup; permissive `delete` | ✅ verified E3/E4 (an earlier iteration was genuinely wedged) |

**Nothing in this phase changes the tenancy boundary.** Every new rule is nested under
`isOrgMember(orgId)` / `isOrgEditor(orgId)`, which the existing cross-org isolation tests
(`rules.test.ts:91-105`) already cover. The lock is an intra-org workflow guarantee, not a privilege
boundary between principals.

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Manual per-field equality chains to detect what a write touched | `Map.diff()` → `MapDiff.affectedKeys()` → `Set.hasOnly/hasAll` | Allowlist semantics; closed by default as the schema grows |
| `resource.data.field != null ? … : default` for absent fields | `resource.data.get(key, default)` | Legacy documents without the field stop erroring |
| Single `allow write:` per collection | Split `create` / `update` / `delete` | Required whenever a rule reads `resource.data` — that expression errors on `create`. The repo already does this at `quarterShares` (`firestore.rules:114-122`) and `serviceShares` (`:131-139`); `/services` (`:51-54`) is the outlier that must be brought in line. |

**Deprecated/outdated in this codebase:**
- `toggleStatus` (`ServiceEditorView.vue:1796`) — D-01 deletes it.
- `isExportedLocked`'s name and its tooltip copy at `:135` ("cycle badge back to Draft to edit") — describes
  a control that will no longer exist.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Production data contains **zero** `services` documents lacking a `status` field | Runtime State Inventory | Low — the rule's `.get('status','draft')` default handles them either way (verified B11) |
| A2 | Production data contains **zero** `slideGroups` documents lacking `serviceId` | Runtime State Inventory | Medium — such groups become update-denied. Still deletable (E4), so recoverable, but users would see silent write failures on those slots. **Recommend a read-only audit before deploy.** |
| A3 | Typical service has 4–9 materialized slide groups (basis for the denormalisation fan-out estimate) | Research Question 2 | Low — derived from `buildSlots('1-2-2-3')` returning 9 slots (`slotTypes.ts:284-295`) minus slots with no derived slides. Only affects a rejected option. |
| A4 | Slide-write volume is low enough that +2 billed reads per write is immaterial | Research Question 2 | Low — writes are strictly per-user-action after `canWrite` is narrowed |
| A5 | Keeping Delete available on a locked service is the desired product behaviour | Pitfall 7 / Open Questions | Medium — a UI/rules disagreement is a user-visible inconsistency. **Needs an owner decision.** |
| A6 | Firestore's read-cost model has not changed since training (used only qualitatively — "immaterial at this scale") | Research Question 2 | Very low — no absolute figure is relied upon |

---

## Open Questions

1. **Is Delete available on a locked service?**
   - What we know: D-08 lists the non-editing actions that stay live and does not include Delete. The
     proposed rule allows it (verified B13). `onDelete` (`:2729`) has no lock today.
   - What's unclear: whether "read-only" is meant to encompass deletion.
   - Recommendation: **keep Delete live.** Deleting a plan is not editing it, and hiding it strands locked
     services behind a reopen-just-to-delete dance. If the owner disagrees, both the UI *and* the
     `allow delete` clause must change together — do not let them diverge.

2. **Does the Roles tab lock apply to the "Reset to schedule" action?**
   - What we know: D-06 says Roles renders as names with no checkboxes. `onResetRoleOverride`
     (`:2722`) is a separate button (`:957-964`) that also writes (`clearRoleOverride`).
   - Recommendation: lock it. It is a mutation, and the rule denies it regardless (it is a
     `roleAssignmentOverrides` write, B12) — leaving the button visible would produce a dead button that
     silently fails.

3. **What does the Slides tab show for a locked service whose groups never materialized?**
   - What we know: suppressing materialization (recommended) means a service locked before its slides
     rendered shows fewer slides until reopened.
   - Recommendation: accept, and let the lock banner carry the explanation. The alternative — permitting
     creates while locked — is unenforceable at the rules layer anyway (E6).

4. **Does changing the default date change the default team selection?**
   - What we know: `defaultForm()` derives `teams` from `sundayOrdinal(date)` (`NewServiceDialog.vue:162-169`).
     A different default Sunday can be a different ordinal-of-month.
   - Recommendation: accept — the teams should match the actual date — but call it out in the plan and the
     UAT script so it is not read as a regression.

---

## Sources

### Primary (HIGH confidence)
- **Firestore emulator, executed 2026-07-29** — 36 assertions across two throwaway probe suites
  (`src/probe31.rules.test.ts`, `src/probe31b.rules.test.ts`, both deleted after the run) against
  `@firebase/rules-unit-testing` 5.x on the local emulator at `127.0.0.1:8080`. Every rule fragment and
  every ✓ in this document was produced by an actual `permission-denied` or an actual accepted write.
- Repository source, read directly (the knowledge graph is stale and was not used):
  `firestore.rules`, `src/rules.test.ts`, `vite.config.ts`, `vitest.rules.config.ts`, `package.json`,
  `firebase.json`, `src/stores/services.ts`, `src/stores/slideGroups.ts`, `src/views/ServiceEditorView.vue`,
  `src/views/ServicesView.vue`, `src/components/NewServiceDialog.vue`,
  `src/components/slides/EditSlideDrawer.vue`, `src/components/slides/SlideGrid.vue`,
  `src/composables/useSlideshowAssembly.ts`, `src/utils/quarterDates.ts`, `src/utils/slotTypes.ts`,
  `src/types/service.ts`, `src/types/slideGroup.ts`
- `.planning/phases/30-…/30-VERIFICATION.md` § I-01 and truth 5
- `.planning/phases/31-…/31-PATTERNS.md` (parallel pattern map — the exhaustive 41-row mutation-entry-point
  inventory lives there; this document does not duplicate it)

### Secondary (MEDIUM confidence)
- `firebase.google.com/docs/firestore/security/rules-conditions` — `get()`/`exists()` limits (10 single-doc,
  20 multi-doc/transaction/batch), billing on rejected reads, `resource` vs `request.resource`
- `firebase.google.com/docs/rules/rules-language` — OR evaluation of overlapping matches; broader rules
  shadowing narrower ones

### Tertiary (LOW confidence)
- None relied upon. The `MapDiff` reference page did not render usefully via fetch, so every `MapDiff`
  behaviour claim here was instead established by execution rather than citation.

---

## Metadata

**Confidence breakdown:**
- Firestore rules semantics & the proposed rules: **HIGH** — executed, not reasoned. Includes one claim
  (`hasAll(['pcPlanId'])`) that reasoning got *wrong* and execution caught.
- Catch-all bypass (Finding 0): **HIGH** — executed both directions (bypass reproduced, fix confirmed).
- `slideGroups` recommendation: **HIGH** on mechanics and failure modes (executed); **MEDIUM** on the
  fan-out cost estimate for the rejected denormalisation option (derived, not measured).
- Layer composition & mutation inventory: **HIGH** — read from source; cross-checked against the
  independently-produced `31-PATTERNS.md`.
- R038 wiring: **HIGH** — all four relevant files read in full.
- Production data shape (A1/A2): **LOW** — not audited. Flagged in the Assumptions Log.

**Research date:** 2026-07-29
**Valid until:** 2026-08-28 (30 days — Firestore rules language is stable; the repo-specific findings are
valid until `firestore.rules` or `useSlideshowAssembly.ts` changes)
