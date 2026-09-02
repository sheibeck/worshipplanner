import { doc, setDoc, getDoc } from 'firebase/firestore'
import { db } from '@/firebase'
import { deriveSlug } from '@/utils/slug'

/**
 * Normalize an organization display name into a stable, Firestore-doc-id-safe
 * uniqueness KEY (for the `orgNames/{key}` registry). Pure.
 * See .planning/codebase/ARCHITECTURE.md (Utils Behavioral Notes — src/utils/orgName.ts)
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
 * mirroring `claimSlug`'s `orgSlugs` pattern. Unlike `claimSlug`, this does NOT
 * auto-suffix — a NAME collision is surfaced to the caller (reject).
 * See .planning/codebase/ARCHITECTURE.md (Utils Behavioral Notes — src/utils/orgName.ts)
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
