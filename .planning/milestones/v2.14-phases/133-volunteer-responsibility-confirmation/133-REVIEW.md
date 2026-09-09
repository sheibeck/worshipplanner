---
phase: 133-volunteer-responsibility-confirmation
reviewed: 2026-09-07T00:00:00Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - firestore.rules
  - src/utils/confirmations.ts
  - src/utils/rehearseAccess.ts
  - src/stores/services.ts
  - src/components/rehearse/VolunteerConfirmBar.vue
  - src/views/VolunteerServiceView.vue
  - src/views/ServiceEditorView.vue
  - src/utils/messagingRecipients.ts
  - src/components/MessageComposer.vue
  - functions/src/serviceRoles.ts
  - functions/src/index.ts
findings:
  critical: 1
  warning: 2
  info: 2
  total: 5
status: issues_found
---

# Phase 133: Code Review Report

**Reviewed:** 2026-09-07
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found

## Summary

Reviewed the R410/R412/R413 volunteer confirmation feature: the new `confirmations`
subcollection rule, the pure key/model helpers, the volunteer write UI
(`VolunteerConfirmBar.vue`), the planner-visible live status chips
(`ServiceEditorView.vue`), the relock reconciliation (`services.ts`), and the
R413 server-authoritative `unconfirmedOnly` recipient filter
(`messagingRecipients.ts` / `functions/src/serviceRoles.ts` /
`functions/src/index.ts`).

The R413 server re-resolve is sound: the client's `recipientSelector.unconfirmedOnly`
is only a declared intent, `sendQueuedMessageHandler` re-reads `confirmations` via
the Admin SDK and re-filters authoritatively, and a read/parse failure of that
collection does not fail open to "send to everyone" — it aborts the whole
`Promise.all` (same failure shape as every other pre-existing read in that
function, not a new regression).

However, the `confirmations` write rule in `firestore.rules` has a real
authorization-boundary bug: the intended "editor arm" for the relock-reconciliation
write is coded as `isOrgMember(orgId)`, not `isOrgEditor(orgId)`. Every other
client-writable subcollection in this file (`lockSnapshots`, `rehearseAccess`,
`services/{docId}` itself) gates writes on `isOrgEditor`; this is the one
exception, and it is inconsistent with the rule's own inline comment ("Editor
arm..."). This grants any plain org member (a "viewer"-role account, or any
future non-editor role) unrestricted create/update/delete on every volunteer's
confirmation doc in the org — with none of the shape checks (own-email,
own-roleId, doc-id format, status pinned, field allowlist) that gate the
volunteer arm. This is proven, not theoretical: rules test (10) explicitly
seeds a `role: 'member'` (non-editor) membership doc and asserts the write
succeeds with an arbitrary payload. See CR-01 for the concrete exploit chain
into the R413 delivery guarantee.

Two lower-priority quality items follow: a redundant `get()` call inside the
confirmations rule block, and a write-only/never-validated `roleName` field.

## Critical Issues

### CR-01: `confirmations` create/update/delete grants any org member (not just editors) unrestricted write access

**File:** `firestore.rules:300-313`
**Issue:**

```
allow create, update: if isOrgMember(orgId)
  || ( isAssignedVolunteer() && ... );

allow delete: if isOrgMember(orgId)
  || (isAssignedVolunteer() && resource.data.emailLower == request.auth.token.email.lower());
```

The comment directly above (`firestore.rules:293-299`) describes this as the
"Editor arm: the relock-reconciliation write" and claims "a field allowlist so
no extra field can be smuggled onto the doc" protects *the doc* — but the
field allowlist (`hasOnly([...])`), the own-email check, the own-roleId check,
and the doc-id-format check are all inside the *second* disjunct only. The
first disjunct, `isOrgMember(orgId)`, is a bare `OR` with zero conditions
beyond org membership, and `isOrgMember` accepts **any** role (this app has
`'editor'` and `'viewer'`/non-editor member docs — see
`src/rules.test.ts:3226-3240`, which seeds `role: 'member'` and asserts the
write **succeeds**). Every other client-writable collection in this same file
gates writes on `isOrgEditor` (`lockSnapshots`, `rehearseAccess`,
`services/{docId}` itself) — this is the one write path in the file that
uses the member-level gate instead, with no comment justifying the deviation.

Concretely, a signed-in "viewer" (or any non-editor) member of the org can,
via a direct Firestore SDK call (no UI required):
- Create/overwrite `organizations/{orgId}/services/{serviceId}/confirmations/{anyId}`
  with **any** shape (the `hasOnly([...])` allowlist does not apply to this
  arm), including a doc id that does *not* match `${roleId}_${emailLower}`.
- Forge `status: 'confirmed'` for a volunteer who never confirmed. This
  directly undermines the R413 guarantee: `sendQueuedMessageHandler`
  (`functions/src/index.ts:2074-2079`) builds its `confirmedKeys` Set purely
  from `doc.id` + `status==='confirmed'`, trusting no other field on the doc.
  A forged `confirmations/r1_erin@example.com` with `status:'confirmed'`
  causes the server's `unconfirmedOnly` filter to silently skip erin — she
  never receives the reminder message, and nothing surfaces the discrepancy.
- Delete any other volunteer's real `confirmed` doc, reverting them to
  implicit "unconfirmed" and triggering unwanted reminder messages.
- Write a non-lowercased or malformed `emailLower`, corrupting the
  case-sensitive `confirmationKey()` lookups used by
  `ServiceEditorView.vue`'s live chip, `VolunteerConfirmBar.vue`'s own status
  read, and `MessageComposer.vue`'s preview.

