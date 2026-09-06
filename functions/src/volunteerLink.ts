import type { Firestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { Resend } from "resend";
import { getAppConfig } from "./appConfig";
import {
  RESEND_API_KEY,
  SERVICE_SHARE_BASE_URL,
  bareEmailAddress,
  fromDisplayName,
} from "./params";

// volunteerLink (Phase 128) -- shared Admin-SDK mint + Resend send core for
// self-service magic-link requests. Mirrors adminEmail.ts's standalone-send
// shape exactly, adding the Admin-SDK mint step before the send.
// mintVolunteerLink (Phase 129) is now the sole mint primitive;
// mintAndSendVolunteerLink composes it with the send below (R402). Phase
// 129's admin-resend callable imports both rather than duplicating either.
// See .planning/codebase/INTEGRATIONS.md (Backend Integration Notes (R318) § functions/src/volunteerLink.ts)

export interface MintAndSendVolunteerLinkArgs {
  db: Firestore;
  /** The volunteer's email address (already validated + normalized by the caller). */
  to: string;
  /** The church/org display name -- used for the From header and the email body copy. */
  orgName: string;
  /** The org's own slug, carried on the continueUrl so a failed/expired sign-in
   * can one-tap re-request against the same church (R399). */
  slug: string;
}

/**
 * Resolve the app's usable share/sign-in base URL, or '' when unconfigured.
 * Mirrors adminEmail.ts's resolveAppBaseUrl idiom.
 */
function resolveAppBaseUrl(): string {
  const base = SERVICE_SHARE_BASE_URL.value().trim();
  if (base === "") return "";
  return base.replace(/\/+$/, "");
}

/**
 * Mint a passwordless sign-in link for `to` (Admin SDK -- the client cannot
 * mint this itself). The `slug` query param is placed on the URL BEFORE the
 * mint call so it survives ahead of Firebase's own apiKey/oobCode/mode
 * params (which it appends with `&`). The sole Admin SDK mint call site
 * (R402) -- mintAndSendVolunteerLink composes this with sending below, and
 * Phase 129's copy-mode admin path calls this directly.
 */
export async function mintVolunteerLink(args: { to: string; slug: string }): Promise<string> {
  const baseUrl = resolveAppBaseUrl();
  const actionCodeSettings = {
    url: `${baseUrl}/volunteer/verify?slug=${encodeURIComponent(args.slug)}`,
    handleCodeInApp: true,
  };
  return getAuth().generateSignInWithEmailLink(args.to, actionCodeSettings);
}

/**
 * Mint (via mintVolunteerLink) and deliver a passwordless sign-in link via a
 * standalone, one-off email with its own subject/body (NOT a
 * service-reminder template).
 */
export async function mintAndSendVolunteerLink(
  args: MintAndSendVolunteerLinkArgs,
): Promise<void> {
  const { db, to, orgName, slug } = args;

  const config = await getAppConfig(db);
  const fromEmail = bareEmailAddress(config.sender.fromAddress);
  const displayName = fromDisplayName(orgName);
  const from = displayName ? `"${displayName}" <${fromEmail}>` : fromEmail;

  const link = await mintVolunteerLink({ to, slug });

  const subject = `Your sign-in link for ${orgName}`;
  const text =
    `Here's your one-time sign-in link for ${orgName} on Worship Planner:\n\n` +
    `${link}\n\n` +
    "This link is just for you -- please don't share it. If you didn't request " +
    "this, you can safely ignore this email.";

  const resend = new Resend(RESEND_API_KEY.value());
  await resend.emails.send({ from, to, subject, text });
}
