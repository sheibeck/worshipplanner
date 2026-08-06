import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import path from "node:path";

// ★ execFile is mocked so the real soffice/pdftoppm binaries are NEVER invoked -- this suite
// runs on a machine with neither LibreOffice nor Poppler installed, and no test performs a
// network call, builds a container, or contacts GCP.
//
// vi.hoisted is required (not a plain top-level const) because render.ts calls `new Storage()`
// at MODULE SCOPE -- evaluated the moment it is imported, before any beforeEach runs -- so the
// mock factories below must already be able to close over these mocks at that same hoisted time.
const { execFileMock, mkdtempMock, readdirMock, rmMock, downloadMock, uploadMock, fileMock, bucketMock } =
  vi.hoisted(() => {
    const execFileMock = vi.fn(
      (
        _cmd: string,
        _args: string[],
        _opts: unknown,
        callback: (err: Error | null, result: { stdout: string; stderr: string }) => void,
      ) => {
        callback(null, { stdout: "", stderr: "" });
      },
    );
    const mkdtempMock = vi.fn();
    const readdirMock = vi.fn();
    const rmMock = vi.fn();
    const downloadMock = vi.fn();
    const uploadMock = vi.fn();
    const fileMock = vi.fn(() => ({ download: downloadMock }));
    const bucketMock = vi.fn(() => ({ file: fileMock, upload: uploadMock }));
    return {
      execFileMock,
      mkdtempMock,
      readdirMock,
      rmMock,
      downloadMock,
      uploadMock,
      fileMock,
      bucketMock,
    };
  });

vi.mock("node:child_process", () => ({
  execFile: (...args: unknown[]) =>
    (execFileMock as unknown as (...a: unknown[]) => void)(...args),
}));

vi.mock("node:fs/promises", () => ({
  mkdtemp: (...args: unknown[]) => mkdtempMock(...args),
  readdir: (...args: unknown[]) => readdirMock(...args),
  rm: (...args: unknown[]) => rmMock(...args),
}));

vi.mock("@google-cloud/storage", () => ({
  Storage: vi.fn().mockImplementation(function StorageMock(this: { bucket: typeof bucketMock }) {
    this.bucket = bucketMock;
  }),
}));

// Imported AFTER the vi.mock calls above so render.ts picks up the mocked modules.
import {
  renderPptxToImages,
  renderedObjectName,
  renderedPrefix,
  pageNumberFromOutputName,
  PPTX_IMPORT_PATH_GUARD,
  RENDERED_PAGE_PAD,
} from "./render";

const WORK_DIR = "/tmp/pptx-fake";

function fakeReq(overrides: Partial<{ orgId: string; importId: string; storagePath: string }> = {}) {
  return {
    orgId: "orgA",
    importId: "import1",
    storagePath: "orgs/orgA/pptx-imports/import1/source.pptx",
    ...overrides,
  };
}

beforeEach(() => {
  process.env.STORAGE_BUCKET = "test-bucket";
  execFileMock.mockClear();
  execFileMock.mockImplementation(
    (
      _cmd: string,
      _args: string[],
      _opts: unknown,
      callback: (err: Error | null, result: { stdout: string; stderr: string }) => void,
    ) => {
      callback(null, { stdout: "", stderr: "" });
    },
  );
  mkdtempMock.mockReset().mockResolvedValue(WORK_DIR);
  readdirMock.mockReset().mockResolvedValue(["page-1.png"]);
  rmMock.mockReset().mockResolvedValue(undefined);
  downloadMock.mockReset().mockResolvedValue(undefined);
  uploadMock.mockReset().mockResolvedValue(undefined);
  fileMock.mockReset().mockReturnValue({ download: downloadMock });
  bucketMock.mockReset().mockReturnValue({ file: fileMock, upload: uploadMock });
});

afterEach(() => {
  delete process.env.STORAGE_BUCKET;
});

