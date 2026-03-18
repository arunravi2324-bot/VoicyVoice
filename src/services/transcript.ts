import { convex } from "../lib/convex.ts";
import { api } from "../../convex/_generated/api";
import { callManager } from "./call-manager.ts";
import type { Id } from "../../convex/_generated/dataModel";
import pino from "pino";

const log = pino({ name: "transcript" });

export async function addTranscriptEntry(
  callId: Id<"calls">,
  twilioSid: string,
  role: "user" | "assistant",
  content: string
) {
  if (!content.trim()) return;

  callManager.addTranscript(twilioSid, { role, content });

  try {
    await convex.mutation(api.transcripts.add, { callId, role, content });
  } catch (err) {
    log.error({ err, callId, role }, "Failed to save transcript entry");
  }
}
