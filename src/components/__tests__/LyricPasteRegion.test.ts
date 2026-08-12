import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import LyricPasteRegion from '../LyricPasteRegion.vue'

const mockSaveLyrics = vi.fn(() => Promise.resolve())

vi.mock('@/stores/songLyrics', () => ({
  useSongLyricsStore: () => ({
    saveLyrics: mockSaveLyrics,
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

// A paste whose Chorus marker repeats verbatim — D-02/D006: normalizeParsedSections
// must pool this to ONE section referenced twice, not two duplicated sections.
const SAMPLE_CCLI_REPEATED_CHORUS = `Amazing Grace

Verse 1
Amazing grace how sweet the sound
That saved a wretch like me

Chorus
My chains are gone
I've been set free

Verse 2
Through many dangers toils and snares
I have already come

Chorus
My chains are gone
I've been set free

CCLI Song # 12345
John Newton
© 2023 Test Publisher
For use solely with the SongSelect Terms of Use.  All rights reserved. http://ccli.com
CCLI License # 99999`

// R065 fixture — SAMPLE_CCLI with its trailing CCLI/copyright block removed, so
// sections detect but parsed.copyright.ccliSongNumber stays ''.
const SAMPLE_CCLI_NO_COPYRIGHT = `Amazing Grace

Verse 1
Amazing grace how sweet the sound
That saved a wretch like me
I once was lost but now am found
Was blind but now I see

Chorus
My chains are gone
I've been set free`

// Singular/plural fixture — exactly one detected section, no copyright block.
const SAMPLE_ONE_SECTION = `Song Title

Verse 1
Some words here`

async function mountRegion() {
  const wrapper = mount(LyricPasteRegion, {
    props: { songId: 'song-1', orgId: 'org-1', currentSectionCount: 2 },
  })
  await wrapper.vm.$nextTick()
  return wrapper
}

describe('LyricPasteRegion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // Rows 12-13 of the deleted modal test file ("renders nothing when closed", "resets
  // textarea when reopened") are NOT ported here — the open/closed and reopen-reset
  // mechanisms are now the host's v-if/mount-unmount, not an `open` prop. They move
  // to plan 04's SongLyricEditor.test.ts.

  it('renders textarea and replace-lyrics button', async () => {
    const wrapper = await mountRegion()
    expect(wrapper.find('[data-testid="paste-textarea"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="paste-replace-btn"]').exists()).toBe(true)
  })

  it('disables confirm when textarea is empty', async () => {
    const wrapper = await mountRegion()
    const btn = wrapper.find('[data-testid="paste-replace-btn"]')
    expect((btn.element as HTMLButtonElement).disabled).toBe(true)
  })

  it('shows section chips and summary count when text is pasted', async () => {
    const wrapper = await mountRegion()
    await wrapper.find('[data-testid="paste-textarea"]').setValue(SAMPLE_CCLI)
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('Verse 1')
    expect(wrapper.text()).toContain('Chorus')
    expect(wrapper.find('[data-testid="paste-summary-line"]').text()).toContain('2 sections')
    const chips = wrapper.findAll('[data-testid^="paste-section-chip-"]')
    expect(chips).toHaveLength(2)
  })

  it('enables confirm when sections are parsed', async () => {
    const wrapper = await mountRegion()
    await wrapper.find('[data-testid="paste-textarea"]').setValue(SAMPLE_CCLI)
    await wrapper.vm.$nextTick()
    const btn = wrapper.find('[data-testid="paste-replace-btn"]')
    expect((btn.element as HTMLButtonElement).disabled).toBe(false)
  })

  it('reports copyright detected in the summary line, with no warning card', async () => {
    const wrapper = await mountRegion()
    await wrapper.find('[data-testid="paste-textarea"]').setValue(SAMPLE_CCLI)
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="paste-summary-line"]').text()).toContain('copyright')
    expect(wrapper.find('[data-testid="paste-copyright-warning"]').exists()).toBe(false)
  })

  it('shows warning when paste has no sections', async () => {
    const wrapper = await mountRegion()
    await wrapper.find('[data-testid="paste-textarea"]').setValue('just some text without section markers')
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('No sections detected')
  })

  // 28-02 Task 3 (R035/D-03): a paste performs ONE order write, to the lyrics
  // document alone — the Song-doc duplicate write is gone.
  it('calls saveLyrics with sections and performanceOrder together, with no song-store write', async () => {
    const wrapper = await mountRegion()
    await wrapper.find('[data-testid="paste-textarea"]').setValue(SAMPLE_CCLI)
    await wrapper.vm.$nextTick()
    await wrapper.find('[data-testid="paste-replace-btn"]').trigger('click')
    await vi.waitFor(() => {
      expect(mockSaveLyrics).toHaveBeenCalled()
    })

    expect(mockSaveLyrics).toHaveBeenCalledTimes(1)
    expect(mockSaveLyrics).toHaveBeenCalledWith('org-1', 'song-1', expect.objectContaining({
      sections: expect.arrayContaining([
        expect.objectContaining({ label: 'Verse 1' }),
        expect.objectContaining({ label: 'Chorus' }),
      ]),
      performanceOrder: expect.arrayContaining(['verse-1', 'chorus']),
    }))
  })

  // D006/D-02: a parse containing a repeated section marker saves one pooled
  // section referenced twice in the order, not two duplicated sections.
  it('pools a repeated section marker into one section with two order entries', async () => {
    const wrapper = await mountRegion()
    await wrapper.find('[data-testid="paste-textarea"]').setValue(SAMPLE_CCLI_REPEATED_CHORUS)
    await wrapper.vm.$nextTick()
    await wrapper.find('[data-testid="paste-replace-btn"]').trigger('click')
    await vi.waitFor(() => {
      expect(mockSaveLyrics).toHaveBeenCalled()
    })

    const [, , data] = mockSaveLyrics.mock.calls[0] as unknown as [string, string, { sections: { id: string }[]; performanceOrder: string[] }]
    const chorusSections = data.sections.filter((s) => s.id === 'chorus')
    expect(chorusSections).toHaveLength(1)
    const chorusOrderEntries = data.performanceOrder.filter((id) => id === 'chorus')
    expect(chorusOrderEntries).toHaveLength(2)
    expect(data.performanceOrder).toEqual(['verse-1', 'chorus', 'verse-2', 'chorus'])
  })

  it('emits saved after successful confirm', async () => {
    const wrapper = await mountRegion()
    await wrapper.find('[data-testid="paste-textarea"]').setValue(SAMPLE_CCLI)
    await wrapper.vm.$nextTick()
    await wrapper.find('[data-testid="paste-replace-btn"]').trigger('click')
    await vi.waitFor(() => {
      expect(wrapper.emitted('saved')).toBeTruthy()
    })
  })

  it('prompts discard on cancel when textarea has content', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const wrapper = await mountRegion()
    await wrapper.find('[data-testid="paste-textarea"]').setValue(SAMPLE_CCLI)
    await wrapper.vm.$nextTick()

    const cancelBtn = wrapper.find('[data-testid="paste-cancel-btn"]')
    await cancelBtn.trigger('click')
    expect(confirmSpy).toHaveBeenCalled()
    expect(wrapper.emitted('close')).toBeFalsy()
    confirmSpy.mockRestore()
  })

  it('emits close on cancel when textarea is empty', async () => {
    const wrapper = await mountRegion()
    const cancelBtn = wrapper.find('[data-testid="paste-cancel-btn"]')
    await cancelBtn.trigger('click')
    expect(wrapper.emitted('close')).toBeTruthy()
  })

  describe('R065 — missing copyright blocks the paste, with an always-available override', () => {
    it('shows the copyright warning and disables replace lyrics when no CCLI number is detected', async () => {
      const wrapper = await mountRegion()
      await wrapper.find('[data-testid="paste-textarea"]').setValue(SAMPLE_CCLI_NO_COPYRIGHT)
      await wrapper.vm.$nextTick()
      const warning = wrapper.find('[data-testid="paste-copyright-warning"]')
      expect(warning.exists()).toBe(true)
      expect(warning.text()).toContain('No copyright information found')
      const btn = wrapper.find('[data-testid="paste-replace-btn"]')
      expect((btn.element as HTMLButtonElement).disabled).toBe(true)
    })

    // P-02: the override checkbox alone unblocks the save — no other field is
    // touched below (rawText, songId, orgId, currentSectionCount all remain
    // exactly as set by mountRegion/setValue above).
    it('unblocks and saves when the override checkbox alone is checked, with no other field touched', async () => {
      const wrapper = await mountRegion()
      await wrapper.find('[data-testid="paste-textarea"]').setValue(SAMPLE_CCLI_NO_COPYRIGHT)
      await wrapper.vm.$nextTick()
      let btn = wrapper.find('[data-testid="paste-replace-btn"]')
      expect((btn.element as HTMLButtonElement).disabled).toBe(true)

      await wrapper.find('[data-testid="paste-copyright-override"]').setValue(true)
      await wrapper.vm.$nextTick()
      btn = wrapper.find('[data-testid="paste-replace-btn"]')
      expect((btn.element as HTMLButtonElement).disabled).toBe(false)

      await btn.trigger('click')
      await vi.waitFor(() => {
        expect(mockSaveLyrics).toHaveBeenCalledTimes(1)
      })
    })

    it('shows the no-sections warning and keeps replace lyrics disabled, with no reachable override for zero sections', async () => {
      const wrapper = await mountRegion()
      await wrapper.find('[data-testid="paste-textarea"]').setValue('just some text without section markers')
      await wrapper.vm.$nextTick()
      expect(wrapper.find('[data-testid="paste-no-sections-warning"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="paste-copyright-warning"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="paste-copyright-override"]').exists()).toBe(false)
      const btn = wrapper.find('[data-testid="paste-replace-btn"]')
      expect((btn.element as HTMLButtonElement).disabled).toBe(true)
    })

    it('shows a save error and keeps the pasted text when saveLyrics rejects', async () => {
      mockSaveLyrics.mockImplementationOnce(() => Promise.reject(new Error('write failed')))
      const wrapper = await mountRegion()
      await wrapper.find('[data-testid="paste-textarea"]').setValue(SAMPLE_CCLI)
      await wrapper.vm.$nextTick()
      await wrapper.find('[data-testid="paste-replace-btn"]').trigger('click')
      await vi.waitFor(() => {
        expect(wrapper.find('[data-testid="paste-save-error"]').exists()).toBe(true)
      })
      expect((wrapper.find('[data-testid="paste-textarea"]').element as HTMLTextAreaElement).value).toBe(SAMPLE_CCLI)
      expect(wrapper.emitted('saved')).toBeFalsy()
    })

    it('reports singular section count in the summary line', async () => {
      const wrapper = await mountRegion()
      await wrapper.find('[data-testid="paste-textarea"]').setValue(SAMPLE_ONE_SECTION)
      await wrapper.vm.$nextTick()
      expect(wrapper.find('[data-testid="paste-summary-line"]').text()).toMatch(/\b1 section\b(?!s)/)
    })
  })

  // R121 — the commit button label is a first-paste vs. replace distinction driven
  // entirely by the already-passed currentSectionCount prop (no new prop).
  describe('R121 — commit button reads "Save" on a brand-new song, "Replace lyrics" otherwise', () => {
    it('reads "Save" when the song has no sections yet (currentSectionCount === 0)', async () => {
      const wrapper = mount(LyricPasteRegion, {
        props: { songId: 'song-1', orgId: 'org-1', currentSectionCount: 0 },
      })
      await wrapper.vm.$nextTick()
      expect(wrapper.find('[data-testid="paste-replace-btn"]').text()).toBe('Save')
    })

    it('reads "Replace lyrics" when the song already has sections (currentSectionCount > 0)', async () => {
      const wrapper = mount(LyricPasteRegion, {
        props: { songId: 'song-1', orgId: 'org-1', currentSectionCount: 3 },
      })
      await wrapper.vm.$nextTick()
      expect(wrapper.find('[data-testid="paste-replace-btn"]').text()).toBe('Replace lyrics')
    })

    it('reads "Saving..." while a save is in flight, even on a brand-new song', async () => {
      let resolveSave: () => void = () => {}
      mockSaveLyrics.mockImplementationOnce(
        () => new Promise<void>((resolve) => { resolveSave = resolve }),
      )
      const wrapper = mount(LyricPasteRegion, {
        props: { songId: 'song-1', orgId: 'org-1', currentSectionCount: 0 },
      })
      await wrapper.find('[data-testid="paste-textarea"]').setValue(SAMPLE_CCLI)
      await wrapper.vm.$nextTick()
      await wrapper.find('[data-testid="paste-replace-btn"]').trigger('click')
      await wrapper.vm.$nextTick()
      expect(wrapper.find('[data-testid="paste-replace-btn"]').text()).toBe('Saving...')
      resolveSave()
    })

    it('does not claim to replace 0 sections in the footer helper on a first paste', async () => {
      const wrapper = mount(LyricPasteRegion, {
        props: { songId: 'song-1', orgId: 'org-1', currentSectionCount: 0 },
      })
      await wrapper.vm.$nextTick()
      expect(wrapper.text()).not.toContain('Replaces the current 0 sections')
    })
  })
})
