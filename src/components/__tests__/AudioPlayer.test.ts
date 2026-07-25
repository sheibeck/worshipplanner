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
})
