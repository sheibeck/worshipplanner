# External Integrations

**Analysis Date:** 2026-07-16

## APIs & External Services

**Anthropic Claude API:**
- Service: AI-powered song and scripture suggestions for worship planning
  - SDK/Client: `@anthropic-ai/sdk` (v0.78.0)
  - Model: `claude-haiku-4-5-20251001`
  - Auth: API key held in Google Secret Manager (`CLAUDE_API_KEY`)
  - Access: Browser client → `/api/anthropic` proxy (Cloud Function) → `https://api.anthropic.com`
  - Usage: `src/utils/claudeApi.ts`
    - `getSongSuggestions()`: Suggests worship songs matching sermon context
    - `getScriptureSuggestions()`: Suggests scripture passages matching sermon topic
  - Request Headers: Firebase ID token in `X-App-Auth` header for authentication gate
  - Response: JSON arrays of suggestions with validation against local libraries

**ESV (English Standard Version) Bible API:**
- Service: Fetch scripture text passages for worship service items
  - Auth: Token-based (`Authorization: Token {ESV_API_KEY}`)
  - Key Location: Google Secret Manager (`ESV_API_KEY`)
  - Access: Browser client → `/api/esv` proxy (Cloud Function) → `https://api.esv.org`
  - Usage: `src/utils/esvApi.ts`
    - `fetchPassageText()`: Retrieves formatted scripture text by passage reference
  - Endpoint: `/v3/passage/text/`
  - Query Params: `q` (passage), `include-verse-numbers=true`, `include-headings=false`, etc.
  - Response: JSON with `passages` array containing formatted scripture text

**Planning Center Online API (Services v2):**
- Service: Church service planning platform integration
  - API Endpoint: `https://api.planningcenteronline.com/services/v2`
  - Auth: Basic Auth (App ID + Secret) in Authorization header
  - Access: Browser client → `/api/planningcenter` proxy (Vite dev / Cloud Function prod) → Planning Center
  - Credentials Storage: Stored in Firestore at `organizations/{orgId}.pcAppId` and `.pcSecret` (encrypted at rest by Firestore)
  - Usage: `src/utils/planningCenterApi.ts` (26+ functions)
    - Service Types: `fetchServiceTypes()`, `fetchTemplates()`
    - Plans: `fetchPlans()`, `createPlan()`, `fetchPlanItems()`, `fetchPlanTimes()`
    - Items: `createItem()`, `updateItem()`, `deleteItem()`, `createItemNote()`
    - Songs: `searchSongByCcli()`, `fetchSongArrangements()`, `fetchLastScheduledItem()`
    - Teams: `fetchServiceTypeTeams()`, `fetchTeamPositions()`, `addNeededPosition()`
    - People: `fetchAllPeople()`, `fetchPeopleForTeamPositions()`, `fetchPersonEmails()`
  - Rate Limiting: Implements 429 (Too Many Requests) retry logic with exponential backoff
  - Pagination: Follows `links.next` for paginated responses, rewrites absolute URLs to proxy paths

## Data Storage

**Firestore (Cloud Firestore):**
- Primary database for all application data
  - Collections: `users`, `organizations`, `inviteLookup`, `shareTokens`, `orgSlugs`
  - Subcollections (per org): `members`, `invites`, `services`, `songs`, `quarters`, `teams`, `roster`, `assignments`, `arrangements`
  - Client SDK: `firebase` (v12.0.0)
  - Access: `src/firebase/index.ts` initializes `db = getFirestore(app)`
  - Emulator: Local development uses Firestore emulator at `127.0.0.1:8080` (port 8080)
  - Connection: Configured via environment variables (`VITE_FIREBASE_*`)
  - Write Strategy: Batch writes for transactional consistency (e.g., invite acceptance, org creation)
  - Real-time Listeners: `onSnapshot()` for live data sync in stores (`auth.ts`, `quarters.ts`, etc.)
  - Security: Defined in `firestore.rules` with role-based access control (editor vs. viewer)

**File Storage:**
- Not used in this codebase; local filesystem only for development

**Caching:**
- Not configured; relies on browser-side Pinia store and Firestore listeners for state management

## Authentication & Identity

**Auth Provider:**
- Firebase Authentication (with multiple methods)

