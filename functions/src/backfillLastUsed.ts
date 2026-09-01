import { initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

// --- backfillLastUsedForOrg (R248: retroactively correct existing songs' lastUsedAt) ---
//
// PURPOSE: the live R247 fix (84-01-PLAN.md) corrects `lastUsedAt` GOING FORWARD by
// recomputing it on the service lock/unlock lifecycle -- but songs whose lastUsedAt was
// already stamped by the old `serverTimestamp()`-on-assignment bug stay wrong in
// production until something re-triggers that recompute. This script performs the
// one-time retroactive correction for the single production (Berean) org.
//
// THIS IS A NODE SCRIPT, NOT A DEPLOYED FUNCTION. It is run by the owner with admin
// credentials and is deliberately NOT exported from functions/src/index.ts -- it is
// not part of the deployable function surface (mirrors backfillOrgClaims.ts, D-12).
//
// SCALE: production is a SINGLE org (84-CONTEXT.md Area 2, owner: "we only have one
// org in production anyway"). No cursor, no pagination, no batching, no rate limiting,
// no all-orgs sweep -- a single `.get()` per collection (services, songs) within the
// one target org is correct and complete at this size (mirrors backfillOrgClaims.ts's
// identical SCALE note). NEVER widen this to iterate every organizations/* doc.
//
// CONSERVATIVE WRITE RULE (84-CONTEXT.md Area 2, owner-locked): write
// `lastUsedAt = MAX(locked-service date containing the song)` ONLY for songs that have
// >=1 LOCKED (status !== 'draft') service. Every other song -- draft-only, or in no
// service at all -- is SKIPPED and left completely untouched. This script NEVER writes
// null/blank to lastUsedAt; that would destroy the Planning-Center-imported dates on
// songs that were never in any service ("don't touch songs that are not in any
// service... those came from planning center").
//
// SAFETY: dry run is the default. Nothing is written to Firestore unless --apply is
// passed. The CLI wrapper below prints the resolved project id, the resolved org id,
// and a dry-run banner before doing any work (mirrors backfillOrgClaims.ts's D-13/D-14
// safety posture). Owner-confirmed before the real --apply run, per the standing
// 2026-08-25 confirm-then-deploy policy (84-CONTEXT.md).
//
// IDEMPOTENT: a song whose existing lastUsedAt already equals the computed MAX
// (compared via Timestamp.isEqual) is reported skipped, not rewritten -- a re-run
// after an interruption, or a repeat run for auditing, never touches already-correct
// songs.

// --- Mirrored from src/utils/lastUsed.ts (canonical). Keep byte-identical; mirrored
// tests (backfillLastUsed.test.ts) enforce parity across the package boundary. The
// functions package cannot import from src/ directly -- it has its own tsconfig
// (include: ["src"]) and its own `Timestamp` class (firebase-admin/firestore, not
// firebase/firestore) -- so these three are copied verbatim rather than shared by
// import. See src/utils/lastUsed.ts's own header comment for the reciprocal note. ---

/** Timestamp-agnostic shape a `Service` is reduced to before derivation. */
export interface LastUsedServiceInput {
  status: string
  date: string
  songIds: string[]
}

/** Locked === not draft. Covers `'planned'` and `'exported'`. */
export function isLockedStatus(status: string): boolean {
  return status !== 'draft'
}

/**
 * MAX `"YYYY-MM-DD"` over every service that is locked AND contains
 * `songId`. Dates are zero-padded ISO strings, so a plain string comparison
 * yields the correct calendar MAX — no `Date` parsing needed here. Returns
 * `null` (never throws) when no locked service contains the song, including
 * when `services` is empty.
 */
export function computeLastUsedDate(songId: string, services: LastUsedServiceInput[]): string | null {
  let max: string | null = null
  for (const service of services) {
    if (!isLockedStatus(service.status)) continue
    if (!service.songIds.includes(songId)) continue
    if (max === null || service.date > max) {
      max = service.date
    }
  }
  return max
}

/** See ADR-0009 (docs/adr/0009-the-single-shared-calendar-date-parse-convention-for-a-servi.md) */
export function serviceDateToMillis(date: string): number {
  const parts = date.split("-");
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  return Date.UTC(year, month - 1, day);
}

// --- end mirrored section ---

/** Raw shape read off an `organizations/{orgId}/services/{id}` doc -- only the fields this script needs. */
interface ServiceDocData {
  status?: string;
  date?: string;
  slots?: Array<{ kind?: string; songId?: string | null }>;
}

/** Raw shape read off an `organizations/{orgId}/songs/{id}` doc -- only the field this script needs. */
interface SongDocData {
  lastUsedAt?: Timestamp | null;
}

/** Reduces a raw service doc's slots to the songIds carried in SONG slots only (mirrors src/utils/lastUsed.ts's serviceToLastUsedInput, but reads directly off the Admin SDK doc shape rather than the client Service type). */
function songIdsFromSlots(slots: ServiceDocData["slots"]): string[] {
  return (slots ?? [])
    .filter((slot) => slot.kind === "SONG" && !!slot.songId)
    .map((slot) => slot.songId as string);
}

export interface BackfillOptions {
  /** Single-org scope (84-CONTEXT.md Area 2) -- never an all-orgs sweep. */
  orgId: string;
  /** When false (the default), every song is classified but nothing is written. */
  apply: boolean;
}

/** One song this run could not classify or write cleanly. */
export interface BackfillFailure {
  songId: string;
  error: string;
}

export interface BackfillSummary {
  processed: number;
  skipped: number;
  failed: BackfillFailure[];
  /** See ADR-0010 (docs/adr/0010-a-missing-malformed-date-used-to-fall-through-as-data-date.md) */
  malformedServices: string[];
}

/**
 * Reads all `organizations/{orgId}/services` and `organizations/{orgId}/songs` docs
 * ONCE (SCALE note above), then for each song computes `MAX(locked service date)` via
 * the mirrored `computeLastUsedDate` and applies the conservative write rule:
 *  - `maxDate === null` (no locked service contains the song) -> SKIP, never write.
 *  - `maxDate !== null` and the song's existing `lastUsedAt` already equals the
 *    computed Timestamp -> SKIP (idempotent, already-current).
 *  - otherwise -> WRITE (only when `apply`) `lastUsedAt` to
 *    `Timestamp.fromMillis(serviceDateToMillis(maxDate))`; always counts as processed,
 *    even in a dry run, so the summary reflects the INTENDED change.
 */
export async function backfillLastUsedForOrg(options: BackfillOptions): Promise<BackfillSummary> {
  const { orgId, apply } = options;
  const db = getFirestore();
  const orgRef = db.collection("organizations").doc(orgId);

  const [servicesSnap, songsSnap] = await Promise.all([
    orgRef.collection("services").get(),
    orgRef.collection("songs").get(),
  ]);

  // See ADR-0010 (docs/adr/0010-a-missing-malformed-date-used-to-fall-through-as-data-date.md)
  const malformedServices: string[] = [];
  const serviceInputs: LastUsedServiceInput[] = [];
  for (const doc of servicesSnap.docs) {
    const data = doc.data() as ServiceDocData;
    const date = data.date;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      malformedServices.push(doc.id);
      console.warn(
        `[backfillLastUsed] service ${doc.id}: missing/malformed date "${date ?? ""}" -- excluded from MAX computation`,
      );
      continue;
    }
    serviceInputs.push({
      status: data.status ?? "draft",
      date,
      songIds: songIdsFromSlots(data.slots),
    });
  }

  let processed = 0;
  let skipped = 0;
  const failed: BackfillFailure[] = [];

  for (const songDoc of songsSnap.docs) {
    const songId = songDoc.id;
    try {
      const maxDate = computeLastUsedDate(songId, serviceInputs);

      if (maxDate === null) {
        // Conservative rule: no locked service contains this song -- leave it
        // completely untouched (preserves a Planning-Center-imported date, or a
        // never-set null, either way NEVER blanked here).
        skipped++;
        console.log(`[backfillLastUsed] ${songId}: skip (no locked service)`);
        continue;
      }

      const next = Timestamp.fromMillis(serviceDateToMillis(maxDate));
      const existing = (songDoc.data() as SongDocData).lastUsedAt ?? null;

      if (existing !== null && existing.isEqual(next)) {
        skipped++;
        console.log(`[backfillLastUsed] ${songId}: skip (already-current, ${maxDate})`);
        continue;
      }

      if (apply) {
        await songDoc.ref.update({ lastUsedAt: next });
      }
      processed++;
      console.log(`[backfillLastUsed] ${songId}: ${apply ? "set" : "would set"} lastUsedAt=${maxDate}`);
    } catch (err) {
      console.error(`[backfillLastUsed] ${songId}: failed`, err);
      failed.push({ songId, error: String(err) });
    }
  }

  const summary: BackfillSummary = { processed, skipped, failed, malformedServices };
  console.log("[backfillLastUsed] summary:", summary);
  return summary;
}

