import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { CallableRequest, HttpsError, onCall } from "firebase-functions/v2/https";
import { Resend } from "resend";
import { getAppConfig } from "./appConfig";
import {
  RESEND_API_KEY,
  SERVICE_SHARE_BASE_URL,
  bareEmailAddress,
  fromDisplayName,
} from "./params";

// --- inviteOnboarding (Phase 99, R289-R291/R293: server-side invite-onboarding
// email + Auth provisioning) --------------------------------------------------
//
// Provisioning + email ONLY, best-effort (per 99-CONTEXT.md's locked
// responsibility split): the authoritative invite Firestore docs
// (organizations/{orgId}/invites/{email} + inviteLookup/{email}) are written
// by the CLIENT (TeamView.onInvite), unchanged -- that write is the source of
// truth for membership. This function never writes membership; Phase 100
// wires the client to call this callable AFTER its invite batch commits,
// inside a try/catch, so a failure here never blocks or reverts an invite.
//
// Two invitee-type branches, chosen by a pure domain-suffix classifier:
//  - gmail.com / googlemail.com  -> "sign in with Google" notify-only email.
//    No Auth account is created, no password step (R289) -- avoids the
//    Google<->password auth/account-exists-with-different-credential
//    linking conflict.
//  - every other domain -> resolve-or-create the Auth account, then send a
//    generatePasswordResetLink set-password email that ALSO offers Google
//    sign-in as a fallback, so a Google Workspace user on a custom domain is
//    never stranded (R290, R291).
//
// The onboarding.emailsEnabled owner toggle (Plan 99-01) is read via the
// existing TTL-cached getAppConfig(db) and gates BOTH branches before any
// Auth or Resend call (R293).
//
// DEFERRED (RESEARCH Pitfall 1): the per-org email quota
// (checkAndConsumeOrgEmailQuota) is NOT folded in here -- it lives in
// index.ts, which already imports this module for its re-export, so
// importing it back would be a circular import. Left as a documented future
// lever (see the threat register's T-99-05, disposition "accept").

export interface SendInviteOnboardingEmailRequest {
  orgId: string;
  email: string;
}

export interface SendInviteOnboardingEmailResponse {
  emailSent: boolean;
  kind: "google-notify" | "set-password" | "skipped-disabled" | "skipped-existing";
}

/**
 * Cheap server-side email-format guard. Fresh module-private copy, verbatim
 * shape ported from functions/src/orgProvisioning.ts:80-85 -- that function's
 * own assertValidEmailFormat is module-private there too, so it cannot be
 * imported (99-PATTERNS.md).
 */
function assertValidEmailFormat(email: string): void {
  const trimmed = email.trim();
  if (!trimmed || trimmed.includes("/") || !trimmed.includes("@") || !trimmed.includes(".")) {
    throw new HttpsError("invalid-argument", "Enter a valid email address.");
  }
}

/**
 * Resolve the app's usable share/sign-in base URL, or '' when unconfigured.
 * Fresh module-private copy, verbatim shape ported from
 * functions/src/adminEmail.ts:50-54 -- resolveAppBaseUrl is module-private
 * there too (99-RESEARCH.md Pitfall 5), so it cannot be imported.
 */
function resolveAppBaseUrl(): string {
  const base = SERVICE_SHARE_BASE_URL.value().trim();
  if (base === "") return "";
  return base.replace(/\/+$/, "");
}

/**
 * WR-01 (99-REVIEW): collapse any CR/LF out of a header-bound value (the email
 * subject) before it reaches the Resend send. `orgName` is org-doc-sourced
 * (super-admin controlled) so the risk is low, but this applies the SAME
 * header-injection defense the codebase already documents for the From display
 * name (params.ts's fromDisplayName) consistently to the subject line.
 */
