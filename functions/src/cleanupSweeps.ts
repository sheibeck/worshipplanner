import { onSchedule } from "firebase-functions/v2/scheduler";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { getAppConfig, type AppConfig } from "./appConfig";

// cleanupSweeps (R359, ARCH-010): the four scheduled Storage-retention sweeps,
// extracted verbatim from functions/src/index.ts (Phase 120 god-module
// decomposition). Behavior-preserving MOVE -- no handler's logic, schedule,
// guard, or deploy name changed. Each onSchedule wrapper below MUST be
// re-exported from index.ts (`export { cleanupExpiredMedia, ... } from
// "./cleanupSweeps"`) or firebase deploy silently drops it from production.
// See .planning/codebase/ARCHITECTURE.md (Backend Behavioral Notes (R318) §
// functions/src/index.ts) for the original design notes.

/** Builds the Storage prefix a completed render uploads its pages under. Shared
 * with requestPptxRenderHandler in index.ts (imported back from here) and
 * cleanupOrphanRendersHandler below.
 */
export function renderedPrefixFor(orgId: string, importId: string): string {
  return `orgs/${orgId}/pptx-imports/${importId}/rendered/`;
}

// Shared cleanup-sweep safety knob (66-01: T-66-01-02)
// See .planning/codebase/ARCHITECTURE.md (Backend Behavioral Notes (R318) § functions/src/index.ts)
export function readDeleteCap(config: AppConfig): number {
  return config.deleteCapPerRun;
}

// cleanupExpiredMedia (R015: 2-week Storage retention)
// See .planning/codebase/ARCHITECTURE.md (Backend Behavioral Notes (R318) § functions/src/index.ts)
// FAILS SAFE by default -- do not flip the historical MEDIA_CLEANUP_DRY_RUN env var, it is dead.

/**
 * Default retention window (days), used when MEDIA_RETENTION_DAYS is
 * unset/blank/non-numeric. Bumped 14 -> 30 (v1.8 follow-up) per owner
 * request; env-tunable via readMediaRetentionDays() below.
 */
export const RETENTION_DAYS = 30;

/**
 * Reads the effective media retention window in days from a resolved
 * AppConfig (R181) -- a thin passthrough; the fail-open-capped default
 * (RETENTION_DAYS) is applied by appConfig.ts's coerceRetention, not here.
 */
export function readMediaRetentionDays(config: AppConfig): number {
  return config.retention.mediaDays;
}

/**
 * Hard path guard: matches ONLY object names under orgs/{orgId}/media/.
 * Anything else (pptx-imports, or any future non-media path) never reaches
 * the delete decision, regardless of age.
 */
export const MEDIA_PATH_GUARD = /^orgs\/[^/]+\/media\//;

export interface CleanupSummary {
  scannedCount: number;
  deletedObjectCount: number;
  dryRun: boolean;
  /** Total bytes deleted (LIVE) or would-delete (dry-run) this run (66-01: T-66-01-04). */
  deletedBytes: number;
  /** True when readDeleteCap() stopped a LIVE run before all aged candidates were deleted. */
  cappedByLimit: boolean;
}

/**
 * The cleanupExpiredMedia handler body, exported separately from the
 * `onSchedule` wrapper (mirroring parsePptxHandler/parsePptx) so it can be
 * unit-tested directly against a mocked bucket.
 */
