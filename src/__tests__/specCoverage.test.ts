// R456/R457 spec coverage check. See ADR-0248 (docs/adr/0248-feature-specs-are-the-source-of-truth-tests-cite-criteria-in-titles.md)
import { afterAll, describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import {
  checkSpecCoverage,
  extractCitations,
  findTestFiles,
  parseSpec,
  runSpecCoverage,
  type Citations,
  type SpecFile,
} from './specCoverage'

const root = process.cwd()

// Fixtures are inline strings. Their IDs never appear in a real it/describe title here, because the
// repo scan reads this file and would treat that as a citation of an undefined ID.

const CONTROL = "it('control AC-FIX-99', () => { run() })"
const sorted = (a: string[]): string[] => [...a].sort()

describe('extractCitations (R457)', () => {
  const counted: { label: string; src: string; expected: string[] }[] = [
    { label: 'plain it', src: "it('a AC-FIX-01', () => { run() })", expected: ['AC-FIX-01'] },
    { label: 'plain test', src: "test('a AC-FIX-01', () => { run() })", expected: ['AC-FIX-01'] },
    {
      label: 'title split over several lines',
      src: "it(\n  'first AC-FIX-02 ' +\n  'second',\n  () => { run() },\n)",
      expected: ['AC-FIX-02'],
    },
    {
      label: 'concatenation with a comment holding another id',
      src: "it('a ' + // AC-FIX-05\n  'b AC-FIX-06', () => { run() })",
      expected: ['AC-FIX-06'],
    },
    {
      label: 'template title with an expression',
      src: 'it(`x ${n} AC-FIX-07`, () => { run() })',
      expected: ['AC-FIX-07'],
    },
    {
      label: 'each with an array',
      src: "it.each([1, 2])('row AC-FIX-08 %s', () => { run() })",
      expected: ['AC-FIX-08'],
    },
    {
      label: 'each as a tagged template',
      src: "it.each`\n  a | b\n  ${1} | ${2}\n`('row AC-FIX-09', () => { run() })",
      expected: ['AC-FIX-09'],
    },
    { label: 'for', src: "it.for([1])('AC-FIX-10', () => { run() })", expected: ['AC-FIX-10'] },
    { label: 'only', src: "it.only('AC-FIX-11', () => { run() })", expected: ['AC-FIX-11'] },
    {
      label: 'concurrent',
      src: "it.concurrent('AC-FIX-12', () => { run() })",
      expected: ['AC-FIX-12'],
    },
    {
      label: 'trailing numeric timeout',
      src: "it('AC-FIX-13', () => { run() }, 30000)",
      expected: ['AC-FIX-13'],
    },
    {
      label: 'timeout options object',
      src: "it('AC-FIX-14', { timeout: 10 }, () => { run() })",
      expected: ['AC-FIX-14'],
    },
    {
      label: 'skip: false options object',
      src: "it('AC-FIX-15', { skip: false }, () => { run() })",
      expected: ['AC-FIX-15'],
    },
    { label: 'function reference body', src: "it('AC-FIX-16', run)", expected: ['AC-FIX-16'] },
    {
      label: 'expression-bodied arrow',
      src: "it('AC-FIX-17', () => run())",
      expected: ['AC-FIX-17'],
    },
    {
      label: 'test.describe alias with a counted test inside',
      src: "test.describe('suite AC-FIX-18', () => { it('case', () => { run() }) })",
      expected: ['AC-FIX-18'],
    },
    {
      label: 'describe title plus a counted test title',
      src: "describe('s AC-FIX-19', () => { it('c AC-FIX-20', () => { run() }) })",
      expected: ['AC-FIX-19', 'AC-FIX-20'],
    },
    {
      label: 'two ids in one title',
      src: "it('both AC-FIX-21 and AC-FIX-22', () => { run() })",
      expected: ['AC-FIX-21', 'AC-FIX-22'],
    },
    {
      label: 'a longer number is its own token',
      src: "it('AC-FIX-011', () => { run() })",
      expected: ['AC-FIX-011'],
    },
    {
      label: 'a mistyped id is still returned so it can be reported',
      src: "it('AC-RH-3', () => { run() })",
      expected: ['AC-RH-3'],
    },
  ]

  it.each(counted)('counts $label', ({ src, expected }) => {
    expect(sorted(extractCitations(src))).toEqual(sorted(expected))
  })

  it('reads a CRLF source the same as its LF twin', () => {
    const lf = "describe('s AC-FIX-30', () => {\n  it(\n    'c ' +\n    'AC-FIX-31',\n    () => { run() },\n  )\n})\n"
    const crlf = lf.replace(/\n/g, '\r\n')
    expect(sorted(extractCitations(lf))).toEqual(['AC-FIX-30', 'AC-FIX-31'])
    expect(sorted(extractCitations(crlf))).toEqual(sorted(extractCitations(lf)))
  })

  // Every row adds one active control, so no row can pass by returning nothing.
  const notCounted: { label: string; src: string }[] = [
    { label: 'an id in a line comment', src: "// it('x AC-FIX-40', () => { run() })" },
    { label: 'an id in a block comment', src: '/* AC-FIX-40 */' },
    { label: 'an id in a plain string holding it text', src: 'const s = "it(\'x AC-FIX-40\', () => { run() })"' },
    {
      label: 'an id only inside a test body',
      src: "it('plain', () => { expect('AC-FIX-40').toBe('x') })",
    },
    { label: 'it.skip', src: "it.skip('AC-FIX-40', () => { run() })" },
    { label: 'it.todo', src: "it.todo('AC-FIX-40')" },
    { label: 'it.fails', src: "it.fails('AC-FIX-40', () => { run() })" },
    { label: 'it.skipIf', src: "it.skipIf(c)('AC-FIX-40', () => { run() })" },
    { label: 'it.runIf', src: "it.runIf(c)('AC-FIX-40', () => { run() })" },
    { label: 'it.skip.each', src: "it.skip.each([1])('AC-FIX-40', () => { run() })" },
    { label: 'xit', src: "xit('AC-FIX-40', () => { run() })" },
    { label: 'xtest', src: "xtest('AC-FIX-40', () => { run() })" },
    {
      label: 'a test under describe.skip',
      src: "describe.skip('s', () => { it('AC-FIX-40', () => { run() }) })",
    },
    {
      label: 'a test under describe.skip.each',
      src: "describe.skip.each([1])('s', () => { it('AC-FIX-40', () => { run() }) })",
    },
    {
      label: 'a test under describe.skipIf',
      src: "describe.skipIf(c)('s', () => { it('AC-FIX-40', () => { run() }) })",
    },
    {
      label: 'a test under describe.runIf',
      src: "describe.runIf(c)('s', () => { it('AC-FIX-40', () => { run() }) })",
    },
    {
      label: 'a test under xdescribe',
      src: "xdescribe('s', () => { it('AC-FIX-40', () => { run() }) })",
    },
    {
      label: 'a test under describe.skip with a variable title',
      src: 'describe.skip(TITLE, () => { it(\'AC-FIX-40\', () => { run() }) })',
    },
    {
      label: 'a test under describe.skipIf with a variable title',
      src: 'describe.skipIf(c)(TITLE, () => { it(\'AC-FIX-40\', () => { run() }) })',
    },
    { label: 'skip: true options', src: "it('AC-FIX-40', { skip: true }, () => { run() })" },
    { label: 'todo: true options', src: "it('AC-FIX-40', { todo: true }, () => { run() })" },
    { label: 'fails: true options', src: "it('AC-FIX-40', { fails: true }, () => { run() })" },
    { label: 'skip: cond options', src: "it('AC-FIX-40', { skip: cond }, () => { run() })" },
    {
      label: 'skip: true options on describe',
      src: "describe('s', { skip: true }, () => { it('AC-FIX-40', () => { run() }) })",
    },
    { label: 'a test with no function', src: "it('AC-FIX-40')" },
    { label: 'a test with undefined as its function', src: "it('AC-FIX-40', undefined)" },
    { label: 'a test with an empty arrow', src: "it('AC-FIX-40', () => {})" },
    { label: 'a test with an empty function', src: "it('AC-FIX-40', function () {})" },
    {
      label: 'a test whose function holds only a comment',
      src: "it('AC-FIX-40', () => { /* nothing here */ })",
    },
    {
      label: 'an id on a describe that holds nothing',
      src: "describe('s AC-FIX-40', () => {})",
    },
    {
      label: 'an id on a describe that holds only a skipped test',
      src: "describe('s AC-FIX-40', () => { it.skip('x', () => { run() }) })",
    },
    {
      label: 'an id on a describe that holds only an empty test',
      src: "describe('s AC-FIX-40', () => { it('x', () => {}) })",
    },
    { label: 'an id split by a template expression', src: 'it(`AC-FIX-${n}`, () => { run() })' },
    { label: 'a regex test call', src: "/x/.test('AC-FIX-40')" },
    { label: 'a test method on another object', src: "obj.test('AC-FIX-40', () => { run() })" },
    {
      label: 'a describe method on another object',
      src: "obj.describe('AC-FIX-40', () => { it('c', () => { run() }) })",
    },
  ]

  it.each(notCounted)('does not count $label', ({ src }) => {
    expect(extractCitations(`${src}\n${CONTROL}`)).toEqual(['AC-FIX-99'])
  })

  it('returns nothing for an empty source and something for a one-citation source', () => {
    expect(extractCitations('')).toEqual([])
    expect(extractCitations("it('AC-FIX-01', () => { run() })")).toEqual(['AC-FIX-01'])
  })
})

interface SpecOpts {
  code?: string
  criteria?: string[]
  retired?: string[]
}

// Builds a well-formed spec; each id becomes a bold top-level list item.
function makeSpec({ code = 'FIX', criteria = [], retired }: SpecOpts): string {
  const lines = ['# Spec: Demo', '', `**Code:** ${code}`, '', '## Acceptance criteria', '']
  for (const id of criteria) lines.push(`- **${id}** - behaviour (R000)`)
  if (retired) {
    lines.push('', '## Retired criteria', '')
    for (const id of retired) lines.push(`- ${id} - gone`)
  }
  return `${lines.join('\n')}\n`
}

// Builds test source that cites each id in a counted test title.
function cite(...ids: string[]): string {
  return ids.map((id) => "it('covers " + id + "', () => { run() })").join('\n')
}

const spec = (name: string, text: string): SpecFile => ({ name, text })
const cites = (file: string, ...ids: string[]): Citations => ({ file, ids })

describe('parseSpec (R456)', () => {
  const FULL = [
    '# Spec: Demo',
    '**Code:** FIX',
    '**Status:** Active',
    '',
    '## Purpose',
    'Prose mentioning AC-ZZZ-01 defines nothing.',
    '',
    '## Acceptance criteria',
    '',
    '- **AC-FIX-01** - first (R000)',
    '- AC-FIX-02 - second',
    '* AC-FIX-03 - third',
    '+ **AC-FIX-04** - fourth',
    '1. AC-FIX-05 - fifth',
    '  - indented sub-bullet AC-FIX-77',
    'continuation line AC-FIX-78',
    '### Detail',
    '',
    '## Retired criteria',
    '',
    '- AC-FIX-06 - gone',
    '',
    '## Tests',
    'Prose AC-FIX-79 again.',
    '',
  ].join('\n')

  it('returns code, criteria and retired ids for a valid spec, the same under CRLF', () => {
    const parsed = parseSpec(FULL, 'a.md')
    expect(parsed).toEqual({
      code: 'FIX',
      criteria: ['AC-FIX-01', 'AC-FIX-02', 'AC-FIX-03', 'AC-FIX-04', 'AC-FIX-05'],
      retired: ['AC-FIX-06'],
      errors: [],
    })
    expect(parseSpec(FULL.replace(/\n/g, '\r\n'), 'a.md')).toEqual(parsed)
  })

  it('ignores ids inside fences and HTML comments', () => {
    const text = [
      '# Spec: Demo',
      '**Code:** FIX',
      '',
      '## Acceptance criteria',
      '- **AC-FIX-01** - real',
      '```',
      '- **AC-FIX-90** - in a backtick fence',
      '```',
      '~~~',
      '- **AC-FIX-91** - in a tilde fence',
      '~~~',
      '<!-- - **AC-FIX-92** - one line comment -->',
      '<!--',
      '- **AC-FIX-93** - multi-line comment',
      '-->',
      '',
    ].join('\n')
    expect(parseSpec(text, 'a.md')).toEqual({
      code: 'FIX',
      criteria: ['AC-FIX-01'],
      retired: [],
      errors: [],
    })
  })

  it('allows gaps in numbering', () => {
    const parsed = parseSpec(makeSpec({ criteria: ['AC-FIX-01', 'AC-FIX-03'] }), 'a.md')
    expect(parsed.errors).toEqual([])
    expect(parsed.criteria).toEqual(['AC-FIX-01', 'AC-FIX-03'])
  })

  it('reads one criterion from a one-criterion spec', () => {
    expect(parseSpec(makeSpec({ criteria: ['AC-FIX-01'] }), 'a.md').criteria).toEqual(['AC-FIX-01'])
  })

  const bad: { label: string; text: string; error: string }[] = [
    {
      label: 'a missing Code line',
      text: '# Spec\n\n## Acceptance criteria\n- **AC-FIX-01** - x\n',
      error: 'a.md: missing or malformed Code line',
    },
    {
      label: 'a lowercase code',
      text: makeSpec({ code: 'rhd', criteria: ['AC-FIX-01'] }),
      error: 'a.md: missing or malformed Code line',
    },
    {
      label: 'a code that is too long',
      text: makeSpec({ code: 'TOOLONGX', criteria: ['AC-FIX-01'] }),
      error: 'a.md: missing or malformed Code line',
    },
    {
      label: 'a Code line after the first heading',
      text: '# Spec\n\n## Acceptance criteria\n**Code:** FIX\n- **AC-FIX-01** - x\n',
      error: 'a.md: missing or malformed Code line',
    },
    {
      label: 'a top-level item with no id',
      text: makeSpec({ criteria: ['AC-FIX-01'] }) + '- Just some words without an id\n',
      error: 'a.md: acceptance criteria item has no AC id: Just some words without an id',
    },
    {
      label: 'a one-digit number',
      text: makeSpec({ criteria: ['AC-FIX-1'] }),
      error: 'a.md: malformed id AC-FIX-1',
    },
    {
      label: 'a lowercase id',
      text: makeSpec({ criteria: ['AC-fix-01'] }),
      error: 'a.md: malformed id AC-fix-01',
    },
    {
      label: 'a four-digit number',
      text: makeSpec({ criteria: ['AC-FIX-0001'] }),
      error: 'a.md: malformed id AC-FIX-0001',
    },
    {
      label: 'a one-letter code in an id',
      text: makeSpec({ criteria: ['AC-F-01'] }),
      error: 'a.md: malformed id AC-F-01',
    },
    {
      label: 'an id with another code',
      text: makeSpec({ criteria: ['AC-FIX-01', 'AC-OTH-01'] }),
      error: 'a.md: AC-OTH-01 does not use the declared code FIX',
    },
    {
      label: 'a duplicate id',
      text: makeSpec({ criteria: ['AC-FIX-01', 'AC-FIX-01'] }),
      error: 'a.md: duplicate AC-FIX-01',
    },
    {
      label: 'an id both active and retired',
      text: makeSpec({ criteria: ['AC-FIX-01'], retired: ['AC-FIX-01'] }),
      error: 'a.md: AC-FIX-01 is both active and retired',
    },
    {
      label: 'no criteria',
      text: '# Spec\n**Code:** FIX\n\n## Acceptance criteria\n\n## Retired criteria\n',
      error: 'a.md: no acceptance criteria',
    },
    { label: 'no heading', text: '# Spec: Demo\n**Code:** FIX\n', error: 'a.md: no acceptance criteria' },
    { label: 'an empty string', text: '', error: 'a.md: no acceptance criteria' },
  ]

  it.each(bad)('reports $label by spec name', ({ text, error }) => {
    expect(parseSpec(text, 'a.md').errors).toContain(error)
  })

  it('reports a problem for an empty string and none for a valid spec, so a stub cannot pass', () => {
    expect(parseSpec('', 'a.md').errors.length).toBeGreaterThan(0)
    expect(parseSpec(makeSpec({ criteria: ['AC-FIX-01'] }), 'a.md').errors).toEqual([])
  })
})

describe('checkSpecCoverage (R456, R457)', () => {
  const A = makeSpec({ criteria: ['AC-FIX-01', 'AC-FIX-02'] })

  it('passes when every criterion is cited and names the one that is not', () => {
    expect(checkSpecCoverage([spec('a.md', A)], [cites('x.test.ts', 'AC-FIX-01', 'AC-FIX-02')])).toEqual([])
    expect(checkSpecCoverage([spec('a.md', A)], [cites('x.test.ts', 'AC-FIX-01')])).toEqual([
      'AC-FIX-02 (a.md) has no test citing it',
    ])
  })

  it('needs no citation for a retired id and reports a test citing one', () => {
    const text = makeSpec({ criteria: ['AC-FIX-01'], retired: ['AC-FIX-03'] })
    expect(checkSpecCoverage([spec('a.md', text)], [cites('x.test.ts', 'AC-FIX-01')])).toEqual([])
    expect(
      checkSpecCoverage([spec('a.md', text)], [cites('x.test.ts', 'AC-FIX-01', 'AC-FIX-03')]),
    ).toEqual(['x.test.ts: cites AC-FIX-03, which is retired'])
  })

  it('reports a test citing an undefined id', () => {
    expect(
      checkSpecCoverage([spec('a.md', A)], [cites('x.test.ts', 'AC-FIX-01', 'AC-FIX-02', 'AC-FIX-09')]),
    ).toEqual(['x.test.ts: cites AC-FIX-09, which is not defined in any spec'])
  })

  it('reports two specs that declare one code, and an id defined in both', () => {
    const errors = checkSpecCoverage(
      [spec('a.md', A), spec('b.md', makeSpec({ criteria: ['AC-FIX-01'] }))],
      [cites('x.test.ts', 'AC-FIX-01', 'AC-FIX-02')],
    )
    expect(errors).toContain('b.md: code FIX is already used by a.md')
    expect(errors).toContain('AC-FIX-01 is defined in both a.md and b.md')
  })

  it('has a defined result for empty input', () => {
    expect(checkSpecCoverage([], [])).toEqual([])
    expect(checkSpecCoverage([], [cites('x.test.ts', 'AC-FIX-01')])).toEqual([
      'x.test.ts: cites AC-FIX-01, which is not defined in any spec',
    ])
  })

  it('treats a longer number as a different id and allows two tests to cite one id', () => {
    const one = makeSpec({ criteria: ['AC-FIX-01'] })
    expect(checkSpecCoverage([spec('a.md', one)], [cites('x.test.ts', 'AC-FIX-011')])).toEqual([
      'AC-FIX-01 (a.md) has no test citing it',
      'x.test.ts: cites AC-FIX-011, which is not defined in any spec',
    ])
    expect(
      checkSpecCoverage(
        [spec('a.md', one)],
        [cites('x.test.ts', 'AC-FIX-01'), cites('y.test.ts', 'AC-FIX-01')],
      ),
    ).toEqual([])
  })

  it('passes a one-criterion spec once it is cited', () => {
    const one = makeSpec({ criteria: ['AC-FIX-01'] })
    expect(checkSpecCoverage([spec('a.md', one)], [])).toEqual(['AC-FIX-01 (a.md) has no test citing it'])
    expect(checkSpecCoverage([spec('a.md', one)], [cites('x.test.ts', 'AC-FIX-01')])).toEqual([])
  })

  it('gives the same list when criteria, specs or citations are reordered', () => {
    const forward = checkSpecCoverage(
      [
        spec('a.md', makeSpec({ criteria: ['AC-FIX-01', 'AC-FIX-02', 'AC-FIX-03'] })),
        spec('b.md', makeSpec({ criteria: ['AC-FIX-01'] })),
      ],
      [cites('x.test.ts', 'AC-FIX-01', 'AC-FIX-99'), cites('y.test.ts', 'AC-FIX-01')],
    )
    const reversed = checkSpecCoverage(
      [
        spec('b.md', makeSpec({ criteria: ['AC-FIX-01'] })),
        spec('a.md', makeSpec({ criteria: ['AC-FIX-03', 'AC-FIX-02', 'AC-FIX-01'] })),
      ],
      [cites('y.test.ts', 'AC-FIX-01'), cites('x.test.ts', 'AC-FIX-99', 'AC-FIX-01')],
    )
    expect(forward.length).toBeGreaterThan(0)
    expect(reversed).toEqual(forward)
    expect(forward).toEqual([...forward].sort())
  })

  it('gives one error for a citation repeated in one file', () => {
    const errors = checkSpecCoverage(
      [spec('a.md', makeSpec({ criteria: ['AC-FIX-01'] }))],
      [cites('x.test.ts', 'AC-FIX-01', 'AC-FIX-09', 'AC-FIX-09')],
    )
    expect(errors).toEqual(['x.test.ts: cites AC-FIX-09, which is not defined in any spec'])
  })
})

const made: string[] = []
afterAll(() => {
  for (const dir of made) rmSync(dir, { recursive: true, force: true })
})

// Builds a temp repo tree from repo-relative paths. Nothing is written inside the real repo.
function makeRepo(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'spec-'))
  made.push(dir)
  for (const [rel, text] of Object.entries(files)) {
    const full = join(dir, rel)
    mkdirSync(dirname(full), { recursive: true })
    writeFileSync(full, text)
  }
  return dir
}

