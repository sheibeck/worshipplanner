// R446/R447 brand guard. See ADR-0246 (docs/adr/0246-app-brand-is-worshipbuilder-internal-identifiers-keep-their-names.md)
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()

// Any casing/separator variant of the old name. Documented non-renames are removed by
// exact phrase (and file, where scoped) via ALLOWED before matching, so this stays broad.
const OLD_NAME = /worship[\s_-]?planner/i

const ALLOWED: { file?: string; phrase: string }[] = [
  { file: 'src/utils/claudeApi.ts', phrase: 'The worship planner applies' }, // role phrase, not the brand
  { phrase: 'worshipplanner.app' }, // email/domain, not renamed (ADR-0246)
  { phrase: 'worship-planner-bc515' }, // Firebase project id, not renamed (ADR-0246)
]

function stripAllowed(file: string, src: string): string {
  return ALLOWED.reduce(
    (acc, a) => (a.file === undefined || a.file === file ? acc.split(a.phrase).join('') : acc),
    src,
  )
}

// Removes only real JS/TS comments. Tracks '/", and template-literal state (incl. ${} nesting)
// so a `*`-prefixed line inside a template literal, or `//` inside a URL string, is kept.
// A regex literal containing a quote can desync it; that only affects the rest of that file.
function stripJsComments(src: string): string {
  let out = ''
  const stack: ('b' | 't')[] = [] // open `{` (b) and template `${` (t) frames
  let mode: 'code' | 'tpl' = 'code'
  let quote = ''
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    const n = src[i + 1]
    if (quote) {
      out += c
      if (c === '\\') out += src[++i] ?? ''
      else if (c === quote || c === '\n') quote = ''
    } else if (mode === 'tpl') {
      if (c === '\\') out += c + (src[++i] ?? '')
      else if (c === '`') (out += c), (mode = 'code')
      else if (c === '$' && n === '{') (out += '${'), i++, stack.push('t'), (mode = 'code')
      else out += c
    } else if (c === '/' && n === '*') {
      const end = src.indexOf('*/', i + 2)
      i = end === -1 ? src.length : end + 1
    } else if (c === '/' && n === '/') {
      while (i + 1 < src.length && src[i + 1] !== '\n') i++
    } else if (c === "'" || c === '"') {
      quote = c
      out += c
    } else if (c === '`') {
      mode = 'tpl'
      out += c
    } else {
      if (c === '{') stack.push('b')
      else if (c === '}' && stack.pop() === 't') mode = 'tpl'
      out += c
    }
  }
  return out
}

function stripComments(file: string, src: string): string {
  if (file.endsWith('.ts')) return stripJsComments(src)
  return src
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/(<script\b[^>]*>)([\s\S]*?)(<\/script>)/g, (_, o, body, c) => o + stripJsComments(body) + c)
    .replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style>)/g, (_, o, body, c) => o + body.replace(/\/\*[\s\S]*?\*\//g, '') + c)
}

function hasOldName(file: string, src: string): boolean {
  return OLD_NAME.test(stripAllowed(file, stripComments(file, src)))
}

const WRONG_VARIANT = /Worship[ -]Builder|Worshipbuilder/

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
    const offenders = userFacingFiles.filter((f) => hasOldName(f, read(f)))
    expect(offenders).toEqual([])
  })

  it('R446/R447: no wrong-brand variants', () => {
    const offenders = userFacingFiles.filter((f) => WRONG_VARIANT.test(stripComments(f, read(f))))
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

  it('detector self-test: flags template text, ignores real comments', () => {
    const ts = (s: string) => hasOldName('src/x.ts', s)
    expect(hasOldName('src/x.vue', '<h1 class="x">Worship Planner</h1>')).toBe(true)
    expect(ts('  // Worship Planner is the old name')).toBe(false)
    expect(ts('/**\n * Worship Planner is the old name\n */')).toBe(false)
    expect(hasOldName('src/x.vue', '<!-- Worship Planner -->')).toBe(false)
  })

  it('detector self-test: strips only real comments', () => {
    const ts = (s: string) => hasOldName('src/x.ts', s)
    // stripped: trailing line comment, multi-line block comment with unstarred continuation
    expect(ts('const a = 1 // Worship Planner')).toBe(false)
    expect(ts('/* Worship\n   Planner mentioned here: Worship Planner\n*/ const a = 1')).toBe(false)
    expect(hasOldName('src/x.vue', '<script>\n// Worship Planner\nconst a = 1\n</script>')).toBe(false)
    expect(hasOldName('src/x.vue', '<style>/* Worship Planner */ .a{}</style>')).toBe(false)
    // kept: star-prefixed line in a template literal, text after an inline block comment,
    // `//` inside a URL string, `//` inside a nested template literal
    expect(ts('const m = `\n* Sign in to Worship Planner\n`')).toBe(true)
    expect(ts("/* x */ const label = 'Worship Planner'")).toBe(true)
    expect(ts("const u = 'https://Worship Planner.test'")).toBe(true)
    expect(ts('const m = `a ${b ? `c` : `d`} // Worship Planner`')).toBe(true)
    expect(ts("const m = `${a}`\n// ok\nconst l = 'Worship Planner'")).toBe(true)
    expect(
      hasOldName('src/x.vue', '<template><p>* Worship Planner</p></template><script>const a = 1</script>'),
    ).toBe(true)
  })

  it('detector self-test: catches case and separator variants of the old name', () => {
    for (const v of [
      'Worship planner',
      'WORSHIP PLANNER',
      'Worship-Planner',
      'Worship_Planner',
      'WorshipPlanner',
      'worship planner',
      'Worship\u00a0Planner', // non-breaking space
    ]) {
      expect(hasOldName('src/x.vue', `<p>Welcome to ${v}</p>`), v).toBe(true)
    }
  })

  it('detector self-test: allow-list is narrow (exact phrase, scoped file)', () => {
    const phrase = 'The worship planner applies the 1-2-3 paradigm'
    expect(hasOldName('src/utils/claudeApi.ts', phrase)).toBe(false)
    expect(hasOldName('src/views/Other.vue', phrase)).toBe(true)
    expect(hasOldName('src/utils/claudeApi.ts', 'Welcome to the worship planner app')).toBe(true)
    expect(hasOldName('functions/src/x.ts', 'from: "hello@worshipplanner.app"')).toBe(false)
    expect(hasOldName('functions/src/x.ts', 'https://worship-planner-bc515.web.app')).toBe(false)
    expect(hasOldName('functions/src/x.ts', 'Sign in to worshipplanner')).toBe(true)
  })
})
