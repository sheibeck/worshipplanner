// R456/R457 spec coverage check. See ADR-0248 (docs/adr/0248-feature-specs-are-the-source-of-truth-tests-cite-criteria-in-titles.md)

import ts from 'typescript'

export interface ParsedSpec {
  code: string | null
  criteria: string[]
  retired: string[]
  errors: string[]
}
export interface SpecFile {
  name: string
  text: string
}
export interface Citations {
  file: string
  ids: string[]
}

const ID_ANY = /\bAC-[A-Z0-9]+-\d+\b/g
const NOT_RUN = new Set(['skip', 'todo', 'skipIf', 'runIf', 'fails'])
const OPTION_OFF = new Set(['skip', 'todo', 'fails'])

// Flattens a call head such as it.skip.each([..]) or it.skipIf(c) into its base name and modifiers.
function callee(expr: ts.Expression): { base: string; mods: string[] } | null {
  const mods: string[] = []
  let e: ts.Expression = expr
  for (;;) {
    if (ts.isParenthesizedExpression(e)) e = e.expression
    else if (ts.isCallExpression(e)) e = e.expression
    else if (ts.isTaggedTemplateExpression(e)) e = e.tag
    else if (ts.isPropertyAccessExpression(e)) {
      mods.unshift(e.name.text)
      e = e.expression
    } else if (ts.isIdentifier(e)) return { base: e.text, mods }
    else return null
  }
}

// String pieces only: comments are trivia and never visited. Joining with a space keeps an id from
// matching across a template expression.
function titleText(arg: ts.Expression): string {
  let out = ''
  const visit = (n: ts.Node): void => {
    if (
      ts.isStringLiteral(n) ||
      ts.isNoSubstitutionTemplateLiteral(n) ||
      ts.isTemplateHead(n) ||
      ts.isTemplateMiddle(n) ||
      ts.isTemplateTail(n)
    )
      out += n.text + ' '
    else ts.forEachChild(n, visit)
  }
  visit(arg)
  return out
}

function propName(p: ts.ObjectLiteralElementLike): string | null {
  if (ts.isShorthandPropertyAssignment(p)) return p.name.text
  if (!ts.isPropertyAssignment(p)) return null
  const n = p.name
  return ts.isIdentifier(n) || ts.isStringLiteral(n) ? n.text : null
}

// An options object switches a test or suite off with skip, todo or fails, unless the value is literally false.
function optionsOff(args: readonly ts.Expression[]): boolean {
  for (const a of args) {
    if (!ts.isObjectLiteralExpression(a)) continue
    for (const p of a.properties) {
      const name = propName(p)
      if (name === null || !OPTION_OFF.has(name)) continue
      if (ts.isPropertyAssignment(p) && p.initializer.kind === ts.SyntaxKind.FalseKeyword) continue
      return true
    }
  }
  return false
}

// A case runs only with a body: the first argument after the title that is not options or a timeout.
function hasRunnableBody(args: readonly ts.Expression[]): boolean {
  const body = args.slice(1).find((a) => !ts.isObjectLiteralExpression(a) && !ts.isNumericLiteral(a))
  if (body === undefined) return false
  if (ts.isIdentifier(body) && body.text === 'undefined') return false
  if ((ts.isArrowFunction(body) || ts.isFunctionExpression(body)) && ts.isBlock(body.body)) {
    return body.body.statements.length > 0
  }
  return true
}

function isLiteralTitle(t: ts.Expression | undefined): t is ts.Expression {
  return (
    t !== undefined &&
    (ts.isStringLiteralLike(t) || ts.isTemplateExpression(t) || ts.isBinaryExpression(t))
  )
}

export function extractCitations(source: string, fileName = 'x.test.ts'): string[] {
  const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.ES2022, false)
  const ids: string[] = []
  // Returns the number of counted cases under node. A suite's title ids count only when that is above zero.
  const walk = (node: ts.Node, skipped: boolean): number => {
    if (ts.isCallExpression(node)) {
      const c = callee(node.expression)
      if (c) {
        const x = /^x(it|test|describe)$/.exec(c.base)
        const base = x?.[1] ?? c.base
        const caseBase = base === 'it' || base === 'test'
        const isSuite =
          base === 'describe' ||
          base === 'suite' ||
          (caseBase && (c.mods.includes('describe') || c.mods.includes('suite')))
        const isCase = !isSuite && caseBase
        if (isSuite || isCase) {
          const args = node.arguments
          const t = args[0]
          const off =
            skipped || x !== null || c.mods.some((m) => NOT_RUN.has(m)) || optionsOff(args.slice(1))
          const found = isLiteralTitle(t) ? [...titleText(t).matchAll(ID_ANY)].map((m) => m[0]) : []
          if (isCase) {
            const counted = !off && hasRunnableBody(args)
            if (counted) ids.push(...found)
            return counted ? 1 : 0
          }
          let active = 0
          for (const a of args.slice(1)) active += walk(a, off)
          if (!off && active > 0) ids.push(...found)
          return active
        }
      }
    }
    let n = 0
    ts.forEachChild(node, (ch) => {
      n += walk(ch, skipped)
    })
    return n
  }
  walk(sf, false)
  return ids
}

export function parseSpec(markdown: string, name: string): ParsedSpec {
  void markdown
  void name
  return { code: null, criteria: [], retired: [], errors: [] }
}

export function checkSpecCoverage(specs: SpecFile[], citations: Citations[]): string[] {
  void specs
  void citations
  return []
}

export function findTestFiles(root: string): string[] {
  void root
  return []
}

export function runSpecCoverage(root: string): string[] {
  void root
  return []
}
