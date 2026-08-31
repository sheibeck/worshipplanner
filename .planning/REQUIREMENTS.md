# Requirements: WorshipPlanner — v2.6 Per-Org Bible API Toggle & Manual Fallback

**Defined:** 2026-08-31
**Core Value:** Smart weekly service planning that follows the Vertical Worship methodology while rotating through the full song stable and respecting team configurations.
**Milestone goal:** Put Bible API access behind a per-organization on/off switch controlled from the Owner Console, and when it is off give that org a zero-cost manual path (BibleGateway deep-link + paste-the-passage-in) so scripture and congregational-reading features always have a way forward without passing pay-only, non-commercial API costs to users.

> REQ-ID numbering continues the project's global `R###` sequence from v2.5 (last: R294). This milestone: **R295–R301**.
>
> **Origin:** promoted from backlog 999.3. The ESV/NLT Bible APIs are pay-only and licensed for non-commercial use, so the platform owner must be able to disable them per church and still leave every org a working scripture path.
>
> **Architecture note (from codebase map, 2026-08-31):** unlike AI, there is **no single Bible-fetch choke point** today — fetching is split across `src/utils/esvApi.ts` (`fetchPassageText`) and `src/utils/nltApi.ts` (`fetchNltPassageText`), with the ESV/NLT version dispatch duplicated inline in `src/components/ScriptureInput.vue` and `src/components/CongregationalEditor.vue` (the only two callers). This milestone introduces a single dispatcher (e.g. `src/utils/scriptureApi.ts`) that carries the per-org gate — the direct analog of `claudeApi.ts::isAiEnabled()`. The toggle mirrors the proven per-org AI pattern: a super-admin master field on `Organization` written only by a super-admin-gated Cloud Function (`setOrgAiEnabled` → new `setOrgBibleEnabled` in `functions/src/orgProvisioning.ts`), an `OrgConfigDrawer.vue` checkbox, an `authStore` computed mirror, and a `SettingsView.vue` card hidden when off. The BibleGateway link builder already exists in `src/utils/scripture.ts` (`scriptureWebLink`/`nltLink`). Defense-in-depth: the server `api` proxy in `functions/src/index.ts` currently gates only the `anthropic` branch per-org (`checkOrgAiEnablement`); the `esv`/`nlt` branches must also enforce the new per-org gate.

## v1 Requirements

Requirements for this milestone. Each maps to exactly one roadmap phase (see Traceability).

### Owner Console Control

- [x] **R295**: A super-admin can **enable or disable Bible API access per organization** from the Owner Console (Organizations tab → `OrgConfigDrawer`), backed by a super-admin-gated Cloud Function that writes a master field on the `Organization` document (mirroring `setOrgAiEnabled` / `aiMasterEnabled`); the field is client-write-denied in `firestore.rules`. **Default: OFF** — a newly onboarded org and every existing org start with the Bible API disabled until the super-admin turns it on. (No data migration: the manual fallback below means an OFF org is fully functional, not broken.)
- [x] **R301**: The Owner Console **Organizations list surfaces each org's current Bible API on/off state** (mirroring the AI toggle row/drawer), so the super-admin can see at a glance which churches have it enabled.

### Gated Bible API Behavior

- [x] **R296**: **When Bible API is ENABLED for an org**, scripture text fetching works exactly as today — ESV/NLT passage preview in scripture slides and the auto (LLM-assisted) congregational readings — with **no regression** to the current experience.
- [x] **R297**: **When Bible API is DISABLED for an org**, the app makes **no ESV/NLT proxy request** for that org and scripture-text-dependent features **degrade gracefully** rather than erroring — enforced at a new client dispatcher (`scriptureApi.ts`, the `isAiEnabled()` analog) and independently at the server `esv`/`nlt` proxy branches as defense-in-depth.

### Manual Fallback (Bible API OFF)

- [x] **R298**: **When disabled**, scripture selection and congregational-reading UI offer an **"Open in BibleGateway" deep-link** for the entered reference in the desired version (works with **any** version, not just ESV/NLT), reusing the existing BibleGateway link builder in `src/utils/scripture.ts`.
- [x] **R299**: **When disabled**, the user can **manually paste the passage text** into a scripture slide / congregational reading and that pasted text becomes the slide/reading content (works with **any** version); the LLM congregational split continues to operate on the pasted text (still subject to the independent AI gate).
- [x] **R300**: **When disabled for an org**, the **"Bible Translation" selector is hidden** in that org's Settings (`SettingsView.vue`), mirroring how the "AI Features" card hides when the AI master gate is off — there is no API-backed version list to configure when the API is off.

## Future Requirements (deferred)

- A church-editable leaf toggle (`OrgSettings.bibleApiEnabled`) layered under the super-admin master gate, if churches ever need to self-disable — a single super-admin master gate is sufficient for the cost-control goal now.
- Making manual paste-in a universal path even when the API is ON — deferred by decision (keep the current auto-fetch experience unchanged when enabled).
- Additional first-class version support beyond ESV/NLT through paid APIs — the manual/paste path already covers any version at zero cost.

## Out of Scope

- **Migrating existing orgs' historical scripture slots** — already-saved scripture text on locked/past services is untouched; the toggle governs new fetches only.
- **Removing or replacing the ESV/NLT integrations** — they remain the enabled-state path; this milestone only gates them per-org and adds the disabled-state fallback.
- **BibleGateway scraping / automated import** — the fallback is a user-driven deep-link + manual paste, not an automated fetch from BibleGateway (which would reintroduce a licensing/scraping concern).
- **Per-slot Bible-API override** — the gate is per-org, not per scripture slot.

## Traceability

*(Filled by the roadmap — each requirement maps to exactly one phase.)*

| Requirement | Phase |
|-------------|-------|
| R295 | Phase 101 |
| R296 | Phase 102 |
| R297 | Phase 102 |
| R298 | Phase 103 |
| R299 | Phase 103 |
| R300 | Phase 103 |
| R301 | Phase 101 |
