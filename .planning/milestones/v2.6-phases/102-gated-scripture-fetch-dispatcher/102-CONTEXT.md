# Phase 102: Gated Scripture Fetch Dispatcher - Context

**Gathered:** 2026-08-31
**Status:** Ready for planning
**Mode:** Autonomous smart-discuss — grey areas resolved from milestone-level decisions (PROJECT.md v2.6 + REQUIREMENTS.md R296/R297) and the 2026-08-31 codebase map. Consumes Phase 101's `authStore.isBibleApiEnabled` + `Organization.bibleApiEnabled`.

<domain>
## Phase Boundary

Introduce a **single scripture-fetch choke point** that carries the per-org Bible-API gate, so every ESV/NLT fetch — client and server — passes through one gate. When an org is ENABLED the experience is byte-for-byte unchanged (no regression); when DISABLED the app makes zero proxy calls and degrades gracefully (does not throw / spam errors). This phase builds the GATE + the dispatcher refactor only. It does NOT build the manual BibleGateway/paste fallback UX or hide the Settings translation selector — that is Phase 103, which conditions its UI on the gate this phase exposes.

Requirements: **R296** (no regression when enabled) and **R297** (no proxy call + graceful degradation when disabled; client dispatcher gate + server esv/nlt gate as defense-in-depth).
</domain>

<decisions>
## Implementation Decisions

