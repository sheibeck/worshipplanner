import type { Timestamp } from 'firebase/firestore'

/** A single section of song lyrics (e.g. Verse 1, Chorus). */
export interface LyricSection {
  /** Slugified label — e.g. 'verse-1', 'chorus'. */
  id: string
  /** Human-readable label — e.g. 'Verse 1', 'Chorus'. */
  label: string
  /** Lyric lines for this section. */
  lines: string[]
}

/** CCLI copyright metadata extracted from a SongSelect paste. */
export interface CopyrightInfo {
  title: string
  authors: string[]
  ccliSongNumber: string
  copyrightLines: string[]
  ccliLicenseNumber: string
}

/**
 * A stored lyrics document — lives in the Firestore subcollection
 * organizations/{orgId}/songs/{songId}/lyrics.
 */
export interface SongLyrics {
  id: string
  songId: string
  sections: LyricSection[]
  copyright: CopyrightInfo
  /** Ordered list of section IDs defining the playback sequence. */
  performanceOrder: string[]
  createdAt: Timestamp
  updatedAt: Timestamp
}

/** Output of the CCLI paste parser — no Firestore metadata. */
export interface ParsedCCLI {
  title: string
  sections: LyricSection[]
  copyright: CopyrightInfo
}
