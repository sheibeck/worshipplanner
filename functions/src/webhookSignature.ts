import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Replay window (seconds) for the Svix `svix-timestamp` check. Svix's own libraries
 * default to a ±5-minute tolerance; the Svix/Resend docs say "make sure it's within
 * your tolerance" without stating the number.
 *
 * [ASSUMED — confirm against a real Resend event at owner verification] (research A1 /
 * Open Question 1). Loosen only if legitimate, slightly-delayed events are rejected.
 */
export const REPLAY_TOLERANCE_SEC = 300;

/**
 * Normalize a possibly-array HTTP header value to a single string. Node/Express expose
 * repeated headers as string[]; Svix headers are single-valued, so take the first entry.
 */
function hdr(
  headers: Record<string, string | string[] | undefined>,
  name: string,
): string | undefined {
  const value = headers[name];
  if (Array.isArray(value)) return value[0];
  return value;
}

/**
 * See .planning/codebase/INTEGRATIONS.md (Backend Integration Notes (R318) § functions/src/webhookSignature.ts)
 * @param rawBody   The exact received bytes (Cloud Functions `req.rawBody`).
 * @param headers   Request headers (values may be string | string[] | undefined).
 * @param secret    The `whsec_`-prefixed base64 signing secret.
 * @param toleranceSec  Replay window in seconds (defaults to REPLAY_TOLERANCE_SEC).
 */
export function verifySvixSignature(
  rawBody: Buffer,
  headers: Record<string, string | string[] | undefined>,
  secret: string,
  toleranceSec: number = REPLAY_TOLERANCE_SEC,
): boolean {
  const id = hdr(headers, "svix-id");
  const ts = hdr(headers, "svix-timestamp");
  const sigHeader = hdr(headers, "svix-signature");
  if (!id || !ts || !sigHeader) return false;

  // Replay window: reject a non-finite or out-of-tolerance timestamp.
  const tsNum = Number(ts);
  if (!Number.isFinite(tsNum)) return false;
  if (Math.abs(Date.now() / 1000 - tsNum) > toleranceSec) return false;

  // Key bytes: strip "whsec_" (no-op if already absent), base64-decode the remainder.
  const keyBytes = Buffer.from(secret.replace(/^whsec_/, ""), "base64");

  // Signed content is the exact UTF-8 payload — never a re-serialized object.
  const signedContent = `${id}.${ts}.${rawBody.toString("utf8")}`;
  const expected = createHmac("sha256", keyBytes).update(signedContent).digest("base64");
  const expectedBuf = Buffer.from(expected);

  // Header is space-delimited "v1,<sig> v1,<sig> ..."; strip the "v1," scheme prefix and
  // accept the first entry that matches. LENGTH-GUARD before timingSafeEqual — it THROWS
  // on unequal lengths, so a wrong-length candidate must be a clean miss, not a crash.
  for (const part of sigHeader.split(" ")) {
    if (!part) continue;
    const comma = part.indexOf(",");
    const sig = comma >= 0 ? part.slice(comma + 1) : part;
    const sigBuf = Buffer.from(sig);
    if (sigBuf.length === expectedBuf.length && timingSafeEqual(sigBuf, expectedBuf)) {
      return true;
    }
  }
  return false;
}
