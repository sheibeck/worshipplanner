import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, enableAutoUnmount } from '@vue/test-utils'
import RehearseAudioPlayerBar from '../RehearseAudioPlayerBar.vue'
import type { RehearseAttachment } from '@/utils/rehearseAccess'

enableAutoUnmount(afterEach)

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({ user: { uid: 'test-uid' } }),
}))

function makeTrack(overrides: Partial<RehearseAttachment> = {}): RehearseAttachment {
  return {
    id: 'a1',
    name: 'Way Maker (live).mp3',
    kind: 'audio',
    downloadUrl: 'https://cdn.example.com/way-maker-live.mp3',
    ...overrides,
  }
}

/** jsdom's HTMLMediaElement.duration is a read-only getter (always NaN,
 *  since jsdom never actually loads media) — stub it per-instance so the
 *  component's onLoadedMetadata/restore logic has a real number to compare
 *  against, mirroring how the repo already stubs play()/pause() per test. */
function stubDuration(el: HTMLAudioElement, seconds: number): void {
  Object.defineProperty(el, 'duration', { value: seconds, configurable: true })
}

describe('RehearseAudioPlayerBar', () => {
  beforeEach(() => {
    window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined)
    window.HTMLMediaElement.prototype.pause = vi.fn()
    localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders nothing when no track is active', () => {
    const wrapper = mount(RehearseAudioPlayerBar, { props: { track: undefined } })
    expect(wrapper.find('[data-testid="rehearse-player"]').exists()).toBe(false)
    expect(wrapper.find('audio').exists()).toBe(false)
  })

  it('mounts exactly one native <audio> element pointed at the track download URL', () => {
    const track = makeTrack()
    const wrapper = mount(RehearseAudioPlayerBar, { props: { track } })

    const audios = wrapper.findAll('audio')
    expect(audios).toHaveLength(1)
    expect(audios[0]!.attributes('src')).toBe(track.downloadUrl)
  })

  it('selecting a new track REPLACES the src on the same element — never a second <audio>', async () => {
    const track1 = makeTrack({ id: 'a1', downloadUrl: 'https://cdn.example.com/1.mp3' })
    const track2 = makeTrack({ id: 'a2', downloadUrl: 'https://cdn.example.com/2.mp3' })
    const wrapper = mount(RehearseAudioPlayerBar, { props: { track: track1 } })

    await wrapper.setProps({ track: track2 })

    const audios = wrapper.findAll('audio')
    expect(audios).toHaveLength(1)
    expect(audios[0]!.attributes('src')).toBe(track2.downloadUrl)
  })

  it('play/pause toggles playback and updates the aria-label', async () => {
    const track = makeTrack({ name: 'Way Maker (live).mp3' })
    const wrapper = mount(RehearseAudioPlayerBar, { props: { track } })

    const toggle = wrapper.get('[data-testid="rehearse-player-toggle"]')
    expect(toggle.attributes('aria-label')).toBe('Play Way Maker (live).mp3')

    await toggle.trigger('click')
    await Promise.resolve()
    await Promise.resolve()
    expect(window.HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1)
    expect(wrapper.get('[data-testid="rehearse-player-toggle"]').attributes('aria-label')).toBe(
      'Pause Way Maker (live).mp3',
    )

    // jsdom's <audio>.paused stays true even after our stubbed play() call,
    // since play() is stubbed and doesn't flip the element's own `paused`
    // getter — assert the pause branch by driving it through the native
    // 'play' event instead, which is what real browsers dispatch.
    await wrapper.get('audio').trigger('pause')
    expect(wrapper.get('[data-testid="rehearse-player-toggle"]').attributes('aria-label')).toBe(
      'Play Way Maker (live).mp3',
    )
  })

  it('seek input is bound to currentTime and elapsed/total time render as m:ss / m:ss', async () => {
    const track = makeTrack()
    const wrapper = mount(RehearseAudioPlayerBar, { props: { track } })
    const audioEl = wrapper.get('audio').element as HTMLAudioElement
    stubDuration(audioEl, 245) // 4:05

    audioEl.currentTime = 72 // 1:12
    await wrapper.get('audio').trigger('timeupdate')
    await wrapper.get('audio').trigger('loadedmetadata')

    expect(wrapper.get('[data-testid="rehearse-player-time"]').text()).toBe('1:12 / 4:05')
    const seek = wrapper.get('[data-testid="rehearse-player-seek"]')
    expect((seek.element as HTMLInputElement).value).toBe('72')
    expect(seek.attributes('max')).toBe('245')
  })

  it('the speed pill cycles 1x -> 0.9x -> 0.75x -> 1.25x -> 1x and sets audioEl.playbackRate', async () => {
    const track = makeTrack()
    const wrapper = mount(RehearseAudioPlayerBar, { props: { track } })
    const audioEl = wrapper.get('audio').element as HTMLAudioElement
    const speedButton = wrapper.get('[data-testid="rehearse-player-speed"]')

    expect(speedButton.text()).toBe('1×')

    await speedButton.trigger('click')
    expect(speedButton.text()).toBe('0.9×')
    expect(audioEl.playbackRate).toBe(0.9)

    await speedButton.trigger('click')
    expect(speedButton.text()).toBe('0.75×')
    expect(audioEl.playbackRate).toBe(0.75)

    await speedButton.trigger('click')
    expect(speedButton.text()).toBe('1.25×')
    expect(audioEl.playbackRate).toBe(1.25)

    await speedButton.trigger('click')
    expect(speedButton.text()).toBe('1×')
    expect(audioEl.playbackRate).toBe(1)
  })

  it('the Loop toggle sets audioEl.loop and reflects aria-pressed', async () => {
    const track = makeTrack()
    const wrapper = mount(RehearseAudioPlayerBar, { props: { track } })
    const audioEl = wrapper.get('audio').element as HTMLAudioElement
    const loopButton = wrapper.get('[data-testid="rehearse-player-loop"]')

    expect(loopButton.attributes('aria-pressed')).toBe('false')
    expect(audioEl.loop).toBe(false)

    await loopButton.trigger('click')
    expect(loopButton.attributes('aria-pressed')).toBe('true')
    expect(audioEl.loop).toBe(true)

    await loopButton.trigger('click')
    expect(loopButton.attributes('aria-pressed')).toBe('false')
    expect(audioEl.loop).toBe(false)
  })

  it('persists playback position to localStorage keyed by uid+track on timeupdate', async () => {
    const track = makeTrack({ id: 'a1' })
    const wrapper = mount(RehearseAudioPlayerBar, { props: { track } })
    const audioEl = wrapper.get('audio').element as HTMLAudioElement

    audioEl.currentTime = 42
    await wrapper.get('audio').trigger('timeupdate')

    expect(localStorage.getItem('rehearse-audio-position:test-uid:a1')).toBe('42')
  })

  it('restores playback position from localStorage on @loadedmetadata when re-selecting the same track', async () => {
    localStorage.setItem('rehearse-audio-position:test-uid:a1', '42')
    const track = makeTrack({ id: 'a1' })
    const wrapper = mount(RehearseAudioPlayerBar, { props: { track } })
    const audioEl = wrapper.get('audio').element as HTMLAudioElement
    stubDuration(audioEl, 245)

    await wrapper.get('audio').trigger('loadedmetadata')

    expect(audioEl.currentTime).toBe(42)
  })

  it('renders the mobile fixedBottom stacked layout with the same controls', () => {
    const track = makeTrack()
    const wrapper = mount(RehearseAudioPlayerBar, { props: { track, fixedBottom: true } })

    expect(wrapper.get('[data-testid="rehearse-player"]').classes()).toContain('fixed')
    expect(wrapper.find('[data-testid="rehearse-player-seek"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="rehearse-player-speed"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="rehearse-player-loop"]').exists()).toBe(true)
  })
})
