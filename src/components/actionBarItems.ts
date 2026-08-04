/**
 * ActionBarItem contract — 36-02, R068. The declarative shape
 * `ContextualActionBar.vue` renders and `buildActionBarItems`
 * (`src/views/serviceEditorActionBar.ts`) produces. Kept in its own module,
 * separate from the component file, so a pure per-tab builder can import
 * just the types without pulling in any Vue runtime code.
 *
 * `ActionBarIcon` gains a `copy` member over 36-UI-SPEC §2's illustrative
 * union (`'none' | 'ai-sparkle' | 'upload' | 'check' | 'present' |
 * 'spinner'`) — the live `copy-pc` button renders a clipboard glyph and this
 * phase must not drop it just because the spec's own union omitted it
 * (★ FLAGGED SPEC EXTENSION, 36-02-PLAN.md frontmatter `assumptions`).
 *
 * `ActionBarTone` gains the fourth `present` member the spec's §2 prose
 * explicitly calls for (outlined indigo), distinct from `primary` (filled
 * indigo) so Present and Save never collapse into one visual treatment.
 */

export type ActionBarTone = 'default' | 'primary' | 'destructive' | 'present'

export type ActionBarIcon =
  | 'none'
  | 'ai-sparkle'
  | 'upload'
  | 'check'
  | 'copy'
  | 'present'
  | 'spinner'

export interface ActionBarItem {
  key: string
  label: string
  onClick: () => void
  disabled?: boolean
  title?: string
  tone?: ActionBarTone
  icon?: ActionBarIcon
  testId?: string
}
