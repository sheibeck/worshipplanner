import { ref } from 'vue'
import { defineStore } from 'pinia'
import {
  collection,
  onSnapshot,
  getDocs,
  query,
  orderBy,
  where,
  type Timestamp,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from '@/firebase'

/**
 * The message `type` discriminant. Phase 59 ships `oneoff` / `reminder` /
 * `share-link`; Phases 61–62 add the automatic lock/relock/scheduled types.
 * Kept as a widened union (string) so an unrecognized future type maps to the
 * "Automatic" badge rather than breaking the panel.
 */
export type ServiceMessageType =
  | 'oneoff'
  | 'reminder'
  | 'share-link'
  | 'lock-notification'
  | 'relock-notification'
  | (string & {})

/** The message lifecycle status (59-03 send trigger + the queue shaper). */
export type ServiceMessageStatus =
  | 'queued'
  | 'scheduled'
  | 'sending'
  | 'sent'
  | 'partial'
  | 'failed'

/**
 * Rolled-up per-message delivery tallies. Phase 59 shipped `{ sent, failed }`;
 * Phase 60's webhook ADDS the `bounced` leaf. Older docs never carry `bounced`
 * — the client map defaults a missing leaf to 0 (no false bounce indicator).
 */
export interface ServiceMessageDeliveryCounts {
  sent: number
  failed: number
  bounced: number
}

/**
 * The functions-free client view of a `messages/{id}` doc — only the fields the
 * read-only history panel renders. The Firestore server shape is
 * `QueuedMessageDoc` in `functions/src/index.ts`; this is deliberately narrower.
 */
export interface ServiceMessageDoc {
  id: string
  type: ServiceMessageType
  status: ServiceMessageStatus
  subject: string
  sentAt: Timestamp | null
  scheduledFor: string | null
  createdAt: Timestamp | null
  deliveryCounts: ServiceMessageDeliveryCounts
}

/** A single bounced recipient, read lazily from `messages/{id}/recipients`. */
export interface BouncedRecipient {
  personId: string
  name: string
  email: string
  bounceReason: string | null
}

/** Coerce an unknown leaf to a finite number, defaulting to 0. */
function num(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

/**
 * Map a raw `messages/{id}` snapshot doc to the narrow client view. A missing
 * `deliveryCounts` (or a missing `.bounced` leaf on older Phase-59 docs) is
 * normalized to 0 so the panel never renders a false bounce indicator.
 */
function mapMessageDoc(id: string, data: Record<string, unknown>): ServiceMessageDoc {
  const dc = (data.deliveryCounts as Record<string, unknown> | undefined) ?? {}
  return {
    id,
    type: (data.type as ServiceMessageType) ?? 'oneoff',
    status: (data.status as ServiceMessageStatus) ?? 'queued',
    subject: typeof data.subject === 'string' ? data.subject : '',
    sentAt: (data.sentAt as Timestamp | null) ?? null,
    scheduledFor: typeof data.scheduledFor === 'string' ? data.scheduledFor : null,
    createdAt: (data.createdAt as Timestamp | null) ?? null,
    deliveryCounts: {
      sent: num(dc.sent),
      failed: num(dc.failed),
      bounced: num(dc.bounced),
    },
  }
}

/**
 * The per-service delivery-history read store (R142/R143). Models
 * `songLyrics.ts::subscribeLyrics` — a single-listener nested-subcollection
 * onSnapshot over `services/{id}/messages` (newest-first), plus a lazy one-shot
 * read of a message's bounced recipients on expand. NESTED-path reads only (no
 * client collectionGroup), so the Phase 58 `isOrgMember` rules already cover it
 * — no new Firestore rule. Read-only: the store issues NO writes.
 */
export const useServiceMessagesStore = defineStore('serviceMessages', () => {
  const messages = ref<ServiceMessageDoc[]>([])
  const isLoading = ref(true)

  let unsubscribeFn: Unsubscribe | null = null

  /**
   * Subscribe to real-time updates on a service's `messages` subcollection,
   * ordered by `createdAt` desc (newest-first — R142 ordering). Re-subscribing
   * (a new serviceId) tears down the prior listener first (single-listener
   * guard, mirroring `subscribeLyrics`).
   */
  function subscribeServiceMessages(orgId: string, serviceId: string): void {
    if (unsubscribeFn) {
      unsubscribeFn()
    }
    isLoading.value = true
    const q = query(
      collection(db, 'organizations', orgId, 'services', serviceId, 'messages'),
      orderBy('createdAt', 'desc'),
    )
    unsubscribeFn = onSnapshot(q, (snap) => {
      messages.value = snap.docs.map((d) => mapMessageDoc(d.id, d.data() as Record<string, unknown>))
      isLoading.value = false
    })
  }

  /** Cleanup the snapshot listener and clear state. */
  function unsubscribeServiceMessages(): void {
    unsubscribeFn?.()
    unsubscribeFn = null
    messages.value = []
    isLoading.value = true
  }

  /**
   * Lazily read a message's bounced recipients (on expand). A one-shot
   * `getDocs` over `messages/{id}/recipients` filtered to `status === 'bounced'`
   * — a NESTED-path read (no client collectionGroup). Returns the mapped rows;
   * `personId` falls back to the recipient doc id (== personId in the 59-03
   * schema) when the field is absent.
   */
  async function fetchBouncedRecipients(
    orgId: string,
    serviceId: string,
    messageId: string,
  ): Promise<BouncedRecipient[]> {
    const q = query(
      collection(db, 'organizations', orgId, 'services', serviceId, 'messages', messageId, 'recipients'),
      where('status', '==', 'bounced'),
    )
    const snap = await getDocs(q)
    return snap.docs.map((d) => {
      const data = d.data() as Record<string, unknown>
      return {
        personId: typeof data.personId === 'string' ? data.personId : d.id,
        name: typeof data.name === 'string' ? data.name : '',
        email: typeof data.email === 'string' ? data.email : '',
        bounceReason: typeof data.bounceReason === 'string' ? data.bounceReason : null,
      }
    })
  }

  return {
    messages,
    isLoading,
    subscribeServiceMessages,
    unsubscribeServiceMessages,
    fetchBouncedRecipients,
  }
})
