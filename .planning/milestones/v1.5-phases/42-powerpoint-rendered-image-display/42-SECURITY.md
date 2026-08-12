---
phase: 42
slug: powerpoint-rendered-image-display
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: 2026-08-07
---

# Phase 42 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

> ## ⚠⚠ THIS PHASE FOUND AND CLOSED A LIVE PRODUCTION VULNERABILITY — AND IT IS STILL OPEN
>
> **The code fix is real and independently verified. Production is not yet protected.**
>
> `firestore.rules`'s generic `match /organizations/{orgId}/{collection}/{docId}` granted
> `allow write: if isOrgEditor(orgId)` with only `'services'` and `'slideGroups'` excluded. Firestore
> rules are **OR-evaluated**, so the catch-all deny at the bottom of the file never applied. An org
> editor could therefore **write** `organizations/{orgId}/pptxRenders/{importId}` and forge a render
> `ready` flip — threat **T-37-15**, the exact thing `functions/src/index.ts:342` states the render
> service must never be able to produce.
>
> **This was proven, not inferred.** Plan 42-01 Task 1 ran a client-SDK `updateDoc` asserted to
> **succeed** pre-fix. It did. That also disproves `functions/src/index.ts:144-148`, which claims the
> catch-all denies client access to this collection.
>
> **Nothing was deployed** (STATE.md standing autonomy grant). So
> **T-37-15 / T-42-01 remains live in production right now** and closes only when the owner runs the
> single outstanding `firebase deploy --only firestore:rules` — which now carries **two phases'** worth
> of undeployed rules fixes (Phase 41's and Phase 42's), in one deploy.
>
> Scope is bounded: an org editor can forge only their *own* org's render document, and the worst
> outcome is their own deck displaying a wrong state. It is not cross-tenant. But it is live.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Org editor ↔ `organizations/{orgId}/pptxRenders/{importId}` | **The vulnerability.** Write was reachable via the generic wildcard; now excluded. Writes are Admin-SDK-only, as always intended | Render `status`, `renderedCount`, `failureReason` |
| Org **member** ↔ same document | **NEW, deliberate.** A dedicated read-only block, so read access is stated rather than an accident of wildcard fallthrough | Same three fields |
| Cloud Run render service → Storage | Pre-existing, already deployed and production-confirmed 2026-08-06. Untouched by this phase | Rendered PNGs under `orgs/{orgId}/pptx-imports/{importId}/` |
| Client ↔ Storage rendered PNGs | Pre-existing `match /orgs/{orgId}/{allPaths=**}` read gate; no change needed | Image bytes |
| Server-controlled string → DOM | `failureReason` is a machine slug from the render service. It must never be rendered raw | Mapped to one of exactly three authored sentences |

---

## Threat Register

