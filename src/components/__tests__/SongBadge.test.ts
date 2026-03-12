import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SongBadge from '../SongBadge.vue'

describe('SongBadge', () => {
  describe('VW type 1', () => {
    it('renders "Type 1" text', () => {
      const wrapper = mount(SongBadge, { props: { types: [1] } })
      expect(wrapper.text()).toContain('Type 1')
    })

    it('has blue styling classes', () => {
      const wrapper = mount(SongBadge, { props: { types: [1] } })
      const span = wrapper.find('span.bg-blue-900\\/50')
      expect(span.classes()).toContain('bg-blue-900/50')
      expect(span.classes()).toContain('text-blue-300')
      expect(span.classes()).toContain('border-blue-800')
    })
  })

  describe('VW type 2', () => {
    it('renders "Type 2" text', () => {
      const wrapper = mount(SongBadge, { props: { types: [2] } })
      expect(wrapper.text()).toContain('Type 2')
    })

    it('has purple styling classes', () => {
      const wrapper = mount(SongBadge, { props: { types: [2] } })
      const span = wrapper.find('span.bg-purple-900\\/50')
      expect(span.classes()).toContain('bg-purple-900/50')
      expect(span.classes()).toContain('text-purple-300')
      expect(span.classes()).toContain('border-purple-800')
    })
  })

  describe('VW type 3', () => {
    it('renders "Type 3" text', () => {
      const wrapper = mount(SongBadge, { props: { types: [3] } })
      expect(wrapper.text()).toContain('Type 3')
    })

    it('has amber styling classes', () => {
      const wrapper = mount(SongBadge, { props: { types: [3] } })
      const span = wrapper.find('span.bg-amber-900\\/50')
      expect(span.classes()).toContain('bg-amber-900/50')
      expect(span.classes()).toContain('text-amber-300')
      expect(span.classes()).toContain('border-amber-800')
    })
  })

  describe('empty types array (uncategorized)', () => {
    it('renders a muted dash badge when types is empty', () => {
      const wrapper = mount(SongBadge, { props: { types: [] } })
      expect(wrapper.find('span').exists()).toBe(true)
      // Should not render "Type" text
      expect(wrapper.text()).not.toContain('Type')
    })

    it('has muted gray styling classes', () => {
      const wrapper = mount(SongBadge, { props: { types: [] } })
      const span = wrapper.find('span.bg-gray-800')
      expect(span.classes()).toContain('bg-gray-800')
      expect(span.classes()).toContain('text-gray-500')
      expect(span.classes()).toContain('border-gray-700')
    })
  })

  describe('multiple types', () => {
    it('renders two badge spans for types [1, 2]', () => {
      const wrapper = mount(SongBadge, { props: { types: [1, 2] } })
      expect(wrapper.text()).toContain('Type 1')
      expect(wrapper.text()).toContain('Type 2')
      const badges = wrapper.findAll('span.border')
      expect(badges).toHaveLength(2)
    })

    it('renders three badge spans for types [1, 2, 3]', () => {
      const wrapper = mount(SongBadge, { props: { types: [1, 2, 3] } })
      expect(wrapper.text()).toContain('Type 1')
      expect(wrapper.text()).toContain('Type 2')
      expect(wrapper.text()).toContain('Type 3')
    })
  })
})
