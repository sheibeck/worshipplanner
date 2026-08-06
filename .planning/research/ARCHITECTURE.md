# Architecture Research — v1.5 "Settings, Sharing, and Fidelity"

**Domain:** Subsequent-milestone integration research (Vue 3 + Firebase worship-planning app)
**Researched:** 2026-08-06
**Confidence:** HIGH — every claim below is grounded in a file/line read during this research pass, not
inferred from PROJECT.md's prose alone. Where PROJECT.md's recorded milestone decision conflicts with
what the code actually does, that conflict is called out explicitly rather than silently resolved.

## Existing Architecture (confirmed by reading, not re-researched)

- Vue 3 SFCs + TypeScript, Pinia stores (`defineStore` with `ref`/`computed`, not the options API),
  most stores hold a live Firestore `onSnapshot` subscription (`services.ts`, `auth.ts`'s member
  listener, `importedSlides.ts`).
- Firestore rooted at `organizations/{orgId}/...`. The org document itself (`organizations/{orgId}`)
  carries loose, untyped fields today — `name`, `slug`, `pcAppId`, `pcSecret`, `vwModeEnabled` — read via
  ad hoc `getDoc`/`orgData.<field> as <type>` casts in `src/stores/auth.ts:104-109`. **There is no
  `Organization` TypeScript type anywhere in `src/types/`** (confirmed by glob — no match).
- `organizations/{orgId}/services/{docId}` is the service document; **every write to it is confined to
  `src/stores/services.ts`** — confirmed by grepping the whole `src/` tree for the org/services doc path:
  the only non-test hit is `services.ts` itself (`src/rules.test.ts` is the only other hit, and it's a
  rules test). No view, component, or other store ever calls `updateDoc`/`setDoc`/`addDoc` on a service
  doc directly; every mutation goes through one of the store's exported functions.
- Sharing: `shareTokens/{token}` (opaque, public-read) and `serviceShares/{slug}__service-{date}`
  (memorable URL, public-read) both carry a frozen `serviceSnapshot` built once, at share time, in
  `services.ts`'s `createShareToken` (`src/stores/services.ts:353-441`).
- Firebase Storage under `orgs/{orgId}/...`, gated by `storage.rules`'s cross-service
  `firestore.exists(.../members/$(uid))` check (both the `media/**` and generic `orgs/{orgId}/{allPaths=**}`
  blocks — `storage.rules:17-44`).
- Cloud Functions (`functions/src/index.ts`) proxy ESV and Anthropic through one `onRequest` handler
  (`export const api`, lines 56-129), keyed by a `PROXY_TARGETS` map (`planningcenter`/`anthropic`/`esv`).
- `pptx-render` (Cloud Run, `render-service/`) writes PNGs to Storage; `organizations/{orgId}/pptxRenders/{importId}`
  tracks status (`pending`/`ready`/`failed`) — this collection is written server-side only
  (`functions/src/index.ts:149-437`) and is invisible to `src/` (confirmed: `src/` has zero references
  to `pptxRenders`; only `renderImportId` — a foreign key toward it — appears in `src/types/importedDeck.ts`).
- Slide groups (`organizations/{orgId}/slideGroups/{slotId}`, doc id = the anchoring `ServiceSlot.id`)
  are materialized from the service order by `src/utils/slideGroupMaterializer.ts` and consumed by
  `src/utils/slideshowAssembler.ts` / `src/composables/useSlideshowAssembly.ts`.
- `src/views/SettingsView.vue` mirror-writes single fields onto the org doc (`vwModeEnabled`, `pcAppId`,
  `pcSecret`, `slug`, `name`) and then re-assigns the matching `authStore.<field>` ref directly —
  **the org doc is not live-synced**; `loadOrgContext` (`auth.ts:82-139`) reads it once per session, and
  every setting's "of record" value lives in `useAuthStore()`'s refs, kept in sync only by each save
  handler's own mirror-write. This is a documented, deliberate pattern ("Pitfall 2" per in-code
  comments at `SettingsView.vue:315` and `auth.ts:42-46`), not an oversight — v1.5 should extend it,
  not replace it.

## 1. Org settings expansion

