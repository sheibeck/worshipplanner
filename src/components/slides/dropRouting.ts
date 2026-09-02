// See .planning/codebase/ARCHITECTURE.md (§ Component & Composable Behavioral Notes (R318) -> src/components/slides/dropRouting.ts)

const PPTX_EXTENSION_RE = /\.pptx$/i

function isPptxFile(file: File): boolean {
  return PPTX_EXTENSION_RE.test(file.name)
}

// IN-02 (48-REVIEW): hoisted to module scope — previously allocated fresh
// inside classifyFiles on every call. A drop's file list is small so this was
// never a correctness issue, but the allocation is trivially avoidable since
// the collator's options never vary per call.
const NATURAL_ORDER_COLLATOR = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })

/** The four accepted-kind buckets, plus everything that matched none of them. */
export interface ClassifiedFiles {
  decks: File[]
  images: File[]
  videos: File[]
  audioFiles: File[]
  rejected: File[]
}

/**
 * Classifies every file into exactly one bucket. Order of checks matters:
 * PPTX-by-extension is checked FIRST, before any MIME-prefix check, since a
 * PPTX's MIME type is unreliable.
 */
export function classifyFiles(files: File[]): ClassifiedFiles {
  const decks: File[] = []
  const images: File[] = []
  const videos: File[] = []
  const audioFiles: File[] = []
  const rejected: File[] = []

  for (const file of files) {
    if (isPptxFile(file)) {
      decks.push(file)
    } else if (file.type.startsWith('image/')) {
      images.push(file)
    } else if (file.type.startsWith('video/')) {
      videos.push(file)
    } else if (file.type.startsWith('audio/')) {
      audioFiles.push(file)
    } else {
      rejected.push(file)
    }
  }

  // R098 — natural-order sort so slide2/slide10/slide1 lands as slide1/slide2/slide10,
  // not lexicographic slide1/slide10/slide2. Images only (per D-098): decks/videos/audio
  // stay in drop order. Mutates the same array `resolveDrop` reads via `classified.images`.
  images.sort((a, b) => NATURAL_ORDER_COLLATOR.compare(a.name, b.name))

  return { decks, images, videos, audioFiles, rejected }
}

/** What a resolved multi-kind drop should actually DO, plus what it left over. */
export interface ResolvedDrop {
  /** The one PPTX to import via the modal, or null. Takes precedence over `images` below. */
  deck: File | null
  /** Images to import as one deck via the modal — populated only when no PPTX won. */
  images: File[]
  /** Every video file, to append as its own slide, in drop order. */
  videos: File[]
  /** The one audio file to become the group's music bed, or null. */
  audio: File | null
  /**
   * Everything not acted on this drop: extra decks/audio beyond the first,
   * images skipped because a PPTX won, and anything classified as rejected.
   * Reported in the inline notice rather than silently dropped (R018).
   */
  skipped: File[]
}

/** The UI-SPEC's rejected-file copy, verbatim (Copywriting Contract). */
export const UNSUPPORTED_FILE_MESSAGE = 'Unsupported file — drop a PPTX, image, video, or audio file.'

// See .planning/codebase/ARCHITECTURE.md (§ Component & Composable Behavioral Notes (R318) -> src/components/slides/dropRouting.ts, "resolveDrop")
export function resolveDrop(files: File[]): ResolvedDrop {
  const classified = classifyFiles(files)

  const deck = classified.decks[0] ?? null
  const extraDecks = classified.decks.slice(1)

  const images = deck ? [] : classified.images
  const skippedImages = deck ? classified.images : []

  const audio = classified.audioFiles[0] ?? null
  const extraAudio = classified.audioFiles.slice(1)

  return {
    deck,
    images,
    videos: classified.videos,
    audio,
    skipped: [...extraDecks, ...skippedImages, ...extraAudio, ...classified.rejected],
  }
}