export async function cleanupExpiredMediaHandler(
  opts: { forceDryRun?: boolean } = {},
): Promise<CleanupSummary> {
  const db = getFirestore();
  const config = await getAppConfig(db, { fresh: true });
  // Fail safe: only an explicit opt-in (cleanup.mediaEnabled=true in the
  // resolved config) enables real deletion. Anything else -- unset, false, a
  // malformed value -- leaves this a dry run (R181, fail-closed per R184).
  // R188: forceDryRun (set only by previewCleanupDryRun) short-circuits to
  // true regardless of config -- the preview can NEVER derive dryRun from
  // the live flag.
  const dryRun = opts.forceDryRun === true ? true : !config.cleanup.mediaEnabled;
  const bucket = getStorage().bucket();
  const cutoffMs = Date.now() - readMediaRetentionDays(config) * 24 * 60 * 60 * 1000;
  const deleteCap = readDeleteCap(config);

  let scannedCount = 0;
  let deletedObjectCount = 0;
  let deletedBytes = 0;
  let cappedByLimit = false;

  const [files] = await bucket.getFiles({
    prefix: "orgs/",
    autoPaginate: true,
  });

  for (const file of files) {
    // Hard safety gate: never consider anything outside orgs/{orgId}/media/,
    // no matter how old it is (excludes pptx-imports and any other path).
    if (!MEDIA_PATH_GUARD.test(file.name)) {
      continue;
    }

    scannedCount++;

    const timeCreated = file.metadata?.timeCreated;
    const createdMs = timeCreated ? new Date(timeCreated).getTime() : NaN;
    if (Number.isNaN(createdMs) || createdMs > cutoffMs) {
      // Not old enough yet (or timestamp unreadable -- fail safe, skip it).
      continue;
    }

    const fileBytes = Number(file.metadata?.size ?? 0);

    if (dryRun) {
      // Dry-run is NEVER capped -- the owner needs the true backlog
      // count/bytes before enabling live deletion, not a truncated one.
      deletedObjectCount++;
      deletedBytes += fileBytes;
      continue;
    }

    if (deletedObjectCount >= deleteCap) {
      // T-66-01-02: bound this run's blast radius. Idempotent-by-age means
      // the next daily run resumes deleting the remaining backlog.
      cappedByLimit = true;
      break;
    }

    try {
      await file.delete();
      deletedObjectCount++;
      deletedBytes += fileBytes;
    } catch (err) {
      // Partial-failure tolerance (T-22-03-03): one bad delete never aborts
      // the run. Idempotent-by-age means the next daily run retries it.
      console.error(`cleanupExpiredMedia: failed to delete ${file.name}:`, err);
    }
  }

  const summary: CleanupSummary = {
    scannedCount,
    deletedObjectCount,
    dryRun,
    deletedBytes,
    cappedByLimit,
  };
  console.log("cleanupExpiredMedia summary:", summary);
  return summary;
}

export const cleanupExpiredMedia = onSchedule(
  { schedule: "every day 02:00", timeZone: "UTC" },
  async () => {
    await cleanupExpiredMediaHandler();
  },
);

// cleanupOrphanRenders (R062: dry-run-by-default orphan sweep)
// See .planning/codebase/ARCHITECTURE.md (Backend Behavioral Notes (R318) § functions/src/index.ts)
// Runs 03:00 UTC (one hour after cleanupExpiredMedia's 02:00, so the two sweeps never overlap).

/**
 * Default staleness window (hours), used when ORPHAN_RENDER_STALE_HOURS
 * (env var) is unset/blank/non-numeric. Render docs older than this many
 * hours (and still pending/failed) are orphan candidates.
 */
export const ORPHAN_RENDER_STALE_HOURS = 24;

/**
 * Reads the effective orphan-render staleness window in hours from a
 * resolved AppConfig (R181) -- a thin passthrough over
 * config.retention.orphanRenderStaleHours; appConfig.ts's coerceRetention
 * owns the fail-open-capped default (ORPHAN_RENDER_STALE_HOURS).
 */
export function readOrphanRenderStaleHours(config: AppConfig): number {
  return config.retention.orphanRenderStaleHours;
}

/**
 * Hard path guard: matches ONLY object names under the rendered/ prefix of a
 * pptx-imports scope. Structurally unable to match source.pptx or anything
 * under images/ at the same importId -- both are excluded by construction,
 * not by a runtime check on their names.
 */
