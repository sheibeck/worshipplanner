// R456/R457 spec coverage check. See ADR-0248 (docs/adr/0248-feature-specs-are-the-source-of-truth-tests-cite-criteria-in-titles.md)
import { describe, expect, it } from 'vitest'
import { extractCitations } from './specCoverage'

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