**Implementation Details:**
- Location: `src/firebase/index.ts` (initialization), `src/stores/auth.ts` (business logic)
- Methods Supported:
  - Google OAuth: `loginWithGoogle()` uses `GoogleAuthProvider` + `signInWithPopup()`
  - Email/Password: `loginWithEmail()` with auto-create on first sign-in, `registerWithEmail()`, `sendPasswordResetEmail()`
- Auth State Listener: `onAuthStateChanged()` monitors login/logout transitions
- ID Token: Firebase ID tokens issued to signed-in users, sent to Cloud Function proxy in `X-App-Auth` header for server-held secret access
- Session Management: ID tokens expire and refresh automatically via Firebase SDK
- Emulator: Local development uses Auth emulator at `127.0.0.1:9099` (port 9099)

## Monitoring & Observability

**Error Tracking:**
- Not configured; errors logged to browser console via `console.error()`

**Logs:**
- Browser console logging in utility modules (e.g., `[claudeApi]` prefix in `src/utils/claudeApi.ts`)
- Cloud Function logs available via Firebase Console / Google Cloud Logging

## CI/CD & Deployment

**Hosting:**
- Firebase Hosting (static + Cloud Functions)
  - Public: `dist/` directory
  - Rewrites: `/api/**` routes to `api` Cloud Function
  - SPA: `/**` rewrites to `/index.html` for client-side routing

**CI Pipeline:**
- Not detected in codebase; likely configured externally (GitHub Actions, etc.)

**Deployment:**
- Functions: `npm run build && firebase deploy --only functions` (in `functions/`)
- Hosting: `firebase deploy --only hosting` (auto-deploy SPA)

## Environment Configuration

**Required Environment Variables (Client - VITE_ prefixed):**
- `VITE_FIREBASE_API_KEY`: Firebase API key
- `VITE_FIREBASE_AUTH_DOMAIN`: Firebase auth domain
- `VITE_FIREBASE_PROJECT_ID`: Firebase project ID
- `VITE_FIREBASE_STORAGE_BUCKET`: Firebase storage bucket
- `VITE_FIREBASE_MESSAGING_SENDER_ID`: Firebase messaging sender ID
- `VITE_FIREBASE_APP_ID`: Firebase app ID
- `VITE_FIREBASE_MEASUREMENT_ID`: Firebase Analytics measurement ID (optional)
- `VITE_USE_EMULATORS`: Set to `'true'` to connect to local emulators (dev only)

**Server-Held Secrets (Google Secret Manager):**
- `CLAUDE_API_KEY`: Anthropic Claude API key (never exposed to browser)
- `ESV_API_KEY`: ESV Bible API key (never exposed to browser)
- Set via: `firebase functions:secrets:set CLAUDE_API_KEY` / `firebase functions:secrets:set ESV_API_KEY`
- Consumed by: Cloud Function proxy at `functions/src/index.ts`

**Planning Center Credentials:**
- Not environment variables; stored per-organization in Firestore
- User provides App ID + Secret through UI settings
- Credentials used for Planning Center API calls (client or proxy)

**Secrets Location:**
- Client: All VITE_ vars loaded from `.env.local` (not checked in; Vite handles at build time)
- Server: Cloud Functions reference secrets via `defineSecret()` from Firebase params library
- Development Proxy: Vite dev server reads non-VITE_ secrets from `.env.local` for dev proxy

## Webhooks & Callbacks

**Incoming:**
- None detected; app is pull-only (client fetches data from APIs)

**Outgoing:**
- None configured; app does not send webhooks to external services
- Planning Center integration: One-way push (create/update/delete items in PC)

## API Proxy Architecture

All external API calls route through a proxy layer to centralize authentication and secret management:

**Architecture:**
```
┌─────────────────────────────────────┐
│   Browser (Vue 3 App)               │
│   src/utils/claudeApi.ts            │
│   src/utils/esvApi.ts               │
│   src/utils/planningCenterApi.ts    │
└────────────────┬────────────────────┘
                 │
                 │ HTTP with X-App-Auth token
                 ▼
┌─────────────────────────────────────┐
│   Proxy Layer (Cloud Function)      │
│   functions/src/index.ts            │
│   - Verifies Firebase ID token      │
│   - Injects server-held secrets     │
│   - Routes to upstream APIs         │
└────────────────┬────────────────────┘
                 │
    ┌────────────┼────────────────┐
    │            │                │
    ▼            ▼                ▼
  Claude API  ESV API        Planning Center
```

