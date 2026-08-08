import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchNltPassageText, stripNltHtml } from '@/utils/nltApi'
import { splitPassage } from '@/utils/scriptureSplitter'
import type { ScriptureRef } from '@/types/service'

vi.mock('@/utils/appAuth', () => ({
  getAppAuthHeaders: vi.fn().mockResolvedValue({ 'X-App-Auth': 'test-token' }),
}))

// Real, redacted NLT API response shapes fetched live against the owner's
// key during phase research (45-RESEARCH.md § NLT API — Verified Real
// Response Shape). Fixtures below reproduce those exact element shapes
// (verse_export/vn, .tn/.a-tn footnote nesting, .chapter-number/.subhead
// headings, .psa-title superscription, .red/.sc styling wrappers) — do not
// invent HTML shapes not grounded in that research.

const SINGLE_VERSE_HTML = `<!DOCTYPE html><html lang="en-US">
<head><title>NLT API</title>
<link rel="stylesheet" href="https://api.nlt.to/content/nlt-api-css?vers=1.04"/>
</head>
<body>
<div id="bibletext" class=" NLT NLT BibleText section"><section><h2 class="bk_ch_vs_header">John 3:16, NLT</h2><verse_export orig="john_3_16" bk="john" ch="3" vn="16">
<p class="body"><span class="vn">16</span><span class="red">&#8220;For this is how God loved the world: He gave<a class="a-tn">*</a><span class="tn"><span class="tn-ref">3:16</span> Or <em>For God loved the world so much that he gave.</em></span> his one and only Son, so that everyone who believes in him will not perish but have eternal life.</span> </verse_export></section></div></body></html>`

const MULTI_VERSE_HTML = `<!DOCTYPE html><html lang="en-US">
<head><title>NLT API</title></head>
<body>
<div id="bibletext" class=" NLT NLT BibleText section"><section><h2 class="bk_ch_vs_header">John 3:16-18, NLT</h2><verse_export orig="john_3_16" bk="john" ch="3" vn="16">
<p class="body"><span class="vn">16</span><span class="red">&#8220;For this is how God loved the world: He gave his one and only Son, so that everyone who believes in him will not perish but have eternal life.</span></p>
</verse_export><verse_export orig="john_3_17" bk="john" ch="3" vn="17">
<p class="body"><span class="vn">17</span><span class="red">God sent his Son into the world not to judge the world, but to save the world through him.</span></p>
</verse_export><verse_export orig="john_3_18" bk="john" ch="3" vn="18">
<p class="body"><span class="vn">18</span><span class="red">There is no judgment against anyone who believes in him. But anyone who does not believe in him has already been judged for not believing in God&#8217;s one and only Son.&#8221;</span></p>
</verse_export></section></div></body></html>`

// Confirms nested chapter/section headings are stripped, AND confirms
// poetry-formatted verses can carry multiple <p> children inside one
// <verse_export> that must collapse into a single spaced line (verse 3).
const BEATITUDES_HTML = `<!DOCTYPE html><html lang="en-US">
<head><title>NLT API</title></head>
<body>
<div id="bibletext" class=" NLT NLT BibleText section"><section><verse_export orig="matt_5_1" bk="matt" ch="5" vn="1">
<h2 class="chapter-number"><span class="cw">Matthew</span> <span class="cw_ch">5</span></h2>
<h3 class="subhead">The Sermon on the Mount</h3>
<p class="body-ch-hd"><span class="vn">1</span>One day as he saw the crowds gathering, he went up the mountainside and sat down. His disciples gathered around him,</p>
</verse_export><verse_export orig="matt_5_2" bk="matt" ch="5" vn="2">
<p class="body"><span class="vn">2</span>and he began to teach them.</p>
</verse_export><verse_export orig="matt_5_3" bk="matt" ch="5" vn="3">
<h3 class="subhead">The Beatitudes</h3>
<p class="poet1-vn-hd"><span class="vn">3</span><span class="red">&#8220;God blesses those who are poor and realize their need for him,</span></p>
<p class="poet2"><span class="red">for the Kingdom of Heaven is theirs.</span></p>
</verse_export></section></div></body></html>`

// Confirms the psalm superscription (.psa-title, living INSIDE verse 1's
// <verse_export>, ahead of the actual verse text) is stripped alongside
// headings (Assumption A1), and that .sc (small-caps) contents are kept.
const PSALM_23_HTML = `<!DOCTYPE html><html lang="en-US">
<head><title>NLT API</title></head>
<body>
<div id="bibletext" class=" NLT NLT BibleText section"><section><verse_export orig="psal_23_1" bk="psal" ch="23" vn="1">
<h3 class="chapter-number"><span class="cw">Psalm</span> <span class="cw_ch">23</span></h3>
<h4 class="subhead">The <span class="subhead-sc">Lord</span> Is My Shepherd</h4>
<p class="psa-title">A psalm of David.</p>
<p class="poet1-vn-sp"><span class="vn">1</span>The <span class="sc">Lord</span> is my shepherd;</p>
<p class="poet2">I have all that I need.</p>
</verse_export><verse_export orig="psal_23_2" bk="psal" ch="23" vn="2">
<p class="poet1">He lets me rest in green meadows;</p>
<p class="poet2">he leads me beside peaceful streams.</p>
</verse_export></section></div></body></html>`

const JOHN_3_16_REF: ScriptureRef = { book: 'John', chapter: 3, verseStart: 16, verseEnd: 16 }
const JOHN_3_16_18_REF: ScriptureRef = { book: 'John', chapter: 3, verseStart: 16, verseEnd: 18 }

