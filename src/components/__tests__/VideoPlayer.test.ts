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

  it('default (no chromeless prop) mount still has the controls attribute', () => {
    const wrapper = mount(VideoPlayer, { props: { src: 'https://example.com/clip.mp4' } })

    expect(wrapper.find('video').attributes('controls')).toBeDefined()
  })

  it('chromeless: true mount has no controls attribute', () => {
    const wrapper = mount(VideoPlayer, {
      props: { src: 'https://example.com/clip.mp4', chromeless: true },
    })

    expect(wrapper.find('video').attributes('controls')).toBeUndefined()
  })

  it('chromeless: true video class contains max-h-[80vh] and not max-h-48', () => {
    const wrapper = mount(VideoPlayer, {
      props: { src: 'https://example.com/clip.mp4', chromeless: true },
    })

    const video = wrapper.find('video')
    expect(video.classes()).toContain('max-h-[80vh]')
    expect(video.classes()).not.toContain('max-h-48')
  })

  it('chromeless: true wrapper class does not contain the panel classes', () => {
    const wrapper = mount(VideoPlayer, {
      props: { src: 'https://example.com/clip.mp4', chromeless: true },
    })

    const panel = wrapper.find('[data-testid="video-player"]')
    expect(panel.classes()).not.toContain('bg-gray-800/60')
  })

  it('exposes isMuted true after a muted retry SUCCEEDS', async () => {
    window.HTMLMediaElement.prototype.play = vi
      .fn()
      .mockRejectedValueOnce(new DOMException('blocked', 'NotAllowedError'))
      .mockResolvedValueOnce(undefined)
    const wrapper = mount(VideoPlayer, { props: { src: 'https://example.com/clip.mp4' } })

    await (wrapper.vm as unknown as { play: () => Promise<void> }).play()
    await wrapper.vm.$nextTick()

    expect((wrapper.vm as unknown as { isMuted: boolean }).isMuted).toBe(true)
    expect((wrapper.find('video').element as HTMLVideoElement).muted).toBe(true)
  })

  it('exposes isMuted false after both play attempts FAIL (hard block)', async () => {
    window.HTMLMediaElement.prototype.play = vi
      .fn()
      .mockRejectedValue(new DOMException('blocked', 'NotAllowedError'))
    const wrapper = mount(VideoPlayer, { props: { src: 'https://example.com/clip.mp4' } })

    await (wrapper.vm as unknown as { play: () => Promise<void> }).play()
    await wrapper.vm.$nextTick()

    expect((wrapper.vm as unknown as { isMuted: boolean }).isMuted).toBe(false)
  })

  it('unmute() clears the muted flag and re-plays when play() resolves', async () => {
    window.HTMLMediaElement.prototype.play = vi
      .fn()
      .mockRejectedValueOnce(new DOMException('blocked', 'NotAllowedError'))
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
    const wrapper = mount(VideoPlayer, { props: { src: 'https://example.com/clip.mp4' } })

    await (wrapper.vm as unknown as { play: () => Promise<void> }).play()
    await wrapper.vm.$nextTick()
    expect((wrapper.vm as unknown as { isMuted: boolean }).isMuted).toBe(true)

    await (wrapper.vm as unknown as { unmute: () => Promise<void> }).unmute()
    await wrapper.vm.$nextTick()

    expect((wrapper.vm as unknown as { isMuted: boolean }).isMuted).toBe(false)
  })

  it('unmute() re-blocks and re-emits autoplay-blocked when the re-attempt rejects with NotAllowedError', async () => {
    window.HTMLMediaElement.prototype.play = vi
      .fn()
      .mockRejectedValueOnce(new DOMException('blocked', 'NotAllowedError'))
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new DOMException('blocked', 'NotAllowedError'))
    const wrapper = mount(VideoPlayer, { props: { src: 'https://example.com/clip.mp4' } })

    await (wrapper.vm as unknown as { play: () => Promise<void> }).play()
    await wrapper.vm.$nextTick()
    expect((wrapper.vm as unknown as { isMuted: boolean }).isMuted).toBe(true)

    await (wrapper.vm as unknown as { unmute: () => Promise<void> }).unmute()
    await wrapper.vm.$nextTick()

    expect((wrapper.vm as unknown as { isMuted: boolean }).isMuted).toBe(true)
    expect(wrapper.emitted('autoplay-blocked')?.length).toBeGreaterThanOrEqual(2)
  })

  it('chromeless: true with a hard block emits autoplay-blocked but not video-play-affordance', async () => {
    window.HTMLMediaElement.prototype.play = vi
      .fn()
      .mockRejectedValue(new DOMException('blocked', 'NotAllowedError'))
    const wrapper = mount(VideoPlayer, {
      props: { src: 'https://example.com/clip.mp4', chromeless: true },
    })

    await (wrapper.vm as unknown as { play: () => Promise<void> }).play()
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('autoplay-blocked')).toBeTruthy()
    expect(wrapper.find('[data-testid="video-play-affordance"]').exists()).toBe(false)
  })
})
