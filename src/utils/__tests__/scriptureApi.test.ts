import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/utils/esvApi', () => ({
  fetchPassageText: vi.fn(() => Promise.resolve('Mocked ESV passage text')),
}))

vi.mock('@/utils/nltApi', () => ({
  fetchNltPassageText: vi.fn(() => Promise.resolve('Mocked NLT passage text')),
}))

// Getter-mock precedent: src/components/__tests__/ScriptureInput.test.ts:130.
// Flippable so both the enabled and disabled branches can be exercised in the
// same file without re-mocking per test.
let mockBibleApiEnabled = true
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    get isBibleApiEnabled() {
      return mockBibleApiEnabled
    },
  }),
}))

beforeEach(() => {
  vi.clearAllMocks()
  mockBibleApiEnabled = true
})

describe('scriptureApi.fetchScriptureText', () => {
  it('enabled + ESV: dispatches to esvApi, not nltApi, and returns { status: "ok", text }', async () => {
    const { fetchScriptureText } = await import('@/utils/scriptureApi')
    const { fetchPassageText } = await import('@/utils/esvApi')
    const { fetchNltPassageText } = await import('@/utils/nltApi')

    const result = await fetchScriptureText('John 3:16', 'ESV')

    expect(fetchPassageText).toHaveBeenCalledWith('John 3:16')
    expect(fetchNltPassageText).not.toHaveBeenCalled()
    expect(result).toEqual({ status: 'ok', text: 'Mocked ESV passage text' })
  })

  it('enabled + NLT: dispatches to nltApi, not esvApi, and returns { status: "ok", text }', async () => {
    const { fetchScriptureText } = await import('@/utils/scriptureApi')
    const { fetchPassageText } = await import('@/utils/esvApi')
    const { fetchNltPassageText } = await import('@/utils/nltApi')

    const result = await fetchScriptureText('John 3:16', 'NLT')

    expect(fetchNltPassageText).toHaveBeenCalledWith('John 3:16')
    expect(fetchPassageText).not.toHaveBeenCalled()
    expect(result).toEqual({ status: 'ok', text: 'Mocked NLT passage text' })
  })

  it('disabled: returns { status: "disabled" } and invokes NEITHER underlying fetch fn (R297 core assertion)', async () => {
    mockBibleApiEnabled = false
    const { fetchScriptureText } = await import('@/utils/scriptureApi')
    const { fetchPassageText } = await import('@/utils/esvApi')
    const { fetchNltPassageText } = await import('@/utils/nltApi')

    const result = await fetchScriptureText('John 3:16', 'ESV')

    expect(result).toEqual({ status: 'disabled' })
    expect(fetchPassageText).not.toHaveBeenCalled()
    expect(fetchNltPassageText).not.toHaveBeenCalled()
  })

  it('disabled (NLT version requested): still returns "disabled" without invoking nltApi', async () => {
    mockBibleApiEnabled = false
    const { fetchScriptureText } = await import('@/utils/scriptureApi')
    const { fetchPassageText } = await import('@/utils/esvApi')
    const { fetchNltPassageText } = await import('@/utils/nltApi')

    const result = await fetchScriptureText('John 3:16', 'NLT')

    expect(result).toEqual({ status: 'disabled' })
    expect(fetchPassageText).not.toHaveBeenCalled()
    expect(fetchNltPassageText).not.toHaveBeenCalled()
  })

  it('enabled + ESV fetch throws: returns { status: "error" }, never re-throws', async () => {
    const { fetchScriptureText } = await import('@/utils/scriptureApi')
    const { fetchPassageText } = await import('@/utils/esvApi')
    vi.mocked(fetchPassageText).mockRejectedValueOnce(new Error('boom'))

    const result = await fetchScriptureText('John 3:16', 'ESV')

    expect(result).toEqual({ status: 'error' })
  })

  it('enabled + NLT fetch throws: returns { status: "error" }, never re-throws', async () => {
    const { fetchScriptureText } = await import('@/utils/scriptureApi')
    const { fetchNltPassageText } = await import('@/utils/nltApi')
    vi.mocked(fetchNltPassageText).mockRejectedValueOnce(new Error('boom'))

    const result = await fetchScriptureText('John 3:16', 'NLT')

    expect(result).toEqual({ status: 'error' })
  })
})
