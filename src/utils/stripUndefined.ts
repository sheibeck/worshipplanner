/**
 * Recursively remove properties whose value is `undefined` so the result is safe to write
 * to Firestore, which rejects any `undefined` field value at any depth with
 * "Unsupported field value: undefined (found in document ...)".
 *
 * - Arrays are mapped element-wise (so slide arrays with optional `title`/`altText` are cleaned).
 * - Only PLAIN objects are recursed into; `Date` instances, class instances, and Firestore
 *   `FieldValue` sentinels (e.g. `serverTimestamp()`) are returned untouched. Callers should add
 *   FieldValue sentinels AFTER stripping the plain payload.
 * - `null`, `0`, `''`, and `false` are preserved — only `undefined` is dropped.
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
