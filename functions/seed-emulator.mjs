// DEV-ONLY: seed the local Firebase emulators with a super-admin "power user".
//
// Emulators start empty (firebase.json has no import/export path), so the
// superAdmin grant has to be re-applied after every fresh `firebase emulators:start`.
// This script does exactly that, idempotently:
//   1. finds (or creates) the Auth-emulator user for the given email,
//   2. writes superAdmins/{uid} (the source-of-truth doc), and
//   3. sets the { superAdmin: true } custom claim directly (merge-preserving),
//      so it lands whether or not the functions emulator / syncSuperAdminClaim
//      trigger is running.
//
// It CANNOT touch a real project: it hard-points the Admin SDK at the local
// Auth + Firestore emulators via FIREBASE_AUTH_EMULATOR_HOST / FIRESTORE_EMULATOR_HOST
// and uses no real credentials. If the emulators aren't up it just fails to connect.
//
// Usage (from repo root, emulators already running):
//   node functions/seed-emulator.mjs                       # seeds sheibeck@gmail.com
//   node functions/seed-emulator.mjs someone@example.com   # seeds another email
//
// After it runs, sign out and back in (or hard-refresh) so your ID token picks
// up the new claim — an existing session keeps its old, claim-free token.

import { initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

const EMAIL = process.argv[2] || 'sheibeck@gmail.com'
// Must match VITE_FIREBASE_PROJECT_ID so the Admin SDK shares the app's emulator namespace.
const PROJECT_ID = process.env.GCLOUD_PROJECT || 'worship-planner-bc515'

// Point the Admin SDK at the running emulators (ports from firebase.json).
process.env.FIREBASE_AUTH_EMULATOR_HOST ||= '127.0.0.1:9099'
process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8080'

initializeApp({ projectId: PROJECT_ID })
const auth = getAuth()
const db = getFirestore()

let user
try {
  user = await auth.getUserByEmail(EMAIL)
  console.log(`• found existing emulator user ${EMAIL} → ${user.uid}`)
} catch {
  user = await auth.createUser({
    email: EMAIL,
    emailVerified: true,
    displayName: EMAIL.split('@')[0],
  })
  console.log(`• created emulator user ${EMAIL} → ${user.uid}`)
}

await db.collection('superAdmins').doc(user.uid).set({
  email: EMAIL,
  grantedBy: 'emulator-seed',
  grantedAt: new Date(),
})
await auth.setCustomUserClaims(user.uid, { ...(user.customClaims || {}), superAdmin: true })

console.log(`\n✓ ${EMAIL} is now a super-admin in the emulator (project ${PROJECT_ID}).`)
console.log('  → In the app: sign out and back in (or hard-refresh) to load the claim onto your token.')