**Current pattern does not scale to ~8 settings as bare top-level fields — but the fix is additive, not
a rewrite.** `vwModeEnabled` works today because it is one boolean with one obvious default (`true`).
Eight settings (AI toggle, PC toggle, Bible version, default service template, font family/weight/size)
span three shapes — booleans, an enum, and a structured object (a whole slot-array template) — and each
needs its own "missing field on a legacy org doc" default. Continuing to add bare top-level fields would
mean eight separate `(orgData.x as T) ?? default` lines duplicated across `auth.ts`'s two reset sites
(`loadOrgContext`'s no-org branch, `logout`) plus every settings-page save handler.

**Recommendation: a typed `settings` sub-object on the org document, with one defaults module.**

- Add `src/types/organization.ts` — the first `Organization` type this codebase has ever had. Define an
  `OrgSettings` interface (`aiEnabled: boolean`, `pcEnabled: boolean`, `bibleVersion: 'ESV' | 'NLT'`,
  `defaultServiceTemplate: ServiceSlot[] | null`, `slideFont: { family: string; weight: number; size: number } | null`)
  and export a single `DEFAULT_ORG_SETTINGS: OrgSettings` constant — mirroring `buildSlots`'s role as
  "the one place a default service structure is defined" (`src/utils/slotTypes.ts:249-295`).
- Store it as ONE nested field, `organizations/{orgId}.settings`, not eight top-level fields and not a
  subcollection. A subcollection is unwarranted here: nothing about these values is queried
  independently, unbounded in count, or written by a different actor than the org doc's other fields —
  a subcollection would only buy an extra round trip. A single object also lets `updateDoc` use one
  dot-path write per changed key (`{ 'settings.aiEnabled': false }`), matching the existing
  `roleAssignmentOverrides.${roleId}` scoped-write precedent in `services.ts:332-335` that this
  codebase already uses specifically to avoid concurrent-editor clobbering.
- **Defaults live in code, read at every consumption site, never backfilled into Firestore.** This is
  the existing `vwModeEnabled` convention (`?? true` in three places in `auth.ts`) generalized: merge
  `DEFAULT_ORG_SETTINGS` under whatever `orgData.settings` returns (`{ ...DEFAULT_ORG_SETTINGS, ...(orgData.settings ?? {}) }`)
  in `loadOrgContext`, so a legacy org doc with no `settings` key at all, or one missing just the newest
  field (e.g. `slideFont` added in a later phase within this same milestone), is never an error and
  never needs a migration script. Firestore's schemalessness is precisely what makes this safe — every
  other field in this codebase already relies on it (`orgData.pcAppId as string ?? null`, etc).
- **Where the merged value lives:** `useAuthStore()`, exactly like `vwModeEnabled` today — add
  `orgSettings = ref<OrgSettings>(DEFAULT_ORG_SETTINGS)` beside the existing individual refs (do not
  migrate `vwModeEnabled` itself; that field already ships and works, and folding it into `settings`
  mid-milestone is pure churn with no functional benefit). Every new toggle follows `onToggleVwMode`'s
  exact shape (`SettingsView.vue:474-494`): `updateDoc` the dot-path, then reassign the store's local
  copy — never rely on a live subscription firing.
- **Migration story:** none needed beyond the merge-with-defaults read above. No script, no Cloud
  Function backfill, no `settings: {}` write-on-read. This is a direct consequence of Firestore's
  document model plus the org doc's existing "read once per session, mirror-write on save" pattern —
  the same reason `vwModeEnabled` never needed one.
- **Build-order implication:** the `OrgSettings` type + defaults module + `auth.ts` merge-and-load logic
  is a hard prerequisite for every other v1.5 settings feature (AI toggle, PC toggle, Bible version,
  template, font). It should be the first phase of this milestone's settings work — every later phase
  that adds a toggle is then a small, mechanical addition (new key in the interface, new default, new
  Settings UI control, new consumption-site read), not infrastructure work.

## 2. Share link rework

### The write-path enumeration (exhaustive, verified by grep)

Grepping `src/` for the literal Firestore path `organizations/{orgId}/services` returns exactly two
files: `src/stores/services.ts` (the implementation) and `src/rules.test.ts` (a rules test, not a write
path). **No view or component writes to a service document directly.** Within `services.ts`, every
function that issues a Firestore write to a service doc is:

1. `createService` — `addDoc` (services.ts:139-154)
2. `updateService` — the generic `updateDoc`, called by `ServiceEditorView.vue` at three sites
   (lines 1944, 3446, 3651 — slot/section reindex saves, the sermon-passage/notes autosave, and the
   Planning Center export-status write) plus internally by `assignSongToSlot`/`clearSongFromSlot`
   (services.ts:264-308)
3. `markAsPlanned` — its own `updateDoc` (services.ts:226-234)
4. `reopenService` — its own `updateDoc` (services.ts:247-253)
5. `setRoleOverride` — its own scoped dot-path `updateDoc` (services.ts:316-336)
6. `clearRoleOverride` — its own scoped dot-path `updateDoc` via `deleteField()` (services.ts:340-351)
7. `deleteService` — `deleteDoc` (services.ts:259-262; irrelevant to snapshot staleness, only to token
   cleanup — see below)

This means a **client-side refresh hook is exhaustively achievable for every write to the service
document itself**, by centralizing the refresh call at the tail of functions 1–6 (all defined in the
same store closure, so this is a few call sites, not "every UI call site" — the earlier finding that all
service-doc writes fund through six functions is what makes client-side refresh tractable, not merely
convenient).

**However, this does NOT cover every way "what the share link shows" can go stale.** The frozen
snapshot's `roleAssignments` are resolved by `resolveServiceRoleAssignments(service, quarters, roles)`
(`services.ts:381`), which reads the **`quarters` store** — a volunteer's schedule assignment can change
via `src/stores/quarters.ts`'s own writes (e.g. `assignPerson`) **without touching the service document
at all**. A pure "hook into `services.ts`'s six write functions" fix corrects exactly the root cause
PROJECT.md names (a role *override*, which does live on the service doc via
`roleAssignmentOverrides`), but does not generalize to a schedule change made from the Schedule/Quarter
screen for a person who is NOT overridden on this specific service. **Flag this as a real, unresolved
gap** — the milestone's decision text ("refresh the snapshot automatically whenever the service
changes") is most naturally read as scoped to the service document, matching what's achievable
client-side; whether schedule-only changes should also trigger a refresh is a product question the
roadmapper should resolve explicitly rather than let slide by omission.

### Client-side refresh vs. a Firestore `onWrite` trigger

**Recommendation: client-side, not a Cloud Function trigger.** The trade-offs, concretely:

- **Latency/cost:** a trigger fires on every write to every service doc, including services that were
  never shared — it would need its own read of the doc to discover whether a `shareToken` is even
  present before doing anything, on every save of every service in the org. A client-side hook already
  has the answer in the reactive `Service` object it just wrote (`service.shareToken`), so it can skip
  entirely when unshared, at zero extra read cost. A trigger also adds real latency (cold start plus a
  round trip) before the refreshed link is live; client-side, the refresh completes before the save
  operation's promise resolves.
- **The `roleAssignments` re-resolution problem is the deciding factor.** `createShareToken` resolves
  role assignments using `resolveServiceRoleAssignments` (`src/utils/serviceRoles.ts`), fed by the
  **client's already-subscribed** `rosterStore`/`quartersStore` state (`services.ts:378-381`). A Cloud
  Function trigger would have to re-implement or import this same algorithm server-side against
  `functions/src/` — a **separate TypeScript project with no code-sharing mechanism to `src/`** (no
  shared package, no path alias crossing the boundary — confirmed by directory structure). That is not
  a small port: the algorithm folds in the roster's frequency tiers, must-serve-with pairing, and
  per-role override precedence (per `PROJECT.md`'s Phase 15 requirement text). Maintaining two
  implementations of this logic is exactly the kind of drift that reintroduces "stale role overrides,"
  just at a new seam, and this codebase has explicit institutional memory of that failure class
  (`STATE.md` T-13/T-17 precedents referenced in `services.ts`'s own comments). Client-side reuses the
  **one** existing implementation.
- **Deployment dependency:** the infra already exists (`requestPptxRender`'s `onDocumentCreated` trigger
  is a working precedent for this codebase), so this is not a blocking cost — it's simply not needed
  here given the algorithm-duplication problem above.

**Concretely:** extract `createShareToken`'s snapshot-building block (`services.ts:359-399`) into a
private `buildServiceSnapshot(service, orgId)` helper, call it both from the (renamed) "ensure share
token" flow and from a new `refreshShareSnapshot(serviceId)` invoked at the tail of `updateService`,
`markAsPlanned`, `reopenService`, `setRoleOverride`, and `clearRoleOverride` — guarded by "does this
service have a persisted token" so the common unshared case costs nothing extra.

### The "persist the token on the service doc" decision conflicts with the R036 draft-lock guard —flag loudly

PROJECT.md's milestone decision reads: *"Persist the token on the service doc — minted once, never
rotated."* Read literally, this means writing a `shareToken` field via `services.ts`'s existing
`updateService`. **That collides directly with the R036 draft-only write guard already shipped in this
codebase (Phase 31).** `updateService`'s `assertWritable` (`services.ts:197-203`) throws
`ServiceLockedError` for any write to a non-draft service unless the payload matches exactly one of
three enumerated shapes: ordinary draft editing, the Planning-Center export carve-out
(`EXPORT_WRITE_KEYS`), or the reopen carve-out (`hasOnly(['status','updatedAt'])`). `firestore.rules`'
`/services/{docId}` `allow update` block (`firestore.rules:64-84`) enforces the identical three-shape
contract server-side. A bare `{ shareToken: token }` write matches **none** of the three — it would be
silently rejected by the client guard (throwing `ServiceLockedError`) or, if that guard were bypassed,
denied by Firestore itself. Since sharing a service is realistically most useful once it's `planned` (the
"communicate this to the team" moment R036 exists to protect), this is not an edge case — **it is the
common case**, and the milestone decision as literally written would not work for it.

Two ways to resolve this, both requiring an explicit choice the phase planner must make (this research
does not decide it):

1. **Add a fourth named carve-out**, mirroring the R037 reopen pattern exactly: both `assertWritable`
   and `firestore.rules`' `/services` block gain a `hasOnly(['shareToken','updatedAt'])` (or
   `hasOnly(['shareToken','sharedAt','updatedAt'])`) branch, permitted at any stored status. This keeps
   the token literally on the service doc as decided, at the cost of widening the lock's carve-out
   surface — a security-sensitive file that this codebase treats with unusual care (see the extensive
   comments throughout `services.ts` and `firestore.rules` warning against "helpfully" simplifying it).
2. **Store the token in a separate, non-lock-gated document keyed by `serviceId`** — e.g.
   `serviceShareLinks/{serviceId}: { token, orgId }` — analogous to how `slideGroups` and `shareTokens`/
   `serviceShares` already live outside the service document entirely. `ensureShareToken` reads this
   doc first; if present, reuses `.token`; otherwise mints and writes it. This never touches the service
   document or R036 at all, and needs no rules change to the security-sensitive `/services` block —
   only a new, simple rule for the new collection (public-read-by-token is unaffected; this new doc
   would be editor-read/write-scoped like `shareTokens` create today).

This research recommends option 2 as lower-risk (it doesn't touch the draft-lock's carve-out surface),
but the roadmapper should treat PROJECT.md's decision text as **not yet reconciled with the codebase's
existing lock semantics** and resolve it explicitly in the phase that implements this, rather than
discovering the `ServiceLockedError` at implementation time.

### `firestore.rules` on `shareTokens` must change regardless of which option above is chosen

Confirmed by reading `firestore.rules:181-189`: `match /shareTokens/{token} { allow read: if true; allow
create: if isSignedIn(); allow update: if false; ... }`. **`allow update: if false` blocks any snapshot
refresh via the client SDK, full stop** — the rule as it stands today only ever supports "mint once,
snapshot frozen forever," which is the opposite of what this milestone needs. This must change to permit
an org editor to update `serviceSnapshot`/`updatedAt` while keeping `orgId`/`serviceId`/`token` immutable
— directly mirroring the `serviceShares` collection's existing update rule two blocks below
(`firestore.rules:225-233`), which **already** supports exactly this "overwritten in place, org-scoped"
pattern for the memorable-URL share. `shareTokens` needs the same treatment `serviceShares` already has.

### Confirmed: no PII leak from persisting the token on (or beside) the service doc

`organizations/{orgId}/services/{docId}` reads are gated `allow read: if isOrgMember(orgId)`
(`firestore.rules:61`) — not public. Storing `shareToken` as a field there (option 1 above) or in a
new `serviceShareLinks/{serviceId}` doc scoped the same way as `shareTokens`' `create` rule (option 2)
is safe: only org members — who can already mint/view share links themselves — could read the token
value. Public/anonymous access is only ever through `shareTokens/{token}` (must already know the token)
or `serviceShares/{slug}__service-{date}` (guessable but scoped per-org), both unchanged in this regard.

## 3. Custom auth claim for org membership

### Where memberships are created/mutated today — all four sites are client-side, none is a Cloud Function

1. `src/stores/auth.ts::ensureUserDocument` — invite-acceptance branch: `batch.set(memberRef, { role, ... })`
   (`auth.ts:199-205`).
2. `src/stores/auth.ts::ensureUserDocument` — auto-create-org branch (no invite, no org): `batch.set(memberRef, { role: 'editor', ... })`
   (`auth.ts:228-234`).
3. `src/views/TeamView.vue::onToggleRole` — role change (`editor`↔`viewer`): plain `updateDoc`
   (`TeamView.vue:319-341`).
4. `src/views/TeamView.vue::onConfirmRemove` — member removal: presumably `deleteDoc` on the member doc
   (confirmed pattern from the surrounding guard logic at `TeamView.vue:345-360`; the delete call itself
   is just past the excerpt read but follows the file's established direct-client-write convention).

**No Cloud Function touches `organizations/{orgId}/members/{uid}` today** — confirmed by grep (`setCustomUserClaims`/`customClaims`/`getIdToken` appear nowhere in `src/` or `functions/src/index.ts`; the
only hits are the unrelated `render-service`/pptx research docs and `appAuth.ts`, which is the AI-proxy
auth-header helper, not a claims mechanism). This is genuinely greenfield.

### Recommended shape: a Firestore trigger, not a rewrite of the four write sites

The client SDK **cannot** call `admin.auth().setCustomUserClaims` — that requires the Admin SDK, i.e. a
Cloud Function. Rather than converting all four client write sites above into callable functions (a much
larger, riskier change touching auth flow, org creation, and team management), add one
`onDocumentWritten` trigger on `organizations/{orgId}/members/{uid}` that sets/clears the claim in
response to create/update/delete — **directly the same pattern this codebase already ships** for
`requestPptxRender` (`onDocumentCreated` on `organizations/{orgId}/pptxRenders/{importId}`,
`functions/src/index.ts:429-437`). This requires zero changes to any of the four existing write sites;
they keep writing Firestore exactly as they do today, and the trigger reacts. Claim shape:
`{ orgId: string, role: 'editor' | 'viewer' }` — a single org, matching this codebase's existing
single-org-per-user model (`auth.ts:99`, `ids[0]!` — only the first org id is ever used).

### Backfill for existing members

The trigger only fires on a **write**; existing member docs (created before this phase ships) will never
trigger it on their own. A one-time backfill is required — an Admin SDK script (run once, analogous to
how `render-service/DEPLOY.md` documents a one-time manual deploy step for this codebase) iterating the
`members` collection group and calling `setCustomUserClaims` for each doc's `uid`. This is infrastructure
work with no existing precedent in this repo to copy from directly, but the `cleanupOrphanRendersHandler`
pattern (`functions/src/index.ts:614-623`, a dry-run-by-default admin-triggered maintenance job) is the
closest structural analogue for "a script that touches every doc in a collection group once."

### The stale-token problem — a real gap that needs an explicit forced refresh

A signed-in user's ID token caches claims for up to an hour (Firebase Auth SDK default). Two concrete
moments where a stale token will cause an incorrect Storage read/write, both needing an explicit
`getIdTokenResult(true)` (or `user.getIdToken(true)`) call:

1. **Existing users, at rollout of this feature.** After the backfill script runs, every already-signed-in
   session still carries its old (claim-less, or default) token until it naturally refreshes or the app
   forces one. Insert a forced refresh once during `auth.ts`'s `onAuthStateChanged` handler
   (`auth.ts:142-157`), after `loadOrgContext` resolves — this is the natural "session just
   established/confirmed" point.
2. **A brand-new invite acceptance or org auto-creation.** `ensureUserDocument`'s two membership-writing
   branches (`auth.ts:199-205`, `228-234`) write the member doc client-side; the trigger that sets the
   claim runs **asynchronously, after** that write completes and the client has already moved on. Any
   Storage operation attempted immediately after (e.g. uploading a background image in the same
   session) can race the trigger and use a token that still has no claim. This needs either a forced
   refresh with a short retry/backoff after the batch commit, or an explicit UI wait state — call this
   out as a genuine, user-visible race the phase plan must design for, not an edge case to skip.

### `firestore.rules` should NOT move to the claim

`firestore.rules`' `isOrgMember`/`isOrgEditor` (`firestore.rules:11-18`) call `exists()`/`get()` on
Firestore *from a Firestore rule* — a **same-service** read. The
[firebase-js-sdk#6803](https://github.com/firebase/firebase-js-sdk/issues/6803) inert-in-emulator bug
CLAUDE.md documents is specific to **Storage rules calling `firestore.exists()` cross-service** — it does
not affect Firestore rules reading Firestore, which already works correctly in the emulator today (this
is exactly why `firestore.rules.test.ts`-equivalent coverage for `/services` etc. is trustworthy while
`storage.rules.test.ts` is not). Moving `firestore.rules` to the claim as well would introduce a **new**
consistency risk with no offsetting benefit: a role change via `TeamView.vue::onToggleRole` takes effect
immediately today (the rule's `get()` reads the fresh doc on every request); under a claim-based rule it
would lag until the affected user's token refreshes — reintroducing a staleness class this migration is
supposed to be eliminating, not adding elsewhere. **Scope the claim migration to `storage.rules` only.**

### Rollback path

If a claim is set incorrectly (wrong `orgId`, stale `role`), the safest rollback is at two independent
levels: (a) redeploy the previous `storage.rules` revision via `firebase deploy --only storage:rules`
(rules are versioned/instant — no data migration to undo), which restores the working
`firestore.exists()` cross-service check as a stopgap; (b) re-run the backfill/correction script for the
affected uid(s) and instruct/force a token refresh (`getIdToken(true)`) or a re-login, since a corrected
claim in Firebase Auth does not retroactively fix an already-cached client token. Keep the trigger
running in both cases — it is what keeps future writes correct once the claim values themselves are
fixed.

## 4. PPTX rendered-image display

### What exists today, and the structural gap that makes this harder than "swap the image URL"

- `PptxImportModal.vue` uploads the source `.pptx`, calls `parsePptx` (parses TEXT/IMAGE content),
  and on confirm calls `importedSlidesStore.createDeck(...)` which writes an `ImportedDeck` doc
  (`organizations/{orgId}/importedSlides/{id}`) with `slides: (TextSlide|ImageSlide)[]` — the **parsed**
  content — plus, when the source was a real `.pptx` (not an image-only import), a `renderImportId`
  field (`PptxImportModal.vue:304-307, 420-429`) that is the same id the server-side render pipeline
  uses to key `organizations/{orgId}/pptxRenders/{renderImportId}`.
- **Nothing in `src/` reads `pptxRenders` or lists the `orgs/{orgId}/pptx-imports/{importId}/rendered/`
  Storage prefix** — confirmed by the earlier grep; `renderImportId` is currently a foreign key that
  points nowhere from the client's perspective.
- The IMPORTED slot kind's slides are derived from `deck.slides` (the parsed text/image content) in
  **two independent places**, both of which must change: `slideGroupMaterializer.ts::deriveGroupEntries`'s
  `case 'IMPORTED'` (line 119-129, mints one `GroupSlideEntry` per `deck.slides[]` item, `sourceRef: {
  kind: 'imported', importId, innerSlideId }`) and `slideshowAssembler.ts`'s two IMPORTED paths — the
  fallback derivation (line 469-479, for a slot with no materialized group yet) and
  `resolveEntryContent`'s `case 'imported'` (line 186-193, which resolves a **stored** entry's
  `sourceRef.innerSlideId` back to a `deck.slides` item for a materialized group).
- **The rendered page count is structurally decoupled from `deck.slides.length`.** The `requestPptxRender`
  trigger's own doc comment is explicit about this (`functions/src/index.ts:296-304`): the PPTX parser
  (`mapAstToSlides`) skips slides with no substantial text/images and emits **one entry per image** on a
  multi-image slide, so a 6-slide deck can parse to 4 `deck.slides` entries, or more than 6. The render
  service, by contrast, produces one PNG per actual PowerPoint page (`renderedCount`, cross-checked
  against a contiguous `page-0001.png..page-{n}.png` Storage listing). **These two counts will routinely
  disagree.** Given the decision "the PNG is the slide, drawn — parsed text stays in the document but is
  never drawn," the rendered slideshow's slide *count and order* must come from the render pages, not
  from `deck.slides` — meaning the IMPORTED derivation logic needs a genuinely different code path when a
  ready render exists, not a field-level substitution inside the existing per-`deck.slides`-item loop.

### What must be built

1. **A client-side render-status/URL resolver.** New store or extension of `useImportedSlides` that,
   given an `ImportedDeck.renderImportId`, subscribes to (or fetches) `organizations/{orgId}/pptxRenders/{renderImportId}`
   and, once `status === 'ready'`, resolves download URLs for the rendered pages. Firestore rules
   already permit this read: `pptxRenders` is a single-segment subcollection under `organizations/{orgId}`,
   so it falls through to the generic `match /{collection}/{docId} { allow read: if isOrgEditor(orgId); ... }`
   catch-all (`firestore.rules:162-167`) — **no rules change needed for editors**, though note this is
   `isOrgEditor`, not `isOrgMember`: a viewer cannot read it today, which matters if viewers are ever
   expected to see rendered PPTX slides in-app. The Storage side of this (fetching the actual PNGs) is
   currently gated by the same `firestore.exists()` cross-service check as everything else under
   `orgs/{orgId}/**` — this is exactly the check Item 3 replaces, so this item benefits from Item 3
   landing first (or at minimum, both remain subject to the same emulator-untestable blind spot until
   then).
2. **A client-side page-URL builder mirroring `renderedPrefixFor`/`RENDERED_OBJECT_NAME`.** `functions/src/`
   and `src/` are separate TypeScript projects with no shared code — the 4-digit zero-padded
   `page-XXXX.png` naming convention (`functions/src/index.ts:273-282`) must be re-implemented (or
   discovered via a Storage `listAll` on the `rendered/` prefix, avoiding the padding-convention
   duplication at the cost of an extra Storage list call). Flag the duplication risk either way — if a
   future change to the render service's naming convention isn't mirrored client-side, rendered slides
   silently stop resolving, with no compiler check catching it (two separate projects, no shared types).
3. **A new/widened `AssemblyInputs` field** carrying render status+page URLs per deck (or per
   `renderImportId`), threaded into both `deriveGroupEntries`'s and `slideshowAssembler.ts`'s IMPORTED
   branches, so a ready render short-circuits the existing "one entry per `deck.slides[]` item" logic and
   instead emits one `ImageSlide`-shaped entry per rendered page.
4. **`sourceSignature`'s IMPORTED case must incorporate render status/count.** Today it's
   `${deck.slides.length}:${joined text/urls}` (`slideshowAssembler.ts:192-197`) — this governs whether an
   already-materialized `SlideGroup` gets rebuilt. Rendering is asynchronous: a user can confirm an
   import and have its group materialize (from parsed text, render still `pending`) *before* the render
   finishes. If the signature doesn't change when status flips `pending → ready`, **the existing
   rebuild-on-signature-mismatch mechanism will never notice the render became available**, and the
   group will keep showing stale parsed-text slides indefinitely. The signature must fold in render
   status/`renderedCount` so the transition is detected and triggers a rebuild through the same mechanism
   already used for every other kind.
5. **Loading/failed states.** Per the decision, the PNG is drawn — while `status === 'pending'`, the
   slide grid/presenter has nothing to draw yet (the render hasn't happened) and must fall back to
   *something* visible (most consistent with existing patterns: the parsed `deck.slides` content as a
   temporary placeholder, since it's already there and already rendered elsewhere in this codebase — or
   an explicit "rendering…" state card, mirroring `PptxImportModal.vue`'s own `parsing`/`uploading` step
   pattern). On `status === 'failed'`, the parsed text/image content is the only fallback that exists —
   this is the graceful-degradation path the "keep parsed text in the document" half of the decision is
   *for*.
6. **The presenter draws full-bleed.** `PresentationViewer.vue`'s existing slide-kind branches
   (`lyric`/`copyright`/`scripture`/... starting at line 72) are all centered text blocks with padding
   (`px-16 py-12`, `PresentationViewer.vue:70`); an `imported`-as-rendered-PNG slide needs its own branch
   that renders the image edge-to-edge (`object-contain` or `object-cover` filling the viewport, no text
   padding) — structurally different from every existing branch, not a variant of one.
7. **Not in scope for the public `ShareView.vue`.** Confirmed by reading `ShareView.vue` in full: it
   renders only text (song title/key/BPM, scripture reference, notes, who's-serving) from the frozen
   `serviceSnapshot` and has no slide/image rendering path at all today. This item is scoped to the
   authenticated Slides tab grid, Edit Slide drawer preview, and presenter — no share-view work is
   implied or needed.

## 5. Service item types (`ANNOUNCEMENTS`, `MISCELLANEOUS`, `MESSAGE` simplification)

### Compiler-caught (exhaustive `switch(slot.kind)`, no `default`) — TypeScript will refuse to compile until every new kind is handled

| Site | File:line | What breaks without a new case |
|---|---|---|
| `slotLabel` | `src/utils/slotTypes.ts:37-52` | Human-readable label per kind |
| `createSlot` | `src/utils/slotTypes.ts:58-98` | The factory — what fields a new slot gets |
| `slotDisplayTitle` | `src/components/slides/slideDisplay.ts:61-81` | Slide-rail row title |
| `slotLabel` (separate implementation) | `src/components/ServiceCard.vue:135-154` | Dashboard/service-list card label |
| `deriveGroupEntries` | `src/utils/slideGroupMaterializer.ts:50-135` | What `GroupSlideEntry`/`sourceRef` a new slot kind produces |
| fallback-derivation switch | `src/utils/slideshowAssembler.ts:394-501` | Slide content for a slot with no materialized group yet |
| `sourceSignature` | `src/utils/slideshowAssembler.ts:147-204` | Change-detection signature per kind |

Adding `ANNOUNCEMENTS`/`MISCELLANEOUS` to the `SlotKind` union (`src/types/service.ts:7`) will produce a
compile error at every one of these sites until handled — this is real, load-bearing safety, and the
natural place for both new kinds to land is alongside `PRAYER`/`MESSAGE`/`HYMN`'s existing shared
`case 'PRAYER': case 'MESSAGE': case 'HYMN':` grouping in `deriveGroupEntries`/the assembler fallback
switch (both already emit a generic `{ kind: 'text' }` `sourceRef`/`TextSlide` for that group — plain
input boxes fit this exactly).

### Silent fallthrough (if-chains, or a `default:` clause) — TypeScript will NOT catch these; each must be found and updated by hand

| Site | File:line | Current behavior on an unhandled kind |
|---|---|---|
| `addSlotAsItem` (Planning Center export) | `src/utils/planningCenterApi.ts:884-1004` | **An unconditional if-chain ending in an un-guarded "MESSAGE" branch** (line ~995: no `if`, just falls through) — any kind not explicitly matched earlier is silently exported to Planning Center as a generic "Message" item. **This is not hypothetical** — `ServiceEditorView.vue:3401-3407` already has to special-case `IMPORTED` with an explicit `continue` and an inline comment naming exactly this trap ("skip export entirely rather than falling through addSlotAsItem's default MESSAGE-item branch and mislabeling it"), but that guard exists ONLY in the "new plan, no template" export path (line 3401). The "existing plan" export path (lines 3191-3305) never iterates non-song/non-scripture slots at all today, so it's incidentally safe — but it means **`ANNOUNCEMENTS`/`MISCELLANEOUS` need the same explicit skip-or-handle treatment `IMPORTED` already got**, and it is easy to miss because nothing forces it. |
| `elementLabel` | `src/views/ServiceEditorView.vue:2692-2702` | Has a `default: return 'this element'` — compiles fine, silently generic for a new kind's delete-confirmation copy |
| `isSlotPopulated` | `src/views/ServiceEditorView.vue:2651-2671` | If-chain, `return false` for an unhandled kind — a populated ANNOUNCEMENTS/MISCELLANEOUS slot would read as "empty" for whatever UI gates on this (e.g. delete-confirmation wording, completeness indicators) |
| `slotPrefix`/`slotName`/`slotHasContent`/`slotUrl`/`slotTextClass` | `src/components/ServiceCard.vue:156-197` | Five separate if-chains, each silently no-ops (empty string/`false`/`null`) for an unhandled kind |
| Slot row rendering | `src/views/ShareView.vue:29-75` | Vue template `v-else-if` chain — an unhandled kind renders **no row at all** on the public share page. No compiler exists to catch a template gap. |
| Slot row rendering | `src/components/ServicePrintLayout.vue:16-84` | Same `v-else-if` chain pattern, same silent-gap risk, for the printed order of service |
| Add-item palette | `src/views/ServiceEditorView.vue:803-807` (per-section inline chips) and `:1192-1196` (bottom palette) | Literal, hand-written `<button>` per kind — adding a kind requires a manual new button at BOTH locations; there is no list-driven rendering to extend once. Removing Hymn (per the milestone decision, "palette-only removal") means deleting exactly these two `Hymn` buttons and nothing else — `createSlot('HYMN')`, `slotLabel`, the assembler, and every switch above are explicitly NOT touched (matches PROJECT.md's decision verbatim). |

### `MESSAGE` becoming a plain input box is a type-shape decision, not just a UI change

`MESSAGE` currently shares `NonAssignableSlot` with `PRAYER` (`src/types/service.ts:73-79`): both carry
optional `linkUrl`/`linkLabel`, and both are rendered in `ServiceEditorView.vue` with an identical
link-editing UI (PRAYER at ~line 1010-1050, MESSAGE at ~line 1054-1097 — confirmed by reading both
blocks). The decision only changes `MESSAGE` ("reduce Message to an input box with no URL link") —
`PRAYER` is not mentioned and should keep its link capability. Since `ANNOUNCEMENTS`/`MISCELLANEOUS` are
also specified as "plain input boxes," the natural shape is a **new field** (e.g. `text?: string`) shared
by `MESSAGE`/`ANNOUNCEMENTS`/`MISCELLANEOUS`, while `PRAYER` stays on the existing link-based
`NonAssignableSlot` shape unchanged. Whether this means splitting `NonAssignableSlot` into two
interfaces, or widening it with both old (`linkUrl`/`linkLabel`, PRAYER-only going forward) and new
(`text`, MESSAGE/ANNOUNCEMENTS/MISCELLANEOUS) fields, is a concrete type-design decision the phase plan
must make explicitly — this research surfaces the fork, not the answer.

## 6. Default service template

`buildSlots(progression)` (`src/utils/slotTypes.ts:249-295`) is currently the **sole** source of a new
service's structure — called once, from `createService` (`services.ts:139-154`), with no other call
site in `src/` (confirmed by the earlier `SlotKind` grep — `createService` is the only non-test/non-type
consumer). Per the milestone decision, an org-level template should become the primary source, with
`buildSlots` demoted to "the fallback default template" when no org template is set.

**Where the template lives:** the natural home is `OrgSettings.defaultServiceTemplate` (Item 1's new
settings sub-object), typed as `ServiceSlot[] | null` — the same shape `buildSlots` already returns, so
`createService` can do `const slots = orgSettings.defaultServiceTemplate ?? buildSlots(progression)`
with no new type needed. This also means the "Services slide-out" settings UI (per PROJECT.md's target
features) is, at its core, an editor for a `ServiceSlot[]` array — it can reuse the same `createSlot`/
`reindexSlots`/`orderSlotsBySection` primitives `ServiceEditorView.vue` already uses for its own slot
editing (`src/utils/slotTypes.ts`), rather than inventing a parallel slot-editing UI.

**VW typing stays a layer on top, not baked into the stored template.** Per the decision, "when VW mode
is on, the song slots in that template still receive required VW types from the chosen progression."
This means the org template stores slot *structure* (kind, section, and for HYMN/etc. any fixed content)
but a SONG slot's `requiredVwType` should **not** be frozen into the stored template — it must still be
computed from `PROGRESSION_SLOT_TYPES[progression]` (`slotTypes.ts:16-31`) at service-creation time,
keyed by the SONG slot's position within the template, exactly as `buildSlots` does today (`songSlot`
helper, `slotTypes.ts:252-261`). This is a real design constraint on the template's shape/consumption
logic, not a detail: a template with VW types "baked in" would desync the moment an org changes which
progression they use, or turns VW mode off and back on.

**Build-order implication:** this item depends on Item 1's settings infrastructure landing first (the
template needs somewhere typed to live), and is otherwise self-contained — `createService` is the only
consumption site to change.

## 7. Global slide typography

**There is currently zero font infrastructure to build on.** Confirmed by grepping the whole `src/` tree
for `font-family`/`fontFamily`/`--font-`: the only hits are Tailwind's `font-sans` utility class on
`ShareView.vue`/`QuarterShareView.vue`/the two print layouts — the Tailwind v4 default stack, applied
nowhere else. `src/assets/main.css` (the entire global stylesheet) is 11 lines: a single `@import
"tailwindcss"` plus a dark-mode background/color override — **no `@theme` block, no custom font tokens
of any kind.** Every slide-rendering surface hardcodes its own Tailwind text-size/weight utility classes
directly in the template with no shared variable:

- `PresentationViewer.vue` (presenter): `text-5xl font-normal` for lyric/scripture body,
  `text-6xl font-semibold` for copyright title, etc. — a different hardcoded class per slide-kind branch
  (lines 76, 86, 90, 114 and onward).
- `SlideCard.vue` (grid preview): `text-[13px] leading-normal` for the card body (line 45).
- `EditSlideDrawer.vue` and the print layout presumably follow the same "hardcode Tailwind classes
  per element" convention (not independently re-verified line-by-line here, but no font seam exists
  anywhere in the codebase to contradict this).

**So this is greenfield infrastructure, not "find the scattered seam and unify it" — there is no seam
yet.** The one-setting-reaches-four-surfaces requirement (grid, drawer preview, presenter, print) is
best served by **one CSS custom-property triplet** (`--slide-font-family`, `--slide-font-weight`,
`--slide-font-size` or a base-size custom property that each surface's existing text-size utility scales
from) set once at a shared ancestor and consumed via `style="font-family: var(--slide-font-family)"` (or
a small Tailwind `@theme` mapping, given Tailwind v4's CSS-first config) on each of the surfaces above.
Given "curated, self-hosted woff2 list" per the decision, the settings value is realistically a font
*key* (not an arbitrary string) resolved against a small static font-registry module that also owns the
`@font-face` declarations for the self-hosted files — this registry is itself new infrastructure this
milestone must create (no equivalent exists today; nothing in this codebase currently ships any custom
web font).

**Print is a real fourth consumer, not an afterthought.** `ServicePrintLayout.vue` is Order-of-Service
text (song/scripture/prayer/message rows), not currently slide-shaped — if "every slide" for typography
purposes is meant to include the printed order of service, that's a fifth surface;if it's scoped to
slide-shaped content only (grid/drawer/presenter), print is out of scope for this item specifically. This
research did not find text in PROJECT.md resolving that ambiguity — flag it for the phase plan.

## 8. Mobile responsiveness

### The Schedule screen's existing pattern is real, working code — this is the class string to copy

Despite its route being `/schedule` and its label "Schedule" in `AppSidebar.vue:119` (there is no
`ScheduleView.vue` file — the page is `src/views/QuarterView.vue`), the owner's "Schedule screen" refers
to `QuarterView.vue`. Its header button row (`QuarterView.vue:13`) is:

```html
<div class="flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-end gap-2 w-full sm:w-auto
     [&>*]:w-full sm:[&>*]:w-auto [&>*]:justify-center sm:[&>*]:justify-start">
```

This is a complete, working mobile-stacking recipe: `flex-col` (stacked, full-width buttons) below the
`sm` breakpoint, `flex-row flex-wrap` (inline, auto-width, wrapping) at `sm`+, using Tailwind's arbitrary
child-selector variants (`[&>*]:...`) to force every direct-child button to full-width-and-centered on
mobile without touching each button's own class list. This is directly reusable verbatim on
`ServiceEditorView.vue`'s equivalent button rows.

### What's structurally in the way on `ServiceEditorView.vue` today

- The header "Save area" (`ServiceEditorView.vue:96-97`, `<div class="flex items-center gap-3">`) holds
  Undo, Mark as Planned, and (via `ContextualActionBar.vue`) Save/Suggest/Export — a plain `flex` row
  with **no responsive stacking at all**, unlike `QuarterView.vue`'s header. On a narrow viewport this
  row will overflow or wrap awkwardly rather than stack.
- **Print and Share are still at the page bottom**, not in the top contextual action bar — confirmed:
  `ServiceEditorView.vue:1315-1364`, a separate `<div class="mt-6 pt-4 ... flex flex-wrap items-center
  gap-2">` block below the tab content, entirely disconnected from `ContextualActionBar.vue`
  (`src/components/ContextualActionBar.vue`) which Phase 36 built specifically as "the one shared action
  bar" (per that file's own doc comment) but which today only carries Save/Suggest/Export/Mark-as-Planned
  — Print/Share were never migrated into it. Moving them requires: (a) adding `print`/`share`
  `ActionBarItem`s to `src/views/serviceEditorActionBar.ts` (the `buildActionBarItems` module
  `ContextualActionBar.vue` already consumes declaratively), and (b) deleting the bottom action block
  (lines 1315-1364) — Delete stays, per PROJECT.md's target features (only Print/Share move; Undo is
  demoted to a link, not moved into this bar).
- **Undo is a full button, not a link**, in the header's Save area (`ServiceEditorView.vue:101-112`) —
  demoting it per the milestone's target feature is a template/class change at this one site, not a
  structural one.
- **The Slides tab** (`SlidesTab.vue`, `SlideGrid.vue`, `SlidePlanRail.vue`) was not independently
  audited line-by-line for mobile-blocking layout in this pass (out of the explicit `files_to_read`
  list and beyond this research's time budget) — flag this as an open item for the phase that actually
  implements mobile support: it should get the same targeted read-before-plan treatment this document
  gave `ServiceEditorView.vue`'s header/action rows, since "make the Slides tab mobile friendly" is
  listed as a distinct target feature from the service-edit-screen button stacking.

### Dashboard "Getting Started" panel — confirmed net-new

Grepped `DashboardView.vue` for any existing "Getting Started" content — no match. This is a new,
self-contained panel (dismissible, presumably via a `localStorage` flag consistent with this
codebase's client-only-preference conventions — no existing per-user dismissal-flag precedent was found
in Firestore, and inventing one there would be disproportionate for a UI nicety). Low architectural risk;
does not depend on any other v1.5 item.

## Suggested build order (dependency-driven, not thematic)

1. **`OrgSettings` type + defaults module + `auth.ts` merge-and-load** (Item 1). Every other settings
   toggle (AI, PC, Bible version, template, font) writes into this shape — build it first or every later
   phase re-touches `auth.ts`'s load/reset logic piecemeal.
2. **Org membership → custom claim** (Item 3), independently of Item 1. This is infrastructure
   (`storage.rules` + one new trigger + a backfill script) with no dependency on settings and no UI
   surface of its own — safe to parallelize with Item 1, and worth doing early since Item 4's Storage
   reads inherit its correctness.
3. **Share link rework** (Item 2) — resolve the R036 conflict explicitly (this research recommends the
   separate-document option) before writing code; this is a design decision, not just an implementation
   task, and blocks nothing else in this milestone.
4. **PPTX rendered-image display** (Item 4) — the single largest, most structurally invasive item
   (touches `AssemblyInputs`, both `deriveGroupEntries` and `slideshowAssembler.ts`'s IMPORTED
   branches, `sourceSignature`, and adds a new client-side render-status resolver). Sequence after
   Item 3 so Storage reads are claim-based rather than inheriting the emulator-blind cross-service check
   for a brand-new code path.
5. **Service item types** (Item 5) — mechanically bounded by the compiler for the exhaustive-switch
   sites; the risk is entirely in the silent-fallthrough sites enumerated above (Planning Center export
   above all). Independent of Items 1–4; can run in parallel with them.
6. **Default service template** (Item 6) — depends on Item 1 (needs `OrgSettings` to exist) but is
   otherwise small and self-contained (one consumption site, `createService`).
7. **Global slide typography** (Item 7) — depends on Item 1 for where the setting lives; the CSS
   custom-property seam itself is greenfield and can be built in parallel with most other items once the
   setting exists to read.
8. **Congregational reading divider UX, deterministic multi-image ordering, mobile/layout polish**
   (remaining target features, not deep-dived here per the `files_to_read` scope) — layer in after the
   structural items above; mobile/layout work in particular benefits from Print/Share already having
   moved into the contextual action bar (Item 8's own finding) before restyling that bar for small
   screens.

## Sources

Every file below was read in full or in the cited line ranges during this research pass:

`.planning/PROJECT.md` · `src/stores/services.ts` · `src/types/service.ts` · `src/utils/slotTypes.ts` ·
`src/views/SettingsView.vue` · `src/components/slides/slideDisplay.ts` · `firestore.rules` ·
`storage.rules` · `CLAUDE.md` · `src/stores/auth.ts` · `src/types/importedDeck.ts` · `src/types/slide.ts` ·
`src/types/slideGroup.ts` (partial) · `functions/src/index.ts` (lines 1-130, 130-460, 550-630) ·
`src/utils/claudeApi.ts` · `src/components/PptxImportModal.vue` · `src/utils/slideGroupMaterializer.ts` ·
`src/utils/slideshowAssembler.ts` · `src/composables/useSlideshowAssembly.ts` (grep + partial) ·
`src/stores/importedSlides.ts` · `src/views/ShareView.vue` · `src/components/ServicePrintLayout.vue` ·
`src/components/ServiceCard.vue` (lines 120-220) · `src/utils/planningCenterApi.ts` (lines 875-1005) ·
`src/views/ServiceEditorView.vue` (lines 1-140, 800-810, 1190-1200, 1300-1420, 2600-2760, 3160-3420) ·
`src/views/TeamView.vue` (lines 200-360) · `src/views/QuarterView.vue` (lines 1-35) ·
`src/components/AppSidebar.vue` (lines 95-135) · `src/components/ContextualActionBar.vue` ·
`src/components/slides/SlideCard.vue` (lines 1-80) · `src/components/PresentationViewer.vue` (lines 1-120) ·
`src/assets/main.css` · `src/views/DashboardView.vue` (grep only, no match for existing Getting Started panel)

No web/external research was used for this document — this is a codebase-integration research pass, and
every claim is traceable to the source files above rather than to general Vue/Firebase ecosystem
knowledge.

---
*Architecture research for: WorshipPlanner v1.5 "Settings, Sharing, and Fidelity"*
*Researched: 2026-08-06*
