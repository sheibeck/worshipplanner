import { Timestamp } from 'firebase/firestore'
import type { SongAttachment, SongAttachmentLinkSource } from '@/types/song'

/** R365 — external media link validation + source inference for song attachments.
 * See .planning/phases/121-song-files-ui-design-spec/121-UI-SPEC.md §4 for the
 * authoritative copy/interaction contract this implements. */

/** True only for a parseable https:// URL — rejects http, javascript:, data:,
 * and unparseable input. This is the client half of the UI-SPEC's link-field
 * error copy ("Enter a valid link (starting with https://)."). */
export function isValidExternalLink(raw: string): boolean {
  const trimmed = raw.trim()
  if (!trimmed) return false
  try {
    const url = new URL(trimmed)
    return url.protocol === 'https:'
  } catch {
    return false
  }
}

/** Maps a link's host to the source badge shown in the attachment list. */
export function inferLinkSource(raw: string): SongAttachmentLinkSource {
  try {
    const host = new URL(raw.trim()).host.toLowerCase()
    if (host === 'youtube.com' || host === 'www.youtube.com' || host === 'm.youtube.com' || host === 'youtu.be') {
      return 'youtube'
    }
    if (host === 'drive.google.com' || host === 'docs.google.com') {
      return 'drive'
    }
    if (host === 'dropbox.com' || host === 'www.dropbox.com') {
      return 'dropbox'
    }
    return 'other'
  } catch {
    return 'other'
  }
}

/** Builds a kind:'link' SongAttachment — no storagePath/downloadUrl/mimeType/
 * sizeBytes keys (those are upload-only; Firestore rejects `undefined` values,
 * so link attachments omit the keys entirely rather than setting them undefined). */
export function buildLinkAttachment(params: { href: string; name?: string; createdBy: string }): SongAttachment {
  const trimmedName = params.name?.trim()
  const fallbackName = (() => {
    try {
      return new URL(params.href.trim()).host
    } catch {
      return params.href
    }
  })()

  return {
    id: crypto.randomUUID(),
    kind: 'link',
    name: trimmedName || fallbackName,
    linkSource: inferLinkSource(params.href),
    href: params.href,
    createdAt: Timestamp.now(),
    createdBy: params.createdBy,
  }
}
