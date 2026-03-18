import WebSocket from "ws";
import { context, trace } from "@opentelemetry/api";
import {
  INPUT_VALUE,
  OUTPUT_VALUE,
  LLM_MODEL_NAME,
  OpenInferenceSpanKind,
} from "@arizeai/openinference-semantic-conventions";
import { SYSTEM_PROMPT, TRANSFER_TOOL } from "../system-prompt.ts";
import { addTranscriptEntry } from "./transcript.ts";
import { callManager } from "./call-manager.ts";
import { tracer } from "../tracing.ts";
import type { Id } from "../../convex/_generated/dataModel";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const REALTIME_MODEL = "gpt-4o-realtime-preview";
const REALTIME_URL = `wss://api.openai.com/v1/realtime?model=${REALTIME_MODEL}`;

interface RelayOptions {
  callId: Id<"calls">;
  twilioSid: string;
  host: string;
  isFallback?: boolean;
  onAudioDelta: (base64Audio: string) => void;
  onSessionEnd: () => void;
  sendMark: (name: string) => void;
}

export function createOpenAIRelay(options: RelayOptions): WebSocket {
  const { callId, twilioSid, host, isFallback, onAudioDelta, onSessionEnd, sendMark } = options;

  let pendingTransfer: {
    reason: "off_topic" | "frustrated_caller" | "user_request";
  } | null = null;
  let pendingUserInput: string | null = null;
  let pendingAssistantOutput: string | null = null;

  const ws = new WebSocket(REALTIME_URL, {
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "OpenAI-Beta": "realtime=v1",
    },
  });

  ws.on("open", () => {
    console.log("Connected to OpenAI Realtime API", twilioSid);

    const sessionUpdate = {
      type: "session.update",
      session: {
        modalities: ["text", "audio"],
        instructions: SYSTEM_PROMPT,
        voice: "coral",
        input_audio_format: "g711_ulaw",
        output_audio_format: "g711_ulaw",
        input_audio_transcription: {
          model: "gpt-4o-mini-transcribe",
        },
        turn_detection: {
          type: "semantic_vad",
        },
        tools: [TRANSFER_TOOL],
      },
    };

    ws.send(JSON.stringify(sessionUpdate));
  });

  ws.on("message", async (data) => {
    const event = JSON.parse(data.toString());

    switch (event.type) {
      case "response.audio.delta":
        if (event.delta) {
          onAudioDelta(event.delta);
        }
        break;

      case "conversation.item.input_audio_transcription.completed":
        if (event.transcript) {
          console.log("User said", { twilioSid, text: event.transcript });
          pendingUserInput = event.transcript;
          await addTranscriptEntry(
            callId,
            twilioSid,
            "user",
            event.transcript
          );
        }
        break;

      case "response.audio_transcript.done":
        if (event.transcript) {
          console.log("Assistant said", { twilioSid, text: event.transcript });
          pendingAssistantOutput = event.transcript;
          await addTranscriptEntry(
            callId,
            twilioSid,
            "assistant",
            event.transcript
          );
        }
        break;

      case "response.function_call_arguments.done":
        if (event.name === "transfer_to_human") {
          try {
            const args = JSON.parse(event.arguments);
            const reason = args.reason ?? "off_topic";
            console.log("Transfer to human queued — waiting for bot to finish speaking", { twilioSid, reason });

            pendingTransfer = { reason };

            const functionOutput = {
              type: "conversation.item.create",
              item: {
                type: "function_call_output",
                call_id: event.call_id,
                output: JSON.stringify({ status: "transferring" }),
              },
            };
            ws.send(JSON.stringify(functionOutput));
          } catch (err) {
            console.error("Failed to parse transfer arguments", err);
          }
        }
        break;

      case "response.done": {
        const callSpan = callManager.get(twilioSid)?.span;
        if (callSpan) {
          const ctx = trace.setSpan(context.active(), callSpan);
          const usage = event.response?.usage;
          const llmSpan = tracer.startSpan(
            "llm.response",
            {
              attributes: {
                "openinference.span.kind": OpenInferenceSpanKind.LLM,
                [LLM_MODEL_NAME]: REALTIME_MODEL,
                [INPUT_VALUE]: pendingUserInput ?? "",
                [OUTPUT_VALUE]: pendingAssistantOutput ?? "",
                ...(usage && {
                  "llm.token_count.prompt": usage.input_tokens ?? 0,
                  "llm.token_count.completion": usage.output_tokens ?? 0,
                  "llm.token_count.total": (usage.input_tokens ?? 0) + (usage.output_tokens ?? 0),
                }),
              },
            },
            ctx
          );
          llmSpan.end();
        }
        pendingUserInput = null;
        pendingAssistantOutput = null;

        if (pendingTransfer) {
          const { reason } = pendingTransfer;
          pendingTransfer = null;
          const inMemoryCall = callManager.get(twilioSid);
          if (inMemoryCall) {
            inMemoryCall.pendingTransfer = { reason, host };
          }
          console.log("Bot finished generating — sending mark to wait for audio playback", { twilioSid, reason });
          sendMark("transfer-ready");
        }
        break;
      }

      case "error":
        console.error("OpenAI Realtime error", event.error);
        break;

      case "session.created":
        console.log("OpenAI session created", twilioSid);
        break;

      case "session.updated":
        console.log("OpenAI session configured", twilioSid);
        ws.send(
          JSON.stringify({
            type: "conversation.item.create",
            item: {
              type: "message",
              role: "user",
              content: [
                {
                  type: "input_text",
                  text: isFallback
                    ? "The transfer to a human agent failed. Apologize to the caller and offer to continue helping them."
                    : "Hello",
                },
              ],
            },
          })
        );
        ws.send(JSON.stringify({ type: "response.create" }));
        break;
    }
  });

  ws.on("error", (err) => {
    console.error("OpenAI WebSocket error", twilioSid, err);
  });

  ws.on("close", (code, reason) => {
    console.log("OpenAI WebSocket closed", { twilioSid, code, reason: reason.toString() });
    onSessionEnd();
  });

  return ws;
}

export function sendAudioToOpenAI(ws: WebSocket, base64Audio: string) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(
      JSON.stringify({
        type: "input_audio_buffer.append",
        audio: base64Audio,
      })
    );
  }
}
