/**
 * PPTX -> native slide mapping (Phase 21, R010/R011/R012).
 *
 * `functions/` is a standalone TypeScript project (its own tsconfig, cannot import
 * from `src/`), so the slide shapes below are hand-mirrored from the app's canonical
 * types rather than imported. Keep field names identical to:
 *   src/types/slide.ts -> TextSlide { contentKind: 'text', title?, body }
 *   src/types/slide.ts -> ImageSlide { contentKind: 'image', imageUrl, altText? }
 * If those app-side shapes change, update MappedTextSlide/MappedImageSlide here too.
 */

import { getStorage } from "firebase-admin/storage";
import { parseOffice } from "officeparser";

export interface MappedTextSlide {
  contentKind: "text";
  title?: string;
  body: string;
  /**
   * 1-based index of the source PPTX slide this text was extracted from
   * (position within `ast.content`, counting skipped/empty slides). The
   * render service renders one page per source slide in the same order, so
   * this index IS the slide's rendered page number -- see the
   * source-slide-index = rendered-page-number contract documented on
   * `mapAstToSlides` below.
   */
  sourcePage: number;
}

export interface MappedImageSlide {
  contentKind: "image";
  imageUrl: string;
  altText?: string;
  /**
   * 1-based index of the source PPTX slide this image was extracted from.
   * A multi-image slide emits multiple MappedImageSlides that all share the
   * same sourcePage. See MappedTextSlide.sourcePage for the render-page
   * contract this relies on.
   */
  sourcePage: number;
}

export type MappedSlide = MappedTextSlide | MappedImageSlide;

/**
 * Mixed-content heuristic threshold (21-RESEARCH.md Pitfall 4 / Open Question 1):
 * a slide's flattened non-image text must exceed this many characters to be
 * treated as "text-dominant" and win over any images on the same slide. Chosen
 * against the real mixed.pptx fixture deck (21-03): short image captions/alt
 * text and single-line titles observed there run well under 40 characters,
 * while genuine body/bullet content reliably exceeds it. Below this threshold,
 * a slide with image children maps to image slide(s) instead; the import
 * preview (21-05) is the user's manual escape hatch for any mis-mapped slide.
 */
export const TEXT_DOMINANT_THRESHOLD = 40;

/**
 * Resolves the eventual Storage path for one extracted image, given the
 * officeparser attachment name that the image node refers to and its 0-based
 * sequence position among all images mapped so far in the deck. May be async
 * (the real implementation in parsePptxBuffer uploads the decoded image to
 * Storage before returning the path) or sync (unit tests use a deterministic
 * stub). This is the only "I/O-shaped" seam in mapAstToSlides -- the function
 * itself never calls officeparser or Storage directly.
 */
export type ImagePathResolver = (
  attachmentName: string,
  sequenceIndex: number,
) => string | Promise<string>;

/** Minimal, structurally-compatible view of an officeparser content node. */
interface MinimalSlideChild {
  type?: string;
  text?: string;
  children?: MinimalSlideChild[];
  metadata?: {
    attachmentName?: string;
    altText?: string;
  };
}

/** Minimal, structurally-compatible view of an officeparser AST. */
interface MinimalOfficeAst {
  content: MinimalSlideChild[];
}

/**
 * Pure mapping from an officeparser AST to an ordered array of native
 * (text | image) slide objects, using the mixed-content heuristic documented
 * above. No officeparser or Storage calls happen in this function; all image
 * path resolution (including any upload) is delegated to `resolveImagePath`.
 *
 * Heuristic (per slide, in AST order):
 *   1. Flatten all non-image children's text (trimmed, joined by newline).
 *   2. If that flattened text exceeds TEXT_DOMINANT_THRESHOLD chars, emit one
 *      TextSlide (title = first heading child's text, if any; body = the full
 *      flattened text).
 *   3. Else if the slide has one or more image children, emit one ImageSlide
 *      per image, in order, via resolveImagePath.
 *   4. Else (no substantial text, no images) skip the slide entirely.
 *
 * Source-slide-index = rendered-page-number contract (R108): every emitted
 * slide carries `sourcePage`, the 1-based index of the `ast.content` node it
 * came from -- incremented per source slide BEFORE any skip, so a skipped
 * (empty) slide still consumes a page number and the next emitted slide's
 * sourcePage reflects its true position in the original deck. The render
 * service (functions/src/... render pipeline, see src/utils/renderedPagePaths.ts)
 * renders one page per source .pptx slide in the same order, from the same
 * file, so this index IS the slide's rendered page number. A multi-image
 * slide's several MappedImageSlides all share that one sourcePage.
 */
