import type { ScriptureRef } from '@/types/service'
import { formatScriptureReference } from '@/utils/scripture'

/**
 * Format a ScriptureRef as "Book Chapter:VerseStart-VerseEnd".
 *
 * Delegates to `scripture.ts`'s canonical formatter so the export text and the
 * projector slide (R047) can never drift apart. A single-verse reference
 * renders "Romans 8:28" rather than collapsing to "Romans 8", and a degenerate
 * range ("John 3:16-16") collapses to "John 3:16" the way every other surface
 * already renders it (HI-02).
 */
export function formatScriptureRef(ref: ScriptureRef): string {
  return formatScriptureReference(ref)
}
