import { doc, setDoc, getDoc } from 'firebase/firestore'
import { db } from '@/firebase'
import { deriveSlug } from '@/utils/slug'

/**
 * Normalize an organization display name into a stable, Firestore-doc-id-safe
 * uniqueness KEY (for the `orgNames/{key}` registry). Case- and
 * whitespace-insensitive so "Grace Church", "grace  church" and " Grace Church "
 * collide as the same name. Pure.
 *
 * Firestore doc IDs may not be empty, `.`, `..`, or contain `/`. `/` is folded
 * to a space; a name with no usable characters (empty, or only dots/slashes)
 * falls back to its slug (always `[a-z0-9-]`), and `''` only if even that is
 * empty — callers treat `''` as "nothing to claim".
 */
export function normalizeOrgName(name: string): string {
  const key = name
    .trim()
    .toLowerCase()
    .replace(/\//g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!key || /^\.+$/.test(key)) return deriveSlug(name)
  return key
}

/**
 * Claim a unique org name via a create-only write against `orgNames/{nameKey}`,
 * mirroring `claimSlug`'s `orgSlugs` pattern (the rule denies any overwrite, so
 * a create against an existing doc fails permission-denied).
 *
 * Returns `true` when the name is now this org's (freshly claimed, OR already
 * claimed by this same org — idempotent, so re-saving your own name or renaming
 * back to a name you previously held is not a false "taken"). Returns `false`
 * when another org holds it. Unlike `claimSlug`, this does NOT auto-suffix — a
 * NAME collision is surfaced to the caller (reject), per owner decision.
 */
export async function claimOrgName(nameKey: string, orgId: string): Promise<boolean> {
  if (!nameKey) return true
  try {
    await setDoc(doc(db, 'orgNames', nameKey), { orgId })
    return true
  } catch (err: unknown) {
    if ((err as { code?: string })?.code !== 'permission-denied') throw err
    // Overwrite denied: taken by SOMEONE. If that someone is us, it's ours.
    try {
      const snap = await getDoc(doc(db, 'orgNames', nameKey))
      if (snap.exists() && (snap.data() as { orgId?: string }).orgId === orgId) return true
    } catch {
      // fall through — treat as taken
    }
    return false
  }
}
