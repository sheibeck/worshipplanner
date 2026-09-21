---
phase: 142
slug: slides-tab-panel-ux-from-claude-design
status: secured
threats_closed: 19
threats_open: 0
asvs_level: 1
audited: 2026-09-19
---

## SECURED

**Phase:** 142 — Slides Tab panel UX from Claude Design
**Threats Closed:** 19/19 (14 mitigated with code evidence, 5 accepted; `T-142-SC` is one register entry shared by all four plans)
**ASVS Level:** 1 (L1 grep-depth verification; register authored at plan time in all 4 PLAN `<threat_model>` blocks — orchestrator short-circuit per secure-phase §3: `threats_open: 0`, plan-authored register, L1)
**Highest severity in register:** high (T-142-01, -06, -11, -15, -16) — all five closed with code evidence; nothing open at or above the `high` block threshold.

Independent corroboration: code review at standard depth (`142-REVIEW.md`, clean after WR-01 — the only warning was an
open popover surviving `editable` flipping false mid-session, fixed in `38adec2e` and now covered by T-142-11/-12 evidence)
and the phase verifier (`142-VERIFICATION.md`, 17/17 truths). `firestore.rules` / `storage.rules` / `package.json` /
`package-lock.json` are byte-identical to the phase base (`f8b6983d^`).

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| browser → Firestore `organizations/{orgId}/slideGroups/{slotId}` | `setGroupBedMedia` / `setGroupBackground` via client SDK; every strip emit terminates in a `SlideGrid.vue` handler that re-checks `canWriteGroupMedia` (8 occurrences) before the store call; server gate `isOrgEditor(orgId) && parentDraft(...)` UNCHANGED | group bed audio URL / vamp id + label / background URL |
| browser → Cloud Storage `orgs/{orgId}/backgrounds/…` and media | `useBackgroundUpload` / `useMediaUpload` validate MIME + size (unchanged); the new drop target and Replace input reuse them — no second upload path | image / audio bytes |
| user file drop → `BackgroundControl` | untrusted `File` from `dataTransfer` routed through the same `uploadFile()` → composable `validate()` | file |
| locked / non-editor viewer → `SlideGroupSetupStrip` | `editable=false` renders inert `<span>` chips, `toggle()` early-returns, popover `v-if` requires `editable`, and a `watch(props.editable)` force-closes an open popover — no control that can emit a write ever mounts | none |
| document / window listeners | `pointerdown` / `keydown` listeners exist only while a popover is open; removed on close, on forced close, and `onUnmounted` | none |
| `SlidesTab.recentBackgrounds` | derived from already-subscribed `groupsBySlotId` + assembled slideshow — zero new `getDocs` / `onSnapshot` / songs subscription | same-org, same-service background URLs |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation (evidence) | Status |
|-----------|----------|-----------|----------|-------------|------------------------|--------|
| T-142-01 | Tampering | `setGroupBedMedia` third branch | high | mitigate | `update.bedAudioUrl = deleteField()` inside the `patch.bedVampId` branch (`src/stores/slideGroups.ts`); asserted by "no-MP3 vamp against an existing doc" tests | closed |
| T-142-02 | Tampering (ASVS V5 input validation) | `BackgroundControl` drop target | medium | mitigate | drop → shared `uploadFile()` → `useBackgroundUpload` (3 refs, single path); MIME + `BACKGROUND_MAX_BYTES` unchanged | closed |
| T-142-03 | Elevation of Privilege | `BackgroundControl` chip-popover tiles | medium | mitigate | tile row `v-if="isEditor && !inheritedFrom"` (2 sites); write still passes `SlideGrid` re-check + rules | closed |
| T-142-04 | Information Disclosure | recents thumbnails | low | accept | same-org, same-service URLs already rendered on the slideshow; no new read | closed (accepted) |
| T-142-05 | Tampering (XSS) | `backgroundImage: url(...)` style binding, chip/tile text | low | mitigate | style-object binding + text interpolation; zero `v-html` across touched components | closed |
| T-142-06 | Elevation of Privilege | `SlideGroupMusicControl` tabs / Replace / Remove for a viewer | high | mitigate | tabs `:disabled="!isEditor"` (3), Replace/Remove/upload/picker `v-if="isEditor"` (3), `setAudioTab` `isEditor` guard | closed |
| T-142-07 | Tampering (ASVS V5) | Track upload / Replace input | medium | mitigate | `accept="audio/*"` (2) + `useMediaUpload.validate()` (MIME + 50 MB); rejected upload emits nothing | closed |
| T-142-08 | Tampering (data integrity) | `setAudioTab('none')` | medium | mitigate | emits `remove` → `SlideGrid.onRemoveGroupMusic` → `clearAudio: true` explicit-clear flag | closed |
| T-142-09 | Elevation of Privilege | `VampPicker allowUnattached` | low | mitigate | prop defaults `false`; `EditSlideDrawer.vue` does not pass it (0 refs) — per-slide drawer contract unchanged | closed |
| T-142-10 | Tampering (XSS) | vamp label / filename / duration text | low | mitigate | text interpolation only; no `v-html` | closed |
| T-142-11 | Elevation of Privilege | inert chips on a locked service / for a viewer | high | mitigate | `v-if="editable"` button vs inert span; `toggle()` early-return; popover `v-if` `openChip === chip.id && editable`; `watch(props.editable)` closes on lock (WR-01 fix, regression-tested) | closed |
| T-142-12 | Denial of Service (listener leak / stuck popover) | `openChip` watch + `onUnmounted` | medium | mitigate | 2 `addEventListener` / 4 `removeEventListener` / `onUnmounted` teardown; `selectedSlot.id` and `editable` watchers reset; spy tests assert exactly-once removal | closed |
| T-142-13 | Tampering (XSS) | chip value text (filename / vamp label) | low | mitigate | text interpolation only; labels originate from our own upload/assign paths | closed |
| T-142-14 | Information Disclosure | `recentBackgrounds` thumbnails in the popover | low | accept | same-org, same-service data already rendered on the slideshow | closed (accepted) |
| T-142-15 | Elevation of Privilege | panel now renders for viewers / locked services | high | mitigate | `:editable="canWriteGroupMedia"` bound on the strip; every handler starts `if (!canWriteGroupMedia.value) return` (8 occurrences); rules unchanged | closed |
| T-142-16 | Tampering (data integrity) | `onAttachGroupVamp` no-URL path | high | mitigate | patch spreads `bedAudioUrl` only when `downloadUrl` exists (`...(downloadUrl ? { bedAudioUrl } : {})`), so the store's branch `deleteField()`s any stale URL; test asserts `'bedAudioUrl' in patch === false` | closed |
| T-142-17 | Information Disclosure | `recentBackgrounds` derivation | low | accept | per-service `groupsBySlotId`; no cross-service / cross-org aggregation; 0 new reads in `SlidesTab.vue` | closed (accepted) |
| T-142-18 | Repudiation / regression | testid migration hiding a broken gate | medium | mitigate | migrated `SlideGrid.test.ts` asserts button vs span per editability + absent popovers (23 chip assertions); full suite at the 2-file baseline + `npm run type-check` clean | closed |
| T-142-SC | Tampering (supply chain) | npm/pip/cargo installs | low | accept | no package installs — `package.json` / `package-lock.json` diff is empty for the phase | closed (accepted) |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above `workflow.security_block_on` (high) count toward `threats_open`*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-142-01 | T-142-04 / T-142-14 / T-142-17 | Recent-background thumbnails expose only URLs the same org viewer already sees rendered on this service's slideshow; derived from existing authorized subscriptions, no new read path, no cross-service aggregation | planner (142-01/03/04 `<threat_model>`), confirmed by orchestrator audit | 2026-09-19 |
| AR-142-02 | T-142-SC | No dependency changes in this phase (RESEARCH.md Package Legitimacy Audit: not applicable) | planner, confirmed by empty manifest diff | 2026-09-19 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-09-19 | 19 | 19 | 0 | autonomous orchestrator (L1 grep-depth short-circuit; corroborated by code review + verifier) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: secured` set in frontmatter

**Approval:** verified 2026-09-19
