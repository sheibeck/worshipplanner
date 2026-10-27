---
phase: 144
slug: worshipbuilder-rename
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: 2026-10-27
---

# Phase 144 — Security

> Register authored at plan time (144-01/02 `<threat_model>` blocks); verified at ASVS L1 against the
> post-review-fix code (f8989162 / 70ccad1d / 1e7b693f / a03802a6) using the verifier's 2026-10-27 gate
> evidence. SUMMARY threat flags: none.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Static UI copy → browser | Brand text in 13 templates + `index.html` | Static strings only |
| Cloud Functions → Resend | Invite / admin / volunteer-link emails | Subject + body copy; From header (org display name + configured address) |
| Repo → deploy | `firebase deploy` of functions | Compiled `functions/lib` (now rebuilt by predeploy) |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-144-01 | Denial of Service (session/settings loss) | `wp` storage keys, project id, package names, authDomain | medium | mitigate | Identifier gate: `git diff --stat b3e3cee3^..HEAD -- package.json package-lock.json .firebaserc functions/package.json` empty; `firebase.json` differs only by the functions predeploy entry; no changed non-test line touches `wp-`/`worship-planner-bc515`/`worshipplanner` | closed |
| T-144-02 | Tampering (markup/XSS surface) | 13 touched templates | low | mitigate | Brand-token-only diff gate: one-line literal swaps, no `v-html`/binding/interpolation added, classes byte-identical | closed |
| T-144-03 | Information Disclosure | Share / quarter-share public pages | low | accept | AR-144-01 | closed |
| T-144-04 | Spoofing (sender identity) | From header (`bareEmailAddress`, `fromDisplayName`) | low | mitigate | `functions/src/params.ts` unchanged; From-header tests unmodified and green (functions 722/722) | closed |
| T-144-05 | Tampering (header/content injection via orgName) | Email subjects/bodies | low | mitigate | Brand-token-only diff: no new interpolation/concatenation; existing orgName handling unchanged | closed |
| T-144-06 | Tampering (deploy integrity) | `functions/lib`, production deploy | low | mitigate | No lib edit, no deploy this phase; review fix WR-03 added `"predeploy": ["npm --prefix functions run build"]` so a deploy always ships freshly compiled email copy (pinned by `firebaseFunctionsPredeploy.test.ts`) | closed |
| T-144-07 | Information Disclosure | `brandName.test.ts` file reads | low | accept | AR-144-02 | closed |
| T-144-SC | Tampering (supply chain) | package installs | low | accept | AR-144-03 | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-144-01 | T-144-03 | Footer text is static brand copy; the snapshot data these public pages render is untouched | Plan 144-01 threat model | 2026-10-27 |
| AR-144-02 | T-144-07 | Test-time only; reads committed repo source and reports relative paths; excluded from the app bundle | Plan 144-02 threat model | 2026-10-27 |
| AR-144-03 | T-144-SC | No package installed (node:fs / node:path built-ins only) | Plans 144-01/02 threat models | 2026-10-27 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-27 | 8 | 8 | 0 | secure-phase orchestrator (ASVS L1; auditor short-circuited: register at plan time, threats_open 0) |

## Security Audit 2026-10-27

| Metric | Count |
|--------|-------|
| Threats found | 8 |
| Closed | 8 |
| Open | 0 |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-10-27
