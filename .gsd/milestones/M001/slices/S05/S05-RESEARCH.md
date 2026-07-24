# S05: Media Attachments and Storage Lifecycle - Research

## Overview

Slice S05 adds audio and video media attachments to slides with auto-play capability during presentation preview, plus automatic cleanup of media older than 2 weeks in Firebase Storage. This slice depends only on S01 (Unified Slide Model) and feeds into S06 (Presentation Preview Mode).

## Requirements Summary

- **R013:** Audio attachment per slide with auto-play on entry, no loop
- **R014:** Video playback per slide (MP4, WebM, MOV) with auto-play on entry, no loop
- **R015:** Firebase Storage with 2-week media retention auto-cleanup

## What Exists Today

### Slide Model (src/types/slide.ts)
- **Current state:** Unified Slide type defined as `type Slide = LyricSlide | CopyrightSlide`
- **Limitation:** No media attachment fields (audioUrl, videoUrl) present
- **Pattern to follow:** Discriminated union with SlideBase interface; each variant extends with content-specific fields

### Firebase Setup (src/firebase/index.ts)
- Initialized with Auth and Firestore
- **Missing:** No `getStorage()` call; Storage not yet connected to the app
- Storage bucket is defined in environment config (VITE_FIREBASE_STORAGE_BUCKET) but unused

### Firestore Rules (firestore.rules)
- Comprehensive org-scoped access control for existing collections
- **Missing:** Storage rules file (storage.rules) does not exist

### Cloud Functions (functions/src/index.ts)
- Currently only contains API proxy for external services (Anthropic, ESV, Planning Center)
- **Missing:** Scheduled Cloud Function for 2-week media cleanup

### Auto-Save Infrastructure (src/composables/useAutoSave.ts)
- Reusable composable with debouncing (default 800ms), inflight guard, and status tracking
- **Pattern:** Can be directly reused for media attachment metadata (URL fields) auto-save
- **Note:** File uploads to Storage are separate from auto-save of metadata

### UI Patterns (SongLyricEditor.vue)
- Established pattern: header with status/actions, tabbed sections, auto-save indicator
- **Integration point:** Slide editor component (not yet built in S05) will follow this pattern

## What Needs to Be Built

### 1. Slide Type Enhancement
Add media attachment fields to slide types:
- Extend `SlideBase` interface (or each slide variant) with optional `audioUrl?: string` and `videoUrl?: string` fields
- Update Firestore schema documentation for media URL storage