function sanitizeHeader(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

/**
 * Domain-suffix classifier for the invitee-type branch (99-CONTEXT.md's
 * leaning default). Normalize FIRST (.trim().toLowerCase()) before calling --
 * mirrors resolveAdminTarget's normalizedEmail discipline. googlemail.com is
 * a real, still-valid Gmail alias domain (older/UK-registered accounts) and
 * must be checked alongside gmail.com. A custom Google Workspace domain
 * (e.g. bob@somechurch.org) is deliberately NOT detected here -- it takes the
 * non-Google branch, whose set-password email also offers a Google
 * sign-in fallback line so that user is never stranded.
 */
function isGoogleEmail(normalizedEmail: string): boolean {
  return normalizedEmail.endsWith("@gmail.com") || normalizedEmail.endsWith("@googlemail.com");
}

function buildGoogleNotifyContent(
  orgName: string,
  to: string,
  baseUrl: string,
): { subject: string; text: string } {
  const subject = `You've been invited to ${orgName} on Worship Planner`;
  const signIn = baseUrl
    ? `Sign in with Google using this email address (${to}) to get started: ${baseUrl}`
    : `Sign in with Google using this email address (${to}) to get started.`;
  const text =
    `You've been invited to help lead ${orgName} on Worship Planner.\n\n` +
    `${signIn}\n\n` +
    `No password is needed -- just sign in with Google using ${to}.`;
  return { subject, text };
}

function buildSetPasswordContent(
  orgName: string,
  to: string,
  baseUrl: string,
  resetLink: string,
): { subject: string; text: string } {
  const subject = `You've been invited to ${orgName} on Worship Planner`;
  const signInLine = baseUrl ? `Sign in at: ${baseUrl}` : "";
  const text =
    `You've been invited to help lead ${orgName} on Worship Planner.\n\n` +
    `Set your password to get started: ${resetLink}\n\n` +
    `Or, if ${to} is a Google Workspace address, you can sign in with Google instead -- no password needed.` +
    (signInLine ? `\n\n${signInLine}` : "");
  return { subject, text };
}

/**
 * The testable handler body, exported separately from the onCall wrapper
 * below -- mirrors onboardOrganizationHandler/queueServiceMessageHandler.
 *
 * Order (99-PATTERNS.md / 99-RESEARCH.md): auth presence -> input validation
 * -> org-editor caller gate (inline, mirrors queueServiceMessageHandler,
 * index.ts:2609-2668) -> org-name read -> appConfig on/off gate -> invitee
 * classification -> Auth provisioning (non-Google only) -> Resend send.
 *
 * Error tiers: a createUser/generatePasswordResetLink failure THROWS an
 * HttpsError('internal', ...) -- the invitee would otherwise have no usable
 * path at all. A getUserByEmail failure that is NOT auth/user-not-found is
 * RETHROWN as-is (mirrors resolveAdminTarget's discrimination). Only the
 * final Resend send is best-effort: caught, logged, resolved as
 * { emailSent: false, kind } so a failure there never masquerades as a
 * thrown error once the Auth side has already succeeded.
 */
export async function sendInviteOnboardingEmailHandler(
  request: CallableRequest<SendInviteOnboardingEmailRequest>,
): Promise<SendInviteOnboardingEmailResponse> {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign in required.");
  }

  const { orgId, email } = request.data ?? ({} as SendInviteOnboardingEmailRequest);
  if (typeof orgId !== "string" || orgId.trim() === "") {
    throw new HttpsError("invalid-argument", "orgId is required.");
  }
  if (typeof email !== "string" || email.trim() === "") {
    throw new HttpsError("invalid-argument", "email is required.");
  }
  assertValidEmailFormat(email);

  const db = getFirestore();
  const orgRef = db.collection("organizations").doc(orgId);

  // Org-editor caller gate -- independent re-check, never trust a
  // client-declared orgId/role. Mirrors queueServiceMessageHandler exactly
  // (the only existing org-editor, not-super-admin, precedent).
  const memberDoc = await orgRef.collection("members").doc(request.auth.uid).get();
  if (!memberDoc.exists) {
    throw new HttpsError("permission-denied", "You are not a member of this organization.");
  }
  const role = (memberDoc.data() as { role?: string } | undefined)?.role;
  // Accept both 'editor' and the legacy 'admin' member-role value -- mirrors
  // queueServiceMessageHandler (index.ts) exactly. 'admin' is a still-supported
  // legacy role on older member docs (new orgs are provisioned with 'editor'),
  // treated as editor-equivalent everywhere else (orgMembershipClaims.ts,
  // src/stores/auth.ts); rejecting it would silently lock a legacy-admin owner
  // out of inviting once TeamView wires this in (Phase 100).
  if (role !== "editor" && role !== "admin") {
    throw new HttpsError("permission-denied", "You must be an editor to invite members.");
  }

  const orgSnap = await orgRef.get();
  if (!orgSnap.exists) {
    throw new HttpsError("not-found", `No organization found for id "${orgId}".`);
  }
  const orgName = (orgSnap.data() as { name?: string } | undefined)?.name ?? "";

  const config = await getAppConfig(db);
  if (!config.onboarding.emailsEnabled) {
    return { emailSent: false, kind: "skipped-disabled" };
  }

  const normalizedEmail = email.trim().toLowerCase();

  // CR-01 (99-REVIEW): bind every provisioning + send to a REAL pending invite
  // record. This callable creates Firebase Auth accounts and emails
  // caller-supplied addresses; without this gate an org editor could invoke it
  // directly with attacker-chosen emails to send convincing "invited to {org}"
  // messages -- carrying genuine password-reset links -- to arbitrary third
  // parties from our own Resend sending domain. TeamView.onInvite writes the
  // authoritative invite doc (same trim().toLowerCase() normalization) BEFORE
  // calling this function, so the doc's absence means this is not a legitimate
  // invite send. Ties the blast radius to invites the org actually created.
  const inviteSnap = await orgRef.collection("invites").doc(normalizedEmail).get();
  if (!inviteSnap.exists) {
    throw new HttpsError(
      "failed-precondition",
      "No pending invite exists for this address in this organization.",
    );
  }

  const baseUrl = resolveAppBaseUrl();
  const fromEmail = bareEmailAddress(config.sender.fromAddress);
  const displayName = fromDisplayName(orgName);
  const from = displayName ? `"${displayName}" <${fromEmail}>` : fromEmail;
  const resend = new Resend(RESEND_API_KEY.value());

  if (isGoogleEmail(normalizedEmail)) {
    const { subject, text } = buildGoogleNotifyContent(orgName, normalizedEmail, baseUrl);
    try {
      // The Resend SDK does NOT throw on an API-level rejection (e.g. test-mode
      // "you can only send to your own address", invalid recipient, quota) --
      // it RESOLVES with { data, error }. Only a network/transport failure
      // throws. So a truthy `error` means the send did not happen; reporting
      // emailSent:true without checking it produced a false "sent" (green copy,
      // nothing in Resend).
      const { error } = await resend.emails.send({
        from,
        to: normalizedEmail,
        subject: sanitizeHeader(subject),
        text,
      });
      if (error) {
        console.error(
          `[inviteOnboarding] google-notify send rejected for orgId=${orgId}, to=${normalizedEmail}:`,
          error,
        );
        return { emailSent: false, kind: "google-notify" };
      }
      return { emailSent: true, kind: "google-notify" };
    } catch (err) {
      console.error(
        `[inviteOnboarding] google-notify send failed for orgId=${orgId}, to=${normalizedEmail}:`,
        err,
      );
      return { emailSent: false, kind: "google-notify" };
    }
  }

  // Non-Google branch: resolve-or-create the Auth user FIRST (Pitfall 2 --
  // generatePasswordResetLink requires the user to already exist).
  try {
    await getAuth().getUserByEmail(normalizedEmail);
    // existing user -- do NOT re-create.
  } catch (err) {
    if ((err as { code?: string })?.code === "auth/user-not-found") {
      try {
        await getAuth().createUser({ email: normalizedEmail });
      } catch (createErr) {
        if ((createErr as { code?: string })?.code === "auth/email-already-exists") {
          // Race: another invite/sign-in created the user between our
          // getUserByEmail check and this createUser call. Fall through to
          // the reset-link path exactly as if getUserByEmail had found them.
        } else {
          console.error(
            `[inviteOnboarding] createUser failed for orgId=${orgId}, to=${normalizedEmail}:`,
            createErr,
          );
          throw new HttpsError("internal", "Could not provision the invited user's account.");
        }
      }
    } else {
      console.error(
        `[inviteOnboarding] getUserByEmail failed for orgId=${orgId}, to=${normalizedEmail}:`,
        err,
      );
      // WR-02 (99-REVIEW): surface a friendly HttpsError instead of the raw
      // Firebase error object (which would reach the client as an opaque
      // 'internal' with leaked provider detail) for any non-user-not-found
      // lookup failure.
      throw new HttpsError("internal", "Could not look up the invited user's account.");
    }
  }

  let resetLink: string;
  try {
    const actionCodeSettings = baseUrl ? { url: baseUrl } : undefined;
    resetLink = await getAuth().generatePasswordResetLink(normalizedEmail, actionCodeSettings);
  } catch (err) {
    console.error(
      `[inviteOnboarding] generatePasswordResetLink failed for orgId=${orgId}, to=${normalizedEmail}:`,
      err,
    );
    throw new HttpsError("internal", "Could not generate a set-password link.");
  }

  const { subject, text } = buildSetPasswordContent(orgName, normalizedEmail, baseUrl, resetLink);
  try {
    // See the google-notify branch: the Resend SDK RESOLVES with { data, error }
    // on an API-level rejection rather than throwing, so a truthy `error` must
    // be treated as a failed send (not a false emailSent:true).
    const { error } = await resend.emails.send({
      from,
      to: normalizedEmail,
      subject: sanitizeHeader(subject),
      text,
    });
    if (error) {
      console.error(
        `[inviteOnboarding] set-password send rejected for orgId=${orgId}, to=${normalizedEmail}:`,
        error,
      );
      return { emailSent: false, kind: "set-password" };
    }
    return { emailSent: true, kind: "set-password" };
  } catch (err) {
    console.error(
      `[inviteOnboarding] set-password send failed for orgId=${orgId}, to=${normalizedEmail}:`,
      err,
    );
    return { emailSent: false, kind: "set-password" };
  }
}

// Binds RESEND_API_KEY like onboardOrganization -- the smallest key-holding
// surface, never shipped to the browser.
export const sendInviteOnboardingEmail = onCall(
  { secrets: [RESEND_API_KEY] },
  sendInviteOnboardingEmailHandler,
);
