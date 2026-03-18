import { EventEmitter } from "events";
import type { Span } from "@opentelemetry/api";
import type { Id } from "../../convex/_generated/dataModel";

export interface ActiveCall {
  callId: Id<"calls">;
  twilioSid: string;
  channel: "phone";
  fromNumber: string;
  startedAt: number;
  transcript: { role: "user" | "assistant"; content: string }[];
  span?: Span;
  transferred?: boolean;
  transferFailed?: boolean;
  pendingTransfer?: {
    reason: "off_topic" | "frustrated_caller" | "user_request";
    host: string;
  };
}

class CallManager extends EventEmitter {
  private activeCalls = new Map<string, ActiveCall>();

  add(twilioSid: string, call: ActiveCall) {
    this.activeCalls.set(twilioSid, call);
    this.emit("call:started", call);
  }

  get(twilioSid: string): ActiveCall | undefined {
    return this.activeCalls.get(twilioSid);
  }

  remove(twilioSid: string) {
    const call = this.activeCalls.get(twilioSid);
    if (call) {
      this.activeCalls.delete(twilioSid);
      this.emit("call:ended", call);
    }
    return call;
  }

  addTranscript(
    twilioSid: string,
    entry: { role: "user" | "assistant"; content: string }
  ) {
    const call = this.activeCalls.get(twilioSid);
    if (call) {
      call.transcript.push(entry);
      this.emit("call:transcript", { ...call, entry });
    }
  }

  getTranscriptSummaryText(twilioSid: string): string {
    const call = this.activeCalls.get(twilioSid);
    if (!call) return "No conversation history available.";
    return call.transcript
      .map((t) => `${t.role === "user" ? "Caller" : "Bot"}: ${t.content}`)
      .join("\n");
  }

  listActive(): ActiveCall[] {
    return Array.from(this.activeCalls.values());
  }
}

export const callManager = new CallManager();
