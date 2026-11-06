// See ADR-0249 (docs/adr/0249-new-services-start-with-a-default-rehearsal.md)
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()
const read = (p: string) => readFileSync(resolve(root, p), 'utf8')

describe('ADR-0249 supersedes the reversed parts of ADR-0245', () => {
  it('AC-RHD-55: ADR-0249 is Accepted and supersedes ADR-0245; ADR-0245 and the index point to it', () => {
    const adr49 = read('docs/adr/0249-new-services-start-with-a-default-rehearsal.md')
    expect(adr49).toMatch(/## Status\s+Accepted/)
    expect(adr49).toMatch(/supersedes[^\n]*ADR-0245/i)

    const adr45 = read('docs/adr/0245-rehearsals-are-always-dated-defaults-prefill-the-add-form.md')
    const status45 = adr45.split('\n').find((l) => /^Accepted/.test(l)) ?? ''
    expect(status45).toContain('superseded by ADR-0249')

    const index = read('docs/adr/README.md')
    const rows = index.split('\n').filter((l) => l.startsWith('|'))
    expect(rows.some((l) => l.includes('| ADR-0249 |'))).toBe(true)
    expect(rows.find((l) => l.includes('| ADR-0245 |'))).toContain('ADR-0249')
  })
})
