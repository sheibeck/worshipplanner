# Requirements: WorshipPlanner — v1.7 Volunteer Messaging & Notifications

**Defined:** 2026-08-13
**Core Value:** Smart weekly service planning following the Vertical Worship 1-2-3 methodology while rotating through the full song stable and respecting team configurations.

> v1.7 adds volunteer email messaging on top of the existing roster/roles, share-link, and
> Draft→locked lifecycle. Research: `.planning/research/SUMMARY.md` (+ STACK/FEATURES/ARCHITECTURE/
> PITFALLS). REQ-IDs continue the project's flat `R###` scheme from v1.6 (last was R129).
>
> **Locked scope decisions (owner-confirmed 2026-08-13):**
> - Provider: **Resend** (research recommendation; ~$0/mo at this volume). Send path is an
>   **owner-gated Cloud Function** holding the key; the provider secret in `.env.local` is owner-added.
> - Delivery tracking: **sent + hard bounces only** — no open-tracking.
> - Recipients derive from **assigned service roles**; teams are role groupings; no-email roles excluded.
> - Composer sends **personalized per recipient** (the "their roles" token renders each person's roles).
> - Re-lock diff: non-role changes default to **all assigned teams** as "affected"; planner narrows.
> - Scheduled sends fire in the **church-local timezone** (new org timezone setting).

## v1 Requirements

Requirements for the v1.7 milestone. Each maps to exactly one roadmap phase (see Traceability).

### Email Infrastructure & Settings

- [x] **R130**: An org owner can turn messaging off entirely from the main Settings screen; messaging
      is disabled by default until an org enables it, and every send surface honors the switch.

- [x] **R131**: Volunteer email sends through a backend send path that holds the provider API key
      server-side — no email address list or provider key is ever exposed to the client bundle.

- [x] **R132**: Per-service automatic-email defaults (lock notification, re-lock prompt, share-link
      reminder timing) inherit from Settings and can be overridden on a service while it is in Draft.

- [x] **R133**: An org can set its local timezone so scheduled sends fire at the intended local
      time of day.

### Recipient Resolution

- [x] **R134**: When composing or auto-sending, recipients are resolved from the roles assigned on the
      service and grouped into selectable teams (e.g. Worship, Tech, Vocals, Hosts) plus an
      "Everyone on this service" option.

- [x] **R135**: A person assigned to multiple teams is emailed once (deduped by address); roles with no
      email are excluded from the send and surfaced to the planner as an unreachable/open-roles count.

### Messages Composer & Send

- [x] **R136**: A ✉ Messages button on a service opens a composer whose recipients are teams first,
      with individuals addable below.

- [x] **R137**: The composer supports three message types — One-off message, Reminder, and Share
      service link — including ad-hoc one-off reminders to chosen teams/individuals.

- [x] **R138**: The composer has a subject and a body with insertable merge tokens: service date,
      service link, their roles, and song list.

- [x] **R139**: Each recipient receives a personalized email — the "their roles" token renders that
      individual's own assigned roles, not a shared block.

- [x] **R140**: The composer shows a live "Reaches N people" count reflecting the selected
      teams/individuals minus unreachable roles.

- [x] **R141**: The composer offers attach-the-service-order-link, send-me-a-copy, and
      schedule-for-later options.

### Delivery History & Bounces

- [x] **R142**: Each service has a "Sent on this service" history listing every message with its type
      (automatic / one-off / scheduled), recipient count, and send time.

- [x] **R143**: Hard bounces are surfaced per message in the history with an affordance to fix the
      bad address.

### Lock Notification

- [x] **R144**: When a service is locked, it can automatically email everyone assigned — their roles,
      the song list, and a link to the service order — governed by the per-service/Settings default,
      and never sent while the service is a draft or when messaging is off.

### Scheduled Share-Link Reminder

- [x] **R145**: The shared service link auto-sends to everyone assigned N days before the service
      (default 7, configurable), in the church-local timezone, and is skipped while the service is
      still a draft.

### Re-lock Change Notice

- [x] **R146**: After editing a locked service and re-locking, the planner is prompted to notify with a
      scoped change diff of typed, checkable entries (SONG / ORDER / ROLE / NOTES / SLIDES).

- [x] **R147**: Each change entry is tagged with the teams it affects (defaulting to all assigned teams
      for non-role changes), and the planner can send the update to only the affected teams or to
      everyone on the service.

- [x] **R148**: "Lock quietly" is always available to re-lock without sending; confirming a notify
      overwrites the lock snapshot so the next re-lock diffs against the new state, not the original.

## Future Requirements

Deferred to a later release. Tracked but not in the v1.7 roadmap.

### Notifications

- **Day-before call-time reminder**: an automatic Saturday-morning reminder sent only to people with a
  call time set (shown off-by-default in the imported design; not part of the owner's v1.7 ask).

- **Per-message open/read visibility**: only if the "sent + bounces" decision is ever revisited.

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Accept/Decline RSVP + response tracking | Duplicates Planning Center's core scheduling job; violates the standing "complement, not replace" constraint |
| Open-tracking / read receipts | Locked decision — v1.7 tracks sent + hard bounces only; open pixels add privacy questions and webhook complexity for little planning value |
| SMS / push channels | Email-only for v1.7; volunteers are reached by email from the roster |
| Rich HTML template builder | A subject + body with merge tokens is sufficient; a drag-and-drop template designer is over-scoped for a 2–3-planner tool |
| Two-way reply threading / inbox | This is outbound transactional mail, not a messaging inbox; replies go to the sender's own email |
| General contact list / CRM | Recipients derive from assigned service roles; a standalone address book duplicates the roster |
| Building/running an SMTP server, or sending from the client | Mail sends through the provider via one owner-gated Cloud Function holding the key |

## Deferred design decisions (resolve at phase discussion)

Not blocking scope, but flagged by research for the phase that owns them:

- **SLIDES-diff fingerprint granularity** (Phase 62, Re-lock Change Notice) — coarse "slides changed"
  vs per-slide-group hash. ARCHITECTURE proposes a lightweight per-group text-hash on the lock
  snapshot; confirm at `/gsd-discuss-phase 62`.

- **Provider account + domain auth (SPF/DKIM/DMARC)** (Phase 59, Messages Composer & Send Path) —
  owner DNS work that must complete before any "it sends to the inbox" claim; depends on whether the
  church domain DNS is self-managed.

## Traceability

Which phases cover which requirements. Phase column filled during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| R130 | Phase 58 | Complete |
| R131 | Phase 59 | Complete |
| R132 | Phase 58 | Complete |
| R133 | Phase 58 | Complete |
| R134 | Phase 58 | Complete |
| R135 | Phase 58 | Complete |
| R136 | Phase 59 | Complete |
| R137 | Phase 59 | Complete |
| R138 | Phase 59 | Complete |
| R139 | Phase 59 | Complete |
| R140 | Phase 59 | Complete |
| R141 | Phase 59 | Complete |
| R142 | Phase 60 | Complete |
| R143 | Phase 60 | Complete |
| R144 | Phase 61 | Complete |
| R145 | Phase 61 | Complete |
| R146 | Phase 62 | Complete |
| R147 | Phase 62 | Complete |
| R148 | Phase 62 | Complete |

**Coverage:**

- v1 requirements: 19 total (R130–R148)
- Mapped to phases: 19 (Phases 58-62)
- Unmapped: 0 ✓

---
*Requirements defined: 2026-08-13*
*Last updated: 2026-08-13 — ROADMAP.md created, 19/19 requirements mapped to Phases 58-62.*

---

# v1.8 — Messaging UX & Fixes

Follow-up milestone refining the shipped v1.7 volunteer-messaging feature from owner UAT. Continues the
`R###` scheme (v1.7 ended at R148) and phase numbering (v1.7 ended at Phase 62). Mostly client-side UI.
**v1.7 remains open** (its send path is UNDEPLOYED; owner deploy/verify pending in PENDING-VERIFICATION.md).

## Requirements

- [x] **R149** — Dedicated **Messages tab** in the Service Editor. The per-service "Messaging defaults"
  panel and the "Sent on this service" delivery-history panel MOVE out of the Service Order tab into this
  new tab. The ✉ composer stays an action-bar modal (unchanged location).

- [x] **R150** — The **"Sent on this service" delivery history is visible at all times** — locked, draft,
  or exported — no longer gated on `canEditService` (the Phase 60 / 60-03 defect where it vanished once the
  service locked). It lives in the Messages tab (R149) and renders for any editor of the org.

- [x] **R151** — The composer's **Send-To team labels mirror the Volunteer Roles group names exactly**:
  **Band, Vocals, Tech, Other** — dropping the v1.7 `MESSAGING_TEAM_LABELS` remap (band→Worship,
  other→Hosts) everywhere messaging renders team names.

- [x] **R152** — The composer's **"+ Add someone" actually adds** the selected individual to the recipient
  selector (`individualPersonIds`) — today it only focuses/highlights the dropdown and adds no one.

- [x] **R153** — The composer shows a **live email preview that updates in real time** as the subject/body
  are edited (merge tokens re-rendered against a sample recipient) — replacing the click-to-preview button.

- [x] **R154** — **Merge tokens:** remove `{{song_list}}` (the song list already ships in the service-plan
  / share link); add a **`{{name}}`** per-recipient token that renders the recipient's own name.

- [x] **R155** — The **Send action shows an in-progress spinner** while `queueServiceMessage` runs; and a
  message that cannot progress surfaces a **failed/timeout** affordance in the history instead of the
  perpetual "Sending…" (a `queued` doc currently renders "Sending…" forever).

- [x] **R156** — The three **message types seed distinct content** on selection (same send mechanism):
  **One-off** = blank subject/body; **Reminder** = subject `Reminder: {{service_date}}`, body seeded with
  the service link, recipients default to everyone assigned; **Share service link** = subject
  `Service plan for {{service_date}}`, body = `{{service_link}}` only.

## Traceability (v1.8)

| Requirement | Phase | Status |
|-------------|-------|--------|
| R149 | Phase 63 | Complete (63-01) |
| R150 | Phase 63 | Complete (63-01) |
| R151 | Phase 64 | Complete (64-01) |
| R152 | Phase 64 | Complete (64-03) |
| R153 | Phase 64 | Complete (64-03) |
| R154 | Phase 64 | Complete (64-03) |
| R155 | Phase 64 | Complete (64-03) |
| R156 | Phase 64 | Complete (64-03) |

**Coverage:** v1.8 = 8 requirements (R149–R156), mapped to Phases 63–64, 0 unmapped ✓

*v1.8 requirements defined: 2026-08-15 (from owner UAT of v1.7 messaging).*

---

## Post-v1.8 Owner UAT Hotfixes (2026-08-17)

A batch of owner-UAT fixes/changes to the shipped messaging feature, implemented + tested GREEN and
committed **directly to master** (outside the phase flow — small, targeted, each with its own tests). Not
part of a numbered phase; recorded here for traceability.

- [x] **R157** — The action-bar **✉ Messages button is HIDDEN when org Messaging is off** (not
  disabled-with-tooltip). Reverses Phase 59-04's deliberate discoverability choice per owner UAT; matches
  the Share / AI hide-on-fail rule. *(commit `bece0dc4`)*
- [x] **R158** — The composer **add-someone picker can select the only addable person**. A disabled
  placeholder let the browser pre-select the lone person, so choosing them fired no `change` event; fixed
  with a controlled empty-placeholder `<select>`. *(commit `e866e2f0`)*
- [x] **R159** — **Messaging From/Reply-To rework.** Outgoing volunteer emails send From
  `"<Organization Name>" <no-reply@worship-planner-bc515.web.app>` — the app's own single sending address
  (`MESSAGE_FROM_ADDRESS`, deploy-config) with the **org name** as the RFC 5322 display name
  (header-sanitized against injection) — and **Reply-To = the sending editor's email** (auto-built,
  needs no domain verification). The church-configured `fromName`/`replyTo` Settings fields are **removed**
  (a church can't own the sending domain). ⚠ `MESSAGE_FROM_ADDRESS` MUST be overridden at deploy time with
  an address on a **Resend-verified** domain — the `.web.app` default 403s ("domain not verified") until
  then. *(commit `9f8ccf3c`; root cause: Resend 403 on unverified per-church From domains)*
- [x] **R160** — **Unique organization names across all orgs.** New `orgNames/{normalizedName}` create-only
  registry + Firestore rule mirroring the existing `orgSlugs` pattern (slug uniqueness already existed).
  `claimOrgName` is idempotent for an org's own name. Enforced at **rename** (Settings rejects a taken
  name) and **best-effort at signup** (the default "<name>'s Church" auto-suffixes on collision, never
  blocking account creation). Going-forward only — pre-existing duplicates untouched until next edited.
  *(commit `972bdf04`)*

Supporting: the earlier local-emulator send-path unblock (`functions/.secret.local`, commit `d34c56c7`).

**Deploy impact (owner action):** `firebase deploy --only firestore:rules` is now **also required** (new
`orgNames` rule) alongside the pending v1.7/v1.8 send-path deploy (functions
`queueServiceMessage`/`sendQueuedMessage`/`sendScheduledReminders`) + `hosting`. `messageWebhook` stays held
back pending `RESEND_WEBHOOK_SECRET`. Set `MESSAGE_FROM_ADDRESS` to a verified-domain address at deploy.

*Post-v1.8 hotfixes recorded: 2026-08-17.*
