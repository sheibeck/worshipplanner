import { describe, expect, it, vi } from "vitest";
import { mapAstToSlides, TEXT_DOMINANT_THRESHOLD, type MappedSlide } from "./pptxParser";

describe("mapAstToSlides", () => {
  it("maps a text-dominant slide to one TextSlide with title from the first heading", async () => {
    const longBody =
      "Choose one approach to grab the audience's attention: unexpected, emotional, or simple.";
    expect(longBody.length).toBeGreaterThan(TEXT_DOMINANT_THRESHOLD);

    const ast = {
      content: [
        {
          type: "slide",
          children: [
            { type: "heading", text: "Selling your idea" },
            { type: "paragraph", text: longBody },
          ],
        },
      ],
    };

    const resolver = vi.fn();
    const slides = await mapAstToSlides(ast, resolver);

    expect(slides).toEqual<MappedSlide[]>([
      {
        contentKind: "text",
        title: "Selling your idea",
        body: `Selling your idea\n${longBody}`,
      },
    ]);
    expect(resolver).not.toHaveBeenCalled();
  });

  it("maps an image-only slide to one ImageSlide per image, in order", async () => {
    const ast = {
      content: [
        {
          type: "slide",
          children: [
            { type: "image", text: "", metadata: { attachmentName: "image1.png", altText: "Logo" } },
            { type: "image", text: "", metadata: { attachmentName: "image2.jpg" } },
          ],
        },
      ],
    };

    const resolver = vi
      .fn()
      .mockImplementation((attachmentName: string, index: number) => `stub-path-${index}-${attachmentName}`);

    const slides = await mapAstToSlides(ast, resolver);

    expect(slides).toEqual<MappedSlide[]>([
      { contentKind: "image", imageUrl: "stub-path-0-image1.png", altText: "Logo" },
      { contentKind: "image", imageUrl: "stub-path-1-image2.jpg" },
    ]);
    expect(resolver).toHaveBeenNthCalledWith(1, "image1.png", 0);
    expect(resolver).toHaveBeenNthCalledWith(2, "image2.jpg", 1);
  });

  it("picks the dominant text content on a mixed text+image slide, dropping the image", async () => {
    const longBody =
      "This slide has a background image but also a long paragraph of real body content that clearly exceeds the threshold.";
    expect(longBody.length).toBeGreaterThan(TEXT_DOMINANT_THRESHOLD);

    const ast = {
      content: [
        {
          type: "slide",
          children: [
            { type: "paragraph", text: longBody },
            { type: "image", text: "", metadata: { attachmentName: "background.png" } },
          ],
        },
      ],
    };

    const resolver = vi.fn();
    const slides = await mapAstToSlides(ast, resolver);

    expect(slides).toEqual<MappedSlide[]>([{ contentKind: "text", body: longBody }]);
    expect(resolver).not.toHaveBeenCalled();
  });

  it("skips a slide with neither substantial text nor images", async () => {
    const ast = {
      content: [
        {
          type: "slide",
          children: [{ type: "paragraph", text: "Hi" }],
        },
      ],
    };

    const resolver = vi.fn();
    const slides = await mapAstToSlides(ast, resolver);

    expect(slides).toEqual([]);
    expect(resolver).not.toHaveBeenCalled();
  });

  it("preserves AST slide order across a mixed deck (text, image, mixed, empty)", async () => {
    const longBody = "A".repeat(TEXT_DOMINANT_THRESHOLD + 1);

    const ast = {
      content: [
        { type: "slide", children: [{ type: "paragraph", text: longBody }] },
        {
          type: "slide",
          children: [{ type: "image", text: "", metadata: { attachmentName: "only.png" } }],
        },
        {
          type: "slide",
          children: [
            { type: "paragraph", text: longBody },
            { type: "image", text: "", metadata: { attachmentName: "dropped.png" } },
          ],
        },
        { type: "slide", children: [] },
      ],
    };

    const resolver = vi.fn().mockImplementation((name: string) => `path/${name}`);
    const slides = await mapAstToSlides(ast, resolver);

    expect(slides).toEqual<MappedSlide[]>([
      { contentKind: "text", body: longBody },
      { contentKind: "image", imageUrl: "path/only.png" },
      { contentKind: "text", body: longBody },
    ]);
  });
});