describe("PPTX_IMPORT_PATH_GUARD (path guard, Cloud Run IAM authenticates WHO, this guards WHAT)", () => {
  it("case 1: rejects a storagePath outside the pptx-imports prefix, and never calls execFile", async () => {
    await expect(
      renderPptxToImages(fakeReq({ storagePath: "orgs/orgA/media/x.pptx" })),
    ).rejects.toThrow();
    expect(execFileMock).not.toHaveBeenCalled();
  });

  it("case 2: rejects a cross-org storagePath (claimed orgId does not match the path's org), and never calls execFile", async () => {
    await expect(
      renderPptxToImages(
        fakeReq({ orgId: "orgA", storagePath: "orgs/orgB/pptx-imports/i1/source.pptx" }),
      ),
    ).rejects.toThrow();
    expect(execFileMock).not.toHaveBeenCalled();
  });
});

describe("soffice/pdftoppm argv (execFile mocked -- real binaries never invoked)", () => {
  it("case 3: first execFile call is soffice, with the expected flags, a per-request UserInstallation path inside the working dir, and an explicit timeout", async () => {
    await renderPptxToImages(fakeReq());

    expect(execFileMock).toHaveBeenCalled();
    const [cmd, args, opts] = execFileMock.mock.calls[0];
    expect(cmd).toBe("soffice");
    expect(args).toEqual(
      expect.arrayContaining(["--headless", "--convert-to", "pdf", "--outdir", WORK_DIR]),
    );
    const userInstallArg = (args as string[]).find((a) => a.startsWith("-env:UserInstallation=file://"));
    expect(userInstallArg).toBeDefined();
    expect(userInstallArg as string).toContain("lo-profile");
    expect(opts).toMatchObject({ timeout: 180_000 });
  });

  it("case 4: second execFile call is pdftoppm, with -png -r 150, the source.pdf path, and a page-prefix inside the working dir, with an explicit timeout", async () => {
    await renderPptxToImages(fakeReq());

    expect(execFileMock.mock.calls.length).toBeGreaterThanOrEqual(2);
    const [cmd, args, opts] = execFileMock.mock.calls[1];
    expect(cmd).toBe("pdftoppm");
    expect(args).toEqual(
      expect.arrayContaining(["-png", "-r", "150", path.join(WORK_DIR, "source.pdf")]),
    );
    expect((args as string[])[0]).toBe("-png");
    expect((args as string[]).some((a) => a.includes("page"))).toBe(true);
    expect(opts).toMatchObject({ timeout: 120_000 });
  });

  it("real soffice/pdftoppm are never actually invoked -- every child-process call went through the mock, exactly twice", async () => {
    await renderPptxToImages(fakeReq());
    expect(execFileMock).toHaveBeenCalledTimes(2);
  });
});

