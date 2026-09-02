// Run-mode control->output message protocol (Phase 91, consumed by Phases 92-96's
// multi-window Run mode). A typed, injectable wrapper around BroadcastChannel.
// See .planning/codebase/STACK.md (Utils Stack Notes — src/utils/runChannel.ts)

/** The state the control window broadcasts to every output window. */
export interface RunState {
  index: number
  blackout: boolean
  seq: number
}

/** A `state` broadcast — RunState plus its `type` discriminator. */
export type RunStateMessage = { type: 'state' } & RunState

/** An output window's (re)mount announcement, requesting a fresh `state` resend. */
export interface HelloMessage {
  type: 'hello'
}

/** The full message union this channel carries. */
export type RunChannelMessage = RunStateMessage | HelloMessage

/**
 * The minimal structural shape this module needs from a BroadcastChannel — lets
 * tests inject a deterministic in-memory fake instead of depending on a native
 * BroadcastChannel implementation.
 */
export interface BroadcastChannelLike {
  postMessage(message: unknown): void
  addEventListener(type: 'message', callback: (event: { data: unknown }) => void): void
  close(): void
}

/** Constructs a BroadcastChannelLike for a given channel name. */
export type BroadcastChannelFactory = (name: string) => BroadcastChannelLike

function defaultFactory(name: string): BroadcastChannelLike {
  return new BroadcastChannel(name) as unknown as BroadcastChannelLike
}

/**
 * Handle returned by `openRunChannel` — the caller's entire surface onto the
 * channel. `onState`/`onHello` each hold AT MOST ONE callback per handle —
 * calling either a second time silently overwrites (last-registration-wins,
 * no error). Matches today's one-window-one-handle usage; a future consumer
 * needing multiple subscribers on the same handle must fan out itself.
 */
export interface RunChannelHandle {
  postState(state: RunState): void
  onState(callback: (state: RunState) => void): void
  postHello(): void
  onHello(callback: () => void): void
  close(): void
}

/**
 * The ONE place the channel name is constructed — scopes a channel per service
 * (`wp-run-{serviceId}`) so two concurrent Run sessions in one browser profile
 * never cross-talk (T-91-03).
 */
export function runChannelName(serviceId: string): string {
  return `wp-run-${serviceId}`
}

/** Defensive shape guard — a malformed incoming message must never throw inside a listener. */
function isRunChannelMessage(value: unknown): value is RunChannelMessage {
  if (typeof value !== 'object' || value === null) return false
  const type = (value as { type?: unknown }).type
  if (type === 'hello') return true
  if (type === 'state') {
    const v = value as { index?: unknown; blackout?: unknown; seq?: unknown }
    return (
      typeof v.index === 'number' &&
      Number.isFinite(v.index) &&
      typeof v.blackout === 'boolean' &&
      typeof v.seq === 'number' &&
      Number.isFinite(v.seq)
    )
  }
  return false
}

/**
 * Opens a typed handle onto the `wp-run-{serviceId}` channel. `factory` defaults
 * to the global `BroadcastChannel` constructor in production and is injected by
 * tests for a deterministic in-memory fake.
 */
export function openRunChannel(serviceId: string, factory: BroadcastChannelFactory = defaultFactory): RunChannelHandle {
  const channel = factory(runChannelName(serviceId))

  // Per-handle high-water mark for the stale-drop guard — only ever advances.
  let highestDeliveredSeq = -Infinity

  let stateCallback: ((state: RunState) => void) | undefined
  let helloCallback: (() => void) | undefined

  // Tracks whether close() has been called on THIS handle. The real
  // BroadcastChannel.postMessage() throws InvalidStateError after close() —
  // postState/postHello guard against that by becoming a safe no-op instead
  // of letting a stray in-flight post throw uncaught.
  let closed = false

  channel.addEventListener('message', (event) => {
    const data = event.data
    if (!isRunChannelMessage(data)) return

    if (data.type === 'hello') {
      helloCallback?.()
      return
    }

    // data.type === 'state'
    if (data.seq <= highestDeliveredSeq) return // stale/out-of-order — dropped
    highestDeliveredSeq = data.seq
    stateCallback?.({ index: data.index, blackout: data.blackout, seq: data.seq })
  })

  return {
    postState(state: RunState) {
      if (closed) return
      const message: RunStateMessage = { type: 'state', ...state }
      channel.postMessage(message)
    },
    onState(callback: (state: RunState) => void) {
      stateCallback = callback
    },
    postHello() {
      if (closed) return
      const message: HelloMessage = { type: 'hello' }
      channel.postMessage(message)
    },
    onHello(callback: () => void) {
      helloCallback = callback
    },
    close() {
      closed = true
      channel.close()
    },
  }
}
