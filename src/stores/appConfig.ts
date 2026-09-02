// Phase 70 (R186/R187) — Pinia store over the single appConfig/global
// Firestore doc. Mirrors src/stores/auth.ts's onSnapshot/Unsubscribe
// lifecycle and src/views/OwnerConsoleView.vue's roster subscription shape
// (subscribe()/unsubscribe() as explicit actions called from a component's
// onMounted/onUnmounted, not module-scope side effects — keeps the store
// mockable/testable without a component mount).
import { ref } from 'vue'
import { defineStore } from 'pinia'
import { doc, onSnapshot, setDoc, serverTimestamp, type Unsubscribe } from 'firebase/firestore'
import { db } from '@/firebase'
import { useAuthStore } from '@/stores/auth'
import { mergeAppConfig, type AppConfig, type AppConfigInput } from '@/config/appConfigDefaults'
import { isPermissionDenied } from '@/utils/firestoreListener'

export const useAppConfigStore = defineStore('appConfig', () => {
  // Pre-merge raw doc — drives the presence-based (default) badge (R186).
  const rawDoc = ref<AppConfigInput | undefined>(undefined)
  // Post-merge resolved config — what every field's effective value reads.
  const resolvedConfig = ref<AppConfig>(mergeAppConfig(undefined))
  const loaded = ref(false)
  const loadError = ref<string | null>(null)

  let unsub: Unsubscribe | null = null

  function subscribe(): void {
    unsub = onSnapshot(
      doc(db, 'appConfig', 'global'),
      (snap) => {
        rawDoc.value = snap.exists() ? (snap.data() as AppConfigInput) : undefined
        resolvedConfig.value = mergeAppConfig(rawDoc.value)
        loaded.value = true
      },
      (err) => {
        // Bug 2b (quick 260830-l9c) — a super-admin's own logout can hit this
        // handler with a benign permission-denied once the token is revoked;
        // suppress ONLY the console.error for that code, state-setting below
        // stays unchanged for a genuine error.
        if (!isPermissionDenied(err)) {
          console.error('[appConfig store] subscription error:', err)
        }
        loadError.value = 'Load error'
        loaded.value = true
      },
    )
  }

  function unsubscribe(): void {
    unsub?.()
    unsub = null
  }

  // R182 write discipline: setDoc({merge:true}) only, never updateDoc; dot-path
  // keys must be expanded to nested objects first (setDoc merge treats a dotted
  // key literally, unlike updateDoc). See .planning/codebase/ARCHITECTURE.md
  // (Store & Config Behavioral Notes (R318) -> src/stores/appConfig.ts).
  async function saveField(path: string, value: unknown): Promise<void> {
    const authStore = useAuthStore()
    await setDoc(
      doc(db, 'appConfig', 'global'),
      {
        ...buildNestedField(path, value),
        updatedBy: authStore.user?.email ?? 'unknown',
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    )
  }

  // Expand a dot-path ('a.b.c') + value into a nested object literal
  // ({ a: { b: { c: value } } }) so setDoc merge writes a real nested field
  // rather than a literal dotted key. A single-segment path returns { path: value }.
  function buildNestedField(path: string, value: unknown): Record<string, unknown> {
    const keys = path.split('.')
    const root: Record<string, unknown> = {}
    let cursor = root
    for (let i = 0; i < keys.length - 1; i++) {
      const next: Record<string, unknown> = {}
      cursor[keys[i]!] = next
      cursor = next
    }
    cursor[keys[keys.length - 1]!] = value
    return root
  }

  return {
    rawDoc,
    resolvedConfig,
    loaded,
    loadError,
    subscribe,
    unsubscribe,
    saveField,
  }
})
