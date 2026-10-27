// R446/R447 brand guard. See ADR-0246 (docs/adr/0246-app-brand-is-worshipbuilder-internal-identifiers-keep-their-names.md)
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()

// Case-sensitive on purpose: the lowercase claudeApi.ts role phrase and the
// worshipplanner.app address never match, so no file allow-list is needed.
const OLD_NAME = /Worship ?Planner/
const WRONG_VARIANT = /Worship[ -]Builder|Worshipbuilder/

function stripComments(src: string): string {
  return src
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/^\s*(?:\/\/|\/\*|\*).*$/gm, '')
}

function walk(dir: string): string[] {
  return readdirSync(resolve(root, dir), { recursive: true, encoding: 'utf8' }).map(
    (p) => `${dir}/${p.replace(/\\/g, '/')}`,
  )
}

function isTestPath(p: string): boolean {
  return /\.(test|spec)\.ts$/.test(p) || /(^|\/)(__tests__|__fixtures__|__mocks__)\//.test(p)
}

const userFacingFiles: string[] = [
  'index.html',
  ...walk('src').filter((p) => /\.(vue|ts)$/.test(p) && !isTestPath(p)),
  ...walk('functions/src').filter((p) => p.endsWith('.ts') && !isTestPath(p)),
]

function read(rel: string): string {
  return readFileSync(resolve(root, rel), 'utf8')
}

describe('brand guard (R446/R447)', () => {
  it('R446/R447: no old app name in user-facing source (comments excluded)', () => {
    const offenders = userFacingFiles.filter((f) => OLD_NAME.test(stripComments(read(f))))
    expect(offenders).toEqual([])
  })

  it('R446/R447: no wrong-brand variants', () => {
    const offenders = userFacingFiles.filter((f) => WRONG_VARIANT.test(stripComments(read(f))))
    expect(offenders).toEqual([])
  })

  const rows: [string, string, number][] = [
    ['index.html', '<title>WorshipBuilder</title>', 1],
    ['src/App.vue', '>WorshipBuilder</p>', 1],
    ['src/components/AppSidebar.vue', '>WorshipBuilder</span>', 1],
    ['src/components/AppShell.vue', '>WorshipBuilder</span>', 1],
    ['src/views/LoginView.vue', '>WorshipBuilder</h1>', 1],
    ['src/views/SelectChurchView.vue', '>WorshipBuilder</h1>', 1],
    ['src/views/VolunteerSignInView.vue', '>WorshipBuilder</h1>', 1],
    ['src/views/VolunteerRequestView.vue', '>WorshipBuilder</h1>', 1],
    ['src/views/VolunteerLinkCompleteView.vue', '>WorshipBuilder</h1>', 1],
    ['src/views/ShareView.vue', 'Shared from WorshipBuilder', 2],
    ['src/views/QuarterShareView.vue', 'Shared from WorshipBuilder', 1],
    ['src/components/ServicePrintLayout.vue', 'Generated from WorshipBuilder', 1],
    ['src/components/RosterPrintLayout.vue', 'Generated from WorshipBuilder', 1],
    ['functions/src/adminEmail.ts', 'Sign in to WorshipBuilder', 4],
    ['functions/src/adminEmail.ts', 'on WorshipBuilder', 3],
    ['functions/src/inviteOnboarding.ts', 'on WorshipBuilder', 4],
    ['functions/src/volunteerLink.ts', 'on WorshipBuilder:', 1],
  ]

  it.each(rows)('R446/R447: %s carries %s x%d', (file, literal, count) => {
    expect(read(file).split(literal).length - 1).toBe(count)
  })

  it('detector self-test: flags template text, ignores comments and lowercase prose', () => {
    const hit = (s: string) => OLD_NAME.test(stripComments(s))
    expect(hit('<h1 class="x">Worship Planner</h1>')).toBe(true)
    expect(hit('  // Worship Planner is the old name')).toBe(false)
    expect(hit(' * Worship Planner is the old name')).toBe(false)
    expect(hit('<!-- Worship Planner -->')).toBe(false)
    expect(hit('The worship planner applies the 1-2-3 paradigm')).toBe(false)
  })
})
