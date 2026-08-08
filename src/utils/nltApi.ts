import { getAppAuthHeaders } from '@/utils/appAuth'

/**
 * Fetches an NLT passage and returns it reformatted into the exact `[N] text`
 * bracketed-verse-number convention `scriptureSplitter.ts::parseVerses` (and,
 * transitively, `scriptureBoundaries.ts::computeBoundaries`'s VERSE_MARKER_PATTERN)
 * depend on. Mirrors `src/utils/esvApi.ts::fetchPassageText`'s shape: same
 * `/api/<service>/...` proxy route, same `getAppAuthHeaders()` auth, same
 * `Error('Failed to fetch passage')` failure contract — so both clients present
 * a uniform failure mode to their shared callers (ScriptureInput.vue,
 * CongregationalEditor.vue).
 *
 * The `ref` string needs NO translation between ESV and NLT — both accept the
 * same `Book Chapter:VerseStart-VerseEnd` format the app already builds.
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

  return stripNltHtml(html)
}

/**
 * Parses NLT's HTML response with native `DOMParser` and reduces it to plain
 * `[N] text` verse strings joined with a single space. Exported (in addition
 * to `fetchNltPassageText`) so tests can exercise the stripping logic
 * directly against fixture HTML strings, without a network mock.
 *
 * Strip/keep table (45-RESEARCH.md § Element inventory — strip vs. keep):
 * - `.tn` / `.a-tn` (footnote body + marker) — STRIP. Nested INSIDE the
 *   verse's own paragraph, immediately after the annotated word — must strip
 *   both together or footnote prose leaks into the middle of verse text.
 * - `.bk_ch_vs_header` / `.chapter-number` / `.subhead` — STRIP. Not
 *   scripture text; matches ESV's `include-headings: false` parity.
 * - `.psa-title` (Psalm superscription, e.g. "A psalm of David.") — STRIP
 *   alongside headings (Assumption A1). Lives INSIDE verse 1's
 *   `<verse_export>`, ahead of the actual verse text — if kept it would
 *   silently prepend onto verse 1's own words.
 * - `.red` (red-letter) / `.sc` (small-caps) — KEEP contents; these are pure
 *   styling wrappers, `.textContent` already includes their text naturally.
 * - `verse_export`'s own `vn` ATTRIBUTE (not the rendered `.vn` span text) —
 *   the single most reliable per-verse boundary and verse-number source, per
 *   research: more reliable than the `.vn` span, which sits directly abutted
 *   to the next text node with no separating space in the raw HTML.
 * - `.vn` (rendered verse-number glyph span) — STRIP. Research labels this
 *   "ignore" for numbering purposes (read the attribute instead), but its
 *   digit text still sits in the DOM; left unstripped it leaks as a
 *   duplicate, unspaced digit directly before the verse text (e.g.
 *   "[16] 16For..." instead of "[16] For...") — removing it is required to
 *   avoid that concatenation, not merely to avoid using it as the source.
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
