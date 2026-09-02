/**
 * Recursively remove properties whose value is `undefined` so the result is
 * safe to write to Firestore, which rejects `undefined` at any depth.
 * See .planning/codebase/ARCHITECTURE.md (Utils Behavioral Notes — src/utils/stripUndefined.ts)
 */
export function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefined(item)) as unknown as T
  }
  if (
    value !== null &&
    typeof value === 'object' &&
    Object.getPrototypeOf(value) === Object.prototype
  ) {
    const out: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (val !== undefined) out[key] = stripUndefined(val)
    }
    return out as T
  }
  return value
}
