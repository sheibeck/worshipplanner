# Phase 125: Passwordless Magic-Link Access & Scoped Read Isolation - Pattern Map

**Mapped:** 2026-09-05
**Files analyzed:** 11
**Analogs found:** 11 / 11 (all verified live against real source; line numbers re-confirmed by direct Read)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|---------------|
| `firestore.rules` (new `rehearseAccess` match block + catch-all exclusion) | config (security rules) | request-response (rule eval) | `firestore.rules:189-192` (`invites/{email}` email-claim rule) + `:256-258` (`lockSnapshots`) + `:326-331` (catch-all) | exact |
| `src/router/index.ts` (new volunteer routes + `isVolunteerRoute` meta + gate widen) | route/middleware (guard) | request-response | `src/router/index.ts:180-217` (org-selection gate, `requiresSuperAdmin`/`select-church` exemptions) | exact |
| `src/stores/volunteerAuth.ts` (new) | store | event-driven (auth state) | `src/stores/auth.ts` (`onAuthStateChanged`, `loadOrgContext`, `logout()`, `hasNoOrg`) | role-match (same store idiom, new identity shape) |
| `src/views/VolunteerSignInView.vue` (new) | component | request-response | `src/views/LoginView.vue` (existing sign-in surface, `auth/operation-not-allowed` handling from v2.5) | role-match |
| `src/views/VolunteerLinkCompleteView.vue` (new) | component | event-driven (one-shot completion) | `src/views/LoginView.vue` (sign-in completion + redirect idiom) | role-match |
| `src/utils/rehearseAccess.ts` (new — pure projection builder) | utility/transform | transform (batch/pure) | `buildServiceSnapshot()` in `src/stores/services.ts` (pure builder feeding `shareTokens`) | exact |
| `functions/src/index.ts` (`sendQueuedMessageHandler` — add `generateSignInWithEmailLink` per recipient) | service (Cloud Function trigger) | event-driven | `functions/src/index.ts:2156-2196` (existing per-recipient send loop) | exact |
| `functions/src/messageTokens.ts` (add `rehearseLink` field + `{{rehearse_link}}` token) | utility (pure renderer) | transform | `functions/src/messageTokens.ts` (`MessageTokenContext`, `renderMessageTokens`) | exact |
| `functions/src/messageTokens.test.ts` (extend) | test | transform | existing token tests in same file | exact |
| `src/rules.test.ts` (new `describe('Volunteer magic-link scoped read access — R377')` block) | test | request-response (emulator ALLOW/DENY) | `src/rules.test.ts:231,254,276,307,331,374,663` (`authenticatedContext(uid, { email })` pattern, existing invites/shareTokens describe blocks) | exact |
| `src/stores/services.ts` (editor-side write of `rehearseAccess` doc at lock time, and delete/flag on Reopen) | service (store method) | CRUD | `lockSnapshots` write in the lock flow + `shareTokens` revocation in `deleteService()` (same file) | exact |

## Pattern Assignments

### `firestore.rules` (new `rehearseAccess` match block)

**Analog:** `firestore.rules:189-192` (invites email-claim rule), `:256-258` (lockSnapshots), `:326-331` (catch-all)

**Helper functions already available** (lines 7-45, verified):
```javascript
function isSignedIn() {
  return request.auth != null;
}

function isOrgMember(orgId) {
  return isSignedIn() && (
    isSuperAdmin() ||
    (exists(/databases/$(database)/documents/organizations/$(orgId)/members/$(request.auth.uid)) &&
      isOrgActive(orgId))
  );
}

function isOrgEditor(orgId) {
  return isSignedIn() && (
    isSuperAdmin() ||
    (exists(/databases/$(database)/documents/organizations/$(orgId)/members/$(request.auth.uid)) &&
      get(/databases/$(database)/documents/organizations/$(orgId)/members/$(request.auth.uid)).data.get('role', '') in ['editor', 'admin'] &&
      isOrgActive(orgId))
  );
}
```

**Email-claim precedent to mirror** (lines 189-192, real, exact):
```javascript
// Invites subcollection
match /invites/{email} {
  allow read: if isOrgEditor(orgId);
  allow write: if isOrgEditor(orgId);
  allow delete: if isOrgEditor(orgId) || (isSignedIn() && request.auth.token.email.lower() == email);
}
```
This is the proof that a Firestore rule can scope purely off `request.auth.token.email.lower()` with zero custom claims. The new `rehearseAccess` read arm must use the identical `.lower()` idiom (also present at lines 192, 183, 337, 347 per research — case-normalization is load-bearing, see Pitfall 5 in RESEARCH.md).

