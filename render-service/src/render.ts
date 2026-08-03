// render-service/src/render.ts
//
// Cloud Run render pipeline: download a source .pptx from Storage, convert it to a PDF with
// LibreOffice, rasterize each PDF page to a PNG with Poppler, then upload each page back to
// Storage under a stable, zero-padded page-numbered destination.
//
// ★ execFile is wrapped via promisify at module scope specifically so tests can mock
// `node:child_process` wholesale (vi.mock("node:child_process", ...)) and control every
// soffice/pdftoppm invocation without ever touching a real binary.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { Storage } from "@google-cloud/storage";

const run = promisify(execFile);

// Instantiated lazily so a test that mocks "@google-cloud/storage" fully controls this
// module's only Storage client -- this file never imports firebase-admin (the render
// service is a plain Cloud Run container, not a Firebase Function).
const storage = new Storage();

// Unlike firebase-admin's getStorage().bucket() (used elsewhere in this codebase), which
// resolves an app-configured default bucket with no argument, the plain @google-cloud/
// storage client's Storage#bucket() REQUIRES an explicit bucket name. This is a plain Cloud
// Run container, not a Firebase Function, so there is no admin-app default to fall back on
// -- the bucket name must be supplied as a container env var at deploy time.
const BUCKET_NAME = process.env.STORAGE_BUCKET;

export interface RenderRequest {
  orgId: string;
  importId: string;
  storagePath: string;
}

export interface RenderResult {
  renderedCount: number;
  pageNumbers: number[];
}

// Defense in depth -- mirrors parsePptxHandler's own independent storage-path guard
// (functions/src/index.ts:~205/:168 depending on version). Cloud Run's IAM (--no-allow-
// unauthenticated + roles/run.invoker) already authenticates WHO is allowed to call this
// service; it never validates WHAT payload that caller sends. This regex re-checks the
// payload independently, on the render service's own side, so a compromised or buggy caller
// can never make this service read outside the org's own pptx-imports prefix.
export const PPTX_IMPORT_PATH_GUARD = /^orgs\/[^/]+\/pptx-imports\/[^/]+\//;

export const RENDER_DPI = 150;
export const SOFFICE_TIMEOUT_MS = 180_000;
export const PDFTOPPM_TIMEOUT_MS = 120_000;

// ★ Load-bearing, not cosmetic. The bridging function (37-03/37-04) recounts completeness
// by LISTING the rendered/ prefix in Storage, and Cloud Storage lists objects in lexical
// (string) order. An unpadded name set -- page-1.png, page-2.png, ..., page-10.png -- sorts
// lexically as page-1, page-10, page-11, page-2, page-3, ... which corrupts both the
// recount's implied ordering and any UI that later renders these images in listing order.
// Zero-padding to a fixed width makes the lexical Storage listing order identical to render
// order regardless of locale collation, for any deck up to 9999 slides.
export const RENDERED_PAGE_PAD = 4;

export function renderedPrefix(orgId: string, importId: string): string {
  return `orgs/${orgId}/pptx-imports/${importId}/rendered/`;
}

// ★ Destination naming is derived from the PARSED page number, never from array index or
// filename string -- see pageNumberFromOutputName below and Task 2's lexical-hostile test.
export function renderedObjectName(pageNumber: number): string {
  return `page-${String(pageNumber).padStart(RENDERED_PAGE_PAD, "0")}.png`;
}

// pdftoppm's own output is itself zero-padded to the width of the LAST page (e.g. a 12-page
// deck produces page-01.png .. page-12.png, but a 100-page deck produces page-001.png ..
// page-100.png) -- so this parser must strip leading zeros via a numeric regex capture
// rather than assuming any particular width, and must return null for anything that isn't
// one of pdftoppm's own page files (e.g. the source.pptx/source.pdf inputs sitting in the
// same working directory).
export function pageNumberFromOutputName(name: string): number | null {
  const match = /^page-0*(\d+)\.png$/.exec(name);
  if (!match) return null;
  return Number.parseInt(match[1], 10);
}

