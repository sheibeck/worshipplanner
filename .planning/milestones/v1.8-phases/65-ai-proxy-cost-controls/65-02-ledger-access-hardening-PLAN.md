---
phase: 65-ai-proxy-cost-controls
plan: 02
type: execute
wave: 2
depends_on: [65-01]
files_modified:
  - src/utils/claudeApi.ts
  - src/utils/claudeApi.test.ts
  - firestore.rules
  - src/rules.test.ts
autonomous: true
requirements: [R161, R162, R163]
must_haves:
  truths:
    - "The client (src/utils/claudeApi.ts) returns null — never throws, never crashes the UI — when the proxy responds HTTP 429 (rate limit) or 400 (model/token policy), keeping AI additive and non-blocking."
    - "A 429/400 from the cost controls is logged distinctly from a generic AI failure, so an operator can tell a deliberate cost-control rejection from a real outage."
    - "firestore.rules carries an explicit deny for client read/write of the top-level aiUsage and aiRateLimits collections (defense-in-depth), built and tested but LEFT UNDEPLOYED, with the exact deploy command handed to the owner."
  artifacts:
    - "src/utils/claudeApi.ts — logAiProxyError helper classifying 429/400; each AI call's catch still returns null"
    - "src/utils/claudeApi.test.ts — regression guard proving 429 and 400 resolve to null (non-throwing)"
    - "firestore.rules — explicit deny blocks for aiUsage and aiRateLimits (UNDEPLOYED, owner deploys)"
    - "src/rules.test.ts — deny assertion for the two collections (emulator-run)"
  key_links:
    - "collection names aiUsage / aiRateLimits match exactly what plan 65-01 writes"
    - "the deny rule is NOT a dependency of any 65-01 success criterion — the function writes via Admin SDK regardless, and top-level collections are already denied by the catch-all; this rule only makes the intent explicit and future-proofs against a nested-wildcard refactor"
---

<objective>
Two low-risk hardening deliverables that sit around the autonomous core (65-01), isolated here because
they cross a file/deploy-class boundary:

1. Client graceful-surface guard (app suite): the proxy can now legitimately return HTTP 429 (R161) and
   400 (R162) — a failure mode that did not exist before this phase. Confirm and regression-guard that
   `src/utils/claudeApi.ts` treats those as a graceful, non-blocking AI error (returns null, never
   throws — AI is additive per the project's Key Decisions), and logs them distinctly.

2. Owner-gated defense-in-depth (UNDEPLOYED): an explicit deny in firestore.rules for the new top-level
   aiUsage (R163 ledger) and aiRateLimits collections, so client access is closed explicitly rather than
   only by the catch-all. Any firestore.rules change is owner-gated per the v1.8 grant — build + test +
   leave UNDEPLOYED, hand over `firebase deploy --only firestore:rules`.

Purpose: keep the autonomously-deployable 65-01 clean while still shipping the client contract guard and
the intent-documenting rule. Output: modified client + test, rules + rules test, app suite + type-check
green, and a clearly-marked owner deploy handover.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/65-ai-proxy-cost-controls/65-CONTEXT.md
@.planning/phases/65-ai-proxy-cost-controls/65-01-proxy-cost-controls-PLAN.md
@src/utils/claudeApi.ts
@firestore.rules
</context>

<constraints>
- Do NOT change the never-throw contract of src/utils/claudeApi.ts: every exported AI call must still
  resolve to null on any error (existing try/catch → null at ~lines 300/… and 589). The only change is
  adding a distinct classification/log for a 429/400 before returning null.
- The Anthropic SDK throws an APIError with a numeric `.status` (429 rate-limited, 400 bad request);
  read that to classify. Do not depend on message text.
- The firestore.rules change is OWNER-GATED. Build + test it, commit it, but do NOT run
  `firebase deploy --only firestore:rules`. Leave the app running correctly WITHOUT it (the function
  writes via Admin SDK, which bypasses rules; and top-level aiUsage/aiRateLimits are already denied by
  the existing catch-all `match /{document=**} { allow read, write: if false; }`).
- No phase success criterion may depend on the rule being live. This plan's own success criteria treat
  the rule as UNDEPLOYED.
- Do NOT nest a deny under organizations/{orgId} — keep the deny blocks TOP-LEVEL to match 65-01's paths.
</constraints>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Client regression guard — proxy 429/400 surfaces as a graceful null (R161/R162)</name>
  <files>src/utils/claudeApi.ts, src/utils/claudeApi.test.ts</files>
  <behavior>
    - A rate-limit error (status 429) thrown by the proxied client is caught: getSongSuggestions /
      getScriptureSuggestions / splitCongregationalReading each resolve to null (never reject).
    - A policy error (status 400) thrown by the proxied client is likewise caught and resolves to null.
    - logAiProxyError(context, err) classifies by err.status: a rate/cost-limit note for 429, a policy
      note for 400, and the generic error otherwise — but the calling function's return value is null in
      all three cases.
  </behavior>
  <action>
    In src/utils/claudeApi.ts add a small exported `logAiProxyError(context: string, err: unknown)` that
    reads a numeric `status` off the error (Anthropic APIError) and console.warns a distinct, quiet
    message for 429 (AI temporarily rate/cost-limited) and 400 (AI request rejected by server policy),
    falling back to console.error(generic) otherwise. Replace the three existing
    `console.error('[claudeApi] <fn> failed:', err)` lines in the catch blocks of getSongSuggestions,
    getScriptureSuggestions, and splitCongregationalReading with a call to logAiProxyError; keep
    `return null` exactly as-is in every catch. Do not alter the happy paths.

    Add src/utils/claudeApi.test.ts (new). Mock the Anthropic client (the module's lazy singleton) so
    `messages.create` / `messages.parse` reject with an object shaped like an APIError carrying
    `status: 429` and, in a second case, `status: 400`. Assert each of the three exported AI functions
    resolves to null (does not reject) for both statuses. Guard against needing a live Pinia/auth store by
    stubbing isAiEnabled/getAppAuthHeaders as the existing modules allow, or mock at the client boundary so
    the calls reach the catch. Keep the test in the app suite (bare `npx vitest run` collects it).
  </action>
  <verify>
    <automated>npx vitest run src/utils/claudeApi.test.ts</automated>
  </verify>
  <done>Both a 429 and a 400 from the proxied client resolve to null (never throw) in all three AI calls; logAiProxyError classifies the two cost-control statuses distinctly; the never-throw contract is unchanged; the new test passes in the app suite.</done>
</task>

<task type="auto">
  <name>Task 2: Owner-gated firestore.rules deny for aiUsage + aiRateLimits (UNDEPLOYED)</name>
  <files>firestore.rules, src/rules.test.ts</files>
  <action>
    In firestore.rules add two explicit top-level match blocks — `match /aiUsage/{docId}` and
    `match /aiRateLimits/{docId}`, each with `allow read, write: if false;` — placed among the top-level
    collection blocks BEFORE the final catch-all `match /{document=**}`. These document the intent that
    the ledger and rate-limit counters are Admin-SDK-only and never client-accessible, and future-proof
    against a refactor that might nest them under an org path (the org-scoped `/{collection}/{docId}`
    wildcard at firestore.rules:299 is the T-37-15 hole; keeping these top-level + explicitly denied avoids
    it). Add a short comment noting these are Admin-SDK-only (written by the api function, plan 65-01).

    In src/rules.test.ts add assertions that an authenticated client can neither read nor write a doc in
    aiUsage nor aiRateLimits (both denied). Mirror the existing deny-case assertion style in that file.

    DO NOT DEPLOY. Leave the rules change committed but UNDEPLOYED. The owner runs the deploy (handover
    below). Confirm the app + functions continue to work without this rule live.
  </action>
  <verify>
    <automated>grep -c 'match /aiUsage/{docId}' firestore.rules; grep -c 'match /aiRateLimits/{docId}' firestore.rules</automated>
    <human-check>Owner: run the rules suite against an emulator (`npm run test:rules`, or `npx vitest run --config vitest.rules.config.ts` against a running emulator per CLAUDE.md) to confirm the two deny assertions pass, then deploy with `firebase deploy --only firestore:rules`.</human-check>
  </verify>
  <done>firestore.rules contains explicit deny blocks for aiUsage and aiRateLimits before the catch-all; src/rules.test.ts asserts both are denied to authenticated clients; the change is committed UNDEPLOYED; nothing in the running app or functions depends on it. The exact owner deploy command is recorded in the SUMMARY.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| browser client → Firestore | A signed-in client must never read the aiUsage ledger or aiRateLimits counters directly (that read UI is the deferred R169 shape, owner-gated). |
| proxy 429/400 → client AI code | The proxy now returns cost-control rejections; the client must degrade gracefully, not crash the UI. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-65-04 | Information Disclosure | client reading aiUsage / aiRateLimits | low | mitigate | Explicit top-level deny blocks added to firestore.rules (defense-in-depth over the catch-all), tested and LEFT UNDEPLOYED for the owner to deploy; the function does not depend on them. |
| T-65-06 | Denial of Service | a proxy 429/400 propagating as an unhandled rejection and crashing the AI feature UI | medium | mitigate | Client regression guard: logAiProxyError + unchanged `return null` in every catch keep AI additive/non-blocking; test proves both statuses resolve to null. |

No new dependencies are introduced (no package-manager installs), so no supply-chain checkpoint applies.
</threat_model>

<verification>
Autonomous gates:
- `npx vitest run src/utils/claudeApi.test.ts` — client returns null for 429 and 400 (app suite).
- `npm run type-check` — vue-tsc --build clean (includes test files).
- `grep -c 'match /aiUsage/{docId}' firestore.rules` >= 1 and `grep -c 'match /aiRateLimits/{docId}' firestore.rules` >= 1 — deny blocks present.
- `npx vitest run` — app-suite baseline unchanged (only the 2 known-failing files: storage.rules.test.ts, RosterView.test.ts).

## Owner-gated handover (do NOT run here)
Any firestore.rules change is owner-deployed per the v1.8 grant. After the owner confirms the rules suite
passes against an emulator, they run:

  firebase deploy --only firestore:rules

The phase is fully functional WITHOUT this deploy — it is defense-in-depth over an already-denying
baseline.
</verification>

<success_criteria>
- The three AI calls in src/utils/claudeApi.ts resolve to null (never throw) for a proxy 429 and 400, logged distinctly; the never-throw contract is intact (guards R161/R162's new failure modes).
- firestore.rules has explicit deny blocks for aiUsage and aiRateLimits, tested via src/rules.test.ts, committed UNDEPLOYED, with `firebase deploy --only firestore:rules` handed to the owner (hardens the R163 store; not a phase dependency).
- App suite + type-check green; no regression beyond the known 2-file baseline.
</success_criteria>

<output>
Create `.planning/phases/65-ai-proxy-cost-controls/65-02-SUMMARY.md` when done. Record: the client classify
behavior, confirmation the rules change is committed UNDEPLOYED, and the exact owner deploy command
(`firebase deploy --only firestore:rules`) for the milestone handover.
</output>