| Threat ID | Category | Severity | Disposition | Mitigation | Status |
|-----------|----------|----------|-------------|------------|--------|
| **T-42-01** | Tampering | **high** | mitigate | The headline. `firestore.rules:186-188` adds a dedicated read-only `pptxRenders` block; `:232-238` adds `'pptxRenders'` to the generic wildcard's write exclusion. **The entire 357-line rules file was audited** for any other rule that could still match this path for write — none exists. Proven by 7 emulator cases (`src/rules.test.ts:1496-1591`): the RED→GREEN write-DENY probe, ALLOW read, DENY cross-org read, DENY anon read, DENY create (viewer), DENY create (editor), DENY delete (editor) | closed |
| T-42-02 | Information Disclosure | low | accept | See Accepted Risks Log | closed |
| T-42-03 | Information Disclosure | medium | mitigate | Read is gated on `isOrgMember(orgId)` evaluated against the path's own `orgId` segment. `src/rules.test.ts:1525-1546` — DENY foreign-org editor read, DENY unauthenticated read | closed |
| T-42-04 | Tampering | medium | mitigate | `slideDisplay.ts:66-91` — `RENDER_FAILURE_SENTENCES` is a closed `Record` and `renderFailureSentence()` has an explicit fallback arm, so the return value is **always one of exactly three authored sentences**. No interpolation, no pass-through — a server-controlled string cannot reach the DOM. One table, consumed identically by `SlideCard.vue:164,205` and `PresentationViewer.vue:465-467` | closed |
| T-42-05 | Tampering | medium | mitigate | `src/types/pptxRender.ts:19-25` — the client `PptxRenderDoc` declares exactly 3 members and **deliberately omits the server's `storagePath`**. `importedRenderReconciler.ts:237-246` sources `imageUrl` only from the caller-supplied `renderedUrls` array; no render-document field is read for path construction | closed |
| T-42-06 | Denial of Service | low | mitigate | `pptxRenders.ts:60-93` — `syncSubscriptions` diffs id sets and closes departed listeners; `useSlideshowAssembly.ts:749` wires `onScopeDispose(cleanup)`. Includes the WR-05 remove-then-re-add regression test | closed |
| **T-42-07** | Spoofing | **high** | mitigate | Wrong-deck rendering — one deck's render shown under another's identity, invisible to the operator and maximally public on a projection screen. `importedRenderReconciler.ts:86-92` checks `!deck.renderImportId` unconditionally first; `useSlideshowAssembly.ts:253-254,298-301` keys the cache `${renderImportId}:${renderedCount}` with an eviction loop. Verified at **every** layer: store, reconciler, materializer, assembler, composable cache | closed |
| T-42-08 | Elevation of Privilege | medium | **transfer** | Deploy-gated. `.planning/PENDING-VERIFICATION.md:888-893` cross-references (does not duplicate) Phase 41's single deploy checkbox and states plainly that the write hole stays open until it runs. **This is the one item not closed in the real world** — see the banner above | closed (documented transfer) |
| T-42-09 | Denial of Service | medium | mitigate | `useSlideshowAssembly.ts:272-301` — page-URL batches resolve only on a cache miss; WR-01's eviction bounds the cache to ≤1 entry per `renderImportId`. With T-42-01 closed, the amplification vector (a forged `renderedCount` driving unbounded `getDownloadURL` calls) no longer exists | closed |
| T-42-10 | Tampering | medium | mitigate | `importedRenderReconciler.ts:278-285` — `importedSourceSignature` uses `\x1e`/`\x1f` ASCII control separators (invalid in XML 1.0 / PPTX text), replacing a collision-prone `:`/`\|` encoding that PPTX slide text could forge. `join('\|')` now appears exactly once in the materializer (the unrelated SONG branch) | closed |
| T-42-11 | DoS (availability of the presented artifact) | medium | mitigate | Every non-`parsed` mode returns a **defined** content object (`importedRenderReconciler.ts:224-246`), so `assembleSlideshow`'s `if (!content) continue` guard — left byte-unmodified — is unreachable for render-state entries and cannot silently shorten a live slideshow. Never-skip navigation proven by test | closed |
| T-42-12 | Information Disclosure | low | mitigate | Pending/failed content objects carry no deck text field, and both surfaces order the render-state branches ahead of the parsed-text branch — so stale parsed text is structurally unreachable when `renderState` is set (the R080 "misleadingly-stale" failure) | closed |
| T-42-SC | Tampering (supply chain) | high | accept | See Accepted Risks Log | closed |

*Severity: critical > high > medium > low — only open threats at or above `workflow.security_block_on` count toward `threats_open`*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-42-01 | T-42-02 | The new read block grants `isOrgMember`, not `isOrgEditor`. Checked rather than assumed: `PptxRenderDoc` exposes only `status`, `renderedCount`, and `failureReason` — and a viewer already sees the deck's full parsed content through `importedSlides`/`slideGroups`. Render metadata is strictly *less* sensitive than what that role can already read | gsd-security-auditor (autonomous, v1.5 standing grant) | 2026-08-07 |
| AR-42-02 | T-42-SC | No dependency change. Verified independently rather than from the plans' claim: `git log` over the full Phase 42 commit range for `package.json` / `package-lock.json` returns **empty** | gsd-security-auditor | 2026-08-07 |