describe("page ordering (★ the load-bearing guarantee)", () => {
  it("case 5: lexically-hostile 12-page input uploads in ascending numeric page order with 4-digit zero-padded destinations", async () => {
    readdirMock.mockResolvedValue([
      "page-10.png",
      "page-2.png",
      "page-1.png",
      "page-11.png",
      "page-12.png",
      "page-3.png",
      "page-4.png",
      "page-5.png",
      "page-6.png",
      "page-7.png",
      "page-8.png",
      "page-9.png",
    ]);

    const result = await renderPptxToImages(fakeReq());

    const destinations = uploadMock.mock.calls.map((call) => call[1].destination as string);
    const expected = Array.from({ length: 12 }, (_, i) => `page-${String(i + 1).padStart(4, "0")}.png`).map(
      (name) => renderedPrefix("orgA", "import1") + name,
    );
    expect(destinations).toEqual(expected);

    // Specifically pin: the upload sourced from page-2.png lands at page-0002.png, NOT
    // page-0010.png (the lexical-sort bug the research sketch had).
    const page2Call = uploadMock.mock.calls.find((call) => (call[0] as string).endsWith("page-2.png"));
    expect(page2Call).toBeDefined();
    expect(page2Call![1].destination).toBe(renderedPrefix("orgA", "import1") + "page-0002.png");

    expect(result.renderedCount).toBe(12);
    expect(result.pageNumbers).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it("case 6: pdftoppm's OWN zero-padded output (page-01.png..page-12.png) produces the identical 12 destinations, proving pageNumberFromOutputName strips leading zeros", async () => {
    readdirMock.mockResolvedValue(
      Array.from({ length: 12 }, (_, i) => `page-${String(i + 1).padStart(2, "0")}.png`),
    );

    await renderPptxToImages(fakeReq());

    const destinations = uploadMock.mock.calls.map((call) => call[1].destination as string);
    const expected = Array.from({ length: 12 }, (_, i) => `page-${String(i + 1).padStart(4, "0")}.png`).map(
      (name) => renderedPrefix("orgA", "import1") + name,
    );
    expect(destinations).toEqual(expected);
  });

  it("case 7: non-page files in the working directory are ignored -- exactly one upload for one real page file", async () => {
    readdirMock.mockResolvedValue(["source.pptx", "source.pdf", "page-1.png"]);

    const result = await renderPptxToImages(fakeReq());

    expect(uploadMock).toHaveBeenCalledTimes(1);
    expect(uploadMock.mock.calls[0][1].destination).toBe(
      renderedPrefix("orgA", "import1") + "page-0001.png",
    );
    expect(result.renderedCount).toBe(1);
  });

  it("case 8: a zero-page render throws rather than reporting success, and upload is never called", async () => {
    readdirMock.mockResolvedValue(["source.pptx", "source.pdf"]);

    await expect(renderPptxToImages(fakeReq())).rejects.toThrow();
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it("case 9: every destination sits under orgs/{orgId}/pptx-imports/{importId}/rendered/, never images/ or source.pptx", async () => {
    readdirMock.mockResolvedValue(["page-1.png", "page-2.png"]);

    await renderPptxToImages(fakeReq());

    for (const call of uploadMock.mock.calls) {
      const destination = call[1].destination as string;
      expect(destination.startsWith("orgs/orgA/pptx-imports/import1/rendered/")).toBe(true);
      expect(destination).not.toContain("images/");
      expect(destination).not.toBe("source.pptx");
    }
  });
});

describe("temp cleanup and return shape", () => {
  it("case 10: when soffice rejects, renderPptxToImages rejects AND rm is still called with the working directory (finally runs)", async () => {
    execFileMock.mockImplementationOnce(
      (
        _cmd: string,
        _args: string[],
        _opts: unknown,
        callback: (err: Error | null, result: { stdout: string; stderr: string }) => void,
      ) => {
        callback(new Error("soffice exploded"), { stdout: "", stderr: "" });
      },
    );

    await expect(renderPptxToImages(fakeReq())).rejects.toThrow();
    expect(rmMock).toHaveBeenCalledWith(WORK_DIR, expect.objectContaining({ recursive: true, force: true }));
  });

  it("case 11: return shape -- renderedCount equals the number of page files and pageNumbers is the ascending page list", async () => {
    readdirMock.mockResolvedValue(["page-3.png", "page-1.png", "page-2.png"]);

    const result = await renderPptxToImages(fakeReq());

    expect(result.renderedCount).toBe(3);
    expect(result.pageNumbers).toEqual([1, 2, 3]);
  });
});

describe("renderedObjectName / pageNumberFromOutputName units", () => {
  it("renderedObjectName zero-pads to RENDERED_PAGE_PAD digits", () => {
    expect(RENDERED_PAGE_PAD).toBe(4);
    expect(renderedObjectName(2)).toBe("page-0002.png");
    expect(renderedObjectName(10)).toBe("page-0010.png");
  });

  it("pageNumberFromOutputName parses both narrow and wide zero-padded names to the same integer", () => {
    expect(pageNumberFromOutputName("page-2.png")).toBe(2);
    expect(pageNumberFromOutputName("page-02.png")).toBe(2);
    expect(pageNumberFromOutputName("page-0002.png")).toBe(2);
    expect(pageNumberFromOutputName("source.pptx")).toBeNull();
    expect(pageNumberFromOutputName("source.pdf")).toBeNull();
  });

  it("PPTX_IMPORT_PATH_GUARD matches a well-formed pptx-imports path and rejects a media path", () => {
    expect(PPTX_IMPORT_PATH_GUARD.test("orgs/orgA/pptx-imports/i1/source.pptx")).toBe(true);
    expect(PPTX_IMPORT_PATH_GUARD.test("orgs/orgA/media/i1/source.pptx")).toBe(false);
  });
});
