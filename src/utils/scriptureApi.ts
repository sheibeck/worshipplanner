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
 * The single client-side choke point for scripture-passage fetches (Phase
 * 102, R296/R297). Gate FIRST (before calling either version's fetcher) —
 * this is the R297 core assertion that a disabled org must produce zero
 * requests. Reads the auth store INSIDE the function body, never at
 * module-evaluation time (Pinia has no active app instance that early).
 * See .planning/codebase/INTEGRATIONS.md (Utils Integration Notes — src/utils/scriptureApi.ts)
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
