---
phase: 146
slug: spec-standard
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: 2026-11-06
---

# Phase 146 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Spec and test file text → the check | Repo files are read as text and parsed, never executed | Repo text, no secrets or user data |
| Docs → future planners and executors | The rule text steers later work; nothing crosses a network, auth or storage boundary | Process text |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-146-01 | Tampering | `runSpecCoverage` | medium | mitigate | No allowlist, baseline file, environment flag or opt-out in `specCoverage.ts` (grep); the only skips are `TEMPLATE.md`, `README.md` and `node_modules` (`specCoverage.ts:361`, `:375`); the real-repo test asserts `toEqual([])` (`specCoverage.test.ts:809`); the owner confirmed this in UAT item 1 | closed |
| T-146-02 | Denial of service | `extractCitations`, `parseSpec` regexes | low | mitigate | Anchored linear regexes with no nested quantifiers (`specCoverage.ts:189-197`); files without an `AC-` token aren't parsed; scan tests have a 30 s timeout | closed |
| T-146-03 | Information disclosure | `makeRepo` temp tree | low | mitigate | `mkdtempSync` under `tmpdir()` with made-up fixture strings, removed by `rmSync` (`specCoverage.test.ts:706`, `:711`) | closed |
| T-146-04 | Tampering | Rule text in `CLAUDE.md`, `PROJECT.md` | low | mitigate | `SPEC_RULE` and `TEST_FIRST_RULE` guards fail the root run if either sentence is dropped or changed (`specCoverage.test.ts:819-821`, `:895-897`, `:937-940`) | closed |
| T-146-05 | Information disclosure | `docs/specs/TEMPLATE.md`, ADR-0248 | low | accept | Sample IDs and process text only; `docs/` isn't deployed (hosting publishes `dist` and `legacy-site` only) | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-146-01 | T-146-05 | The docs hold sample IDs and process text only, and aren't deployed | Plan 146-02 threat model (low severity; not an owner decision) | 2026-11-06 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-11-06 | 5 | 5 | 0 | Orchestrator, ASVS L1 grep depth (short-circuit: plan-time register, no open threats) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-11-06