**Flow:**
1. Client calls e.g., `fetch('/api/anthropic/v1/messages', { headers: X-App-Auth: token })`
2. Cloud Function proxy receives request, verifies token against Firebase Auth
3. If valid, proxy injects `X-API-Key: {CLAUDE_API_KEY}` (from Secret Manager)
4. Proxy forwards modified request to upstream API
5. Response returned to client

**Dev Proxy (Vite):**
- Same pattern: Vite dev server intercepts `/api/*` requests
- Reads `CLAUDE_API_KEY` and `ESV_API_KEY` from `.env.local` (for local development)
- Injects headers and forwards to actual APIs
- Planning Center proxy: Routes directly (no API key needed for dev)

## Integration Endpoints Summary

| Service | Endpoint | Auth | Method | Route | Key Location |
|---------|----------|------|--------|-------|--------------|
| Anthropic | `https://api.anthropic.com` | `X-API-Key` header | POST `/v1/messages` | `/api/anthropic` | Secret Manager |
| ESV | `https://api.esv.org` | `Authorization: Token` | GET `/v3/passage/text` | `/api/esv` | Secret Manager |
| Planning Center | `https://api.planningcenteronline.com` | Basic Auth | GET/POST/PATCH/DELETE `/services/v2/*` | `/api/planningcenter` | Firestore per-org |
| Firebase Auth | `https://identitytoolkit.googleapis.com` | SDK | Various | N/A (SDK direct) | Project config |
| Firestore | `https://firestore.googleapis.com` | ID token + rules | REST/gRPC | N/A (SDK direct) | Project config |

## Backend Integration Notes (R318)

Behavioral/architectural "how it works" narration relocated out of backend source comments
(`functions/src/**`, `firestore.rules`, `storage.rules`) per the Phase 109 comment convention
(CONVENTIONS.md § Comment Convention). Grouped by source file; each entry cites the file:line
range at the time of relocation (109-02).

### firestore.rules

**`organizations/{orgId}/services/{docId}/messages/{messageId}` (R130):** the queue of volunteer
notifications for this service. No client code writes this collection (Phase 58); the Admin SDK
(a Phase 59+ Cloud Function) is the intended sole owner of the send lifecycle. `read` is
member-tier (mirrors `pptxRenders`/`services`); `create` is editor-tier so an editor can queue a
message; `update`/`delete` are unconditionally denied — status transitions (`queued`→`sending`→
`sent`, delivery counts) are Admin-SDK-only, so no client, editor or not, can forge a `"sent"`
status. Proven by `src/rules.test.ts`'s `messages` describe block (genuine ALLOW-case + Admin-SDK
-only DENY-cases against the full nested path). Recipients — per-recipient delivery status —
is Admin-SDK-only end to end: even the editor who created the parent message cannot write there.

