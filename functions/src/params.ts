import { defineSecret, defineString } from "firebase-functions/params";

// params (shared, dependency-free)
// See .planning/codebase/INTEGRATIONS.md (Backend Integration Notes (R318) § functions/src/params.ts)

/**
 * The Resend email provider key. DECLARED once here (Google Secret Manager),
 * BOUND per-Function via each wrapper's `secrets: [RESEND_API_KEY]` array
 * (index.ts's sendQueuedMessage; orgProvisioning.ts's onboardOrganization) --
 * still the smallest key-holding surface (R131), never shipped to the browser.
 */
export const RESEND_API_KEY = defineSecret("RESEND_API_KEY");

/**
 * The public share-link base origin -- the APPLICATION's own base domain,
 * shared by ALL orgs. Config, not a secret (defineString). Defaults to the
 * app's hosting domain so links always render; override at deploy time for a
 * custom domain or locally (e.g. http://localhost:5173) for dev links. A blank
 * value renders as '' rather than a broken URL. A `*.web.app` address can never
 * be verified in Resend (Google-managed, no DNS access).
 */
export const SERVICE_SHARE_BASE_URL = defineString("SERVICE_SHARE_BASE_URL", {
  default: "https://worship-planner-bc515.web.app",
});

/**
 * Build a header-safe RFC 5322 display name from an org-supplied name. The org
 * name is user-controlled and flows into the From header, so CR/LF (email
 * header-injection vectors) and quote/backslash chars are stripped; the caller
 * wraps the result in a quoted-string. Empty in -> empty out (caller omits the
 * display name and sends the bare address).
 */
export function fromDisplayName(name: string | null | undefined): string {
  return (name ?? "").replace(/[\r\n]+/g, " ").replace(/["\\]/g, "").trim();
}

/**
 * Extract the bare email address from a configured From value. config.sender.fromAddress
 * may be a plain `email@x` OR an already-decorated `Display Name <email@x>` form.
 * We always re-apply the org name as the display name, so we must peel any
 * existing `<…>` off first -- otherwise wrapping produces an invalid nested
 * `"Org" <Name <email>>` and Resend 422s. Returns the inner address when
 * angle-bracketed, else the trimmed input.
 */
export function bareEmailAddress(configured: string): string {
  const m = configured.match(/<([^>]*)>/);
  return (m ? m[1] : configured).trim();
}