**Client-writable-by-editor precedent** (lines 250-259, real, exact — comment included since it documents the exact trust model to copy):
```javascript
// Lock snapshots — captured at service-lock time (R132), unlike
// pptxRenders/messages this IS client-writable: an org editor writes
// the snapshot directly when locking a service (Phase 61). Member
// read, editor write, both scoped to this org via isOrgMember/
// isOrgEditor resolving orgId from the path segment (no client field
// trusted), so cross-org access is structurally impossible.
match /lockSnapshots/{snapshotId} {
  allow read:  if isOrgMember(orgId);
  allow write: if isOrgEditor(orgId);
}
```

**New block to add** (place alongside `lockSnapshots`, under `services/{docId}`, matching RESEARCH.md Pattern 3 — verified against real helper names above):
```javascript
match /rehearseAccess/{serviceId} {
  function parentIsPlanned() {
    return exists(/databases/$(database)/documents/organizations/$(orgId)/services/$(serviceId))
      && get(/databases/$(database)/documents/organizations/$(orgId)/services/$(serviceId))
           .data.get('status', 'draft') != 'draft';
  }

  allow read: if isOrgMember(orgId)
    || (
      isSignedIn()
      && request.auth.token.email != null
      && parentIsPlanned()
      && request.auth.token.email.lower() in resource.data.get('assignedEmailsLower', [])
    );

  allow write: if isOrgEditor(orgId);
}
```
Note: `get()`/`exists()` on a SIBLING Firestore doc from within `firestore.rules` is safe and already used throughout this file (`isOrgMember`, `isOrgEditor` above). This is NOT the forbidden cross-*service* `storage.rules` → Firestore `exists()` pattern from CLAUDE.md — do not conflate the two (RESEARCH.md Pitfall 2).

