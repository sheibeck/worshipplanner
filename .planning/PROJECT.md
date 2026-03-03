# WorshipPlanner

## What This Is

A worship service planning app for church worship teams (2-3 planners) that helps build weekly service orders using the Vertical Worship methodology. It manages a song stable, suggests songs based on category and recent usage, tracks recurring team tasks, and provides printable/shareable service plans. Built with Vue 3 and Firebase, it complements Planning Center — you plan here, then execute there.

## Core Value

Smart weekly service planning that follows the Vertical Worship methodology (1→2→3 song progression) while rotating through the full song stable and respecting team configurations.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Import song stable from CSV (Planning Center export) with arrangements, keys, BPM, tags, CCLI numbers
- [ ] Manage song stable in-app (add, edit, categorize, tag team compatibility)
- [ ] Categorize songs by Vertical Worship type: 1 (Call to Worship), 2 (Intimate), 3 (Ascription)
- [ ] Create weekly service plans following the standard order (Song, Scripture, Song, Prayer, Scripture, Song, Song, Message, Sending Song)
- [ ] Smart song suggestions based on category slot, recent usage tracking, and team configuration
- [ ] Support song progressions: 1-2-2-3 or 1-2-3-3 for the four worship songs
- [ ] Track song usage history to avoid repeating songs more than two weeks in a row
- [ ] Select scripture passages (6-10 verses, lean into Psalms, avoid pastor's teaching passage)
- [ ] Specify which teams are participating per service (Choir, Orchestra, Special Service, etc.)
- [ ] Filter available songs based on which teams are scheduled (not all songs have choir/orchestra parts)
- [ ] Tag songs with team compatibility (imported from CSV arrangement data + manual refinement)
- [ ] User authentication via Google OAuth or email/password
- [ ] Invite team members to collaborate on planning
- [ ] Print formatted order of service for rehearsal and Sunday
- [ ] Share service plans digitally (email or shareable link)
- [ ] Mobile-friendly view for pulling up plans during rehearsal/service
- [ ] Export service plan data for entry into Planning Center
- [ ] Week-by-week service planning view
- [ ] Seasonal/quarterly overview of planned services
- [ ] Simple recurring task checklist with assignees and due dates
- [ ] Track administrative, communication, technical, and rehearsal tasks across the year

### Out of Scope

- Planning Center API integration — complement only, no sync (complexity too high for v1)
- ProPresenter integration — plans are created here, ProPresenter is managed separately
- Real-time collaborative editing — planners take turns, not simultaneous editing
- Mobile native app — web-first, responsive design serves mobile needs
- CCLI reporting automation — track numbers but don't file reports
- Click track/multitracks management — handled outside this app
- Musician scheduling — handled in Planning Center

## Context

**Vertical Worship Methodology:**
The worship service follows a deliberate emotional and spiritual arc:
- **1 Songs** — Call to worship. General, energetic, inviting. "Us and God" moment. Examples: "Open Up the Heavens," "All Hail the Power of Jesus' Name"
- **2 Songs** — Intimate. Speaking directly to God. "Me and God" moment. Examples: "I Speak Jesus," "Thank You Jesus for the Blood"
- **3 Songs** — Ascription. Mighty declarations about God. Examples: "King of Kings," "Holy Forever"

Four worship songs at the start follow either 1-2-2-3 or 1-2-3-3 progression, plus a sending song after the message.

**Standard Service Order:**
1. Worship Song (1)
2. Scripture Reading
3. Worship Song (2)
4. Prayer Moment
5. Scripture Reading
6. Worship Song (2 or 3)
7. Worship Song (3)
8. Message
9. Sending Song

**Scripture Selection Rules:**
- 6-10 verses (not too long, not too short)
- Don't duplicate the pastor's teaching passage
- Lean into the Psalms when in doubt

**Song Rotation:** Avoid using the same song more than ~2 weeks in a row. Rotate through the entire stable.

**Team Configurations:** Services may include Choir, Orchestra, or be Special Services. This constrains which songs are available since not all songs have parts for every team.

**Song Data (CSV Import):**
Rich data from Planning Center export including: ID, Title, CCLI number, Themes, Notes, Last Scheduled Date, Song Tags, and up to 5 arrangements each with Name, BPM, Length, Notes, Keys, Chord Chart, Chord Chart Key, and up to 3 tags per arrangement.

**Existing Workflow:**
- Plan 2 weeks prior to service
- Email participants 11-12 days before
- Print orders of service for rehearsal (Wednesday) and Sunday
- Weekly pastor meeting
- Rehearsal Wednesday evening + Sunday morning
- Master Worship Schedule prepared 3x/year

**Task Categories:**
Administrative, Communication, Rehearsal, Service time, Training, Physical setup, Technical (Soundboard, Equipment, Programming)

## Constraints

- **Frontend**: Vue 3 — team preference, non-negotiable
- **Backend**: Firebase (Firestore + Authentication) — chosen for Google auth integration and speed of development
- **Auth**: Google OAuth + email/password — must support both methods
- **Relationship to Planning Center**: Complement only — no API integration, data flows via CSV import and manual transfer
- **Team size**: 2-3 active planners, potential expansion to musicians/techs viewing plans

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Vue 3 frontend | Team preference and familiarity | — Pending |
| Firebase backend | Google auth native support, fast development, real-time capable | — Pending |
| Complement Planning Center (not replace) | PC is entrenched, too complex to replicate — focus on the planning brain | — Pending |
| CSV import for songs (not API) | Simpler, Planning Center export already available | — Pending |
| Vertical Worship methodology as core model | This is how the team plans — the app should encode this knowledge | — Pending |
| Smart suggest + manual override | Best of both — speed of suggestions, freedom to customize | — Pending |

---
*Last updated: 2026-03-03 after initialization*
