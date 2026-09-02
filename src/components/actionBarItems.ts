// See .planning/codebase/ARCHITECTURE.md (§ Component & Composable Behavioral Notes (R318) -> src/components/actionBarItems.ts)

export type ActionBarTone = 'default' | 'primary' | 'destructive'

export type ActionBarIcon =
  | 'none'
  | 'ai-sparkle'
  | 'upload'
  | 'check'
  | 'present'
  // 'review' — the eye glyph for the renamed "Review Slides" action (owner
  // 2026-09-01), swapped in for the old ▶ 'present' play glyph so reviewing
  // slides is not confused with running a live service (Run).
  | 'review'
  | 'spinner'
  | 'print'
  | 'share'
  // 'mail' — the ✉ envelope glyph for the Messages action-bar item (R136,
  // 59-04). No existing icon fit a "message the team" action, so a new member
  // was added (per 59-04-PLAN.md Task 1's "add one only if none fits"); its
  // render arm lives in ContextualActionBar.vue alongside the others.
  | 'mail'

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
