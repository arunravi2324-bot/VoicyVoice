import { register, trace } from "@arizeai/phoenix-otel";

register({
  projectName: "default",
  url: process.env.PHOENIX_COLLECTOR_ENDPOINT ?? "http://localhost:6006",
  apiKey: process.env.PHOENIX_API_KEY,
});

export const tracer = trace.getTracer("wise-voice-agent");