**Catch-all exclusion — MUST update** (lines 322-332, real, exact, comment is load-bearing per the file's own words):
```javascript
// All other nested collections — editors only.
// ★ `collection != 'services'`, `collection != 'slideGroups'` AND `collection != 'pptxRenders'`
// are all LOAD-BEARING. Do not remove any of the three.
match /{collection}/{docId} {
  allow read: if isOrgEditor(orgId);
  allow write: if isOrgEditor(orgId)
    && collection != 'services'
    && collection != 'slideGroups'
    && collection != 'pptxRenders';
}
```
Because `rehearseAccess` is being added as its own explicit `match` block with `allow write: if isOrgEditor(orgId)` (same grant the catch-all already gives), adding it to this exclusion list is optional but should be a **documented decision** either way (Pitfall 4) — recommend adding `&& collection != 'rehearseAccess'` for clarity/consistency with the other three, even though the effective permission is unchanged, so a future reader of the catch-all sees every collection with its own explicit block accounted for.

---

### `src/router/index.ts` (volunteer routes + gate widen)

**Analog:** `src/router/index.ts:180-217` (real, exact)

**Meta type to extend** (near line 9, real):
```typescript
declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
    requiresEditor?: boolean
    requiresSuperAdmin?: boolean
    isVolunteerRoute?: boolean   // NEW
  }
}
```

**The gate to widen** (line 190, real, verbatim current text):
```typescript
if (!to.meta.requiresSuperAdmin && to.name !== 'select-church') {
  const { useAuthStore } = await import('../stores/auth')
  const authStore = useAuthStore()
  await authStore.waitForReady()
  if (authStore.requiresOrgSelection) {
    return { name: authStore.isChurchlessSuperAdmin ? 'owner-console' : 'select-church' }
  }
}
```
Change to:
```typescript
if (!to.meta.requiresSuperAdmin && !to.meta.isVolunteerRoute && to.name !== 'select-church') {
```

**New route declarations** (mirror the `select-church` / `requiresSuperAdmin` route shape near lines 136-143):
```typescript
{
  path: '/my-schedule',
  name: 'my-schedule',
  component: () => import('../views/MyScheduleView.vue'), // Phase 126
  meta: { requiresAuth: true, isVolunteerRoute: true },
},
{
  path: '/volunteer/verify',
  name: 'volunteer-verify',
  component: () => import('../views/VolunteerLinkCompleteView.vue'),
  meta: { isVolunteerRoute: true }, // no requiresAuth — this route COMPLETES auth
},
```

---

### `src/stores/volunteerAuth.ts` (new)

**Analog:** `src/stores/auth.ts` — read the file's `onAuthStateChanged`, `loadOrgContext`, `hasNoOrg`, `logout()` for the store idiom (Pinia setup-store pattern, `ref`/`computed`, async `waitForReady()`/`waitForRole()` gates used by the router). Reuse the SAME `onAuthStateChanged` listener — do not fork a second listener; a magic-link volunteer's uid flows into the existing listener unmodified per RESEARCH.md Pattern 1. New store only needs: email-link request/completion helpers, `localStorage.emailForSignIn` read/write, and cross-device re-entry prompt state — session/identity plumbing itself stays in `auth.ts`.

**Client flow** (RESEARCH.md Pattern 1, official Firebase docs pattern — copy verbatim):
```typescript
import { isSignInWithEmailLink, signInWithEmailLink } from 'firebase/auth'
import { auth } from '@/firebase'

if (isSignInWithEmailLink(auth, window.location.href)) {
  let email = window.localStorage.getItem('emailForSignIn')
  if (!email) {
    email = window.prompt('Please provide your email for confirmation')
  }
  const result = await signInWithEmailLink(auth, email!, window.location.href)
  window.localStorage.removeItem('emailForSignIn')
  // result.user flows into the existing onAuthStateChanged listener in src/stores/auth.ts
}
```

---

### `functions/src/index.ts` (`sendQueuedMessageHandler` — mint link per recipient)

**Analog:** `functions/src/index.ts:2156-2220` (real, verified send loop)

**Current per-recipient block** (lines 2174-2196, real, exact):
```typescript
for (const target of sendList) {
  const recipientRef = messageRef.collection("recipients").doc(target.id);
  try {
    if (!RESEND_TAG_SAFE.test(target.id)) {
      throw new Error("recipient id is not Resend-tag-safe");
    }
    const tokenCtx = { serviceDate, theirRoles: target.roleNames, recipientName: target.name, songTitles, serviceLink };
    const subject = renderMessageTokens(message.subject, tokenCtx);
    const body = renderMessageTokens(message.body, tokenCtx);

    const result = await resend.emails.send({
      from: fromAddress,
      to: target.email,
      ...(senderEmail ? { replyTo: senderEmail } : {}),
      subject,
      text: body,
      tags: [
        { name: "orgId", value: orgId },
        { name: "serviceId", value: serviceId },
        { name: "messageId", value: messageId },
        { name: "recipientId", value: target.id },
      ],
    });
    ...
```

**Modification (add generateSignInWithEmailLink before tokenCtx, per RESEARCH.md Pattern 2):**
```typescript
import { getAuth } from "firebase-admin/auth";

const actionCodeSettings = { url: `${resolveAppBaseUrl()}/volunteer/verify`, handleCodeInApp: true };
// ...inside the for-loop, before tokenCtx:
const rehearseLink = await getAuth().generateSignInWithEmailLink(target.email, actionCodeSettings);
const tokenCtx = { serviceDate, theirRoles: target.roleNames, recipientName: target.name, songTitles, serviceLink, rehearseLink };
```
`resolveAppBaseUrl()` already exists in `functions/src/adminEmail.ts:33-34`, reading `SERVICE_SHARE_BASE_URL` — reuse it (do not add a new param unless a concrete conflict is found, per RESEARCH.md Open Question 2).

**Error handling pattern to preserve** (lines 2211-2220, real, exact — per-recipient try/catch, never abort the batch):
```typescript
} catch (err) {
  console.error(
    `sendQueuedMessage: send failed for recipient ${target.id}:`,
    err instanceof Error ? err.message : String(err),
  );
  await recipientRef.set({
    personId: target.id,
    ...
```
A `generateSignInWithEmailLink` failure for one recipient must land inside this SAME per-recipient try/catch, not abort the whole send loop.

---

### `functions/src/messageTokens.ts` (add `rehearseLink` token)

**Analog:** same file, full contents already read (54 lines, small file — analyzed in one pass)

**Current shape** (real, exact):
```typescript
export interface MessageTokenContext {
  serviceDate: string;
  theirRoles: string[];
  recipientName: string;
  songTitles: string[];
  serviceLink: string;
}

export function renderMessageTokens(template: string, ctx: MessageTokenContext): string {
  const rolesText = ctx.theirRoles.length > 0 ? ctx.theirRoles.join(", ") : EMPTY_ROLES_PLACEHOLDER;
  const songText = ctx.songTitles.join(", ");

  let out = template;
  out = replaceToken(out, "service_date", ctx.serviceDate);
  out = replaceToken(out, "their_roles", rolesText);
  out = replaceToken(out, "name", ctx.recipientName);
  out = replaceToken(out, "song_list", songText);
  out = replaceToken(out, "service_link", ctx.serviceLink);
  return out;
}
```
**Modification:** add `rehearseLink: string;` to the interface and `out = replaceToken(out, "rehearse_link", ctx.rehearseLink);` to the renderer — same one-line-per-token idiom as `service_link`.

---

### `src/utils/rehearseAccess.ts` (new pure projection builder)

**Analog:** `buildServiceSnapshot()` in `src/stores/services.ts` — a pure builder function (no I/O) that assembles a frozen, PII-safe projection consumed by `shareTokens`/`ShareView.vue`. Follow the SAME idiom: pure function taking already-loaded Service + roster/assignment data, returning a plain object with no live references, no Firestore reads inside the builder itself. Combine with `resolveServiceRoleAssignments()` (`src/utils/serviceRoles.ts`) for assignment resolution and `SongAttachment.downloadUrl` (below) for media URLs.

---

### `src/types/song.ts` (`SongAttachment.downloadUrl` — reference, read-only for this phase)

**Analog / precedent to reuse as-is** (lines 26-38, real, exact):
```typescript
/** R369: a song's uploaded file or external link. See src/utils/songFiles.ts for the
 * storage path/constants helper. Uploads carry storagePath+downloadUrl; links carry
 * linkSource+href instead. */
export interface SongAttachment {
  id: string
  kind: SongAttachmentKind
  ...
  name: string
  /** Storage object path, uploads only: orgs/{orgId}/song-files/{id}/{sanitizedName}. */
  storagePath?: string
  /** Denormalized Storage download-token URL — reads never need a rules round-trip. */
  downloadUrl?: string
  ...
```
No `storage.rules` change needed for volunteer file access — the `rehearseAccess` projection carries this already-minted `downloadUrl` verbatim; volunteers fetch it directly (bearer capability URL, no rules evaluation on the GET).

---

### `src/rules.test.ts` (new R377 describe block)

**Analog:** existing `authenticatedContext(uid, { email })` calls, real and verified at lines 231, 254, 276, 307, 331, 374, 663 — e.g.:
```typescript
const context = testEnv.authenticatedContext('attacker', { email: 'attacker@example.com' })
```
This proves the harness already supports simulating a zero-membership, email-claim-only token — exactly the shape a magic-link volunteer has. New block should follow RESEARCH.md's Code Examples section (7 ALLOW/DENY cases): cross-org DENY, draft-service DENY (including the "projection exists but parent reopened" case per Pitfall 3), not-assigned DENY, planner-write DENY, direct `services/{id}` bypass DENY, unfiltered `list()` DENY, own-org+assigned ALLOW.

---

## Shared Patterns

### Email-claim authorization (no custom claims, no cross-service calls)
**Source:** `firestore.rules:189-192` (`invites/{email}`), `:335-352` (`inviteLookup/{email}`)
**Apply to:** the new `rehearseAccess` read rule — always `.lower()` both sides (roster email at write time in the projection builder, `request.auth.token.email` at read time in the rule).

### Frozen, PII-safe projection ("the link/claim is the auth")
**Source:** `buildServiceSnapshot()` + `shareTokens` (`src/stores/services.ts`, `firestore.rules:354-391`)
**Apply to:** `src/utils/rehearseAccess.ts` builder and the `rehearseAccess/{serviceId}` doc shape — no live joins, denormalize everything (including `downloadUrl`s) at write time.

### Editor-side client write at lock time (not a Cloud Function)
**Source:** `lockSnapshots` (`firestore.rules:250-259`, write flow in `src/stores/services.ts`)
**Apply to:** writing `rehearseAccess` at the draft→planned transition; also model the Reopen-time delete/flag on `shareTokens`' revocation-on-delete precedent in `deleteService()` (same file) to close Pitfall 3.

### Router org-selection gate exemption
**Source:** `src/router/index.ts:190` (`requiresSuperAdmin`/`select-church` exemptions)
**Apply to:** new `isVolunteerRoute` meta flag — pure route-metadata exemption, no new async check needed.

### Per-recipient try/catch in the send loop (never abort the batch)
**Source:** `functions/src/index.ts:2174-2220`
**Apply to:** the new `generateSignInWithEmailLink` call — must live inside the SAME per-recipient try/catch as the existing `resend.emails.send` call.

### Merge-token renderer (one field, one `replaceToken` line)
**Source:** `functions/src/messageTokens.ts` (full file, small)
**Apply to:** adding `rehearseLink`/`{{rehearse_link}}` — copy the `service_link` field's exact treatment.

## No Analog Found

None. Every file in this phase has a strong (exact or role-match) analog already shipped in this codebase; RESEARCH.md's core finding — that this phase reuses three already-proven primitives (email-claim rules, frozen projections, capability-URL media) — held up under direct verification of every cited line.

## Metadata

**Analog search scope:** `firestore.rules`, `storage.rules`, `src/router/index.ts`, `src/stores/auth.ts`, `src/stores/services.ts`, `src/views/LoginView.vue`, `src/types/song.ts`, `functions/src/index.ts`, `functions/src/messageTokens.ts`, `functions/src/adminEmail.ts`, `src/rules.test.ts`
**Files scanned:** 11 (all directly Read or Grepped in this session; no stale line numbers — every cited line was re-verified live, not carried over from RESEARCH.md unchecked)
**Pattern extraction date:** 2026-09-05