export const RENDERED_OBJECT_GUARD = /^orgs\/[^/]+\/pptx-imports\/[^/]+\/rendered\//;

export interface OrphanCleanupSummary {
  scannedCount: number;
  deletedDocCount: number;
  deletedObjectCount: number;
  dryRun: boolean;
  /** Total bytes deleted (LIVE) or would-delete (dry-run) this run (66-01: T-66-01-04). */
  deletedBytes: number;
  /** True when readDeleteCap() stopped a LIVE run before all stale candidates were cleared. */
  cappedByLimit: boolean;
}

/**
 * The cleanupOrphanRenders handler body, exported separately from the
 * `onSchedule` wrapper (mirroring cleanupExpiredMediaHandler/cleanupExpiredMedia)
 * so it can be unit-tested directly against mocked Firestore/Storage.
 */
export async function cleanupOrphanRendersHandler(
  opts: { forceDryRun?: boolean } = {},
): Promise<OrphanCleanupSummary> {
  const db = getFirestore();
  const config = await getAppConfig(db, { fresh: true });
  // Fail safe: only an explicit opt-in (cleanup.pptxRenderEnabled=true in the
  // resolved config) enables real deletion. Anything else -- unset, false, a
  // malformed value -- leaves this a dry run (R181, fail-closed per R184).
  // R188: forceDryRun (set only by previewCleanupDryRun) short-circuits to
  // true regardless of config -- the preview can NEVER derive dryRun from
  // the live flag.
  const dryRun = opts.forceDryRun === true ? true : !config.cleanup.pptxRenderEnabled;

  const cutoffMs = Date.now() - readOrphanRenderStaleHours(config) * 60 * 60 * 1000;
  const deleteCap = readDeleteCap(config);

  let scannedCount = 0;
  let deletedDocCount = 0;
  let deletedObjectCount = 0;
  let deletedBytes = 0;
  let cappedByLimit = false;

  const snapshot = await db
    .collectionGroup("pptxRenders")
    .where("status", "in", ["pending", "failed"])
    .get();

  const bucket = getStorage().bucket();

  for (const renderDoc of snapshot.docs) {
    // Recover the org id from the parent chain rather than guessing -- skip
    // any doc whose parent chain is unexpectedly missing.
    const orgId = renderDoc.ref.parent.parent?.id;
    if (!orgId) {
      console.error(
        `cleanupOrphanRenders: skipping ${renderDoc.ref.path} -- missing parent org id`,
      );
      continue;
    }
    const importId = renderDoc.id;

    const data = renderDoc.data() as { createdAt?: { toMillis?: () => number } } | undefined;
    const createdAt = data?.createdAt;
    const createdMs = typeof createdAt?.toMillis === "function" ? createdAt.toMillis() : NaN;
    if (Number.isNaN(createdMs) || createdMs > cutoffMs) {
      // Not stale yet (or timestamp unreadable -- fail safe, skip it).
      continue;
    }

    scannedCount++;

    const [files] = await bucket.getFiles({ prefix: renderedPrefixFor(orgId, importId) });

    // Hard safety gate, applied BEFORE any delete decision: never consider
    // anything outside rendered/, no matter how stale this render doc is.
    const eligibleFiles = files.filter((file) => RENDERED_OBJECT_GUARD.test(file.name));

    if (dryRun) {
      // Dry-run is NEVER capped -- the owner needs the true backlog
      // count/bytes before enabling live deletion, not a truncated one.
      deletedObjectCount += eligibleFiles.length;
      deletedDocCount++;
      for (const file of eligibleFiles) {
        deletedBytes += Number(file.metadata?.size ?? 0);
      }
      continue;
    }

    // T-66-01-02: the cap bounds the TOTAL objects deleted across the whole
    // run (a single run-level counter, not per-doc). If the cap is reached
    // partway through this doc's rendered objects, stop deleting objects AND
    // do not delete the doc itself -- a doc is only removed once its
    // rendered objects are FULLY cleared, so the next daily run can finish
    // the job before the doc disappears.
    let hitCapThisDoc = false;
    for (const file of eligibleFiles) {
      if (deletedObjectCount >= deleteCap) {
        cappedByLimit = true;
        hitCapThisDoc = true;
        break;
      }
      try {
        await file.delete();
        deletedObjectCount++;
        deletedBytes += Number(file.metadata?.size ?? 0);
      } catch (err) {
        // Partial-failure tolerance: one bad delete never aborts the run.
        console.error(`cleanupOrphanRenders: failed to delete ${file.name}:`, err);
      }
    }

    if (hitCapThisDoc) {
      // Stop processing further docs this run -- the cap is already spent.
      break;
    }

    try {
      await renderDoc.ref.delete();
      deletedDocCount++;
    } catch (err) {
      console.error(
        `cleanupOrphanRenders: failed to delete render doc ${renderDoc.ref.path}:`,
        err,
      );
    }
  }

  const summary: OrphanCleanupSummary = {
    scannedCount,
    deletedDocCount,
    deletedObjectCount,
    dryRun,
    deletedBytes,
    cappedByLimit,
  };
  console.log("cleanupOrphanRenders summary:", summary);
  return summary;
}

