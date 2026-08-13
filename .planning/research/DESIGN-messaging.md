# Design Reference — Volunteer Messaging (imported)

**Source:** Claude Design project "Worship Planner Slideshow Design", canvas **"Turn 5 — Messaging
volunteers"** (panels 5a + 5b). Imported 2026-08-13 for v1.7. This is the authoritative UI contract for
the messaging feature; the app's dark theme (gray-950 body, gray-900 cards) and existing component
idioms take precedence over the mockup's exact hex values. Reproduced here in prose because the design
lives outside the repo — downstream UI-SPEC / plan / execute agents should treat this as the visual spec.

One-line intent (from the design header): *One ✉ Messages button on the service opens the composer;
recipients are teams first, people second. Automatic mail (lock, re-lock, link reminder) is configured
once per service and always shows exactly who it will reach.*

---

## Service header entry point (all phases)

On the service editor header, a **✉ Messages** button sits in the action row alongside `🔒 Lock service`,
`⇱ Share`, and `Save` (to the left of Share, separated by a thin divider). It opens the composer (5a).
The button is hidden/disabled when the org's Messaging kill-switch is off.

---

## 5a — Composer: "Message the team" (Phase 59)

A centered modal over a dimmed service. Header: **"Message the team"** + the service date/time
(e.g. "Sunday, August 16 · 9:00 AM") + a ✕ close.

Body sections, top to bottom:

1. **SEND TO** (section label, letter-spaced, muted).
   - A wrap of **team chips**, teams first: `▣ Worship · 5`, `▣ Tech · 3`, `▢ Vocals · 4`, `▢ Hosts · 2`,
     `▢ Everyone on this service · 14`. Selected chips are filled (violet); unselected are outlined. The
     number is the resolved recipient count for that team. Multi-select.
   - Below, a nested **Individuals** panel: label "Individuals" with a `＋ Add someone` link; selected
     individuals render as removable pills (`Kate M. ✕`, `Dan R. ✕`).
   - A muted helper line: **"Unassigned roles have no email — 2 roles on this service are still open."**
     (This is the unreachable/open-roles surfacing from R135.)

2. **MESSAGE TYPE** — a 3-way segmented control: **One-off message** | **Reminder** | **Share service
   link**. (Maps to message types; "Share service link" pre-fills a link-centric body.)

3. **Subject** — single-line input (e.g. "Rehearsal moved to 8:15 this Sunday").

4. **Message** — multi-line body (≈132px min). Supports an inline **Service link** token chip rendered
   in the body. Below the field, a row of insertable token chips: `＋ Service date`, `＋ Service link`,
   `＋ Their roles`, `＋ Song list`. ("Their roles" renders per-recipient — R139.)

5. **Options card** (muted panel): checkboxes —
   - `▣ Attach the service order as a link`
   - `▢ Send me a copy`
   - `▢ Schedule for later` + a datetime chip (e.g. "Thu Aug 13, 6:00 PM").

Footer bar: left, a live recipient summary **"Reaches 10 people · Worship, Tech, +2 individuals"**;
right, buttons **Preview** · **Cancel** · **Send now** (Send now is the violet primary).

---

## 5b — Lock, re-lock diff, automatic mail & history (Phases 61 + 62 + 60)

### "Re-lock and notify?" modal (Phase 62)

Shown when re-locking a service that was already locked once. Header: **"Re-lock and notify?"** + a
pill **"6 changes since Aug 9"**. Intro line: *"This service was locked and sent to 14 people on Aug 9.
Here's what changed — anything you uncheck stays out of the email."*

A **change list**, each row = a checkbox + a typed badge + a description + affected-teams tag on the right:
- `▣ [SONG]  Worship · "Great Are You Lord" replaced with "This Is Our God"      Worship, Tech`
- `▣ [ORDER] Scripture reading moved before the sermon                          Everyone`
- `▣ [ROLE]  Sound: Dan R. → Micah T.                                           Tech`
- `▢ [NOTES] Internal note edited on "Goodness of God"                          Worship`
- `▢ [SLIDES] 3 slides re-ordered in Announcements                             Tech`

Badge colors are per-type (SONG violet, ORDER cyan, ROLE green, NOTES/SLIDES muted). Checked rows are
included; unchecked excluded. (Default-checked vs unchecked in the mockup is illustrative — R146 makes
all entries checkable; R147 defaults non-ROLE "affected teams" to **all assigned teams**.)

**WHO GETS THE UPDATE** — radio: `◉ Only teams affected by the checked changes — Worship, Tech · 8 people`
vs `○ Everyone on this service — 14 people`.

**"Add a line of context (optional)"** — a free-text input (placeholder "e.g. Sorry for the shuffle —
last change, promise.").

Footer: left note "Locking again either way"; right buttons **Lock quietly** (outline) · **Lock & send
update** (violet primary). "Lock quietly" always available (R148).

### "Automatic email" card (Phase 61 sends; Phase 58 builds the Settings side)

Sub-labeled *"Service defaults, inherited from Settings"*. Rows, each a toggle + title + helper:
- **Email everyone when the service is locked** — *"Their roles, the song list and a link to the
  service order."* (on)
- **Prompt me to notify after a re-lock** — *"Off means re-locks are silent — no one hears about
  changes."* (on)
- **Send the service link `[7 days ▾]` before the service** — *"Goes out Sun Aug 9, 7:00 AM to everyone
  assigned. Skipped if the service is still a draft."* (on; the days value is a dropdown)
- **Day-before reminder with call times** — *"Saturday 9:00 AM, only to people with a call time set."*
  (OFF, muted — this row is **deferred to v2**, not v1.7 scope.)

### "Sent on this service" history (Phase 60)

Card header "Sent on this service" + a `✉ New message` link. Each entry = a type badge + subject +
counts + timestamp:
- `[AUTOMATIC]  Service locked — Sunday, August 16          14 sent · 11 opened   Aug 9, 4:12 PM`
- `[ONE-OFF]    Rehearsal moved to 8:15 this Sunday         10 sent · 9 opened    Aug 11, 8:03 AM`
- `[SCHEDULED]  Service link — goes out to everyone assigned   14 recipients      Aug 9, 7:00 AM`
- `[BOUNCED]    Micah T. — address rejected                 → Fix email`

**Note for v1.7 scope:** the mockup shows an "opened" count; v1.7 tracks **sent + hard bounces only** —
render sent counts and BOUNCED rows with a "Fix email" affordance, but **omit the "opened" figure**
(open-tracking is an explicit out-of-scope decision). The BOUNCED row + "Fix email" is R143.

---

## Scope reconciliation notes (design vs v1.7 requirements)

- **Omit** the "N opened" counts everywhere (open-tracking is out of scope; sent + hard bounces only).
- **Defer** the "Day-before reminder with call times" toggle to v2 (not R-mapped for v1.7).
- Everything else in 5a/5b maps to R130–R148 and is in scope.