---

## Unregistered Flags (informational — not blocking)

| Flag | Assessment |
|------|------------|
| WR-02 (residual) | `useSlideshowAssembly.ts`'s `cleanup()` calls the singleton store's `unsubscribeAll()`, tearing down **every** listener store-wide rather than only the calling instance's. Safe today solely because `ServiceEditorView.vue` is the only call site. Mitigated to a `import.meta.env.DEV`-gated `console.warn` tripwire (`:727-736`) — an honest hazard record, not a fix: no production signal, and the tripwire is itself untested. Not attacker-triggerable; requires a future multi-instance code change to bite |
| CR-01 residual | Per-slide customization set while a render is `pending`/`failed` is lost on transition to `ready` — the two identity key spaces never overlap, and 42-RESEARCH.md Pitfall 1 rules out a positional fix as *worse* (it would misattribute a planner's note to the wrong slide). **Classified as a data-integrity/UX defect, not a security threat**: no attacker, no unauthorized access, no privilege boundary crossed — the same category 41-SECURITY.md assigned its WR-04. Correctly kept out of the STRIDE register, and now durably recorded in `.planning/PENDING-VERIFICATION.md` so it survives a refactor rather than living only in a source comment |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-08-07 | 13 | 13 | 0 | gsd-security-auditor (ASVS L1; L2/L3-style data-flow tracing applied to T-42-01 / T-42-07 / T-42-09) |

**Evidence re-derived independently at audit time, not taken from plan or summary claims:**
- Full 357-line `firestore.rules` audit for any other rule matching this path for write — none found.
- `npm run type-check` → 0 errors.
- Targeted run of the six security-relevant suites → **283/283 passing**.
- Rules suite → **140/140** (orchestrator-reproduced); the 7 `pptxRenders` test names confirmed by grep.
- `git log` over the Phase 42 range for `package.json`/`package-lock.json` → empty.
- `git log` → **no `firebase deploy` command anywhere in the phase's history**, and the deploy checkbox
  in `PENDING-VERIFICATION.md` is still unchecked.

---

## The lesson — the third instance of the same mechanism

Phase 41's security record closed with: *"a threat model scoped to what a phase changes will miss
threats created by what a phase starts to trust — model the read edges, not only the write edges."*

Phase 42 is the same mechanism again, and now sharp enough to state as a rule. The vulnerability was
not in code this phase wrote. It was in the **generic single-segment wildcard**, whose OR-evaluated
write grant silently extends to *any new nested collection a later phase introduces* unless explicitly
excluded. This is the **third** occurrence in this codebase — `services`, then `slideGroups`, now
`pptxRenders` — and the rules file's own comment history documents all three.

> **Every new nested collection introduced anywhere under `/organizations/{orgId}/` must be checked
> against the generic wildcard's write clause before shipping. Giving the collection its own dedicated
> rule block is NECESSARY BUT NOT SUFFICIENT — the wildcard grants independently and wins under
> OR-evaluation unless explicitly excluded.**

**What went right, and is worth crediting.** Phase 42's plan-time register reasoned about this
correctly and *proactively*: the RED-then-GREEN emulator probe was designed specifically because the
codebase's own comments contradicted each other, and Task 1 carried a real STOP CONDITION in case the
premise proved false. This phase caught the issue at **plan time**; Phase 41 caught its equivalent only
at code review. The process improved.

**What went wrong, and is worth recording.** The first draft of `42-CONTEXT.md` got the direction
exactly backwards — it claimed *read* was blocked by the catch-all when in fact read worked and *write*
was the hole. Reading only the specific block and the catch-all is not a rules audit. Under
OR-evaluation, any broader matching rule above the catch-all wins, and a deny at the bottom of the file
proves nothing on its own.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter
- [x] Deploy-gated caveat recorded — **T-42-01 remains live in production until the owner deploys**

**Approval:** verified 2026-08-07 (autonomous, under STATE.md's v1.5 standing autonomy grant)
