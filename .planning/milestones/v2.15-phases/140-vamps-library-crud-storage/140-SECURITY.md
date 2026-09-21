---
phase: 140
slug: vamps-library-crud-storage
status: secured
threats_closed: 8
threats_open: 0
asvs_level: 1
audited: 2026-09-13
---

## SECURED

**Phase:** 140 — Vamps Library — CRUD & Storage
**Threats Closed:** 8/8 (5 mitigated, 3 accepted)
**ASVS Level:** 1 (L1 grep-depth verification; register authored at plan time)

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| client → Cloud Storage `orgs/{orgId}/vamp-files/{vampId}/{uploadId}/…` | Any authenticated caller can attempt upload/read/delete on a guessed path; `storage.rules` is the sole authority | MP3 bytes (org-private) |
| client → Firestore `organizations/{orgId}/vamps/{id}` | Vamp doc CRUD; the existing generic org catch-all is the sole authority | Vamp metadata (name/key/tempo/attachment) |
| catch-all block ↔ dedicated `vamp-files/` block | Cloud Storage OR-combines sibling match blocks | Rule precedence |
| sidebar church switch → org-scoped stores | A stale listener would surface Church A data in Church B | Vamp list |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation (evidence) | Status |
|-----------|----------|-----------|----------|-------------|------------------------|--------|
| T-140-11 | Tampering | in-place MP3 overwrite (replace flow) | high | mitigate | `vampFileStoragePath(orgId, vampId, uploadId, name)` mints a fresh per-upload path (`src/utils/vampFiles.ts:15`); `allow update: if false` in the `vamp-files/` block (`storage.rules:135`). Rules test (d)/(f) + `vampFiles.test.ts`. | closed |
| T-140-12 | Information disclosure | stale cross-org vamps listener after church switch | high | mitigate | `useVampStore().unsubscribeAll()` in `resetOrgScopedStores()` (`src/stores/orgScopedStores.ts:42`, test-proven); `SongsView.vue:443-446` watch on `authStore.orgId` unsubscribes + re-subscribes. | closed |
| T-140-13 | Tampering / EoP | crafted non-audio/oversized upload; viewer create/delete | high | mitigate | `storage.rules` vamp-files create: `isOrgEditor(orgId) && size < 52428800 && contentType == 'audio/mpeg'`; delete: `isOrgEditor`. Client `validateVampFile`/`accept=` are UX-only. Rules cases (c),(d),(e),(g) pass in the emulator (310/310). | closed |
| T-140-15 | Elevation of Privilege | generic catch-all OR-overriding the vamp-files deny | high | mitigate | Both catch-all exclusion regexes read `^orgs/[^/]+/(song-files\|vamp-files)/.*` (`storage.rules:150,157`); rules case (e) small-non-mp3 deny is the regression proof. | closed |
| T-140-16 | Information disclosure | cross-org read/write of vamp files or docs | high | mitigate | Claim-scoped `isOrgMember`/`isOrgEditor` (no cross-service `firestore.exists()` — only the two comment warnings remain in `storage.rules`); cross-org storage case (h) at `storage.rules.test.ts:604`; Firestore cross-org deny in `rules.test.ts` vamps cases. | closed |
| T-140-14 | Denial of service | uncapped per-org Storage footprint | low | accept | Per-file ≤50MB cap only; per-org quota deferred (SEED-003). Below `high` block threshold. | closed (accepted) |
| T-140-17 | Elevation of Privilege | non-editor reaching the Vamps CRUD UI | low | accept | `/songs` route is `requiresEditor` (`src/router/index.ts:47`); no new route. Server authority is T-140-13. | closed (accepted) |
| T-140-SC | Tampering | supply chain (new dependencies) | low | accept | `package.json` unchanged across the phase (diff `06b38fd8..HEAD`); zero new dependencies. | closed (accepted) |

*Status: closed · open · open — below high threshold (non-blocking)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-140-01 | T-140-14 | Per-org Storage quota is a separate backlog item (SEED-003); this phase adds the per-file cap only. | plan 140-01 (autonomous run, owner policy) | 2026-09-13 |
| AR-140-02 | T-140-17 | Existing `requiresEditor` route guard covers the tab; server rules remain the real gate. | plan 140-03 (autonomous run, owner policy) | 2026-09-13 |
| AR-140-03 | T-140-SC | No new packages introduced. | plans 140-01/02/03 | 2026-09-13 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-09-13 | 8 | 8 | 0 | orchestrator L1 grep verification (short-circuit: register authored at plan time, ASVS 1) |

Post-review note: code-review fix WR-02 (`19c9fbc6`) added best-effort deletion of superseded Storage objects on MP3 replace/remove — it reduces T-140-14's residual footprint but does not change any disposition.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: secured` set in frontmatter

**Approval:** secured 2026-09-13