### The client dispatcher (`src/utils/scriptureApi.ts`) — the `isAiEnabled()` analog
- Create ONE new module that becomes the ONLY path the two consumer components use to fetch passage text: **`src/components/ScriptureInput.vue`** and **`src/components/CongregationalEditor.vue`**. Neither may call `esvApi.ts::fetchPassageText` or `nltApi.ts::fetchNltPassageText` directly anymore.
- The dispatcher owns BOTH concerns currently duplicated inline in those two components:
  1. **Version dispatch** — `version === 'NLT' ? fetchNltPassageText : fetchPassageText` (moved out of the components into the dispatcher).
  2. **The per-org gate** — check `authStore.isBibleApiEnabled` (Phase 101's single-leg computed) FIRST. If disabled, return WITHOUT calling any proxy.
- **Return contract (decide a small typed result, not an exception for the disabled case):** the dispatcher returns a discriminated result so callers can branch cleanly — e.g. `{ status: 'ok', text }` on success, `{ status: 'disabled' }` when the org's Bible API is off, and `{ status: 'error', message }` on a real fetch failure. The `'disabled'` case is NOT an error and must not throw, log an error, or surface a red failure — it signals "show the manual fallback" (which Phase 103 will render). In Phase 102 the callers handle `'disabled'` minimally: do not attempt a fetch, do not error; leave the existing manual-entry affordances usable. (Rich fallback UI = Phase 103.)
- Keep the dispatcher's success/error behavior for the ENABLED path identical to today so R296 holds (same trimming/among the same functions; do not change ESV/NLT parsing).

### Consumer refactor (no behavior change when enabled)
- `ScriptureInput.vue` (inline dispatch ~lines 208, 308, 390–392): replace direct fetch calls with `scriptureApi` dispatcher calls; resolve `effectiveVersion = props.bibleVersion ?? authStore.settings.bibleVersion` as today and pass it to the dispatcher.
- `CongregationalEditor.vue` (inline dispatch ~lines 158, 244–247): same replacement. The LLM split (`splitCongregationalReading`) operates on already-fetched `rawText` and is unchanged — it simply receives whatever text the dispatcher returned (Phase 103 will let pasted text feed it when disabled).
- When the dispatcher returns `'disabled'`, the components must not throw or show a fetch error — they no-op the auto-fetch and remain functional (Phase 103 attaches the BibleGateway/paste UI here).

### Server-side gate (defense-in-depth) — mirror `checkOrgAiEnablement`
- In `functions/src/index.ts`, the `api` proxy currently gates ONLY the `anthropic` branch per-org (via `checkOrgAiEnablement(db, orgId)` at ~line 634, with `resolveOrgId(decoded)` reading the `orgId` custom claim at ~line 186). The `esv` and `nlt` branches (both in `SECRET_INJECTED`) fall straight through, per-org-ungated.
- Add a **`checkOrgBibleEnablement(db, orgId)`** mirroring `checkOrgAiEnablement`: live-read `organizations/{orgId}`, return a deny verdict unless `bibleApiEnabled === true` (default OFF → deny). Apply it to the `esv` and `nlt` proxy branches, resolving `callerOrgId` via the same `resolveOrgId` path, and reject a disabled/org-less caller with an appropriate HTTP status (mirror how the anthropic enablement verdict rejects — e.g. 403). This is defense-in-depth: the client gate already prevents the call; the server refuses it even if a client bypasses the dispatcher.
- Do NOT change the `anthropic` branch or the rate-limiter/ledger/quota logic.

### Default-OFF consistency
- Client: `isBibleApiEnabled` is already false-when-absent (Phase 101). Server: `checkOrgBibleEnablement` treats a missing field / missing org / org-less token as DENY (default OFF), exactly like the client.

### Claude's Discretion
- Exact dispatcher function name/signature, the discriminated-result shape, and how the two components branch on `'disabled'` (minimal no-op in this phase) are at Claude's discretion, provided: one choke point, both components routed through it, no regression when enabled, and no thrown error / no proxy call when disabled.
</decisions>

<code_context>
## Existing Code Insights (from 2026-08-31 codebase map)

### Reusable Assets / Analogs
- `src/utils/esvApi.ts` — `fetchPassageText(query)` (ESV via `/api/esv/...` proxy).
- `src/utils/nltApi.ts` — `fetchNltPassageText(query)` + `stripNltHtml`.
- `src/utils/claudeApi.ts` — `isAiEnabled()` (~69–79): the exact client-gate pattern to mirror (`authStore.aiMasterEnabled && authStore.settings.aiEnabled`, called first in each network export). The Bible analog is single-leg: just `authStore.isBibleApiEnabled`.
- `src/components/ScriptureInput.vue` — only caller #1 (inline ESV/NLT dispatch ~208, 308, 390–392).
- `src/components/CongregationalEditor.vue` — only caller #2 (inline dispatch ~158, 244–247); owns fetch→`splitCongregationalReading`.
- `functions/src/index.ts` — `PROXY_TARGETS` (esv→api.esv.org, nlt→api.nlt.to, ~79), `SECRET_INJECTED = {anthropic, esv, nlt}` (~89), `verifyAppCaller` (~169), `resolveOrgId` (reads `orgId` claim, ~186), `checkOrgAiEnablement(db, orgId)` (~364, live org read), and the anthropic-branch enablement gate (~619–634). Mirror `checkOrgAiEnablement` → `checkOrgBibleEnablement`, apply to esv/nlt branches (~553–564 dispatch region).
- `src/stores/auth.ts` — `isBibleApiEnabled` computed (added Phase 101).

### Integration Points
- Components → `scriptureApi.ts` dispatcher → (gate: authStore.isBibleApiEnabled) → esvApi/nltApi → proxy. Server: esv/nlt proxy branch → `checkOrgBibleEnablement` → deny when OFF.
- Downstream: Phase 103 attaches BibleGateway/paste UI at the `'disabled'` branch in the two components.

### Testing / gates (CLAUDE.md)
- `npm run type-check` (vue-tsc --build). App tests: bare `npx vitest run` (baseline failures NOT ours: `storage.rules.test.ts` + pre-existing `appConfig.test.ts`). Functions: `cd functions && npm run build && npm test`.
- Add unit tests: dispatcher (enabled→fetches/dispatches correctly ESV vs NLT; disabled→returns `'disabled'`, no fetch call — assert the underlying fetch fns are NOT invoked); component tests that the disabled branch no-ops without error; a functions test that the esv/nlt proxy branch denies when `bibleApiEnabled` is false and allows when true.

### Deploy note (do NOT deploy in this phase)
- Changes `functions/` (server gate). Build/test/commit ONLY — deploy is batched for owner confirmation at milestone end. Because default is OFF, deploying the server gate would deny esv/nlt for orgs not yet enabled — intended, and exactly why deploy is owner-gated + sequenced with enabling Berean.
</code_context>

<specifics>
## Specific Ideas
- The disabled case is a first-class, non-error state — treat it like `isAiEnabled()===false` (which returns a graceful "AI off" signal), never a thrown/red error.
- Keep the ENABLED path a pure passthrough so R296 "no regression" is trivially true: the dispatcher just relocates the existing inline dispatch, it does not re-implement fetching.
</specifics>

<deferred>
## Deferred Ideas
- BibleGateway deep-link + manual paste-in UI, LLM split on pasted text, hiding the Settings Bible-Translation selector — all Phase 103 (they consume this phase's `'disabled'` signal).
- Any change to AI gating, rate limiting, ledger, or quotas — out of scope.
</deferred>
