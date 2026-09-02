import type { Firestore } from "firebase-admin/firestore";
import { Resend } from "resend";
import { getAppConfig } from "./appConfig";
import {
  RESEND_API_KEY,
  SERVICE_SHARE_BASE_URL,
  bareEmailAddress,
  fromDisplayName,
} from "./params";

// adminEmail (quick task 260823)
// See .planning/codebase/INTEGRATIONS.md (Backend Integration Notes (R318) § functions/src/adminEmail.ts)

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
