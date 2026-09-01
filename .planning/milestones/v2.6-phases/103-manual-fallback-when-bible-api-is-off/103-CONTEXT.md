# Phase 103: Manual Fallback When Bible API Is Off - Context

**Gathered:** 2026-08-31
**Status:** Ready for planning
**Mode:** Autonomous smart-discuss — grey areas resolved from milestone-level decisions (PROJECT.md v2.6 + REQUIREMENTS.md R298/R299/R300) and the 2026-08-31 codebase map. Consumes Phase 102's dispatcher `'disabled'` signal + Phase 101's `authStore.isBibleApiEnabled`.

<domain>
## Phase Boundary

Give an organization with Bible API DISABLED a fully functional, zero-cost scripture path so being OFF never breaks the workflow: a BibleGateway deep-link + a manual paste-in whose text becomes the slide/reading content, plus hiding the now-irrelevant "Bible Translation" selector in that org's Settings. This is the last v2.6 phase. It only adds the DISABLED-state affordances (conditioned on Phase 102's gate) and the Settings hide — it does not touch the enabled path.

Requirements: **R298** (BibleGateway deep-link for the reference, any version), **R299** (manual paste-in becomes slide/reading content, any version; LLM split still runs on pasted text, AI-gated), **R300** (hide the Bible Translation selector in Settings when off).
</domain>

<decisions>
## Implementation Decisions

### Where the fallback attaches
- The two scripture-editing components already route fetch through the dispatcher and already branch on `{status:'disabled'}` (Phase 102, currently a no-op): **`src/components/ScriptureInput.vue`** and **`src/components/CongregationalEditor.vue`**. This phase fills that disabled branch with the real fallback UI. (`ScriptureSlideEditor.vue` was found to be dead/unmounted in Phase 102 — do NOT build UI there unless it turns out to be live.)
- The fallback appears ONLY when the org's Bible API is OFF (`!authStore.isBibleApiEnabled` / dispatcher returned `'disabled'`). When ON, nothing changes (enabled auto-fetch as today).

### R298 — "Open in BibleGateway" deep-link
- Add/generalize a BibleGateway link builder in `src/utils/scripture.ts` (there is already `nltLink(book, chapter)` → `biblegateway.com/passage/?search=<Book Chapter>&version=NLT` and `scriptureWebLink`). Add a `bibleGatewayLink(ref, version?)` that builds `https://www.biblegateway.com/passage/?search=<Book Chapter:VerseStart-VerseEnd>` for the entered reference, appending `&version=<version>` only when a version is available.
- **Version handling (resolves the R298-vs-R300 tension):** the deep-link works with ANY version. Since the ESV/NLT selector is hidden when off (R300), the link uses the org's already-stored `OrgSettings.bibleVersion` (that field still exists; hiding the selector does not delete it) as the `&version=` value if present; otherwise omit `&version=` and let BibleGateway show its default (the user can switch version on BibleGateway, or use the paste path for truly any version). Do NOT reintroduce the hidden ESV/NLT selector to pick a link version.
- The link opens in a new tab (`target="_blank" rel="noopener"`). Label: **"Open in BibleGateway"**. It is a convenience to go copy the text; the actual content still comes from the paste box below.

