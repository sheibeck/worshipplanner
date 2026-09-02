/** See .planning/codebase/ARCHITECTURE.md (Backend Behavioral Notes (R318) § functions/src/pptxParser.ts) */

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

/** See ADR-0054 (docs/adr/0054-mixed-content-heuristic-threshold-21-research-md-pitfall-4-o.md) */
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
/** See .planning/codebase/INTEGRATIONS.md (Backend Integration Notes (R318) § functions/src/pptxParser.ts) */
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

/** See .planning/codebase/INTEGRATIONS.md (Backend Integration Notes (R318) § functions/src/pptxParser.ts) */
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
    // See ADR-0055 (docs/adr/0055-ocr-is-never-enabled-this-phase-only-needs-text-image-extrac.md)
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
          // See ADR-0025 (docs/adr/0025-custom-metadata-not-the-gcs-reserved-top-level-fields-phase.md)
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
