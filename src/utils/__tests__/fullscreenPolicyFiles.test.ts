// Phase 98 Plan 01 (R286). Pure-module test for fullscreenPolicyFiles.ts,
// mirroring monitorConfig.test.ts's plain fixture/assertion style. Assertions
// check STRUCTURE + origin presence for the macOS artifact (RESEARCH
// Assumption A1 is LOW confidence — do not pin byte-for-byte nesting).
import { describe, it, expect } from 'vitest'
import {
  buildWindowsRegFile,
  buildMacProfile,
  buildLinuxPolicyJson,
  buildPolicyArtifact,
} from '@/utils/fullscreenPolicyFiles'

const ORIGIN = 'https://example.app'

describe('buildWindowsRegFile', () => {
  it('HKCU: starts with the registry header line and bakes the origin into Chrome + Edge key blocks', () => {
    const reg = buildWindowsRegFile(ORIGIN, 'HKCU')
    expect(reg.startsWith('Windows Registry Editor Version 5.00')).toBe(true)
    expect(reg).toContain('[HKEY_CURRENT_USER\\SOFTWARE\\Policies\\Google\\Chrome\\AutomaticFullscreenAllowedForUrls]')
    expect(reg).toContain('[HKEY_CURRENT_USER\\SOFTWARE\\Policies\\Microsoft\\Edge\\AutomaticFullscreenAllowedForUrls]')
    expect(reg).toContain(`"1"="${ORIGIN}"`)
  })

  it('HKLM: uses HKEY_LOCAL_MACHINE and never HKEY_CURRENT_USER on its key lines', () => {
    const reg = buildWindowsRegFile(ORIGIN, 'HKLM')
    expect(reg).toContain('[HKEY_LOCAL_MACHINE\\SOFTWARE\\Policies\\Google\\Chrome\\AutomaticFullscreenAllowedForUrls]')
    expect(reg).toContain('[HKEY_LOCAL_MACHINE\\SOFTWARE\\Policies\\Microsoft\\Edge\\AutomaticFullscreenAllowedForUrls]')
    expect(reg).not.toContain('HKEY_CURRENT_USER')
    expect(reg).toContain(`"1"="${ORIGIN}"`)
  })

  it('interpolates a different origin verbatim', () => {
    const reg = buildWindowsRegFile('http://localhost:5173', 'HKCU')
    expect(reg).toContain('"1"="http://localhost:5173"')
  })
})

describe('buildMacProfile', () => {
  it('contains the policy key, both browser domains, and the origin inside a <string>', () => {
    const profile = buildMacProfile(ORIGIN, () => 'stub-uuid')
    expect(profile).toContain('AutomaticFullscreenAllowedForUrls')
    expect(profile).toContain('com.google.Chrome')
    expect(profile).toContain('com.microsoft.Edge')
    expect(profile).toContain(`<string>${ORIGIN}</string>`)
  })

  it('generates two DIFFERENT PayloadUUID values via the injected uuid function', () => {
    let calls = 0
    const uuidFn = () => `uuid-${++calls}`
    const profile = buildMacProfile(ORIGIN, uuidFn)
    expect(profile).toContain('uuid-1')
    expect(profile).toContain('uuid-2')
  })

  it('defaults to crypto.randomUUID when no uuidFn is supplied', () => {
    const profile = buildMacProfile(ORIGIN)
    // crypto.randomUUID() yields a standard v4 UUID string; assert the shape
    // roughly rather than an exact value.
    expect(profile).toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)
  })
})

describe('buildLinuxPolicyJson', () => {
  it('parses to exactly { AutomaticFullscreenAllowedForUrls: [origin] }', () => {
    const json = buildLinuxPolicyJson(ORIGIN)
    expect(JSON.parse(json)).toEqual({ AutomaticFullscreenAllowedForUrls: [ORIGIN] })
  })
})

describe('buildPolicyArtifact', () => {
  it('dispatches Windows -> .reg with text/plain, using the given scope', () => {
    const artifact = buildPolicyArtifact('windows', ORIGIN, 'HKLM')
    expect(artifact.filename).toBe('worshipplanner-enable-fullscreen-hklm.reg')
    expect(artifact.mimeType).toBe('text/plain')
    expect(artifact.contents).toContain('HKEY_LOCAL_MACHINE')
  })

  it('defaults Windows scope to HKCU when omitted', () => {
    const artifact = buildPolicyArtifact('windows', ORIGIN)
    expect(artifact.filename).toBe('worshipplanner-enable-fullscreen-hkcu.reg')
  })

  it('dispatches macOS -> .mobileconfig with application/x-apple-aspen-config', () => {
    const artifact = buildPolicyArtifact('macos', ORIGIN)
    expect(artifact.filename).toBe('worshipplanner-enable-fullscreen.mobileconfig')
    expect(artifact.mimeType).toBe('application/x-apple-aspen-config')
    expect(artifact.contents).toContain(ORIGIN)
  })

  it('dispatches Linux -> .json with application/json', () => {
    const artifact = buildPolicyArtifact('linux', ORIGIN)
    expect(artifact.filename).toBe('worshipplanner-enable-fullscreen.json')
    expect(artifact.mimeType).toBe('application/json')
    expect(JSON.parse(artifact.contents)).toEqual({ AutomaticFullscreenAllowedForUrls: [ORIGIN] })
  })

  it('falls back to the Linux JSON artifact for an unknown OS', () => {
    const artifact = buildPolicyArtifact('unknown', ORIGIN)
    expect(artifact.filename).toBe('worshipplanner-enable-fullscreen.json')
    expect(artifact.mimeType).toBe('application/json')
  })
})