### R299 — manual paste-in
- Add a textarea ("Paste the passage text") in the disabled branch of BOTH components. Its text becomes the slide/reading content through the SAME downstream path the fetched text used (so a disabled org's scripture slide / congregational reading is populated by pasted text). Works with ANY version — the app does not parse/validate the version; the user pastes whatever they copied.
- **Congregational reading:** the pasted text feeds `splitCongregationalReading` exactly as fetched text did (the LLM split operates on provided `rawText`). This remains subject to the INDEPENDENT AI gate: if AI is ON for the org, split works on the pasted text; if AI is OFF, no auto-split (manual sectioning), unchanged from today's AI-off behavior. Do NOT couple the Bible gate and the AI gate.
- Keep it graceful: no throw, clear affordance. Reuse existing dark-theme input styling.

### R300 — hide the Settings "Bible Translation" selector
- In `src/views/SettingsView.vue`, the "Bible Translation" card (~line 310–357) is currently UNGATED. Wrap it in `v-if="authStore.isBibleApiEnabled"` (equivalently the `bibleApiEnabled` mirror), mirroring EXACTLY how the "AI Features" card is gated by `v-if="authStore.aiMasterEnabled"` (~line 260). When the org's Bible API is off there is no API-backed version list to configure, so the card is hidden.
- Do not delete the stored `bibleVersion` field or its save logic — only hide the card. (An org later re-enabled shows the selector again with its prior value.)

### Claude's Discretion
- Exact layout/placement of the deep-link + paste box within each component's disabled branch, the textarea sizing, helper microcopy wording, and whether the paste box auto-applies on blur vs an explicit "Use this text" action — all at Claude's discretion, provided: fallback only shows when off, deep-link opens the right reference on BibleGateway, pasted text populates the slide/reading, LLM split still works on pasted text under the AI gate, and Settings hides the translation card when off.
</decisions>

<code_context>
## Existing Code Insights (from 2026-08-31 codebase map + this phase's grep)

### Reusable Assets / Analogs
- `src/utils/scripture.ts` — `nltLink(book, chapter)` (~87: `biblegateway.com/passage/?search=...&version=NLT`), `esvLink` (~76), `scriptureWebLink(book, chapter, version)` (~98), `parseScriptureInput`, `formatScriptureReference`, `ScriptureRef`, `congregationalSectionsFromSlot`. Add `bibleGatewayLink` here.
- `src/components/ScriptureInput.vue` — has the `{status:'disabled'}` branch (Phase 102) in `fetchPreview`/`togglePreview`; resolves `effectiveVersion`. Attach fallback here.
- `src/components/CongregationalEditor.vue` — `autoFetch` disabled branch (Phase 102); owns fetch→`splitCongregationalReading`. Attach fallback here; feed pasted text to the existing split path.
- `src/utils/claudeApi.ts` — `splitCongregationalReading(rawText)` (AI-gated via `isAiEnabled()`); operates on provided text — unchanged, just receives pasted text.
- `src/views/SettingsView.vue` — "AI Features" card `v-if="authStore.aiMasterEnabled"` (~260) is the exact gate pattern; "Bible Translation" card (~310–357) is the target to wrap in `v-if="authStore.isBibleApiEnabled"`.
- `src/stores/auth.ts` — `isBibleApiEnabled` computed (Phase 101).
- `src/types/service.ts` / `src/types/slide.ts` — `ScriptureSlot` (text/congregationalSections fields the pasted text populates).

### Integration Points
- Dispatcher `'disabled'` → component disabled branch → { BibleGateway deep-link (scripture.ts builder) + paste textarea → slide/reading content → (congregational) splitCongregationalReading under AI gate }.
- Settings card visibility ← `authStore.isBibleApiEnabled`.

### Testing / gates (CLAUDE.md)
- `npm run type-check` (vue-tsc --build). App tests bare `npx vitest run` (baselines NOT ours: `storage.rules.test.ts`, `appConfig.test.ts`).
- Tests to add: deep-link builder (correct BibleGateway URL for a reference; version param present/absent); component tests that the disabled branch renders the deep-link + paste box, that pasted text populates the slide/reading content, and that congregational split runs on pasted text when AI on / is absent when AI off; a SettingsView test that the Bible Translation card is hidden when `isBibleApiEnabled` is false and shown when true.

### Deploy note (do NOT deploy in this phase)
- This phase is client-only (components + scripture.ts + SettingsView) — no functions/rules change. Build/test/commit ONLY; the milestone-end owner-gated deploy batch (hosting + `functions:api` from Phase 102) is documented for hand-over, not run.
</code_context>

<specifics>
## Specific Ideas
- The disabled state must feel like a first-class, intentional path, not a degraded error: "Bible API is off for your church — open the passage in BibleGateway and paste it here." (Exact copy at Claude's discretion.)
- The paste path is the true "any version" route — the app stores whatever the user pastes verbatim; it does not need to know the translation.
- Keep the AI gate and Bible gate strictly independent (a church can have Bible API off but AI on, or vice versa).
</specifics>

<deferred>
## Deferred Ideas
- A dedicated free-text version picker for the BibleGateway link — unnecessary; stored `bibleVersion` or BibleGateway's own version switcher covers it, and paste handles any version.
- Building fallback UI in `ScriptureSlideEditor.vue` — it's dead/unmounted (Phase 102 finding); skip unless proven live.
- Any change to the enabled path, the AI gate, or the server proxy — out of scope.
</deferred>
