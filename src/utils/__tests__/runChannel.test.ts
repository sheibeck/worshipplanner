import { describe, it, expect, vi } from 'vitest'
import { openRunChannel, runChannelName } from '@/utils/runChannel'
import type { BroadcastChannelLike, RunChannelMessage } from '@/utils/runChannel'

/**
 * Deterministic in-memory fake BroadcastChannel, keyed by channel name, so two
 * handles opened on the same name exchange messages synchronously — without
 * relying on jsdom/Node to provide a native BroadcastChannel (it does not
 * reliably do so). Mirrors the platform's real same-origin fan-out semantics:
 * a message posted from one handle is delivered to every OTHER handle on the
 * same channel name, never back to the poster itself.
 */
function makeFakeChannelFactory() {
  const listenersByName = new Map<string, Set<(msg: RunChannelMessage) => void>>()

  const factory = (name: string): BroadcastChannelLike => {
    let closed = false
    const onMessage = (msg: RunChannelMessage) => {
      if (closed) return
      const listeners = listenersByName.get(name)
      if (!listeners) return
      for (const listener of listeners) {
        if (listener !== selfListener) listener(msg)
      }
    }

    let selfListener: (msg: RunChannelMessage) => void
    selfListener = onMessage

    const channel: BroadcastChannelLike = {
      postMessage(msg: unknown) {
        if (closed) return
        const listeners = listenersByName.get(name)
        if (!listeners) return
        for (const listener of listeners) {
          if (listener !== selfListener) listener(msg as RunChannelMessage)
        }
      },
      addEventListener(_type: string, cb: (event: { data: unknown }) => void) {
        if (!listenersByName.has(name)) listenersByName.set(name, new Set())
        const wrapped = (msg: RunChannelMessage) => cb({ data: msg })
        selfListener = wrapped
        listenersByName.get(name)!.add(wrapped)
      },
      close() {
        closed = true
        const listeners = listenersByName.get(name)
        if (listeners) listeners.delete(selfListener)
      },
    }
    return channel
  }

  return factory
}

describe('runChannelName', () => {
  it('returns the literal wp-run-{serviceId}', () => {
    expect(runChannelName('svc-1')).toBe('wp-run-svc-1')
  })

  it('produces different names for different serviceIds', () => {
    expect(runChannelName('svc-1')).not.toBe(runChannelName('svc-2'))
  })
})

