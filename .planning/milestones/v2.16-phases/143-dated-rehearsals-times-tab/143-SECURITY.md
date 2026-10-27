---
phase: 143
slug: dated-rehearsals-times-tab
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: 2026-10-27
---

# Phase 143 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Register authored at plan time (143-01/02/03 `<threat_model>` blocks); verified at ASVS L1 (grep depth)
> against the post-review-fix code (d1910d89 / 716aea7a). SUMMARY threat flags: none new.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Editor UI → service doc | A signed-in editor edits `rehearsals[]` / `reportTime` in Draft; autosave writes via `updateService` | Plain date/time strings (non-sensitive) |
| Service doc → public/volunteer projections | `buildServiceSnapshot` / `buildRehearseAccess` publish rehearsal times to share links and volunteers | Dated, timed rehearsals only (filtered) |
| Org settings → new service | `createService` copies `reportTimeDefault` from the signed-in org's own settings | Time string |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-143-01 | Tampering (integrity) | createService / org defaults | low | mitigate | `services.ts:475` `const rehearsals … = []`; report time copied once; copy-not-live-bind tests in `services.rehearsalDefaults.test.ts` | closed |
| T-143-02 | Information Disclosure (misinformation) | Projections + 5 read surfaces | medium | mitigate | `git diff --stat 3539cb2a..HEAD` over all surfaces + `rehearseAccess.ts` is empty; `isDisplayableRehearsal` unchanged; R445 regression tests green | closed |
| T-143-03 | Information Disclosure (cross-tenant) | authStore.settings read in createService | low | accept | See Accepted Risks AR-143-01 | closed |
| T-143-SC | Tampering (supply chain) | package installs | low | accept | See Accepted Risks AR-143-02 | closed |
| T-143-04 | Tampering (integrity) | ServiceTimesPanel add form | medium | mitigate | `ServiceTimesPanel.vue:73` `canAdd` = canEdit && `YMD_RE` && `HM_RE`; `:81` re-check before emit; parent re-validates (`ServiceEditorView.vue:2768`) | closed |
| T-143-05 | Tampering (silent data loss) | ServiceTimesPanel row inputs | low | mitigate | `onFieldChange` (`ServiceTimesPanel.vue:107-119`) forces `el.value = current` on clear/malformed and emits nothing; only Remove emits remove | closed |
| T-143-06 | Information Disclosure (misinformation) | Panel read-only branch | low | mitigate | `ServiceTimesPanel.vue:48-49` partitions via `isDisplayableRehearsal` + `sortRehearsals`; read-only test asserts legacy rows hidden | closed |
| T-143-07 | Tampering (XSS) | Rendering date/time strings | low | mitigate | 0 `v-html` in `ServiceTimesPanel.vue`; text interpolation only | closed |
| T-143-08 | Elevation of Privilege / Tampering | Five rehearsal/report-time handlers | medium | mitigate | All 5 handlers in `ServiceEditorView.vue` start with the `canEditService` gate (R036); panel receives `:can-edit="canEditService"`; R036 direct-handler tests | closed |
| T-143-09 | Tampering (integrity) | Add payload + date/time edit values | medium | mitigate | `ServiceEditorView.vue:2768/2784/2792` shared `YMD_RE`/`HM_RE` guards (single definition in `rehearsalTimes.ts`); malformed-payload/edit tests | closed |
| T-143-10 | Tampering (data loss) | Load path for v2.15 services | medium | mitigate | No load-time mutation; `ServiceEditorView.timesSection.test.ts:559` "R443 no write on load" (900 ms wait) | closed |
| T-143-11 | Information Disclosure / Elevation | buildActionBarItems fall-through | low | mitigate | `serviceEditorActionBar.ts:231` `if (tab === 'times') return []`; TIMES EMPTY cartesian test | closed |
| T-143-12 | Tampering | Firestore rules do not validate rehearsal fields | low | accept | See Accepted Risks AR-143-03 | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on (high) count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-143-01 | T-143-03 | Settings are the signed-in org's own doc; no new read path is introduced | Plan 143-01 threat model (owner pre-approved recommendations 2026-10-27) | 2026-10-27 |
| AR-143-02 | T-143-SC | No package is installed by this phase | Plan 143-01 threat model | 2026-10-27 |
| AR-143-03 | T-143-12 | Pre-existing: `firestore.rules` / functions never validated rehearsal fields; the client invariant plus the `isDisplayableRehearsal` filter on every read surface is the boundary; a rules change is out of scope | Plan 143-03 threat model | 2026-10-27 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-27 | 13 | 13 | 0 | secure-phase orchestrator (ASVS L1 grep verification; auditor spawn short-circuited: register authored at plan time, threats_open 0) |

## Security Audit 2026-10-27

| Metric | Count |
|--------|-------|
| Threats found | 13 |
| Closed | 13 |
| Open | 0 |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-10-27