**Fix:** Change both disjuncts from `isOrgMember(orgId)` to `isOrgEditor(orgId)`,
matching this file's established convention and the comment's stated intent:

```
allow create, update: if isOrgEditor(orgId)
  || (
    isAssignedVolunteer()
    && confirmationId == request.resource.data.roleId + '_' + request.resource.data.emailLower
    && request.resource.data.emailLower == request.auth.token.email.lower()
    && request.resource.data.roleId in rehearseAccessDoc().data.get('roleIdsByEmailLower', {}).get(request.auth.token.email.lower(), [])
    && request.resource.data.status == 'confirmed'
    && request.resource.data.keys().hasOnly(['roleId', 'roleName', 'emailLower', 'status', 'confirmedAt', 'updatedAt'])
  );

allow delete: if isOrgEditor(orgId)
  || (isAssignedVolunteer() && resource.data.emailLower == request.auth.token.email.lower());
```

Update rules test (10) to seed `role: 'editor'` (or `'admin'`) instead of
`role: 'member'`, and add a new DENY test asserting a plain member/viewer
membership doc is rejected for the same write, to lock in the corrected
boundary.

## Warnings

### WR-01: Redundant `get()` on the same `rehearseAccess` doc inside one rule evaluation

**File:** `firestore.rules:283-308`
**Issue:** `isAssignedVolunteer()` already calls `rehearseAccessDoc()` once
(a billed `get()`) to read `assignedEmailsLower`. The `create, update` rule
then calls `rehearseAccessDoc()` a second time to read `roleIdsByEmailLower`
— a second billed `get()` on the exact same document within the same
request evaluation. This file is otherwise careful to track and minimize
this per-request `get()`/`exists()` budget (see the `slideGroups` block's own
"3 of the 10-call budget" comment at `firestore.rules:390-392`); this path
adds an avoidable third read (`exists` + 2×`get`) for every single volunteer
confirmation write.
**Fix:** Bind the doc once and pass it through, e.g. restructure
`isAssignedVolunteer()` to accept/return the resolved doc so the `create,
update` rule can reuse it instead of re-calling `rehearseAccessDoc()`, or
inline both field reads (`assignedEmailsLower` and `roleIdsByEmailLower`)
into a single `let`-style helper call site.

### WR-02: `roleName` on the confirmation doc is client-supplied and never read back / validated

**File:** `firestore.rules:307`, `src/components/rehearse/VolunteerConfirmBar.vue:161-167`
**Issue:** The volunteer arm's field allowlist permits `roleName` as an
arbitrary string with no check that it matches the role's actual name for
`roleId` (only `roleId` itself is validated against `roleIdsByEmailLower`).
In the current codebase this field appears to be write-only — every UI that
displays a role name during confirmation (`VolunteerConfirmBar.vue`'s own
labels, `ServiceEditorView.vue`'s chip labels) sources the name from the
already-trusted `rehearseAccess`/roster projection, not from the stored
confirmation doc. If a future feature reads `roleName` directly off the
confirmation doc for display (e.g. a notification, an export, or an editor
dashboard), an unvalidated volunteer-supplied string would render verbatim.
**Fix:** Either drop `roleName` from the confirmation doc's allowlisted
fields (derive it from `rehearseAccess` at read time instead, as every
current consumer already does), or validate it server-side against
`roleAssignmentsByEmailLower` the same way `roleId` is validated.

## Info

### IN-01: `confirmationKey` concatenation has a theoretical collision surface

**File:** `src/utils/confirmations.ts:40-42`, `firestore.rules:303`
**Issue:** `confirmationKey(roleId, emailLower)` returns
`` `${roleId}_${emailLower}` ``, and the rule reconstructs it the same way
(`request.resource.data.roleId + '_' + request.resource.data.emailLower`).
If a `roleId` could itself contain an underscore, two different
`(roleId, emailLower)` pairs could theoretically produce the same
concatenated string (e.g. `roleId="a", emailLower="b_x@y.com"` vs.
`roleId="a_b", emailLower="x@y.com"`). In practice `roleId` is a Firestore
auto-generated document id (base62, no underscore), so this is not currently
exploitable — noting it because the rule's own comment
(`firestore.rules:296`, "doc-id format matches its own fields") relies on
this join being unambiguous, and that assumption isn't stated anywhere.
**Fix:** No action required today; if `roleId` is ever allowed to be a
user-editable slug, add a delimiter that cannot appear in either component
(or reject `_` in role ids at creation).

### IN-02: `reconcileConfirmations` best-effort read/write race is undocumented at the call site beyond a comment

**File:** `src/stores/services.ts:316-363`
**Issue:** `reconcileConfirmations` does a one-time `getDocs` snapshot of the
confirmations subcollection and then issues per-doc `updateDoc` flips with no
transaction. A volunteer confirming concurrently with a relock (narrow but
non-zero window: an editor re-locks a service while a volunteer taps "I've
got it" for a role that is about to be invalidated) can race: the volunteer's
fresh `confirmed` write could be overwritten by a flip computed from the
stale pre-relock snapshot, or vice versa. The code comment documents the
best-effort/non-blocking contract clearly but does not mention this specific
race; it's likely an accepted tradeoff (relock is a narrow, editor-only
window) but worth a one-line note for the next person reading this function
in isolation.
**Fix:** Optional — add a short comment noting the race is accepted because
relock is a narrow, low-frequency editor action, or wrap the diff+flip in a
Firestore transaction if this proves troublesome in practice.

---

_Reviewed: 2026-09-07_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
