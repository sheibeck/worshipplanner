import { ref } from 'vue'
import type { RehearseAccessDoc } from '@/utils/rehearseAccess'

export type VolunteerServiceDocState = 'loading' | 'loaded' | 'access-denied' | 'load-failure'

// RED stub (127-05, TDD) — intentionally unimplemented so
// useVolunteerServiceDoc.test.ts fails first. See the GREEN commit for the
// real orgId-from-store resolution + live get-arm re-fetch implementation.
export function useVolunteerServiceDoc(_serviceId: string) {
  const state = ref<VolunteerServiceDocState>('loading')
  const doc = ref<RehearseAccessDoc | null>(null)
  function retry(): Promise<void> {
    return Promise.resolve()
  }
  return { state, doc, retry }
}
