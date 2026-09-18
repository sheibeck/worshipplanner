---
name: worktree-env-setup
description: Set up .env.local in a fresh git worktree of this repo (symlink or copy from the main checkout) before running the Firebase emulator, tests, or a build.
---

# Worktree `.env.local` setup

`.env.local` is gitignored, so a freshly-created git worktree has no copy. The canonical file lives in
the main checkout at `C:\projects\worshipplanner\.env.local`. Do this before running the emulator,
`npm run test:rules`, the unit suite, or `vite build` in a worktree.

## Steps (PowerShell, from the worktree root)

- Preferred — symlink to the single source of truth (needs Windows admin / Developer Mode):
  ```powershell
  New-Item -ItemType SymbolicLink -Path .\.env.local -Target C:\projects\worshipplanner\.env.local
  ```
- Fallback — copy it (works without elevation, but goes stale if the source changes):
  ```powershell
  Copy-Item C:\projects\worshipplanner\.env.local .\.env.local
  ```

## Notes

- Copy or symlink the **whole** file, never cherry-pick keys. The `vite build` guard only checks
  `VITE_FIREBASE_*`, but the file also carries `ESV_API_KEY`, `CLAUDE_API_KEY`, and
  `VITE_PLANNINGCENTER_*`.
- Verify with `ls .env.local` before running anything Firebase-dependent.
