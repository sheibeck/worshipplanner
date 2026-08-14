import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { REPLAY_TOLERANCE_SEC, verifySvixSignature } from "./webhookSignature";

// A self-consistent signer that mirrors the EXACT verifier steps (whsec_ strip →
// base64-decode → HMAC-SHA256 over `${id}.${ts}.${rawBody}` → base64). This is what
// makes the "valid" branch genuinely valid rather than a hand-waved fixture (research A5).
function signContent(rawBody: Buffer, id: string, ts: number, secret: string): string {
  const keyBytes = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const signedContent = `${id}.${ts}.${rawBody.toString("utf8")}`;
  return createHmac("sha256", keyBytes).update(signedContent).digest("base64");
}

function svixHeadersFor(
  rawBody: Buffer,
  ts: number,
  secret: string,
  id = "msg_2Kw9x1",
): Record<string, string> {
  return {
    "svix-id": id,
    "svix-timestamp": String(ts),
    "svix-signature": `v1,${signContent(rawBody, id, ts, secret)}`,
  };
}

// A whsec_-prefixed secret whose remainder is real base64 (so the base64-decode path exercises).
const SECRET = "whsec_" + Buffer.from("worship-planner-webhook-signing-key").toString("base64");

function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}

describe("verifySvixSignature", () => {
  it("exposes REPLAY_TOLERANCE_SEC as a 300s named constant", () => {
    expect(REPLAY_TOLERANCE_SEC).toBe(300);
  });

  it("returns true for a genuinely-valid v1 signature over the raw body", () => {
    const rawBody = Buffer.from(JSON.stringify({ type: "email.bounced", data: { email_id: "e1" } }));
    const ts = nowSec();
    expect(verifySvixSignature(rawBody, svixHeadersFor(rawBody, ts, SECRET), SECRET)).toBe(true);
  });

  it("returns false when the body is mutated after signing (HMAC no longer matches)", () => {
    const rawBody = Buffer.from(JSON.stringify({ type: "email.bounced", data: { email_id: "e1" } }));
    const ts = nowSec();
    const headers = svixHeadersFor(rawBody, ts, SECRET);
    const tampered = Buffer.from(JSON.stringify({ type: "email.bounced", data: { email_id: "HACKED" } }));
    expect(verifySvixSignature(tampered, headers, SECRET)).toBe(false);
  });

  it("returns false (never throws) when svix-id is missing", () => {
    const rawBody = Buffer.from("{}");
    const ts = nowSec();
    const { "svix-id": _omit, ...headers } = svixHeadersFor(rawBody, ts, SECRET);
    expect(() => verifySvixSignature(rawBody, headers, SECRET)).not.toThrow();
    expect(verifySvixSignature(rawBody, headers, SECRET)).toBe(false);
  });

  it("returns false when svix-timestamp is missing", () => {
    const rawBody = Buffer.from("{}");
    const ts = nowSec();
    const { "svix-timestamp": _omit, ...headers } = svixHeadersFor(rawBody, ts, SECRET);
    expect(verifySvixSignature(rawBody, headers, SECRET)).toBe(false);
  });

  it("returns false when svix-signature is missing or blank", () => {
    const rawBody = Buffer.from("{}");
    const ts = nowSec();
    const headers = svixHeadersFor(rawBody, ts, SECRET);
    expect(verifySvixSignature(rawBody, { ...headers, "svix-signature": "" }, SECRET)).toBe(false);
    const { "svix-signature": _omit, ...noSig } = headers;
    expect(verifySvixSignature(rawBody, noSig, SECRET)).toBe(false);
  });

  it("returns false (does NOT throw) for a candidate signature of the wrong byte-length", () => {
    const rawBody = Buffer.from("{}");
    const ts = nowSec();
    const headers = { ...svixHeadersFor(rawBody, ts, SECRET), "svix-signature": "v1,abc" };
    expect(() => verifySvixSignature(rawBody, headers, SECRET)).not.toThrow();
    expect(verifySvixSignature(rawBody, headers, SECRET)).toBe(false);
  });

  it("returns false for a stale timestamp outside the replay tolerance", () => {
    const rawBody = Buffer.from("{}");
    const staleTs = nowSec() - (REPLAY_TOLERANCE_SEC + 100);
    expect(verifySvixSignature(rawBody, svixHeadersFor(rawBody, staleTs, SECRET), SECRET)).toBe(false);
  });

  it("returns true for a timestamp just inside the replay tolerance", () => {
    const rawBody = Buffer.from("{}");
    const freshTs = nowSec() - (REPLAY_TOLERANCE_SEC - 1);
    expect(verifySvixSignature(rawBody, svixHeadersFor(rawBody, freshTs, SECRET), SECRET)).toBe(true);
  });

  it("returns false for a non-finite timestamp", () => {
    const rawBody = Buffer.from("{}");
    const headers = { ...svixHeadersFor(rawBody, nowSec(), SECRET), "svix-timestamp": "not-a-number" };
    expect(verifySvixSignature(rawBody, headers, SECRET)).toBe(false);
  });

  it("accepts a space-delimited multi-`v1,` header when ANY entry matches (key rotation)", () => {
    const rawBody = Buffer.from(JSON.stringify({ hello: "world" }));
    const ts = nowSec();
    const id = "msg_rotate";
    const good = signContent(rawBody, id, ts, SECRET);
    const bogus = Buffer.from("not-the-real-signature-but-right-ish-length").toString("base64");
    const headers = {
      "svix-id": id,
      "svix-timestamp": String(ts),
      "svix-signature": `v1,${bogus} v1,${good}`,
    };
    expect(verifySvixSignature(rawBody, headers, SECRET)).toBe(true);
  });

  it("returns false when no entry in a multi-`v1,` header matches", () => {
    const rawBody = Buffer.from(JSON.stringify({ hello: "world" }));
    const ts = nowSec();
    const a = Buffer.from("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa").toString("base64");
    const b = Buffer.from("bbbbbbbbbbbbbbbbbbbbbbbbbbbbbb").toString("base64");
    const headers = {
      "svix-id": "msg_x",
      "svix-timestamp": String(ts),
      "svix-signature": `v1,${a} v1,${b}`,
    };
    expect(verifySvixSignature(rawBody, headers, SECRET)).toBe(false);
  });

  it("strips whsec_ and base64-decodes the remainder — an unprefixed secret verifies the same way", () => {
    // The verifier's replace(/^whsec_/, '') is a no-op on an already-unprefixed secret,
    // so signing and verifying with the bare base64 key must still succeed.
    const bareSecret = Buffer.from("worship-planner-webhook-signing-key").toString("base64");
    const rawBody = Buffer.from(JSON.stringify({ type: "email.delivered" }));
    const ts = nowSec();
    expect(verifySvixSignature(rawBody, svixHeadersFor(rawBody, ts, bareSecret), bareSecret)).toBe(true);
    // And the whsec_-prefixed form of the same key bytes yields an identical verdict.
    expect(verifySvixSignature(rawBody, svixHeadersFor(rawBody, ts, SECRET), SECRET)).toBe(true);
  });

  it("normalizes array-valued headers to a single string", () => {
    const rawBody = Buffer.from("{}");
    const ts = nowSec();
    const id = "msg_arr";
    const sig = signContent(rawBody, id, ts, SECRET);
    const headers: Record<string, string | string[] | undefined> = {
      "svix-id": [id],
      "svix-timestamp": [String(ts)],
      "svix-signature": [`v1,${sig}`],
    };
    expect(verifySvixSignature(rawBody, headers, SECRET)).toBe(true);
  });

  it("honors a custom toleranceSec argument", () => {
    const rawBody = Buffer.from("{}");
    const ts = nowSec() - 50;
    const headers = svixHeadersFor(rawBody, ts, SECRET);
    expect(verifySvixSignature(rawBody, headers, SECRET, 10)).toBe(false);
    expect(verifySvixSignature(rawBody, headers, SECRET, 100)).toBe(true);
  });
});
