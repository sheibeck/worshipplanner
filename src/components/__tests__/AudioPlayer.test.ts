import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import AudioPlayer from '../AudioPlayer.vue'

describe('AudioPlayer', () => {
  beforeEach(() => {
    // jsdom does not implement HTMLMediaElement.play/pause — stub per test.
    window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined)
    window.HTMLMediaElement.prototype.pause = vi.fn()
  })

  it('renders an <audio> element with the passed src, preload="none", and no loop attribute', () => {
    const wrapper = mount(AudioPlayer, { props: { src: 'https://example.com/song.mp3' } })

    const audio = wrapper.find('audio')
    expect(audio.exists()).toBe(true)
    expect(audio.attributes('src')).toBe('https://example.com/song.mp3')
    expect(audio.attributes('preload')).toBe('none')
    expect(audio.attributes('loop')).toBeUndefined()
  })

  it('emits play when the exposed play() resolves', async () => {
    const wrapper = mount(AudioPlayer, { props: { src: 'https://example.com/song.mp3' } })

    await (wrapper.vm as unknown as { play: () => Promise<void> }).play()

    expect(wrapper.emitted('play')).toBeTruthy()
  })

  it('emits autoplay-blocked and reveals the play affordance when play() rejects with NotAllowedError', async () => {
    window.HTMLMediaElement.prototype.play = vi
      .fn()
      .mockRejectedValue(new DOMException('blocked', 'NotAllowedError'))
    const wrapper = mount(AudioPlayer, { props: { src: 'https://example.com/song.mp3' } })

    await (wrapper.vm as unknown as { play: () => Promise<void> }).play()
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('autoplay-blocked')).toBeTruthy()
    expect(wrapper.find('[data-testid="audio-play-affordance"]').exists()).toBe(true)
  })

  it('re-emits the native ended event as the component ended event', async () => {
    const wrapper = mount(AudioPlayer, { props: { src: 'https://example.com/song.mp3' } })

    await wrapper.find('audio').trigger('ended')

    expect(wrapper.emitted('ended')).toBeTruthy()
  })

  it('default (no chromeless prop) mount still has the controls attribute', () => {
    const wrapper = mount(AudioPlayer, { props: { src: 'https://example.com/song.mp3' } })

    expect(wrapper.find('audio').attributes('controls')).toBeDefined()
  })

  it('chromeless: true mount has no controls attribute', () => {
    const wrapper = mount(AudioPlayer, {
      props: { src: 'https://example.com/song.mp3', chromeless: true },
    })

    expect(wrapper.find('audio').attributes('controls')).toBeUndefined()
  })

  it('chromeless: true wrapper class does not contain the panel classes', () => {
    const wrapper = mount(AudioPlayer, {
      props: { src: 'https://example.com/song.mp3', chromeless: true },
    })

    const panel = wrapper.find('[data-testid="audio-player"]')
    expect(panel.classes()).not.toContain('bg-gray-800/60')
    expect(panel.classes()).not.toContain('border-gray-700/50')
    expect(panel.classes()).not.toContain('p-2')
  })

  it('chromeless: true suppresses the internal play affordance on autoplay-blocked, default renders it', async () => {
    window.HTMLMediaElement.prototype.play = vi
      .fn()
      .mockRejectedValue(new DOMException('blocked', 'NotAllowedError'))

    const chromelessWrapper = mount(AudioPlayer, {
      props: { src: 'https://example.com/song.mp3', chromeless: true },
    })
    await (chromelessWrapper.vm as unknown as { play: () => Promise<void> }).play()
    await chromelessWrapper.vm.$nextTick()

    expect(chromelessWrapper.emitted('autoplay-blocked')).toBeTruthy()
    expect(chromelessWrapper.find('[data-testid="audio-play-affordance"]').exists()).toBe(false)

    const defaultWrapper = mount(AudioPlayer, { props: { src: 'https://example.com/song.mp3' } })
    await (defaultWrapper.vm as unknown as { play: () => Promise<void> }).play()
    await defaultWrapper.vm.$nextTick()

    expect(defaultWrapper.emitted('autoplay-blocked')).toBeTruthy()
    expect(defaultWrapper.find('[data-testid="audio-play-affordance"]').exists()).toBe(true)
  })
})
