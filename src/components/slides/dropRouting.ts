/**
 * Pure module partitioning a native drop's raw `File[]` into the four
 * accepted kinds (PPTX deck, image, video, audio) plus a rejected bucket
 * (25-07 Task 2, R018/R032).
 *
 * A native HTML5 drop delivers raw `File` objects with NO filtering
 * whatsoever — the file input's `accept` attribute never runs on this path.
 * This module IS the filter, not a convenience: every drop (the tile's and
 * the whole-grid container's) must route through `resolveDrop` before any
 * upload begins.
 *
 * A PPTX is classified by its file-NAME extension rather than its MIME type
 * — an OS drag often supplies an empty or generic MIME type for `.pptx`
 * (verified: `application/octet-stream`, or `''`), so MIME-sniffing alone
 * would misclassify it as rejected. Images/video/audio are classified by
 * MIME prefix, using the SAME prefixes `useMediaUpload` validates against
 * (`audio/*`, `video/*`) so this module and that composable's own
 * server-mirroring validation can never disagree.
 */

const PPTX_EXTENSION_RE = /\.pptx$/i

function isPptxFile(file: File): boolean {
  return PPTX_EXTENSION_RE.test(file.name)
}

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

/**
 * Applies the documented resolution order for a multi-kind drop (25-07 Task
 * 2, D-14 discretion): the first audio file becomes the group's music; every
 * video file appends a slide, in drop order; for the two modal-backed kinds,
 * a PPTX takes precedence and the first one is imported, otherwise every
 * image is imported as one deck. Anything left over — extra audio files,
 * images skipped because a PPTX won, and anything unsupported — is
 * collected into `skipped` so the caller can report it rather than silently
 * drop it.
 */
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