describe('stripNltHtml', () => {
  it('strips footnote marker (.a-tn) AND footnote body (.tn) while keeping red-letter text, single verse', () => {
    const result = stripNltHtml(SINGLE_VERSE_HTML)
    expect(result).toBe(
      '[16] “For this is how God loved the world: He gave his one and only Son, so that everyone who believes in him will not perish but have eternal life.',
    )
    expect(result).not.toContain('*')
    expect(result).not.toContain('Or ')
    expect(result).not.toContain('For God loved the world so much')
  })

  it('reads the verse number from each verse_export vn ATTRIBUTE (not the .vn span text) across a multi-verse range', () => {
    const result = stripNltHtml(MULTI_VERSE_HTML)
    expect(result).toContain('[16] ')
    expect(result).toContain('[17] ')
    expect(result).toContain('[18] ')
    // The .vn span's own digit text must never leak as an unspaced
    // duplicate directly before the verse text (e.g. "[16] 16For...").
    expect(result).not.toMatch(/\[\d+\]\s*\d/)
  })

  it('strips .chapter-number and .subhead headings; collapses multi-<p> poetry verses to a single spaced line per verse', () => {
    const result = stripNltHtml(BEATITUDES_HTML)
    expect(result).not.toContain('Matthew')
    expect(result).not.toContain('Sermon on the Mount')
    expect(result).not.toContain('The Beatitudes')
    expect(result).toBe(
      '[1] One day as he saw the crowds gathering, he went up the mountainside and sat down. His disciples gathered around him, ' +
        '[2] and he began to teach them. ' +
        '[3] “God blesses those who are poor and realize their need for him, for the Kingdom of Heaven is theirs.',
    )
  })

  it('strips the .psa-title superscription alongside headings (Assumption A1); keeps .sc small-caps contents', () => {
    const result = stripNltHtml(PSALM_23_HTML)
    expect(result).not.toContain('A psalm of David.')
    expect(result).not.toContain('Psalm')
    expect(result).toBe(
      '[1] The Lord is my shepherd; I have all that I need. ' +
        '[2] He lets me rest in green meadows; he leads me beside peaceful streams.',
    )
  })

  it('throws when the response has no #bibletext root (unexpected shape)', () => {
    expect(() => stripNltHtml('<html><body>not nlt</body></html>')).toThrow(
      'Unexpected NLT response shape',
    )
  })
})

describe('fetchNltPassageText', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  it('fetches through the /api/nlt proxy and returns the stripped [N] bracket text', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(SINGLE_VERSE_HTML),
      }),
    )

    const result = await fetchNltPassageText('John 3:16')

    expect(result).toContain('[16] ')
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringMatching(/^\/api\/nlt\/api\/passages\?/),
      expect.objectContaining({ headers: { 'X-App-Auth': 'test-token' } }),
    )
    const calledUrl = vi.mocked(fetch).mock.calls[0]![0] as string
    expect(calledUrl).toContain('ref=John+3%3A16')
    expect(calledUrl).toContain('version=NLT')
  })

  it('throws Failed to fetch passage on a non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, text: () => Promise.resolve('') }))

    await expect(fetchNltPassageText('John 3:16')).rejects.toThrow('Failed to fetch passage')
  })

  it('Pitfall 5: throws Failed to fetch passage on an HTTP-200 EMPTY body -- response.ok alone is not sufficient', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve('   \n  ') }),
    )

    await expect(fetchNltPassageText('Nonexistent 99:99')).rejects.toThrow('Failed to fetch passage')
  })

  it('WR-01: throws Failed to fetch passage when #bibletext is present but non-empty raw HTML strips to an empty string (zero verse_export children)', async () => {
    const NO_VERSES_HTML =
      '<!DOCTYPE html><html><body><div id="bibletext" class=" NLT NLT BibleText section"><section></section></div></body></html>'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve(NO_VERSES_HTML) }))

    await expect(fetchNltPassageText('John 3:16')).rejects.toThrow('Failed to fetch passage')
  })

  it('IN-01: rewraps an unexpected-shape response (no #bibletext root) into the uniform Failed to fetch passage contract', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve('<html><body>not nlt</body></html>') }),
    )

    await expect(fetchNltPassageText('John 3:16')).rejects.toThrow('Failed to fetch passage')
  })

  it('Pitfall 1 contract survival: splitPassage() over the client output yields per-verse granularity (parseVerses finds the [N] boundaries)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve(MULTI_VERSE_HTML) }))

    const text = await fetchNltPassageText('John 3:16-18')
    const slides = splitPassage(text, JOHN_3_16_18_REF)

    // The three verses exceed the word-count threshold combined, so
    // splitPassage divides at VERSE boundaries -- proof the [N] bracket
    // contract survived (a broken contract falls through to sentence
    // splitting instead, which cannot produce verse-numbered ranges at
    // all). Total verse coverage across every slide's range is 16-18,
    // never a single ''-range fallback slide.
    expect(slides.length).toBeGreaterThan(1)
    expect(slides.every((s) => /^v\.|^vv\./.test(s.verseRange))).toBe(true)
    expect(slides[0]!.verseRange).toBe('vv. 16-17')
    expect(slides[slides.length - 1]!.verseRange).toBe('v. 18')
  })

  it('single-verse fetch survives splitPassage with the correct verse range', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve(SINGLE_VERSE_HTML) }))

    const text = await fetchNltPassageText('John 3:16')
    const slides = splitPassage(text, JOHN_3_16_REF)

    expect(slides).toHaveLength(1)
    expect(slides[0]!.verseRange).toBe('v. 16')
  })
})