export async function renderPptxToImages(req: RenderRequest): Promise<RenderResult> {
  const { orgId, importId, storagePath } = req;

  // Independent path guard -- see PPTX_IMPORT_PATH_GUARD comment above. Both checks are kept
  // (prefix startsWith AND full regex) to mirror the exact double-check shape already
  // established in functions/src/index.ts, rather than collapsing to a single test.
  if (
    !storagePath.startsWith(`orgs/${orgId}/pptx-imports/`) ||
    !PPTX_IMPORT_PATH_GUARD.test(storagePath)
  ) {
    throw new Error(
      `storagePath "${storagePath}" is outside caller org "${orgId}"'s pptx-imports prefix`,
    );
  }

  if (!BUCKET_NAME) {
    throw new Error("STORAGE_BUCKET environment variable is required");
  }
  const bucket = storage.bucket(BUCKET_NAME);
  const workDir = await mkdtemp(path.join(os.tmpdir(), "pptx-"));
  // Per-request-unique profile directory INSIDE the request's own working directory.
  // LibreOffice's own lock file makes a shared/reused UserInstallation profile unreliable
  // under concurrency (37-RESEARCH.md Pitfall 3) -- a fresh mkdtemp per request sidesteps
  // that class of failure entirely, independent of Cloud Run's own --concurrency setting.
  const profileDir = path.join(workDir, "lo-profile");
  const pptxPath = path.join(workDir, "source.pptx");

  try {
    await bucket.file(storagePath).download({ destination: pptxPath });

    // Step 1: PPTX -> PDF. Explicit timeout bounds the DoS blast radius of an adversarial
    // or pathological .pptx (zip bomb, deeply nested embeds -- 37-RESEARCH.md Pitfall 5).
    await run(
      "soffice",
      [
        "--headless",
        "--norestore",
        "--nolockcheck",
        "--nodefault",
        `-env:UserInstallation=file://${profileDir}`,
        "--convert-to",
        "pdf",
        "--outdir",
        workDir,
        pptxPath,
      ],
      { timeout: SOFFICE_TIMEOUT_MS },
    );

    const pdfPath = path.join(workDir, "source.pdf");
    const pagePrefix = path.join(workDir, "page");

    // Step 2: PDF -> per-page PNG. Poppler's own documented default DPI baseline; also
    // timeout-bounded for the same DoS reason as soffice above.
    await run(
      "pdftoppm",
      ["-png", "-r", String(RENDER_DPI), pdfPath, pagePrefix],
      { timeout: PDFTOPPM_TIMEOUT_MS },
    );

    const entries = await readdir(workDir);
    const pages = entries
      .map((name) => ({ name, pageNumber: pageNumberFromOutputName(name) }))
      .filter(
        (entry): entry is { name: string; pageNumber: number } => entry.pageNumber !== null,
      )
      // ★ Numeric ascending sort by PARSED page number -- never Array.prototype.sort() on
      // the raw filename string, and never the array index. This is the ordering guarantee
      // Task 2's lexical-hostile 12-page test pins.
      .sort((a, b) => a.pageNumber - b.pageNumber);

    // A zero-page render must never look like a successful render of zero pages -- the
    // bridging function's completeness check would otherwise see renderedCount === 0 ===
    // uploaded.length and incorrectly flip the deck to "ready".
    if (pages.length === 0) {
      throw new Error("render produced no pages");
    }

    const destPrefix = renderedPrefix(orgId, importId);
    await Promise.all(
      pages.map(({ name, pageNumber }) =>
        bucket.upload(path.join(workDir, name), {
          destination: destPrefix + renderedObjectName(pageNumber),
          metadata: { metadata: { createdAt: new Date().toISOString() } },
        }),
      ),
    );

    return {
      renderedCount: pages.length,
      pageNumbers: pages.map((p) => p.pageNumber),
    };
  } finally {
    // This rm targets ONLY the process-local mkdtemp working directory created above -- a
    // temp filesystem path, never a Storage object. No Storage delete call exists anywhere
    // in render-service/.
    await rm(workDir, { recursive: true, force: true });
  }
}
