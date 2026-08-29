// Client-side Blob-based text file download (Phase 98, R286). Net-new — no
// in-repo analog (98-PATTERNS.md). Follows the standard Blob + `<a download>`
// idiom, mirroring monitorConfig.ts's injectable-seam module discipline: the
// `doc` param is the ONE place `document` is named, so the function body
// never reaches into the global directly and stays testable without
// touching the real DOM globally.
export function downloadTextFile(filename: string, contents: string, mimeType: string, doc: Document = document): void {
  const blob = new Blob([contents], { type: mimeType })
  const url = URL.createObjectURL(blob)
  try {
    const anchor = doc.createElement('a')
    anchor.href = url
    anchor.download = filename
    doc.body.appendChild(anchor)
    anchor.click()
    doc.body.removeChild(anchor)
  } finally {
    URL.revokeObjectURL(url)
  }
}
