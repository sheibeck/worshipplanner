import type { Firestore } from "firebase-admin/firestore";
import { Resend } from "resend";
import { getAppConfig } from "./appConfig";
import {
  RESEND_API_KEY,
  SERVICE_SHARE_BASE_URL,
  bareEmailAddress,
  fromDisplayName,
} from "./params";

// --- adminEmail (quick task 260823) ------------------------------------------
//
// A reusable, best-effort admin-notification email helper. Today it is wired
// into onboardOrganization (super-admin onboards a new church -> tell the
// assigned admin), but it is deliberately kept generic (kind: 'added' |
// 'invited') so assignOrgAdmin can adopt it later with a one-line call.
//
// Mirrors index.ts's sendQueuedMessage From-header construction verbatim (via
// the shared params.ts helpers): the org's own name is the RFC 5322 display
// name (header-sanitized) over the app's configured sending address
// (config.sender.fromAddress, resolved live from appConfig/global). The bare
// address is peeled first so a legacy "Name <email>" configured value never
// nests angle brackets.
//
// ⚠ Delivery caveat: DEFAULT_APP_CONFIG.sender.fromAddress is Resend's test
// sender `onboarding@resend.dev`, which only delivers to the Resend account
// owner until a real domain is verified + configured (v1.9 R191/R192). This
// helper builds the SEND PATH; real delivery to arbitrary admins still awaits
// that domain verification.

/** Whether the assigned admin already had an account ('added') or is a brand
 * new invite ('invited') -- selects the subject + body copy. */
export type AdminOnboardingKind = "added" | "invited";

export interface SendAdminOnboardingEmailArgs {
  db: Firestore;
  /** The assigned admin's email address (already validated + normalized). */
  to: string;
  /** The church/org display name the admin was assigned to. */
  orgName: string;
  kind: AdminOnboardingKind;
}

/**
 * Resolve the app's usable share/sign-in base URL, or '' when unconfigured or
 * pointing at a non-usable value. Mirrors resolveServiceLink's `base === ""`
 * guard: a blank base means "omit the URL gracefully" rather than render a
 * broken link.
 */
function resolveAppBaseUrl(): string {
  const base = SERVICE_SHARE_BASE_URL.value().trim();
  if (base === "") return "";
  return base.replace(/\/+$/, "");
}

function buildAddedContent(orgName: string, baseUrl: string): { subject: string; text: string } {
  const subject = `You've been added as an admin to ${orgName}`;
  const signIn = baseUrl
    ? `Sign in to Worship Planner to get started: ${baseUrl}`
    : "Sign in to Worship Planner to get started.";
  const text =
    `You've been added as an admin to ${orgName} on Worship Planner.\n\n` +
    `${signIn}\n\n` +
    `You can now manage services, songs, and volunteers for ${orgName}.`;
  return { subject, text };
}

function buildInvitedContent(
  orgName: string,
  to: string,
  baseUrl: string,
): { subject: string; text: string } {
  const subject = `You've been invited to ${orgName} on Worship Planner`;
  const signIn = baseUrl
    ? `Sign in to Worship Planner with this email address (${to}) to get started: ${baseUrl}`
    : `Sign in to Worship Planner with this email address (${to}) to get started.`;
  const text =
    `You've been invited to help lead ${orgName} on Worship Planner.\n\n` +
    `${signIn}\n\n` +
    `Signing in with ${to} activates your admin access to ${orgName}.`;
  return { subject, text };
}

/**
 * Send the assigned admin their onboarding notification. Best-effort: the
 * caller (onboardOrganization) invokes this AFTER its transaction commits and
 * inside a try/catch, so a send failure never fails onboarding -- the org is
 * already created. Returns normally on success; THROWS on a send failure so
 * the caller can distinguish and record `emailSent: false`.
 */
export async function sendAdminOnboardingEmail(
  args: SendAdminOnboardingEmailArgs,
): Promise<void> {
  const { db, to, orgName, kind } = args;

  const config = await getAppConfig(db);
  const fromEmail = bareEmailAddress(config.sender.fromAddress);
  const displayName = fromDisplayName(orgName);
  const from = displayName ? `"${displayName}" <${fromEmail}>` : fromEmail;

  const baseUrl = resolveAppBaseUrl();
  const { subject, text } =
    kind === "added"
      ? buildAddedContent(orgName, baseUrl)
      : buildInvitedContent(orgName, to, baseUrl);

  const resend = new Resend(RESEND_API_KEY.value());
  await resend.emails.send({ from, to, subject, text });
}