export const cleanupOrphanRenders = onSchedule(
  { schedule: "every day 03:00", timeZone: "UTC" },
  async () => {
    await cleanupOrphanRendersHandler();
  },
);

/** Shared day-length constant for the two 66-02 retention sweeps below. */
const DAY_MS = 24 * 60 * 60 * 1000;

// cleanupOrphanBackgrounds (R167: orphan+age background sweep, Phase 66-02)
// See .planning/codebase/ARCHITECTURE.md (Backend Behavioral Notes (R318) § functions/src/index.ts)
// FLOOR GUARD: a reference scan returning silently EMPTY must never be trusted as "nothing
// referenced" -- treated as incomplete (forces dry-run) too. Runs 05:00 UTC (after the other sweeps).

/**
 * Default retention window (days), used when the BACKGROUND_RETENTION_DAYS
 * env var is unset/blank/non-numeric. Backgrounds are only orphan-eligible
 * once older than this many days.
 */
export const BACKGROUND_RETENTION_DAYS = 30;

/**
 * Reads the effective background retention window in days from a resolved
 * AppConfig (R181) -- a thin passthrough over config.retention.backgroundDays;
 * appConfig.ts's coerceRetention owns the fail-open-capped default
 * (BACKGROUND_RETENTION_DAYS).
 */
export function readBackgroundRetentionDays(config: AppConfig): number {
  return config.retention.backgroundDays;
}

/**
 * Hard path guard: matches ONLY object names under
 * orgs/{orgId}/backgrounds/. Anything else (media/, pptx-imports/, or any
 * future path) never reaches the delete decision, regardless of age or
 * reference state.
 */
export const BACKGROUND_PATH_GUARD = /^orgs\/[^/]+\/backgrounds\//;

export interface OrphanBackgroundSummary {
  scannedCount: number;
  orphanCount: number;
  deletedObjectCount: number;
  /** Total bytes deleted (LIVE) or would-delete (dry-run) this run. */
  deletedBytes: number;
  /** False when the reference picture could not be fully proven this run -- forces dryRun. */
  referencesComplete: boolean;
  /** True when readDeleteCap() stopped a LIVE run before all orphan candidates were deleted. */
  cappedByLimit: boolean;
  dryRun: boolean;
}

/**
 * Recovers the Storage object path from a Firebase Storage download URL of
 * the shape `https://firebasestorage.googleapis.com/v0/b/{bucket}/o/{ENCODED_PATH}?alt=media&token=...`.
 * Returns the URL-decoded object path (e.g.
 * `orgs/{orgId}/backgrounds/{backgroundId}/{fileName}`), or null when the
 * string has no parseable `/o/{path}` segment -- callers treat a null as an
 * incomplete reference picture rather than guessing.
 */
