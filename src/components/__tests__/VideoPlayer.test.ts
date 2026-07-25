import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import VideoPlayer from '../VideoPlayer.vue'

describe('VideoPlayer', () => {
  beforeEach(() => {
    // jsdom does not implement HTMLMediaElement.play/pause — stub per test.
    window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined)
    window.HTMLMediaElement.prototype.pause = vi.fn()
  })

  it('renders a <video> element with the passed src, preload="none", playsinline, and no loop attribute', () => {
    const wrapper = mount(VideoPlayer, { props: { src: 'https://example.com/clip.mp4' } })

    const video = wrapper.find('video')
    expect(video.exists()).toBe(true)
    expect(video.attributes('src')).toBe('https://example.com/clip.mp4')
    expect(video.attributes('preload')).toBe('none')
    expect(video.attributes('playsinline')).toBeDefined()
    expect(video.attributes('loop')).toBeUndefined()
  })

  it('emits play when the exposed play() resolves', async () => {
    const wrapper = mount(VideoPlayer, { props: { src: 'https://example.com/clip.mp4' } })

    await (wrapper.vm as unknown as { play: () => Promise<void> }).play()

    expect(wrapper.emitted('play')).toBeTruthy()
  })

  it('retries muted and emits autoplay-blocked when play() rejects once with NotAllowedError then resolves', async () => {
    const playMock = vi
      .fn()
      .mockRejectedValueOnce(new DOMException('blocked', 'NotAllowedError'))
      .mockResolvedValueOnce(undefined)
    window.HTMLMediaElement.prototype.play = playMock
    const wrapper = mount(VideoPlayer, { props: { src: 'https://example.com/clip.mp4' } })

    await (wrapper.vm as unknown as { play: () => Promise<void> }).play()
    await wrapper.vm.$nextTick()

    expect(playMock).toHaveBeenCalledTimes(2)
    // Vue sets `muted` as a DOM property (not a reflected attribute) on media
    // elements, so assert against the element's IDL property.
    expect((wrapper.find('video').element as HTMLVideoElement).muted).toBe(true)
    expect(wrapper.emitted('autoplay-blocked')).toBeTruthy()
    expect(wrapper.find('[data-testid="video-play-affordance"]').exists()).toBe(false)
  })

  it('emits autoplay-blocked and reveals the play affordance when play() always rejects with NotAllowedError', async () => {
    window.HTMLMediaElement.prototype.play = vi
      .fn()
      .mockRejectedValue(new DOMException('blocked', 'NotAllowedError'))
    const wrapper = mount(VideoPlayer, { props: { src: 'https://example.com/clip.mp4' } })

    await (wrapper.vm as unknown as { play: () => Promise<void> }).play()
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('autoplay-blocked')).toBeTruthy()
    expect(wrapper.find('[data-testid="video-play-affordance"]').exists()).toBe(true)
  })

  it('re-emits the native ended event as the component ended event', async () => {
    const wrapper = mount(VideoPlayer, { props: { src: 'https://example.com/clip.mp4' } })

    await wrapper.find('video').trigger('ended')

    expect(wrapper.emitted('ended')).toBeTruthy()
  })
})
