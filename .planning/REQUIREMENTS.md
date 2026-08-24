# Requirements — Milestone v2.2 Configurability, Hardening & Cleanup

Composed from backlog review + open carry-forwards (audit 2026-08-23). Full per-rule
catalog and verdicts for the Teams work live in
`seeds/SEED-002-church-specific-rules-configurability.md`; research in `research/`.
REQ-IDs continue from v2.1 (last: R227).

## v2.2 Requirements

### Per-Org Team Configuration (999.8 / SEED-002)

- [x] **R228**: A church admin can define their own list of teams/ministries — add, rename, and remove teams in Settings, seeded with sensible defaults — instead of the hard-coded `['Choir','Orchestra','Communion','Special']` list.
- [x] **R229**: The service-plan team checkboxes (both the new-service dialog and the service editor) are driven by the org's configured team list, so each church sees its own teams.
- [x] **R230**: A church admin can optionally attach a song-tag filter to a team so that selecting that team on a service constrains AI song suggestions to songs carrying that tag — generalizing the hard-coded "Orchestra → Orchestra-tagged" rule to any team/tag.
- [x] **R231**: The hard-coded ordinal-Sunday automatic team pre-selection (1st Sunday → Orchestra+Communion, 3rd Sunday → Choir) is removed; a planner chooses teams manually per service.

### Security & Data-Integrity Hardening (999.11 / 999.10 / 999.2)

- [x] **R232**: Creating an `inviteLookup` record is restricted to an editor of the *target* org, so a signed-in user cannot forge an invite into a church they don't administer (self-invite fix) — while the legitimate invite → first-login acceptance flow still works.
- [x] **R233**: An organization's `createdBy` field cannot be changed after creation by an org editor (immutability guard, extending the existing `preservesLifecycleFields` pattern).
- [ ] **R234**: Deleting a service revokes all of its public share artifacts (`shareTokens` / `serviceShares` / `serviceShareLinks`, query-based since a service can hold multiple) so a deleted service's share URL no longer resolves.
- [ ] **R235**: Removing a song from a service clears that song's slides, even when the song was reprised elsewhere in the service (no orphaned slides).

### Pending-Render Edit Guard (999.9 / C4)

- [ ] **R236**: When a deck slide's render is still pending, the edit UI warns or prevents the user from customizing that slide, so per-entry changes are not silently discarded when the render flips pending → ready.

### Polish & Ops (999.4 / 999.6 / 999.7 / 999.1)

- [ ] **R237**: Non-song / non-scripture service slots are included in all Planning Center export modes (no dropped items).
- [ ] **R238**: Real volunteers reliably receive email — the messaging From address uses a verified sending domain (Resend domain verification + SPF/DKIM/DMARC), replacing the test-mode `onboarding@resend.dev` sender. Deliverable includes a documented owner runbook (DNS is owner-run and not app-verifiable).
- [ ] **R239**: The Owner Console meets baseline accessibility — real `<label>`/`aria-label` on its text inputs and ARIA tab semantics (`role="tablist"`/`aria-selected`) on the Configuration/Organizations tab strip (and the matching `ServiceEditorView` tab strip) — without breaking the always-mounted `onSnapshot` panels.
- [ ] **R240**: A single shared song-browse component powers both the Songs page and the service-plan song picker (extract the shared component).

## Non-Functional / Technical

- [x] **R241**: The still-live duplicated church-rule constants (the team list across `ServiceEditorView.vue`/`NewServiceDialog.vue`, and the Orchestra filter duplicated within `ServiceEditorView.vue`) are collapsed to a single source as a prerequisite for R228–R231. (Note: `VW_TYPE_LABELS` is already single-source — do NOT re-dedup it.)

## Open Design Decisions (resolve at discuss/plan/UI-spec time — not blocking requirements)

- **Team storage shape:** subcollection `organizations/{orgId}/teams` (mirrors `roles`, needs no rules change) vs. an `OrgSettings` array field (mirrors `defaultServiceTemplate` merge-at-read). Research favors the subcollection.
- **Deleting a team that services reference:** hard-block vs. soft-warn (live in-use count deferred).
- **Ordinal-rule replacement UX (R231):** no default at all vs. a per-org configurable default set of teams.
- **Resend scope (R238):** whether `SERVICE_SHARE_BASE_URL` (share-link host) also moves to the custom domain, or only the sender address changes (sender is live/no-redeploy; base URL is a Functions `defineString` needing redeploy).

## Future Requirements (deferred)

- Per-org configurable VW category **labels** (deferred anti-feature — keep VW behind the existing `vwModeEnabled` toggle; only generalize labels if a non-VW church needs it).
- Broader per-org worship config: configurable `ServiceSection` list, PC service/rehearsal times, live-fetched PC team selection (SEED-002 bucket A3/A4 — not this milestone).
- In-app surfacing of Resend domain-verification status (webhook/API poll) beyond the manual runbook.

## Out of Scope

- Configurable ordinal-Sunday rule / a generic filter-rule builder / configurable VW labels — SEED-002 anti-features: too church-specific or over-configuration; dropped, not modeled.
- `999.3` production draft-lock hand-check and the deferred `/gsd-verify-work` UAT items — owner verification tasks, not build work.
- Migrating the Bible-version union (ESV/NLT) or the Protestant-canon assumption — platform scope, engineering not config.

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| R228 | Phase 79 | Complete |
| R229 | Phase 79 | Complete |
| R230 | Phase 79 | Complete |
| R231 | Phase 79 | Complete |
| R241 | Phase 79 | Complete |
| R232 | Phase 80 | Complete |
| R233 | Phase 80 | Complete |
| R234 | Phase 80 | Pending |
| R235 | Phase 80 | Pending |
| R236 | Phase 80 | Pending |
| R237 | Phase 81 | Pending |
| R238 | Phase 81 | Pending |
| R239 | Phase 81 | Pending |
| R240 | Phase 81 | Pending |

Coverage: 14/14 v2.2 requirements mapped (100%).
