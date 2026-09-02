import { getAppAuthHeaders } from '@/utils/appAuth'

/**
 * Fetches an NLT passage and returns it reformatted into the exact `[N] text`
 * bracketed-verse-number convention `scriptureSplitter.ts::parseVerses` depends
 * on. Mirrors `src/utils/esvApi.ts::fetchPassageText`'s shape and failure contract.
 * See .planning/codebase/INTEGRATIONS.md (Utils Integration Notes — src/utils/nltApi.ts)
 */
export async function fetchNltPassageText(query: string): Promise<string> {
  const params = new URLSearchParams({ ref: query, version: 'NLT' })

  // Routed through the /api/nlt proxy (Cloud Function) so NLT_API_KEY stays
  // server-side and never ships in the client bundle. The proxy injects the
  // `key` query param server-side (functions/src/index.ts buildUpstreamUrl);
  // we only send our app-identity token for the x-app-auth gate.
  const response = await fetch(`/api/nlt/api/passages?${params.toString()}`, {
    headers: await getAppAuthHeaders(),
  })

  if (!response.ok) {
    throw new Error('Failed to fetch passage')
  }

  const html = await response.text()
  // NLT returns HTTP 200 with an EMPTY body for a bad ref/version — verified
  // live against the real API (45-RESEARCH.md § Error shape). Unlike ESV's
  // structured `{ passages: [] }` failure shape, NLT has no structured error
  // payload at all to fall back on, so `response.ok` alone is NOT sufficient
  // here — an empty/whitespace body must be treated as a fetch failure too.
  if (!html.trim()) {
    throw new Error('Failed to fetch passage')
  }

  let stripped: string
  try {
    stripped = stripNltHtml(html)
  } catch {
    // stripNltHtml throws its own Error('Unexpected NLT response shape') on
    // a malformed response -- rewrap it here so every failure path this
    // function can take honors the uniform `Error('Failed to fetch
    // passage')` contract promised by this file's header doc comment
    // (mirrors esvApi.ts::fetchPassageText's failure mode).
    throw new Error('Failed to fetch passage')
  }
  // `stripNltHtml` can independently collapse to an empty string even when
  // the raw HTML is non-empty -- e.g. a `#bibletext` root present but with
  // zero `verse_export` children. Treat that the same as the raw-body empty
  // guard above, so a structurally-empty-but-non-empty-HTML response fails
  // the same way instead of silently resolving to ''.
  if (!stripped.trim()) {
    throw new Error('Failed to fetch passage')
  }

  return stripped
}

/**
 * Parses NLT's HTML response with native `DOMParser` and reduces it to plain
 * `[N] text` verse strings joined with a single space. Exported so tests can
 * exercise the stripping logic directly against fixture HTML, without a
 * network mock.
 * See .planning/codebase/INTEGRATIONS.md (Utils Integration Notes — src/utils/nltApi.ts)
 */
export function stripNltHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const root = doc.querySelector('#bibletext')
  if (!root) {
    throw new Error('Unexpected NLT response shape')
  }

  // Footnote markers + bodies are nested INSIDE the verse's own paragraph,
  // immediately after the annotated word — must strip both together or
  // footnote prose leaks into the middle of verse text.
  root.querySelectorAll('.tn, .a-tn').forEach((el) => el.remove())
  // Headings + Psalm superscription — ESV parity (include-headings: false)
  // plus the Assumption A1 call to strip .psa-title alongside them.
  root
    .querySelectorAll('.bk_ch_vs_header, .chapter-number, .subhead, .psa-title')
    .forEach((el) => el.remove())
  // The rendered verse-number glyph — its digit text would otherwise leak
  // as an unspaced duplicate directly before the verse's own text (see
  // file header doc comment on `.vn`).
  root.querySelectorAll('.vn').forEach((el) => el.remove())

  const verses = Array.from(root.querySelectorAll('verse_export'))
  return verses
    .map((verse) => {
      const vn = verse.getAttribute('vn')
      const text = (verse.textContent ?? '').replace(/\s+/g, ' ').trim()
      // "[16] text" — the load-bearing bracket format parseVerses()/
      // computeBoundaries() depend on (see file header).
      return vn ? `[${vn}] ${text}` : text
    })
    .filter(Boolean)
    .join(' ')
}
