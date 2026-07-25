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

export interface MappedTextSlide {
  contentKind: "text";
  title?: string;
  body: string;
}

export interface MappedImageSlide {
  contentKind: "image";
  imageUrl: string;
  altText?: string;
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
 */
export async function mapAstToSlides(
  ast: MinimalOfficeAst,
  resolveImagePath: ImagePathResolver,
): Promise<MappedSlide[]> {
  const result: MappedSlide[] = [];
  let imageSequenceIndex = 0;

  for (const slideNode of ast.content ?? []) {
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
          ...(altText ? { altText } : {}),
        };
        result.push(imageSlide);
      }
      continue;
    }

    // Neither substantial text nor images -- skip this slide entirely.
  }

  return result;
}