export function extractBackgroundObjectPath(url: string): string | null {
  const match = /\/o\/([^?]+)/.exec(url);
  if (!match) {
    return null;
  }
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

/**
 * The cleanupOrphanBackgrounds handler body, exported separately from the
 * `onSchedule` wrapper (mirroring cleanupOrphanRendersHandler) so it can be
 * unit-tested directly against mocked Firestore/Storage.
 */
export async function cleanupOrphanBackgroundsHandler(
  opts: { forceDryRun?: boolean } = {},
): Promise<OrphanBackgroundSummary> {
  const db = getFirestore();
  const config = await getAppConfig(db, { fresh: true });
  // Fail safe: only an explicit opt-in (cleanup.backgroundEnabled=true in the
  // resolved config) enables real deletion. Anything else -- unset, false, a
  // malformed value -- leaves this a dry run (R181, fail-closed per R184).
  // R188: forceDryRun (set only by previewCleanupDryRun) short-circuits to
  // true regardless of config -- the preview can NEVER derive dryRun from
  // the live flag.
  const dryRun = opts.forceDryRun === true ? true : !config.cleanup.backgroundEnabled;

  const referencedPaths = new Set<string>();
  let referencesComplete = true;

  const trackUrl = (url: unknown): void => {
    if (typeof url !== "string" || url.length === 0) {
      return;
    }
    const objectPath = extractBackgroundObjectPath(url);
    if (objectPath === null) {
      // Unparseable reference -- the picture is incomplete, never guess.
      referencesComplete = false;
      return;
    }
    referencedPaths.add(objectPath);
  };

  // Tier 1 (group) + Tier 2 (slide, embedded slides[] array on the SAME doc).
  try {
    const slideGroupsSnap = await db.collectionGroup("slideGroups").get();
    for (const doc of slideGroupsSnap.docs) {
      const data = doc.data() as
        | { backgroundImageUrl?: unknown; slides?: Array<{ backgroundImageUrl?: unknown }> }
        | undefined;
      trackUrl(data?.backgroundImageUrl);
      if (data?.slides !== undefined) {
        if (Array.isArray(data.slides)) {
          for (const slide of data.slides) {
            trackUrl(slide?.backgroundImageUrl);
          }
        } else {
          // Malformed slides field -- can't prove no reference exists in it.
          referencesComplete = false;
        }
      }
    }
  } catch (err) {
    console.error("cleanupOrphanBackgrounds: slideGroups reference scan failed:", err);
    referencesComplete = false;
  }

  // Tier 3 (song lyrics).
  try {
    const lyricsSnap = await db.collectionGroup("lyrics").get();
    for (const doc of lyricsSnap.docs) {
      const data = doc.data() as { backgroundImageUrl?: unknown } | undefined;
      trackUrl(data?.backgroundImageUrl);
    }
  } catch (err) {
    console.error("cleanupOrphanBackgrounds: lyrics reference scan failed:", err);
    referencesComplete = false;
  }

  const bucket = getStorage().bucket();
  const [files] = await bucket.getFiles({ prefix: "orgs/", autoPaginate: true });
  const candidates = files.filter((file) => BACKGROUND_PATH_GUARD.test(file.name));

  // FLOOR GUARD: zero references found anywhere, yet background objects
  // exist to consider -- never trust an empty Set as "nothing referenced".
  if (referencedPaths.size === 0 && candidates.length > 0) {
    referencesComplete = false;
  }

  const effectiveDryRun = dryRun || !referencesComplete;
  const cutoffMs = Date.now() - readBackgroundRetentionDays(config) * DAY_MS;
  const deleteCap = readDeleteCap(config);

  let scannedCount = 0;
  let orphanCount = 0;
  let deletedObjectCount = 0;
  let deletedBytes = 0;
  let cappedByLimit = false;

  for (const file of candidates) {
    scannedCount++;

    if (referencedPaths.has(file.name)) {
      // Referenced at some tier -- NEVER delete, no matter how old.
      continue;
    }

    const timeCreated = file.metadata?.timeCreated;
    const createdMs = timeCreated ? new Date(timeCreated).getTime() : NaN;
    if (Number.isNaN(createdMs) || createdMs > cutoffMs) {
      // Not old enough yet (or timestamp unreadable -- fail safe, skip it).
      continue;
    }

    orphanCount++;
    const fileBytes = Number(file.metadata?.size ?? 0);

    if (effectiveDryRun) {
      // Dry-run (explicit or references-incomplete) is NEVER capped -- the
      // owner needs the true backlog count/bytes before enabling live
      // deletion, not a truncated one.
      deletedBytes += fileBytes;
      continue;
    }

    if (deletedObjectCount >= deleteCap) {
      cappedByLimit = true;
      break;
    }

    try {
      await file.delete();
      deletedObjectCount++;
      deletedBytes += fileBytes;
    } catch (err) {
      // Partial-failure tolerance: one bad delete never aborts the run.
      console.error(`cleanupOrphanBackgrounds: failed to delete ${file.name}:`, err);
    }
  }

  const summary: OrphanBackgroundSummary = {
    scannedCount,
    orphanCount,
    deletedObjectCount,
    deletedBytes,
    referencesComplete,
    cappedByLimit,
    dryRun: effectiveDryRun,
  };
  console.log("cleanupOrphanBackgrounds summary:", summary);
  return summary;
}

export const cleanupOrphanBackgrounds = onSchedule(
  { schedule: "every day 05:00", timeZone: "UTC" },
  async () => {
    await cleanupOrphanBackgroundsHandler();
  },
);

// cleanupPptxSources (R168: prune consumed/failed import sources)
// See .planning/codebase/CONCERNS.md (Backend Concern Notes (R318) § functions/src/index.ts)

/**
 * Default retention window (days), used when the PPTX_SOURCE_RETENTION_DAYS
 * env var is unset/blank/non-numeric. Source decks are only prune-eligible
 * once older than this many days.
 */
export const PPTX_SOURCE_RETENTION_DAYS = 30;

/**
 * Reads the effective pptx-source retention window in days from a resolved
 * AppConfig (R181) -- a thin passthrough over config.retention.pptxSourceDays;
 * appConfig.ts's coerceRetention owns the fail-open-capped default
 * (PPTX_SOURCE_RETENTION_DAYS).
 */
export function readPptxSourceRetentionDays(config: AppConfig): number {
  return config.retention.pptxSourceDays;
}

/**
 * Hard POSITIVE path guard: matches ONLY the source deck and the extracted
 * images/ prefix of a pptx-imports scope. Structurally unable to match
 * anything under rendered/ at the same importId -- rendered/ is excluded by
 * construction, never by a runtime name check.
 */
export const PPTX_SOURCE_GUARD = /^orgs\/[^/]+\/pptx-imports\/[^/]+\/(source\.pptx$|images\/)/;

/** Builds the per-import Storage prefix a pptx import's source lives under. */
export function sourcePrefixFor(orgId: string, importId: string): string {
  return `orgs/${orgId}/pptx-imports/${importId}/`;
}

export interface PptxSourceCleanupSummary {
  scannedCount: number;
  deletedObjectCount: number;
  /** Total bytes deleted (LIVE) or would-delete (dry-run) this run. */
  deletedBytes: number;
  /** True when readDeleteCap() stopped a LIVE run before all eligible objects were cleared. */
  cappedByLimit: boolean;
  dryRun: boolean;
}

/**
 * The cleanupPptxSources handler body, exported separately from the
 * `onSchedule` wrapper (mirroring cleanupOrphanRendersHandler) so it can be
 * unit-tested directly against mocked Firestore/Storage.
 */
export async function cleanupPptxSourcesHandler(
  opts: { forceDryRun?: boolean } = {},
): Promise<PptxSourceCleanupSummary> {
  const db = getFirestore();
  const config = await getAppConfig(db, { fresh: true });
  // Fail safe: only an explicit opt-in (cleanup.pptxSourceEnabled=true in the
  // resolved config) enables real deletion. Anything else -- unset, false, a
  // malformed value -- leaves this a dry run (R181, fail-closed per R184).
  // R188: forceDryRun (set only by previewCleanupDryRun) short-circuits to
  // true regardless of config -- the preview can NEVER derive dryRun from
  // the live flag.
  const dryRun = opts.forceDryRun === true ? true : !config.cleanup.pptxSourceEnabled;

  const cutoffMs = Date.now() - readPptxSourceRetentionDays(config) * DAY_MS;
  const deleteCap = readDeleteCap(config);

  let scannedCount = 0;
  let deletedObjectCount = 0;
  let deletedBytes = 0;
  let cappedByLimit = false;

  const snapshot = await db
    .collectionGroup("pptxRenders")
    .where("status", "in", ["ready", "failed"])
    .get();

  const bucket = getStorage().bucket();

  outer: for (const renderDoc of snapshot.docs) {
    // Recover the org id from the parent chain rather than guessing -- skip
    // any doc whose parent chain is unexpectedly missing.
    const orgId = renderDoc.ref.parent.parent?.id;
    if (!orgId) {
      console.error(
        `cleanupPptxSources: skipping ${renderDoc.ref.path} -- missing parent org id`,
      );
      continue;
    }
    const importId = renderDoc.id;

    const data = renderDoc.data() as { createdAt?: { toMillis?: () => number } } | undefined;
    const createdAt = data?.createdAt;
    const createdMs = typeof createdAt?.toMillis === "function" ? createdAt.toMillis() : NaN;
    if (Number.isNaN(createdMs) || createdMs > cutoffMs) {
      // Not old enough yet (or timestamp unreadable -- fail safe, skip it).
      continue;
    }

    scannedCount++;

    const [files] = await bucket.getFiles({ prefix: sourcePrefixFor(orgId, importId) });

    // Hard safety gate, applied BEFORE any delete decision: never consider
    // anything outside source.pptx/images/, no matter how old this import is.
    const eligibleFiles = files.filter((file) => PPTX_SOURCE_GUARD.test(file.name));

    if (dryRun) {
      // Dry-run is NEVER capped -- the owner needs the true backlog
      // count/bytes before enabling live deletion, not a truncated one.
      deletedObjectCount += eligibleFiles.length;
      for (const file of eligibleFiles) {
        deletedBytes += Number(file.metadata?.size ?? 0);
      }
      continue;
    }

    for (const file of eligibleFiles) {
      if (deletedObjectCount >= deleteCap) {
        // T-66-02-04: bound this run's blast radius across the WHOLE run.
        // Idempotent-by-status/age means the next daily run resumes.
        cappedByLimit = true;
        break outer;
      }
      try {
        await file.delete();
        deletedObjectCount++;
        deletedBytes += Number(file.metadata?.size ?? 0);
      } catch (err) {
        // Partial-failure tolerance: one bad delete never aborts the run.
        console.error(`cleanupPptxSources: failed to delete ${file.name}:`, err);
      }
    }
    // Deliberately never delete renderDoc.ref here -- that doc's lifecycle
    // (and its rendered/ objects) stays owned by cleanupOrphanRendersHandler.
  }

  const summary: PptxSourceCleanupSummary = {
    scannedCount,
    deletedObjectCount,
    deletedBytes,
    cappedByLimit,
    dryRun,
  };
  console.log("cleanupPptxSources summary:", summary);
  return summary;
}

export const cleanupPptxSources = onSchedule(
  { schedule: "every day 06:00", timeZone: "UTC" },
  async () => {
    await cleanupPptxSourcesHandler();
  },
);