export async function mapAstToSlides(
  ast: MinimalOfficeAst,
  resolveImagePath: ImagePathResolver,
): Promise<MappedSlide[]> {
  const result: MappedSlide[] = [];
  let imageSequenceIndex = 0;
  let sourcePage = 0;

  for (const slideNode of ast.content ?? []) {
    sourcePage += 1;

    const children = slideNode.children ?? [];
    const imageChildren = children.filter((child) => child.type === "image");
    const textChildren = children.filter((child) => child.type !== "image");

    const textParts = textChildren
      .map((child) => (child.text ?? "").trim())
      .filter((text) => text.length > 0);
    const flattenedText = textParts.join("\n");

    if (flattenedText.length > TEXT_DOMINANT_THRESHOLD) {
      const firstHeading = textChildren.find((child) => child.type === "heading");
      const title = firstHeading?.text?.trim();
      const textSlide: MappedTextSlide = {
        contentKind: "text",
        body: flattenedText,
        sourcePage,
        ...(title ? { title } : {}),
      };
      result.push(textSlide);
      continue;
    }

    if (imageChildren.length > 0) {
      for (const imageChild of imageChildren) {
        const attachmentName = imageChild.metadata?.attachmentName ?? `image-${imageSequenceIndex}`;
        const imageUrl = await resolveImagePath(attachmentName, imageSequenceIndex);
        imageSequenceIndex += 1;
        const altText = imageChild.metadata?.altText;
        const imageSlide: MappedImageSlide = {
          contentKind: "image",
          imageUrl,
          sourcePage,
          ...(altText ? { altText } : {}),
        };
        result.push(imageSlide);
      }
      continue;
    }

    // Neither substantial text nor images -- skip this slide entirely.
    // sourcePage was already incremented above, so the next emitted slide's
    // sourcePage correctly reflects this skip.
  }

  return result;
}

/**
 * Thrown when a buffer cannot be parsed as a valid .pptx -- either it fails
 * the leading zip-signature check, or officeparser itself throws while
 * decompressing/parsing. index.ts converts this into a friendly HttpsError.
 * Never thrown or caught in a way that triggers deletion of the source file.
 */
export class PptxParseError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "PptxParseError";
  }
}

/**
 * A .pptx (OOXML) file is a ZIP archive. Every valid ZIP -- local file header,
 * empty archive, or spanned archive -- begins with the two bytes 'P' 'K'
 * (0x50 0x4B). Rejecting anything else here means a renamed/non-pptx file
 * (e.g. corrupted.pptx, not-a-pptx.txt) never reaches officeparser at all.
 */
function hasZipSignature(buffer: Buffer): boolean {
  return buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b;
}

/**
 * Validates, parses, and maps a .pptx buffer into native slides, uploading any
 * extracted images to org-scoped Storage along the way.
 *
 * Never deletes the source object -- this function has no knowledge of the
 * source's Storage path at all, and only ever writes new image objects under
 * orgs/{orgId}/pptx-imports/{importId}/images/. On any failure (bad
 * signature, officeparser throwing), a typed PptxParseError propagates for
 * index.ts to convert into a friendly HttpsError.
 */
export async function parsePptxBuffer(
  buffer: Buffer,
  orgId: string,
  importId: string,
): Promise<MappedSlide[]> {
  if (!hasZipSignature(buffer)) {
    throw new PptxParseError(
      "File is not a valid .pptx (missing ZIP signature) -- it may be corrupted or mis-declared.",
    );
  }

  let ast;
  try {
    // OCR is never enabled -- this phase only needs text/image extraction, and
    // officeparser's OCR path pulls in a heavy tesseract.js dependency for a
    // capability this phase does not use (21-RESEARCH.md Pitfall 3).
    ast = await parseOffice(buffer, {
      extractAttachments: true,
      fileType: "pptx",
      ignoreNotes: true,
    });
  } catch (err) {
    throw new PptxParseError("officeparser failed to parse the .pptx buffer.", { cause: err });
  }

  const attachmentsByName = new Map<string, { data: string; mimeType: string; extension: string }>();
  for (const attachment of ast.attachments ?? []) {
    attachmentsByName.set(attachment.name, {
      data: attachment.data,
      mimeType: attachment.mimeType,
      extension: attachment.extension,
    });
  }

  const bucket = getStorage().bucket();
  let uploadIndex = 0;

  const resolveImagePath: ImagePathResolver = async (attachmentName) => {
    const attachment = attachmentsByName.get(attachmentName);
    const extension = attachment?.extension ?? "png";
    const path = `orgs/${orgId}/pptx-imports/${importId}/images/${uploadIndex}.${extension}`;
    uploadIndex += 1;

    if (attachment) {
      const imageBuffer = Buffer.from(attachment.data, "base64");
      await bucket.file(path).save(imageBuffer, {
        contentType: attachment.mimeType,
        metadata: {
          // Custom metadata (not the GCS-reserved top-level fields) -- Phase
          // 22's retention sweep reads this to age out old imports without a
          // follow-up migration (21-RESEARCH.md Pitfall 5).
          metadata: {
            createdAt: new Date().toISOString(),
          },
        },
      });
    }

    return path;
  };

  // officeparser's real per-node-type metadata unions (SlideMetadata,
  // ImageMetadata, ...) are far more specific than the loose, test-friendly
  // MinimalOfficeAst shape mapAstToSlides accepts; the fields this function
  // actually reads (type/text/children/metadata.attachmentName/altText) are
  // all present on the real AST at runtime, so this narrowing cast is safe.
  return mapAstToSlides(ast as unknown as MinimalOfficeAst, resolveImagePath);
}
