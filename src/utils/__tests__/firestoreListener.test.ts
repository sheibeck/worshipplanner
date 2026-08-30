import { describe, it, expect, vi, afterEach } from 'vitest'
import { isPermissionDenied, ignorePermissionDenied } from '../firestoreListener'

describe('isPermissionDenied', () => {
  it('is true for a FirestoreError-shaped permission-denied error', () => {
    expect(isPermissionDenied({ code: 'permission-denied' })).toBe(true)
  })

  it('is false for a different error code', () => {
    expect(isPermissionDenied({ code: 'unavailable' })).toBe(false)
  })

  it('is false for null', () => {
    expect(isPermissionDenied(null)).toBe(false)
  })

  it('is false for undefined', () => {
    expect(isPermissionDenied(undefined)).toBe(false)
  })

  it('is false for an object with no code field', () => {
    expect(isPermissionDenied({})).toBe(false)
  })
})

describe('ignorePermissionDenied', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('does not throw and does not call console.error for a permission-denied error', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const handler = ignorePermissionDenied('ctx')

    expect(() => handler({ code: 'permission-denied' })).not.toThrow()
    expect(consoleErrorSpy).not.toHaveBeenCalled()
  })

  it('calls console.error once with a message containing the context for any other error code', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const handler = ignorePermissionDenied('ctx')
    const err = { code: 'unavailable' }

    handler(err)

    expect(consoleErrorSpy).toHaveBeenCalledTimes(1)
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('ctx'), err)
  })
})
