import { onRequest } from "firebase-functions/v2/https";

const PROXY_TARGETS: Record<string, string> = {
  planningcenter: "https://api.planningcenteronline.com",
  anthropic: "https://api.anthropic.com",
};

const FORWARDED_HEADERS = [
  "authorization",
  "content-type",
  "accept",
  "x-api-key",
  "anthropic-version",
  "anthropic-dangerous-direct-browser-access",
];

export const api = onRequest(async (req, res) => {
  // Extract service name from /api/<service>/...
  const match = req.path.match(/^\/api\/(\w+)(\/.*)?$/);
  if (!match || !match[1]) {
    res.status(404).json({ error: "Unknown route" });
    return;
  }

  const service = match[1];
  const target = PROXY_TARGETS[service];
  if (!target) {
    res.status(404).json({ error: `Unknown proxy target: ${service}` });
    return;
  }

  // Strip /api/<service> prefix to get the upstream path
  const prefix = `/api/${service}`;
  const upstreamPath = req.originalUrl.replace(prefix, "");
  const upstreamUrl = `${target}${upstreamPath}`;

  // Forward relevant headers
  const headers: Record<string, string> = {};
  for (const h of FORWARDED_HEADERS) {
    const val = req.headers[h];
    if (typeof val === "string") {
      headers[h] = val;
    }
  }

  try {
    const upstream = await fetch(upstreamUrl, {
      method: req.method,
      headers,
      body: ["GET", "HEAD"].includes(req.method)
        ? undefined
        : JSON.stringify(req.body),
    });

    res.status(upstream.status);
    const ct = upstream.headers.get("content-type");
    if (ct) res.set("content-type", ct);

    const body = await upstream.text();
    res.send(body);
  } catch (err) {
    console.error("Proxy error:", err);
    res.status(502).json({ error: "Upstream request failed" });
  }
});
