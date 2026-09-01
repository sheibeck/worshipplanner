---
id: SEED-003
title: Song rehearsal attachments + public/authenticated Rehearse mode (with storage & user cost model)
status: deferred
planted_during: v2.7 (Rehearsal, Stage Plans & Presentation Polish)
planted_on: 2026-09-01
trigger_when: >
  Starting a milestone that adds file storage for songs, a rehearsal/practice experience,
  volunteer-facing self-service, or any feature that streams uploaded media (MP3/PDF/video)
  to end users — or when revisiting subscription pricing / add-on tiers.
---

# SEED-003: Song Rehearsal Attachments + Rehearse Mode (deferred from v2.7)

Two features were **researched during v2.7 then deferred by the owner** ("Let's defer the
storage/rehearsal for now", 2026-08-31) to their own future milestone, because together they are
the app's **highest-risk area**: unauthenticated Storage reads, egress cost, and the
`firestore.exists()`-in-Storage-emulator blind spot that already shipped a deny-everyone bug once.

## The deferred features

1. **Rehearsal attachments on songs** — attach PDF chord charts / sheet music, MP3 reference/practice
   tracks, and YouTube links to a **Song** in the stable (reusable across services). Orchestra churches
   store many PDFs per song (a part per instrument + lead sheet + piano/vocal + chord chart).
2. **Rehearse mode** — a per-song list to play the attached MP3 / YouTube and view the PDF, so
   volunteers can practice their part for the service they're serving.

**Original v2.7 access decision was "public shared link only" (no login).** See the cost analysis
below — the recommendation is now to **reconsider that** in favor of requiring login, because login is
nearly free and removes the worst cost/security risk (scraping/hotlinking of public media).

## Why This Matters

Rehearsal material (parts, practice tracks) is what makes the app useful to the whole team, not just
the planner. It's a natural differentiator vs. plain planning. But it's the first feature that stores
**large user-uploaded binaries** and streams them out — so it must be built with cost + security
guardrails from day one, not retrofitted.

## Architecture findings (from v2.7 research — ARCHITECTURE.md / STACK.md / PITFALLS.md)

- **No new npm dependencies needed.** Native `<audio>` for MP3, native `<iframe>` (use
  `youtube-nocookie.com`) for YouTube, native browser PDF viewer (link-first, `<iframe>` as a desktop
  enhancement — do **not** assume inline PDF works on volunteers' phones; default to a download/open link).
- **Upload:** extend the existing `useMediaUpload.ts` / `useBackgroundUpload.ts` `uploadBytesResumable`
  pattern with a new MIME allow-list (PDF, MP3) and a **distinct Storage path prefix** — NOT under
  `media/`, because the deployed `cleanupExpiredMedia` 14-day sweep would silently delete durable song
  attachments. Attachments are permanent, not transient.
- **Public read (if the public-link route is kept):** Firebase Storage **download-token URLs** are a
  bearer capability that bypass `storage.rules` entirely — this is the safe mechanism for anonymous
  playback with **zero `storage.rules` public-read change**, avoiding the cross-service-rules bug class.
  Mirror how `ShareView.vue` already treats "the link is the auth" and denormalizes a frozen
  `ServiceSnapshot` — Rehearse mode should carry attachment refs/tokenized URLs **into the snapshot via
  `buildServiceSnapshot()`**, exactly like the `roleAssignments` PII-safe projection, rather than
  granting the public page new org-scoped Storage/Firestore access.
- **Do NOT** widen the existing `orgs/{orgId}/**` Storage rule for public read — that would make the
  whole org bucket world-readable, not just shared attachments.
- **Rules-emulator blind spot:** never gate attachment reads with a cross-service
  `firestore.exists()` in `storage.rules` (inert in the Storage emulator — firebase-js-sdk#6803). Use
  denormalized metadata or a server-side signed-URL Cloud Function instead. Open decision: signed URLs
  (Cloud Function-issued) vs. denormalized-token Storage rule — different cost/complexity tradeoffs.
- **Data model:** attachments live on the **Song** document (additive, no migration), Storage objects
  under a new org-scoped, non-`media/` prefix.

## Cost model (researched 2026-09-01)

Reference scenario the owner asked about: **100 churches × 100 songs each**, orchestra libraries
(≈20–30 PDF parts + 2–3 MP3s per song). Firebase Blaze, us-central1 standard rates:
**storage $0.026/GB-month · egress $0.12/GB · Firestore reads $0.06/100k · Auth free ≤ 50k MAU**.

### Storage — trivial

| | Per song | Per church (100 songs) | All 100 churches | Storage $/mo |
|---|---|---|---|---|
| Typical (~30 MB/song: ~10 MB PDF + ~20 MB MP3) | 30 MB | 3 GB | **300 GB** | **$7.80** (~$0.08/church) |
| Heavy orchestra (~50 MB/song) | 50 MB | 5 GB | **500 GB** | **$13** (~$0.13/church) |

### Egress (download bandwidth) — the real variable

~20 volunteers/church rehearsing weekly, pulling their part PDFs + a couple MP3 plays, normal caching:

| Assumption | Per church/mo | 100 churches/mo | Per church/mo cost |
|---|---|---|---|
| Typical (~3 GB/church) | 3 GB | 300 GB × $0.12 = $36 | **~$0.36** |
| Heavy (~15 GB/church, poor caching, replays) | 15 GB | 1.5 TB × $0.12 = $180 | **~$1.80** |

### Auth + Firestore reads (if volunteers log in) — nearly free

- **Firebase Auth (email/password + Google) is free to 50,000 MAU.** 100 churches × 40 users = 4,000
  MAU = 8% of the free tier. Stays free until ~1,250 churches @ 40 users. (Avoid phone/SMS auth — that's
  the one auth method that costs money.)
- **Firestore reads** from logged-in volunteers viewing services/songs: ~$0.10/church/mo typical,
  ~$0.50/church/mo even at 5× heavy. Writes negligible for viewers.

### Bottom line

- **All-in per normal church** (storage + egress + reads + auth) ≈ **$0.50–$2.50/month** — i.e.
  **2–8% of a $25–30 subscription.** **Absorb it in the base plan; do not make it a paid add-on on cost
  grounds.** The numbers are pennies to low single dollars.
- The only thing that turns pennies into a surprise bill is a **runaway on the egress/storage side**
  (a church dumping 50 GB of high-bitrate media, or a **public link getting scraped/hotlinked**) — never
  the number of users.

## Recommendations to carry into the future milestone

1. **Include in the base subscription.** Reserve a paid **add-on tier only for storage/bandwidth
   outliers** (e.g. a church wanting >10–20 GB), never for seat count.
2. **Per-org storage quota** (e.g. 10 GB — fits a 90–100-song orchestra library with headroom). This
   quota is your real cost lever and the thing an add-on would sell "more of."
3. **Per-file size caps** (e.g. PDF ≤ 10 MB, MP3 ≤ 20 MB) — reuse the existing
   `MEDIA_MAX_BYTES` / `BACKGROUND_MAX_BYTES` pattern.
4. **Egress monitoring / budget alerting** so an abusive church or a scraped public link surfaces
   before the bill does.
5. **Strongly reconsider "public link only" → require volunteer login.** Login is ~$0.10–0.50/church/mo,
   keeps volunteers under the 50k free-tier auth ceiling for a very long time, and **removes the worst
   cost/security risk** (no anonymous hotlinking/scraping; per-user attribution + rate limiting become
   possible). This also enables the separately-requested "volunteers find a service where they're
   serving" self-service view (roster-email → assignment match), which the public-link route cannot do.
6. **Anti-features to keep out of v1** (from FEATURES.md): server-side audio transposition (Planning
   Center-style) and playback-speed/loop-a-section are the biggest scope-creep risks — defer to a later
   iteration. Table stakes: play MP3, view/open PDF, embed YouTube, show Key as text.
7. Set a per-attachment PDF/MP3 size cap value at plan time following the existing byte-cap constants.

## Related

- Deferred from milestone **v2.7**; see `.planning/research/{STACK,FEATURES,ARCHITECTURE,PITFALLS,SUMMARY}.md`
  (v2.7 research pass — the "Deferred (future milestone)" notes there carry the same warnings).
- Storage-rules incident precedent: `CLAUDE.md` (2026-08-06 deny-everyone bug) and PROJECT.md Key Decisions.
- Backlog 999.6 (Resend verified sending domain) is a sibling "external-cost/ops hardening" item.
