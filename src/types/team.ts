// Per-org configurable team list (Phase 79 — R228/R241). A team is a flat,
// unordered-in-meaning-but-stably-sorted entry the service-plan checkboxes
// render; it carries no roster group/defaultCount (unlike Role) and an
// optional song-tag filter that narrows AI song suggestions when this team is
// selected on a service (R230).
export interface Team {
  id: string
  name: string
  order: number // stable ascending order, mirrors Role.order
  /** Optional song tag (from the org's existing song tags). When a service
   *  selects a team carrying this field, AI song suggestions are constrained
   *  to songs carrying the tag (union across all selected teams' tags — see
   *  ServiceEditorView's filterSongsByTeamTags). Empty/absent = no filter. */
  songFilterTag?: string
}

// D-79 default team list — byte-identical to the pre-Phase-79 hard-coded
// `['Choir', 'Orchestra', 'Communion', 'Special']` so existing orgs (Berean)
// see the same team names in the checkboxes on first load post-deploy
// (RESEARCH Pitfall 4). This "zero behavior change" is scoped to the team
// *list* only — the Orchestra AI-filter behavior is NOT auto-preserved: no
// songFilterTag is seeded here (CONTEXT.md: "seeding the tag is optional and
// left to the admin"), so `filterSongsByTeamTags` returns the unfiltered pool
// for Orchestra-selecting services until an admin manually re-sets the tag
// via Volunteers → Teams. DEFAULT_TEAMS omits `id` (assigned by Firestore on
// seed).
export const DEFAULT_TEAMS: Array<Omit<Team, 'id'>> = [
  { name: 'Choir', order: 0 },
  { name: 'Orchestra', order: 1 },
  { name: 'Communion', order: 2 },
  { name: 'Special', order: 3 },
]