describe('openRunChannel', () => {
  it('constructs a channel with name wp-run-{serviceId} via the injected factory', () => {
    const factory = vi.fn(makeFakeChannelFactory())
    const handle = openRunChannel('svc-1', factory)
    expect(factory).toHaveBeenCalledWith('wp-run-svc-1')
    handle.close()
  })

  it('postState sends a message equal to { type: "state", index, blackout, seq } on the channel', () => {
    const factory = makeFakeChannelFactory()
    const control = openRunChannel('svc-1', factory)
    const output = openRunChannel('svc-1', factory)

    const received: RunChannelMessage[] = []
    output.onState((state) => received.push({ type: 'state', ...state }))

    control.postState({ index: 2, blackout: false, seq: 1 })

    expect(received).toEqual([{ type: 'state', index: 2, blackout: false, seq: 1 }])

    control.close()
    output.close()
  })

  it('onState on a second handle for the same serviceId receives a state posted by the first', () => {
    const factory = makeFakeChannelFactory()
    const control = openRunChannel('svc-1', factory)
    const output = openRunChannel('svc-1', factory)

    const cb = vi.fn()
    output.onState(cb)
    control.postState({ index: 0, blackout: false, seq: 1 })

    expect(cb).toHaveBeenCalledTimes(1)
    expect(cb).toHaveBeenCalledWith({ index: 0, blackout: false, seq: 1 })

    control.close()
    output.close()
  })

  it('drops a stale/out-of-order state message (seq not strictly greater than the last delivered)', () => {
    const factory = makeFakeChannelFactory()
    const control = openRunChannel('svc-1', factory)
    const output = openRunChannel('svc-1', factory)

    const delivered: number[] = []
    output.onState((state) => delivered.push(state.seq))

    control.postState({ index: 0, blackout: false, seq: 1 })
    control.postState({ index: 0, blackout: false, seq: 3 })
    control.postState({ index: 0, blackout: false, seq: 2 }) // stale — dropped

    expect(delivered).toEqual([1, 3])

    control.close()
    output.close()
  })

  it('drops a message whose seq equals the last delivered seq', () => {
    const factory = makeFakeChannelFactory()
    const control = openRunChannel('svc-1', factory)
    const output = openRunChannel('svc-1', factory)

    const delivered: number[] = []
    output.onState((state) => delivered.push(state.seq))

    control.postState({ index: 0, blackout: false, seq: 5 })
    control.postState({ index: 1, blackout: false, seq: 5 }) // equal seq — dropped

    expect(delivered).toEqual([5])

    control.close()
    output.close()
  })

  it('postHello sends { type: "hello" }; onHello fires on hello, onState does not', () => {
    const factory = makeFakeChannelFactory()
    const control = openRunChannel('svc-1', factory)
    const output = openRunChannel('svc-1', factory)

    const helloCb = vi.fn()
    const stateCb = vi.fn()
    control.onHello(helloCb)
    control.onState(stateCb)

    output.postHello()

    expect(helloCb).toHaveBeenCalledTimes(1)
    expect(stateCb).not.toHaveBeenCalled()

    control.close()
    output.close()
  })

  it('a state message does not fire onHello', () => {
    const factory = makeFakeChannelFactory()
    const control = openRunChannel('svc-1', factory)
    const output = openRunChannel('svc-1', factory)

    const helloCb = vi.fn()
    output.onHello(helloCb)

    control.postState({ index: 0, blackout: false, seq: 1 })

    expect(helloCb).not.toHaveBeenCalled()

    control.close()
    output.close()
  })

  it('close() closes the underlying channel; further posts on that handle do not deliver', () => {
    const factory = makeFakeChannelFactory()
    const control = openRunChannel('svc-1', factory)
    const output = openRunChannel('svc-1', factory)

    const cb = vi.fn()
    output.onState(cb)

    control.close()
    control.postState({ index: 0, blackout: false, seq: 1 })

    expect(cb).not.toHaveBeenCalled()

    output.close()
  })

  it('ignores a state message with seq: NaN — never delivered, never corrupts the stale-drop high-water mark', () => {
    const factory = makeFakeChannelFactory()
    const control = openRunChannel('svc-1', factory)
    const output = openRunChannel('svc-1', factory)

    const delivered: number[] = []
    output.onState((state) => delivered.push(state.seq))

    control.postState({ index: 0, blackout: false, seq: 1 })
    control.postState({ index: 1, blackout: false, seq: NaN }) // malformed — dropped by shape guard
    control.postState({ index: 2, blackout: false, seq: 2 }) // must still deliver — high-water mark not corrupted

    expect(delivered).toEqual([1, 2])

    control.close()
    output.close()
  })

  it('ignores a state message with seq: Infinity — never delivered, never permanently blocks later legitimate messages', () => {
    const factory = makeFakeChannelFactory()
    const control = openRunChannel('svc-1', factory)
    const output = openRunChannel('svc-1', factory)

    const delivered: number[] = []
    output.onState((state) => delivered.push(state.seq))

    control.postState({ index: 0, blackout: false, seq: 1 })
    control.postState({ index: 1, blackout: false, seq: Infinity }) // malformed — dropped by shape guard
    control.postState({ index: 2, blackout: false, seq: 2 }) // must still deliver — high-water mark not corrupted

    expect(delivered).toEqual([1, 2])

    control.close()
    output.close()
  })

  it('defaults to the global BroadcastChannel constructor when no factory is supplied', () => {
    class StubBroadcastChannel {
      name: string
      onmessage: ((event: { data: unknown }) => void) | null = null
      constructor(name: string) {
        this.name = name
      }
      postMessage(_msg: unknown) {}
      addEventListener(_type: string, _cb: (event: { data: unknown }) => void) {}
      close() {}
    }
    vi.stubGlobal('BroadcastChannel', StubBroadcastChannel)

    const handle = openRunChannel('svc-default')
    expect(handle).toBeTruthy()
    handle.close()

    vi.unstubAllGlobals()
  })
})
