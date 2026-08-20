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
        console.error('[appConfig store] subscription error:', err)
        loadError.value = 'Load error'
        loaded.value = true
      },
    )
  }

  function unsubscribe(): void {
    unsub?.()
    unsub = null
  }

  // Every appConfig/global write in this phase MUST use setDoc(...,
  // {merge:true}), NEVER updateDoc — R182 made an absent doc a valid,
  // expected state (e.g. a fresh deploy that has never been saved through
  // this console); updateDoc throws not-found against a document that has
  // never been created. The precedent for this write shape is
  // src/stores/auth.ts's ensureUserDocument (the one existing
  // setDoc(...,{merge:true}) call in this codebase). Writes ONE dot-path
  // leaf key (e.g. 'retention.mediaDays') so sibling fields are untouched.
  async function saveField(path: string, value: unknown): Promise<void> {
    const authStore = useAuthStore()
    await setDoc(
      doc(db, 'appConfig', 'global'),
      {
        [path]: value,
        updatedBy: authStore.user?.email ?? 'unknown',
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    )
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
