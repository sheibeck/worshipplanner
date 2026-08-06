import { initializeApp } from 'firebase/app'
import { getAuth, connectAuthEmulator } from 'firebase/auth'
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore'
import { getStorage, connectStorageEmulator } from 'firebase/storage'
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
}

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)
export const functions = getFunctions(app)

/**
 * Emulator wiring — DEV BUILDS ONLY.
 *
 * ★ `import.meta.env.DEV` is load-bearing, not belt-and-braces. Do not remove it,
 * and do not "simplify" this back to a bare VITE_USE_EMULATORS check.
 *
 * This shipped to production on 2026-08-05 gated on VITE_USE_EMULATORS alone, and
 * the live site tried to authenticate against `http://127.0.0.1:9099`. The reason is
 * that **Vite loads `.env.local` during a production build too** — it is not a
 * dev-only file. `.env.local` legitimately carries `VITE_USE_EMULATORS=true` for local
 * work (and must also carry the VITE_FIREBASE_* values the build needs), so the flag
 * was baked straight into the production bundle. Nothing warned: the build succeeded,
 * the deploy succeeded, and the breakage only appeared when a real user hit sign-in.
 *
 * `import.meta.env.DEV` is statically `false` in a production build, so this whole
 * block is tree-shaken out of the bundle entirely — the emulator hosts cannot appear
 * in shipped output even by accident. That is the property `firebase.emulators.test.ts`
 * asserts against the real built artifact, rather than trusting this comment.
 */
if (import.meta.env.DEV && import.meta.env.VITE_USE_EMULATORS === 'true') {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
  connectStorageEmulator(storage, '127.0.0.1', 9199)
  connectFunctionsEmulator(functions, '127.0.0.1', 5001)
}
