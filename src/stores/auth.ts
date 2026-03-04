import { ref, computed } from 'vue'
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
} from 'firebase/firestore'
import { auth, db } from '@/firebase'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const isReady = ref(false)

  const isAuthenticated = computed(() => user.value !== null)

  // Listen for auth state changes
  onAuthStateChanged(auth, (firebaseUser) => {
    user.value = firebaseUser
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
      const batch = writeBatch(db)

      const orgRef = doc(collection(db, 'organizations'))
      const orgId = orgRef.id

      batch.set(orgRef, {
        name: `${firebaseUser.displayName || 'My'}'s Church`,
        createdAt: serverTimestamp(),
        createdBy: firebaseUser.uid,
      })

      const memberRef = doc(db, 'organizations', orgId, 'members', firebaseUser.uid)
      batch.set(memberRef, {
        role: 'admin',
        joinedAt: serverTimestamp(),
      })

      batch.update(userRef, {
        orgIds: [orgId],
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
    await signOut(auth)
  }

  return {
    user,
    isReady,
    isAuthenticated,
    loginWithGoogle,
    loginWithEmail,
    registerWithEmail,
    resetPassword,
    logout,
    ensureUserDocument,
  }
})
