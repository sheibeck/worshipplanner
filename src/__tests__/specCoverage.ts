// R456/R457 spec coverage check. See ADR-0248 (docs/adr/0248-feature-specs-are-the-source-of-truth-tests-cite-criteria-in-titles.md)

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

export function extractCitations(source: string, fileName?: string): string[] {
  void source
  void fileName
  return []
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
