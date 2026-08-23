import { onCall, HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { getFirestore, FieldValue, type WriteBatch } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { assertSuperAdminCaller, normalizeOrgName } from "./orgProvisioning";

// --- orgDeletion (Phase 77, R215-R219, R221: super-admin-gated permanent
// church deletion cascade) ---------------------------------------------------
//
// This module deliberately does NOT call initializeApp() at module scope --
// mirrors orgProvisioning.ts / superAdminClaims.ts / orgMembershipClaims.ts:
// functions/src/index.ts already does that for the deployed runtime.
//
// deleteOrganizationHandler is the single most destructive, irreversible
// operation in this codebase. It is gated by the SAME assertSuperAdminCaller
// dual re-verification every other owner-console callable uses (T-77-01),
// plus two independent server-side re-checks the client cannot bypass:
//   - the org must already be deactivated (active === false) -- T-77-06
//   - confirmName must match the org's SERVER-STORED name, exactly -- T-77-02
//
// Cascade order (77-RESEARCH.md Cascade Order / Pattern 2 / Pitfall 1):
// every cross-reference this handler needs (member uids, inviteLookup docs,
// the orgNames guard read, and the 5 extra orgId-keyed collections) is READ
// and held in memory BEFORE any delete fires -- recursiveDelete/deleteFiles
// remove the very data those reads depend on, so reversing this order would
// silently orphan every affected user's `orgIds` claim (T-77-03/T-77-08).
//
// Deliberately OUT OF SCOPE (documented, not an oversight): `aiUsage` and
// `aiRateLimits` are a platform cost-observability ledger, not tenant
// content -- 77-RESEARCH.md Open Question 2 recommends leaving them alone.

/**
 * The 5 top-level collections that store `orgId` as a plain document field
 * (NOT nested under `organizations/{orgId}`, so `recursiveDelete` cannot see
 * them -- 77-RESEARCH.md Pitfall 2 / T-77-07). Exported as a single source of
 * truth so `orgDeletion.test.ts` can iterate this exact list rather than
 * duplicating the literal.
 */
export const EXTRA_ORG_KEYED_COLLECTIONS = [
  "shareTokens",
  "serviceShareLinks",
  "orgSlugs",
  "quarterShares",
  "serviceShares",
] as const;

/** Firestore's own hard cap on operations in a single WriteBatch. */
const BATCH_CHUNK_SIZE = 500;

export interface DeleteOrganizationRequest {
  orgId: string;
  confirmName: string;
}

export interface DeleteOrganizationResponse {
  orgId: string;
  name: string;
  membersUnlinked: number;
  invitesDeleted: number;
  orgNameDeleted: boolean;
  shareDocsDeleted: number;
  storageObjectsDeleted: number;
}

type PendingWrite =
  | { kind: "arrayRemove"; ref: FirebaseFirestore.DocumentReference; orgId: string }
  | { kind: "delete"; ref: FirebaseFirestore.DocumentReference };

/** Splits an array into chunks of at most `size` -- used to keep each
 * WriteBatch under Firestore's 500-operation cap (a large org's combined
 * member+invite+share-doc count could exceed that). */
function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function applyPendingWrite(batch: WriteBatch, write: PendingWrite): void {
  if (write.kind === "arrayRemove") {
    batch.set(write.ref, { orgIds: FieldValue.arrayRemove(write.orgId) }, { merge: true });
  } else {
    batch.delete(write.ref);
  }
}

/**
 * The testable handler body, exported separately from the `onCall` wrapper
 * below -- mirrors orgProvisioning.ts's established handler pattern.
 */
export async function deleteOrganizationHandler(
  request: CallableRequest<DeleteOrganizationRequest>,
): Promise<DeleteOrganizationResponse> {
  // T-77-01: FIRST line, before any org data is read.
  const callerUid = await assertSuperAdminCaller(request);

  const { orgId, confirmName } = request.data ?? ({} as DeleteOrganizationRequest);
  if (typeof orgId !== "string" || orgId.trim() === "") {
    throw new HttpsError("invalid-argument", "orgId is required.");
  }
  if (typeof confirmName !== "string" || confirmName.trim() === "") {
    throw new HttpsError("invalid-argument", "confirmName is required.");
  }

  const db = getFirestore();
  const orgRef = db.collection("organizations").doc(orgId);
  const orgSnap = await orgRef.get();
  if (!orgSnap.exists) {
    throw new HttpsError("not-found", `No organization found for id "${orgId}".`);
  }

  const orgData = orgSnap.data() as { name?: string; active?: boolean } | undefined;

  // T-77-06: read `active` fresh, at the START of every call -- never a
  // stale client snapshot. Same default-true posture as isOrgActive()/
  // setOrgActiveHandler -- only an EXPLICIT active:false is eligible.
  const active = orgData?.active ?? true;
  if (active) {
    throw new HttpsError("failed-precondition", "Deactivate the church before deleting it.");
  }

  // T-77-02: the client's echoed confirmName proves nothing on its own --
  // compare against the SERVER's own stored name, strict === (case-sensitive,
  // 77-RESEARCH.md Assumption A1).
  const orgName = orgData?.name ?? "";
  if (confirmName !== orgName) {
    throw new HttpsError("invalid-argument", "Typed name does not match the church name.");
  }

  // T-77-05: a single audit log line, once every guard above has passed and
  // before any destructive step begins -- the repudiation record of "who
  // deleted this church."
  console.warn(`[orgDeletion] deleteOrganization: orgId=${orgId}, name=${orgName}, callerUid=${callerUid}`);

  // --- READ phase (Pattern 2 / Pitfall 1): everything below MUST complete
  // before any delete/recursiveDelete/deleteFiles fires. -----------------

  const membersSnap = await orgRef.collection("members").get();
  const memberUids = membersSnap.docs.map((d) => d.id);

  const inviteLookupSnap = await db.collection("inviteLookup").where("orgId", "==", orgId).get();

  const nameKey = normalizeOrgName(orgName);
  const nameSnap = nameKey ? await db.collection("orgNames").doc(nameKey).get() : null;
  const shouldDeleteOrgName = !!nameSnap?.exists && (nameSnap.data() as { orgId?: string } | undefined)?.orgId === orgId;

  // The 5 orgId-keyed top-level collections recursiveDelete cannot see
  // (T-77-07) -- queried concurrently, each scoped to THIS orgId only.
  const extraCollectionSnaps = await Promise.all(
    EXTRA_ORG_KEYED_COLLECTIONS.map((name) => db.collection(name).where("orgId", "==", orgId).get()),
  );

  // --- WRITE phase (idempotent -- each step tolerates already-gone state,
  // R221). Built as one ordered list, then chunked into <=500-op batches and
  // committed sequentially -- never in parallel, so a partial failure never
  // interleaves with a later chunk in an unpredictable order. ------------

  const pendingWrites: PendingWrite[] = [];
  for (const uid of memberUids) {
    pendingWrites.push({ kind: "arrayRemove", ref: db.collection("users").doc(uid), orgId });
  }
  for (const doc of inviteLookupSnap.docs) {
    pendingWrites.push({ kind: "delete", ref: doc.ref });
  }
  if (shouldDeleteOrgName && nameSnap) {
    pendingWrites.push({ kind: "delete", ref: nameSnap.ref });
  }
  let shareDocsDeleted = 0;
  for (const snap of extraCollectionSnaps) {
    shareDocsDeleted += snap.size;
    for (const doc of snap.docs) {
      pendingWrites.push({ kind: "delete", ref: doc.ref });
    }
  }

  for (const batchWrites of chunk(pendingWrites, BATCH_CHUNK_SIZE)) {
    const batch = db.batch();
    for (const write of batchWrites) {
      applyPendingWrite(batch, write);
    }
    await batch.commit();
  }

  // --- Storage: every object under orgs/{orgId}/ (media, backgrounds,
  // pptx-imports, rendered, ...) -- a single prefix covers all of them
  // (77-RESEARCH.md Standard Stack). force:true so a transient per-object
  // failure never aborts the whole sweep (Pitfall 4). ---------------------

  const bucket = getStorage().bucket();
  const prefix = `orgs/${orgId}/`;
  const [files] = await bucket.getFiles({ prefix });
  await bucket.deleteFiles({ prefix, force: true });

  // --- Firestore: recursively delete the org doc + ALL subcollections at
  // every depth. LAST -- after every cross-reference and Storage cleanup
  // above has completed. ---------------------------------------------------

  await getFirestore().recursiveDelete(orgRef);

  return {
    orgId,
    name: orgName,
    membersUnlinked: memberUids.length,
    invitesDeleted: inviteLookupSnap.size,
    orgNameDeleted: shouldDeleteOrgName,
    shareDocsDeleted,
    storageObjectsDeleted: files.length,
  };
}

export const deleteOrganization = onCall(deleteOrganizationHandler);
