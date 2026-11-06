// R456/R457 spec coverage check. See ADR-0248 (docs/adr/0248-feature-specs-are-the-source-of-truth-tests-cite-criteria-in-titles.md)

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
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

const STRICT_ID = /^AC-([A-Z]{2,6})-(\d{2,3})$/
const ID_HEAD = /^(?:\*\*)?(AC-[A-Za-z0-9-]*)/
const LIST_ITEM = /^(?:[-*+]|\d+[.)])\s+(.*)$/
const CODE_LINE = /^\*\*Code:\*\*\s*(\S+)\s*$/
const CODE_FORMAT = /^[A-Z]{2,6}$/
const H2 = /^##(?!#)\s+(.*)$/
const FENCE = /^ {0,3}(`{3,}|~{3,})/

// Line-based parse. Never throws: every problem lands in errors, each naming the spec.
export function parseSpec(markdown: string, name: string): ParsedSpec {
  const errors: string[] = []
  const criteria: string[] = []
  const retired: string[] = []
  let code: string | null = null
  let codeSeen = false
  let section: 'head' | 'ac' | 'ret' | 'other' = 'head'
  let acItems = 0
  let fence: string | null = null

  // Comments are blanked but keep their newlines, so line structure survives.
  const cleaned = markdown.replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\r\n]/g, ''))
  for (const line of cleaned.split(/\r?\n/)) {
    const f = FENCE.exec(line)
    if (fence !== null) {
      if (f && f[1]?.[0] === fence[0] && line.trim() === f[1]) fence = null
      continue
    }
    if (f) {
      fence = f[1] ?? null
      continue
    }
    const h = H2.exec(line)
    if (h) {
      const title = (h[1] ?? '').trim().toLowerCase()
      section = title === 'acceptance criteria' ? 'ac' : title === 'retired criteria' ? 'ret' : 'other'
      continue
    }
    if (section === 'head') {
      const m = CODE_LINE.exec(line)
      if (m && !codeSeen) {
        codeSeen = true
        if (CODE_FORMAT.test(m[1] ?? '')) code = m[1] ?? null
      }
      continue
    }
    if (section !== 'ac' && section !== 'ret') continue
    const item = LIST_ITEM.exec(line)
    if (!item) continue
    const text = item[1] ?? ''
    if (section === 'ac') acItems++
    const head = ID_HEAD.exec(text)
    if (!head) {
      if (section === 'ac') {
        errors.push(`${name}: acceptance criteria item has no AC id: ${text.slice(0, 40)}`)
      }
      continue
    }
    const id = head[1] ?? ''
    const strict = STRICT_ID.exec(id)
    if (!strict) {
      errors.push(`${name}: malformed id ${id}`)
      continue
    }
    if (code !== null && strict[1] !== code) {
      errors.push(`${name}: ${id} does not use the declared code ${code}`)
      continue
    }
    const list = section === 'ac' ? criteria : retired
    if (list.includes(id)) errors.push(`${name}: duplicate ${id}`)
    else list.push(id)
  }

  if (code === null) errors.push(`${name}: missing or malformed Code line`)
  if (acItems === 0) errors.push(`${name}: no acceptance criteria`)
  for (const id of criteria) {
    if (retired.includes(id)) errors.push(`${name}: ${id} is both active and retired`)
  }
  return { code, criteria, retired, errors }
}

// Cross-spec and citation rules. Output is sorted and de-duplicated, so input order never matters.
export function checkSpecCoverage(specs: SpecFile[], citations: Citations[]): string[] {
  const errors: string[] = []
  const parsed = [...specs]
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    .map((s) => ({ name: s.name, spec: parseSpec(s.text, s.name) }))

  const codeOwner = new Map<string, string>()
  const definers = new Map<string, string[]>()
  const retired = new Set<string>()
  for (const { name, spec } of parsed) {
    errors.push(...spec.errors)
    if (spec.code !== null) {
      const owner = codeOwner.get(spec.code)
      if (owner === undefined) codeOwner.set(spec.code, name)
      else errors.push(`${name}: code ${spec.code} is already used by ${owner}`)
    }
    for (const id of new Set(spec.criteria)) definers.set(id, [...(definers.get(id) ?? []), name])
    for (const id of spec.retired) retired.add(id)
  }
  for (const [id, names] of definers) {
    for (let i = 0; i < names.length; i++) {
      for (let j = i + 1; j < names.length; j++) {
        errors.push(`${id} is defined in both ${names[i]} and ${names[j]}`)
      }
    }
  }

  const cited = new Set<string>()
  for (const { file, ids } of citations) {
    for (const id of ids) {
      cited.add(id)
      if (definers.has(id)) continue
      if (retired.has(id)) errors.push(`${file}: cites ${id}, which is retired`)
      else errors.push(`${file}: cites ${id}, which is not defined in any spec`)
    }
  }
  for (const { name, spec } of parsed) {
    for (const id of spec.criteria) {
      if (!cited.has(id)) errors.push(`${id} (${name}) has no test citing it`)
    }
  }
  return [...new Set(errors)].sort()
}

const TEST_ROOTS = ['src', 'functions/src', 'render-service/src']

// Walks the working tree, not git: new test files are untracked during the window this check exists for.
export function findTestFiles(root: string): string[] {
  const found: string[] = []
  for (const dir of TEST_ROOTS) {
    const abs = resolve(root, dir)
    if (!existsSync(abs)) continue
    for (const p of readdirSync(abs, { recursive: true, encoding: 'utf8' })) {
      const rel = `${dir}/${p.replace(/\\/g, '/')}`
      if (!/\.(test|spec)\.[cm]?[jt]sx?$/.test(rel)) continue
      if (rel.split('/').includes('node_modules')) continue
      found.push(rel)
    }
  }
  return found.sort()
}

export function runSpecCoverage(root: string): string[] {
  const specDir = resolve(root, 'docs/specs')
  const specs: SpecFile[] = []
  if (existsSync(specDir)) {
    const names = readdirSync(specDir, { withFileTypes: true })
      .filter((e) => e.isFile() && e.name.endsWith('.md'))
      .map((e) => e.name)
      .filter((n) => n !== 'TEMPLATE.md' && n !== 'README.md')
      .sort()
    for (const n of names) specs.push({ name: n, text: readFileSync(resolve(specDir, n), 'utf8') })
  }
  const citations: Citations[] = []
  for (const file of findTestFiles(root)) {
    const text = readFileSync(resolve(root, file), 'utf8')
    if (!/AC-[A-Z0-9]+-\d/.test(text)) continue
    citations.push({ file, ids: extractCitations(text, file) })
  }
  return checkSpecCoverage(specs, citations)
}
