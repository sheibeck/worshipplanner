import { ref } from 'vue'
import { defineStore } from 'pinia'

export interface Toast {
  id: string
  message: string
}

/**
 * Minimal, single-purpose failure-toast store (R041). Deliberately NOT a
 * general notification system: no priorities, no categories, no positions,
 * no hover-to-pause, no success/info variants, no cap logic. One array,
 * one push, one dismiss.
 *
 * The auto-dismiss timer (see the setTimeout below) is armed HERE, inside
 * the store, not inside ToastHost.vue. A toast raised by a surface that
 * unmounts a moment later
 * must still self-dismiss — if the timer lived in the component it would
 * die with it and the toast would be stranded on screen forever.
 */
export const useToasts = defineStore('toasts', () => {
  const toasts = ref<Toast[]>([])

  function push(message: string): string {
    const id = crypto.randomUUID()
    toasts.value.push({ id, message })
    setTimeout(() => dismiss(id), 6000)
    return id
  }

  function dismiss(id: string): void {
    // Filtering an absent id is naturally a no-op — this idempotence is what
    // makes an orphaned auto-dismiss timer (fired after a manual dismiss, or
    // after the raising surface already unmounted) harmless rather than an
    // error. Do not add a guard that throws or warns here.
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }

  return { toasts, push, dismiss }
})
