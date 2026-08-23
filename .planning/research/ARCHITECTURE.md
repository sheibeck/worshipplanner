# Architecture Patterns

**Domain:** Per-org worship configurability + hardening/cleanup integration (v2.2)
**Researched:** 2026-08-23

## Recommended Architecture

v2.2 is **pure integration work on an existing, mature architecture** — no new architectural layer,
no new Firebase service. Every one of the five asks slots into a pattern the codebase already uses
at least once. The job is: (1) reuse the `organizations/{orgId}/roles` subcollection pattern for a
new `teams` subcollection, (2) tighten one `firestore.rules` clause to the exact idiom already used
three times (`orgSlugs`, `orgNames`, `shareTokens`), (3) copy `deleteQuarter`'s share-revocation
block into `deleteService`, (4) add a client-only guard in one drawer component, (5) dedupe a
constant that is already correctly defined in one place and wrongly re-declared in six others.

```
organizations/{orgId}
  .settings                     OrgSettings doc field — aiEnabled, pcEnabled, vwModeEnabled,
                                 defaultServiceTemplate, bibleVersion, slideTypography, messaging,
                                 timezone. NOT where the new team list goes (see below).
  /roles/{roleId}                existing subcollection — CRUD via stores/roster.ts,
                                 seeded via seedDefaultRolesIfEmpty() called from RosterView.vue
                                 on first mount. Rules: falls through the generic per-org
                                 wildcard (isOrgEditor read+write). <- exact precedent for teams
  /teams/{teamId}                NEW subcollection, same shape of precedent as /roles
  /services/{serviceId}          service.teams: string[] (denormalized team NAMES, unaffected
                                 by the new subcollection's existence — no migration needed)
  /invites/{email}               existing, org-scoped, editor-only (already correctly gated)

inviteLookup/{email}             TOP-LEVEL collection (org-agnostic key), 1:1 shadow of the
                                 org-scoped invite above, used for O(1) email->org lookup at
                                 sign-in. THIS is the rules change target (§2 below).

shareTokens/{token}              service.id      + = the 3 collections deleteQuarter already
serviceShares/{slug}__service-*  service.date    |   revokes on quarter delete; deleteService
serviceShareLinks/{serviceId}    service.id      + = must revoke the same 3 (§3 below)
```

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `src/types/team.ts` (NEW) | `Team` shape: `{ id, name, order, songTagFilter?: string, allowsFreeTextName?: boolean }`. `DEFAULT_TEAMS` seed array (mirrors `DEFAULT_ROLES` in `roster.ts`) | `stores/teams.ts` |
| `stores/teams.ts` (NEW) | `onSnapshot` subscribe to `organizations/{orgId}/teams`; `addTeam`/`updateTeam`/`deleteTeam`; `seedDefaultTeamsIfEmpty()` (verbatim structural mirror of `roster.ts`'s `seedDefaultRolesIfEmpty`) | Firestore `organizations/{orgId}/teams`; consumed by `ServiceEditorView.vue`, `NewServiceDialog.vue`, a new Settings teams panel |
| Settings "Teams" panel (NEW, mirrors the existing Roles editor UI in `RosterView.vue`) | CRUD UI for team name + optional song-tag filter + optional "allows free-text service name" flag | `stores/teams.ts` |
| `ServiceEditorView.vue` (MODIFIED) | Reads `teamsStore.teams` instead of the local `AVAILABLE_TEAMS` const (line 1675); replaces the two hardcoded Orchestra-filter blocks (lines 3426-3429, 3537-3540) with one helper that reads each selected team's `songTagFilter` | `stores/teams.ts` (new dependency); `stores/songs.ts` (unchanged) |
| `NewServiceDialog.vue` (MODIFIED) | Reads `teamsStore.teams` instead of the local `availableTeams` const (line 145); **deletes** `sundayOrdinal()` (line 148) and the two ordinal-based auto-select blocks (lines 170-201) — B1 drop, no replacement | `stores/teams.ts` (new dependency) |
| `ServiceCard.vue` (MODIFIED, minor) | The `'Special'` free-text-name special-case (line ~87) generalizes to "does the service's team set include any team with `allowsFreeTextName`" | `stores/teams.ts` |
| `src/types/song.ts` (UNCHANGED, becomes the single source) | `VW_TYPE_LABELS` already lives here correctly | `ShareView.vue`, `SongSlideOver.vue`, `BatchQuickAssign.vue`, `VwExplainer.vue`, `SettingsView.vue`, `claudeApi.ts` (all MODIFIED to import instead of re-declare) |
| `firestore.rules` `inviteLookup` block (MODIFIED) | `allow create` narrowed from `isSignedIn()` to `isOrgEditor(request.resource.data.orgId)`, mirroring `orgSlugs`/`orgNames`/`shareTokens` | Firestore rules engine only — no client code change required (see §2) |
| `stores/services.ts` `deleteService` (MODIFIED) | Revoke `shareTokens` + `serviceShares` + `serviceShareLinks` before/with the service doc delete — same 3 docs `deleteQuarter` already revokes, addressed differently (service has a direct-keyed `serviceShareLinks/{serviceId}` identity doc; quarter has a denormalized `quarter.shareToken` field) | Firestore `shareTokens`, `serviceShares`, `serviceShareLinks` — all already `allow delete: if isOrgEditor(...)`, no rules change |
| `EditSlideDrawer.vue` (MODIFIED) | Add `renderState` awareness: when the active entry's slide carries `renderState === 'pending'` (`src/types/slide.ts`), disable/warn on per-entry customization (label/notes/body/audio/background) instead of silently accepting edits that vanish on pending→ready | No new store; reads a field (`renderState`) the slide type already carries but the drawer never inspects today |

### Data Flow

**Configurable Teams (1):** `stores/teams.ts` subscribes to `organizations/{orgId}/teams`
exactly like `stores/roster.ts` subscribes to `.../roles` — same lifecycle (subscribe on org
context load, unsubscribe on org switch, per the CLAUDE.md org-switch cache-clearing fix).
`ServiceEditorView.vue`/`NewServiceDialog.vue` read `teamsStore.teams` reactively instead of a
module-level const array, so a Settings-panel edit to the team list is live everywhere without a
reload. The per-team `songTagFilter` field flows: team selected on service → helper looks up that
team's `songTagFilter` in `teamsStore.teams` → filters `songStore`'s song list by `tags.includes(filter)`
— a straight generalization of the existing `isOrchestraService ? base.filter(s => s.tags.includes('Orchestra')) : base` inline logic, replacing the hardcoded string with the configured one (or no filtering if the team has none set).

**inviteLookup gate (2):** No data-flow change. `TeamView.vue`'s `onInvite()` already writes
`{ orgId, role, invitedAt }` into `inviteLookup/{email}` inside the SAME `writeBatch` as the
`organizations/{orgId}/invites/{email}` doc — `orgId` is already present on the payload today, so
`request.resource.data.orgId` is available to the tightened rule with zero client-code change. The
only OTHER writer of `inviteLookup` is `assignOrgAdmin` (Cloud Function, Admin SDK) — Admin SDK
writes bypass `firestore.rules` entirely, so that path is unaffected by this change and needs no
functions redeploy.

**deleteService revocation (3):** `deleteQuarter`'s pattern (`stores/quarters.ts:460-483`) is:
read `quarter.shareToken` (denormalized on the doc) → if present, delete `shareTokens/{token}` →
compute the deterministic `quarterShares/{slug}__q{N}-{year}` key from the org's slug → delete it
if present → delete the quarter doc. `deleteService` needs the SAME 3-collection cleanup but the
service side has no denormalized token field on the service doc itself — instead
`serviceShareLinks/{serviceId}` (keyed directly by serviceId, written by `ensureShareLink`) IS the
identity doc holding `{ token, orgId, serviceId }`. So the mirrored sequence is: read
`serviceShareLinks/{serviceId}` → if it exists, delete `shareTokens/{that token}` and delete
`serviceShareLinks/{serviceId}` itself → compute `serviceShares/{slug}__service-{service.date}` from
the org's slug + the service's own `date` field (exact key `writeSharePayload` already uses at
`services.ts:629`) → delete it if present → then delete the service doc. All three collections
already have `allow delete: if isOrgEditor(resource.data.orgId)` — **zero rules change**, per the
carry-forward note in `PENDING-VERIFICATION.md` C5.

**Pending-slide guard (4):** No new data flow — `slide.ts`'s `renderState?: 'pending' | 'failed'`
already exists on the entry the drawer edits; the drawer's `sourceKind === 'imported'` branch
(where a PPTX-render entry surfaces) simply never reads it today. Adding the check is a pure
UI-layer read of a field already streamed down via the assembled slideshow prop.

## Patterns to Follow

### Pattern 1: Per-org subcollection with lazy "seed defaults if empty" (roles → teams)
**What:** A per-org configurable list is its own top-level subcollection
(`organizations/{orgId}/teams`), not a field on `OrgSettings`. `OrgSettings` is reserved for
single-valued/nested-object settings (toggles, one template array, one font choice); anything that
is itself a growing/editable **list of records with CRUD, ordering, and per-item fields** (roles
today, teams tomorrow) gets a subcollection.
**When:** Any new per-org configurable list.
**Example (existing, `stores/roster.ts`):**
```ts
export const DEFAULT_ROLES: Array<Omit<Role, 'id'>> = [
  { name: 'guitar', group: 'band', defaultCount: 1, order: 0 },
  // ...
]

async function seedDefaultRolesIfEmpty(): Promise<void> {
  if (!orgId.value) return
  if (roles.value.length !== 0) return   // idempotent — no-op once anything exists
  for (const role of DEFAULT_ROLES) {
    await addDoc(collection(db, 'organizations', orgId.value, 'roles'), {
      ...role, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    })
  }
}
```
`RosterView.vue` calls `seedDefaultRolesIfEmpty()` once on mount after roles have had a chance to
load. A new `stores/teams.ts` + `seedDefaultTeamsIfEmpty()` is a structural copy of this, called
from wherever the Settings teams panel (or `ServiceEditorView`/`NewServiceDialog`, whichever mounts
first for a given org) first needs the list. **No server-side (Cloud Functions) seeding needed** —
note that `functions/src/orgTemplateSeed.ts` (the v2.0 onboarding seed) hand-mirrors `OrgSettings` +
the suggested template for brand-new orgs, but deliberately does NOT seed roles server-side; roles
seed lazily client-side regardless of org age. Teams should follow the SAME simpler precedent, not
the onboarding-seed one — avoids touching `functions/` or `orgProvisioning.ts` at all for this
feature.

### Pattern 2: Rules gate mirrors an established create-only idiom (orgSlugs/orgNames/shareTokens → inviteLookup)
**What:** `allow create: if isOrgEditor(request.resource.data.orgId)`, unaffected read/update/delete.
**When:** A top-level, org-agnostic-keyed collection whose only legitimate writer is an editor of the
org named in its own payload.
**Example (existing, `firestore.rules:539-543`):**
```
match /orgSlugs/{slug} {
  allow read: if true;
  allow create: if isOrgEditor(request.resource.data.orgId);
  allow update, delete: if false;
}
```
Apply the identical `create` clause to `inviteLookup` (read/delete stay exactly as they are today —
self-read-by-email and self-or-editor-delete are both still correct and untouched):
```
match /inviteLookup/{email} {
  allow read: if isSignedIn() && request.auth.token.email.lower() == email;
  allow create: if isOrgEditor(request.resource.data.orgId);   // was isSignedIn()
  allow delete: if isSignedIn() && (
    request.auth.token.email.lower() == email ||
    isOrgEditor(resource.data.orgId)
  );
}
```

### Pattern 3: Store-level cascade revocation on delete (deleteQuarter → deleteService)
**What:** Before/alongside deleting the primary doc, delete every derived public-share artifact the
entity minted, scoped by `isOrgEditor` on each artifact's own `orgId` — never a Cloud Function, this
runs entirely in the client store (Firestore rules already authorize it, no Admin SDK bypass
needed).
**When:** Any entity that mints a public share link must revoke it on delete.
**Example (existing, `stores/quarters.ts:460-483`, shown in full in Data Flow above)** — `deleteService`
in `stores/services.ts` copies this shape, substituting the `serviceShareLinks/{serviceId}`
direct-key lookup for `quarter.shareToken`'s denormalized field, and the
`serviceShares/{slug}__service-${service.date}` key for `quarterShares`'s
`${slug}__q${N}-${year}` key.

### Pattern 4: Single-source constant import (VW_TYPE_LABELS)
**What:** `src/types/song.ts` already exports the canonical `VW_TYPE_LABELS: Record<VWType, string>`.
Six other files re-declare the same three string literals locally instead of importing it:
`ShareView.vue`, `SongSlideOver.vue`, `BatchQuickAssign.vue`, `VwExplainer.vue`, `SettingsView.vue`,
`claudeApi.ts` (`src/utils/songSearch.ts` already imports it correctly — proof the pattern works
once wired).
**When:** Immediately, as the cross-cutting prerequisite the seed itself names ("duplication is the
real liability... whatever gets configured, step one is collapsing each rule to a single source").
Zero behavior change, pure refactor — do this FIRST so no other v2.2 work touches a file that still
has a stale local copy.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Folding the team list into `OrgSettings.settings`
**What:** Adding `settings.teams: Team[]` as a new `OrgSettings` field instead of a subcollection.
**Why bad:** `OrgSettings` already carries a documented, deliberately-flat contract
(`organization.ts`'s own JSDoc: "nothing else" beyond one field per phase) merged once at
`auth.ts::loadOrgContext` under `DEFAULT_ORG_SETTINGS` — every consumer reads it as a plain,
already-defaulted value with no further `?? default` anywhere. A growing, independently-CRUD'd list
of records with per-item `order`/id churn does not fit that single-document-merge contract, and
would force `DEFAULT_ORG_SETTINGS` to special-case an array of objects rather than a scalar/small
nested object like every existing field.
**Instead:** A subcollection, per Pattern 1 — this is exactly why roles are already NOT part of
`OrgSettings` despite `OrgSettings` existing.

### Anti-Pattern 2: A dedicated `firestore.rules` block for `teams`
**What:** Writing an explicit `match /organizations/{orgId}/teams/{teamId} { allow read, write: if
isOrgEditor(orgId); }` block.
**Why bad:** Unnecessary — `roles` has NO dedicated block today and needs none; both fall through
the generic `match /{collection}/{docId}` wildcard at the bottom of the per-org rules
(`firestore.rules:458-464`), which already grants `isOrgEditor` read+write to any single-segment
nested collection except the three explicitly excluded (`services`, `slideGroups`, `pptxRenders`).
Adding a redundant explicit block for `teams` is dead weight that could silently diverge from the
wildcard over time.
**Instead:** Add nothing to `firestore.rules` for the teams feature. Confirm this in the rules test
suite with one new ALLOW/DENY pair exercising `organizations/{orgId}/teams/{docId}` through the
wildcard, the same way `roles` is (or should be) covered.

### Anti-Pattern 3: "Fixing" the pending-slide gap by pairing entries on the render index
**What:** Trying to reattach a pending slide's customization to its eventual rendered counterpart by
positional/index matching once the render flips `pending → ready`.
**Why bad:** Already tried and rejected — per `PENDING-VERIFICATION.md` C4, "Not fixable by index
pairing (would mis-attach)": a PPTX render can add/remove/reorder slides between the placeholder
count and the final rendered count, so there is no reliable correspondence to re-pair against.
**Instead:** Disable or warn on customization of a slide whose `renderState === 'pending'` in
`EditSlideDrawer.vue`, so the UI never invites an edit it will silently discard — this is the
owner-endorsed direction in the same carry-forward entry.

### Anti-Pattern 4: Making `deleteService`'s revocation a Cloud Function
**What:** Routing the 3-collection share cleanup through a new `onCall`/`onDocumentDeleted` Cloud
Function instead of the existing client store method.
**Why bad:** `deleteQuarter` (the direct precedent) does this entirely client-side with no Function
involved, and `PENDING-VERIFICATION.md` C5 explicitly notes "`allow delete` rules already in place,
no rules change needed" — the existing `isOrgEditor`-gated delete rules on all three collections
already authorize exactly this client-side sequence. Introducing a Function adds a deploy
dependency and an Admin-SDK code path for something the client can already do safely and atomically
enough (a same-session sequence of deletes, same risk profile as `deleteQuarter` already ships in
production).
**Instead:** Mirror `deleteQuarter` verbatim — client-only, ships with the rest of the app bundle,
no `firebase deploy --only functions` needed for this piece.

## Scalability Considerations

Not a scaling milestone — no new collection is queried in an unbounded way, no new function adds
cold-start surface, and team lists are small (a handful of rows per org, same order of magnitude as
roles). The one thing worth flagging: `deleteService`'s revocation adds up to 3 extra
`getDoc`/`deleteDoc` round-trips to an already-multi-step delete, mirroring `deleteQuarter`'s
existing cost — negligible at this app's per-org document counts (services numbering in the
hundreds, not millions).

## Build Order (dependency-aware)

1. **VW_TYPE_LABELS dedup (Pattern 4)** — zero-risk, zero-dependency, touches 6 files. Do this
   first so nothing built afterward inherits a stale local copy. **Client-only.**
2. **Configurable Teams (1)** — `types/team.ts` → `stores/teams.ts` (+ `seedDefaultTeamsIfEmpty`) →
   Settings teams panel (mirrors the Roles editor UI) → `ServiceEditorView.vue` +
   `NewServiceDialog.vue` + `ServiceCard.vue` consume the store instead of their local consts →
   generalize the Orchestra filter to read each team's `songTagFilter` → delete
   `sundayOrdinal()`/the ordinal auto-select blocks (B1). Internally ordered: type → store → UI
   editor → consumers, because the two hardcoded-array call sites can't be replaced until the store
   exists to replace them with. **Client-only** — confirmed no rules change needed (falls through
   the existing wildcard, Anti-Pattern 2).
3. **`inviteLookup` rules gate (2)** — independent of everything else; can run in parallel with
   step 2. Add the rules-test ALLOW/DENY pair (editor-of-target-org create allowed;
   non-editor/wrong-org create denied) against the existing `TeamView.vue` write path (no client
   code change required — confirmed `orgId` is already on the payload). **Rules-only,
   deploy-hand-over**: ships built + tested + UNDEPLOYED per the standing deploy discipline;
   hand the owner `firebase deploy --only firestore:rules`.
4. **`deleteService` revocation (3)** — independent; can run in parallel with 2/3. Copy
   `deleteQuarter`'s shape into `stores/services.ts`'s `deleteService`, substituting the
   `serviceShareLinks/{serviceId}` direct lookup and the `serviceShares` date-keyed lookup as
   described in Data Flow. **Client-only** — no rules change (delete rules already permit it).
5. **Pending-slide guard (4)** — independent; smallest, most isolated change, touches only
   `EditSlideDrawer.vue`. **Client-only.**

Steps 2-5 have no cross-dependencies on each other and can be sequenced in any order or built in
parallel; step 1 should land before step 2 only because step 2's new Settings panel is a natural
place to also import the now-deduped `VW_TYPE_LABELS` if the panel surfaces VW-related copy, and
because touching `SettingsView.vue` twice (once for dedup, once for teams) in the same phase is
cheaper done together.

## Deploy-Hand-Over Summary

| Change | Surface | Deploy needed? |
|---|---|---|
| VW_TYPE_LABELS dedup | `src/` only | No — client bundle only |
| Configurable Teams (list + tag filter + drop ordinal rule) | `src/` only (new subcollection covered by existing wildcard rule) | No — client bundle only |
| `inviteLookup` create gate | `firestore.rules` | **Yes** — `firebase deploy --only firestore:rules`, owner hand-over per standing deploy discipline |
| `deleteService` share revocation | `src/` only (existing delete rules already permit it) | No — client bundle only |
| Pending-slide (`renderState`) guard | `src/` only | No — client bundle only |

Only ONE of the five v2.2 architectural changes touches `firestore.rules`. It is small (one `allow
create` clause, mirroring an idiom already deployed three times), independently testable against
the emulator, and independent of every other change in this milestone — it can ship in its own
plan/phase without blocking or being blocked by the Teams work.

## Sources

- `C:\projects\worshipplanner\.planning\seeds\SEED-002-church-specific-rules-configurability.md`
  (HIGH — owner-authored catalog with exact file:line references, 2026-08-23)
- `C:\projects\worshipplanner\.planning\PENDING-VERIFICATION.md` C2/C4/C5 (HIGH — carried-forward,
  owner-reviewed findings)
- Direct source inspection (HIGH — read against the live repo, 2026-08-23):
  `src/types/roster.ts`, `src/stores/roster.ts`, `src/views/RosterView.vue`,
  `firestore.rules` (lines 1-100, 380-465, 534-556), `src/types/organization.ts`,
  `functions/src/orgTemplateSeed.ts`, `functions/src/orgProvisioning.ts`,
  `src/views/TeamView.vue`, `src/stores/quarters.ts` (`deleteQuarter`),
  `src/stores/services.ts` (`deleteService`, `ensureShareLink`, `writeSharePayload`),
  `src/components/slides/EditSlideDrawer.vue`, `src/types/slide.ts`, `src/types/song.ts`,
  `src/views/ServiceEditorView.vue`, `src/components/NewServiceDialog.vue`
