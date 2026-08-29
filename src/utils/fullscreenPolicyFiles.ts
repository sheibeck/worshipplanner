// Origin-baked Automatic Fullscreen policy-artifact generators (Phase 98,
// R286). Pure and framework-free — no Vue, Firebase, or Pinia imports —
// mirroring monitorConfig.ts's dependency-free module style.
//
// WHY origin is ALWAYS a param, never hardcoded (98-CONTEXT.md Decision 2):
// the downloaded artifact must target wherever the app is actually served —
// http://localhost:5173 in dev, the deployed HTTPS origin in prod — so every
// generator here takes `origin: string` and reads it ONLY from that param.
// The caller (the UI layer, in a later plan) supplies `window.location.origin`
// at call time; NOTHING in this module reads `window`/`location` itself. This
// is also the mitigation for threat T-98-01 (Tampering): the origin flows in
// through a typed function parameter, never a URL query string or free text,
// so there is no injection surface for a crafted link to alter the emitted
// artifact's target origin.
import type { DetectedOS } from './osDetect'

/** Windows registry scope: per-user (no admin) vs machine-wide (admin required). */
export type WindowsRegScope = 'HKCU' | 'HKLM'

/**
 * Generalizes docs/fullscreen-setup/enable-fullscreen-localhost-{HKCU-no-admin,HKLM-admin}.reg —
 * same header line, same Chrome+Edge key blocks, same numbered-string list
 * encoding (`"1"="<origin>"`) — with `${origin}` substituted for the
 * hardcoded localhost origin and the hive/header wording swapped by `scope`.
 */
export function buildWindowsRegFile(origin: string, scope: WindowsRegScope): string {
  const hive = scope === 'HKCU' ? 'HKEY_CURRENT_USER' : 'HKEY_LOCAL_MACHINE'
  const header =
    scope === 'HKCU'
      ? [
          `; WorshipPlanner — enable Automatic Fullscreen for ${origin}.`,
          '; PER-USER (HKCU): double-click this file, click "Yes", then FULLY quit and reopen',
          '; Chrome/Edge (not just reload the tab). No administrator rights required.',
          '; If chrome://policy does NOT show the value after this, use the admin (HKLM) file instead.',
        ]
      : [
          `; WorshipPlanner — enable Automatic Fullscreen for ${origin}.`,
          '; MACHINE-WIDE (HKLM): right-click -> "Merge" while running as administrator (or',
          '; double-click and approve the UAC prompt), then FULLY quit and reopen Chrome/Edge.',
          '; Use this ONLY if the HKCU (no-admin) file did not register at chrome://policy.',
        ]

  return [
    'Windows Registry Editor Version 5.00',
    '',
    ...header,
    '',
    `[${hive}\\SOFTWARE\\Policies\\Google\\Chrome\\AutomaticFullscreenAllowedForUrls]`,
    `"1"="${origin}"`,
    '',
    `[${hive}\\SOFTWARE\\Policies\\Microsoft\\Edge\\AutomaticFullscreenAllowedForUrls]`,
    `"1"="${origin}"`,
    '',
  ].join('\r\n')
}

/**
 * `.mobileconfig` XML from RESEARCH.md's Code Examples (nested
 * com.apple.ManagedClient.preferences -> managed domain -> Forced ->
 * mcx_preference_settings -> AutomaticFullscreenAllowedForUrls -> [origin]),
 * covering BOTH com.google.Chrome and com.microsoft.Edge in one profile
 * (matching the .reg "Chrome+Edge in one artifact" precedent).
 *
 * This exact nesting is RESEARCH Assumption A1 (LOW confidence — community-
 * sourced, not independently confirmed against a current first-party Google
 * template). Tests assert STRUCTURE + origin presence, not byte-for-byte
 * nesting as if first-party-confirmed.
 *
 * The two PayloadUUID values are generated via the injected `uuidFn` so
 * tests can pass a deterministic stub instead of the real crypto.randomUUID.
 */
export function buildMacProfile(origin: string, uuidFn: () => string = () => crypto.randomUUID()): string {
  const preferencesUuid = uuidFn()
  const configurationUuid = uuidFn()

  function chromeLikeBlock(payloadIdentifier: string, uuid: string, domain: string): string {
    return `    <dict>
      <key>PayloadType</key>
      <string>com.apple.ManagedClient.preferences</string>
      <key>PayloadIdentifier</key>
      <string>${payloadIdentifier}</string>
      <key>PayloadUUID</key>
      <string>${uuid}</string>
      <key>PayloadEnabled</key>
      <true/>
      <key>PayloadVersion</key>
      <integer>1</integer>
      <key>PayloadContent</key>
      <dict>
        <key>${domain}</key>
        <dict>
          <key>Forced</key>
          <array>
            <dict>
              <key>mcx_preference_settings</key>
              <dict>
                <key>AutomaticFullscreenAllowedForUrls</key>
                <array>
                  <string>${origin}</string>
                </array>
              </dict>
            </dict>
          </array>
        </dict>
      </dict>
    </dict>`
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>PayloadContent</key>
  <array>
${chromeLikeBlock('com.worshipplanner.fullscreen.chrome', preferencesUuid, 'com.google.Chrome')}
${chromeLikeBlock('com.worshipplanner.fullscreen.edge', configurationUuid, 'com.microsoft.Edge')}
  </array>
  <key>PayloadDisplayName</key>
  <string>WorshipPlanner — Enable Automatic Fullscreen</string>
  <key>PayloadIdentifier</key>
  <string>com.worshipplanner.fullscreen</string>
  <key>PayloadUUID</key>
  <string>${configurationUuid}</string>
  <key>PayloadType</key>
  <string>Configuration</string>
  <key>PayloadVersion</key>
  <integer>1</integer>
</dict>
</plist>
`
}

/** `/etc/opt/chrome/policies/managed/*.json`-shaped managed policy body. */
export function buildLinuxPolicyJson(origin: string): string {
  return JSON.stringify({ AutomaticFullscreenAllowedForUrls: [origin] }, null, 2)
}

/** MIME type per generated artifact kind (RESEARCH.md's ARTIFACT_MIME). */
const ARTIFACT_MIME = {
  reg: 'text/plain',
  mobileconfig: 'application/x-apple-aspen-config',
  json: 'application/json',
} as const

export interface PolicyArtifact {
  filename: string
  mimeType: string
  contents: string
}

/**
 * Dispatches to the correct builder for the detected OS. `unknown` falls
 * back to the Linux JSON artifact — a harmless generic fallback (no OS-
 * specific instructions can be targeted, but the content itself is inert
 * until the operator applies it to a real policy store).
 */
export function buildPolicyArtifact(os: DetectedOS, origin: string, scope: WindowsRegScope = 'HKCU'): PolicyArtifact {
  switch (os) {
    case 'windows':
      return {
        filename: `worshipplanner-enable-fullscreen-${scope.toLowerCase()}.reg`,
        mimeType: ARTIFACT_MIME.reg,
        contents: buildWindowsRegFile(origin, scope),
      }
    case 'macos':
      return {
        filename: 'worshipplanner-enable-fullscreen.mobileconfig',
        mimeType: ARTIFACT_MIME.mobileconfig,
        contents: buildMacProfile(origin),
      }
    case 'linux':
    default:
      return {
        filename: 'worshipplanner-enable-fullscreen.json',
        mimeType: ARTIFACT_MIME.json,
        contents: buildLinuxPolicyJson(origin),
      }
  }
}
