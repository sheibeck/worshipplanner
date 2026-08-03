// Scaffold placeholder — 37-01 creates the render-service/ project shell before any real
// module exists (render.ts/server.ts/main.ts land in plan 37-02). tsconfig.json's
// `exclude: ["src/**/*.test.ts"]` means dockerfile.test.ts (the only src/ file this plan adds)
// does not count as an "input" for `tsc --noEmit`'s include resolution, which otherwise fails
// with TS18003 ("No inputs were found") on an empty/all-excluded src/ tree. This file exists
// solely to keep `npx tsc --noEmit` and the Dockerfile builder stage's `npm run build`
// satisfiable until 37-02 adds real source. Delete it once render.ts/server.ts/main.ts exist.
export {};
