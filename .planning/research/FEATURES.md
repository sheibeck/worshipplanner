# Feature Research

**Domain:** Volunteer/team messaging & service-change notifications for a worship-service planning app (v1.7 Volunteer Messaging & Notifications)
**Researched:** 2026-08-13
**Confidence:** MEDIUM (peer-tool behavior is corroborated by official docs where cited; transactional-email UX conventions are broad industry consensus, not project-specific verification)

## Method Note

This research targeted the peer-tool landscape (Planning Center Services, WorshipTools, Elvanto, Rock
RMS) plus general transactional-email UX conventions, and validated the already-imported Claude Design
composer/lock-diff/automatic-mail/history model (canvas "Turn 5 — Messaging volunteers") against them.
Findings below are cited per claim. Planning Center's own help-center pages (`help.planningcenter.com`,
`pcoservices.zendesk.com`) are first-party documentation of the dominant tool in this space — treat
those specific citations as reliable despite the generic `websearch`-provider confidence tag the tooling
applies; broader "best practice" web results are genuinely lower-confidence industry consensus and are
flagged as such.

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist in any church volunteer-communication tool. Missing these makes v1.7 feel
incomplete relative to Planning Center, the tool this app explicitly complements.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Recipients derived from who's actually scheduled | Every peer tool (PCO, Elvanto, Rock RMS) sends to the roster attached to the specific service/plan, not a separate mailing list — this app's design already does this via the Roles tab | LOW | Already decided (Key Decision, PROJECT.md) — reuse roster emails, no second contact list |
| Team-level recipient grouping | PCO lets you "email an entire team" or "scheduled people"; Elvanto/Rock RMS group by roster/team | LOW | Matches imported design: teams-first (Worship/Tech/Vocals/Hosts), individuals added below |
| "Everyone on this service" recipient option | PCO's "Scheduled People" = every team member scheduled for the plan, functionally the "everyone" option | LOW | Matches imported design |
| Subject + body composer with plan context auto-included | PCO auto-includes assigned times and the recipient's team-scoped plan notes in scheduling emails | MEDIUM | Design's tokens (service date, link, their roles, song list) cover this; PCO does it as fixed fields, not literal tokens — see Differentiators |
| A link back to the full service order/plan | Every peer tool's notification includes a link to view the plan; this app already has a shareable read-only link to reuse | LOW | Direct dependency: reuses existing share-link feature |
| Automatic notification when a plan/schedule becomes final | PCO's model is explicit: a "prepared" (unsent) notification means the volunteer can't even see the plan until it's sent; Elvanto sends automatically the moment a service is **published** | MEDIUM | Maps directly onto this app's Draft→Planned lock transition — lock = PCO's "send"/Elvanto's "publish" moment |
| Scheduled/automatic reminder before the service date | PCO ships this as a first-class, configurable (0–7 days out) feature; industry-universal expectation for scheduling tools | MEDIUM | Matches imported design's N-days-out (default 7) share-link reminder |
| Ad-hoc/one-off message to a team or individuals | PCO, Elvanto, and Rock RMS all support "contact volunteers on this service" outside the automatic flows | LOW-MEDIUM | Matches imported design's One-off message type |
| Recipient count / "who is this going to" visibility before send | PCO's compose screen shows the resolved recipient list and a send-count on the button before sending | LOW | Matches imported design's live "Reaches N people" |
| Skip/exclude people with no email on file | Unassigned or email-less roster entries are a universal edge case every one of these tools has to handle silently (they just don't get a message) | LOW | Already anticipated in Key Decisions: "unassigned roles simply have no email" |
| A record that a message was sent (basic delivery log) | Rock RMS explicitly tracks "confirmation status"; PCO's UI shows sent/pending badges per person | MEDIUM | Matches imported design's "Sent on this service" history |
| Church-level ability to turn automatic email off | PCO allows disabling reminders org-wide/per-browser for all teams in a plan; this is the expected admin escape hatch for any auto-notify feature | LOW-MEDIUM | Matches imported design's Settings kill-switch |

### Differentiators (Competitive Advantage)

Features that go beyond what peers typically offer, or where this app's narrower scope lets it do a
specific thing better than a general-purpose tool. Should reinforce Core Value (planning brain) rather
than compete with PCO on breadth.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Explicit, checkable scoped change-diff on re-lock (SONG/ORDER/ROLE/NOTES/SLIDES, tagged by affected team) | None of the four peers surveyed expose a structured, typed diff of *what changed* since the last notification — PCO/Elvanto re-notify wholesale or leave it to the human to remember. This is a genuine gap-filler specific to a tool with a lock/reopen lifecycle | HIGH | This is the standout design element worth keeping — it directly exploits a feature (Draft→Planned lock, Reopen) that PCO doesn't have in the same shape. Complexity is real: diffing typed service-item changes and mapping each to affected teams is nontrivial logic, not just an email feature |
| Literal insertable merge tokens in a free-text composer (service date, link, their roles, song list) | PCO's "personalization" is really just fixed auto-included blocks (times, notes) in scheduling-email templates — it does not expose a token-in-freetext composer for ad-hoc messages. Giving planners `{{songList}}`-style tokens in a One-off message is more flexible than anything peer tools expose in ad-hoc mode | MEDIUM | "Their roles" implies true per-recipient personalization (each volunteer sees only their own role), which is harder than a single merged send — needs per-recipient render or at minimum per-team variants, not one blast |
| Message type selector (One-off / Reminder / Share link) as a first-class composer control | PCO separates these as different *screens* (scheduling email vs. reminder settings vs. plain team email) rather than one composer with a type switch; a single composer with a type dropdown is a genuine simplification of PCO's fragmented model | LOW-MEDIUM | Good scope-reduction differentiator: fewer distinct surfaces for the planner to learn |
| Hard-bounce surfacing per service with a path to fix a bad address | PCO's public docs do not describe bounce surfacing to the planner at all (it's invisible/handled by PCO internally); this app doing sent+bounce visibility is ahead of the documented PCO UX | MEDIUM-HIGH | Requires provider webhook + Cloud Function + Firestore write-back; real infra cost, but genuinely differentiated since the target audience (small church, 2-3 planners) currently has *zero* visibility into "did that email actually land" |
| Draft-service-aware reminder suppression (reminder skipped while still Draft) | Peer tools don't have an equivalent Draft concept, so they can't skip-if-still-planning the way this app can; this closes a real risk (auto-sending a reminder about an unfinished plan) that's specific to this app's lifecycle | LOW | Direct dependency on the existing Draft→Planned lock feature; low effort, meaningfully higher trust than peers can offer |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems for a 2-3-planner small-church tool, or that duplicate what
Planning Center already owns (this app "complements, not replaces" PCO — Constraint in PROJECT.md).

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|------------------|-------------|
| Accept/Decline RSVP buttons in emails, with response tracking | PCO's signature feature; feels like an obvious "complete the loop" addition | This is PCO's core scheduling-availability workflow (blockouts, confirm/decline, auto-substitution) — replicating it duplicates PCO's actual job and turns a messaging feature into a second scheduling system. PROJECT.md's constraint is explicit: PC integration is out of scope, complement not replace | Volunteer confirmation of availability stays in Planning Center (or the roster's existing blockout/frequency-tier data already imported from PC); this app's email is one-way, informational |
| Open-tracking (read receipts/pixel tracking) | "Wouldn't it be nice to know who read it" | PROJECT.md explicitly defers this (Key Decision) for privacy/complexity reasons; tracking pixels also raise church-context privacy concerns and most providers gate open-tracking behind extra webhook plumbing for marginal planning value | Hard-bounce tracking only (sent + bounced) — tells the planner what actually failed to deliver, which is the decision that matters (resend / fix address), without the privacy cost of tracking whether a volunteer opened it |
| SMS/text notifications alongside email | PCO, Elvanto, and Rock RMS all offer SMS as a channel and it "feels incomplete" without it | Adds a second delivery provider, a second compliance regime (10DLC registration, opt-in law), and a second cost line for a 2-3-planner team already served by email; the app's roster data model captures email, not verified mobile numbers | Email-only for v1.7; if volunteers want SMS, PCO/Elvanto already provide it and this app doesn't need to re-solve it |
| Marketing-style campaign builder / drip sequences (Rock RMS's "Communications" module) | Rock RMS bundles full drip campaigns and two-way SMS conversations; looks powerful | Wildly over-scoped for a per-service messaging feature on a niche planning tool — it's built for large multi-site orgs with comms staff, not a volunteer worship team | Keep the composer scoped to one service's recipients and one send (or one scheduled send); no campaigns, no audience segmentation beyond team/individual |
| A general-purpose contact list / CRM independent of service rosters | Feels natural to want to "just email everyone in the church" | This app has no independent People/Contacts model beyond the roster tied to Volunteer Role Scheduling — building a parallel contact list duplicates Planning Center People, which this app is explicitly not replacing | Recipients are always derived from who's scheduled on a specific service (already decided) |
| Rich HTML template builder / drag-and-drop email designer | PCO supports templates with images/attachments up to 10MB; "professional-looking" emails feel desirable | High build cost (WYSIWYG editor, image hosting, spam-score risk from heavy HTML) for a transactional/informational message type where clarity beats design polish; also raises deliverability risk (image-heavy HTML trips spam filters more than plain-formatted text) | Plain, well-formatted text/simple-HTML composer with tokens; save richer template design for a future milestone if ever requested |
| Two-way reply-and-thread conversations in-app (Rock RMS's two-way SMS) | Feels like "real messaging" | Requires inbound-mail handling, threading UI, and moderation — a large scope increase disconnected from the stated goal (notify volunteers of schedule/changes) | One-way send only; replies go to the planner's real email address (reply-to), handled outside the app like any other email |

## Feature Dependencies

```
Draft -> Planned lock/reopen lifecycle (existing, v1.4)
    └──requires (for lock notification)──> Volunteer Role Scheduling / roster emails (existing)
                                               └──requires──> Roles tab team groupings (existing)

Messages composer (recipients, subject/body, tokens)
    └──requires──> Volunteer Role Scheduling roster + roles (existing — recipient source of truth)
    └──requires──> Shareable read-only service link (existing — populates the "link" token / share-link message type)
    └──requires──> Email provider + backend send path (new, v1.7) 
                       └──requires──> Settings kill-switch (new, v1.7 — must exist before any auto-send path is live)

Lock notification (auto-email on lock)
    └──requires──> Draft->Planned lock event (existing)
    └──requires──> Messages composer's send primitive (new, v1.7)
    └──requires──> Settings per-service automatic-email default (new, v1.7)

Re-lock change notice (scoped diff)
    └──requires──> Reopen-for-editing path (existing, v1.4)
    └──requires──> Lock notification's send primitive (new, v1.7)
    └──requires──> A diff engine over service-item types (SONG/ORDER/ROLE/NOTES/SLIDES) tagged to teams (new, v1.7 — highest-complexity net-new logic)

Scheduled share-link reminder (N days out)
    └──requires──> Shareable read-only service link (existing)
    └──requires──> Draft-state check (existing — used to SKIP the reminder while still Draft)
    └──requires──> A scheduled/cron-triggered Cloud Function (new, v1.7)

Delivery history & bounce surfacing
    └──requires──> Every send path above (Messages composer, lock notification, re-lock notice, reminder) writing a log entry
    └──requires──> Email provider webhook -> Cloud Function -> Firestore write-back (new, v1.7)
    └──enhances──> planner trust in all four send paths above (without it, sends are a black box)

Settings kill-switch (global on/off)
    └──conflicts with──> any auto-send path if built before the switch exists (must ship first / same phase)
```

### Dependency Notes

- **Messages composer requires Volunteer Role Scheduling roster + Roles tab:** recipients, per-person
  email, and team groupings are 100% sourced from data this app already has (Key Decision, PROJECT.md:
  "Messaging recipients derive from assigned service roles"). No new contact model needed — this is a
  load-bearing simplification versus every peer tool, which also derive from their own roster/serving
  models.
- **Lock notification requires the existing Draft→Planned lock event:** this is the same "moment" PCO
  calls sending a prepared notification and Elvanto calls publishing — the trigger point already exists
  in this app's data model (v1.4, Phase 31); v1.7 just needs to hang a side effect off it.
- **Re-lock change notice requires Reopen-for-editing (v1.4) AND a new typed diff engine:** this is the
  single highest-complexity net-new piece in the milestone. Nothing in the peer landscape (PCO, Elvanto,
  Rock RMS, WorshipTools) does a structured before/after diff — they just re-send the whole notification
  or leave re-notification to the human. Scope this as its own phase; it should not share a phase with
  the simpler lock-notification or composer work.
- **Scheduled reminder requires Draft-state check to skip while still Draft:** this is a real
  differentiator (see above) but also a dependency risk — the reminder Cloud Function needs read access
  to current service lock-state at cron-fire time, not just at schedule-creation time, since a service
  could still be Draft 7 days out and get Planned only 2 days out.
- **Settings kill-switch conflicts with (must precede) all auto-send paths:** shipping lock-notification
  or the scheduled reminder before the kill-switch exists means there is no way to turn off unwanted
  auto-mail once it's live — sequence the kill-switch and its Settings-inherited per-service defaults
  into the same phase as (or strictly before) the first auto-send feature.
- **Delivery history enhances, not blocks, the send paths:** each send path can technically go live
  without the log, but shipping any auto-send (lock, re-lock, scheduled reminder) without delivery
  visibility recreates the "silent failure" problem this milestone explicitly exists to solve (sent +
  bounce tracking is called out as the reason to build this over doing nothing).

## MVP Definition

### Launch With (v1.7)

Minimum viable slice — the milestone as scoped in PROJECT.md's Active requirements.

- [ ] Settings kill-switch (global on/off + per-service automatic-email defaults) — must exist before
      any auto-send ships; the escape hatch every peer tool provides
- [ ] Messages composer: teams-first recipients + individuals + Everyone, subject/body, One-off /
      Reminder / Share-link types, tokens (date/link/roles/song list), "Reaches N people" count
- [ ] Lock notification (auto-email on lock, roles+songs+link) — direct mapping of PCO/Elvanto's
      publish-triggers-notify pattern onto this app's existing lock event
- [ ] Scheduled share-link reminder, N days out (default 7), skipped while Draft — table stakes,
      matches PCO's configurable reminder feature almost exactly
- [ ] Delivery history: per-service sent log + hard-bounce surfacing — the thing that makes auto-send
      trustworthy; without it this app is worse than doing nothing (silent failures)
- [ ] Email provider + backend send path (owner-approved provider, secret in `.env.local`, owner-gated
      deploy) — infrastructure prerequisite for everything else

### Add After Validation (v1.7, later phase within milestone)

Higher-complexity pieces that depend on the above being solid first.

- [ ] Re-lock change notice with scoped, checkable, team-tagged diff (SONG/ORDER/ROLE/NOTES/SLIDES) —
      the standout differentiator, but the highest-complexity item; should follow lock-notification and
      the composer so the diff engine has a stable send primitive to call
- [ ] "Send me a copy" and "schedule for later" composer options — nice-to-have composer affordances
      called out in the imported design; low risk to defer one phase if the composer core needs to ship
      first
- [ ] Per-recipient personalized token rendering ("their roles" = only the viewer's own role, not
      everyone's) — if the simplest implementation ships as one merged blast first, tighten to true
      per-recipient rendering once the send pipeline is proven

### Future Consideration (v1.8+)

Explicitly deferred, matches PROJECT.md's stated scope boundaries.

- [ ] Open-tracking (read receipts) — deferred by Key Decision; revisit only if bounce-only visibility
      proves insufficient in practice
- [ ] SMS/text channel — peers offer it, but out of scope; church already has PCO/Elvanto for that if
      truly needed
- [ ] Volunteer accept/decline response tracking inside this app — deliberately not replicating PCO's
      scheduling-confirmation loop (anti-feature, see above)

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Settings kill-switch + per-service defaults | HIGH | LOW | P1 |
| Messages composer (teams/individuals/everyone, subject/body, tokens, reach count) | HIGH | MEDIUM | P1 |
| Lock notification (auto-email on lock) | HIGH | MEDIUM | P1 |
| Scheduled share-link reminder (N days, Draft-skip) | HIGH | MEDIUM | P1 |
| Delivery history (sent log + hard bounces) | HIGH | MEDIUM-HIGH | P1 |
| Email provider infra (Cloud Function send path + secret) | HIGH (blocking) | MEDIUM | P1 |
| Re-lock scoped change-diff notice | MEDIUM-HIGH | HIGH | P2 |
| Send-me-a-copy / schedule-for-later | LOW-MEDIUM | LOW | P2 |
| Per-recipient personalized "their roles" rendering | MEDIUM | MEDIUM | P2 |
| Bad-address fix-and-resend UX | MEDIUM | LOW-MEDIUM | P2 |
| Open-tracking | LOW (for this audience) | MEDIUM-HIGH | P3 (deferred) |
| SMS channel | LOW (duplicates PCO) | HIGH | P3 (out of scope) |
| Accept/Decline response tracking | LOW (duplicates PCO) | HIGH | P3 (anti-feature) |

**Priority key:**
- P1: Must have for v1.7 launch
- P2: Should have within v1.7, can land in a later phase of the same milestone
- P3: Explicitly deferred/out of scope

## Competitor Feature Analysis

| Feature | Planning Center Services | Elvanto | Rock RMS | This App's Plan |
|---------|---------------------------|---------|----------|------------------|
| Trigger for first notification | Explicit "send scheduling email" action by leader (plan can be prepared/unsent indefinitely) | Automatic the moment a service is **published** | Auto- or manual-schedule triggers confirmation email | Auto-send on Draft→Planned **lock** (the app's own equivalent "publish" moment), toggleable via Settings |
| Recipient targeting | Team, "Scheduled People" (everyone on plan), or filter by response status (Prepared/Confirmed/Declined) | Whole roster on the published service | Scheduler-selected volunteers | Teams-first + individuals + "Everyone on this service" — no response-status filtering (no RSVP loop, by design) |
| Reminder before service | Configurable per plan-time/team, 0–7 days out, 10am local, bundles same-day reminders | Not clearly documented as separate from initial roster notice | Not clearly documented as a distinct reminder feature | N days out (default 7), auto-skipped while still Draft — matches PCO's model, adds the Draft-skip peers can't do |
| Ad-hoc/one-off message | Yes, from plan page or People filter, with templates | Yes, via "Contact Volunteers" on a service | Communications module (broader, drip-capable) | Yes, One-off message type in same composer as Reminder/Share-link — narrower and simpler than any peer |
| Change-since-last-notify handling | None documented — re-send is manual/whole | None documented | None documented | Scoped, typed, team-tagged diff prompt on re-lock — no peer tool does this; genuine differentiator |
| Delivery visibility to planner | Sent/pending badges per person on plan; no documented bounce surfacing | Not documented | Confirmation status tracked; no documented bounce surfacing | Per-service sent history + hard-bounce surfacing — ahead of documented peer UX |
| RSVP/Accept-Decline loop | Yes — central feature | Yes (accept/decline) | Yes (confirmation status) | Deliberately NOT built — anti-feature, PCO's job to keep |
| Org-wide off switch | Yes, disable reminders for all teams in a plan (browser/org-level) | Not documented | Not documented | Yes — global Settings kill-switch, explicit requirement |
| Merge tokens in free text | No — auto-included fixed blocks (times, notes), not user-insertable tokens in ad-hoc mail | Not documented | Not documented | Yes — service date, link, their roles, song list as insertable tokens; a genuine step ahead of PCO's fixed-block model |

## Sources

- [Send scheduling emails — Planning Center Help](https://help.planningcenter.com/en/142892-send-scheduling-emails.html) — official docs, HIGH real-world confidence (first-party)
- [Communicate with your teams — Planning Center Help](https://help.planningcenter.com/en/142889-communicate-with-your-teams.html) — official docs, composer/recipient/attachment details
- [Respond to scheduling emails — Planning Center Help](https://help.planningcenter.com/en/142893-respond-to-scheduling-emails.html) — official docs, Accept/Decline loop
- [Set up reminder emails — Planning Center Help](https://help.planningcenter.com/en/142894-set-up-reminder-emails.html) — official docs, reminder timing/scope/settings
- [Use Blockout Dates for Predictable Scheduling — PCO Zendesk](https://pcoservices.zendesk.com/hc/en-us/articles/115011726967-Use-Blockout-Dates-for-Predictable-Scheduling) — official docs
- [Bundled Scheduling & Notification Emails — Planning Center Blog](https://www.planningcenter.com/blog/2018/06/bundled-email-and-notifications) — official blog, email-bundling rationale
- [How to Setup Email and SMS Notifications to Volunteers — Elvanto Help](https://help.elvanto.com/hc/en-us/articles/7604214211351-How-to-Setup-Email-and-SMS-Notifications-to-Volunteers) — official docs, publish-triggers-notify behavior
- [How to Contact Volunteers who are Scheduled on a Service — Elvanto Help](https://help.elvanto.com/hc/en-us/articles/7604105489303-How-to-Contact-Volunteers-who-are-Scheduled-on-a-Service) — official docs, ad-hoc messaging
- [Rock RMS Volunteer Scheduler — Life.Church IT Support Knowledge Base](https://itsupport.life.church/a/1612242-how-to-use-the-volunteer-scheduler) — third-party operational guide, MEDIUM confidence
- Rock RMS product marketing (communications module scope) — vendor-reported, MEDIUM confidence, general web search
- WorshipTools vs. Planning Center comparisons (theleadpastor.com, blog secondary sources) — MEDIUM/LOW confidence, general web search, cross-checked across two independent write-ups
- Transactional email personalization/token best practices — general industry consensus (Twilio, Mailtrap, Chamaileon, Moosend resource pages), LOW-MEDIUM confidence, no single authoritative source
- Email bounce-handling best practices (hard vs. soft bounce treatment, dashboards) — general industry consensus (Mailflow Authority, Bloomreach docs, various ESP blogs), LOW-MEDIUM confidence

---
*Feature research for: volunteer/team messaging in worship-service planning tools (v1.7)*
*Researched: 2026-08-13*
