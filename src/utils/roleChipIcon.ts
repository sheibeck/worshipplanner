// Pure free-text role name -> StageKindIcon glyph name mapping (Phase 126,
// R381). No rendering here — the view pairs this string with the existing
// <StageKindIcon :name="roleChipIcon(role.name)" /> component
// (src/components/stage/StageKindIcon.vue), which only renders a fixed glyph
// inventory. Every value this function returns MUST be one of that inventory's
// `name ===` branches, or the icon silently falls back to a neutral dot.

/**
 * Case-insensitive substring match against a free-text role name, per
 * 126-UI-SPEC.md's Icon Inventory keyword table. Mismatches are cosmetic
 * (wrong instrument glyph on an unusually-named role), never a runtime error —
 * the 'music' fallback is always a valid StageKindIcon glyph.
 */
export function roleChipIcon(roleName: string): string {
  const name = roleName.toLowerCase()
  if (name.includes('guitar') || name.includes('bass')) return 'guitar'
  if (name.includes('key') || name.includes('piano')) return 'piano'
  if (name.includes('drum')) return 'drum'
  if (name.includes('vocal') || name.includes('vox') || name.includes('sing')) return 'mic'
  if (name.includes('strings') || name.includes('violin')) return 'strings'
  if (name.includes('sound') || name.includes('tech')) return 'speaker'
  return 'music'
}
