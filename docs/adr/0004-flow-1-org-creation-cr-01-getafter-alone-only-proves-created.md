# 0004. Flow 1: org creation. CR-01: getAfter() alone only proves "createdBy

## Status

Accepted

## Context

This rationale is applied at 5 call site(s) within `firestore.rules`. No external review/research document is cited for this decision — it was a file-local judgment call.

Flow 1: org creation. CR-01: getAfter() alone only proves "createdBy CURRENTLY equals my uid" -- createdBy is set once and never cleared, so without the !exists() guard below, ANY past founder (even one explicitly remove...

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `CR-01`):

**`firestore.rules:195-207`:**

```
      // super-admin without one could never reach this line -- the
      // exemption was safe. Phase 78's super-admin arm (see isOrgEditor
      // above) makes isOrgEditor(orgId) true for EVERY super-admin on EVERY
      // org, so keeping `|| isSuperAdmin()` here would let ANY super-admin
      // client-write active/deactivatedAt/deactivatedBy/reactivatedAt/
      // reactivatedBy directly, skipping setOrgActive's deactivatedOrgs
      // claim fan-out and revokeRefreshTokens -- the CR-01/T-76-10 class of
      // bug, reopened by composition. Lifecycle fields are now
      // Admin-SDK-only for LITERALLY EVERYONE, super-admins included;
      // setOrgActive/deleteOrganization (both Admin SDK, bypassing rules
      // entirely) remain the only path. Proven by src/rules.test.ts: a
      // super-admin client updateDoc({active:false}) is DENIED and must use
      // the setOrgActive callable.
```

**`firestore.rules:259-267`:**

```
          // Flow 1: org creation. CR-01: getAfter() alone only proves "createdBy
          // CURRENTLY equals my uid" -- createdBy is set once and never cleared, so
          // without the !exists() guard below, ANY past founder (even one explicitly
          // removed via TeamView's "Remove member") could re-grant themselves
          // role: 'editor' at any later time with a bare setDoc, no batch required.
          // !exists() reflects state as of the START of this operation -- unlike
          // getAfter(), it CANNOT see this batch's own sibling org-create write, so
          // it is only true when the org genuinely did not exist before this batch
          // began. Combined with getAfter()'s post-batch createdBy check, the two
```

**`firestore.rules:547-552`:**

```
      // R077/CR-01: refreshed in place by an editor of the owning org so the
      // frozen snapshot never goes stale — mirrors quarterShares/serviceShares'
      // org-scoped idiom verbatim. The equality guard makes orgId immutable, so
      // a share can never be reassigned to another org. isSignedIn() alone is
      // deliberately rejected: it would reintroduce the exact cross-org-overwrite
      // bug (T-41-04) already fixed for quarterShares/serviceShares (CR-01).
```

**`firestore.rules:560-565`:**

```

    // Persistent share-link index (R076): token + provenance only, keyed by
    // serviceId. Org-editor-scoped CRUD, NEVER publicly readable — this is an
    // internal index, not a link ever handed to anyone (unlike shareTokens /
    // serviceShares above it, which ARE the public payload). orgId is immutable
    // on update, mirroring the CR-01 idiom.
```

**`firestore.rules:610-616`:**

```

    // Memorable-URL quarter shares: public read, org-editor-scoped create/update
    // (overwritten in place on every finalize, unlike frozen shareTokens). CR-01: shareId is
    // a guessable, deterministic string (`${slug}__q${N}-${year}`), so isSignedIn() alone let
    // any authenticated user of ANY org overwrite another org's public share doc. Both create
    // and update require the caller to be an editor of the orgId embedded in the doc, and
    // update additionally forbids changing orgId (no reassigning a share to a different org).
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `firestore.rules:195-207`
- `firestore.rules:259-267`
- `firestore.rules:547-552`
- `firestore.rules:560-565`
- `firestore.rules:610-616`
