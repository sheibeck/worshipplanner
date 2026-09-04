# WorshipPlanner

## What This Is

A worship service planning app for church worship teams that builds weekly service orders using the Vertical Worship methodology. It manages a song stable with CSV import, suggests songs based on VW category and rotation, provides AI-powered song and scripture discovery, and delivers printable/shareable service plans with team RBAC. Built with Vue 3 and Firebase, it complements Planning Center — you plan here, then execute there.

## Core Value

Smart weekly service planning that follows the Vertical Worship methodology (1→2→3 song progression) while rotating through the full song stable and respecting team configurations.

## Current Milestone: v2.10 Security & Architecture Hardening

**Goal:** Remediate the actionable Medium/Low findings deferred from v2.8's security and architectural
reviews (backlog 999.5 + 999.4), closing the gap between "reviewed" and "fixed" — starting with the
unauthenticated `/api/planningcenter` proxy.

**Target features:**

- **Security hardening (from backlog 999.5)** — authenticate the `/api/planningcenter` proxy route
  (SEC-A-01, highest priority: currently zero auth, open-relay/DoS risk); extend the per-uid rate limiter
  to the ESV/NLT Bible-API proxy branches (SEC-C-01); restrict the `services` draft-edit branch so
  `createdBy`/provenance fields can't be forged (SEC-R-03); harden super-admin's universal `members`
  write from a client-code contract toward a rule-level invariant (ARCH-018/SEC-ISO-04); split
  `get`/`list` on the publicly-readable `orgSlugs`/`orgNames` registries (SEC-ISO-06 residual); add
  enqueue/import quotas to `queueServiceMessage` and `parsePptx` (SEC-C-05/06); PII-filter free-text
  fields on the public share page (SEC-S-04); and address the deterministic share-id (SEC-S-02) and
  `admin`-vs-`editor` role-semantics (SEC-ISO-05) findings.
- **Architecture hardening (from backlog 999.4)** — add per-item failure isolation to the `lastUsedAt`
  recompute loop (ARCH-011) and batch the unbatched Planning Center song-import writes (ARCH-014); fix the
  drifted/duplicated lyrics subscription query (ARCH-009) and the unreachable `pcExportedAt` dead code
  from the JSON deep-clone Timestamp strip (ARCH-012); close the org-switch teardown/re-subscribe gaps
  (ARCH-002, ARCH-003); route direct `updateDoc`/`onSnapshot` calls back through their stores
  (ARCH-007, ARCH-008); confirm-and-test the autosave/reorder-save coordination window (ARCH-013); and
  begin decomposing the two god modules — `ServiceEditorView.vue` and `functions/src/index.ts`
  (ARCH-006, ARCH-010) — plus the utility-layer dependency-direction nit (ARCH-020).

**Key context:** Pure remediation of findings already fully documented in the v2.8 review reports
(`.planning/milestones/v2.8-phases/112-security-review/112-SECURITY-REVIEW.md` and
`110-architectural-review/110-ARCHITECTURE-REVIEW.md`) — no new user-facing features, no research pass.
**Out of scope:** the confirmed-sound / no-finding items (SEC-C-02..04, SEC-A-02, SEC-S-05,
ARCH-015..019, ARCH-021..023), ARCH-005 (already resolved — org-provisioning functions are deployed),
and SEC-S-03 (share links never expiring — an intentional product-design decision, recorded but not
changed). Requirements continue from R339; phases continue from 117.

## Shipped Milestone: v2.9 Live Presentation Field Fixes — ✅ SHIPPED & DEPLOYED 2026-09-04

**Goal:** Fix the readability, multi-monitor, and lyric-editing rough edges surfaced by the first real
church-projector run, so a projectionist can set up and read the live output without fighting the tool.

**Target work (three groups):**

- **Multi-monitor rework** (reworks the v2.4 monitor config) — support *any number* of connected monitors
  (verified against a real **3-monitor** setup, not just 2); assign *any role to any monitor*, including
  **multiple Audience** monitors, and **make the assignment stick** — the core bug is that with 3 monitors
  the roles wouldn't hold (the single-select Audience/Confidence model collapses); auto-placement to the
  assigned displays must work on **Mac too** (treat the Mac tab-placement failure as a bug to fix, not a
  limitation to route around with manual dragging); and stop the false "your monitors changed" re-detect
  prompt on an unchanged setup.
- **Live-output readability & layout** — **auto-scale slide text** to fill the screen (no manual size
  control; the font *family* stays pickable in config as it is today via v1.5 slide typography); shrink the
  live main screen and enlarge the preview thumbnails so they're readable; add an **"end" marker** after
  the last thumbnail (song's over, next item coming); investigate the flaky Mac thumbnail scrollbar (may be
  nothing).
- **Lyric editor / song UX** — relabel the edit-lyrics link to **"Edit song lyrics for {song name}"** and
  open the song in a **new tab**; add a **SongSelect link** next to the song name in the editor title bar;
  rename **"Cancel" → "Close"**; allow **manually editing Credits / CCLI / copyright** text (fixes stale
  credits after a wrong-then-right paste); and **hide the History tab** (defer — the "Just now"-everywhere
  version list is confusing and adds no value yet).

**Key context:** All field feedback from the first real church-projector run (church Mac + projector, the
external-link hardware). **Out of scope / deferred:** all audio — vamps (mp3 upload + slide assignment)
and canned pre/post-service music — punted to a future milestone / the backlog 999.13 storage cluster
(SEED-003), since they open the Firebase Storage + external-media cost/security surface; and the
unsupported-browser warning is **dropped** (Safari ran the app fine on retest). No research pass (internal
fixes to existing features). Requirements continue from R324; phases continue from 114.

## Shipped Milestone: v2.8 Production Hardening — Comments-as-Specs, Architecture & Security Review — ✅ SHIPPED & DEPLOYED 2026-09-02

**Status:** Shipped, deployed to production, archived, and tagged `v2.8` (2026-09-02). Full record:
[milestones/v2.8-ROADMAP.md](milestones/v2.8-ROADMAP.md) · MILESTONES.md.

**Goal:** Prepare the app for real-world use (it can impact real people if it has issues) by extracting
load-bearing comments into GSD's durable stores, then running architectural and security reviews and
remediating the Critical/High findings.

