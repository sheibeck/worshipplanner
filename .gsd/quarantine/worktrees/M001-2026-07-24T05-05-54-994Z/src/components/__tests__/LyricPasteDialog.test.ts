import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import LyricPasteDialog from '../LyricPasteDialog.vue'

const mockSaveLyrics = vi.fn(() => Promise.resolve())
const mockUpdateSong = vi.fn(() => Promise.resolve())

vi.mock('@/stores/songLyrics', () => ({
  useSongLyricsStore: () => ({
    saveLyrics: mockSaveLyrics,
  }),
}))

vi.mock('@/stores/songs', () => ({
  useSongStore: () => ({
    updateSong: mockUpdateSong,
  }),
}))

const SAMPLE_CCLI = `Amazing Grace

Verse 1
Amazing grace how sweet the sound
That saved a wretch like me
I once was lost but now am found
Was blind but now I see

Chorus
My chains are gone
I've been set free

CCLI Song # 12345
John Newton
© 2023 Test Publisher
For use solely with the SongSelect Terms of Use.  All rights reserved. http://ccli.com
CCLI License # 99999`

async function mountDialog(open = true) {
  const wrapper = mount(LyricPasteDialog, {
    props: { open, songId: 'song-1', orgId: 'org-1' },
    global: {
      stubs: { Teleport: { template: '<div><slot /></div>' } },
    },
  })
  await wrapper.vm.$nextTick()
  return wrapper
}

describe('LyricPasteDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders nothing when closed', async () => {
    const wrapper = await mountDialog(false)
    expect(wrapper.find('[data-testid="confirm-btn"]').exists()).toBe(false)
  })

  it('renders textarea and confirm button when open', async () => {
    const wrapper = await mountDialog()
    expect(wrapper.find('textarea').exists()).toBe(true)
    expect(wrapper.find('[data-testid="confirm-btn"]').exists()).toBe(true)
  })

  it('disables confirm when textarea is empty', async () => {
    const wrapper = await mountDialog()
    const btn = wrapper.find('[data-testid="confirm-btn"]')
    expect((btn.element as HTMLButtonElement).disabled).toBe(true)
  })

  it('shows parsed preview when text is pasted', async () => {
    const wrapper = await mountDialog()
    await wrapper.find('textarea').setValue(SAMPLE_CCLI)
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('Amazing Grace')
    expect(wrapper.text()).toContain('Verse 1')
    expect(wrapper.text()).toContain('Chorus')
    expect(wrapper.text()).toContain('Amazing grace how sweet the sound')
  })

  it('enables confirm when sections are parsed', async () => {
    const wrapper = await mountDialog()
    await wrapper.find('textarea').setValue(SAMPLE_CCLI)
    await wrapper.vm.$nextTick()
    const btn = wrapper.find('[data-testid="confirm-btn"]')
    expect((btn.element as HTMLButtonElement).disabled).toBe(false)
  })

  it('shows copyright info in preview', async () => {
    const wrapper = await mountDialog()
    await wrapper.find('textarea').setValue(SAMPLE_CCLI)
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('CCLI Song # 12345')
    expect(wrapper.text()).toContain('John Newton')
  })

  it('shows warning when paste has no sections', async () => {
    const wrapper = await mountDialog()
    await wrapper.find('textarea').setValue('just some text without section markers')
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('No sections detected')
  })

  it('calls saveLyrics and updateSong on confirm', async () => {
    const wrapper = await mountDialog()
    await wrapper.find('textarea').setValue(SAMPLE_CCLI)
    await wrapper.vm.$nextTick()
    await wrapper.find('[data-testid="confirm-btn"]').trigger('click')
    await vi.waitFor(() => {
      expect(mockSaveLyrics).toHaveBeenCalled()
    })

    expect(mockSaveLyrics).toHaveBeenCalledWith('org-1', 'song-1', expect.objectContaining({
      sections: expect.arrayContaining([
        expect.objectContaining({ label: 'Verse 1' }),
        expect.objectContaining({ label: 'Chorus' }),
      ]),
      performanceOrder: expect.arrayContaining(['verse-1', 'chorus']),
    }))
    expect(mockUpdateSong).toHaveBeenCalledWith('song-1', {
      performanceOrder: expect.arrayContaining(['verse-1', 'chorus']),
    })
  })

  it('emits saved after successful confirm', async () => {
    const wrapper = await mountDialog()
    await wrapper.find('textarea').setValue(SAMPLE_CCLI)
    await wrapper.vm.$nextTick()
    await wrapper.find('[data-testid="confirm-btn"]').trigger('click')
    await vi.waitFor(() => {
      expect(wrapper.emitted('saved')).toBeTruthy()
    })
  })

  it('prompts discard on cancel when textarea has content', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const wrapper = await mountDialog()
    await wrapper.find('textarea').setValue(SAMPLE_CCLI)
    await wrapper.vm.$nextTick()

    const cancelBtn = wrapper.findAll('button').find((b) => b.text().includes('Cancel'))!
    await cancelBtn.trigger('click')
    expect(confirmSpy).toHaveBeenCalled()
    expect(wrapper.emitted('close')).toBeFalsy()
    confirmSpy.mockRestore()
  })

  it('emits close on cancel when textarea is empty', async () => {
    const wrapper = await mountDialog()
    const cancelBtn = wrapper.findAll('button').find((b) => b.text().includes('Cancel'))!
    await cancelBtn.trigger('click')
    expect(wrapper.emitted('close')).toBeTruthy()
  })

  it('resets textarea when reopened', async () => {
    const wrapper = await mountDialog()
    await wrapper.find('textarea').setValue(SAMPLE_CCLI)
    await wrapper.setProps({ open: false })
    await wrapper.vm.$nextTick()
    await wrapper.setProps({ open: true })
    await wrapper.vm.$nextTick()
    const textarea = wrapper.find('textarea')
    expect((textarea.element as HTMLTextAreaElement).value).toBe('')
  })
})
