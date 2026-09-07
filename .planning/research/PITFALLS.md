# Pitfalls Research

**Domain:** Adding features to a shipped, cost-hardened, multi-tenant Firebase + Vue 3 worship-planning app (v2.14: Services UX alignment, dashboard rework, PC-verbiage cleanup, volunteer confirmation, Stage Layout auto-populate, auto-generated share links, alternating row shading, editor presence, and a third "Video" live-stream output with transparent banner/full-screen slides)
**Researched:** 2026-09-07
**Confidence:** MEDIUM-HIGH (project-specific findings HIGH — grounded directly in this repo's `firestore.rules`, `PROJECT.md` history, and component code; the two externally-researched items — browser alpha capture and Firebase presence patterns — are MEDIUM, general industry knowledge not verified against this project's exact hardware/SDKs)

## Critical Pitfalls

### Pitfall 1: Treating "transparent Video banner" as a solved problem when it's an unverified external hardware dependency (Blackbird)

**What goes wrong:**
The milestone scope explicitly separates "app renders a transparent-background banner" (in scope) from "Blackbird composites it over live video" (external, unresearched). The risk is that the app-side work gets built, verified only against a screenshot/DevTools check that the DOM/CSS shows `background: transparent`, and declared done — while the actual end-to-end outcome (a legible lower-third composited live over stage video on the AV room's hardware) is never validated until a live Sunday service, when it's too late to redesign.

Two independent technical facts make this a real risk, not a formality:
1. A **rendered, on-screen browser window has no alpha channel by the time an external HDMI/SDI capture device or physical video mixer sees it** — the OS compositor flattens every window to opaque RGB before it reaches a display output or a capture card. CSS `background: transparent` only ever matters *within* software that reads the DOM/canvas directly (Chromium's offscreen/headless rendering, an OBS "Browser Source", a screen-capture app that explicitly supports window transparency) — not to a piece of physical hardware digitizing a screen/HDMI signal.
2. Even within software-only pipelines (OBS, NDI), true alpha pass-through is the exception, not the default: OBS's Browser Source can honor page transparency, but most physical mixer/capture-card ingest paths and most NDI receivers do **not** carry an alpha channel — the standard, hardware-agnostic fallback the whole industry uses for "keyable" overlays is a **solid, known chroma color (green/blue) composited by the downstream device's chroma-key filter**, not real alpha.

The owner has stated the Blackbird device's transparent/keying behavior has not yet been verified — that's the right instinct, but it's easy for the "app-side only" scoping decision to quietly slide into "we don't need to know how Blackbird works to ship this," which is false: the *rendering strategy* the app should build (CSS alpha vs. a solid chroma-key color, e.g. a specific green/magenta) depends entirely on what Blackbird actually accepts, and that choice cannot be safely deferred past the render implementation.

**Why it happens:**
Scope boundaries drawn for good reasons (don't own hardware you can't test) get read as "don't even ask the question," and a plausible-looking `rgba(0,0,0,0)` CSS background feels like proof of correctness in a code review when no one in the loop has confirmed what the hardware chain actually does with it.

**How to avoid:**
- Before building the Video/Banner renderer, spend a short, cheap spike verifying (owner-run, since it needs the physical Blackbird + AV room) what capture/composite path is actually in use: is the browser output going into Blackbird via a capture card (HDMI/SDI — no alpha, ever) or via a software bridge (NDI/OBS Browser Source — alpha *may* be possible)? This single fact determines the entire rendering approach.
- Design the renderer to support **both** outcomes cheaply: a config flag for "transparent" (real alpha, `background: transparent`) vs. "chroma key" (a configurable solid fill color, defaulting to a saturated key green/magenta chosen to never appear in real slide content/backgrounds). Do not hard-code alpha as the only path.
- Explicitly label the Video/Banner feature UNVERIFIED-IN-PRODUCTION until the owner confirms a live compositing test with real Blackbird hardware — this is a hardware-in-the-loop UAT gate that code review and automated tests cannot close.
- Do not let "app-side only" scope quietly expand to include implicit promises about end-to-end keying quality; the roadmap should state the deliverable as "renders full-screen OR a bottom banner region against a background that is either alpha-transparent or a configurable solid key color" — not "produces a broadcast-ready keyed lower-third."

**Warning signs:**
- Any plan/PR that marks the Video/Banner feature "done" based only on a browser screenshot or DevTools inspection, with no note that Blackbird behavior is still unverified.
- A hard-coded assumption of either pure CSS transparency or a fixed chroma color, with no config knob to switch between them once real hardware behavior is known.
- The roadmap phase for this feature has no explicit "owner hardware UAT" gate before being called complete.

**Phase to address:**
An early, small "Video output feasibility spike" phase (or the first plan-step of the Video-output phase) should capture the Blackbird/compositing findings and decide alpha-vs-chroma-key *before* the banner-rendering UI work is built — this is the single highest-leverage de-risking action for the whole Video feature and should not be bundled at the tail end of a larger phase.

---

### Pitfall 2: Firebase presence built the "obvious" way (Firestore-only heartbeat/mount-unmount) leaks stale online state and adds unbounded write cost

**What goes wrong:**
The natural-looking implementation — write a `presence/{uid}` Firestore doc with `viewingServiceId` on component mount, delete/clear it on unmount, maybe refresh it every N seconds to look "live" — has two failure modes that are easy to miss in dev (where tabs close cleanly) and only show up in the field:
1. **Stale presence on ungraceful disconnect.** A closed laptop lid, a lost wifi connection, a crashed tab, or someone just closing the browser without triggering `onUnmounted`/`beforeunload` reliably leaves the presence doc showing that person as "still viewing" indefinitely — Firestore has **no server-side disconnect hook**. Unlike Firebase's Realtime Database, which has `onDisconnect()` (an atomically-registered write that the RTDB server itself fires when a client's actual socket drops, correct even on a crash), Firestore offers nothing equivalent — a client-only "goodbye write" is only best-effort and simply never fires on abrupt disconnects.
2. **Cost.** A heartbeat-style refresh (e.g., "touch the presence doc every 15s while the editor tab is open") turns into `N editors × (3600/15) = 240 writes/hour each` — small per-user, but this is the exact category of "small, well-intentioned recurring write" that this project's own v1.8 Cost & Billing Hardening milestone was built specifically to catch and cap (per-uid rate limits, `maxInstances` ceilings, retention sweeps). Introducing a *new* uncapped recurring-write pattern in v2.14 undoes that hardening discipline for one more surface, and it scales with concurrent-editor count across every org, not just one church.

**Why it happens:**
Presence "who's viewing this" is a genuinely common feature and most naive tutorials use Firestore because that's the datastore already in the app — they either don't mention RTDB's `onDisconnect()` primitive at all, or treat the staleness as an acceptable UX nit rather than a correctness/cost problem.

**How to avoid:**
- **Recommended pattern:** if presence is worth doing right, provision a small **Firebase Realtime Database** instance (this project currently has none — it would be a new piece of infrastructure) purely for ephemeral presence, and use its native `onDisconnect()` to atomically clear a `/presence/{orgId}/{serviceId}/{uid}` node the instant the socket drops — including crashes, closed lids, and network loss — with **zero recurring write cost** (RTDB presence is push-based, not polled, and RTDB pricing is bandwidth/connection-based rather than per-write like Firestore). The client-facing "who's viewing" reactive read still comes from RTDB's realtime listener; nothing needs mirroring into Firestore for the presence indicator itself.
- **If a new datastore is out of scope for this milestone,** the acceptable Firestore-only fallback is a **staleness-timestamp pattern, never a raw boolean**: write `lastActiveAt: serverTimestamp()` on mount and on a *coarse* interval (e.g., every 60–120s, not 15s), and treat any presence doc older than ~2× that interval as "not actually present" on the read side (client-side filter, or a scheduled Cloud Function sweep that deletes stale docs — reusing this project's existing cleanup-cron pattern from `functions/src/cleanupSweeps.ts`). This bounds both the staleness window and the write rate, and never needs a definitive "someone is gone" signal — it degrades gracefully to "hasn't been seen in 2 minutes."
- Either way, **do not poll every few seconds** — pick the coarsest interval that still feels "live" for a service-editing session (concurrent-editor awareness, not a chat app), and always clear/mark-stale on `beforeunload`/`visibilitychange` as a best-effort *addition* to the timeout, not a replacement for it.
- Cap this like every other recurring-write surface in the app: a presence doc write should go through the same "does this scale with orgs × concurrent users × time" review this project already applies (see v1.8's rationale) before shipping.

**Warning signs:**
- Any presence write on a fixed short interval (< 60s) with no Cloud Function or read-side staleness cutoff to bound it.
- A presence indicator that only ever clears on a client `onUnmounted`/`beforeunload` handler with no timeout-based fallback — this will visibly show ghost editors within the first week of real use (closed laptop lids, cell reception drops on mobile).
- No test exercising "tab closed without cleanup" (simulating an ungraceful disconnect), only the happy-path mount/unmount.

**Phase to address:**
The editor-presence phase itself must include the staleness-timeout (or RTDB `onDisconnect`) design as a first-class requirement, not an afterthought — this is exactly the kind of "looks done in the demo, leaks in production" bug this app has hit before (see the `storage.rules`/`firestore.exists()` cross-service blind spot documented in CLAUDE.md). Verification should explicitly include a simulated ungraceful-disconnect test.

---

### Pitfall 3: Firestore security rules exposing presence/"who's viewing" data across orgs — a smaller replay of the v2.8 share-token leak

**What goes wrong:**
This app has a documented, real precedent: v2.8's SEC-S-01 finding was a **Critical, LIVE, proven cross-tenant leak** where `shareTokens`/`quarterShares`/`serviceShares` had `allow read: if true`, which grants both `get` *and* `list` — letting anyone unauthenticated enumerate every org's share tokens (and therefore every org's shared service plans and volunteer names) via `getDocs(collection(...))`. The fix (now the established idiom in `firestore.rules`, see `shareTokens`/`orgSlugs`/`orgNames`/`quarterShares`/`serviceShares`) is always: **split `get` (by known id, safe to allow broadly) from `list` (must be org-scoped or denied outright)**, because a flat `allow read: if true` silently grants both.

A new presence collection is exactly the same shape of risk in miniature: if it's modeled as `presence/{uid}` or `presence/{serviceId}/{uid}` with a permissive read rule for "any signed-in user can see who's viewing," a `list` query without an org-scoping equality filter would let **any authenticated user of any org enumerate every org's currently-active editors and which services they're viewing** — a smaller but structurally identical version of the same class of bug: cross-tenant `list` where only a scoped `get` (or nothing) should be permitted.

**Why it happens:**
Presence data feels "low stakes" compared to share links or PII, so it's tempting to reach for the loosest rule that makes the feature work (`allow read: if isSignedIn()`), especially under time pressure — but "signed in" says nothing about org membership, and this app is explicitly multi-tenant (any signed-in user could be a member of a different church).

**How to avoid:**
- Model presence with the org/service id embedded in the document (or the collection path), and gate `get`/`list` the same way every other per-service collection in this app already does: `isOrgEditor(resource.data.orgId)` (or the service's derived orgId), never a bare `isSignedIn()`.
- If presence lives in Realtime Database instead of Firestore (Pitfall 2's recommended path), RTDB rules need the equivalent org-scoping — RTDB rules are structurally different (path-based `.read`/`.write`, no `get`/`list` split), so this is not a copy-paste of the Firestore rule; write and test it explicitly rather than assuming RTDB "just inherits" the app's Firestore security model.
- Add an explicit ALLOW/DENY rules test for presence mirroring the existing `rules.test.ts` coverage pattern for share tokens — verify a member of Org A cannot read Org B's presence docs, both via `get` and via an unscoped `list`.

**Warning signs:**
- A presence security rule that reads `allow read: if isSignedIn()` (or equivalent) with no per-org data filter.
- No rules test exercises a cross-org read attempt for the new collection.
- The presence read path in the client uses an unscoped `collection()`/`onSnapshot()` query rather than one `where('orgId','==', orgId)`-filtered (or path-scoped in RTDB) to the current service.

**Phase to address:**
The editor-presence phase's security design should explicitly cite the v2.8 SEC-S-01 pattern and require the get/list split (or RTDB path-scoping) plus a rules test as a completion criterion — this is cheap to get right up front and expensive to discover live (as v2.8 did).

---

### Pitfall 4: Auto-generating share links removes the one manual gate that currently prevents sharing an unfinished/Draft service

**What goes wrong:**
Today, a share link is created only when a user deliberately clicks "Share Link" — an implicit "I'm ready to show this to volunteers" signal. Auto-generating the link (so it "just exists") removes that signal. If the auto-generation fires as soon as a service is created (or on every save), a still-being-drafted service could have a live, guessable-URL share page from minute one — reachable by anyone with the link, including a volunteer who bookmarked or was sent last week's link pattern, before the plan is finished or reviewed. This app already treats "Draft vs Planned/locked" as a meaningful gate elsewhere (the volunteer "My Schedule" surface deliberately shows **only Planned, non-Draft** services — see v2.12's explicit decision to reuse that gate) — auto-share risks quietly bypassing that same principle for the share-link surface specifically.

A second, related risk: **token/document creation spam**. If "auto-generate" is implemented as "create a new share doc/token on every relevant page load or every autosave" rather than "ensure exactly one exists, idempotently," it will create duplicate share docs/tokens per service (extra Firestore writes, extra orphaned tokens that still need revocation on delete, and — per the `serviceShareLinks`/`shareTokens` rules comments already in this codebase — this app already had a bug class here: `deleteService()` and `ensureShareLink()`'s adoption query both had to be taught to find "every token for a service" because a service could already end up with 2+ tokens).

**Why it happens:**
"Auto-generate so the user never has to click Share" is usually implemented the easy way — call the same `ensureShareLink()`-style function opportunistically wherever it's convenient (on service create, on every editor mount) — without pausing to ask (a) should this exist yet, given Draft state, and (b) is this call idempotent/safe to invoke repeatedly.

**How to avoid:**
- Reuse the existing `ensureShareLink()` idempotent-adoption pattern (already in `src/stores/services.ts` per the rules comments) rather than writing a new creation path — it already knows how to avoid creating duplicates when a token already exists for a service.
- Decide and document explicitly **when** auto-generation fires: the safest default, consistent with this app's existing Draft/Planned gate, is to auto-generate the share link **only when a service transitions to Planned/locked** (mirroring the volunteer-surface gate), not on every Draft save. If the product intent is genuinely "the link should exist even for drafts so a planner can preview it," that's a legitimate but different decision — it should be made explicitly, not fallen into, and the share *page* itself should still visibly indicate Draft/unfinished status rather than rendering a normal-looking plan.
- Verify no double-token-creation path: add a test asserting that calling the auto-generate path twice on the same service does not create a second `shareTokens`/`serviceShares` doc.
- Confirm the create/update rules already in `firestore.rules` (`isOrgEditor(request.resource.data.orgId)`) apply unchanged to whatever new code path triggers auto-creation — a Cloud Function or trigger-based auto-generation path (as opposed to client-triggered) would run with admin privileges and bypass these rules entirely, which needs its own scoping review if that's the chosen implementation.

**Warning signs:**
- Multiple `shareTokens`/`serviceShares` docs found for one service in Firestore during testing.
- A share link reachable for a service that's still in Draft, with no visual indication on the share page that the plan is unfinished/subject to change.
- Auto-generation implemented as a client-side `onMounted` hook in the editor rather than tied to a specific state transition (Draft→Planned) or an idempotent ensure-function.

**Phase to address:**
The auto-generate-share-link phase should explicitly reuse `ensureShareLink()`, state the trigger condition (service lock vs. service creation) as an up-front decision, and include a duplicate-creation regression test — plus a rules review confirming the trigger mechanism (client call vs. Cloud Function/trigger) doesn't need new rule surface.

---

### Pitfall 5: Stage Layout auto-populate clobbers manual placement on re-run, or duplicates markers when roster assignments change

**What goes wrong:**
`StageLayoutEditor.vue` already models markers with a `roleId`/`roleName` tied to a band role, plus an optional `personId`/`personName` pick from `assignablePeople` (the resolved roster for that service), and each marker carries manually-set `xPct`/`yPct` position. "Auto-populate the per-service Stage Layout with the assigned roles/instruments" is trivial to build the first time (empty canvas → generate one marker per assigned role) but has two easy-to-miss failure modes on **re-run** — which will happen constantly in practice, since roster assignments change (a volunteer swaps out, a role gets reassigned) right up until the service locks:
1. **Clobbering manual placement.** If auto-populate is implemented as "wipe all markers, regenerate from current roster" every time it runs (or every time the roster changes), it destroys any position/note/kind edits the planner already made — the exact "manual placement" the feature is supposed to save time on, not repeatedly discard.
2. **Duplicating on re-run.** If instead it's implemented as "add a marker for each assigned role that doesn't already have one," the matching key matters: matching only on `roleId` will silently skip re-adding a role whose only marker was deleted on purpose (the planner doesn't want that instrument shown); matching on `personId` will create a *second* marker if the same person is reassigned to a different role; and re-running with no dedup key at all creates visible duplicate markers for the same role/person, cluttering the canvas.

**Why it happens:**
"Auto-populate an empty canvas" is usually designed and tested only against the empty-canvas case (the "instead of an empty canvas" framing in the milestone scope), because that's the demo-visible win — the harder, more common case (re-running against a canvas that already has *some* manual edits from a partially-planned service) doesn't get exercised until real usage.

**How to avoid:**
- Design auto-populate as a **one-time seed on first load of an empty layout**, not a recurring sync — generate markers only when `elements.length === 0` for that service, and never again automatically. If keeping the layout in sync with later roster changes is genuinely wanted, make it an explicit, opt-in "Sync from roster" button the planner clicks (with a confirmation if it would remove/reposition existing markers), not silent automatic re-running.
- If any reconciliation logic is built at all, key it on the assignment's stable identity (this app already models `ServingAssignment.id`, distinct from `roleId`/`personId`) so add/remove/reassign are each detectable without ambiguity, and make "remove a marker whose assignment no longer exists" an explicit, reversible action (or leave orphaned markers in place with a visual "unassigned" indicator) rather than silently deleting a planner's manual placement.
- Preserve `xPct`/`yPct`/`note`/`withVocal` on any marker that already exists for that role/person when reconciling — never regenerate a marker wholesale just because the underlying assignment changed name/role slightly.

**Warning signs:**
- A test only covers "empty canvas + N assigned roles → N markers," with no test for "canvas already has manually-positioned markers + roster changes → existing positions preserved."
- Auto-populate fires on every service-editor mount/every roster edit rather than once on a genuinely empty canvas.
- No stable identity key used for matching markers to assignments (matching by name string, or no matching at all).

**Phase to address:**
The Stage Layout auto-populate phase's plan should explicitly define and test the "already has manual edits" and "re-run after roster change" cases as acceptance criteria, not just the empty-canvas happy path.

---

### Pitfall 6: Removing "Planning Center" verbiage sweeps up the real PC integration/export copy along with it

**What goes wrong:**
The concrete example in scope — "Planning Center already has this plan" in the Planned/locked banner — is one string among what a text search for "Planning Center" will surface across the whole app, and this project has a **real, functioning Planning Center integration** (an export/proxy path — see `src/utils/planningCenterApi.ts` and the v2.2/v2.6 milestone history referencing "full Planning Center export slot coverage" and a live gate in the scripture-push branch). A blanket find-and-replace or an overzealous "remove all PC mentions" pass risks deleting or garbling copy that legitimately describes the actual integration/export feature (button labels, tooltips, settings toggles, error messages referencing the real PC API), breaking user understanding of a feature that still exists and still does something.

**Why it happens:**
"Remove Planning Center verbiage" reads as a simple text-hygiene task, inviting a fast, non-contextual search-and-delete rather than a per-occurrence judgment call about whether the string is *incidental* mention-dropping (implying an unbuilt/irrelevant coupling, like the banner text) versus *substantive* description of the real integration.

**How to avoid:**
- Enumerate every occurrence of "Planning Center"/"PC" in UI-facing strings first (a grep pass), and classify each one explicitly as "incidental verbiage to remove" vs. "real integration copy to keep" before touching any of them — do not do this as a blind replace.
- Cross-check the removal list against `planningCenterApi.ts`'s actual call sites and the export/settings UI that surfaces PC-specific actions (export buttons, PC connection status, the scripture-push gate) — anything a user would need to understand *that specific feature* stays.
- Include a targeted manual smoke-check of the PC export/integration flow itself after the copy sweep, not just a visual diff of the banner text, to confirm no functional string (e.g., an error message a user needs to act on) was accidentally altered.

**Warning signs:**
- A diff touching `planningCenterApi.ts`-adjacent components (export buttons, connection settings) when the intended change was only the Planned-banner copy.
- Any occurrence removed without a one-line note on *why* it was incidental rather than substantive.

**Phase to address:**
The PC-verbiage-removal work item (likely bundled into the Services-page or dashboard phase) should start with a full grep inventory and classification pass as its first step, with the classification itself reviewed before any edits land.

---

### Pitfall 7: Volunteer "I've got it" confirmation races with roster/assignment edits and produces stale or contradictory state

**What goes wrong:**
Confirmation state ("I've got it") is a new piece of per-assignment state layered onto an existing roster/assignment model that a planner can still edit concurrently (reassign a role, swap a volunteer, unlock and re-lock a service). Without care, several race/staleness scenarios surface quickly:
- A volunteer confirms an assignment; the planner then reassigns that role to someone else — does the confirmation silently persist against the old assignment (now shown against the wrong/departed person), or does it need to be explicitly cleared? If it's not cleared, the roster's "confirmed" indicator can lie.
- Two tabs/devices for the same volunteer (a real scenario now that this app supports magic-link, cross-device volunteer access) could race a confirm/unconfirm toggle, and whichever write lands last wins with no indication to the other tab that it's now showing stale state — consistent with this app's own documented general pattern of needing "watch for org/service changes and re-subscribe" (see the church-switch re-subscribe fix precedent) rather than assuming a single snapshot is ground truth forever.
- If confirmation triggers a notification (to the planner, e.g., "so-and-so confirmed"), an unlock/reassign/relock cycle could either double-fire that notification or never re-arm it for the new assignment, depending on whether the notification logic keys off the assignment's identity or the confirmation event alone.

**Why it happens:**
Confirmation looks like a simple boolean toggle in isolation, but this app's assignments are not immutable — they're actively edited during the drafting/re-locking cycle this project already has dedicated mechanics for (draft, lock, unlock-and-relock with scoped diffs, per v1.7's "re-lock scoped change diff"). A feature designed against a static snapshot of "who's assigned" will not survive that lifecycle.

**How to avoid:**
- Key confirmation state on the same stable assignment identity the roster already uses (not on a derived display string), and explicitly clear/invalidate a confirmation when its underlying assignment is reassigned to a different person — surface that as "needs reconfirmation," not as an orphaned checkmark.
- Read confirmation state via the same live-subscription pattern (`onSnapshot`) already used elsewhere in this app (e.g., the v2.13 live volunteer-service doc) rather than a one-time fetch, so a planner's roster view reflects a volunteer's confirmation (or a reassignment invalidating it) without a manual refresh.
- If confirmation drives a notification to the planner, reuse this project's existing volunteer-messaging queue/kill-switch infrastructure (v1.7) rather than building a second, parallel notification path — and key it off the assignment id so a reassignment doesn't produce a phantom re-notify or a silently dropped one.

**Warning signs:**
- A roster view showing a confirmed checkmark for a person who is no longer actually assigned to that role (found by reassigning after confirming, in manual test).
- Confirmation read via a one-time `getDoc` rather than a live listener, so a planner has to reload to see updates.
- No test covers "confirm, then reassign the role" as a sequence.

**Phase to address:**
The volunteer-confirmation phase's plan should explicitly test the reassign-after-confirm and unlock/relock sequences, not just the confirm-then-display happy path, and should specify up front whether confirmation is scoped to a service-lock-state or persists across unlock/relock.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|-----------------|------------------|
| Hard-coding a single chroma-key color for the Video/Banner output instead of a config knob | Faster to ship the first version | Re-plumbing required the moment the real Blackbird behavior is confirmed to need alpha instead (or a different key color) | Only as a placeholder explicitly flagged "swap once Blackbird verified" — never presented as final |
| Firestore-only presence with a short heartbeat interval, deferring RTDB `onDisconnect` | No new infrastructure (RTDB) to provision this milestone | Recurring per-editor write cost that compounds with concurrent-editor count across orgs, plus ghost "still viewing" indicators after crashes | Acceptable only with a generous staleness timeout (60–120s+) and a scheduled cleanup sweep — never as a raw boolean with no expiry |
| Auto-generating a share link on service creation rather than on lock/Planned transition | Simpler trigger logic (fire-and-forget) | A guessable-URL share page can exist for a Draft plan the planner isn't ready to show anyone | Only if the share page itself visibly marks Draft/unfinished state so an early visitor isn't misled |
| Stage Layout auto-populate that regenerates all markers on every load | Simple, stateless implementation | Destroys planner's manual positioning/notes on every reload, defeating the point of allowing manual placement at all | Never — even an MVP version must gate on "canvas currently empty" |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|-----------------|-------------------|
| Blackbird hardware / external video mixer | Assuming CSS `background: transparent` on a browser output window is sufficient for the mixer to key/composite correctly | Confirm (owner, hardware-in-the-loop) whether the capture path is HDMI/SDI (no alpha ever — needs a solid chroma-key color) or a software bridge like NDI/OBS Browser Source (alpha may be possible) *before* finalizing the renderer's transparency strategy; build both a transparent-CSS mode and a configurable solid-key-color mode |
| Firebase Realtime Database (new, if adopted for presence) | Assuming RTDB inherits the app's existing Firestore security-rule model/idioms automatically | RTDB rules are structurally different (path-based, no get/list split) — write and test org-scoping explicitly, don't assume parity with `firestore.rules` |
| Planning Center (existing) | Deleting/altering PC-related copy indiscriminately while removing "verbiage," including strings that describe the real export/integration feature | Classify every occurrence (incidental vs. substantive) before editing; smoke-test the actual PC export flow after the copy sweep |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|-----------------|
| Short-interval Firestore presence heartbeat | Rising Firestore write counts correlating with concurrent-editor count rather than with real user actions; shows up in the same billing dashboards v1.8 built to watch | Coarsen the interval (60s+) and/or move to RTDB; cap with a scheduled cleanup sweep | Noticeable once more than a handful of orgs have simultaneous multi-editor sessions regularly |
| Stage Layout re-render/regeneration on every roster snapshot update | Canvas visibly "jumps"/resets whenever a roster doc updates elsewhere (e.g., another tab reassigns a role) | Only regenerate markers on an explicit empty-canvas seed or an explicit opt-in sync action, never reactively on every roster change | As soon as two people (planner + a scheduler making roster edits) are active around the same service concurrently |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Presence collection with `allow read: if isSignedIn()` (or equivalent unscoped read) | Cross-tenant enumeration of who's-online/what-service, structurally identical to the v2.8 SEC-S-01 cross-tenant share-token leak (Critical, proven live) | Gate get/list on the resource's `orgId` using the existing `isOrgEditor()` idiom; add an explicit cross-org rules test |
| Auto-generated share link created via a path that bypasses the existing `isOrgEditor(request.resource.data.orgId)` create rule (e.g., an admin-privileged Cloud Function trigger) | A trigger-based creation path runs with admin rights and isn't subject to `firestore.rules` at all — any bug in the trigger's own org-scoping becomes a direct data-isolation bug with no rules-layer backstop | If auto-generation must be server-side/triggered, replicate the org-scoping check in the function code itself and add a function-level test for it — do not rely on client-side rules to catch a server-side bug |
| Share link auto-generated for a Draft service, then indexed/crawled/bookmarked before the plan is finalized | A stale or since-changed "preview" of an unfinished plan reaches a volunteer or gets shared further, with no clear signal it was provisional | Gate auto-generation on lock/Planned state (mirroring the existing My Schedule Draft-exclusion gate), or clearly mark Draft state on the share page itself |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-------------------|
| Services page restyle changes tab/button layout without re-testing at phone width | The stated problem (tabs/buttons don't match the header pattern and aren't usable on a phone) recurs in a new form — restyled but still not actually mobile-usable | Test the reworked Services page against the same phone-width breakpoints already established elsewhere in the app (this app has an existing "standard page header" pattern to match, not a from-scratch design) |
| Dashboard "readiness" signal (songs/media attached, roles filled, slides built) computed inconsistently with the gates used elsewhere (Draft/Planned, My Schedule's readiness indicator) | A dashboard could show a service as "ready" while My Schedule (v2.12) or the roster shows something different, confusing planners about what's actually true | Reuse the same readiness/completeness computation this app already has for the volunteer-facing readiness indicator (v2.12's "all ready / N songs missing media / waiting on charts") rather than inventing a second, parallel definition |
| "Unconfirmed volunteers" dashboard widget doesn't account for confirmation being invalidated on reassignment (Pitfall 7) | A volunteer shows as "unconfirmed" for a role they were never actually told about (post-reassignment), or a planner is falsely reassured by a stale confirmed state | Wire the dashboard widget off the same live confirmation-state source the roster and My Schedule use, keyed on current assignment identity |

## "Looks Done But Isn't" Checklist

- [ ] **Video/Banner transparent output:** Renders correctly with `background: transparent` in a browser preview — but has NOT been verified through the actual Blackbird capture/composite chain on real hardware. Verify: owner runs an end-to-end hardware test before calling this feature complete, not just a DevTools/screenshot check.
- [ ] **Editor presence indicator:** Shows other viewers correctly during a clean multi-tab test session — but has NOT been tested against an ungraceful disconnect (closed lid, killed tab, lost network). Verify: force-kill a viewing tab/process and confirm the presence indicator clears within the expected staleness window, not never.
- [ ] **Auto-generated share link:** A new service gets a share link automatically — but has NOT been checked for (a) whether it fires for still-Draft services, and (b) whether re-triggering the auto-generate path a second time creates a duplicate token. Verify: create a service, don't lock it, check the share link's reachability and Draft-state visibility; then trigger auto-generate twice and confirm only one token/doc exists.
- [ ] **Stage Layout auto-populate:** Populates correctly on a brand-new, empty service — but has NOT been tested against a service where the planner already manually repositioned markers and then the roster changes. Verify: manually move a marker, change the underlying roster assignment, and confirm the manual position/notes survive (or that any removal is explicit/reversible, not silent).
- [ ] **Volunteer confirmation:** Confirms correctly in the simple case (assign → volunteer confirms → planner sees it) — but has NOT been tested against reassignment-after-confirm or unlock/relock cycles. Verify: confirm an assignment, then reassign the role to someone else, and confirm the roster no longer shows a stale confirmed checkmark against the departed assignment.
- [ ] **"Planning Center" verbiage removal:** Removes the cited banner text — but has NOT been checked against the real PC export/integration UI for accidentally-altered functional copy. Verify: exercise the actual Planning Center export flow after the copy sweep and confirm its labels/errors are unchanged.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|----------------|------------------|
| Video/Banner shipped as pure-alpha but Blackbird actually needs a solid chroma key | MEDIUM | Add a config toggle (transparent vs. solid-key-color) after the fact — the render logic (fit-to-banner-region, rest-of-frame background) is the same either way; only the background value/CSS changes, so this is a scoped fix, not a rewrite, if the renderer was built with a single background-style variable in the first place |
| Presence leaked stale "online" state in production before RTDB/staleness-timeout was added | LOW | Add the staleness-timestamp read-side filter (or a one-off cleanup Cloud Function run once) — this doesn't require a schema migration, just a query/read-side change plus a manual sweep of existing stale docs |
| Duplicate share tokens discovered for existing services | LOW-MEDIUM | Reuse the same "find every token for a service" query this app's `deleteService()` already implements to enumerate and dedupe (keep the most recently created, revoke the rest) — this exact recovery mechanism already exists in the codebase for a related bug |
| Stage Layout auto-populate already clobbered manual placements for existing services before the fix landed | HIGH (data, not code) | There is likely no reliable way to recover a planner's specific prior manual positions once overwritten — the fix is forward-looking (stop clobbering going forward) plus an apology/heads-up to affected planners, not a data recovery script |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|-------------------|----------------|
| Blackbird/alpha-capture feasibility unverified | An early, small feasibility-spike phase (or Phase 1 of the Video-output work), before the banner-rendering UI is built | Owner-run hardware test compositing a live app output through the real Blackbird chain; app renderer supports both an alpha and a solid-key-color mode |
| Firestore-only presence leaks stale state / uncapped write cost | The editor-presence phase | A forced ungraceful-disconnect test (kill the tab/process) shows the indicator clearing within the defined staleness window; a written note on the chosen write-interval and its cost impact |
| Presence security rule exposes cross-org data | The editor-presence phase (security design step) | A rules test proving a member of Org A cannot `get` or `list` Org B's presence data |
| Auto-share-link creates duplicates or exposes Draft services | The auto-generate-share-link phase | A test asserting idempotent creation (no duplicate token on repeat trigger) and an explicit decision + test for the Draft-vs-Planned trigger condition |
| Stage Layout auto-populate clobbers/duplicates | The Stage-Layout-auto-populate phase | A test covering "existing manual edits survive a roster change" and "re-running does not duplicate markers" |
| PC-verbiage removal touches real integration copy | The Services-page/dashboard copy-cleanup phase | A grep-based inventory + classification reviewed before edits, plus a manual smoke-check of the PC export flow post-change |
| Volunteer confirmation races with reassignment | The volunteer-confirmation phase | A test sequence: confirm → reassign role → assert stale confirmation is cleared/invalidated, not silently shown as still-confirmed |
| Services-page mobile restyle doesn't actually fix mobile usability | The Services-page UX-alignment phase | Manual verification at the app's existing phone-width breakpoints, not just a visual pass at desktop width |

## Sources

- `.planning/PROJECT.md` — v2.14 milestone scope and owner decisions (Blackbird external-dependency framing, "app-side only" scope decision 2026-09-07); v2.8 milestone record (SEC-S-01 Critical cross-tenant share-token leak, its `get`/`list` split fix); v2.12/v2.13 records (My Schedule Draft-exclusion gate, live volunteer-service-doc `onSnapshot` pattern, church-switch re-subscribe precedent); v1.7/v1.8 records (volunteer-messaging queue + kill-switch infra, cost/billing-hardening rationale for recurring-write surfaces).
- `firestore.rules` (this repo) — the `shareTokens`/`orgSlugs`/`orgNames`/`quarterShares`/`serviceShares` get/list-split idiom and inline rationale comments (SEC-S-01/SEC-ISO-06), directly informing the presence and share-link pitfalls.
- `src/components/stage/StageLayoutEditor.vue` (this repo) — existing marker/assignment data model (`StageMarker`, `ServingAssignment`, `roleId`/`personId`), informing the auto-populate reconciliation pitfall.
- CLAUDE.md (this repo) — the `firestore.exists()`-in-Storage-emulator blind spot as a documented precedent for "looks correct, isn't verified against the real environment," directly analogous to the Blackbird-verification risk.
- [OBS Forums — "How to Make Background Transparent?"](https://obsproject.com/forum/threads/how-to-make-background-transparent.108643/) and related OBS/chroma-key threads (MEDIUM confidence, general web) — browser-source transparency is software-pipeline-dependent, not a universal property of a rendered browser window; physical mixer/capture-card paths conventionally rely on chroma-key color, not alpha.
- General Firebase documentation on Realtime Database `onDisconnect()`/presence patterns and Firestore's lack of an equivalent primitive (MEDIUM confidence, general web, not verified against this project's exact SDK versions) — informs the recommended RTDB-or-staleness-timeout presence pattern.

---
*Pitfalls research for: Adding Services UX/dashboard/PC-copy/confirmation/Stage-Layout-auto-populate/auto-share/row-shading/presence/Video-output features to a shipped, cost-hardened, multi-tenant Firebase worship-planning app*
*Researched: 2026-09-07*
