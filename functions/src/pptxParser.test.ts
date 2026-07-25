import { readFileSync } from "fs";
import { join } from "path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getStorage } from "firebase-admin/storage";
import { parseOffice } from "officeparser";
import {
  mapAstToSlides,
  parsePptxBuffer,
  PptxParseError,
  TEXT_DOMINANT_THRESHOLD,
  type MappedSlide,
} from "./pptxParser";

// firebase-admin/storage is mocked for parsePptxBuffer's Storage upload calls --
// these tests must never touch the running emulator or a real bucket.
vi.mock("firebase-admin/storage", () => ({
  getStorage: vi.fn(),
}));

// officeparser's real parseOffice is preserved by default (the fixture-based
// tests below exercise it for real against mixed.pptx/corrupted.pptx/
// not-a-pptx.txt); one test overrides it with mockResolvedValueOnce to
// deterministically exercise the image-upload path without depending on a
// real deck happening to produce an ImageSlide.
vi.mock("officeparser", async (importOriginal) => {
  const actual = await importOriginal<typeof import("officeparser")>();
  return { ...actual, parseOffice: vi.fn(actual.parseOffice) };
});

const FIXTURES_DIR = join(__dirname, "__fixtures__");
const ORG_ID = "org123";
const IMPORT_ID = "import456";

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

describe("parsePptxBuffer", () => {
  const saveMock = vi.fn(async (_path: string, _buffer: Buffer, _options: unknown) => undefined);

  function fileMock(path: string) {
    return {
      save: (buffer: Buffer, options: unknown) => saveMock(path, buffer, options),
      // Deliberately no delete()/deleteObject() -- if parsePptxBuffer ever calls
      // one, this throws, proving the never-delete-on-failure/success contract.
    };
  }

  afterEach(() => {
    saveMock.mockClear();
    vi.mocked(getStorage).mockReset();
    vi.mocked(parseOffice).mockClear();
  });

  it("rejects a buffer lacking the ZIP signature before invoking officeparser", async () => {
    const buffer = Buffer.from("This is not a valid ZIP or PPTX file at all.");
    vi.mocked(getStorage).mockReturnValue({ bucket: () => ({ file: fileMock }) } as never);

    await expect(parsePptxBuffer(buffer, ORG_ID, IMPORT_ID)).rejects.toBeInstanceOf(PptxParseError);
    expect(saveMock).not.toHaveBeenCalled();
  });

  it("rejects the corrupted.pptx fixture (zip-signature check) without ever calling save/delete", async () => {
    const buffer = readFileSync(join(FIXTURES_DIR, "corrupted.pptx"));
    vi.mocked(getStorage).mockReturnValue({ bucket: () => ({ file: fileMock }) } as never);

    await expect(parsePptxBuffer(buffer, ORG_ID, IMPORT_ID)).rejects.toBeInstanceOf(PptxParseError);
    expect(saveMock).not.toHaveBeenCalled();
  });

  it("rejects the not-a-pptx.txt fixture without ever calling save/delete", async () => {
    const buffer = readFileSync(join(FIXTURES_DIR, "not-a-pptx.txt"));
    vi.mocked(getStorage).mockReturnValue({ bucket: () => ({ file: fileMock }) } as never);

    await expect(parsePptxBuffer(buffer, ORG_ID, IMPORT_ID)).rejects.toBeInstanceOf(PptxParseError);
    expect(saveMock).not.toHaveBeenCalled();
  });

  it("parses the real mixed.pptx fixture and returns a non-empty array of mapped (text) slides", async () => {
    const buffer = readFileSync(join(FIXTURES_DIR, "mixed.pptx"));
    vi.mocked(getStorage).mockReturnValue({ bucket: () => ({ file: fileMock }) } as never);

    const slides = await parsePptxBuffer(buffer, ORG_ID, IMPORT_ID);

    // Every image in this real deck is paired with substantial body text on the
    // same slide, so the text-dominant heuristic correctly wins throughout --
    // the image-upload path itself is exercised deterministically below via a
    // mocked officeparser AST, since this specific fixture never emits an
    // ImageSlide. What matters here is real end-to-end extraction succeeding.
    expect(slides.length).toBeGreaterThan(0);
    expect(slides.every((slide) => slide.contentKind === "text")).toBe(true);
    expect(saveMock).not.toHaveBeenCalled();
  });

  it("uploads an extracted image to org-scoped Storage with createdAt metadata and returns a Storage-path imageUrl (not a signed URL)", async () => {
    const fakeAst = {
      type: "pptx",
      config: {},
      metadata: {},
      content: [
        {
          type: "slide",
          children: [
            {
              type: "image",
              text: "",
              metadata: { attachmentName: "pic1.png", altText: "A short caption" },
            },
          ],
        },
      ],
      attachments: [
        {
          type: "image",
          mimeType: "image/png",
          data: Buffer.from("fake-image-bytes").toString("base64"),
          name: "pic1.png",
          extension: "png",
        },
      ],
    } as unknown as Awaited<ReturnType<typeof parseOffice>>;

    vi.mocked(parseOffice).mockResolvedValueOnce(fakeAst);
    vi.mocked(getStorage).mockReturnValue({ bucket: () => ({ file: fileMock }) } as never);

    // A minimal valid ZIP local-file-header signature is enough to pass the
    // magic-byte gate; officeparser itself is mocked above so its real
    // decompression never runs against this placeholder buffer.
    const buffer = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(8)]);

    const slides = await parsePptxBuffer(buffer, ORG_ID, IMPORT_ID);
    const expectedPath = `orgs/${ORG_ID}/pptx-imports/${IMPORT_ID}/images/0.png`;

    expect(slides).toEqual<MappedSlide[]>([
      { contentKind: "image", imageUrl: expectedPath, altText: "A short caption" },
    ]);

    expect(saveMock).toHaveBeenCalledTimes(1);
    const [savedPath, savedBuffer, savedOptions] = saveMock.mock.calls[0] as [
      string,
      Buffer,
      { contentType?: string; metadata?: { metadata?: { createdAt?: string } } },
    ];
    expect(savedPath).toBe(expectedPath);
    expect(savedBuffer.toString()).toBe("fake-image-bytes");
    expect(savedOptions.contentType).toBe("image/png");
    expect(savedOptions.metadata?.metadata?.createdAt).toEqual(expect.any(String));
  });
});