### 2. Media Upload Composable
Create `useMediaUpload.ts` composable with:
- File picker UI hooks (input[type=file] with accept=audio/* and video/*)
- Firebase Storage upload function using `ref()`, `uploadBytes()`, and progress tracking
- Error handling for oversized files (recommend <50MB per file)
- Return upload progress, error state, and uploaded Storage URL

### 3. Audio/Video Playback Components
- **AudioPlayer.vue:** `<audio>` element with controls, responsive sizing
- **VideoPlayer.vue:** `<video>` element with controls (supports MP4, WebM, MOV via HTML5 video)
- Both should:
  - Accept preload="none" and autoplay="false" by default
  - Accept URL prop
  - Emit play/pause/ended events for presentation logic

### 4. Slide Editor Media Attachment UI
Extend slide editor component (built in later task) with:
- File upload button for audio (optional, single file)
- File upload button for video (optional, single file)
- Preview player (AudioPlayer/VideoPlayer) when URL is present
- Clear/remove button for each media type
- Upload progress indicator

### 5. Storage Rules (storage.rules)
```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Media files: org/{orgId}/media/{mediaId}/audio or /video
    match /org/{orgId}/media/{mediaId}/{type=**} {
      allow read: if request.auth != null 
                     && exists(/databases/(default)/documents/organizations/{orgId}/members/{request.auth.uid});
      allow write: if request.auth != null 
                      && exists(/databases/(default)/documents/organizations/{orgId}/members/{request.auth.uid})
                      && resource.size < 52428800; // 50MB limit
    }
  }
}
```

### 6. Cloud Function: Media Cleanup Scheduler
Add to `functions/src/index.ts`:
- Scheduled Cloud Function (pubsub trigger, runs daily at 2 AM UTC)
- Queries Firebase Storage for all files with metadata.createdAt older than 14 days
- Deletes expired media files
- Logs deletion count and any errors
- Uses `firebase-admin/storage` to access bucket

## Implementation Landscape

### Key Files to Modify/Create

| File | Action | Rationale |
|------|--------|-----------|
| `src/types/slide.ts` | Extend SlideBase (or variants) with `audioUrl?: string`, `videoUrl?: string` | Enable type-safe media URL references |
| `src/composables/useMediaUpload.ts` | **Create** | Reusable upload logic (parallel to useAutoSave.ts) |
| `src/components/AudioPlayer.vue` | **Create** | Media playback UI component |
| `src/components/VideoPlayer.vue` | **Create** | Media playback UI component |
| `src/firebase/index.ts` | Add `export const storage = getStorage(app)` | Initialize Storage SDK |
| `storage.rules` | **Create** | Org-scoped access control for uploaded media |
| `functions/src/index.ts` | Add `cleanupExpiredMedia` Cloud Function | 2-week retention policy |
| `functions/package.json` | Add `firebase-admin/storage` if missing | Already included in firebase-admin v13+ |

### Build Order & Seams

1. **Phase 1: Types & Storage Setup** (Task T01)
   - Extend Slide type with audioUrl, videoUrl fields
   - Initialize Firebase Storage in src/firebase/index.ts
   - Add storage.rules with org-scoped access control
   - Deploy Storage rules to Firebase

2. **Phase 2: Upload Infrastructure** (Task T02)
   - Create useMediaUpload.ts composable with progress tracking
   - Unit test upload flow with mock Storage
   - Test file size validation

3. **Phase 3: Playback Components** (Task T03)
   - Create AudioPlayer.vue and VideoPlayer.vue
   - Story tests in Storybook or component tests in Vitest
   - Verify autoplay=false and no-loop defaults

4. **Phase 4: Cloud Function & Auto-Cleanup** (Task T04)
   - Implement cleanupExpiredMedia scheduled function
   - Set up custom claims/metadata on uploaded files to track createdAt
   - Test with firestore emulator + functions emulator
   - Deploy function to production

5. **Phase 5: Slide Editor Integration** (Task T05)
   - (Depends on slide editor component being built)
   - Integrate useMediaUpload and playback components
   - Connect to auto-save for URL metadata

## Browser Auto-Play Policy Constraints

Modern browsers restrict auto-play with specific rules:
- **Muted video:** Can auto-play on any page
- **Unmuted audio/video:** Requires user interaction (gesture) to play
- **Exception:** User previously granted "auto-play" permission or site has high engagement
- **Implication for R013/R014:**
  - Audio auto-play will NOT work in church presentation setup (no user gesture)
  - Video auto-play will NOT work unless muted
  - **Recommendation:** 
    - Default audio/video to `autoplay={false}` in components
    - For presentation preview (S06), implement manual play-on-enter via presentation control logic, not HTML autoplay attribute
    - Mute video if auto-play is desired, or prompt user to click play before slide transition

## Firebase Storage Lifecycle & Cost Considerations

### Retention Policy (R015)
- Use Cloud Storage lifecycle rules + custom metadata approach:
  - Set `metadata.createdAt` timestamp when uploading each file
  - Scheduled Cloud Function (daily) scans and deletes files with createdAt > 14 days old
  - Alternatively: Use GCS lifecycle rules (simpler, but less granular)

### Cost Profile
- **Storage:** ~$0.020 per GB-month (US multi-region)
- **Operations:** Free for first 50,000 ops/month; $0.0004 per 10K ops thereafter
- **Bandwidth:** Egress is charged; recommend caching or CDN for repeated access
- **Estimated cost (typical church):**
  - 50 services/year × 2 media files × 10MB each = ~1GB stored (peaks at 14 days × 2GB) → ~$0.02-0.04/month
  - Cleanup function: 1 invocation/day = ~365 ops/month (free tier)
  - Playback bandwidth: Highly variable; suggest ~10-50 invocations/week per org

### Lifecycle Rule Options

**Option A: Cloud Storage Lifecycle Rule (Recommended for simplicity)**
```json
{
  "lifecycle": {
    "rule": [
      {
        "action": { "type": "Delete" },
        "condition": {
          "age": 14,
          "matchesPrefix": ["org/"]
        }
      }
    ]
  }
}
```
Pros: Set-and-forget, no function invocations needed
Cons: Less flexible, no logging/metrics

**Option B: Scheduled Cloud Function with Metadata (Recommended for observability)**
Pros: Full control, can log deletion, handle org-specific policies
Cons: Function invocation cost, requires metadata management

## Natural Task Decomposition

This slice naturally decomposes into 5 tasks:
1. **T01:** Extend Slide type, initialize Storage, write storage.rules
2. **T02:** Build useMediaUpload composable with tests
3. **T03:** Build AudioPlayer & VideoPlayer components with tests
4. **T04:** Implement Cloud Function for cleanup with test coverage
5. **T05:** Integrate media UI into slide editor (if editor component exists by then; else defer to after editor task)

## Open Questions for S05 Execution

1. **UI for presentation preview:** Will S06 implement play-on-enter logic, or do we need manual play buttons?
2. **Muted video for auto-play:** Is silent/muted video acceptable, or must we require manual play?
3. **Org-specific quotas:** Should we enforce per-org storage limits beyond the 2-week retention?
4. **Versioning:** Should old versions of media be kept or immediately deleted when replaced?
5. **File format support:** MP4/WebM confirmed; MOV support requires H.264 codec (supported in most browsers but check Safari).

## Dependencies & Blockers

- **No blockers:** S05 depends only on S01 (Slide type), which is complete
- **S06 dependency:** Presentation preview mode will consume media attachment data and playback components from S05
- **Emulator testing:** Requires gsd-worktree .env.local with Firebase emulator setup (see memory: worktree-env-local.md)
