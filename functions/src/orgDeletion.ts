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
// See ADR-0039 (docs/adr/0039-operation-in-this-codebase-it-is-gated-by-the-same.md)

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

  // See ADR-0040 (docs/adr/0040-t-77-02-the-client-s-echoed-confirmname-proves-nothing-on-it.md)
  const orgName = orgData?.name ?? "";
  if (confirmName.trim() !== orgName.trim()) {
    throw new HttpsError("invalid-argument", "Typed name does not match the church name.");
  }

  // T-77-05: a single audit log line, once every guard above has passed and
  // before any destructive step begins -- the repudiation record of "who
  // deleted this church."
  console.warn(`[orgDeletion] deleteOrganization: orgId=${orgId}, name=${orgName}, callerUid=${callerUid}`);

  // See ADR-0041 (docs/adr/0041-read-phase-pattern-2-pitfall-1-everything-below-must.md)

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

  // See ADR-0042 (docs/adr/0042-storage-every-object-under-orgs-orgid-media-backgrounds.md)

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

// See ADR-0043 (docs/adr/0043-this-cascade-is-comparably-or-more-expensive-than-parsepptx.md)
export const deleteOrganization = onCall({ timeoutSeconds: 540, memory: "512MiB" }, deleteOrganizationHandler);
