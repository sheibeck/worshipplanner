// DEV-ONLY: seed the local Firebase emulators with a realistic sample dataset
// (churches, teams, roster, songs, a service, a quarter) so the owner does not
// have to hand-craft test data after every fresh `firebase emulators:start`.
//
// COMPANION to functions/seed-emulator.mjs. It follows the SAME safety pattern:
//   - hard-points the Admin SDK at the LOCAL emulators via
//     FIREBASE_AUTH_EMULATOR_HOST / FIRESTORE_EMULATOR_HOST (no real creds),
//   - uses projectId 'worship-planner-bc515' so it shares the app's emulator
//     namespace, and
//   - is IDEMPOTENT: fixed doc ids + `.set()` everywhere, so re-running each
//     restart overwrites cleanly instead of duplicating.
// If the emulators are not up it simply fails to connect — it can never touch a
// real project.
//
// This script is SELF-CONTAINED: it first ensures/grants the super-admin user
// (same find-or-create-by-email + superAdmins/{uid} + { superAdmin:true } claim
// that seed-emulator.mjs does), then seeds the sample orgs owned by that user.
// So you can run it alone, OR via `npm run seed:emulator` (runs seed-emulator.mjs
// first — harmless/redundant since the grant here is idempotent too).
//
// Usage (from repo root, emulators already running):
//   node functions/seed-emulator-data.mjs
//   node functions/seed-emulator-data.mjs someone@example.com   # different owner
//
// After it runs, sign out and back in (or hard-refresh) in the app so your ID
// token picks up the org-membership + superAdmin custom claims.
//
// ─────────────────────────────────────────────────────────────────────────────
// COLLECTION PATHS + DOC SHAPES SEEDED (and where each shape was derived):
//   users/{uid}                              src/stores/auth.ts:706-715,749  (email/displayName/photoURL/orgIds/updatedAt)
//   superAdmins/{uid}                        functions/seed-emulator.mjs:52-56
//   orgNames/{nameKey}                       functions/src/orgProvisioning.ts:280,289  ({ orgId })
//   organizations/{orgId}                    functions/src/orgProvisioning.ts:290-295 + src/types/organization.ts:157-197
//   organizations/{orgId}.settings           src/types/organization.ts:52-149,208-240 + functions/src/orgTemplateSeed.ts:111-131
//   organizations/{orgId}/members/{uid}      functions/src/orgProvisioning.ts:199-205  (role/joinedAt/displayName/email)
//   organizations/{orgId}/teams/{id}         src/stores/teams.ts:59-65 + src/types/team.ts:6-32  (name/order)
//   organizations/{orgId}/roles/{id}         src/stores/roster.ts:243-248 + src/types/roster.ts:5-11,99-108
//   organizations/{orgId}/people/{id}        src/stores/roster.ts:96-106 + src/types/roster.ts:13-25
//   organizations/{orgId}/songs/{id}         src/stores/songs.ts:281-285 + src/types/song.ts:12-42
//   organizations/{orgId}/services/{id}      src/stores/services.ts:251-261 + src/types/service.ts:63-188
//   organizations/{orgId}/quarters/{id}      src/stores/quarters.ts:133-145 + src/types/roster.ts:66-79
// The super-admin's custom claims (merge-preserving superAdmin):
//   { superAdmin, orgId, role, orgs, deactivatedOrgs }
//                                            functions/src/orgMembershipClaims.ts:433-437 (shape written by syncOrgMembershipClaim)
// ─────────────────────────────────────────────────────────────────────────────

import { initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

const EMAIL = process.argv[2] || 'sheibeck@gmail.com'
const PROJECT_ID = process.env.GCLOUD_PROJECT || 'worship-planner-bc515'

// Point the Admin SDK at the running emulators (ports from firebase.json) —
// identical to seed-emulator.mjs so both scripts share one emulator namespace.
process.env.FIREBASE_AUTH_EMULATOR_HOST ||= '127.0.0.1:9099'
process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8080'

initializeApp({ projectId: PROJECT_ID })
const auth = getAuth()
const db = getFirestore()

// The two seeded churches. Fixed ids → idempotent re-seeding.
const PRIMARY_ORG_ID = 'emu-berean'
const SECOND_ORG_ID = 'emu-grace'
const PRIMARY_ORG_NAME = 'Berean Community Church'
const SECOND_ORG_NAME = 'Grace Fellowship'

// ── helpers ──────────────────────────────────────────────────────────────────

/**
 * Ported from functions/src/orgProvisioning.ts:45-54 (normalizeOrgName) so the
 * seeded orgNames/{key} id matches what onboardOrganizationHandler would mint.
 */
function normalizeOrgName(name) {
  const key = name.trim().toLowerCase().replace(/\//g, ' ').replace(/\s+/g, ' ').trim()
  if (!key || /^\.+$/.test(key)) {
    return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  }
  return key
}

/** All Sundays (YYYY-MM-DD) in a calendar quarter — inline replica of the pure
 *  behaviour of src/utils/quarterDates.ts::generateSundaysInQuarter (functions
 *  cannot import the client src/ tree). */
function sundaysInQuarter(year, quarter) {
  const startMonth = (quarter - 1) * 3
  const end = new Date(Date.UTC(year, startMonth + 3, 0))
  const dates = []
  const d = new Date(Date.UTC(year, startMonth, 1))
  while (d <= end) {
    if (d.getUTCDay() === 0) dates.push(d.toISOString().slice(0, 10))
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return dates
}

const now = () => FieldValue.serverTimestamp()

// Fixed default-service-template entries (deterministic ids for idempotency) —
// the 9-entry '1-2-2-3' suggested shape from functions/src/orgTemplateSeed.ts:58-68.
function defaultServiceTemplate() {
  const shape = [
    { kind: 'SONG', section: 'worship' },
    { kind: 'SCRIPTURE', section: 'worship' },
    { kind: 'SONG', section: 'worship' },
    { kind: 'PRAYER', section: 'worship' },
    { kind: 'SCRIPTURE', section: 'worship' },
    { kind: 'SONG', section: 'worship' },
    { kind: 'SONG', section: 'worship' },
    { kind: 'MESSAGE', section: 'message' },
    { kind: 'SONG', section: 'sending' },
  ]
  return shape.map((entry, i) => ({ id: `tmpl-${i}`, ...entry }))
}

// Mirrors src/types/organization.ts:208-240 DEFAULT_ORG_SETTINGS (with the
// template populated per functions/src/orgTemplateSeed.ts:111-131). aiEnabled
// left true so AI features work locally on the primary church.
function orgSettings() {
  return {
    aiEnabled: true,
    pcEnabled: true,
    vwModeEnabled: true,
    defaultServiceTemplate: defaultServiceTemplate(),
    bibleVersion: 'NLT',
    slideTypography: { fontFamily: 'Inter', fontWeight: 400, fontScale: 'md' },
    messaging: { enabled: false, lockNotifyDefault: false, reminderEnabled: false, reminderDaysBefore: 7 },
    timezone: 'America/Chicago',
  }
}

// Role ids are referenced by people.roles + quarter.personQuarterData, so they
// must be deterministic. Shape: src/types/roster.ts:5-11, seed write pattern
// src/stores/roster.ts:243-248.
const ROLES = [
  { id: 'role-guitar', name: 'guitar', group: 'band', defaultCount: 1, order: 0 },
  { id: 'role-drums', name: 'drums', group: 'band', defaultCount: 1, order: 1 },
  { id: 'role-vocals', name: 'vocals', group: 'vocals', defaultCount: 1, order: 2 },
  { id: 'role-bass', name: 'bass', group: 'band', defaultCount: 1, order: 3 },
  { id: 'role-sound', name: 'sound', group: 'tech', defaultCount: 1, order: 4 },
  { id: 'role-livestream', name: 'livestream', group: 'tech', defaultCount: 1, order: 5 },
  { id: 'role-projection', name: 'projection', group: 'tech', defaultCount: 1, order: 6 },
  { id: 'role-scripture-reader', name: 'scripture reader', group: 'other', defaultCount: 1, order: 7 },
]

// Teams: src/types/team.ts:27-32 DEFAULT_TEAMS + src/stores/teams.ts:59-65.
const TEAMS = [
  { id: 'team-choir', name: 'Choir', order: 0 },
  { id: 'team-orchestra', name: 'Orchestra', order: 1 },
  { id: 'team-communion', name: 'Communion', order: 2 },
  { id: 'team-special', name: 'Special', order: 3 },
]

// People: src/types/roster.ts:13-25 + write shape src/stores/roster.ts:96-106.
const PEOPLE = [
  { id: 'person-alice', name: 'Alice Johnson', email: 'alice@example.com', phone: '555-0101', roles: ['role-vocals', 'role-guitar'] },
  { id: 'person-bob', name: 'Bob Smith', email: 'bob@example.com', phone: '555-0102', roles: ['role-drums'] },
  { id: 'person-carol', name: 'Carol Lee', email: 'carol@example.com', phone: '555-0103', roles: ['role-bass', 'role-vocals'] },
  { id: 'person-dave', name: 'Dave Martin', email: 'dave@example.com', phone: '555-0104', roles: ['role-sound', 'role-livestream'] },
  { id: 'person-erin', name: 'Erin Davis', email: 'erin@example.com', phone: '555-0105', roles: ['role-projection'] },
  { id: 'person-frank', name: 'Frank Wilson', email: 'frank@example.com', phone: '555-0106', roles: ['role-scripture-reader'] },
  { id: 'person-grace', name: 'Grace Kim', email: 'grace@example.com', phone: '555-0107', roles: ['role-vocals'] },
  { id: 'person-henry', name: 'Henry Brown', email: 'henry@example.com', phone: '555-0108', roles: ['role-guitar', 'role-bass'] },
]

// Songs: src/types/song.ts:12-42 (Arrangement + Song). Arrangement ids are
// deterministic and primaryArrangementId points at the first one.
function arr(id, name, key, bpm, teamTags = []) {
  return { id, name, key, bpm, lengthSeconds: null, chordChartUrl: '', notes: '', teamTags }
}
const SONGS = [
  { id: 'song-1', title: 'Amazing Grace (My Chains Are Gone)', ccliNumber: '4768151', author: 'Chris Tomlin', themes: ['grace', 'salvation'], vwTypes: [2], tags: ['hymn'], arrangements: [arr('arr-1a', 'Default', 'G', 72)] },
  { id: 'song-2', title: 'How Great Is Our God', ccliNumber: '4348399', author: 'Chris Tomlin', themes: ['worship', 'majesty'], vwTypes: [3], tags: [], arrangements: [arr('arr-2a', 'Default', 'C', 78)] },
  { id: 'song-3', title: 'Cornerstone', ccliNumber: '6158927', author: 'Hillsong', themes: ['hope', 'foundation'], vwTypes: [3], tags: [], arrangements: [arr('arr-3a', 'Default', 'C', 70)] },
  { id: 'song-4', title: 'Good Good Father', ccliNumber: '7036612', author: 'Chris Tomlin', themes: ['fatherhood', 'love'], vwTypes: [2], tags: [], arrangements: [arr('arr-4a', 'Default', 'A', 70)] },
  { id: 'song-5', title: 'Great Are You Lord', ccliNumber: '6460220', author: 'All Sons & Daughters', themes: ['breath', 'praise'], vwTypes: [1], tags: [], arrangements: [arr('arr-5a', 'Default', 'A', 72)] },
  { id: 'song-6', title: 'Build My Life', ccliNumber: '7070345', author: 'Pat Barrett', themes: ['surrender', 'foundation'], vwTypes: [2], tags: [], arrangements: [arr('arr-6a', 'Default', 'E', 68)] },
  { id: 'song-7', title: 'This Is Amazing Grace', ccliNumber: '6333821', author: 'Phil Wickham', themes: ['grace', 'freedom'], vwTypes: [1], tags: [], arrangements: [arr('arr-7a', 'Default', 'B', 84)] },
  { id: 'song-8', title: 'Living Hope', ccliNumber: '7106807', author: 'Phil Wickham', themes: ['resurrection', 'hope'], vwTypes: [3], tags: ['easter'], arrangements: [arr('arr-8a', 'Default', 'C', 68)] },
  { id: 'song-9', title: 'Goodness of God', ccliNumber: '7117726', author: 'Bethel Music', themes: ['faithfulness', 'testimony'], vwTypes: [2], tags: [], arrangements: [arr('arr-9a', 'Default', 'Ab', 63)] },
  { id: 'song-10', title: 'O Come to the Altar', ccliNumber: '7051511', author: 'Elevation Worship', themes: ['repentance', 'invitation'], vwTypes: [2], tags: ['communion'], arrangements: [arr('arr-10a', 'Default', 'B', 72)] },
]

// Service slots — a valid subset of the ServiceSlot union (src/types/service.ts:63-146).
// One SONG slot references a seeded song so the editor renders a chosen song.
function serviceSlots() {
  return [
    { id: 'slot-1', kind: 'SONG', position: 0, section: 'worship', requiredVwType: 1, songId: 'song-5', songTitle: 'Great Are You Lord', songKey: 'A' },
    { id: 'slot-2', kind: 'SCRIPTURE', position: 1, section: 'worship', book: 'Psalms', chapter: 100, verseStart: 1, verseEnd: 5 },
    { id: 'slot-3', kind: 'SONG', position: 2, section: 'worship', requiredVwType: 2, songId: 'song-6', songTitle: 'Build My Life', songKey: 'E' },
    { id: 'slot-4', kind: 'PRAYER', position: 3, section: 'worship', body: 'Pastoral prayer' },
    { id: 'slot-5', kind: 'MESSAGE', position: 4, section: 'message', body: 'Sermon' },
    { id: 'slot-6', kind: 'SONG', position: 5, section: 'sending', requiredVwType: 3, songId: 'song-2', songTitle: 'How Great Is Our God', songKey: 'C' },
  ]
}

// ── seeding ──────────────────────────────────────────────────────────────────

/** Seed one church (org doc + settings + member + teams + roles + people +
 *  songs + one service + one quarter). Idempotent via fixed ids + .set(). */
async function seedOrg(orgId, name, uid, { aiMasterEnabled }) {
  // orgNames uniqueness registry (orgProvisioning.ts:280,289).
  await db.collection('orgNames').doc(normalizeOrgName(name)).set({ orgId })

  // organizations/{orgId} — mirrors onboardOrganizationHandler's write
  // (orgProvisioning.ts:290-295) plus the super-admin lifecycle fields
  // active/aiMasterEnabled (src/types/organization.ts:181-196). slug is set so
  // public share links resolve without a lazy claim.
  await db.collection('organizations').doc(orgId).set({
    name,
    slug: orgId.replace(/^emu-/, ''),
    createdBy: uid,
    createdAt: now(),
    active: true,
    aiMasterEnabled,
    settings: orgSettings(),
  })

  // members/{uid} — role editor (orgProvisioning.ts:199-205).
  await db.collection('organizations').doc(orgId).collection('members').doc(uid).set({
    role: 'editor',
    joinedAt: now(),
    displayName: EMAIL.split('@')[0],
    email: EMAIL,
  })

  // teams (teams.ts:59-65)
  for (const t of TEAMS) {
    const { id, ...data } = t
    await db.collection('organizations').doc(orgId).collection('teams').doc(id).set({ ...data, createdAt: now(), updatedAt: now() })
  }

  // roles (roster.ts:243-248)
  for (const r of ROLES) {
    const { id, ...data } = r
    await db.collection('organizations').doc(orgId).collection('roles').doc(id).set({ ...data, createdAt: now(), updatedAt: now() })
  }

  // people (roster.ts:96-106)
  for (const p of PEOPLE) {
    await db.collection('organizations').doc(orgId).collection('people').doc(p.id).set({
      name: p.name,
      email: p.email,
      phone: p.phone,
      roles: p.roles,
      pcPersonId: null,
      active: true,
      createdAt: now(),
      updatedAt: now(),
    })
  }

  // songs (songs.ts:281-285 + song.ts:23-42)
  for (const s of SONGS) {
    await db.collection('organizations').doc(orgId).collection('songs').doc(s.id).set({
      title: s.title,
      ccliNumber: s.ccliNumber,
      author: s.author,
      themes: s.themes,
      notes: '',
      vwTypes: s.vwTypes,
      arrangements: s.arrangements,
      primaryArrangementId: s.arrangements[0].id,
      lastUsedAt: null,
      pcSongId: null,
      hidden: false,
      tags: s.tags,
      removedThemes: [],
      createdAt: now(),
      updatedAt: now(),
    })
  }

  // one draft service (services.ts:251-261 + service.ts:155-188)
  await db.collection('organizations').doc(orgId).collection('services').doc('service-1').set({
    date: '2026-08-30',
    name: 'Sunday Morning Worship',
    progression: '1-2-2-3',
    teams: ['Choir'],
    status: 'draft',
    slots: serviceSlots(),
    sermonPassage: { book: 'Psalms', chapter: 100 },
    sermonTopic: 'A Call to Thankful Worship',
    notes: '',
    createdAt: now(),
    updatedAt: now(),
  })

  // one draft quarter (quarters.ts:133-145 + roster.ts:66-79). Calendar left
  // empty — the owner clicks "Generate" in Quarter view; personQuarterData is
  // seeded so the availability grid shows people.
  const qYear = 2026
  const qNum = 3
  const personQuarterData = {}
  for (const p of PEOPLE) {
    const roleFrequency = {}
    for (const roleId of p.roles) roleFrequency[roleId] = { tier: 'regular', n: 4 }
    personQuarterData[p.id] = { personId: p.id, blackoutDates: [], pairedWith: [], roleFrequency }
  }
  await db.collection('organizations').doc(orgId).collection('quarters').doc('quarter-1').set({
    label: `Q${qNum} ${qYear}`,
    year: qYear,
    quarter: qNum,
    serviceDates: sundaysInQuarter(qYear, qNum),
    roleOverridesByDate: {},
    personQuarterData,
    calendar: {},
    status: 'draft',
    shareToken: null,
    createdAt: now(),
    updatedAt: now(),
  })

  console.log(`  ✓ seeded church "${name}" (${orgId}) — aiMasterEnabled=${aiMasterEnabled}`)
}

// ── main ─────────────────────────────────────────────────────────────────────

// 1. Ensure/resolve the super-admin owner (find-or-create by email —
//    seed-emulator.mjs:40-50).
let user
try {
  user = await auth.getUserByEmail(EMAIL)
  console.log(`• found existing emulator user ${EMAIL} → ${user.uid}`)
} catch {
  user = await auth.createUser({ email: EMAIL, emailVerified: true, displayName: EMAIL.split('@')[0] })
  console.log(`• created emulator user ${EMAIL} → ${user.uid}`)
}
const uid = user.uid

// 2. Grant super-admin (source-of-truth doc — seed-emulator.mjs:52-56). The
//    { superAdmin:true } claim is merged in step 5's single claim write below.
await db.collection('superAdmins').doc(uid).set({ email: EMAIL, grantedBy: 'emulator-seed', grantedAt: new Date() })

// 3. Seed both churches (aiMasterEnabled only on the primary).
await seedOrg(PRIMARY_ORG_ID, PRIMARY_ORG_NAME, uid, { aiMasterEnabled: true })
await seedOrg(SECOND_ORG_ID, SECOND_ORG_NAME, uid, { aiMasterEnabled: false })

// 4. users/{uid} — profile + orgIds (orgIds[0] is the PRIMARY org the app
//    loads first). Shape: auth.ts:706-715,749.
await db.collection('users').doc(uid).set(
  {
    email: EMAIL,
    displayName: EMAIL.split('@')[0],
    photoURL: null,
    orgIds: [PRIMARY_ORG_ID, SECOND_ORG_ID],
    updatedAt: now(),
  },
  { merge: true },
)

// 5. Custom claims — ONE merge-preserving write carrying the org-membership
//    claim (orgId/role/orgs/deactivatedOrgs, exactly the shape
//    syncOrgMembershipClaim writes — orgMembershipClaims.ts:433-437) AND the
//    preserved { superAdmin:true }. Preserving any pre-existing claim mirrors
//    seed-emulator.mjs:57.
await auth.setCustomUserClaims(uid, {
  ...(user.customClaims || {}),
  superAdmin: true,
  orgId: PRIMARY_ORG_ID,
  role: 'editor',
  orgs: { [PRIMARY_ORG_ID]: 'editor', [SECOND_ORG_ID]: 'editor' },
  deactivatedOrgs: {},
})

console.log(`\n✓ Seeded sample data into the emulator (project ${PROJECT_ID}).`)
console.log(`  Owner: ${EMAIL} (super-admin, editor of both churches).`)
console.log(`  Churches: ${PRIMARY_ORG_NAME} (${PRIMARY_ORG_ID}, AI on), ${SECOND_ORG_NAME} (${SECOND_ORG_ID}).`)
console.log('  → In the app: sign out and back in (or hard-refresh) to load the new claims onto your token.')
