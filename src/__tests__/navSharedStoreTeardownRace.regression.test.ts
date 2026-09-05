import { describe, it, expect } from 'vitest'
import { defineComponent, h, onUnmounted, watch, ref, nextTick } from 'vue'
import { createRouter, createMemoryHistory, RouterView } from 'vue-router'
import { createPinia, setActivePinia, defineStore } from 'pinia'
import { mount } from '@vue/test-utils'

/**
 * v2.10 hotfix regression guard — the shared org-scoped store NAVIGATION
 * TEARDOWN RACE.
 *
 * Root cause: a per-view `onUnmounted(() => sharedStore.unsubscribeAll())` runs
 * as a DEFERRED post-render effect, while the incoming route view's
 * `watch(orgId, { immediate: true })` -> `sharedStore.subscribe()` runs
 * SYNCHRONOUSLY during setup. So on any navigation between two views that touch
 * the same shared singleton store, the OUTGOING view's teardown executes AFTER
 * the INCOMING view's re-subscribe and wipes the listener that view just
 * attached. `orgId` is unchanged, so the immediate watch never re-fires -> the
 * store stays empty until a full reload. (Symptoms: RosterView data vanished on
 * nav-away-and-back; GettingStarted reappeared; schedule/quarters missing after
 * a church switch.)
 *
 * These tests exercise the CROSS-VIEW ordering through a REAL vue-router
 * RouterView — the thing the previous per-component unit tests could not, since
 * they mounted one view in isolation with mocked lifecycle.
 *
 * `makeView(teardownOnUnmount)` reproduces the exact real-view lifecycle shape:
 *   - watch(orgId, { immediate: true }) -> unsubscribeAll() then subscribe()
 *   - optional onUnmounted -> unsubscribeAll()   <-- the forbidden line
 */

const orgId = ref<string>('orgA')

function makeSharedStore(id: string) {
  return defineStore(id, () => {
    const data = ref<string[]>([])
    const subscribed = ref(false)
    function subscribe(org: string) {
      subscribed.value = true
      data.value = [`${org}:doc`] // stand-in for an onSnapshot delivering docs
    }
    function unsubscribeAll() {
      subscribed.value = false
      data.value = []
    }
    return { data, subscribed, subscribe, unsubscribeAll }
  })
}

function makeView(
  name: string,
  useStore: ReturnType<typeof makeSharedStore>,
  teardownOnUnmount: boolean,
) {
  return defineComponent({
    name,
    setup() {
      const store = useStore()
      watch(
        () => orgId.value,
        (org) => {
          store.unsubscribeAll()
          if (org) store.subscribe(org)
        },
        { immediate: true },
      )
      if (teardownOnUnmount) {
        onUnmounted(() => store.unsubscribeAll())
      }
      return () => h('div', name)
    },
  })
}

async function driveRoundTrip(useStore: ReturnType<typeof makeSharedStore>, teardown: boolean) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/a', component: makeView('A', useStore, teardown) },
      { path: '/b', component: makeView('B', useStore, teardown) },
    ],
  })
  router.push('/a')
  await router.isReady()
  const Root = defineComponent({ setup: () => () => h(RouterView) })
  const wrapper = mount(Root, { global: { plugins: [router] } })
  await nextTick()

  const store = useStore()
  const onA1 = { ...pick(store) }

  await router.push('/b')
  await nextTick()
  const onB = { ...pick(store) }

  await router.push('/a')
  await nextTick()
  const onA2 = { ...pick(store) }

  wrapper.unmount()
  return { onA1, onB, onA2 }
}

function pick(store: { subscribed: boolean; data: string[] }) {
  return { subscribed: store.subscribed, data: [...store.data] }
}

describe('shared org-scoped store navigation teardown race (v2.10 hotfix)', () => {
  // Negative control: proves the harness actually detects the race, and locks
  // in WHY the onUnmounted teardown of a shared store is forbidden. If a future
  // change re-adds onUnmounted -> sharedStore.unsubscribeAll() to a view, this
  // is the behaviour it reintroduces.
  it('DEMONSTRATES the bug: onUnmounted teardown wipes the store the incoming view just subscribed', async () => {
    setActivePinia(createPinia())
    const useStore = makeSharedStore('racy-shared')
    const { onB, onA2 } = await driveRoundTrip(useStore, /* teardownOnUnmount */ true)

    // The incoming view re-subscribed synchronously, then the outgoing view's
    // deferred onUnmounted tore it down -> empty on the page you navigated TO.
    expect(onB.subscribed).toBe(false)
    expect(onB.data).toEqual([])
    expect(onA2.subscribed).toBe(false)
    expect(onA2.data).toEqual([])
  })

  // The fix: views subscribe on mount via the immediate watch but DO NOT tear
  // the shared org-scoped store down in onUnmounted. Teardown is owned solely by
  // resetOrgScopedStores() (church switch / logout). The store the current view
  // needs stays subscribed with data across navigation in both directions.
  it('is FIXED when the shared store is not torn down in onUnmounted: data survives navigation', async () => {
    setActivePinia(createPinia())
    const useStore = makeSharedStore('safe-shared')
    const { onA1, onB, onA2 } = await driveRoundTrip(useStore, /* teardownOnUnmount */ false)

    expect(onA1.subscribed).toBe(true)
    expect(onB.subscribed, 'store stays subscribed on the page navigated TO (/b)').toBe(true)
    expect(onB.data).toEqual(['orgA:doc'])
    expect(onA2.subscribed, 'store stays subscribed back on /a').toBe(true)
    expect(onA2.data).toEqual(['orgA:doc'])
  })
})
