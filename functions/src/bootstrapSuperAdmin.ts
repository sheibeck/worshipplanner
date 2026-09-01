import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { mergeAndSetCustomClaims } from "./claimsHelpers";

// --- bootstrapSuperAdmin (R176: the owner-run FIRST super-admin grant) ----
//
// THIS IS A NODE SCRIPT, NOT A DEPLOYED FUNCTION (mirrors backfillOrgClaims.ts's
// D-12). It is run by the owner with admin credentials and is deliberately NOT
// exported from functions/src/index.ts -- it is not part of the deployable
// function surface (T-68-04).
//
// CHICKEN-AND-EGG: setSuperAdminClaim (./superAdminClaims.ts) requires the
// CALLER to already be a super-admin -- so there is no client-reachable way to
// grant the very first one. This script is that first grant's only path, and
// See ADR-0014 (docs/adr/0014-requires-no-pre-existing-super-admin-resolves-by-email-exact.md)
// already deployed, its own write is simply a redundant no-op (the claim
// already matches).
//
// SINGLE --apply GATE (Open Question 2, resolved): an additional confirm flag
// (e.g. --yes-i-am-sure) was considered and rejected -- backfillOrgClaims.ts
// already establishes this repo's single-gate convention for owner-run
// claim-writing scripts, and a second flag would only add friction without a
// second failure mode it actually protects against.
//
// SAFETY: dry run is the default. Nothing is written to Firestore or Auth
// unless --apply is passed. The CLI wrapper below prints the resolved project
// id and a dry-run/apply banner before doing any work, so a rehearsal can
// never be mistaken for the real thing (mirrors backfillOrgClaims.ts D-13/D-14).

/** Options controlling whether the grant is actually written. */
export interface BootstrapOptions {
  /** When false (the default), nothing is written to Firestore or Auth. */
  apply: boolean;
  /** The target's email address, resolved to a uid via getAuth().getUserByEmail(). */
  email: string;
}

export interface BootstrapResult {
  uid: string;
  email: string;
  applied: boolean;
}

/**
 * Resolves `options.email` to a uid, and -- only when `options.apply` is true --
 * writes superAdmins/{uid} ({ email, grantedBy: 'bootstrap', grantedAt }) AND
 * calls mergeAndSetCustomClaims(uid, { superAdmin: true }) directly.
 *
 * Does NOT depend on the syncSuperAdminClaim trigger being deployed (see
 * header comment above) -- the claim write happens right here, not solely via
 * the Firestore document.
 */
export async function bootstrapSuperAdmin(options: BootstrapOptions): Promise<BootstrapResult> {
  const { apply, email } = options;

  const targetUser = await getAuth().getUserByEmail(email);
  const uid = targetUser.uid;

  console.log(`[bootstrapSuperAdmin] resolved ${email} -> uid ${uid}`);

  if (apply) {
    await getFirestore()
      .collection("superAdmins")
      .doc(uid)
      .set({
        email,
        grantedBy: "bootstrap",
        grantedAt: new Date(),
      });
    await mergeAndSetCustomClaims(uid, { superAdmin: true });
    console.log(`[bootstrapSuperAdmin] wrote superAdmins/${uid} and set the superAdmin claim.`);
  } else {
    console.log(
      `[bootstrapSuperAdmin] dry run -- would write superAdmins/${uid} and set the superAdmin claim.`,
    );
  }

  return { uid, email, applied: apply };
}

// --- CLI wrapper -----------------------------------------------------------
//
// Guarded so importing this module (as bootstrapSuperAdmin.test.ts does) never
// calls initializeApp() or touches a live project -- only running it directly
// does.
//
// Usage (after `npm run build` from functions/):
// See ADR-0015 (docs/adr/0015-node-lib-bootstrapsuperadmin-js-email-owner-example-com-dry.md)
export async function runBootstrapCli(): Promise<void> {
  try {
    initializeApp();

    const apply = process.argv.includes("--apply");
    const emailFlagIndex = process.argv.indexOf("--email");
    const email = emailFlagIndex !== -1 ? process.argv[emailFlagIndex + 1] : undefined;

    const projectId =
      process.env.GOOGLE_CLOUD_PROJECT ?? process.env.GCLOUD_PROJECT ?? "(unresolved project id)";
    console.log(`[bootstrapSuperAdmin] target project: ${projectId}`);
    if (apply) {
      console.log(
        "[bootstrapSuperAdmin] APPLY MODE -- the superAdmins doc and claim will be written for real.",
      );
    } else {
      console.log(
        "[bootstrapSuperAdmin] ==== DRY RUN ==== nothing will be written. Pass --apply to write for real.",
      );
    }

    if (!email) {
      console.error(
        "[bootstrapSuperAdmin] --email <address> is required, e.g. --email owner@example.com",
      );
      process.exitCode = 1;
      return;
    }

    await bootstrapSuperAdmin({ apply, email });
  } catch (err) {
    console.error("[bootstrapSuperAdmin] aborted -- top-level failure:", err);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  void runBootstrapCli();
}
