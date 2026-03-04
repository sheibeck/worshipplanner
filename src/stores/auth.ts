import { ref, computed, watch } from 'vue'
import { defineStore } from 'pinia'
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth'
import {
  doc,
  setDoc,
  getDoc,
  writeBatch,
  collection,
  serverTimestamp,
  onSnapshot,
  updateDoc,
  type Unsubscribe,
} from 'firebase/firestore'
import { auth, db } from '@/firebase'

let memberUnsub: Unsubscribe | null = null

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const isReady = ref(false)

  const orgId = ref<string | null>(null)
  const orgName = ref<string | null>(null)
  const userRole = ref<'editor' | 'viewer' | null>(null)

  const isAuthenticated = computed(() => user.value !== null)
  const isEditor = computed(() => userRole.value === 'editor')

  function waitForRole(): Promise<void> {
    return new Promise((resolve) => {
      if (userRole.value !== null || !isAuthenticated.value) {
        resolve()
        return
      }
      const unwatch = watch(userRole, (val) => {
        if (val !== null) {
          unwatch()
          resolve()
        }
      })
    })
  }

  async function loadOrgContext(uid: string): Promise<void> {
    const userRef = doc(db, 'users', uid)
    const userSnap = await getDoc(userRef)
    const userData = userSnap.exists() ? userSnap.data() : null
    const ids: string[] = userData?.orgIds ?? []

    if (ids.length === 0) {
      orgId.value = null
      orgName.value = null
      userRole.value = null
      return
    }

    orgId.value = ids[0]

    const orgRef = doc(db, 'organizations', ids[0])
    const orgSnap = await getDoc(orgRef)
    if (orgSnap.exists()) {
      orgName.value = (orgSnap.data().name as string) ?? null
    }

    // Unsubscribe from previous listener if any
    memberUnsub?.()
    memberUnsub = onSnapshot(
      doc(db, 'organizations', ids[0], 'members', uid),
      async (snap) => {
        if (!snap.exists()) {
          userRole.value = null
          return
        }
        const data = snap.data()
        const role = data.role as string

        // Backfill denormalized fields on old member docs
        const needsBackfill = !data.email && user.value?.email
        if (needsBackfill) {
          await updateDoc(snap.ref, {
            email: user.value!.email ?? '',
            displayName: user.value!.displayName ?? '',
          })
        }

        userRole.value = role as 'editor' | 'viewer'
      },
    )
  }

  // Listen for auth state changes
  onAuthStateChanged(auth, async (firebaseUser) => {
    user.value = firebaseUser
    if (firebaseUser) {
      await ensureUserDocument(firebaseUser)
      await loadOrgContext(firebaseUser.uid)
    } else {
      orgId.value = null
      orgName.value = null
      userRole.value = null
      memberUnsub?.()
      memberUnsub = null
    }
    isReady.value = true
  })

  async function ensureUserDocument(firebaseUser: User): Promise<void> {
    const userRef = doc(db, 'users', firebaseUser.uid)
    const userSnap = await getDoc(userRef)

    // Update/create the user profile document
    await setDoc(
      userRef,
      {
        email: firebaseUser.email,
        displayName: firebaseUser.displayName,
        photoURL: firebaseUser.photoURL,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    )

    // Auto-create org if user doesn't have one yet
    const userData = userSnap.exists() ? userSnap.data() : null
    const hasOrg = userData?.orgIds && userData.orgIds.length > 0

    if (!hasOrg) {
      // Check for pending invite before auto-creating org
      const email = firebaseUser.email?.toLowerCase()
      if (email) {
        const lookupRef = doc(db, 'inviteLookup', email)
        const lookupSnap = await getDoc(lookupRef)

        if (lookupSnap.exists()) {
          const inviteData = lookupSnap.data()
          const inviteOrgId = inviteData.orgId as string
          const role = inviteData.role as 'editor' | 'viewer'

          const batch = writeBatch(db)

          // Delete inviteLookup entry
          batch.delete(lookupRef)

          // Delete the invite doc in the org's invites subcollection
          const inviteRef = doc(db, 'organizations', inviteOrgId, 'invites', email)
          batch.delete(inviteRef)

          // Add user as member with invited role
          const memberRef = doc(db, 'organizations', inviteOrgId, 'members', firebaseUser.uid)
          batch.set(memberRef, {
            role,
            joinedAt: serverTimestamp(),
            displayName: firebaseUser.displayName ?? '',
            email: firebaseUser.email ?? '',
          })

          // Link org to user profile
          batch.update(userRef, { orgIds: [inviteOrgId] })

          await batch.commit()
          return
        }
      }

      // No invite found — auto-create new org for this user
      const batch = writeBatch(db)

      const orgRef = doc(collection(db, 'organizations'))
      const newOrgId = orgRef.id

      batch.set(orgRef, {
        name: `${firebaseUser.displayName || 'My'}'s Church`,
        createdAt: serverTimestamp(),
        createdBy: firebaseUser.uid,
      })

      const memberRef = doc(db, 'organizations', newOrgId, 'members', firebaseUser.uid)
      batch.set(memberRef, {
        role: 'editor',
        joinedAt: serverTimestamp(),
        displayName: firebaseUser.displayName ?? '',
        email: firebaseUser.email ?? '',
      })

      batch.update(userRef, {
        orgIds: [newOrgId],
      })

      await batch.commit()
    }
  }

  async function loginWithGoogle(): Promise<User | null> {
    try {
      const provider = new GoogleAuthProvider()
      const result = await signInWithPopup(auth, provider)
      await ensureUserDocument(result.user)
      return result.user
    } catch (error: unknown) {
      const firebaseError = error as { code?: string }
      if (firebaseError?.code === 'auth/popup-closed-by-user') {
        return null
      }
      throw error
    }
  }

  async function loginWithEmail(email: string, password: string): Promise<User | null> {
    try {
      const result = await signInWithEmailAndPassword(auth, email, password)
      await ensureUserDocument(result.user)
      return result.user
    } catch (error: unknown) {
      const firebaseError = error as { code?: string }
      if (
        firebaseError?.code === 'auth/user-not-found' ||
        firebaseError?.code === 'auth/invalid-credential'
      ) {
        // Auto-create account on first sign-in
        const result = await createUserWithEmailAndPassword(auth, email, password)
        await ensureUserDocument(result.user)
        return result.user
      }
      throw error
    }
  }

  async function registerWithEmail(email: string, password: string): Promise<User | null> {
    const result = await createUserWithEmailAndPassword(auth, email, password)
    await ensureUserDocument(result.user)
    return result.user
  }

  async function resetPassword(email: string): Promise<void> {
    await sendPasswordResetEmail(auth, email)
  }

  async function logout(): Promise<void> {
    orgId.value = null
    orgName.value = null
    userRole.value = null
    memberUnsub?.()
    memberUnsub = null
    await signOut(auth)
  }

  return {
    user,
    isReady,
    isAuthenticated,
    orgId,
    orgName,
    userRole,
    isEditor,
    waitForRole,
    loginWithGoogle,
    loginWithEmail,
    registerWithEmail,
    resetPassword,
    logout,
    ensureUserDocument,
  }
})
