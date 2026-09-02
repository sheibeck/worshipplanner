import { onCall, HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { clearClaimKeys, mergeAndSetCustomClaims } from "./claimsHelpers";

// superAdminClaims (R174/R175-B/R176/R179: the owner-console access gate)
// See .planning/codebase/ARCHITECTURE.md (Backend Behavioral Notes (R318) § functions/src/superAdminClaims.ts)

/** The exact top-level custom-claim key this module ever writes. */
export const SUPER_ADMIN_CLAIM_KEYS = ["superAdmin"] as const;

export interface SyncSuperAdminClaimParams {
  uid: string;
  /** Whether superAdmins/{uid} exists AFTER this write -- true = grant, false = revoke. */
  granted: boolean;
}

export type SyncSuperAdminClaimOutcome =
  | { action: "set" }
  | { action: "clear" }
  | { action: "failed"; error: string };

/** See .planning/codebase/ARCHITECTURE.md (Backend Behavioral Notes (R318) § functions/src/superAdminClaims.ts) */
export async function syncSuperAdminClaimHandler(
  params: SyncSuperAdminClaimParams,
): Promise<SyncSuperAdminClaimOutcome> {
  const { uid, granted } = params;

  try {
    if (granted) {
      await mergeAndSetCustomClaims(uid, { superAdmin: true });
      return { action: "set" };
    }
    await clearClaimKeys(uid, SUPER_ADMIN_CLAIM_KEYS);
    return { action: "clear" };
  } catch (err) {
    console.error("[superAdminClaims] syncSuperAdminClaim:", err);
    return { action: "failed", error: String(err) };
  }
}

export const syncSuperAdminClaim = onDocumentWritten("superAdmins/{uid}", async (event) => {
  await syncSuperAdminClaimHandler({
    uid: event.params.uid,
    granted: event.data?.after.exists === true,
  });
});

// --- setSuperAdminClaim (T-68-03: the privileged grant/revoke onCall) ------
//
// This is the ONLY client-reachable way to grant or revoke super-admin
// status (besides the owner-run bootstrapSuperAdmin.ts script for the very
// first grant). It never sets the claim itself -- it writes or deletes the
// superAdmins/{targetUid} source document, and syncSuperAdminClaim (above)
// is the sole claim writer, exactly mirroring TeamView.vue's
// members/{uid}-document-is-the-source-of-truth model.

export interface SetSuperAdminClaimRequest {
  targetEmail: string;
  grant: boolean;
}

export interface SetSuperAdminClaimResponse {
  ok: true;
}

/** See .planning/codebase/ARCHITECTURE.md (Backend Behavioral Notes (R318) § functions/src/superAdminClaims.ts) */
export async function setSuperAdminClaimHandler(
  request: CallableRequest<SetSuperAdminClaimRequest>,
): Promise<SetSuperAdminClaimResponse> {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign in required.");
  }

  // Re-check #1: the caller's own ID-token claim.
  if (request.auth.token.superAdmin !== true) {
    throw new HttpsError("permission-denied", "You must be a super-admin.");
  }

  // Re-check #2: an independent Firestore re-read of the source-of-truth
  // document. Defense-in-depth against a stale/forged token claim -- mirrors
  // this repo's own privileged-onCall pattern of never trusting a single
  // signal (parsePptxHandler / queueServiceMessageHandler's member re-reads).
  const callerDoc = await getFirestore()
    .collection("superAdmins")
    .doc(request.auth.uid)
    .get();
  if (!callerDoc.exists) {
    throw new HttpsError("permission-denied", "You must be a super-admin.");
  }

  const { targetEmail, grant } = request.data ?? ({} as SetSuperAdminClaimRequest);
  if (typeof targetEmail !== "string" || targetEmail.trim() === "") {
    throw new HttpsError("invalid-argument", "targetEmail is required.");
  }
  // See ADR-0056 (docs/adr/0056-grant-must-be-validated-as-an-actual-boolean-not-branched-on.md)
  if (typeof grant !== "boolean") {
    throw new HttpsError("invalid-argument", "grant (boolean) is required.");
  }

  let targetUid: string;
  try {
    const targetUser = await getAuth().getUserByEmail(targetEmail);
    targetUid = targetUser.uid;
  } catch (err) {
    console.error("[superAdminClaims] setSuperAdminClaim: getUserByEmail failed:", err);
    throw new HttpsError("not-found", `No user found for email "${targetEmail}".`);
  }

  const targetRef = getFirestore().collection("superAdmins").doc(targetUid);

  if (grant) {
    await targetRef.set({
      email: targetEmail,
      grantedBy: request.auth.uid,
      grantedAt: FieldValue.serverTimestamp(),
    });
  } else {
    // Delete the source document (the trigger clears the claim), then force
    // the target's existing sessions to re-verify -- SC5 "loses access on
    // next token refresh" / T-68-05. The residual <=1hr token-lifetime
    // propagation window is documented in the Plan 05 runbook, not treated
    // as instantaneous.
    await targetRef.delete();
    await getAuth().revokeRefreshTokens(targetUid);
  }

  return { ok: true };
}

export const setSuperAdminClaim = onCall(setSuperAdminClaimHandler);
