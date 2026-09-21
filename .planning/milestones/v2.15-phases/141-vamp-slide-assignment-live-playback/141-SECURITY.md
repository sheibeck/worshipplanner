---
phase: 141
slug: vamp-slide-assignment-live-playback
status: secured
threats_closed: 18
threats_open: 0
asvs_level: 1
audited: 2026-09-18
---

## SECURED

**Phase:** 141 — Vamp Slide Assignment & Live Playback
**Threats Closed:** 18/18 (10 mitigated, 8 accepted; `T-141-SC` is one register entry shared by all four plans)
**ASVS Level:** 1 (L1 grep-depth verification; register authored at plan time in all 4 PLAN `<threat_model>` blocks)
**Highest severity in register:** medium — nothing at or above the `high` block threshold.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| editor client → Firestore `organizations/{orgId}/slideGroups/{slotId}` | Assign/Change/Clear rewrite the group's `slides` array; server-gated by the UNCHANGED `slideGroups` update rule (`isOrgEditor(orgId) && parentDraft(serviceId)`) | slide entry with denormalized `audioUrl`/`audioLoop`/`vampId`/`vampLabel` |
| editor client ← Firestore `organizations/{orgId}/vamps` | Picker data source — org-scoped `onSnapshot` opened only inside the editor gate | vamp metadata (org-private) |
| denormalized `audioUrl` (vamp doc → slide entry → control-window `<audio src>`) | A Firebase Storage download URL — the same bearer-URL trust every song/background/slide attachment already carries | MP3 bytes |
| Run control window → output windows (BroadcastChannel `RunState`) | Unchanged message shape; outputs still resolve the slide but never render its audio | run index/blackout |
| Run control window ↔ audio hardware / browser autoplay policy | The ONLY document that creates an `<audio>` element during a run; the arm click is the same-document gesture the policy requires | audio playback |
| editor client → Firestore `slideGroups` (list) + `services/{id}` (get) for the R440 scan | Org-scoped member reads already permitted by existing rules; result is advisory to UI copy and to the Storage-keep decision only | assignment counts |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation (evidence) | Status |
|-----------|----------|-----------|----------|-------------|------------------------|--------|
| T-141-01 | Tampering | `EditSlideDrawer.attachVampToSlide` / `clearVampAssignment` (slideGroups write) | medium | mitigate | Both functions open with `if (!canMutate.value) return` (`EditSlideDrawer.vue:925,951`); Change/Clear buttons are `v-if="canMutate"` (`:290-291`). Authoritative gate is the unchanged `firestore.rules` `slideGroups` update rule — `firestore.rules`/`storage.rules` have 0 commits across the phase (`7b96cae0..HEAD`). | closed |
| T-141-02 | Tampering | concurrent edits to the same `slides` array | medium | mitigate | Assign (`:941`) and Clear (`:966`) both call `slideGroupsStore.replaceGroupSlides(orgId, slotId, next, sourceSignature, base)` with the fresh `base` array — the same merge path every other drawer write uses; sibling pass-through asserted in `EditSlideDrawer.test.ts` vamp-assignment block. | closed |
| T-141-04 | Denial of service (self) | viewer `onSnapshot` on the editor-gated `vamps` collection | low | mitigate | `vampStore.subscribe(orgId)` sits inside `initStores()`'s `isEditor` block (`ServiceEditorView.vue:3176-3178`); viewer-never-subscribes asserted in `ServiceEditorView.test.ts` (`-t "141-01"`). | closed |
| T-141-05 | Denial of service (service experience) | duplicate audio owners → echo/triple-play on one machine driving several monitors | medium | mitigate | `:suppress-audio="true"` hardcoded at all four output-tier `SlideCanvas` mounts (`FullscreenSlideOutput.vue:38,65`, `ConfidenceOutputView.vue:41,74`) — a render-time gate on `SlideCanvas.currentAudioUrl` that never creates the element. Proven per output view (Audience/Confidence/Video tests). | closed |
| T-141-06 | Tampering | a future call site mounting `SlideCanvas` in an output without the flag | low | mitigate | All three output-view tests assert `canvasRegistry.every(c => c.suppressAudio === true)` with non-vacuous length checks (`AudienceOutputView.test.ts:281`, `ConfidenceOutputView.test.ts:352-361`, `VideoOutputView.test.ts:251`). | closed |
| T-141-08 | Repudiation / DoS (silent failure) | control-window `play()` rejected by autoplay policy or a deleted MP3 | medium | mitigate | `RunControlView.vue:48-49` wires `@autoplay-blocked="onAudioBlocked"` / `@error="onAudioError"`; `useRunControl.ts:288` sets `audioBlocked`, `:292` sets `audioUnavailable`; persistent `run-audio-blocked-banner` with retry (`RunControlView.vue:186`) and `run-audio-unavailable` indicator (`RunHeader.vue:107`). Both paths in `RunControlView.audio.test.ts`. | closed |
| T-141-09 | Denial of service (echo) | a second audio owner in the control window (RunPreviewPair preview canvases) | low | mitigate | Both preview canvases pass `:suppress-audio="true"` (`RunPreviewPair.vue:63,112`); `RunControlView.audio.test.ts` asserts `wrapper.findAll('audio')` has at most one element throughout (`:333,384,400,416`). | closed |
| T-141-11 | Tampering | stale/persisted arm state auto-playing across sessions or a hot reload | low | mitigate | `audioArmed = ref(false)` is in-memory only — no `localStorage`/`sessionStorage` write in `useRunControl.ts`; reset to `false` in `endServiceTeardown` (`:1106`), `endRehearsal` (`:1142`) and on unmount; "Audio: Off after End Rehearsal + re-Rehearse" asserted in `RunControlView.audio.test.ts`. | closed |
| T-141-13 | Tampering | Storage cascade orphaning an assigned slide's audio | medium | mitigate | `deleteVamp` re-runs `countAssignments` and computes `keepAttachment = scan === null OR scan.assignedAnywhere` (`vamps.ts:133-135`); Storage delete only when proven unassigned. Past-only / upcoming / none / failed-scan cases in `vamps.test.ts`. | closed |
| T-141-17 | Repudiation | misleading count (0 upcoming shown while the MP3 is kept for a past assignment) | low | mitigate | `VampAssignmentScan { assignedAnywhere, upcomingServiceCount }` (`src/types/vamp.ts:35-38`) keeps the two derived values separate; `VampSlideOver` copy states which case applies (`VampSlideOver.test.ts` singular/plural/failed/none). | closed |
| T-141-03 | Information disclosure | crafted foreign `vampId`/`downloadUrl` written into an entry | low | accept | Picker emits only from the org-scoped `useVampStore().vamps`; a foreign `vampId` points at an unreadable doc; bearer-URL semantics are pre-existing Firebase Storage behavior (out of scope). | closed (accepted) |
| T-141-07 | Information disclosure | `audioUrl` still delivered to output windows in `AssembledSlide` | low | accept | Same-origin windows of the same signed-in user; strict reduction of exposure vs. before the phase (URL no longer fetched by outputs). | closed (accepted) |
| T-141-10 | Information disclosure | `audioUrl` loaded by the control window | low | accept | Same-origin, same signed-in operator, same URL the outputs loaded before; no new fetch surface or persistence. | closed (accepted) |
| T-141-12 | Elevation of privilege | badge lookup reading `groupsBySlotId` | low | accept | Reads the already-subscribed, org-scoped Pinia store; no new query or rule. | closed (accepted) |
| T-141-14 | Tampering (race) | assignment created between the pre-delete scan and the delete | low | accept | Accepted residual per 141-CONTEXT.md ("best-effort"); scan re-runs inside `deleteVamp` itself, narrowing the window; recorded as the `verification: backstop` UAT item (141-UAT.md #4). | closed (accepted) |
| T-141-15 | Information disclosure | org-wide `slideGroups` list read by an editor | low | accept | Path-scoped to the editor's own org (`orgId` from the store); same data already readable service-by-service under the existing member-read rule. | closed (accepted) |
| T-141-16 | Denial of service | scan cost (all slideGroups + one `getDoc` per affected service) | low | accept | Runs only on delete-confirm open and inside the delete; failure returns `null` and never blocks (`vamps.ts:120`); no Cloud Function or index introduced. | closed (accepted) |
| T-141-SC | Tampering | supply chain (new dependencies) | low | accept | `package.json`/`package-lock.json` have 0 commits across the phase (`7b96cae0..HEAD`); zero new dependencies. | closed (accepted) |

*Status: closed · open · open — below high threshold (non-blocking)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-141-01 | T-141-03 | Foreign `vampId` is unreadable; bearer download URLs are pre-existing app-wide Firebase Storage semantics. | plan 141-01 (autonomous run, owner policy) | 2026-09-18 |
| AR-141-02 | T-141-07 | Outputs receive the same-origin URL they already loaded before the phase; exposure strictly reduced. | plan 141-02 (autonomous run, owner policy) | 2026-09-18 |
| AR-141-03 | T-141-10 | Control window is the same signed-in operator's document; no new surface. | plan 141-03 (autonomous run, owner policy) | 2026-09-18 |
| AR-141-04 | T-141-12 | Badge lookup reads an already-subscribed org-scoped store. | plan 141-03 (autonomous run, owner policy) | 2026-09-18 |
| AR-141-05 | T-141-14 | Scan→delete race accepted as best-effort per owner decision in 141-CONTEXT.md; UAT backstop item #4. | plan 141-04 (autonomous run, owner policy) | 2026-09-18 |
| AR-141-06 | T-141-15 | Org-scoped member read of data the editor can already open. | plan 141-04 (autonomous run, owner policy) | 2026-09-18 |
| AR-141-07 | T-141-16 | Rare editor action; fail-open, non-blocking; no backend cost added. | plan 141-04 (autonomous run, owner policy) | 2026-09-18 |
| AR-141-08 | T-141-SC | No new packages introduced. | plans 141-01/02/03/04 | 2026-09-18 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-09-18 | 18 | 18 | 0 | gsd-secure-phase (orchestrator L1 grep-depth; short-circuit — register authored at plan time, ASVS 1) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: secured` set in frontmatter

**Approval:** secured 2026-09-18