**`organizations/{orgId}/pptxRenders/{importId}` (R062, Phase 42):** render-status doc for an
imported PowerPoint deck. READ ONLY — member tier, not editor tier: a viewer already reads the
deck's full parsed content and structure through `importedSlides`/`slideGroups`, so render status
(`status`, `renderedCount`, `failureReason`) carries no additional sensitivity (T-42-02, accepted
risk). Nothing client-side writes this document — the render service (Admin SDK,
`functions/src/index.ts`) is the sole writer, bypassing rules entirely — so no
create/update/delete is granted. See the `/{collection}/{docId}` wildcard's `collection !=
'pptxRenders'` exclusion (ARCHITECTURE.md § functions/src/index.ts and § firestore.rules): without
it, this block's read-only intent would be a complete no-op for writes, and an org editor could
forge a `ready` flip (T-42-01, inheriting T-37-15).

**`aiUsage/{docId}` (R163):** one entry per proxied Claude request, written ONLY by the `api`
Cloud Function via the Admin SDK (`functions/src/index.ts`, Phase 65 Plan 01), which bypasses
rules entirely. This top-level collection is already denied by the catch-all; this explicit deny
is defense-in-depth documenting the intent (Admin-SDK-only, never client-readable/writable) and
future-proofs against a refactor that might nest it under `organizations/{orgId}` — where it would
otherwise fall through the org-scoped `/{collection}/{docId}` wildcard (T-37-15) and become
editor-writable. Owner-gated: see 65-02 PLAN/SUMMARY for the UNDEPLOYED handover; the `api`
function does not depend on this rule to operate. `aiRateLimits/{docId}` (R161, fixed-window
per-uid request counters written the same way) has the same rationale and owner-gated/UNDEPLOYED
status.

### storage.rules

**JWT claim read (`isOrgMemberByClaim`):** reads `request.auth.token.orgId`/`.role` — a direct JWT
claim read set server-side by Cloud Function `syncOrgMembershipClaim`
(`functions/src/orgMembershipClaims.ts`, phase 40-02) via the Admin SDK, plus the one-off backfill.
No cross-service call is involved, so this is fully verifiable in the emulator. `role != null`
(not a specific role) is the gate — any assigned role counts as membership. WIDENED (phase 73,
D-01/D-04 closed): the claim now carries every org the user belongs to via the `orgs` map, not
just the primary; the multi-org arm checks the requested orgId against that full map, while the
legacy arm (unchanged) still matches the primary orgId/role alone, so a not-yet-backfilled token
is never left without access to its own primary org during rollout (R211 backward-compat). Phase
76 (R213) org lifecycle gate, Storage side: Storage CANNOT read `organizations/{orgId}.active`
live (`firestore.get()`/`exists()` is inert in the Storage emulator/service —
firebase-js-sdk#6803, the exact documented 2026-08-06 deny-everyone incident in CLAUDE.md), so
deactivation must flow through a custom claim instead — `deactivatedOrgs`, fanned out by
`setOrgActive` (`functions/src/orgProvisioning.ts`) to every affected member. `!= null` guards the
absent-key case (a legacy, pre-this-phase token shape) so it reads as "not deactivated" rather
than erroring.

### functions/src/index.ts

**Resend email provider key location:** `RESEND_API_KEY` lives in `./params` (moved so
`orgProvisioning.ts` can bind it too without a circular import) — imported and re-exported at the
top of `index.ts`.

**`verifyAppCaller`:** replaces the old boolean `callerIsAuthenticated` gate with the SAME
accept/reject decision (valid token → proceed, missing/invalid → 401), but resolves to the
decoded ID token itself rather than throwing it away — the anthropic-only controls (R161/R162/
R163) need `decoded.uid` for the rate limiter/ledger and the `orgId` custom claim for the ledger's
org attribution. Every other `SECRET_INJECTED` service (esv/nlt) keeps the identical "any valid
caller" behavior; only the anthropic branch reads anything off the returned token.

**`checkOrgAiEnablement` (R242/R243, the real server-side half of the per-org master AI gate):** a
live `organizations/{orgId}` read on EVERY anthropic call, extracted so it is unit-testable
without an HTTP harness (the `api` onRequest has none). The caller's `orgId` custom claim
(resolved via `resolveOrgId`) is used ONLY as a pointer to WHICH org to read — never trusted for
the enablement VALUE itself, since claims are stale until the next ID-token mint (sign-in, org
switch, or an explicit revoke). A live `get()` here is fresh on every request, closing the gap a
claims-embedded flag would leave open for however long a disabled org's members' tokens happen to
still be valid. FAIL CLOSED on a read error — a DELIBERATE departure from the rate limiter's
fail-open posture (`checkAndConsumeRateLimit`'s caller treats the limiter as a cost guardrail, not
a security control): this check IS the security control the owner asked to be "real" (not just UI
hiding, 82-RESEARCH.md Assumption A2) — a Firestore hiccup here must never silently let a disabled
org spend money on Anthropic.

**`checkOrgBibleEnablement` (R297, server-side half of the per-org Bible-API gate):** defense-in-
depth behind the client dispatcher (Plan 102-01). Mirrors `checkOrgAiEnablement` 1:1 — same live
`organizations/{orgId}` read, same fail-closed posture, same "claim is only a pointer, never the
enforcement value" rationale. Reuses the existing `OrgAiEnablementResult` union rather than
declaring a redundant type, since the shape (`{ ok: true } | { ok: false, status, error }`) is
identical.

**`checkAndConsumeRateLimit` (R161, per-uid fixed-window Firestore rate limit):** two top-level
`aiRateLimits` counter docs per call — `${uid}__min__${minuteWindow}` and
`${uid}__day__${dayWindow}` — read inside a single transaction so the check-then-increment is
atomic across concurrent requests from the same user. A rejected request (either ceiling already
met) does NOT increment either counter. Kept TOP-LEVEL (not nested under
`organizations/{orgId}`) so the `firestore.rules` catch-all deny already blocks client reads
(T-37-15). Deliberately does NOT catch its own Firestore errors — the caller (the anthropic
branch) decides the fail-open policy so a limiter datastore hiccup never takes AI down (locked
decision, 65-CONTEXT.md).

**`requestPptxRenderHandler`:** exported separately from the `onDocumentCreated` wrapper
(mirroring `parsePptxHandler`/`parsePptx` and `cleanupExpiredMediaHandler`/`cleanupExpiredMedia`)
so it is directly unit-testable against mocked Firestore/Storage/`renderInvoker` seams. ★ Trap 1
(37-CONTEXT.md/37-VALIDATION.md): this handler must NEVER import, reference, or reason about
`parsePptxBuffer`, `MappedSlide`, or a parsed slide array — `mapAstToSlides` (`pptxParser.ts`)
SKIPS slides with neither substantial text nor images, and emits ONE ENTRY PER IMAGE on a
multi-image slide, so its length is structurally decoupled from the deck's real page count (a
6-slide deck can yield 4 entries, or more than 6 with a multi-image collage) — deriving the
expected render page count from it would be silently wrong in BOTH directions. The expected count
comes only from the render service's own self-report, cross-checked against an independent
recount (see ARCHITECTURE.md § functions/src/index.ts "the ready gate").

**`messageWebhook` (60-02: R143 — Resend delivery/bounce receiver):** the milestone's new
UNAUTHENTICATED trust boundary. Resend POSTs delivery and bounce events here; the only thing that
gates a Firestore write is the Svix HMAC over the RAW request body (`verifySvixSignature`),
checked FIRST. Only a hard (Permanent) bounce surfaces: it idempotently flips the addressed
`recipients/{id}` to `status:'bounced'` and increments `messages/{id}.deliveryCounts.bounced`.

**`resolveRecipientRef` — resolve the bounced recipient's `DocumentReference`:** PRIMARY (tags):
when the echoed Resend tags carry all four path segments (`orgId`, `serviceId`, `messageId`,
`recipientId`), build the `recipients/{id}` ref DIRECTLY at the exact nested path — a single
`doc()` with NO query and NO index dependency. All ids are untrusted strings that only form path
segments scoped under the org (Admin SDK), never a broader query (T-60-02e). FALLBACK
(providerMessageId): when tags are absent/incomplete, look the recipient up by the provider
message id 59-03 stored, via
`collectionGroup('recipients').where('providerMessageId','==',email_id)` — the true safety net
(tags echo is only MEDIUM confidence); requires 60-01's deploy-gated collection-group index at run
time. Returns null (never throws) when neither resolves — the caller 200s an unresolvable event
rather than triggering a Resend retry storm.

**`messageWebhookHandler` — VERIFY-FIRST ORDER CONTRACT (security-critical, 60-CONTEXT.md):**
exported separately from the `onRequest` wrapper so it is unit-testable directly with a fake
rawBody+headers and no `res` (`firebase-functions/v2/https` is not mocked in the test harness).
(1) `rawBody` MUST be a `Buffer` (Cloud Functions supplies `req.rawBody` as the exact received
bytes) — a non-Buffer body is malformed → 400; never fall back to a re-serialized `req.body`, the
HMAC is over the raw bytes. (2) Verify the Svix HMAC over `rawBody` BEFORE any Firestore access —
any missing/malformed/invalid/stale signature → 401, with ZERO state access; 401 is reserved for
signature failure ONLY. (3) Parse the JSON only AFTER the signature passes; unparseable → 400. (4)
Only `email.bounced` with a Permanent (hard) bounce surfaces — every other valid event
(soft/Transient, delivered, complaint, unknown type, or an unresolvable recipient) → 200 with no
write, since a non-2xx would make Resend retry the event forever. The webhook is provider-facing,
so it is NOT gated on `isMessagingEnabled()` (a client concept) — only the signature gates it.

### functions/src/backfillLastUsed.ts

**`backfillLastUsedForOrg` (R248: retroactively correct existing songs' `lastUsedAt`):**
PURPOSE — the live R247 fix (84-01-PLAN.md) corrects `lastUsedAt` GOING FORWARD by recomputing it
on the service lock/unlock lifecycle, but songs whose `lastUsedAt` was already stamped by the old
`serverTimestamp()`-on-assignment bug stay wrong in production until something re-triggers that
recompute. This script performs the one-time retroactive correction for the single production
(Berean) org. THIS IS A NODE SCRIPT, NOT A DEPLOYED FUNCTION — run by the owner with admin
credentials and deliberately NOT exported from `functions/src/index.ts` (mirrors
`backfillOrgClaims.ts`, D-12). SCALE: production is a SINGLE org (84-CONTEXT.md Area 2) — no
cursor, no pagination, no batching, no rate limiting, no all-orgs sweep; a single `.get()` per
collection (services, songs) within the one target org is correct and complete at this size
(mirrors `backfillOrgClaims.ts`'s identical SCALE note) — NEVER widen this to iterate every
`organizations/*` doc. CONSERVATIVE WRITE RULE (84-CONTEXT.md Area 2, owner-locked): write
`lastUsedAt = MAX(locked-service date containing the song)` ONLY for songs that have ≥1 LOCKED
(`status !== 'draft'`) service; every other song — draft-only, or in no service at all — is
SKIPPED and left completely untouched (this script NEVER writes null/blank to `lastUsedAt`, which
would destroy Planning-Center-imported dates on songs never in any service). SAFETY: dry run is
the default; nothing is written unless `--apply` is passed; the CLI wrapper prints the resolved
project id, resolved org id, and a dry-run banner before doing any work (mirrors
`backfillOrgClaims.ts`'s D-13/D-14 safety posture), owner-confirmed before the real `--apply` run
per the standing 2026-08-25 confirm-then-deploy policy. IDEMPOTENT: a song whose existing
`lastUsedAt` already equals the computed MAX (compared via `Timestamp.isEqual`) is reported
skipped, not rewritten — a re-run after an interruption, or a repeat run for auditing, never
touches already-correct songs.

### functions/src/inviteOnboarding.ts

**`sendInviteOnboardingEmailHandler`:** the testable handler body, exported separately from the
`onCall` wrapper — mirrors `onboardOrganizationHandler`/`queueServiceMessageHandler`. Order
(99-PATTERNS.md/99-RESEARCH.md): auth presence → input validation → org-editor caller gate
(inline, mirrors `queueServiceMessageHandler`, `index.ts`) → org-name read → appConfig on/off gate
→ invitee classification → Auth provisioning (non-Google only) → Resend send. Error tiers: a
`createUser`/`generatePasswordResetLink` failure THROWS an `HttpsError('internal', ...)` — the
invitee would otherwise have no usable path at all. A `getUserByEmail` failure that is NOT
`auth/user-not-found` is RETHROWN as-is (mirrors `resolveAdminTarget`'s discrimination). Only the
final Resend send is best-effort: caught, logged, resolved as `{ emailSent: false, kind }` so a
failure there never masquerades as a thrown error once the Auth side has already succeeded.

### functions/src/orgProvisioning.ts

**`setOrgBibleEnabledHandler`:** modeled on `setOrgActiveHandler`'s SIMPLER shape (caller gate,
input validation, org-existence check, same-state-aware merge write), NOT
`setOrgAiEnabledHandler`'s dual-write shape — there is no church-editable `settings.*` leaf for
the Bible API this milestone (R295 decision, that leaf is deferred), so the DISABLE branch writes
ONLY the master field plus its audit siblings, never a forced-off `settings.*` dot-path key.
Governs the Bible **API** (paid ESV/NLT proxy) only, not scripture features in general — an OFF
org still does scripture manually (Phases 102/103).

### functions/src/pptxParser.ts

**`mapAstToSlides`:** pure mapping from an officeparser AST to an ordered array of native
(text | image) slide objects, using a mixed-content heuristic. No officeparser or Storage calls
happen in this function; all image path resolution (including any upload) is delegated to
`resolveImagePath`. Heuristic (per slide, in AST order): (1) flatten all non-image children's text
(trimmed, joined by newline); (2) if that flattened text exceeds `TEXT_DOMINANT_THRESHOLD` chars,
emit one `TextSlide` (title = first heading child's text, if any; body = the full flattened text);
(3) else if the slide has one or more image children, emit one `ImageSlide` per image, in order,
via `resolveImagePath`; (4) else (no substantial text, no images) skip the slide entirely.
Source-slide-index = rendered-page-number contract (R108): every emitted slide carries
`sourcePage`, the 1-based index of the `ast.content` node it came from — incremented per source
slide BEFORE any skip, so a skipped (empty) slide still consumes a page number and the next
emitted slide's `sourcePage` reflects its true position in the original deck. The render service
renders one page per source `.pptx` slide in the same order, from the same file, so this index IS
the slide's rendered page number. A multi-image slide's several `MappedImageSlide`s all share
that one `sourcePage`.

**`parsePptxBuffer`:** validates, parses, and maps a `.pptx` buffer into native slides, uploading
any extracted images to org-scoped Storage along the way. Never deletes the source object — this
function has no knowledge of the source's Storage path at all, and only ever writes new image
objects under `orgs/{orgId}/pptx-imports/{importId}/images/`. On any failure (bad signature,
officeparser throwing), a typed `PptxParseError` propagates for `index.ts` to convert into a
friendly `HttpsError`.

### functions/src/adminEmail.ts

**Module overview (quick task 260823):** a reusable, best-effort admin-notification email helper.
Today it is wired into `onboardOrganization` (super-admin onboards a new church → tell the
assigned admin), but it is deliberately kept generic (`kind: 'added' | 'invited'`) so
`assignOrgAdmin` can adopt it later with a one-line call. Mirrors `index.ts`'s `sendQueuedMessage`
From-header construction verbatim (via the shared `params.ts` helpers): the org's own name is the
RFC 5322 display name (header-sanitized) over the app's configured sending address
(`config.sender.fromAddress`, resolved live from `appConfig/global`). The bare address is peeled
first so a legacy `"Name <email>"` configured value never nests angle brackets. Delivery caveat:
`DEFAULT_APP_CONFIG.sender.fromAddress` is Resend's test sender `onboarding@resend.dev`, which
only delivers to the Resend account owner until a real domain is verified + configured (v1.9
R191/R192) — this helper builds the SEND PATH; real delivery to arbitrary admins still awaits that
domain verification.

### functions/src/params.ts

**Module overview (shared, dependency-free):** a tiny module with NO local imports beyond
`firebase-functions/params`, so it can be imported by BOTH `index.ts` and
`orgProvisioning.ts`/`adminEmail.ts` without creating a circular import (`index.ts` imports
`orgProvisioning.ts`, which needs `RESEND_API_KEY` for its `onCall` secrets binding). The secret +
the two pure From-header helpers + the share-base-url param used to live in `index.ts`; they moved
here verbatim so a second holder can reuse them without importing the whole `index.ts` surface.

### functions/src/renderInvoker.ts

**Module overview (the single, mockable seam that mints a Google-issued ID token and invokes the
private "pptx-render" Cloud Run service, R062):** bridging function's IAM-authenticated invocation
of a Cloud Run service. ★ Security contract (37-RESEARCH.md T-37-09, "no unauthenticated
fallback"): this module NEVER calls `globalThis.fetch` or any bare HTTP client — the only egress
is `client.request(...)` on the client returned by `GoogleAuth#getIdTokenClient`. An
unauthenticated call to a service that is supposed to be private is a strictly worse outcome than
a failed render — a failed render is already handled safely elsewhere (the parsed text layer stays
usable), so there is deliberately no degrade-to-plain-fetch path.

### functions/src/webhookSignature.ts

**`verifySvixSignature`:** verify a Resend/Svix (Standard Webhooks) HMAC-SHA256 signature over the
RAW request body. Pure and dependency-free (`node:crypto` only) — no Firestore, no
`firebase-admin`, no `svix` package — so the webhook trust boundary is unit-testable in isolation
and can be called BEFORE any state access (research Pattern 4). Scheme (CONFIRMED,
60-RESEARCH.md § Confirmed Resend/Svix Signature Scheme): signed content =
`${svix-id}.${svix-timestamp}.${rawBody}` (rawBody as UTF-8 string); HMAC-SHA256 → base64; secret
is `whsec_`-prefixed — strip the prefix and base64-decode the remainder for the HMAC key bytes;
`svix-signature` is a SPACE-delimited list of `v1,<base64sig>` entries (multiple during key
rotation) — accept if ANY entry matches. Returns a boolean and NEVER throws on bad input: a
missing header, non-finite timestamp, stale timestamp, or wrong-length candidate signature all
yield `false`.

---

*Integration audit: 2026-07-16*
