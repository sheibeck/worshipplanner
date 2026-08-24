import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SongBrowser from '../SongBrowser.vue'
import type { Song } from '@/types/song'

function makeSong(overrides: Partial<Song> = {}): Song {
  return {
    id: 'song-1',
    title: 'Amazing Grace',
    ccliNumber: '22025',
    author: 'John Newton',
    themes: ['grace'],
    notes: '',
    vwTypes: [1],
    tags: [],
    removedThemes: [],
    arrangements: [],
    primaryArrangementId: null,
    lastUsedAt: null,
    createdAt: {} as never,
    updatedAt: {} as never,
    pcSongId: null,
    hidden: false,
    ...overrides,
  }
}

function mountBrowser(propsOverrides: Record<string, unknown> = {}) {
  return mount(SongBrowser, {
    props: {
      songs: [],
      availableUserTags: [],
      searchQuery: '',
      includeTags: new Set<string>(),
      excludeTags: new Set<string>(),
      ...propsOverrides,
    },
    slots: {
      default: `<template #default="{ filteredSongs }">
        <div class="rows">
          <div v-for="s in filteredSongs" :key="s.id" class="row">{{ s.title }}</div>
        </div>
      </template>`,
    },
  })
}

describe('SongBrowser (R240)', () => {
  it('passes filteredSongs through unchanged when both include/exclude sets are empty', () => {
    const songs = [makeSong({ id: 'a' }), makeSong({ id: 'b', title: 'How Great Thou Art' })]
    const wrapper = mountBrowser({ songs })
    const rows = wrapper.findAll('.row')
    expect(rows.map((r) => r.text())).toEqual(['Amazing Grace', 'How Great Thou Art'])
  })

  it('excludes a song carrying an excluded tag from filteredSongs', () => {
    const songs = [
      makeSong({ id: 'a', tags: ['Christmas'] }),
      makeSong({ id: 'b', title: 'Untagged', tags: [] }),
    ]
    const wrapper = mountBrowser({ songs, excludeTags: new Set(['Christmas']) })
    const rows = wrapper.findAll('.row')
    expect(rows.map((r) => r.text())).toEqual(['Untagged'])
  })

  it('with a non-empty include set, only songs carrying an included theme OR tag survive', () => {
    const songs = [
      makeSong({ id: 'a', themes: ['grace'], tags: [] }),
      makeSong({ id: 'b', title: 'Other', themes: [], tags: [] }),
    ]
    const wrapper = mountBrowser({ songs, includeTags: new Set(['grace']) })
    const rows = wrapper.findAll('.row')
    expect(rows.map((r) => r.text())).toEqual(['Amazing Grace'])
  })

  it('emits update:searchQuery when typing in the search input', async () => {
    const wrapper = mountBrowser()
    const input = wrapper.find('input[type="text"]')
    await input.setValue('grace')
    expect(wrapper.emitted('update:searchQuery')).toBeTruthy()
    expect(wrapper.emitted('update:searchQuery')?.[0]).toEqual(['grace'])
  })

  it('toggling a tag through TagFilterChecklist emits update:includeTags / update:excludeTags', async () => {
    const wrapper = mountBrowser({ availableUserTags: ['Christmas'] })
    // Open the checklist popover
    await wrapper.find('button').trigger('click')
    const showButton = wrapper.findAll('button').find((b) => b.text() === 'Show')
    expect(showButton).toBeTruthy()
    await showButton!.trigger('click')
    expect(wrapper.emitted('update:includeTags')).toBeTruthy()
    const emittedSet = wrapper.emitted('update:includeTags')?.[0]?.[0] as Set<string>
    expect(emittedSet.has('Christmas')).toBe(true)
  })

  it('emits clearTagFilter when the checklist Clear action is clicked', async () => {
    const wrapper = mountBrowser({ availableUserTags: ['Christmas'] })
    await wrapper.find('button').trigger('click')
    const clearButton = wrapper.findAll('button').find((b) => b.text() === 'Clear tags')
    expect(clearButton).toBeTruthy()
    await clearButton!.trigger('click')
    expect(wrapper.emitted('clearTagFilter')).toBeTruthy()
  })

  it('renders whatever row markup the consumer provides through the default scoped slot', () => {
    const songs = [makeSong({ id: 'a' })]
    const wrapper = mountBrowser({ songs })
    expect(wrapper.find('.rows').exists()).toBe(true)
    expect(wrapper.findAll('.row')).toHaveLength(1)
  })

  it('exposes focusSearch() which focuses the internal search input', async () => {
    const wrapper = mountBrowser()
    const vm = wrapper.vm as unknown as { focusSearch: () => void }
    document.body.appendChild(wrapper.element)
    vm.focusSearch()
    expect(document.activeElement).toBe(wrapper.find('input[type="text"]').element)
    wrapper.element.remove()
  })
})
