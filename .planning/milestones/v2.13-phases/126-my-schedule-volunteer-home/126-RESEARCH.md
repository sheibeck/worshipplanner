# Phase 126: My Schedule — Volunteer Home - Research

**Researched:** 2026-09-06
**Domain:** Firestore collection-group list queries under security rules, client-side projection
extension, date/timezone grouping without a date library, build-safe forward routing
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Data source & assignment matching (R378, R379)**
- My Schedule is powered by the Phase 125 `rehearseAccess` projection, not by live org-scoped
  reads. Query `rehearseAccess` for docs whose `assignedEmailsLower` array-contains the
  volunteer's lowercased, **verified** email (the CR-01 `email_verified` rule arm governs read
  access). Because the projection is written only at lock time (`markAsPlanned`) and deleted on
  reopen/delete, "Planned-only" is automatic — draft services simply have no projection doc, so
  R379 is satisfied structurally.
- This requires a Firestore composite index: `rehearseAccess` `array-contains` on
  `assignedEmailsLower` plus `orderBy` service date. (Phase 125 RESEARCH flagged this index as the
  Phase 126 need.) Add it to `firestore.indexes.json` and note deploy in the owner steps.
- If the projection lacks a field My Schedule needs (service name, date, time, venue, per-song
  chart/track counts, the volunteer's own roles, call time), extend `buildRehearseAccess`
  (Phase 125's builder) to denormalize it — keep the projection PII-safe (no free-text
  notes/slot bodies), mirroring `buildServiceSnapshot`. Prefer extending the existing projection
  over adding new reads.

**Layout, grouping & ordering (R380)**
- Soonest-first. Group upcoming into This week / Later this month; show past services the
  volunteer served in a separate section (openable, CTA "Open"/read rather than "Rehearse"). A
  "Next up" badge on the single soonest upcoming service.
- Match the owner's Volunteer Home mock: "Good morning, {name}" header + summary line, date block
  per card, footer note explaining the list is roster-built.

**Card content (R381)**
- date, service name, time · venue, the volunteer's own role chips (instrument icons), song/chart/
  track counts, a readiness indicator, countdown + call time.
- Readiness: all songs have media → "All rehearsal files ready"; some missing → "N songs still
  missing media"; none → "Waiting on charts from the leader".

**Navigation into Rehearse (R382)**
- Rehearse → navigates to the Phase 127 standalone volunteer service view route (e.g.
  `/volunteer/service/:serviceId` or `/rehearse/:serviceId`). Past cards use "Open."
- Build-safety (125 lesson): do NOT add a lazy `import()` to a Phase-127 component that does not
  exist yet — breaks `vite build`. Acceptable: (a) push/link to the future route by path (a click
  before Phase 127 lands 404s gracefully), or (b) a minimal placeholder route/view in 126 that
  Phase 127 replaces.

**Empty state & different-email (R383)**
- "Check a different email" affordance (sign out + retry), and an empty state when the signed-in
  email matches no assignment.

### Claude's Discretion
- Exact route path, component split, the projection-field additions, and the index shape are the
  planner's choice within the constraints above.

### Deferred Ideas (OUT OF SCOPE)
- The Rehearse/Order-of-Service/Stage-Layout service view itself → Phase 127.
- Calendar sync / per-volunteer annotations → backlog (Future Requirements).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| R378 | After sign-in, land on My Schedule listing every service the volunteer is assigned to, matched by roster email → assignment | §Architecture Patterns Pattern 1 (collection-group query), §Common Pitfalls #1–#2 |
| R379 | Show only Planned (non-Draft) services — reuse the existing lock gate | Already structural via the Phase 125 lifecycle (markAsPlanned writes / reopenService+deleteService revoke) — see Summary |
| R380 | Soonest-first, grouped This week / Later this month + past, "Next up" badge | §Architecture Patterns Pattern 3 (grouping/countdown), §Common Pitfalls #4 (timezone) |
| R381 | Card shows date, name, time·venue, role chips, counts, readiness, countdown+call time | §Projection Extension, §Don't Hand-Roll, §Common Pitfalls #3 (role chips), #5 (unmodeled fields) |
| R382 | Rehearse → CTA into Phase 127's standalone view; past cards get "Open" | §Architecture Patterns Pattern 4 (build-safe forward route) |
| R383 | "Check a different email" affordance + empty state | §Code Examples (reuse VolunteerSignInView pattern), §Architecture Patterns |
</phase_requirements>

## Summary

Phase 125 shipped everything this phase needs to *read* data — `organizations/{orgId}/rehearseAccess/{serviceId}`
docs, one per Planned service, each carrying `assignedEmailsLower: string[]`, `serviceDate`,
`title`, `status`, and a frozen `songs[]` array with attachment `kind`/`downloadUrl`/`href`
(`src/utils/rehearseAccess.ts`, `firestore.rules:277-313`). What Phase 125 did **not** need — and
did not build or test — is the one query pattern My Schedule cannot do without: **listing across
every org's `rehearseAccess` docs for a single volunteer identity that holds no `orgId` claim.**
Every Phase 125 rules test uses `getDoc()` by known id; the one `list()` test that exists
(`src/rules.test.ts:2816`) proves an *unfiltered* `list()` is **denied** (correct — enumeration
guard) but proves nothing about a *constrained* list. This is the single most important gap this
research closes: **the rule as written should permit a properly-constrained list, but Phase 126
must write the first test that proves it**, because nothing today does.

The mechanism: Firestore's list/query rule evaluation does not require documents to be pre-fetched
to check `resource.data`-dependent conditions — it statically verifies that a rule's
`resource.data` references are covered by the query's own `where`/`array-contains` filter, exactly
the same "provably constrained" idiom already proven and comment-documented in this very
codebase's `shareTokens` collection ("Firestore requires an equality filter on any field a list
rule reads from resource.data," `firestore.rules:430-432`). The `rehearseAccess` rule's volunteer
arm reads `resource.data.get('assignedEmailsLower', [])` — a client query filtering
`where('assignedEmailsLower', 'array-contains', myLowerEmail)` satisfies that exact requirement.
The rule's other conjuncts (`isSignedIn()`, `email_verified`, `parentIsPlanned()`'s `get()`/
`exists()` on the sibling `services/{serviceId}` doc) are either token-scoped (no resource.data
dependency, evaluated freely) or per-document `get()` calls, which Firestore explicitly supports
inside list rules (at an extra read cost per candidate document — official, documented behavior,
not a workaround). Because a volunteer has **no orgId claim at all** (Phase 125's whole point), the
query must be a **`collectionGroup('rehearseAccess')`** query, not a subcollection query scoped to
one known org — Phase 125's own Open Question #1 flagged exactly this need and left it for this
phase. The array-contains filter combined with an `orderBy('serviceDate')` requires a **composite,
collection-group-scoped index**, which does not exist yet — `firestore.indexes.json` currently has
an empty `indexes: []` array.

The projection itself is 90% sufficient already: `title`/`serviceDate`/`status`/`songs[]` are
already denormalized (service name and date do **not** need adding, contrary to what the
Context/UI-SPEC framing implies). The one genuine gap is **per-assigned-email role chips** —
`assignedEmailsLower` is a flat set today with no role breakdown. The fix mirrors an
already-shipped Cloud Functions precedent almost line-for-line:
`functions/src/serviceRoles.ts`'s `resolveMessageRecipients()` already builds a
`roleNamesByPerson: Map<string, string[]>` for the reminder email's `{{their_roles}}` token; the
client-side `buildRehearseAccess()` should build the identical map (via the already-imported
`resolveServiceRoleAssignments()`) and denormalize it as `rolesByEmailLower: Record<string,
string[]>`. Time/venue/call-time are **not omittable-by-choice** — they are genuinely absent from
`Service` (confirmed by direct read: `id/date/name/progression/teams/status/slots/sermonPassage/
notes/...`, no time-of-day or location field) and from `OrgSettings` (no venue/service-time
default). This phase cannot manufacture data that does not exist upstream; the UI-SPEC's graceful
per-field omission is the correct and only viable path this phase.

A second, quieter finding worth flagging: the CONTEXT/UI-SPEC framing that "org timezone handling
(v1.7 messaging)" is available to reuse for the This-week/Later-this-month grouping is **only true
server-side**. `todayInTimeZone()` (`functions/src/index.ts:1879`, a tiny `Intl.DateTimeFormat`
wrapper, zero dependencies) exists **only in the Cloud Functions package** and is used **only** by
the scheduled reminder job. No client-side equivalent exists, and — more importantly — a
magic-link volunteer's Firestore rules grant **no read access to `organizations/{orgId}`** at all
(`firestore.rules:113`, `isOrgMember(orgId)`-gated), so even if a client utility existed, a
volunteer session cannot fetch the org's `timezone` setting to use it. `ServicesView.vue`'s own
existing upcoming/past split (`src/views/ServicesView.vue:229-249`) already uses plain
browser-local `new Date()`, not org timezone — this phase's simplest, lowest-risk, most
convention-consistent option is to do the same. Denormalizing `orgTimezone` onto the projection is
possible (cheap, one string field, `markAsPlanned` doesn't currently pull `OrgSettings` but easily
could) but is additional scope with a barely-perceptible practical benefit for a single-church
weekly-service app; documented as the planner's explicit call, not a silent gap.

**Primary recommendation:** Add a single collection-group composite index
(`assignedEmailsLower` array-contains + `serviceDate` ascending, `queryScope: COLLECTION_GROUP`)
to `firestore.indexes.json`; extend `buildRehearseAccess()` with a `rolesByEmailLower` map (no
schema change needed for name/date, which already exist); write the **first** rules test proving a
constrained `collectionGroup` list query succeeds (the actual unresolved risk in this phase, not a
formality); use plain browser-local date math for grouping/countdown (matches `ServicesView.vue`'s
own convention); and route the Rehearse CTA to a literal path string (`router.push({ path:
'/volunteer/service/' + serviceId })`), registering only a thin placeholder route + view this phase
so Phase 127 can replace the component without touching the click target.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| My Schedule list query (cross-org, by assigned email) | Database / Storage (Firestore collection-group query + rules) | Browser / Client (query construction) | The security boundary and the query-shape constraint both live in `firestore.rules`; the client only supplies the matching `where` filter |
| Composite index provisioning | Database / Storage (`firestore.indexes.json`, deployed) | — | Required infrastructure, not application code — must be deployed before the query can run in production |
| Projection extension (`rolesByEmailLower`) | Browser / Client (pure builder in `src/utils/`) | API/Backend precedent (mirrors `functions/src/serviceRoles.ts`) | `buildRehearseAccess` is a store-free pure function; the Cloud Functions package already solved the identical "per-person role names" problem for a different consumer (email tokens) |
| Grouping / countdown / readiness derivation | Browser / Client (pure computed/util functions) | — | All inputs (dates, song/attachment counts) are already present client-side in the queried `rehearseAccess` docs; no server round-trip needed |
| Rehearse → CTA routing | Browser / Client (Vue Router) | — | Pure navigation; the target view is Phase 127's responsibility, this phase only owns the click target and (optionally) a placeholder |
| Volunteer top bar / sign-out / "check a different email" | Browser / Client | Database / Storage (Firebase Auth signOut) | Reuses `volunteerAuth.signOut()` and `authStore.logout()` verbatim — no new auth surface |

## Standard Stack

### Core
No new libraries. Every capability needed is already installed and already used elsewhere in this
exact codebase.

| Library | Version (installed) | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `firebase` | `^12.0.0` [VERIFIED: package.json] | `collectionGroup()`, `query()`, `where()`, `orderBy()`, `onSnapshot`/`getDocs` for the My Schedule read | Already the app's only Firestore client SDK |
| `vue-router` | `^5.0.3` [VERIFIED: package.json] | New `/my-schedule` route + placeholder `/volunteer/service/:serviceId` route | Already the app's router; no new routing library |
| Intl (built-in, no package) | N/A | Optional: porting `todayInTimeZone`'s `Intl.DateTimeFormat("en-CA", {timeZone})` pattern client-side IF the planner chooses the org-timezone path over browser-local | Zero-dependency Web/Node built-in, already proven correct in `functions/src/index.ts:1879` |

### Supporting
None. No date library (`dayjs`/`date-fns`/`luxon`) exists anywhere in `src/` today — confirmed by
direct search — and none is needed: `ServicesView.vue`'s own upcoming/past split
(`src/views/ServicesView.vue:229-249`) is plain `new Date()` + zero-padded string construction, the
exact pattern this phase should reuse for consistency rather than introducing the app's first date
library for one feature.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Plain browser-local date math (recommended) | Denormalize `orgTimezone` onto `RehearseAccessDoc` + port `todayInTimeZone` client-side | More "correct" for a volunteer traveling across timezones from their church, but adds a schema field + a `markAsPlanned` call-site change for a benefit that's imperceptible for weekly Sunday services; `ServicesView.vue` itself doesn't bother with org tz either |
| A `collectionGroup('rehearseAccess')` query (recommended, required) | A client-side fan-out: read the volunteer's own `users/{uid}` doc for a list of orgIds they've ever been emailed by, then query each org's subcollection | Requires inventing a NEW denormalized "which orgs know this email" record with its own write-path and staleness risk; `collectionGroup` + array-contains is the documented, zero-extra-state Firestore pattern for exactly this shape and was flagged as the preferred choice in 125-RESEARCH.md Open Question #1 |
| A build-safe literal-path route push (recommended) | A named route (`router.push({ name: 'volunteer-service' })`) pointing at a real Phase-127 component | Both need SOME route registered before Phase 127 lands; a named route requires that name to exist in the router config today (fine either way) — the actual hazard CONTEXT.md warns about is a lazy `import()` of a component file that doesn't exist on disk yet, not the route name itself. Either naming approach works as long as the component target exists (see Pattern 4) |

**Installation:** None required — no `npm install` needed for this phase.

**Version verification:** `firebase@12.0.0` and `vue-router@5.0.3` confirmed directly from
`package.json` [VERIFIED: package.json read 2026-09-06]. `collectionGroup()`/`where()`/`orderBy()`
are long-stable modular Firestore SDK exports, unchanged across this version range — no
version-specific gotchas.

## Package Legitimacy Audit

**No new packages are introduced by this phase.** Every capability (collection-group queries,
Vue Router, plain `Intl`/`Date`) ships in already-installed dependencies. The Package Legitimacy
Gate is not applicable.

## Architecture Patterns

### System Architecture Diagram

```
 Volunteer's browser (/my-schedule, Phase 126)
 ┌──────────────────────────────────────────────────────────────────────┐
 │ 1. onMounted: read auth.currentUser.email, lowercase it               │
 │ 2. myEmailLower = email.toLowerCase()                                 │
 └───────────────────────────────┬───────────────────────────────────────┘
                                  │ 3. collectionGroup query
                                  ▼
 ┌──────────────────────────────────────────────────────────────────────┐
 │ query(                                                                 │
 │   collectionGroup(db, 'rehearseAccess'),                              │
 │   where('assignedEmailsLower', 'array-contains', myEmailLower),       │
 │   orderBy('serviceDate', 'asc')                                       │
 │ )                                                                      │
 └───────────────────────────────┬───────────────────────────────────────┘
                                  │ 4. Firestore evaluates, PER candidate doc:
                                  │    isOrgMember(orgId)                     <- false (volunteer)
                                  │    || ( isSignedIn()                      <- true
                                  │      && email != null                     <- true
                                  │      && email_verified == true            <- true (magic link)
                                  │      && parentIsPlanned(serviceId)        <- get() on sibling
                                  │           services/{serviceId} doc        <- per-doc extra read
                                  │      && myEmailLower in                   <- satisfied BY the
                                  │           assignedEmailsLower )              query's own filter
                                  ▼
 ┌──────────────────────────────────────────────────────────────────────┐
 │ Firestore: organizations/{orgId}/rehearseAccess/{serviceId} docs      │
 │   (COLLECTION_GROUP index required: assignedEmailsLower CONTAINS      │
 │    + serviceDate ASC — firestore.indexes.json, deploy required)       │
 │ Returns: every Planned service, across every org, this email serves   │
 └───────────────────────────────┬───────────────────────────────────────┘
                                  │ 5. Client groups/derives (pure functions, no I/O)
                                  ▼
 ┌──────────────────────────────────────────────────────────────────────┐
 │ groupMySchedule(docs, now) -> { thisWeek[], laterThisMonth[], past[] }│
 │ readinessOf(songs) -> 'ready' | 'partial' | 'waiting'                 │
 │ countdownLabel(serviceDate, now) -> 'Today' | 'Tomorrow' | 'In N days'│
 │ rolesFor(doc, myEmailLower) -> doc.rolesByEmailLower[myEmailLower]    │
 └───────────────────────────────┬───────────────────────────────────────┘
                                  │ 6. render cards; click "Rehearse →"
                                  ▼
 ┌──────────────────────────────────────────────────────────────────────┐
 │ router.push({ path: `/volunteer/service/${serviceId}` })              │
 │   -> resolves to a THIN placeholder view this phase (126) registers   │
 │      (or a Phase-127 view once that phase lands and replaces it)      │
 └──────────────────────────────────────────────────────────────────────┘

 ── separately, unchanged from Phase 125, extended this phase ──
 Editor's browser: markAsPlanned() -> buildRehearseAccess(service, orgId, quarters, roles, people,
   songs) -> NOW also computes rolesByEmailLower (mirrors functions/src/serviceRoles.ts's
   roleNamesByPerson map) -> setDoc(rehearseAccess/{serviceId})
```

### Recommended Project Structure
```
src/
├── router/index.ts                 # ADD: /my-schedule (MyScheduleView), a THIN placeholder
│                                    #   /volunteer/service/:serviceId route (Phase 127 replaces
│                                    #   the component only — path/name stay stable)
├── views/
│   └── MyScheduleView.vue           # NEW — top bar, greeting, sections, cards, empty state
│   └── VolunteerServicePlaceholderView.vue  # NEW, minimal — "Rehearse view coming soon" (build-safety)
├── stores/
│   └── mySchedule.ts (or extend volunteerAuth.ts) # NEW — collectionGroup query, onSnapshot/getDocs
├── utils/
│   ├── rehearseAccess.ts            # EDIT — buildRehearseAccess() gains rolesByEmailLower
│   ├── myScheduleGrouping.ts        # NEW — pure: groupMySchedule(), countdownLabel(), readinessOf()
│   └── roleChipIcon.ts              # NEW — pure: keyword-match role name -> StageKindIcon glyph name
firestore.indexes.json               # ADD: rehearseAccess COLLECTION_GROUP composite index
src/rules.test.ts                    # ADD: constrained-list test(s) for R378 (see Common Pitfall #1)
src/utils/rehearseAccess.test.ts     # EDIT — extend for rolesByEmailLower
src/utils/myScheduleGrouping.test.ts # NEW — grouping/countdown/readiness unit tests
```

### Pattern 1: Collection-group array-contains list query (the R378 core mechanism)
**What:** Find every `rehearseAccess` doc across every org where the signed-in volunteer's own
lowercased email is in `assignedEmailsLower`.
**When to use:** The sole My Schedule data query.
**Example:**
```typescript
// Source: firebase.google.com/docs/firestore/query-data/queries (collectionGroup, official) +
// firestore.rules:277-313 (this repo, real lines) — the rule this query must satisfy
import { collectionGroup, query, where, orderBy, getDocs } from 'firebase/firestore'
import { db } from '@/firebase'
import { auth } from '@/firebase'

const myEmailLower = auth.currentUser!.email!.toLowerCase()
const q = query(
  collectionGroup(db, 'rehearseAccess'),
  where('assignedEmailsLower', 'array-contains', myEmailLower),
  orderBy('serviceDate', 'asc'),
)
const snap = await getDocs(q)
// snap.docs[].data() -> RehearseAccessDoc; snap.docs[].ref.parent.parent!.id -> orgId
// (needed if you don't trust the doc's own orgId field for the Rehearse route)
```
Firestore's rule engine proves this query is compliant WITHOUT fetching every document first:
`resource.data.get('assignedEmailsLower', [])` in the rule (`firestore.rules:305`) is exactly
covered by this query's `array-contains` filter on the identical field and value — the same
"equality filter on any field a list rule reads from resource.data" requirement already documented
inline at `firestore.rules:430-432` for the `shareTokens` collection's own get/list split. The
rule's `parentIsPlanned()` `get()`/`exists()` call and its `isOrgMember`/`email_verified` checks
are evaluated per-candidate-document at extra read cost — officially supported, not a workaround.

### Pattern 2: The composite index this query requires
**What:** `array-contains` + `orderBy` on a different field always needs a manual composite index;
because the query spans every org, it must be `COLLECTION_GROUP`-scoped, not the default
`COLLECTION` scope.
**Example:**
```json
// Source: firestore.indexes.json (this repo — currently "indexes": []) +
// cloud.google.com/firestore/docs/query-data/indexing (official — arrayConfig/queryScope shape)
{
  "indexes": [
    {
      "collectionGroup": "rehearseAccess",
      "queryScope": "COLLECTION_GROUP",
      "fields": [
        { "fieldPath": "assignedEmailsLower", "arrayConfig": "CONTAINS" },
        { "fieldPath": "serviceDate", "order": "ASCENDING" }
      ]
    }
  ]
}
```
Must be deployed (`firebase deploy --only firestore:indexes`) before the query works in
production/staging — an undeployed index makes the query fail with `FAILED_PRECONDITION: The query
requires an index` (the emulator will also complain, but the Firestore emulator auto-builds
indexes declared in this file when `firebase emulators:start`/`emulators:exec` runs, so
`npm run test:rules` will exercise the real index shape once this entry exists).

### Pattern 3: Grouping, countdown, and readiness — pure functions, no date library
**What:** Bucket the sorted-by-date results into This week / Later this month / Past, using plain
browser-local time (matches `ServicesView.vue`'s own existing convention — see Summary for the org
timezone caveat).
**Example:**
```typescript
// Source: src/views/ServicesView.vue:229-249 (this repo, real lines) — the exact
// zero-padded date-string idiom this phase should reuse, extended for "this week"
export function todayYmd(now: Date = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// "This week" = today through the coming Saturday inclusive (per 126-UI-SPEC.md §3).
export function endOfThisWeekYmd(now: Date = new Date()): string {
  const daysUntilSaturday = 6 - now.getDay() // getDay(): 0=Sun..6=Sat
  const end = new Date(now)
  end.setDate(now.getDate() + daysUntilSaturday)
  return todayYmd(end)
}

export function groupMySchedule(docs: RehearseAccessDoc[], now: Date = new Date()) {
  const today = todayYmd(now)
  const weekEnd = endOfThisWeekYmd(now)
  const upcoming = docs.filter((d) => d.serviceDate >= today).sort((a, b) => a.serviceDate.localeCompare(b.serviceDate))
  const past = docs.filter((d) => d.serviceDate < today).sort((a, b) => b.serviceDate.localeCompare(a.serviceDate))
  return {
    thisWeek: upcoming.filter((d) => d.serviceDate <= weekEnd),
    laterThisMonth: upcoming.filter((d) => d.serviceDate > weekEnd),
    past,
    nextUpId: upcoming[0]?.serviceId ?? null,
  }
}
```
Readiness (per song, `song.attachments.some(a => a.kind === 'pdf' || a.kind === 'mp3')`) and the
countdown-label boundary table (Today/Tomorrow/In N days, Yesterday/N days ago/Last week/N weeks
ago) are both pure functions of already-fetched data — no additional query. Write both as small,
independently-unit-testable functions in `myScheduleGrouping.ts` per the UI-SPEC's exact boundary
values (§Copywriting Contract) — the UI-SPEC itself flags the 7/14-day boundaries as needing a
held-out test, not just a visual read.

### Pattern 4: Build-safe forward routing to Phase 127 (R382)
**What:** Register a real route today, pointed at a real (minimal) component, so `vite build`
never sees an `import()` to a nonexistent file; Phase 127 swaps only the component.
**Example:**
```typescript
// Source: src/router/index.ts:154-172 (this repo, real lines) — the existing
// isVolunteerRoute idiom this new route reuses verbatim
{
  path: '/volunteer/service/:serviceId',
  name: 'volunteer-service',
  // Phase 126: a minimal placeholder. Phase 127 REPLACES this import target
  // only — path/name/meta stay stable so this phase's router.push calls
  // never need to change.
  component: () => import('../views/VolunteerServicePlaceholderView.vue'),
  meta: { requiresAuth: true, isVolunteerRoute: true },
},
```
```typescript
// In MyScheduleView.vue / a card component — literal path push, not a
// name lookup, so a stale build (126 shipped, 127 not yet) still resolves
// to the placeholder rather than a router "no match" warning:
router.push({ path: `/volunteer/service/${doc.serviceId}` })
```
The placeholder view is a few lines — reuse `VolunteerLinkCompleteView.vue`'s spinner-or-message
shell idiom ("This service's Rehearse view is coming soon" + a link back to `/my-schedule`) so it
never dead-ends the volunteer.

### Anti-Patterns to Avoid
- **Scoping the query to a single known org:** a magic-link volunteer has no `orgId` claim
  (Phase 125's entire premise) — there is no "current org" to scope a subcollection query to. The
  query MUST be `collectionGroup`, never `collection(db, 'organizations', orgId, 'rehearseAccess')`.
- **Assuming an unfiltered `list()` test result generalizes to a constrained one:** the existing
  `src/rules.test.ts:2816` DENY-on-unfiltered-list test proves enumeration is blocked; it says
  nothing about whether a correctly `array-contains`-filtered list succeeds. Do not skip writing
  the new constrained-list test on the assumption "list already works, we tested it."
- **A new `dayjs`/`date-fns` dependency for grouping:** unnecessary — the app has never used a date
  library and `ServicesView.vue`'s plain-string idiom already does everything this phase needs.
- **Reusing `VolunteerSignInView.vue`'s `displayLabel` computed verbatim for the greeting:** it
  returns `"Dana R."` (first name + last initial) for a two-word name, not first-name-only. The
  UI-SPEC's mock wants `"Good morning, Dana"`. Extract `name.split(/\s+/)[0]` directly for the
  greeting rather than reusing `displayLabel`'s output as-is (see Common Pitfall #5).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| "Which orgs is this email a volunteer for" | A new denormalized `volunteerOrgMemberships` lookup collection, written at lock/assignment time | A `collectionGroup('rehearseAccess')` + `array-contains` query | Firestore already supports this exact pattern natively (proven precedent: `shareTokens`'s get/list split, Pattern 1) — a new lookup collection would duplicate state that can drift, and add its own write-path/staleness class of bug this phase doesn't need |
| Per-email role breakdown for chips | A new client-side re-derivation of role assignments from scratch | Port `functions/src/serviceRoles.ts`'s `roleNamesByPerson` map-building loop into `buildRehearseAccess()` (client already imports `resolveServiceRoleAssignments`) | The identical problem ("which roles does person X hold on this service") was already solved for the reminder email's `{{their_roles}}` token — same input data, same output shape, just a different consumer and a different package |
| Date/timezone grouping | A new `dayjs`/`date-fns` dependency, or porting the Cloud Function's `Intl.DateTimeFormat` timezone helper client-side by default | Plain `new Date()` + zero-padded strings, matching `ServicesView.vue`'s own existing convention | The app has zero date-library dependencies today; org-timezone correctness is a real but low-stakes edge case for a weekly single-church schedule, not worth the first cross-cutting date dependency for one feature |
| Countdown/readiness copy | Ad-hoc inline template conditionals scattered across the card component | Small, pure, independently-unit-tested functions (`countdownLabel`, `readinessOf`) in `myScheduleGrouping.ts` | The UI-SPEC's own boundary-value table (Today/Tomorrow/2-6 days/7+ days, and the past-side mirror) has enough edge cases (exactly 7, exactly 14 days) that inline logic will silently drift from spec without a held-out test |

**Key insight:** Every non-trivial-looking problem in this phase ("find my services across orgs I
don't know about," "what roles do I hold") already has an exact-shape precedent shipped elsewhere
in this codebase (Phase 125's `shareTokens` get/list split; the Cloud Functions package's
`serviceRoles.ts`). The research risk here is recognizing and porting those precedents, not
inventing new mechanisms.

## Common Pitfalls

### Pitfall 1: A constrained collectionGroup list query is unproven, not proven, in this codebase
**What goes wrong:** A plan or reviewer assumes "the R377 rule already passed rules tests, so the
list query is safe" and ships without writing a new test — then discovers in emulator/production
that the query is denied or (worse) silently returns zero results, because some detail (missing
`.lower()`, a stray extra `where`, the `arrayConfig` index type) doesn't match what Firestore's
list-rule evaluator requires.
**Why it happens:** All nine existing R377 tests (`src/rules.test.ts:2702-2827`) use `getDoc()` by
known document id. None exercises `getDocs(query(collectionGroup(...), where('assignedEmailsLower',
'array-contains', ...)))`. "The rule is tested" is true for `get`, not yet true for the specific
`list` shape My Schedule needs.
**How to avoid:** Write and pass, in Wave 0: (a) ALLOW — a volunteer's constrained
`collectionGroup` `array-contains` list returns exactly their assigned Planned services across two
different orgs; (b) DENY/empty-result — the same query for an email with zero assignments returns
an empty snapshot, not an error (proves R383's empty state is reachable); (c) confirm the emulator
actually builds the composite index from `firestore.indexes.json` (it does, automatically, when
declared before `firebase emulators:start`/`emulators:exec` — but only if the entry exists).
**Warning signs:** A "works when I open it manually with a known id" claim without ever running
`getDocs()` against the real collectionGroup query in an emulator test.

### Pitfall 2: The magic-link volunteer's email in the ID token may not already be lowercase
**What goes wrong:** The client builds the query filter from `auth.currentUser.email` without
`.toLowerCase()`. If the account's stored email casing differs even slightly from how
`assignedEmailsLower` was normalized (always lowercase, per Phase 125's `buildRehearseAccess`), the
`array-contains` filter value won't match any document, and the volunteer sees an empty schedule —
indistinguishable from "you have no assignments" (R383's empty state fires for the wrong reason).
**Why it happens:** Firebase Auth preserves whatever casing the email was originally provided in;
`assignedEmailsLower` is always pre-lowercased at write time (`rehearseAccess.ts:83`).
**How to avoid:** Always call `.toLowerCase()` on `auth.currentUser.email` before building the
query filter — mirrors the exact normalization Phase 125 already applies on both the write side
(`buildRehearseAccess`) and the rule side (`request.auth.token.email.lower()`,
`firestore.rules:305`). Write a test with a mixed-case sign-in email against a lowercase-stored
assignment to prove the match still succeeds (mirrors 125-RESEARCH.md's own Pitfall 5).

### Pitfall 3: "Volunteer's own role chips" needs a NEW field — it does not exist in the projection today
**What goes wrong:** A plan assumes `assignedEmailsLower` (a flat array) already carries
"per-email role" information and tries to read role names off it directly — it can't, it's just a
list of email strings with no structure.
**Why it happens:** The field name and the "You're on: {role chips}" UI requirement look adjacent
but the current schema genuinely has no per-person breakdown (confirmed by direct read of
`RehearseAccessDoc` — `rehearseAccess.ts:30-38`).
**How to avoid:** Extend `buildRehearseAccess()` to also emit `rolesByEmailLower:
Record<string, string[]>`, built the same way `resolveMessageRecipients()` already builds
`roleNamesByPerson` in `functions/src/serviceRoles.ts:124-131` — iterate
`resolveServiceRoleAssignments()`'s output, and for each `effectivePersonId`, push `roleName` into
that person's (then that person's lowercased email's) role array. Add a unit test to
`rehearseAccess.test.ts` proving a person holding two roles on one service gets both role names in
their array, and a person with no email is skipped from the map (mirrors the existing
empty-email-skip test already there for `assignedEmailsLower`).

### Pitfall 4: Grouping "This week" needs a day-of-week/timezone decision — the app doesn't currently make one client-side
**What goes wrong:** A plan assumes org-timezone-aware "today" (per the UI-SPEC/CONTEXT framing of
"existing org tz handling, v1.7 messaging") is a trivial reuse — but the ONLY existing
implementation (`todayInTimeZone`, `functions/src/index.ts:1879`) lives in the Cloud Functions
package, is never called from `src/`, and — separately — a volunteer's Firestore rules grant no
read access to `organizations/{orgId}` at all, so there is no data source to read the org's
timezone from even if the utility were ported client-side.
**Why it happens:** "The app already handles org timezones" is true for one narrow server-side
purpose (the day-of-reminder check) and was over-generalized in the Context/UI-SPEC's framing.
**How to avoid:** Default to plain browser-local date math (Pattern 3), matching
`ServicesView.vue`'s own existing convention exactly — this is the pragmatic, lowest-risk, already
established-in-this-codebase choice. If the planner wants org-tz precision instead, it requires: (1)
denormalizing `orgTimezone: string` onto `RehearseAccessDoc` at lock time (pulled from
`authStore.settings.timezone` inside `markAsPlanned`, since the editor DOES have org read access at
write time), and (2) porting `todayInTimeZone`'s `Intl.DateTimeFormat` one-liner into `src/utils/`.
Either choice is acceptable; silently assuming org-tz "just works" without picking one is not.
**Warning signs:** Code that reads `authStore.settings.timezone` from inside a My-Schedule
component or store — a volunteer session's `authStore.settings` will be null/undefined (no org
context loaded), so this would silently no-op or throw, not "gracefully use the org's timezone."

### Pitfall 5: `VolunteerSignInView.vue`'s `displayLabel` computed is NOT a first-name extractor
**What goes wrong:** The UI-SPEC recommends reusing `displayLabel` verbatim for the "Good morning,
{firstName}" greeting; for a two-word display name it actually returns `"Dana R."` (first name +
last-initial), not `"Dana"` alone — so the greeting would render "Good morning, Dana R." instead of
the mock's "Good morning, Dana."
**Why it happens:** `displayLabel` (`VolunteerSignInView.vue:108-118`) was purpose-built for the
user-chip label (where "Dana R." is the right amount of identifying detail), not for a greeting
sentence.
**How to avoid:** Extract just `name.split(/\s+/)[0]` (or reuse `displayLabel`'s first branch's
first token) for the greeting specifically; keep `displayLabel` as-is for anywhere the user chip
itself is reused (e.g., this phase's own top bar, per the UI-SPEC's §1).
**Warning signs:** A UAT screenshot showing "Good morning, Dana R." where the mock shows "Good
morning, Dana" is this pitfall, not a copy typo.

## Code Examples

### Extending buildRehearseAccess with rolesByEmailLower
```typescript
// Source: src/utils/rehearseAccess.ts (this repo, existing function to extend) +
// functions/src/serviceRoles.ts:118-131 (this repo, the roleNamesByPerson precedent to mirror)
export interface RehearseAccessDoc {
  serviceId: string
  orgId: string
  serviceDate: string
  title: string
  status: string
  assignedEmailsLower: string[]
  rolesByEmailLower: Record<string, string[]>  // NEW
  songs: RehearseSong[]
}

// Inside buildRehearseAccess(), alongside the existing assignedEmailsLower loop:
const rolesByEmailLower: Record<string, string[]> = {}
for (const a of assignments) {
  for (const pid of a.effectivePersonIds) {
    const person = peopleById.get(pid)
    if (!person || person.email === '') continue
    const emailLower = person.email.toLowerCase()
    ;(rolesByEmailLower[emailLower] ??= []).push(a.roleName)
  }
}
```

### Readiness derivation (pure, matches UI-SPEC §6 exactly)
```typescript
// Source: 126-UI-SPEC.md §6 (Readiness indicator — three states)
export type Readiness = { state: 'ready' | 'partial' | 'waiting'; missingCount: number }

export function readinessOf(songs: RehearseSong[]): Readiness {
  const hasMedia = (s: RehearseSong) => s.attachments.some((a) => a.kind === 'pdf' || a.kind === 'mp3')
  const readyCount = songs.filter(hasMedia).length
  if (songs.length === 0 || readyCount === 0) return { state: 'waiting', missingCount: songs.length }
  if (readyCount === songs.length) return { state: 'ready', missingCount: 0 }
  return { state: 'partial', missingCount: songs.length - readyCount }
}
```

### Rules test pattern for the new constrained-list guarantee (R378)
```typescript
// Source: src/rules.test.ts (existing pattern, real file) — extends the R377
// describe block's seeded fixtures with a SECOND org so cross-org aggregation is provable
describe('My Schedule — constrained collectionGroup list (R378)', () => {
  it('ALLOWS a volunteer to list their assigned rehearseAccess docs across two orgs via array-contains', async () => {
    const context = testEnv.authenticatedContext('volUid', { email: 'Dana@Example.com', email_verified: true })
    const db = context.firestore()
    const q = query(
      collectionGroup(db, 'rehearseAccess'),
      where('assignedEmailsLower', 'array-contains', 'dana@example.com'),
      orderBy('serviceDate', 'asc'),
    )
    const snap = await assertSucceeds(getDocs(q))
    expect(snap.docs.map((d) => d.id).sort()).toEqual(['svc1', 'svcOrgB'].sort())
  })

  it('an unassigned email\'s constrained list returns an empty snapshot, not an error', async () => { /* ... */ })
  it('DENIES the same volunteer from seeing a Draft service via the constrained list (parentIsPlanned live check)', async () => { /* ... */ })
})
```

## State of the Art

No deprecations or version-drift risk identified. `collectionGroup()` queries and array-contains-based
list security rules are long-stable Firestore features (collection group queries shipped 2019,
list-rule query constraints shortly after) — nothing about this phase's approach is version-fragile
within the installed `firebase@12.0.0` range.

**Deprecated/outdated:** None applicable to this phase's stack.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | A properly `array-contains`-constrained `collectionGroup` list query against the existing Phase 125 rule succeeds without any `firestore.rules` change | Summary, Architecture Patterns Pattern 1, Common Pitfall #1 | This is the phase's single highest-risk assumption — grounded in a well-documented, officially-supported Firestore mechanism and an exact in-repo precedent (`shareTokens`' comment at `firestore.rules:430-432`), but genuinely UNPROVEN in this codebase until the Wave-0 test in Common Pitfall #1 passes. If wrong, the fallback is adding an explicit `allow list: if ...` clause mirroring `shareTokens`' get/list split, or (last resort) a denormalized per-volunteer lookup doc — both are small, contained fixes, not a redesign |
| A2 | Browser-local date math (not org-timezone-aware) is an acceptable choice for This-week/Later-this-month grouping and countdown copy | Summary, Common Pitfall #4, Don't Hand-Roll | Low risk in practice (weekly single-church services, a few-hour timezone skew rarely crosses a day/week boundary) but is a genuine, owner-confirmable product decision, not a purely technical one — flagged for discuss-phase/planner confirmation rather than silently decided |
| A3 | Adding time/venue/call-time fields to `Service`/`OrgSettings` is out of scope for this phase (omit gracefully per UI-SPEC, do not extend the data model) | Summary, Don't Hand-Roll | If the owner actually wants these fields modeled now rather than deferred, this is a `Service`/`OrgSettings` schema change with migration implications well beyond "extend a projection" — worth an explicit go/no-go before planning, not assumed |
| A4 | `firestore.indexes.json`'s `arrayConfig: "CONTAINS"` is the correct field name (vs. `order`) for an array-contains field inside a composite index definition | Architecture Patterns Pattern 2 | If the exact key name has drifted from what training data + partial web search confirmed, `firebase deploy --only firestore:indexes` will simply reject the file with a clear schema error at deploy time — low risk, self-correcting, not a silent failure |

**If this table is empty:** N/A — see entries above. None block planning; A1 is the one that must
be closed with a real test before this phase can be called done, not before it can be planned.

## Open Questions

1. **Should `rolesByEmailLower` be added to the R377 rules test suite's fixture shape, or is it
   purely additive/non-security-relevant?**
   - What we know: the field carries only role *names* (already PII-safe per the existing
     `RehearseAccessDoc` precedent — role names are not personally identifying beyond what
     `assignedEmailsLower` already reveals about who serves).
   - What's unclear: whether the plan-checker or a reviewer will want an explicit test proving
     `rolesByEmailLower` is scoped correctly (e.g., doesn't leak OTHER assigned volunteers' roles
     to a viewer whose own email only maps to one key of the record).
   - Recommendation: Keep it purely additive to the read the volunteer ALREADY has (the whole doc
     is already visible to any one assigned volunteer, per the existing R377 grant — `songs[]`
     already shows what every assigned person will rehearse). A volunteer seeing the FULL
     `rolesByEmailLower` map (all assigned emails' roles, not just their own) is a mild widening
     of exposure beyond "my own roles" but is consistent with the existing grant shape (the doc is
     document-level, not field-level, access) — flag for discuss-phase/plan-check confirmation
     rather than silently deciding to filter it client-side (which would be security theater, not
     a real boundary, since the whole doc is already readable).

2. **Exact route path/name for the Rehearse target** (`/volunteer/service/:serviceId` vs.
   `/rehearse/:serviceId`) — CONTEXT.md explicitly leaves this to the planner. No research risk;
   either is fine as long as Pattern 4's placeholder-component approach is followed.

3. **Whether "the volunteer is a member in one org AND assigned as a volunteer in another"
   (Phase 125's stated cross-surface possibility) needs special handling on My Schedule** — e.g.,
   does an org-member's own org services (where they're also personally assigned) show up in My
   Schedule alongside a DIFFERENT org's volunteer assignments? The `collectionGroup` query as
   designed handles this correctly by construction (it's identity-scoped, not org-scoped), so no
   special-casing should be needed — flagged only so the planner doesn't accidentally add
   org-exclusion logic that isn't wanted.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Firestore emulator | Rules/list-query testing (Common Pitfall #1's Wave-0 test) | ✓ (`firebase.json`, port 8080) | — | — |
| Firestore emulator's automatic composite-index build from `firestore.indexes.json` | Testing the new collection-group index locally before deploy | ✓ (documented emulator behavior — builds declared indexes on `emulators:start`/`emulators:exec`) | — | — |
| Production composite index deploy (`firebase deploy --only firestore:indexes`) | R378 working in production | **Not yet done** — the index doesn't exist in `firestore.indexes.json` yet, must be added THIS phase and deployed | — | None — a hard blocker for production My Schedule until deployed; per CLAUDE.md, any new composite index must be added to `firestore.indexes.json` and its deploy noted in owner steps |

**Missing dependencies with no fallback:**
- The `firestore.indexes.json` entry + its production deploy — must be added and deployed before
  My Schedule works outside the emulator.

**Missing dependencies with fallback:**
- None — everything else needed is already running/installed in this repo.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest `^4.0.18` (app) / rules suite via `@firebase/rules-unit-testing` against `firebase emulators:exec` [VERIFIED: package.json] |
| Config file | `vitest.rules.config.ts` (rules), root `vite.config.ts`/vitest config (app) |
| Quick run command | `npx vitest run --config vitest.rules.config.ts` (against an already-running emulator) for rules-only iteration; `npx vitest run` (bare, per CLAUDE.md) for app-level unit tests |
| Full suite command | `npm run test:rules` (starts its own emulator) + `npx vitest run` (app suite) + `npm run type-check` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| R378 | Constrained `collectionGroup` array-contains list succeeds; cross-org aggregation works; unassigned email returns empty, not an error | integration (Firestore emulator, rules-unit-testing) | `npm run test:rules` | ❌ Wave 0 — extend `src/rules.test.ts` (Common Pitfall #1) |
| R379 | Draft-service exclusion via the live `parentIsPlanned()` check reachable through the LIST path (not just `getDoc`) | integration | `npm run test:rules` | ❌ Wave 0 — one new case in the same describe block |
| R380 | `groupMySchedule`/`countdownLabel` boundary values (This week cutoff, exactly 7/14 days) | unit | `npx vitest run src/utils/myScheduleGrouping.test.ts` | ❌ Wave 0 |
| R381 | `readinessOf` three-state derivation; `buildRehearseAccess`'s new `rolesByEmailLower` map (multi-role person, no-email person skipped) | unit | `npx vitest run src/utils/rehearseAccess.test.ts src/utils/myScheduleGrouping.test.ts` | ❌ Wave 0 (extend existing `rehearseAccess.test.ts`, new grouping file) |
| R382 | Rehearse CTA navigates to the registered placeholder route without a router "no match" warning; `vite build` succeeds with the new route registered | unit (router) + build check | `npx vitest run` (a router test) + `npm run build` | ❌ Wave 0 for the router test; build check is a manual gate |
| R383 | Empty state renders when the constrained query returns zero docs; "check a different email" affordance reachable | unit (component) | `npx vitest run src/views/__tests__/MyScheduleView.test.ts` (new) | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --config vitest.rules.config.ts` for any `firestore.rules`/
  `firestore.indexes.json` change; `npx vitest run` for any store/util/component change.
- **Per wave merge:** `npm run test:rules` (fresh emulator, exercises the real index) + `npx vitest
  run` + `npm run type-check`.
- **Phase gate:** Full suite green (baseline: exactly `src/storage.rules.test.ts` failing, per
  CLAUDE.md — no new failures) + `npm run build` succeeds (proves the Phase-127 forward route is
  build-safe) before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `src/rules.test.ts` — add `describe('My Schedule — constrained collectionGroup list (R378)')`
      with the ALLOW/empty/DENY cases in Common Pitfall #1 and Code Examples
- [ ] `firestore.indexes.json` — add the `rehearseAccess` COLLECTION_GROUP composite index (Pattern 2)
- [ ] `src/utils/rehearseAccess.test.ts` — extend for `rolesByEmailLower` (multi-role, no-email-skip)
- [ ] `src/utils/myScheduleGrouping.test.ts` — new file: grouping boundary, countdown boundary,
      readiness three-state tests
- [ ] `src/views/__tests__/MyScheduleView.test.ts` — new file: empty state, populated state, "check
      a different email" affordance
- [ ] A router test proving `/volunteer/service/:serviceId` resolves to the placeholder without a
      route-not-found warning (extend an existing router test file, or a new one)
- [ ] Framework install: none — all frameworks already present

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (inherited, not re-verified) | Firebase Auth email-link session from Phase 125 — this phase adds no new auth surface |
| V3 Session Management | yes (inherited) | Existing `onAuthStateChanged`/`logout()` — no change |
| V4 Access Control | yes (this phase's core extension of R377) | The `collectionGroup` list query must be provably scoped by the existing `firestore.rules` rule — no NEW rule is introduced, but a NEW query SHAPE against that rule must be proven safe (Common Pitfall #1) before this phase can be considered done |
| V5 Input Validation | yes | The query's `array-contains` value must be the CURRENT user's own lowercased token email, never a client-suppliable parameter — a UI that let a volunteer type an arbitrary email into the query filter (rather than always using `auth.currentUser.email`) would be an access-control bypass attempt vector, even though the rule itself would still deny a mismatched value (defense-in-depth: don't build the attack surface even if the rule blocks it) |
| V6 Cryptography | n/a | No new cryptographic primitive |
| V13 API and Web Service | n/a | No new Cloud Function or public endpoint — pure client-side Firestore query against existing rules |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| A crafted query filter value (not the signed-in user's own email) attempting to read another volunteer's schedule | Elevation of Privilege / Information Disclosure | Firestore's rule evaluates `request.auth.token.email.lower()` (the REAL signed-in identity from the ID token, not a client-suppliable field) against `resource.data.assignedEmailsLower` — a query filtered on someone else's email would return zero results even if the malicious client bypassed the app's own UI, because the rule's per-document check still requires the TOKEN's own email to match, not the query's filter value in isolation |
| Cross-org enumeration via the new collectionGroup query returning docs the volunteer isn't assigned to | Information Disclosure | The array-contains constraint is mandatory for the query to be provably compliant — an unfiltered or under-filtered `collectionGroup` list attempt fails exactly as `src/rules.test.ts:2816`'s existing unfiltered-list test already proves for the single-org case; the collection-group scope doesn't weaken this, since the rule is evaluated identically per-document regardless of which org's subcollection it's nested under |
| Over-broad exposure via `rolesByEmailLower` showing every assigned volunteer's roles, not just the requester's own | Information Disclosure (minor, pre-existing pattern) | Document-level (not field-level) Firestore rules already grant the FULL doc, including `songs[]` and all attachment URLs, to any one assigned volunteer — `rolesByEmailLower` is a strictly smaller disclosure (role names only) than what's already granted; flagged in Open Questions for an explicit accept-as-is confirmation, not silently introduced as a new leak class |

## Sources

### Primary (HIGH confidence)
- `firestore.rules` (this repo, read 2026-09-06) — the `rehearseAccess` match block (lines 262-313),
  `isOrgMember`/`isOrgEditor` helpers, the `shareTokens` get/list split and its inline
  "Firestore requires an equality filter..." comment (lines 412-450), the org-scoped catch-all
  (lines 375-390)
- `src/rules.test.ts` (this repo, read 2026-09-06) — all nine existing R377 tests (lines 2702-2827),
  confirming `getDoc`-only coverage and the one unfiltered-list DENY test
- `src/utils/rehearseAccess.ts` (this repo, read 2026-09-06) — the current `RehearseAccessDoc`
  schema and `buildRehearseAccess()` implementation to extend
- `src/stores/services.ts` (this repo, read 2026-09-06, lines 577-640) — `markAsPlanned`'s exact
  call site and its currently-available inputs (no `OrgSettings` pulled today)
- `firestore.indexes.json` (this repo, read 2026-09-06) — confirmed currently empty `indexes: []`
- `src/types/service.ts` (this repo, read 2026-09-06) — confirmed `Service` has no time/venue field
- `src/types/organization.ts` (this repo, read 2026-09-06) — confirmed `OrgSettings.timezone` exists
  but is only referenced in `auth.ts`/`SettingsView.vue`, never client-queried by a non-member
- `functions/src/index.ts` (this repo, read 2026-09-06, lines 1879-1886) — `todayInTimeZone()`,
  the only existing timezone-aware "today" helper, Cloud-Functions-only
- `functions/src/serviceRoles.ts` (this repo, read 2026-09-06, lines 68-159) — the
  `roleNamesByPerson`/`resolveMessageRecipients` precedent `rolesByEmailLower` should mirror
- `src/utils/serviceRoles.ts` (this repo, read 2026-09-06) — the client-side
  `resolveServiceRoleAssignments()` already imported by `buildRehearseAccess`
- `src/views/ServicesView.vue` (this repo, read 2026-09-06, lines 215-334) — the existing
  browser-local date-grouping convention this phase should match
- `src/router/index.ts` (this repo, read 2026-09-06, lines 140-240) — existing volunteer route
  registrations and the `isVolunteerRoute` org-selection-gate exemption
- `src/views/VolunteerSignInView.vue` (this repo, read 2026-09-06) — `displayLabel`/`initials`
  computeds and the avatar/sign-out UI to reuse (and the greeting-extraction caveat, Pitfall 5)
- `src/stores/volunteerAuth.ts` (this repo, read 2026-09-06) — `signOut()`, email-link completion
  shape
- `src/types/roster.ts` (this repo, read 2026-09-06) — `Person.email`/`Role.name` field shapes
- `.planning/phases/125-.../125-RESEARCH.md`, `125-SUMMARY.md`, `125-02-SUMMARY.md` (this repo,
  read 2026-09-06) — the shipped Phase 125 mechanism, schema, and Open Question #1 flagging this
  phase's collection-group index need
- [firebase.google.com/docs/firestore/security/rules-query](https://firebase.google.com/docs/firestore/security/rules-query) — official docs on query-constraint-based list rule evaluation (array-contains/`in` patterns)
- [cloud.google.com/firestore/docs/query-data/indexing](https://cloud.google.com/firestore/docs/query-data/indexing) — official composite/collection-group index JSON shape

### Secondary (MEDIUM confidence)
- `.planning/CONTEXT.md` sections, `126-CONTEXT.md`, `126-UI-SPEC.md`, `REQUIREMENTS.md`,
  `STATE.md` (this repo, owner-authored/generated planning artifacts, read 2026-09-06) — locked
  decisions, requirement text, milestone framing
- WebSearch results confirming the Firestore list-rule array-contains pattern and the
  `firestore.indexes.json` collection-group composite index shape (queried 2026-09-06; the exact
  `arrayConfig: "CONTAINS"` key name for an array-contains field within a composite index is
  carried from training knowledge cross-checked against, but not verbatim-confirmed by, the search
  results — see Assumption A4)

### Tertiary (LOW confidence)
- None used for load-bearing claims in this document.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; every capability already installed and already used
  in this exact codebase for adjacent purposes.
- Architecture: HIGH for the mechanism (grounded in the codebase's own `shareTokens` precedent and
  official Firestore docs), MEDIUM for the specific untested query shape (Assumption A1) until the
  Wave-0 test in Common Pitfall #1 is written and passes.
- Pitfalls: HIGH — all five pitfalls are grounded in specific, cited lines of this repo's existing
  code (rules test coverage gaps, the `displayLabel` computed's actual return shape, `Service`'s
  actual field list, the Cloud-Functions-only `todayInTimeZone`), not hypothetical risks.

**Research date:** 2026-09-06
**Valid until:** 30 days (stable Firestore/Vue Router APIs; re-verify only if `firebase` is
upgraded across a major version, or if Phase 125's `rehearseAccess` schema changes before this
phase executes)
