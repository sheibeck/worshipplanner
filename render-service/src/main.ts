// render-service/src/main.ts
//
// Container entrypoint. This is the ONLY module in render-service that binds a socket
// (createApp() in server.ts deliberately never calls listen(), which keeps that module
// import-safe in tests). Compiles to lib/main.js, matching the Dockerfile's
// `CMD ["node", "lib/main.js"]`.
import { createApp } from "./server";

const port = Number(process.env.PORT) || 8080;
const app = createApp();

app.listen(port, () => {
  console.log(`render-service listening on port ${port}`);
});