/**
 * Resolves the single target org: an explicit `--org <id>` CLI arg, or the SOLE
 * `organizations` doc when exactly one exists. Aborts with a clear message rather
 * than guessing when zero or multiple orgs are found -- production is single-org
 * (84-CONTEXT.md Area 2), so this script must never sweep across orgs.
 */
export async function resolveOrgIdFromArgsOrSoleOrg(argv: string[]): Promise<string> {
  const orgArgIndex = argv.indexOf("--org");
  if (orgArgIndex !== -1) {
    const orgId = argv[orgArgIndex + 1];
    if (!orgId) {
      throw new Error("--org requires a value, e.g. --org berean");
    }
    return orgId;
  }

  const orgsSnap = await getFirestore().collection("organizations").get();
  if (orgsSnap.size === 0) {
    throw new Error("No organizations found -- nothing to backfill.");
  }
  if (orgsSnap.size > 1) {
    const ids = orgsSnap.docs.map((doc) => doc.id).join(", ");
    throw new Error(`Multiple organizations found (${orgsSnap.size}: ${ids}) -- pass --org <id> to select one.`);
  }
  return orgsSnap.docs[0]!.id;
}

// --- CLI wrapper -----------------------------------------------------------
//
// Guarded so importing this module (as backfillLastUsed.test.ts does) never calls
// initializeApp() or touches a live project -- only running it directly does
// (mirrors backfillOrgClaims.ts's identical guard).
//
// Usage (after `npm run build` from functions/):
//   node lib/backfillLastUsed.js                    # dry run (default), sole org
//   node lib/backfillLastUsed.js --apply             # writes for real, sole org
//   node lib/backfillLastUsed.js --org berean         # dry run, explicit org
//   node lib/backfillLastUsed.js --org berean --apply # writes for real, explicit org
//
// Credentials resolve from GOOGLE_APPLICATION_CREDENTIALS or
// `gcloud auth application-default login`, exactly like any other Admin SDK script.
//
// The whole body is wrapped in try/catch, mirroring backfillOrgClaims.ts's
// runBackfillCli -- a rejection before any song is processed (bad/expired
// credentials, wrong project, multi-org abort, network failure) produces a readable
// diagnostic and a non-zero exit code instead of an unhandled rejection.
export async function runBackfillCli(): Promise<void> {
  try {
    initializeApp();

    const apply = process.argv.includes("--apply");
    const projectId =
      process.env.GOOGLE_CLOUD_PROJECT ?? process.env.GCLOUD_PROJECT ?? "(unresolved project id)";
    console.log(`[backfillLastUsed] target project: ${projectId}`);
    if (apply) {
      console.log("[backfillLastUsed] APPLY MODE -- lastUsedAt will be written for real.");
    } else {
      console.log(
        "[backfillLastUsed] ==== DRY RUN ==== no writes will occur. Pass --apply to write for real.",
      );
    }

    const orgId = await resolveOrgIdFromArgsOrSoleOrg(process.argv);
    console.log(`[backfillLastUsed] target org: ${orgId}`);

    const summary = await backfillLastUsedForOrg({ orgId, apply });
    if (summary.malformedServices.length > 0) {
      console.warn(
        `[backfillLastUsed] ${summary.malformedServices.length} service(s) had a missing/malformed date and were excluded from MAX computation -- review before --apply: ${summary.malformedServices.join(", ")}`,
      );
    }
    if (summary.failed.length > 0) {
      console.error(`[backfillLastUsed] ${summary.failed.length} song(s) failed -- see summary above.`);
      process.exitCode = 1;
    }
  } catch (err) {
    console.error(
      "[backfillLastUsed] aborted before processing any song -- top-level failure:",
      err,
    );
    process.exitCode = 1;
  }
}

if (require.main === module) {
  void runBackfillCli();
}
