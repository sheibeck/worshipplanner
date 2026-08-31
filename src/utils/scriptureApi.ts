import { fetchPassageText } from '@/utils/esvApi'
import { fetchNltPassageText } from '@/utils/nltApi'
import { useAuthStore } from '@/stores/auth'

// ─── Result Type ─────────────────────────────────────────────────────────────

/**
 * The discriminated result every caller branches on. `'disabled'` is a
 * first-class, non-error state — mirrors `claudeApi.ts::isAiEnabled()`
 * returning a graceful "AI off" signal rather than throwing. `'error'` covers
 * any real fetch/parse failure from the underlying ESV/NLT client, preserving
 * today's component catch-block UX unchanged (R296).
 */
export type ScriptureFetchResult =
  | { status: 'ok'; text: string }
  | { status: 'disabled' }
  | { status: 'error' }

// ─── Dispatcher ──────────────────────────────────────────────────────────────

/**
 * The single client-side choke point for scripture-passage fetches — the
 * `isAiEnabled()` analog for the Bible API (Phase 102, R296/R297).
 * `ScriptureInput.vue` and `CongregationalEditor.vue` route every ESV/NLT
 * fetch through this function; neither imports `esvApi`/`nltApi` directly.
 *
 * Order of operations matters:
 * 1. Read the auth store INSIDE the function body via `useAuthStore()` —
 *    NEVER at module-evaluation time. Pinia requires an active app instance
 *    that does not exist when this module is first imported (same
 *    constraint documented on `claudeApi.ts::isAiEnabled`).
 * 2. Gate FIRST: if the org's Bible API is off (Phase 101's single-leg
 *    `authStore.isBibleApiEnabled`, false-when-absent), return `{ status:
 *    'disabled' }` WITHOUT calling any proxy. This is the R297 core
 *    assertion — a disabled org must produce zero requests.
 * 3. Otherwise dispatch by version — relocated verbatim from the two
 *    components' previously-duplicated inline `version === 'NLT' ? ... :
 *    ...` dispatch. No ESV/NLT parsing/trimming is re-implemented here.
 * 4. Any thrown error from the underlying fetch maps to `{ status: 'error'
 *    }` — never re-thrown — so the enabled-path failure mode stays
 *    byte-for-byte identical to what each component's own try/catch did
 *    before this refactor (R296).
 */
export async function fetchScriptureText(
  query: string,
  version: 'ESV' | 'NLT',
): Promise<ScriptureFetchResult> {
  const authStore = useAuthStore()

  if (!authStore.isBibleApiEnabled) {
    return { status: 'disabled' }
  }

  try {
    const text = version === 'NLT' ? await fetchNltPassageText(query) : await fetchPassageText(query)
    return { status: 'ok', text }
  } catch {
    return { status: 'error' }
  }
}