describe('findTestFiles and runSpecCoverage (R457)', () => {
  const FIVE = makeSpec({
    criteria: ['AC-FIX-01', 'AC-FIX-02', 'AC-FIX-03', 'AC-FIX-04', 'AC-FIX-05'],
  })

  it('reads test files in all four locations', () => {
    const files = {
      'docs/specs/demo.md': FIVE,
      'src/__tests__/app.test.ts': cite('AC-FIX-01'),
      'src/rules.test.ts': cite('AC-FIX-02'),
      'src/storage.rules.test.ts': cite('AC-FIX-03'),
      'functions/src/fn.test.ts': cite('AC-FIX-04'),
      'render-service/src/svc.test.ts': cite('AC-FIX-05'),
    }
    expect(runSpecCoverage(makeRepo(files))).toEqual([])
    const { 'render-service/src/svc.test.ts': _dropped, ...fewer } = files
    void _dropped
    expect(runSpecCoverage(makeRepo(fewer))).toEqual(['AC-FIX-05 (demo.md) has no test citing it'])
  }, 30000)

  it('ignores compiled output and node_modules', () => {
    const dir = makeRepo({
      'docs/specs/demo.md': makeSpec({ criteria: ['AC-FIX-01', 'AC-FIX-02', 'AC-FIX-03'] }),
      'src/a.test.ts': cite('AC-FIX-01'),
      'functions/lib/compiled.test.js': cite('AC-FIX-02'),
      'src/node_modules/p/x.test.ts': cite('AC-FIX-03'),
    })
    expect(runSpecCoverage(dir)).toEqual([
      'AC-FIX-02 (demo.md) has no test citing it',
      'AC-FIX-03 (demo.md) has no test citing it',
    ])
    expect(findTestFiles(dir)).toEqual(['src/a.test.ts'])
  }, 30000)

  it('ignores TEMPLATE.md and README.md while still reading a real spec', () => {
    const dir = makeRepo({
      'docs/specs/TEMPLATE.md': makeSpec({ code: 'XXX', criteria: ['AC-XXX-01'] }),
      'docs/specs/README.md': '# Specs\n\nAn index with no criteria.\n',
      'docs/specs/demo.md': makeSpec({ criteria: ['AC-FIX-01', 'AC-FIX-02'] }),
      'src/a.test.ts': cite('AC-FIX-01'),
    })
    expect(runSpecCoverage(dir)).toEqual(['AC-FIX-02 (demo.md) has no test citing it'])
  }, 30000)

  it('does not read nested spec directories', () => {
    const dir = makeRepo({
      'docs/specs/demo.md': makeSpec({ criteria: ['AC-FIX-01', 'AC-FIX-02'] }),
      'docs/specs/nested/x.md': makeSpec({ code: 'OTH', criteria: ['AC-OTH-01'] }),
      'src/a.test.ts': cite('AC-FIX-01'),
    })
    expect(runSpecCoverage(dir)).toEqual(['AC-FIX-02 (demo.md) has no test citing it'])
  }, 30000)

  it('has a defined result when docs/specs or functions/src is missing', () => {
    const noSpecs = makeRepo({ 'src/a.test.ts': "it('plain', () => { run() })" })
    expect(runSpecCoverage(noSpecs)).toEqual([])
    const noFunctions = makeRepo({
      'docs/specs/demo.md': makeSpec({ criteria: ['AC-FIX-01', 'AC-FIX-02'] }),
      'src/a.test.ts': cite('AC-FIX-01'),
    })
    expect(() => runSpecCoverage(noFunctions)).not.toThrow()
    expect(runSpecCoverage(noFunctions)).toEqual(['AC-FIX-02 (demo.md) has no test citing it'])
    expect(findTestFiles(noFunctions)).toEqual(['src/a.test.ts'])
  }, 30000)

  it('names an empty or criterion-less spec', () => {
    const dir = makeRepo({ 'docs/specs/empty.md': '' })
    expect(runSpecCoverage(dir)).toContain('empty.md: no acceptance criteria')
  }, 30000)
})

describe('the real repo (R457)', () => {
  it('finds the test files in every location and none in excluded folders', () => {
    const files = findTestFiles(root)
    for (const f of [
      'src/rules.test.ts',
      'src/storage.rules.test.ts',
      'functions/src/adminEmail.test.ts',
      'render-service/src/render.test.ts',
      'src/__tests__/specCoverage.test.ts',
    ]) {
      expect(files, f).toContain(f)
    }
    expect(files.filter((f) => /(^|\/)node_modules\//.test(f) || f.startsWith('functions/lib/'))).toEqual([])
    expect(files).toEqual([...files].sort())
  }, 30000)

  it('passes: every criterion in docs/specs is cited by a test', () => {
    expect(runSpecCoverage(root)).toEqual([])
  }, 30000)

  it('cites nothing from its own test file', () => {
    const own = readFileSync(resolve(root, 'src/__tests__/specCoverage.test.ts'), 'utf8')
    expect(extractCitations(own, 'specCoverage.test.ts')).toEqual([])
  }, 30000)
})
