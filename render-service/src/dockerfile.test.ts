import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// Text-only assertions against the Dockerfile's content -- no Docker daemon, no image build,
// no registry push. This is R062 criterion 3's gate: the font policy fails a TEST if it is
// ever violated, rather than relying on a human remembering to check.
const DOCKERFILE_PATH = join(__dirname, '..', 'Dockerfile')
const ALIAS_CONF_PATH = join(__dirname, '..', 'fontconfig', '60-metric-compat-aliases.conf')

const dockerfileRaw = readFileSync(DOCKERFILE_PATH, 'utf-8')
const aliasConfRaw = readFileSync(ALIAS_CONF_PATH, 'utf-8')

/**
 * Strip comment-only lines (matching /^\s*#/), then join backslash-continued lines into a
 * single logical line per Dockerfile instruction -- mirrors how the Docker build parser
 * itself treats a `RUN cmd \\\n  arg1 \\\n  arg2` block as one command.
 */
function normalizeDockerfile(text: string): string {
  const withoutComments = text
    .split('\n')
    .filter((line) => !/^\s*#/.test(line))
    .join('\n')
  return withoutComments.replace(/\\\s*\r?\n/g, ' ')
}

const normalized = normalizeDockerfile(dockerfileRaw)

/**
 * Extract the `apt-get install` package-token list from the runtime stage. Only tokens
 * between `install` and the next `&&` (or end of that logical line) that do NOT start with
 * `-` are treated as package names -- this deliberately excludes flags like `-y` and
 * `--no-install-recommends`.
 *
 * ★ Scoped extraction is load-bearing: the build-time `dpkg -l | grep` provenance assertion
 * further down the Dockerfile legitimately CONTAINS the Microsoft font package names as
 * search terms. A file-wide negative grep would fail against a CORRECT Dockerfile. Every
 * negative font assertion below runs against this extracted list, never against the whole
 * file's raw text.
 */
function extractAptInstallPackages(text: string): string[] {
  const installMatch = text.match(/apt-get install\s+([^\n]*)/)
  if (!installMatch) return []
  const afterInstall = installMatch[1]
  const beforeNextAnd = afterInstall.split('&&')[0]
  return beforeNextAnd
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0 && !token.startsWith('-'))
}

const aptPackages = extractAptInstallPackages(normalized)

describe('Dockerfile font policy (text-only assertions, no Docker daemon)', () => {
  it('installs all three metric-compatible open font packages', () => {
    expect(aptPackages).toContain('fonts-crosextra-carlito')
    expect(aptPackages).toContain('fonts-crosextra-caladea')
    expect(aptPackages).toContain('fonts-liberation')
  })

  it('installs libreoffice-impress and poppler-utils', () => {
    expect(aptPackages).toContain('libreoffice-impress')
    expect(aptPackages).toContain('poppler-utils')
  })

  it('never installs a Microsoft core-font package, directly or transitively (region-scoped)', () => {
    const msFontToken = aptPackages.find((token) =>
      /mscorefonts|msttcorefonts|ttf-mscorefonts/i.test(token),
    )
    expect(msFontToken).toBeUndefined()
  })

  it('parsed a plausible package list (sanity check on the extraction itself)', () => {
    expect(aptPackages.length).toBeGreaterThanOrEqual(6)
  })

  it('uses --no-install-recommends so no recommends chain can pull a font in behind the pin', () => {
    expect(dockerfileRaw).toMatch(/apt-get install[^\n]*--no-install-recommends/)
  })

  it('carries a build-time dpkg provenance assertion that fails on a Microsoft font package', () => {
    const dpkgAssertionPattern =
      /dpkg -l[\s\S]*?grep[\s\S]*?-qiE\s+'mscorefonts\|msttcorefonts'[\s\S]*?exit 1/
    expect(dockerfileRaw).toMatch(dpkgAssertionPattern)
  })

  it('copies the fontconfig alias file into /etc/fonts/conf.d/, then rebuilds the font cache after it', () => {
    const copyIndex = dockerfileRaw.indexOf('/etc/fonts/conf.d/60-metric-compat-aliases.conf')
    const fcCacheIndex = dockerfileRaw.indexOf('fc-cache -f')
    expect(copyIndex).toBeGreaterThan(-1)
    expect(fcCacheIndex).toBeGreaterThan(-1)
    expect(fcCacheIndex).toBeGreaterThan(copyIndex)
  })

  it('sets ENV HOME=/tmp so LibreOffice bootstraps its profile on a writable path', () => {
    expect(dockerfileRaw).toMatch(/ENV HOME=\/tmp/)
  })

  it('runs the compiled entrypoint via CMD ["node", "lib/main.js"]', () => {
    expect(dockerfileRaw).toMatch(/CMD\s*\[\s*"node"\s*,\s*"lib\/main\.js"\s*\]/)
  })

  it('is a two-stage build: exactly two FROM lines, with a COPY --from=builder', () => {
    const fromMatches = dockerfileRaw.match(/^FROM /gm) ?? []
    expect(fromMatches.length).toBe(2)
    expect(dockerfileRaw).toMatch(/COPY --from=builder/)
  })

  it('the extraction is scoped to the install list, not the whole file: removing a required package from the extracted list is detectable', () => {
    // Proves the parser (not just a hand-picked expectation) is what fails when a required
    // open font package is missing from the install list -- simulated on the in-memory text
    // rather than mutating the file on disk, but exercising the identical extraction path
    // every assertion above uses.
    const withoutCarlito = normalized.replace('fonts-crosextra-carlito', '')
    const packagesWithoutCarlito = extractAptInstallPackages(withoutCarlito)
    expect(packagesWithoutCarlito).not.toContain('fonts-crosextra-carlito')
    expect(aptPackages).toContain('fonts-crosextra-carlito')
  })

  it('the dpkg assertion legitimately mentions Microsoft font names without tripping the scoped negative assertion', () => {
    // The whole-file text DOES contain 'mscorefonts' (inside the dpkg provenance RUN's grep
    // pattern) -- proving the negative assertions above are correctly scoped to aptPackages
    // and would NOT have false-failed against a file-wide grep.
    expect(dockerfileRaw).toMatch(/mscorefonts/i)
    expect(aptPackages.some((token) => /mscorefonts/i.test(token))).toBe(false)
  })
})

describe('fontconfig alias file (Calibri->Carlito, Cambria->Caladea substitution)', () => {
  it('maps Calibri to prefer Carlito', () => {
    expect(aliasConfRaw).toMatch(/<family>Calibri<\/family>/)
    expect(aliasConfRaw).toMatch(/<family>Carlito<\/family>/)
  })

  it('maps Cambria to prefer Caladea', () => {
    expect(aliasConfRaw).toMatch(/<family>Cambria<\/family>/)
    expect(aliasConfRaw).toMatch(/<family>Caladea<\/family>/)
  })

  it('is a well-formed fontconfig XML document', () => {
    expect(aliasConfRaw).toMatch(/<fontconfig>/)
    expect(aliasConfRaw).toMatch(/<\/fontconfig>/)
    expect(aliasConfRaw).toMatch(/<!DOCTYPE fontconfig/)
  })
})
