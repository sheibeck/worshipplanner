import { ref } from 'vue'
import { defineStore } from 'pinia'

/** The four supported severities (Phase 104, R309/R310). */
export type NotificationVariant = 'info' | 'success' | 'warning' | 'error'

export interface NotificationAction {
  label: string
  onClick: () => void
}

export interface NotificationLink {
  label: string
  href: string
}

/**
 * Options for a transient push(). `variant` defaults to 'error' (R041
 * back-compat). `autoDismissMs` controls the lifetime:
 *  - opts entirely omitted: arm the historical 6000ms timer (back-compat).
 *  - opts passed with autoDismissMs a number: arm a timer for that duration.
 *  - opts passed with autoDismissMs left undefined: STICKY — no timer armed.
 */
export interface PushOptions {
  variant?: NotificationVariant
  autoDismissMs?: number
}

/** Options for a keyed, always-sticky notification (R310). */
export interface StickyOptions {
  variant: NotificationVariant
  heading: string
  body?: string
  action?: NotificationAction
  link?: NotificationLink
}

export interface Toast {
  id: string
  /** Present on every push()'d transient item; unused by setSticky() items. */
  message?: string
  variant: NotificationVariant
  /**
   * Present ONLY on items created via setSticky() — this is what makes an
   * item "sticky" (no auto-dismiss timer) and de-dupe-by-key. A push()'d
   * item never carries a key.
   */
  key?: string
  heading?: string
  body?: string
  action?: NotificationAction
  link?: NotificationLink
}

/**
 * See .planning/codebase/ARCHITECTURE.md (Store & Config Behavioral Notes (R318) ->
 * src/stores/toasts.ts).
 */
export const useToasts = defineStore('toasts', () => {
  const toasts = ref<Toast[]>([])

  /**
   * push(message) with no second argument preserves the ORIGINAL behavior
   * exactly: variant 'error', a 6000ms in-store auto-dismiss timer. Passing
   * opts widens the contract — omit `autoDismissMs` there to raise a sticky
   * transient message instead (no timer armed).
   */
  function push(message: string, opts?: PushOptions): string {
    const id = crypto.randomUUID()
    const variant = opts?.variant ?? 'error'
    toasts.value.push({ id, message, variant })
    if (opts === undefined) {
      setTimeout(() => dismiss(id), 6000)
    } else if (opts.autoDismissMs !== undefined) {
      setTimeout(() => dismiss(id), opts.autoDismissMs)
    }
    // opts passed with autoDismissMs left undefined: sticky, no timer.
    return id
  }

  /**
   * Insert or replace-in-place a keyed, sticky notification (R310). Calling
   * this again with the SAME key updates the existing item's fields rather
   * than pushing a second entry — the list never grows for a repeated key.
   * Never arms an auto-dismiss timer; only dismiss()/clearSticky() removes it.
   */
  function setSticky(key: string, opts: StickyOptions): string {
    const existing = toasts.value.find((t) => t.key === key)
    if (existing) {
      existing.variant = opts.variant
      existing.heading = opts.heading
      existing.body = opts.body
      existing.action = opts.action
      existing.link = opts.link
      return existing.id
    }
    const id = crypto.randomUUID()
    toasts.value.push({
      id,
      key,
      variant: opts.variant,
      heading: opts.heading,
      body: opts.body,
      action: opts.action,
      link: opts.link,
    })
    return id
  }

  /**
   * Remove the item raised under `key`, if any. Idempotent — clearing an
   * absent (or already manually-dismissed) key is a harmless no-op, which is
   * what makes manual dismiss and programmatic clearSticky race-safe in
   * either order (mirrors dismiss()'s own idempotent-filter behavior below).
   */
  function clearSticky(key: string): void {
    toasts.value = toasts.value.filter((t) => t.key !== key)
  }

  function dismiss(id: string): void {
    // Filtering an absent id is naturally a no-op — this idempotence is what
    // makes an orphaned auto-dismiss timer (fired after a manual dismiss, or
    // after the raising surface already unmounted) harmless rather than an
    // error. Do not add a guard that throws or warns here. Dismissing a
    // keyed sticky by its id also clears it (same filter, same id space) —
    // a later clearSticky(key) for that key is then a harmless no-op too.
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }

  return { toasts, push, dismiss, setSticky, clearSticky }
})
