import { convex } from "../lib/convex.ts";
import { api } from "../../convex/_generated/api";
import { callManager } from "./call-manager.ts";
import type { Id } from "../../convex/_generated/dataModel";

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
    console.error("Failed to save transcript entry", { callId, role }, err);
  }
}
