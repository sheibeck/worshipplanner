import { doc, setDoc } from 'firebase/firestore'
import { db } from '@/firebase'

/**
 * Derive a URL-safe slug from an organization name: lowercase, hyphenated,
 * with any run of non-alphanumeric characters collapsed to a single hyphen
 * and leading/trailing hyphens trimmed. Pure — no imports, cannot throw.
 */
export function deriveSlug(orgName: string): string {
  return orgName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// Reserved app path segments (D-19) — a slug matching one of these would let
// an org's memorable URL be silently shadowed by an existing static route
// (Vue Router ranks static routes above dynamic ones). Must be checked
// before any claim write is attempted, not relied on at routing time.
export const RESERVED_SLUGS = new Set([
  'songs',
  'roster',
  'volunteers',
  'schedule',
  'services',
  'team',
  'admins',
  'settings',
  'login',
  'share',
  'quarter-share',
  'public',
])

/**
 * Claim a unique org slug via a create-only Firestore write against
 * orgSlugs/{candidate}. Reserved words are pre-filtered before any write —
 * a reserved candidate skips straight to the first numeric-suffixed
 * candidate. On a permission-denied error (existing doc → the rules deny
 * the implicit "update"), retries with the next numeric suffix
 * (base-2, base-3, …) until a candidate writes successfully.
 */
export async function claimSlug(baseSlug: string, orgId: string): Promise<string> {
  let suffix = 1
  for (;;) {
    const candidate = suffix === 1 ? baseSlug : `${baseSlug}-${suffix}`
    if (RESERVED_SLUGS.has(candidate)) {
      suffix += 1
      continue
    }
    try {
      await setDoc(doc(db, 'orgSlugs', candidate), { orgId })
      return candidate
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code
      if (code === 'permission-denied') {
        suffix += 1
        continue
      }
      throw err
    }
  }
}
