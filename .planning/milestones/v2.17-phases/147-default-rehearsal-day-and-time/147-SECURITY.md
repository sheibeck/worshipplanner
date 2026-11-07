---
phase: 147
slug: default-rehearsal-day-and-time
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: 2026-11-07
---

# Phase 147 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Repo text → the check | The spec is read as text and parsed, never executed | Repo text, no secrets or user data |
| Stored service row → public documents | Stored rows reach `shareTokens`, `serviceShares` and `rehearseAccess`, read by people outside the org | Rehearsal id, date and time; the internal marker must not cross |
| Stored org settings → client | `settings.rehearsalDefaultWeekday` is read back from Firestore and may hold anything | Org setting, not sensitive |
| Client store → public documents | The client writes and removes `serviceShares` and `shareTokens`, which anyone can `get` | Published service details |
| One service → another on the same date | `serviceShares` is keyed by slug and date alone, so two services can share a document | Availability of a sibling's public page |
| Settings form → `organizations/{orgId}` | An editor's input is written to the org doc | Org setting, not sensitive |
| Editor input → service document | A date chosen in the browser is now written to Firestore, where before it never was | Service date |
| Editor → public documents | A saved date decides which public page is written and which is removed | Published page identity |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-147-01 | Tampering | `docs/specs/default-rehearsal.md` | low | accept | Plain text under version control, with no runtime path; a change shows in review and in the check's output | closed |
| T-147-02 | Information disclosure | `buildServiceSnapshot`, `buildRehearseAccess` | medium | mitigate | Both map rows through `toPublicRehearsal` (`src/stores/services.ts:211`, `src/utils/rehearseAccess.ts:281`), which returns exactly id, date and time (`src/utils/rehearsalTimes.ts:79`); pinned by AC-RHD-49 and AC-RHD-50 (`services.rehearsalProjection.test.ts:214`, `:223`) | closed |
| T-147-03 | Tampering | `normalizeWeekday`, `ymdToUtcMs` | low | mitigate | Anything but a whole number 0-6 gives null (`rehearsalTimes.ts:84`), and a date that isn't real gives null (`rehearsalTimes.ts:89`), so nothing is added (AC-RHD-16) | closed |
| T-147-04 | Tampering | `autoAdded` on a stored row | low | accept | Rules don't validate rehearsal fields (ADR-0245), and neither `firestore.rules` nor `functions/src` mentions the marker. A forged flag only decides auto-moving on a service the editor can already change | closed |
| T-147-05 | Denial of service | `retireOldServiceShare` | medium | mitigate | `deleteDoc` runs only when the old page's `serviceId` equals this service (`services.ts:1318`), so a sibling's page survives (AC-RHD-61) | closed |
| T-147-06 | Denial of service | `retireOldServiceShare` | medium | mitigate | Returns before any removal unless the new page exists and records this service (`services.ts:1314`), so a failed write leaves a working page (AC-RHD-58) | closed |
| T-147-07 | Information disclosure | `createService`, `writeSharePayload` | medium | mitigate | The written documents are asserted free of the marker, after asserting they exist (`services.publicDocs.test.ts:211`, `:235`; AC-RHD-51, AC-RHD-52) | closed |
| T-147-08 | Information disclosure | Old page after a failed removal | low | accept | Soft failure only (`services.ts:1322`), per the owner's decision. The normal path removes it, and the page holds only what it already published | closed |
| T-147-09 | Elevation of privilege | `onSaveRehearsalDefaults` | medium | mitigate | The `isEditor` guard is the first line (`src/views/SettingsView.vue:1379`) and the select is disabled for non-editors (`SettingsView.vue:556`; AC-RHD-05). `isOrgEditor` enforces it server-side (`firestore.rules:133`), with no rule change | closed |
| T-147-10 | Tampering | `rehearsalDefaultWeekdayInput` | low | mitigate | The fixed option list gives only 0-6 or null (`SettingsView.vue:560`). Every read normalizes: `SettingsView.vue:750`, `:823`, `:1383` directly, and the store and the add form through `mostRecentWeekdayOnOrBefore` (`rehearsalTimes.ts:121`) | closed |
| T-147-11 | Information disclosure | `ServiceTimesPanel` | low | mitigate | The panel, `ServiceCard.vue` and `DashboardView.vue` never read the marker (grep finds none); parity tests pin it (AC-RHD-53, AC-RHD-54) | closed |
| T-147-12 | Tampering | `onDateChange` | medium | mitigate | `isRealYmd` rejects a malformed or unreal date before it is applied (`src/views/ServiceEditorView.vue:2759`), and `max="9999-12-31"` limits the picker (`ServiceEditorView.vue:61`; AC-RHD-35) | closed |
| T-147-13 | Elevation of privilege | `onDateChange` | medium | mitigate | `canEditService` is the handler's first check (`ServiceEditorView.vue:2758`; AC-RHD-36). The store's `assertWritable` runs before the write (`services.ts:629`, `:639`), and the rules' draft-only update clause still applies (`firestore.rules:209-214`) | closed |
| T-147-14 | Tampering | `onRehearsalDateChange`, `onRehearsalTimeChange` | low | mitigate | The marker is deleted only after every guard passes (`ServiceEditorView.vue:2794`, `:2803`), so a rejected edit changes nothing (AC-RHD-30) | closed |
| T-147-15 | Denial of service | `retireOldServiceShare` on a date two services share | low | accept | Moving the service the page records leaves the other with no date page until its next save. Its token link is unaffected (AC-RHD-68) | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-147-01 | T-147-01 | The spec is version-controlled text with no runtime path | Plan 147-01 threat model (low severity; not an owner decision) | 2026-11-06 |
| AR-147-02 | T-147-04 | A forged marker only decides auto-moving on a service the editor can already change | Plan 147-02 threat model (low severity; not an owner decision) | 2026-11-06 |
| AR-147-03 | T-147-08 | A failed removal must not fail the save. The page holds only what it already published | Owner decided the soft failure (`147-CONTEXT.md`); the residual risk is recorded in the Plan 147-03 threat model | 2026-11-06 |
| AR-147-04 | T-147-15 | The other service gets its date page back at its next save, and its token link keeps working | Owner | 2026-11-06 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-11-07 | 15 | 15 | 0 | Orchestrator, ASVS L1 grep depth (short-circuit: plan-time register, no open threats) |

No rules file changed in this phase, and no new package was installed. The Threat Flags sections in the 147-02 to 147-05 summaries report nothing new; the 147-01 summary, which covers only the spec text, has none.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-11-07
