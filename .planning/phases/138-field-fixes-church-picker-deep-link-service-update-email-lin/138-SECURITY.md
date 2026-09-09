---
phase: 138
status: secured
threats_closed: 5
threats_open: 0
asvs_level: 1
audited: 2026-09-09
---

## SECURED

**Phase:** 138 — Field Fixes: Church-Picker Deep-Link & Service-Update Email Link
**Threats Closed:** 5/5
**ASVS Level:** 1

### Threat Verification
| Threat ID | Category | Severity | Disposition | Evidence |
|-----------|----------|----------|-------------|----------|
| T-138-01 | Elevation of Privilege / Tampering | high | mitigate | `src/stores/auth.ts:552-554` — `remembered && ids.includes(remembered) ? remembered : ids.length === 1 ? ids[0]! : null` is unchanged (confirmed by direct grep + reviewer git-diff). `readRememberedOrg` (auth.ts:79-97) applies the identical `parsed.uid === uid && typeof parsed.orgId === 'string'` shape check on BOTH the sessionStorage and localStorage branches — no unvalidated read path. Live test: `npx vitest run src/stores/__tests__/auth.test.ts` → 125/125 pass, incl. "does not honor a stale persisted org from localStorage the user is not a member of" (auth.test.ts:583). |
| T-138-02 | Information Disclosure | medium | mitigate | `clearRememberedOrg()` (auth.ts:114-125) removes BOTH `wp.selectedOrg` (sessionStorage) and `wp.selectedOrg.persist` (localStorage), each in its own try/catch; sole logout call site (auth.ts:920, synchronous, before any await). Value is uid-scoped (`{uid, orgId}`) so a mismatched-uid read returns null. Live test: "clears both the sessionStorage and localStorage remembered-org tiers" (auth.test.ts:447) passes. |
| T-138-03 | Information Disclosure | low | accept | v2.8 SEC-S-01 remediation verified real: `shareTokens`/`quarterShares`/`serviceShares` public-listing Critical shipped to `firestore.rules:344-445`, deployed to prod 2026-09-02, with a live emulator run (208/208 incl. DENY-case collection-list assertions). Accepted-risk basis grounded in a verified prior fix. |
| T-138-04 | Tampering / Spoofing | low | mitigate | `src/components/ReLockNotifyPrompt.vue:329-331` — the client body carries only the literal `'{{service_link}}'` token, never a resolved URL. `functions/src/index.ts:1990-2012` (`resolveServiceLink`) re-derives the link authoritatively server-side from the org-scoped `shareTokens` collection (filtered `c.orgId === orgId`); `functions/src/messageTokens.ts:56` performs a single non-cascading regex substitution over the original template — no re-injection surface. Live tests: ReLockNotifyPrompt.test.ts 24/24, functions messageTokens.test.ts 21/21. |
| T-138-SC | Tampering (supply chain) | low | accept | Checked package.json/package-lock.json across all phase-138 commits — zero dependency changes. "No new dependencies" holds. |

### Unregistered Flags
None — no new attack surface beyond the two registered threat models.

**threats_open:** 0
