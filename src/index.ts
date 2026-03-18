import "./tracing.ts";
import { app, websocket, PORT } from "./server.ts";

const server = Bun.serve({
  port: PORT,
  fetch: app.fetch,
  websocket,
});

console.log(`VoicyVoice server started on port ${server.port}`);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    console.log("Shutting down...");
    server.stop();
    process.exit(0);
  });
}