**Delivered:** Comments-as-Specs sweep (244 ADRs under `docs/adr/` from 382 tagged rationale comments +
309 behavioral comments relocated to `.planning/codebase/` map docs, comments shrunk to pointers, go-forward
convention documented — R316–R319); an architectural review (23-finding report, sole High ARCH-001 store-layer
epoch guard fixed, 22 Medium/Low → backlog 999.4 — R320–R321); and a security review that found and fixed a
**proven LIVE Critical cross-tenant leak** (SEC-S-01: `shareTokens`/`quarterShares`/`serviceShares` fully
listable via `allow read: if true`, exposing every org's shared plans + volunteer names) plus a member-removal
Storage-claim revocation gap (High), with 11 Medium/Low → backlog 999.5 (R322–R323). All remediation deployed
to production.

## Shipped Milestone: v2.7 Rehearsal, Stage Plans & Presentation Polish — ✅ SHIPPED & DEPLOYED 2026-09-01

**Status:** Deployed to production (tag `v2.7`; hosting only — client-side changes, no rules/functions).
Audit PASSED (14/14 requirements, 6/6 integration seams). Human/visual UAT owner-verified PASSED
2026-09-01 (STATE.md Human UAT · `.planning/v2.7-DEFERRED-VERIFICATION.md`). Full record:
[milestones/v2.7-ROADMAP.md](milestones/v2.7-ROADMAP.md) ·
[milestones/v2.7-REQUIREMENTS.md](milestones/v2.7-REQUIREMENTS.md) ·
[v2.7-MILESTONE-AUDIT.md](v2.7-MILESTONE-AUDIT.md).

**Goal (as shipped):** Richer live-presentation tooling and multi-church usability — inline black slide +
audience-only "Go to black", a system-wide dismissible-notification store, a per-item loop, a user-menu
church switcher, and a freeform visual per-service **stage layout** (redesigned to the owner's imported
design, with band-role instruments, person "Name - Role" assignment, notes, a "+ Vocal" flag, a
landscape stage-only share + a landscape B&W "Print for tech"). The rehearsal/file-storage cluster
(song attachments + public Rehearse mode) was deferred to backlog 999.13 (SEED-003).

<details>
<summary>Original v2.7 target-feature framing (pre-ship) — retained for reference</summary>

**Target features:**
- **Inline black slide in the lyric editor** — insert a black "interlude" slide within a song's slides (long instrumental/interlude sections) without creating a new blank section.
- **"Go to black" affects only the Audience output** — today it also blacks the confidence monitor; leave the confidence monitor visible.
- **Dismissible messages, system-wide** — no warning/error that gets stuck on screen; the "monitors not configured" warning auto-clears once monitors are set up, and every message is manually dismissible app-wide.
- **Loop a service item** — a per-item "loop" checkbox that auto-advances the item's slides and loops back to its start; default every 10s, with an interval dropdown + custom value.
- **Switch churches from the user menu** — a multi-org member switches active church from the top-bar user menu (builds on the existing multi-org `orgs:{orgId:role}` claim infra from v2.0/v2.1).
- **Visual stage layout per service** — a freeform drag-and-drop canvas (a tab on the service) placing instruments/mics in on-stage and off-stage (side) zones, including extra mics for one-off speakers, so tech/sound know the setup.

**Deferred out of v2.7 (owner decision 2026-08-31 — "defer the storage/rehearsal for now"), carried to a future milestone:**
- **Rehearsal attachments on songs** — attach PDF chord charts, MP3s, and YouTube links to a song in the stable.
- **Rehearse mode on the shared service link** — a Rehearse button opening a per-song list to play the attached MP3 / YouTube and view the PDF.
- These form the storage/public-media cluster (Firebase Storage + unauthenticated share-page media playback + egress cost) — the milestone's biggest security/cost surface — and are held for their own milestone.

**Key context / decisions:**
- Church switching builds on the existing multi-org custom-claim infra (v2.0 additive `orgs:{orgId:role}` map; v2.1 super-admin enter-any-church already switches active org) — this exposes it to regular multi-org members from the user menu.
- Stage layout is a **freeform visual canvas** with on-stage / off-stage (side) zones; positions saved to Firestore (no file storage).
- Research requested → domain research runs before requirements.

</details>

## Previous Milestone: v2.6 Per-Org Bible API Toggle & Manual Fallback — ✅ SHIPPED & DEPLOYED 2026-08-31

**Status:** Deployed to production (tag `v2.6`; rules + `functions:api`/`setOrgBibleEnabled`/
`listOrganizations` + hosting). Audit PASSED (7/7 requirements, 5/5 integration seams). Closed on owner
acceptance; human/visual UAT was deferred (`.planning/v2.6-DEFERRED-UAT.md`, batched per explicit owner
instruction for this autonomous run). Full record: [milestones/v2.6-ROADMAP.md](milestones/v2.6-ROADMAP.md) ·
[milestones/v2.6-REQUIREMENTS.md](milestones/v2.6-REQUIREMENTS.md) ·
[v2.6-MILESTONE-AUDIT.md](v2.6-MILESTONE-AUDIT.md).

**Goal:** Put Bible API access behind a per-organization on/off switch controlled from the Owner Console, and when it is off give that org a zero-cost manual path so scripture and congregational-reading features always work without passing pay-only, non-commercial API costs to users.

**Delivered:**
- **Per-org Bible API toggle in the Owner Console** — a super-admin enables/disables Bible API access per church (Organizations tab → `OrgConfigDrawer`), backed by a super-admin-gated Cloud Function (`setOrgBibleEnabled`) writing a master `Organization` field, denied to direct client writes in `firestore.rules`. Mirrors the v2.2 per-org AI enablement pattern. **Default OFF** for every org, including the existing production org (Berean) — no data migration.
- **Single Bible-fetch choke point** — `src/utils/scriptureApi.ts` (the `isAiEnabled()` analog) unified the previously split ESV/NLT fetching in `ScriptureInput.vue`/`CongregationalEditor.vue`; the server `api` proxy's `esv`/`nlt` branches independently enforce the same gate (`checkOrgBibleEnablement`) as defense-in-depth.
- **Manual fallback when OFF** — an "Open in BibleGateway" deep-link (any version). **Owner refinement 2026-08-31, post-Phase-103:** the separate "paste the passage" textarea and the off-state explanatory message were removed before ship — a plain scripture slide is reference-only (deep-link only) when off, and a congregational reading is composed directly in the existing bottom reading/format textarea, with the LLM split still running on that text under the independent AI gate.
- **Settings hides the Bible Translation selector** when the API is off for the org, mirroring the "AI Features" card.

**Issues caught & fixed:** two code-review rounds found and closed real defects before ship — Phase 102's
review caught a live gate bypass in `planningCenterApi.ts`'s scripture-push branch; Phase 103's review
caught two fallback data-loss bugs (pasted text erased by a reference edit or the still-visible Preview
button; paste-box keystrokes clobbering an AI split or manual edit).

**Standing owner follow-up:** because the default is OFF, each production org — including Berean — must
be explicitly enabled for the Bible API via the Owner Console, or that org's ESV/NLT auto-fetch stops and
it falls back to the manual/BibleGateway path.

## Previous Milestone: v2.5 Invite Email & Non-Google Onboarding — ✅ SHIPPED 2026-08-31

**Status:** Code-complete, audited PASSED (7/7 reqs, 4/4 integration seams), function deployed to production, and locally UAT'd (owner confirmed). No active milestone follows — run `/gsd-new-milestone` to start one. **Standing owner follow-ups:** deploy hosting (the client invite-UI/toggle/LoginView changes are live only in local dev), and complete Resend DNS domain verification so invite emails reach addresses other than the owner's own inbox.

**Goal:** Every invited user gets an invite email, non-Google users can set a password and sign in, and an owner can switch onboarding emails on/off.

**Target features:**
- **Server-side invite email for all invitees** — inviting anyone through the app's TeamView invite UI sends a real email (reusing the existing Resend send pattern in `functions/src/adminEmail.ts` + secrets). Today no one receives anything.
- **Set-password onboarding for non-Google users** — a Cloud Function creates the Firebase Auth account (`admin.auth().createUser`) for the invited email and emails a `generatePasswordResetLink()` "set your password" link, so a brand-new non-Google user (e.g. `bob@someemail.com`) can actually get in. Google/Gmail invitees instead get a simple "you've been invited — sign in with Google" notification (no account pre-created, no password).
- **Wire the real flow into TeamView `onInvite`** and correct the invite UI copy.
- **Discoverable password path in LoginView** plus a real `auth/operation-not-allowed` error message (instead of the generic "Sign-in failed").
- **Owner Console onboarding-email toggle** — a checkbox in `ConfigurationTab` (backed by `appConfig`) to enable/disable sending onboarding/invite emails; the invite function respects it.

**Key context / decisions:**
- Root cause of the original bug and the chosen mechanism are recorded in `.planning/debug/resolved/non-gmail-password-setup.md`: the old TeamView invite only wrote Firestore docs — it never sent an email or provisioned an Auth account, so non-Google invitees had no discoverable way to get a password.
- **Flagged for phase discussion:** how the system decides Google-vs-non-Google per invitee (leaning: `gmail.com`/`googlemail.com` → notify-only, else → set-password link, with the set-password email also offering Google sign-in as a fallback so no one is stranded); and whether the onboarding-email toggle is global (`appConfig`, leaning) or per-org.
- **Owner-run external prerequisites** (not code, tracked): confirm Firebase Auth **Email/Password provider is enabled** for `worship-planner-bc515`; complete `functions/DEPLOY-EMAIL-DOMAIN.md` **Resend DNS domain verification** so invite emails reach non-owner addresses (default `onboarding@resend.dev` only delivers to the Resend account owner's inbox).
- Must not break existing Google sign-in or the invite-acceptance path (`ensureUserDocument`) / Firestore rules.

## Previous Milestone: v2.4 Run the Service — ✅ SHIPPED & deployed to production 2026-08-30

The live "Run the Service" milestone shipped and is live at `worship-planner-bc515.web.app` (client-only;
closed on owner approval). Browser zero-click multi-monitor fullscreen proved unachievable on real
hardware, so the outputs go fullscreen via reliable per-display "Go fullscreen" buttons and Phase 98's
registry-policy helper was removed. **No next milestone is defined yet — run `/gsd-new-milestone` to start
one.**

### Delivered milestone goal + features

**Goal:** Give a non-technical projectionist a clean, standalone way to *run* a locked service's
slide deck live during a church service — driving a fullscreen audience projector and a band
confidence monitor from one Chrome/Edge browser.

**Target features:**
- **"Run" button on any locked service** → opens a dedicated, standalone Run/control screen (not the
  cluttered service editor).
- **Run/control screen** — the order of service down one side with the **current item clearly
  highlighted** by which slide you're on; **click an item to jump** to its first slide; a large
  current-slide view; **standard keyboard navigation** (arrows / space / etc.); calm, non-technical UX.
- **Standalone, persistent monitor configuration** — a dedicated setup screen (separate from the Run
  flow) that detects connected monitors and assigns **Audience** vs **Confidence** roles; the mapping
  is **saved and remembered per device** so running a service is essentially one click (re-prompt only
  if the physical monitor layout changed).
- **Audience output** — fullscreen slides *with* backgrounds and **zero chrome** (no arrows, slide
  counts, or organizational labels).
- **Confidence monitor output** — **current + upcoming** slide with **background images suppressed to
  black**; no chrome.
- **Multi-monitor delivery from the browser** — Window Management API on Chrome/Edge for
  auto-placement, with a **pop-out-window + fullscreen fallback** when screen permission isn't granted.
- **UI research** on live-presentation conventions (ProPresenter / EasyWorship / Proclaim) so
  navigation is obvious and keyboard shortcuts are standard.

**Key context / decisions:**
- New **projectionist** role concept = the person running the service; only **locked** services can be Run.
- **Chrome/Edge** target confirmed; browser multi-monitor delivery is the central technical unknown for research.
- **Deferred (out of scope this milestone):** instant blackout / logo-cut button; any non-Chromium
  monitor auto-detection.

## Current State — between milestones — v2.6 shipped; next scoped via /gsd-new-milestone

All milestones through **v2.6** have shipped and are archived under `.planning/milestones/`. **No active
milestone** — the next one is scoped via `/gsd-new-milestone`. v2.6 is deployed to production (tag `v2.6`;
rules + `functions:api`/`setOrgBibleEnabled`/`listOrganizations` + hosting); each production org (incl.
Berean) must be enabled for the Bible API by hand via the Owner Console since the default is OFF. v2.5's
`functions:sendInviteOnboardingEmail` is deployed to production; its hosting deploy and Resend DNS domain
verification remain standing owner follow-ups (below).

<details>
<summary>Shipped milestone — v2.3 Scheduling Accuracy & Song/Team Refinements (Phases 84–89, shipped & deployed 2026-08-27)</summary>

Fixed scheduling-and-rotation correctness and added the team-scheduling + editing-UX controls churches
needed. **Delivered:** last-used date now derives from a song's most-recent **LOCKED** service (killing the
Aug-11-vs-Sep-6 bug) plus a one-time backfill applied to the Berean prod org (R247–R248); **Vocals folded
into Band** with a Band↔Tech one-team-per-date conflict rule and the vocals sing-and-play exception
(R250–R252); Nth-Sunday **recurring team auto-scheduling** via a Volunteer→Teams `>` slideout (R254–R255);
editable song **Key**, sermon-free Scripture rotation, and corrected schedulable-roles copy (R249, R253,
R256); **Roles/Teams tabs** reworked to read-only rows opening a slideout (mirroring Songs) + a song Key
type-ahead (R257–R258); and — added mid-milestone from UAT — a generalized per-role **multi-role** flag
(any group, vocals default-on, cross-type) with same-date scheduler **bundling** anchored on a person's
rarest role (R259–R260). Deployed to production 2026-08-27 (hosting + all Cloud Functions incl. the Phase-85
vocals→Band messaging fix); no `firestore`/`storage` rules changes. Owner-approved UAT; audit PASSED 14/14,
all integration seams WIRED. The code-review gate caught two shipped-bug-preventing defects (Phase-84
date-clobber, Phase-85 vocalist message drop). Full record:
[milestones/v2.3-ROADMAP.md](milestones/v2.3-ROADMAP.md) ·
[milestones/v2.3-REQUIREMENTS.md](milestones/v2.3-REQUIREMENTS.md) ·
[milestones/v2.3-MILESTONE-AUDIT.md](milestones/v2.3-MILESTONE-AUDIT.md).

</details>

<details>
<summary>Shipped milestone — v2.2 Configurability, Hardening & Cleanup (Phases 79–83, shipped 2026-08-25)</summary>

Made the app fit churches other than Berean and closed accumulated security/data-integrity/polish debt.
**Delivered:** per-org configurable **Teams** (each church's own team list, modeled like roster roles)
replacing the hard-coded `['Choir','Orchestra','Communion','Special']` list, plus dropping the
ordinal-Sunday auto-team rule (R228–R231, R241 dedup); security & data-integrity hardening —
`inviteLookup` create gate + org `createdBy` immutability (firestore.rules), `deleteService`
share-artifact revocation, reprise-safe song-slide clear, pending-render edit guard (R232–R236);
polish/ops — full Planning Center export slot coverage, Resend verified-domain owner runbook, Owner
Console accessibility (labels + ARIA tabs), one shared `SongBrowser` component (R237–R240); per-org **AI
enablement** OFF-by-default behind a super-admin master gate + fail-closed proxy (R242–R243); and
Roles/Teams tab width + real Delete button + corrected schedulable-roles copy (R244–R246). Hosting
deployed to production 2026-08-25; the Phase 80 rules and Phase 82 rules+functions ship UNDEPLOYED as
owner-gated hand-overs. Audit PASSED (19/19). **R230 (the per-team song-tag AI filter) was delivered in
Phase 79 then removed 2026-08-25 by owner decision** — it only fed AI suggestions and confused users.
Human UAT (`/gsd-verify-work 79–83`) deferred (`PENDING-VERIFICATION.md`). Full record:
[milestones/v2.2-ROADMAP.md](milestones/v2.2-ROADMAP.md) ·
[milestones/v2.2-REQUIREMENTS.md](milestones/v2.2-REQUIREMENTS.md) ·
[milestones/v2.2-MILESTONE-AUDIT.md](milestones/v2.2-MILESTONE-AUDIT.md).

</details>

<details>
<summary>Shipped milestone — v2.1 Organization Lifecycle & Super-Admin Access (Phases 75–78, deployed 2026-08-23)</summary>

Gave the super-admin full lifecycle control over churches from the Organizations tab — deactivate/reactivate
(a reversible off-switch blocking that org's members from logging in), delete-with-full-cascade-cleanup (every
Firestore relationship + all Storage under the org; deactivation-gated, irreversible, super-admin-gated
callable), pending-invite visibility ("pending login" vs active members), and super-admin "enter any church"
(per-row Sign-in switches active org; granted via a super-admin arm in `firestore.rules`/`storage.rules`, no
member doc, "viewing as super-admin" banner). v1.9 → v2.0 → v2.1 shipped together to production 2026-08-23 (in
that order — each depends on the prior's auth-claim widening). Features 2 (destructive cascade) and 4
(privileged cross-tenant access) were security-critical → STRIDE + rules ALLOW/DENY tests. Human UAT
(`/gsd-verify-work 75–78`) deferred and preserved in `PENDING-VERIFICATION.md`. Requirements: R193–R211
(v2.1 range).

</details>

<details>
<summary>Code-complete milestone — v2.0 Multi-Church Onboarding & Owner Console Tabs (Phases 72–74, code-complete 2026-08-21; deploy + UAT + milestone lifecycle parked with owner)</summary>

Turned the owner console into a tabbed shell (Configuration + Organizations) and added platform
multi-tenancy: list all churches, onboard a new one (org record + default `OrgSettings` + seeded default
service template + first admin by email) via super-admin-gated atomic callables, assign additional admins
(reusing the editor role), and widened the org-membership custom claim to an additive `orgs:{orgId:role}`
map (+`storage.rules`) so a multi-org user keeps Storage access everywhere (closed backlog 999.5).
**Code-complete + auto-verified + SECURED (Phases 72–74, R193–R211); human UAT + all deploys handed to the
owner and not yet run; the read-only milestone audit was gathered but not finalized.** v2.1 builds church
lifecycle (deactivate/delete) + super-admin access on top. Requirements: `.planning/REQUIREMENTS.md`
(R193–R211).

</details>

<details>
<summary>Code-complete milestone — v1.9 Owner Admin Console (Phases 68–71, code-complete 2026-08-20; deploy + UAT parked with owner)</summary>

Delivered a private super-admin owner console: a super-admin custom-auth-claim access gate + roster grant/
revoke (server-verified `setSuperAdminClaim`), a Firestore-backed live platform-config doc the Cloud
Functions read at runtime (four `*_CLEANUP_ENABLED` switches, retention windows, delete blast-radius cap,
AI-proxy + messaging/fan-out knobs), a no-reply sender field, and dry-run blast-radius safety before any
deletion toggle — with the song-linked-background protection preserved. **Code-complete + auto-verified
(Phases 68–71, R174–R192); human UAT + all deploys handed to the owner and not yet run.** v2.0 builds the
tabbed shell + org onboarding on top of this console (the church-provisioning / multi-admin work v1.9
deliberately deferred). Requirements: `.planning/REQUIREMENTS.md` (R174–R192).

</details>

<details>
<summary>Shipped milestone — v1.8 Cost & Billing Hardening (Phases 65–67, deployed 2026-08-20)</summary>

Full record below and in [milestones/v1.8-ROADMAP.md](milestones/v1.8-ROADMAP.md). The most recent
milestone, **v1.8 Cost & Billing Hardening** (Phases 65–67, R161–R168 + R170–R173), shipped 2026-08-20
with its safe config **deployed to production** the same day. Its cost/cleanup levers are the env vars this
v1.9 admin console lifts into a Firestore-backed, owner-controllable surface (see
`.planning/seeds/SEED-001-admin-settings-interface.md`).

</details>

<details>
<summary>Shipped milestone — v1.8 Cost & Billing Hardening (Phases 65–67, deployed 2026-08-20)</summary>

**Delivered:** capped and made observable every runaway cost surface on the live Blaze-plan app.
**Phase 65** — the metered Claude `api` proxy gained a per-uid rate limit (429, fail-open), server-side
model allow-list (400) + `max_tokens` clamp, an `aiUsage` token-usage ledger, and a `maxInstances` cap,
all gated to the anthropic upstream. **Phase 66** — proved+hardened the media/orphan-render sweeps and
added two new retention sweeps (`cleanupOrphanBackgrounds` with 3-tier reference detection + two
fail-safes, `cleanupPptxSources`), all dry-run by default; retention windows later made env-tunable with
media bumped to 30 days. **Phase 67** — gated the unused daily cross-org `sendScheduledReminders` scan
off, added a Resend recipient cap + per-org daily quota, a project-wide `setGlobalOptions` instance
ceiling, and Cloud Run render-service caps (`--max-instances=3`). **Deployed:** the AI proxy caps,
reminder-cron gate, send caps, and all instance ceilings are LIVE; the four cleanup crons are live in
**dry-run** (delete nothing until the owner sets each `*_CLEANUP_ENABLED=true`).

**Standing owner follow-ups (outlived the milestone):** activate the storage-deletion flags after
reviewing dry-run logs; deploy the Phase 65 `firestore.rules` deny (`firebase deploy --only
firestore:rules`); gating the reminder cron also pauses composer "schedule-for-later" until
`SCHEDULED_MESSAGING_CRON_ENABLED=true`. Full record: [milestones/v1.8-ROADMAP.md](milestones/v1.8-ROADMAP.md) ·
[milestones/v1.8-REQUIREMENTS.md](milestones/v1.8-REQUIREMENTS.md) · [milestones/v1.8-MILESTONE-AUDIT.md](milestones/v1.8-MILESTONE-AUDIT.md).

</details>

<details>
<summary>Shipped milestone — v1.7 Volunteer Messaging (Phases 58–64, deployed 2026-08-17, archived 2026-08-18)</summary>

**Delivered:** the complete volunteer-messaging system — a Settings kill-switch and org timezone, one
shared server-side recipient resolver, a ✉ composer (teams-first recipients, merge tokens, live
"Reaches N", schedule-for-later), per-service delivery history, an HMAC-verified bounce webhook,
automatic lock and N-days-before scheduled-reminder emails, and a re-lock scoped change diff — all
governed by a global Settings kill-switch and one queue-then-trigger send primitive holding the Resend
key server-side. Plus the messaging-UX refinements (dedicated Messages tab, always-visible history,
live preview, corrected `{{name}}` token) and the post-UAT hotfix batch (R157–R160: hide-when-off,
add-someone fix, From/Reply-To rework, unique org names).

**Scope note:** internally tracked as two milestones (v1.7 Phases 58–62, v1.8 Phases 63–64) that
stacked without archiving between them; shipped together in one production deploy and combined into a
single v1.7 milestone at close (owner decision 2026-08-18). Full record:
[milestones/v1.7-ROADMAP.md](milestones/v1.7-ROADMAP.md) ·
[milestones/v1.7-REQUIREMENTS.md](milestones/v1.7-REQUIREMENTS.md). See MILESTONES.md for the full
accomplishment list.

**Standing follow-ups:** email is still test-mode `onboarding@resend.dev` until the verified-domain
harden (backlog 999.6); `messageWebhook` bounce tracking is live with the real Resend secret.

</details>

## Current State

**Shipped:** v1.0 MVP (Phases 1–4, 6–7) · v1.1 (Phases 8–17) · v1.2 Worship Service Slide Management
(Phases 18–23) · v1.3 Slides Tab Rework (Phases 24–28) · v1.4 Service and Slides (Phases 29–38,
shipped 2026-08-05) · v1.5 Settings, Sharing, and Fidelity (Phases 39–50, shipped 2026-08-10) · v1.6
Editing Reliability & Song Slides (Phases 51–57, shipped 2026-08-12) · **v1.7 Volunteer Messaging
(Phases 58–64, shipped & deployed to production 2026-08-17, archived 2026-08-18)** — all archived.

**Open:** no active milestone — next is scoped via `/gsd-new-milestone`. v1.7 delivered the full
volunteer-messaging system (kill-switch + timezone, shared recipient resolver, ✉ composer, delivery
history + HMAC bounce webhook, lock & scheduled-reminder auto-notifications, re-lock scoped diff,
dedicated Messages tab, composer refinements, R157–R160 hotfixes). Closed on owner acceptance with the
`/gsd-verify-work 58..64` human-UAT items accepted as deferred (preserved in `PENDING-VERIFICATION.md`),
per the v1.4/v1.5/v1.6 precedent. Standing follow-up: email remains test-mode `onboarding@resend.dev`
until the verified-domain harden (backlog 999.6).

### v1.4 shipped on owner acceptance, with two things left genuinely unfinished

Phases 29–31 were verified normally. **Phases 32–38 were accepted, not verified** — their
`*-VERIFICATION.md` files carry `status_source: owner-attributed`, `/gsd-audit-milestone` was never
run, and the unrun checks are preserved in `.planning/PENDING-VERIFICATION.md` under a CLOSED UNRUN
header. The owner's call, made explicitly: *"Any issues I find from here on out will go in the next set
of changes I'm going to post."*

Two items are not merely unverified but **incomplete**, and are carried into Active below:

1. **PPTX server-side rendering — backend DEPLOYED 2026-08-06, no UI consumes it** (Phase 37,
   R062 still `[~]`). The Cloud Run service is live at `pptx-render` in `us-central1`, verified
   private (unauthenticated requests get 403), and `PPTX_RENDER_SERVICE_URL` is wired into the
   deployed functions. What remains is the half that was always out of scope: **nothing in `src/`
   reads the rendered PNGs**, so a PPTX import produces images in Storage that the app never
   displays. R062's "looks like the original PowerPoint" is not satisfied until that display work
   is built — and no phase owns it.
2. **`firestore.rules` is not deployed** (backlog 999.3). Phase 31's draft lock is a three-layer
   control whose third layer ships separately from the bundle and is currently not live.

v1.2 gave the app slide management (lyrics, scripture, PPTX import, media, presentation preview). v1.3
then reworked it around a **persisted slide-group model**: a dedicated **Slides** tab where all slide
editing lives, a plan rail that mirrors the service order rather than duplicating it, an Edit Slide
drawer, and a song lyrics editor rebuilt as one list that IS the slide order. The first tab was renamed
**Service Order** and stripped of slide editing.

**Verification note:** `workflow.verifier` was `false` through v1.2 and v1.3, so neither produced
automated `VERIFICATION.md` output. v1.2 closed on owner acceptance with its checkpoints waived; v1.3
was verified by the owner directly. The setting was **enabled on 2026-07-28**, so v1.4 onward gets real
per-phase verification.

**Dropped 2026-07-28:** Collaboration / Tasks & Events (planned as Phase 5, never started) —
`TASK-01..03`, `EVNT-01..04`. Still in backlog: **999.1**, extract a shared song-browse component.

## Previous Milestone: v1.6 Editing Reliability & Song Slides (SHIPPED 2026-08-12)

**Delivered (Phases 51–57, 19 plans):** drag-and-drop editing reliability in both the template and
live service plans; the service template relocated to the Services page; hand-split song slides
(+ Pre-Chorus, position numbering); a per-item notes field; per-item Miscellaneous labels and a
Scripture ESV/NLT override; preview/export polish (no auto-version, export spinner, Roboto font); and
the template editor brought to UX parity with the redesigned Service Order screen. Deployed to
production 2026-08-12; a same-day firestore.rules delete-fix + owner UI follow-up batch confirmed in prod.

**Goal (as set):** Fix the drag-and-drop corruption that plagues both the default template and real service
plans, move the service template to where it's actually used, and make song-slide editing intuitive
for non-technical users — plus item-editing and preview polish.

**Target features:**

- **Service Order editing reliability (bugs, first phase)** — dragging an item into a section spawns a
  phantom duplicate stuck at "No Section" that can't be deleted (in BOTH the default-template editor
  and the live service plan); moving an item back to "No Section" via the dropdown throws a save error;
  and items with an empty body sort to the bottom on the Services listing and share link instead of
  their real order (typing text "fixes" it). Same reordering machinery flagged fragile in v1.4.
- **Default service template** — relocate the template editor out of main Settings onto the Services
  page behind a cog/settings button; rename "Default to 1,2,3" to "Suggested Template", decouple it
  from Vertical Worship, and start EVERY new service from it (no blank template); Miscellaneous items
  in the template gain the input box for pre-filling recurring content.
- **Song lyric editing** — split any song item into multiple slides with manual line assignment (an
  8-line chorus → 2 slides), where Duplicate copies the whole multi-slide unit; add Pre-Chorus as an
  item type; number sections by position (3rd verse = "Verse 3", a split section keeps its number);
  rename a new song's "Replace Lyrics" button to "Save".
- **Service item enhancements** — a notes field beside each item's selector (who leads / who sings
  what), side-by-side on desktop and stacked on mobile, consistent across item types; Miscellaneous
  items default to no slides.
- **Preview & export polish** — the slideshow preview stops auto-appending the Bible version
  (ESV/NLT); a spinner on the Planning Center export; add **Roboto** to the curated self-hosted slide
  fonts (Inter already ships from v1.5).

**Decisions carried into scoping (2026-08-11):**

| Question | Direction |
|---|---|
| Drag-and-drop priority | Sequenced FIRST — the most disruptive defect; it blocks trust in every other editing surface. Owner instruction. |
| Blank template | Eliminated — the Suggested Template becomes the universal starting point for a new service, decoupled from Vertical Worship. |
| Split-slide duplication | A split section is one logical unit: Duplicate copies all its slides together, and its numbering stays position-based. |

## Earlier Milestone: v1.5 Settings, Sharing, and Fidelity (SHIPPED 2026-08-10)

> Archived. Full record: [milestones/v1.5-ROADMAP.md](milestones/v1.5-ROADMAP.md) ·
> [milestones/v1.5-REQUIREMENTS.md](milestones/v1.5-REQUIREMENTS.md). Delivered per-church settings &
> feature toggles, custom-auth-claim org membership, sharing correctness, PPTX rendered-image display,
> service item types (Announcements/Miscellaneous), the default service template, ESV/NLT Bible
> selection, global slide typography, congregational reading UX, multi-image/mobile polish, and slide
> bulk-delete/provenance/render-fidelity. See MILESTONES.md for the full accomplishment list.

## Requirements

### Validated

- ✓ Per-org Bible API toggle & manual fallback — a super-admin enables/disables the paid ESV/NLT Bible API per church from the Owner Console (`setOrgBibleEnabled`, default OFF, client-write-denied); a single `scriptureApi.ts` dispatcher + server `checkOrgBibleEnablement` gate on the `api` proxy's esv/nlt branches enforce it with no regression when enabled; when disabled, scripture/congregational editors offer an "Open in BibleGateway" deep-link (owner removed the paste box + off-state message before ship — plain scripture is reference-only, congregational composed in the existing reading textarea, AI split still runs on that text under the independent AI gate); Settings hides the Bible Translation card when off (R295–R301) — **v2.6** (shipped & deployed to production 2026-08-31; tag `v2.6`; audit PASSED 7/7 reqs + 5/5 integration seams; two code-review rounds caught a Planning-Center-export gate bypass + two fallback data-loss bugs; human/visual UAT deferred; each production org incl. Berean must be enabled by hand via the Owner Console since default is OFF; archived: `milestones/v2.6-REQUIREMENTS.md`).
- ✓ Invite email & non-Google onboarding — every TeamView invite now sends a real email: Gmail/Google invitees get a "sign in with Google" notice, non-Google invitees get a Cloud-Function-provisioned Auth account + `generatePasswordResetLink()` set-password link (an editor-only, invite-existence-gated `sendInviteOnboardingEmail` callable, reusing the Resend pattern); LoginView gains a discoverable set/reset-password path + a real `auth/operation-not-allowed` message; the Owner Console gets an `appConfig`-backed onboarding-email on/off toggle (R288–R294) — **v2.5** (shipped 2026-08-31; built autonomously via `/gsd-autonomous` + a local-UAT fix round; audit PASSED 7/7 reqs + 4/4 integration seams; code review caught & fixed an editor-can-email-arbitrary-addresses hole; `functions:sendInviteOnboardingEmail` deployed to prod; **hosting deploy + Resend DNS domain verification are standing owner follow-ups** — until the domain is verified the test sender only reaches the owner's own inbox; archived: `milestones/v2.5-REQUIREMENTS.md`).
- ✓ Scheduling accuracy & song/team refinements + multi-role scheduling — last-used lock-gated derivation + prod backfill (R247–R248), Vocals folded into Band with a Band↔Tech one-team-per-date rule + sing-and-play exception (R250–R252), Nth-Sunday recurring team auto-select via a Volunteer→Teams `>` slideout (R254–R255), editable song Key + sermon-free Scripture rotation + corrected schedulable-roles copy (R249, R253, R256), Roles/Teams read-only-row slideouts + song Key type-ahead (R257–R258), and a generalized per-role multi-role flag + same-date scheduler bundling anchored on a person's rarest role (R259–R260) — **v2.3** (shipped & deployed to production 2026-08-27; hosting + all Cloud Functions incl. the Phase-85 messaging fix; no rules changes; R248 backfill applied to Berean prod; audit PASSED 14/14; owner-approved UAT; archived: `milestones/v2.3-REQUIREMENTS.md`).
- ✓ Per-org configurable Teams + security/data-integrity hardening + polish/ops + per-org AI enablement (OFF by default) + Roles/Teams tab UX — own team list replacing hard-coded Berean rules & dropped ordinal-Sunday auto-select (R228–R231, R241); inviteLookup gate, createdBy immutability, deleteService share revocation, reprise-safe slide clear, pending-render guard (R232–R236); PC-export coverage, Resend domain runbook, Owner Console a11y, shared SongBrowser (R237–R240); super-admin AI master gate + fail-closed proxy (R242–R243); tab width/Delete button/copy (R244–R246) — **v2.2** (shipped 2026-08-25, hosting live; rules/functions owner-gated; audit PASSED 19/19). **R230 (per-team song-tag AI filter) delivered then removed 2026-08-25 by owner decision.**
- ✓ Super-admin Owner Console + multi-church onboarding + org lifecycle — super-admin claim gate & claim-merge, Firestore runtime config with dry-run blast-radius preview, tabbed Configuration/Organizations shell, org onboarding (org + settings + seeded template + first admin), multi-org Storage auth-claim widening, deactivate/reactivate, deactivation-gated cascade delete, pending-invite visibility, super-admin enter-any-church — **v1.9–v2.1** (R174–R211; all deployed to production 2026-08-23; v2.1 audit PASSED 16/16; archived).
- ✓ Fan-out, cron & instance guardrails — gated the unused daily `sendScheduledReminders` cross-org scan OFF by default (`SCHEDULED_MESSAGING_CRON_ENABLED`), Resend send-loop caps (per-message recipient reject + per-org daily quota, fail-open), project-wide `setGlobalOptions({maxInstances})` (api keeps its tighter cap), and Cloud Run render-service `--max-instances=3`/`--concurrency=1` (R170–R173) — v1.8 Phase 67 (code-complete + verified 2026-08-20; **UNDEPLOYED, all bounded/reversible → autonomous deploy**). Note: gating the cron also pauses composer "schedule-for-later" dispatch until the flag is enabled (disclosed, reversible).
- ✓ Storage retention — proved+hardened the media & orphan-render sweeps (delete-branch tests, per-run delete cap + bytes logging) and added two new sweeps: `cleanupOrphanBackgrounds` (orphan+age, 3-tier reference detection with `referencesComplete` + floor-guard fail-safes → dry-run) and `cleanupPptxSources` (prune consumed+aged source `.pptx`/`images/`, keep `rendered/`); all four DRY-RUN by default (R165–R168) — v1.8 Phase 66 (code-complete + verified 2026-08-20; **UNDEPLOYED, dry-run** — orchestrator deploys the four dry-run cron functions, owner sets each `*_CLEANUP_ENABLED=true` to activate real deletion).
- ✓ AI proxy cost controls — per-uid rate limit (429, fail-open), server-side model allow-list (400) + max_tokens clamp, `aiUsage` ledger via Admin SDK, `maxInstances` cap on the `api` proxy; all gated to the anthropic upstream only (R161–R164) — v1.8 Phase 65 (code-complete + verified 2026-08-20; **UNDEPLOYED** — orchestrator deploys `functions:api`, owner deploys the `firestore.rules` deny).
- ✓ Volunteer messaging — Settings kill-switch + org timezone, shared recipient resolver, ✉ composer, delivery history + HMAC bounce webhook, lock & scheduled-reminder auto-notifications, re-lock scoped diff, dedicated Messages tab, composer refinements + From/Reply-To rework + unique org names (R130–R160) — v1.7 (deployed 2026-08-17; archived: `milestones/v1.7-REQUIREMENTS.md`). Owner-accepted at close; human-UAT deferred in `PENDING-VERIFICATION.md`.
- ✓ Editing reliability, service-template relocation, song-slide splitting, per-item notes + Miscellaneous labels + Scripture version override, preview/export polish, template-editor UX parity (R110–R129) — v1.6 (archived: `milestones/v1.6-REQUIREMENTS.md`)
- ✓ Import song stable from CSV (Planning Center export) with arrangements, keys, BPM, tags, CCLI numbers — v1.0
- ✓ Manage song stable in-app (add, edit, categorize, tag team compatibility) — v1.0
- ✓ Categorize songs by Vertical Worship type: 1 (Call to Worship), 2 (Intimate), 3 (Ascription) — v1.0
- ✓ Create weekly service plans following the standard order (Song, Scripture, Song, Prayer, Scripture, Song, Song, Message, Sending Song) — v1.0
- ✓ Smart song suggestions based on category slot, recent usage tracking, and team configuration — v1.0
- ✓ Support song progressions: 1-2-2-3 or 1-2-3-3 for the four worship songs — v1.0
- ✓ Track song usage history to avoid repeating songs more than two weeks in a row — v1.0
- ✓ Select scripture passages with ESV preview, avoid pastor's teaching passage — v1.0
- ✓ Specify which teams are participating per service (Choir, Orchestra, Special Service, etc.) — v1.0
- ✓ Filter available songs based on which teams are scheduled — v1.0
- ✓ Tag songs with team compatibility (imported from CSV arrangement data + manual refinement) — v1.0
- ✓ User authentication via Google OAuth or email/password — v1.0
- ✓ Invite team members to collaborate on planning with editor/viewer roles — v1.0
- ✓ Print formatted order of service for rehearsal and Sunday — v1.0
- ✓ Share service plans via read-only shareable link (mobile-friendly) — v1.0
- ✓ Export service plan data for entry into Planning Center — v1.0
- ✓ Week-by-week service planning view — v1.0
- ✓ Seasonal/quarterly overview with song and scripture rotation tables — v1.0
- ✓ AI-powered song suggestions using sermon context (topic + passage) — v1.0
- ✓ Natural language scripture discovery with inline preview — v1.0
- ✓ RBAC: editor/viewer roles enforced across Firestore, router, and UI — v1.0
- ✓ In-app quarterly availability editor: per-person right-drawer for Sundays-only blackout calendar (Nth-Sunday chips + range block), frequency tier (regular/fill-in/out), must-serve-with bidirectional pairing, and quarter note — writing directly into PersonQuarterData; CSV import retained as secondary — v1.0 (Validated in Phase 14)
- ✓ Selective Planning Center roster import: scope by worship team + individually-scheduled positions with per-position Role mapping (choir/orchestra excluded), importing name, email, and roles — v1.0 (Validated in Phase 14)
- ✓ Per-(person, role) serve frequency (independent cadence per role a person holds) plus role-category co-occurrence rules — TECH exclusive; BAND/VOCALS/OTHER combine, capped at one BAND instrument per person per service — with the per-quarter tier (regular/fill-in/out) reconciled per-role consistently across scheduler, availability drawer, manual grid quick-assign, and admin roster status/filter — v1.0 (Validated in Phase 15)

- ✓ A service is editable only while in Draft; leaving Draft locks Service Order, Slides and Roles, with an explicit Reopen-for-editing path back — v1.4 (Phase 31)
- ✓ Autosave on the Service Order is reliable, and every save in the app is visible without scrolling — v1.4 (Phase 32)
- ✓ Post-Service section exists in both the service plan and the slides — v1.4 (Phase 29)
- ✓ Service items reorder correctly by drag-and-drop, with the five sections permanently ordered — v1.4 (Phase 29)
- ✓ Slide groups always mirror the service order — no review step, no manual re-sync — v1.4 (Phase 30)
- ✓ Slides can be reordered, added, and edited without accidental edit-mode or lost changes — v1.4 (Phases 30, 33)
- ✓ Background images can be set per group, per slide, and per song — v1.4 (Phase 33; rendering at presentation added as R070)
- ✓ Presented slides show copyright where required and never show organizational labels — v1.4 (Phase 35)
- ✓ Scripture slides can be generated as congregational readings with LLM-assisted splitting — v1.4 (Phase 34), and each section is now its own editable slide — v1.4 (Phase 38)
- ✓ Lyric paste warns when copyright information is missing, and happens inline — v1.4 (Phase 35)
- ✓ Every tabbed screen shows only the actions relevant to the open tab — v1.4 (Phase 36)

### Active

**v2.9 Live Presentation Field Fixes** — 🚧 in planning (started 2026-09-02). Field feedback from the first
real church-projector run (church Mac + projector). Three groups: **multi-monitor rework** (N monitors,
any-role-to-any-monitor incl. multiple Audience, assignments that stick on a 3-monitor setup, Mac
auto-placement treated as a bug, no false "monitors changed" prompt); **live-output readability** (auto-scale
slide text to the screen with the font *family* still config-pickable, smaller live main screen + larger
readable thumbnails, an "end" marker after the last thumbnail, flaky Mac scrollbar investigation); and
**lyric-editor UX** ("Edit song lyrics for {song}" opening a new tab, a SongSelect link in the editor title
bar, "Cancel"→"Close", manual Credits/CCLI/copyright editing, and hiding the confusing History tab). Audio
(vamps + canned music) deferred; browser-support warning dropped (Safari runs fine). Requirements continue
from R324; phases from 114. See `.planning/REQUIREMENTS.md`.

**v2.7 Rehearsal, Stage Plans & Presentation Polish** — 🚧 in planning (started 2026-08-31). Eight features:
inline black slide in the lyric editor; "Go to black" limited to the Audience output; system-wide dismissible
messages (stuck monitor-warning auto-clears once configured); per-item loop with interval; user-menu church
switcher for multi-org members; song rehearsal attachments (PDF/MP3/YouTube); a Rehearse mode on the public
shared service link; and a freeform visual per-service stage-layout canvas. Requirements defined via
`/gsd-new-milestone` (research-first). See `.planning/REQUIREMENTS.md`.

**v2.5 Invite Email & Non-Google Onboarding** — ✅ shipped 2026-08-31. Every invited user receives an invite
email (reusing the Resend pattern); non-Google invitees get a Cloud-Function-provisioned Auth account + a
"set your password" link so they can actually sign in, while Google/Gmail invitees get a "sign in with
Google" notification. Wires the real flow into TeamView `onInvite`, adds a discoverable password path +
`auth/operation-not-allowed` handling in LoginView, and an Owner Console (`ConfigurationTab`/`appConfig`)
toggle to switch onboarding emails on/off. Requirements created fresh in `.planning/REQUIREMENTS.md`.
Flagged for phase discussion: Google-vs-non-Google detection heuristic; global vs per-org toggle. Owner
prereqs: Email/Password provider enabled + Resend DNS domain verification. Root cause & decisions:
`.planning/debug/resolved/non-gmail-password-setup.md`.

**v2.4 Run the Service (Live Presentation)** — ✅ shipped & deployed to production 2026-08-30; closed on
owner approval. A non-technical projectionist runs a locked service's slides live from Chrome/Edge with
per-display "Go fullscreen" outputs (Phase 98's zero-click registry helper was built then removed as
unachievable on real hardware).

**Standing owner-run hand-overs (carry until run):**

- [x] **v2.2 backend deploys — DONE (owner, 2026-08-25):** `firebase deploy --only firestore:rules` (Phase 80
      — `inviteLookup` create gate + `createdBy` immutability) and `firebase deploy --only
      firestore:rules,functions:setOrgAiEnabled,functions:api` (Phase 82 — per-org AI) are deployed to
      production. Per-org AI defaults OFF; re-enabling it for any church (incl. Berean) is at owner discretion
      via the Owner Console.
- [ ] **Deferred human UAT** for shipped-but-owner-attributed milestones — `/gsd-verify-work` for phases
      68–83 (v1.9–v2.2), preserved in `PENDING-VERIFICATION.md`.
- [ ] Activate storage deletion after reviewing dry-run logs, and deploy the Phase 65 `firestore.rules`
      deny — v1.8 standing follow-ups (may be superseded once v1.9's live cleanup toggles ship).

**Backlog (promote with `/gsd-review-backlog` when ready):**

- [ ] Confirm the production draft lock by hand and re-run the devtools bypass check (backlog 999.3)
- [ ] `deleteService` orphans the service's `messages`/`lockSnapshots` subcollections — client `deleteDoc`
      does not cascade; needs a cascade delete (likely a Cloud Function, since client bulk subcollection
      deletes are unbounded). Phase 80 code-review WR-02, deferred (backlog 999.12)
- [ ] Harden the messaging From address to a Resend-verified sending domain so real volunteers receive mail
      — the R238 owner runbook shipped in v2.2 (`functions/DEPLOY-EMAIL-DOMAIN.md`); DNS is owner-run and not
      yet done, and the owner is not yet committed to a domain (backlog 999.6)
- [ ] SEED-002 remainder (not taken in v2.2): fetch Planning Center team names/times live instead of the
      hard-coded lists (A3/A4), and the Vertical-Worship-model configurability items (C1). Catalog in
      `seeds/SEED-002-church-specific-rules-configurability.md` (status: harvested)
- [ ] SEED-001: owner-only admin UI for the v1.8 cost/cleanup env knobs, so guardrails are adjustable
      without a redeploy (status: deferred) — `seeds/SEED-001-admin-settings-interface.md`
- [ ] **999.13 — Song rehearsal attachments + Rehearse mode** (deferred from v2.7, 2026-08-31). Attach
      PDF chord charts/sheet music, MP3 practice tracks, and YouTube links to a Song (reusable across
      services); a Rehearse view to play/open them per song. Full architecture + cost research in
      `seeds/SEED-003-rehearsal-attachments-and-storage-costs.md`. **Cost verdict: absorb in the base
      $25–30 subscription** — all-in ≈ $0.50–$2.50/church/mo at 100 churches × 100 songs (storage is
      pennies; egress is the variable; Auth is free ≤ 50k MAU; Firestore reads ~$0.10–0.50/church/mo).
      **Guardrails required:** per-org storage quota (~10 GB), per-file size caps (PDF ≤10 MB, MP3 ≤20 MB),
      egress alerting. **Reconsider "public link only" → require volunteer login** (nearly free, kills the
      scraping/hotlinking egress risk, and enables volunteer self-service "find my service"). Highest-risk
      area: unauthenticated Storage reads + the `firestore.exists()`-in-Storage-emulator blind spot — use
      download-token URLs denormalized into the share snapshot or a signed-URL Cloud Function, never a
      cross-service `storage.rules` check. Add-on tier only for storage/bandwidth outliers, never seat count.

> **Closed in v2.2 (2026-08-25):** 999.1 shared song-browse (R240), 999.2 song-clear slides (R235), 999.4
> PC-export slot coverage (R237), 999.7 Owner Console a11y (R239), 999.8 configurable teams (R228–R231),
> 999.9 pending-render guard (R236), 999.10 deleteService share revocation (R234), 999.11 the two
> firestore.rules findings (R232+R233). 999.5 multi-org Storage claim closed in v2.0.

### Out of Scope

- Migrating existing HYMN service slots to SONG — v1.5 removes Hymn from the palette only. HYMN carries free-text `hymnName`/`hymnNumber`/`verses`; SONG requires a catalog `songId`, so conversion is lossy and any hymn absent from the catalog would become an empty slot
- Runtime Google Fonts API for slide fonts — considered and rejected in v1.5 scoping: a projector without internet at service time could not fetch the font. Curated self-hosted woff2 instead
- Per-slide font overrides — font family/weight/size is set once for all slides, by owner instruction
- Planning Center API integration — complement only, no sync (complexity too high; CSV import + manual transfer sufficient)
- ProPresenter integration — plans are created here, ProPresenter is managed separately
- Real-time collaborative editing — planners take turns, not simultaneous editing
- Mobile native app — web-first, responsive design serves mobile needs; PWA possible for v2
- CCLI reporting automation — track numbers but don't file reports
- Click track/multitracks management — handled outside this app
- Musician scheduling — NOW IN SCOPE as of Phase 13 (Volunteer Role Scheduling); volunteers are staffed in-app from a roster + quarterly CSV. See ROADMAP §Phase 13.
- Offline mode — real-time Firestore is core architecture
- Tasks & Events (TASK-01..03, EVNT-01..04) — dropped 2026-07-28; planned as Phase 5, never started, owner: "we don't need those"
- Editing imported PowerPoint slide *content* in-app — v1.4 renders PPTX server-side to images for fidelity; correcting a deck means re-importing it
- Slide editing inside the Slides tab for song groups — songs are edited only from the Song Lyrics screen, so a service can't diverge from the canonical song

## Context

Shipped v1.0 with 12,747 LOC (TypeScript + Vue).
Tech stack: Vue 3, Firebase (Firestore + Auth), Tailwind CSS v4, Vite, Pinia, Anthropic Claude API.
14 quick-task UX improvements shipped after core phases (autosave, hymn slots, infinite scroll, settings, rotation visibility).
Dark mode is the canonical app theme (gray-950 body, gray-900 cards/sidebar).

**Vertical Worship Methodology:**
The worship service follows a deliberate emotional and spiritual arc:
- **1 Songs** — Call to worship. General, energetic, inviting. "Us and God" moment.
- **2 Songs** — Intimate. Speaking directly to God. "Me and God" moment.
- **3 Songs** — Ascription. Mighty declarations about God.

Four worship songs at the start follow either 1-2-2-3 or 1-2-3-3 progression, plus a sending song after the message.

**Standard Service Order:**
1. Worship Song (1)
2. Scripture Reading
3. Worship Song (2)
4. Prayer Moment
5. Scripture Reading
6. Worship Song (2 or 3)
7. Worship Song (3)
8. Message
9. Sending Song

**Scripture Selection Rules:**
- 6-10 verses (not too long, not too short)
- Don't duplicate the pastor's teaching passage
- Lean into the Psalms when in doubt

**Song Rotation:** Avoid using the same song more than ~2 weeks in a row. Rotate through the entire stable.

**Team Configurations:** Services may include Choir, Orchestra, or be Special Services. This constrains which songs are available since not all songs have parts for every team.

**Existing Workflow:**
- Plan 2 weeks prior to service
- Email participants 11-12 days before
- Print orders of service for rehearsal (Wednesday) and Sunday
- Weekly pastor meeting
- Rehearsal Wednesday evening + Sunday morning
- Master Worship Schedule prepared 3x/year

**Task Categories:**
Administrative, Communication, Rehearsal, Service time, Training, Physical setup, Technical (Soundboard, Equipment, Programming)

## Constraints

- **Frontend**: Vue 3 — team preference, non-negotiable
- **Backend**: Firebase (Firestore + Authentication) — chosen for Google auth integration and speed of development
- **Auth**: Google OAuth + email/password — must support both methods
- **Relationship to Planning Center**: Complement only — no API integration, data flows via CSV import and manual transfer
- **Team size**: 2-3 active planners, potential expansion to musicians/techs viewing plans

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Vue 3 frontend | Team preference and familiarity | ✓ Good — 12.7k LOC, fast development |
| Firebase backend | Google auth native support, fast development, real-time capable | ✓ Good — Firestore onSnapshot powers real-time UI |
| Complement Planning Center (not replace) | PC is entrenched, too complex to replicate — focus on the planning brain | ✓ Good — CSV import + text export covers the bridge |
| CSV import for songs (not API) | Simpler, Planning Center export already available | ✓ Good — PapaParse handles PC CSV format well |
| Vertical Worship methodology as core model | This is how the team plans — the app should encode this knowledge | ✓ Good — VW type system is the app's differentiator |
| Smart suggest + manual override | Best of both — speed of suggestions, freedom to customize | ✓ Good — rotation-based + AI suggestions combined |
| Dark mode as canonical theme | Team preference for dark UI | ✓ Good — gray-950/900/800 palette consistent throughout |
| Denormalize song snapshots into service slots | Avoid N+1 reads at render time | ✓ Good — fast service loading |
| signInWithPopup over signInWithRedirect | Redirect broken in modern browsers (Chrome M115+, Firefox 109+, Safari 16.1+) | ✓ Good — reliable cross-browser |
| onSnapshot in Pinia stores (not VueFire) | VueFire composables don't work inside Pinia stores | ✓ Good — real-time sync with clean store API |
| Anthropic Claude for AI features | Cost-efficient haiku model, graceful degradation if unavailable | ✓ Good — AI is additive, never blocking |
| Editor/viewer RBAC with invite-based onboarding | Simple role model matching team structure | ✓ Good — viewers get read-only services, editors get full access |
| Teleport to body for dropdowns/slide-overs | Escape AppShell overflow-y-auto stacking context | ✓ Good — consistent z-index behavior |
| Autosave with debounce + one-step undo | Better UX than explicit save buttons | ⚠️ Revisit — v1.4: song changes never fired autosave and saves were invisible above the fold |
| Service order is the single source of truth for slide order | Two orderings that can disagree is the root of the mirroring bugs; a review step just asks the user to referee a conflict the app created | — Pending (v1.4) |
| Song groups read-only in the Slides tab | Songs are canonical (D002); editing them per-service reintroduces the wrong-slides-at-rehearsal problem | — Pending (v1.4) |
| PPTX rendered server-side to images | Only way to get true fidelity — backgrounds, fonts, charts, effects. Trades in-app editing of imported decks, which was never a real workflow | — Pending (v1.4) |
| Draft-only editing with explicit reopen | A planned/exported service has been communicated to people; silent edits desync rehearsal and Planning Center | — Pending (v1.4) |
| Persistent inline save status over per-save toasts | A 500ms debounce makes success toasts constant noise; failures are the signal worth interrupting for | — Pending (v1.4) |
| Share token persisted on the service, snapshot auto-refreshed | One root cause behind both "the link changed" and "my role overrides aren't showing" — the token was re-minted per share and the snapshot frozen at share time | — Pending (v1.5) |
| Org membership on a custom auth claim | `firestore.exists()` is permanently inert in the Storage emulator (firebase-js-sdk#6803), so a cross-service rule can never be verified locally — the blind spot that shipped a deny-everyone rule | — Pending (v1.5) |
| Curated self-hosted fonts over the Google Fonts API | A projector without internet at service time cannot fetch a remote font; slides must render identically offline | — Pending (v1.5) |
| Org service template replaces `buildSlots()` | Churches outside this one do not run a 1-2-2-3 Vertical Worship order; the template is the structure, VW remains the song-typing layer on top | — Pending (v1.5) |
| AI gated at the `claudeApi.ts` choke point | All three AI surfaces (song suggestions, scripture discovery, congregational split) already route through one module — the toggle has exactly one place to live, and it doubles as the future paywall seam | — Pending (v1.5) |
| Blank service template eliminated | Every new service now starts from the org's Suggested Template; a blank starting point was a dead default nobody wanted | — Pending (v1.6) |
| A split song section is one logical unit | The slides that make up a split section duplicate together and keep one position-based number, so a non-technical user never sees the split leak into numbering or duplication | — Pending (v1.6) |
| Messaging recipients derive from assigned service roles | Volunteers are already staffed onto a service via the Roles tab with roster emails; teams (Band/Vocals/Tech/Other) are role groupings, so the composer reuses that data rather than a second contact list — unassigned roles simply have no email | ✓ Good — one shared resolver (client + Functions port) shipped v1.7 |
| v1.7 tracks sent + hard bounces, not opens | Bounce surfacing (via a provider webhook) is what actually prevents silently-lost mail; open-tracking adds pixels/webhook complexity and privacy questions for little planning value — deferred | ✓ Good — HMAC-verified bounce webhook live in production v1.7 |
| Email provider chosen by research, owner-approved | Provider selection is a cost + deliverability + Firebase-fit decision with a real recurring bill and a secret the owner must add to `.env.local`; the research pass surfaces options and the owner picks | ✓ Good — Resend chosen; deployed v1.7 (email still test-mode until domain verified, backlog 999.6) |
| Send path is a backend Cloud Function, deploy owner-gated | Provider API keys cannot ship to the client; mail sends through Firebase Functions holding the secret, and per the standing grant every such deploy is handed to the owner, not run autonomously | ✓ Good — key confined to `sendQueuedMessage`; owner deployed 2026-08-17 |
| Per-org Teams modeled on roster Roles (own subcollection + store) | Churches differ in their team lists; mirroring the proven roles half kept the store/UX/seed patterns identical and low-risk | ✓ Good — v2.2; replaced the hard-coded Berean team list |
| Removed the per-team song-tag AI filter (R230) after shipping it | It only fed AI song suggestions, was inert when AI was off, and presented a live-looking control that did nothing — confusing for no real benefit | ✓ Good — v2.2 (2026-08-25); team selection no longer narrows the AI pool |
| Per-org AI is OFF by default behind a super-admin master gate | AI is a metered cost the platform owner controls per church; `aiMasterEnabled` two-gates every affordance (`isAiEnabled = master && church setting`) and the proxy fails closed | ✓ Good — v2.2 (R242–R243); mirrors the `active`/`setOrgActive` pattern |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-09-02 — started milestone v2.9 Live Presentation Field Fixes. Field feedback from the
first real church-projector run (church Mac + projector, the external-link hardware). Three groups:
multi-monitor rework (support any number of monitors verified on a real 3-monitor setup, assign any role to
any monitor incl. multiple Audience, make role assignments STICK — the core bug where 3 monitors collapse
the single-select model, fix Mac auto-placement as a bug not a manual-drag workaround, and kill the false
"monitors changed" re-detect prompt); live-output readability (auto-scale slide text to fill the screen with
the font family still config-pickable, shrink the live main screen + enlarge readable preview thumbnails,
add an "end" marker after the last thumbnail, investigate the flaky Mac thumbnail scrollbar); and
lyric-editor UX ("Edit song lyrics for {song}" opening a new tab, a SongSelect link in the editor title bar,
"Cancel"→"Close", manual Credits/CCLI/copyright editing, hide the confusing History tab). Out of scope: all
audio — vamps (mp3 upload + slide assignment) and canned pre/post-service music — deferred to the backlog
999.13 storage cluster (SEED-003); the unsupported-browser warning dropped (Safari retested fine). No
research pass. Requirements continue from R324; phases from 114. Previous footer below.*

---
*Last updated: 2026-09-02 — archived milestone v2.8 Production Hardening: Comments-as-Specs, Architecture
& Security Review (Phases 108–113, R316–R323), shipped & deployed to production 2026-09-02. Comments-as-specs:
696 load-bearing comments inventoried → 244 MADR-lite ADRs under `docs/adr/` (decision-rationale) + 309
behavioral comments relocated into `.planning/codebase/` map docs, source comments shrunk to pointers, plus
a written comment convention. Architectural review → the one High (ARCH-001, a `loadOrgContext` re-entrancy/
listener-leak race) fixed; 22 Medium/Low → backlog 999.4. Security review found a **proven, live, production
cross-tenant data leak** — SEC-S-01: `shareTokens`/`quarterShares`/`serviceShares` were publicly *listable*
(unauthenticated enumeration of every church's shared plans + volunteer names) — fixed (get/list split +
org-gated list + org-scoped client queries), together with SEC-ISO-01 (legacy client org self-provisioning
removed) and SEC-ISO-02 (`revokeRefreshTokens` on member removal); 11 Medium/Low → backlog 999.5. Coordinated
owner-authorized prod deploy (hosting + firestore:rules + functions:syncOrgMembershipClaim). Audit PASSED
(8/8 reqs, 6/6 phases, 6/6 integration WIRED); the adversarial code-review chain caught 3 blockers pre-ship.
Run via `/gsd-autonomous`. Also captured backlog 999.3 (multi-monitor signal routing) mid-run. Archived:
`milestones/v2.8-ROADMAP.md` · `milestones/v2.8-REQUIREMENTS.md` · `milestones/v2.8-MILESTONE-AUDIT.md` ·
`milestones/v2.8-phases/`. Previous footer below.*

---
*Last updated: 2026-08-31 — started milestone v2.7 Rehearsal, Stage Plans & Presentation Polish (8 features:
inline black lyric slide, Audience-only "Go to black", system-wide dismissible messages, per-item loop,
user-menu church switcher, song rehearsal attachments PDF/MP3/YouTube, Rehearse mode on the shared link, and
a freeform per-service stage-layout canvas). Decisions: church switch in the user menu (on existing multi-org
claim infra); attachments on the Song in Firebase Storage + YouTube links; volunteer rehearse via the public
shared link only (no login this milestone); stage layout a freeform visual canvas. Research-first. Previous
footer below.*

*Last updated: 2026-08-31 — archived milestone v2.6 Per-Org Bible API Toggle & Manual Fallback (shipped &
deployed to production; tag `v2.6`; audit PASSED 7/7 reqs + 5/5 integration seams). Archived to
`milestones/v2.6-ROADMAP.md` · `milestones/v2.6-REQUIREMENTS.md`. No active milestone — next scoped via
`/gsd-new-milestone`. Previous footer below.*

*Last updated: 2026-08-31 — started milestone v2.6 Per-Org Bible API Toggle & Manual Fallback (promoted
from backlog 999.3; requirements R295–R301). A super-admin per-org Bible-API toggle in the Owner Console
(default OFF, mirroring the v2.2 per-org AI pattern), a new `scriptureApi.ts` choke point carrying the gate
(client + server esv/nlt branches), and a manual BibleGateway deep-link + paste-in fallback when OFF (any
version, LLM split still runs on pasted text, Settings hides the Bible Translation selector). Skipped
research (known architecture). Previous footer below.*

*Last updated: 2026-08-31 after v2.5 milestone — SHIPPED Invite Email & Non-Google Onboarding (Phases
99–100, R288–R294). Every TeamView invite sends a real email: Gmail/Google invitees get a "sign in with
Google" notice; non-Google invitees get a Cloud-Function-provisioned Auth account + a
`generatePasswordResetLink()` set-password link (editor-only, invite-existence-gated `sendInviteOnboardingEmail`,
reusing Resend). LoginView gained a discoverable set/reset-password path + a real `auth/operation-not-allowed`
message; the Owner Console gained an `appConfig`-backed onboarding-email on/off toggle. Built autonomously
via `/gsd-autonomous`, then a local-UAT fix round (appConfig dotted-key persistence bug, context-aware
reset errors, Resend returned-error check, persistent/red invite feedback + a Resend action). Audit PASSED
7/7 + 4/4 integration seams; code review caught & fixed an editor-can-email-arbitrary-addresses hole.
`functions:sendInviteOnboardingEmail` deployed to prod; **standing owner follow-ups: hosting deploy +
Resend DNS domain verification** (until verified, the test sender only reaches the owner's own inbox).
Archived: `milestones/v2.5-ROADMAP.md` · `milestones/v2.5-REQUIREMENTS.md` · `milestones/v2.5-MILESTONE-AUDIT.md`.*
