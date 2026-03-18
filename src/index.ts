import "./tracing.ts";
import { app, websocket, PORT } from "./server.ts";
import pino from "pino";

const log = pino({ name: "main" });

const server = Bun.serve({
  port: PORT,
  fetch: app.fetch,
  websocket,
});

log.info({ port: server.port }, "VoicyVoice server started");

process.on("SIGINT", () => {
  log.info("Shutting down...");
  server.stop();
  process.exit(0);
});

process.on("SIGTERM", () => {
  log.info("Shutting down...");
  server.stop();
  process.exit(0);
});
