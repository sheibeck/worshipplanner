/**
 * ActionBarItem contract — 36-02, R068. The declarative shape
 * `ContextualActionBar.vue` renders and `buildActionBarItems`
 * (`src/views/serviceEditorActionBar.ts`) produces. Kept in its own module,
 * separate from the component file, so a pure per-tab builder can import
 * just the types without pulling in any Vue runtime code.
 *
 * `ActionBarIcon` originally gained a `copy` member over 36-UI-SPEC §2's
 * illustrative union for the `copy-pc` button's clipboard glyph
 * (★ FLAGGED SPEC EXTENSION, 36-02-PLAN.md frontmatter `assumptions`).
 * Removed along with the `Copy for PC` button itself per direct owner
 * feedback on the running app ("let's get rid of the Copy for PC button all
 * together, it's not useful at all") — an organization with no Planning
 * Center credentials now has no export affordance in the action bar at all,
 * only the credentials-missing note pointing at Settings
 * (`ServiceEditorView.vue`). That is the owner's explicit, accepted
 * consequence — do not add a replacement affordance.
 *
 * `ActionBarTone` originally gained a fourth `present` member per 36-UI-SPEC
 * §2's prose (outlined indigo), distinct from `primary` (filled indigo) so
 * Present and Save would never collapse into one visual treatment. Removed
 * per direct owner feedback on the running app ("Update the Present Button
 * so that it matches the other buttons, right now it stands out because
 * it's so visually different") — `buildPresentItem`
 * (`src/views/serviceEditorActionBar.ts`) now omits `tone` entirely, falling
 * back to `default` like every other non-Save button. Present and Save stay
 * visually distinguishable anyway (`primary` filled indigo vs `default`
 * gray) — just not via the spec's dedicated outlined-indigo treatment. Do
 * NOT re-add this member to "restore" the spec; the owner asked for the
 * opposite of what §2 specified.
 */

export type ActionBarTone = 'default' | 'primary' | 'destructive'

export type ActionBarIcon =
  | 'none'
  | 'ai-sparkle'
  | 'upload'
  | 'check'
  | 'present'
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
