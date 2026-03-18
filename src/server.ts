import { Hono } from "hono";
import { timingSafeEqual } from "crypto";
import { cors } from "hono/cors";
import { serveStatic } from "hono/bun";
import { createBunWebSocket } from "hono/bun";
import { convex } from "./lib/convex.ts";
import { api } from "../convex/_generated/api";
import { callManager } from "./services/call-manager.ts";
import {
  createOpenAIRelay,
  sendAudioToOpenAI,
} from "./services/openai-relay.ts";
import { generateWhisperSummary, transferToHuman } from "./services/transfer.ts";
import { tracer } from "./tracing.ts";
import { SpanStatusCode, context, trace } from "@opentelemetry/api";
import {
  INPUT_VALUE,
  OUTPUT_VALUE,
} from "@arizeai/openinference-semantic-conventions";
import twilio from "twilio";
import type WebSocket from "ws";

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);
const { upgradeWebSocket, websocket } = createBunWebSocket();

const app = new Hono();

app.use("/api/*", cors());

const PORT = parseInt(process.env.PORT ?? "5050");

async function parseTwilioBody(c: any): Promise<Record<string, any> | null> {
  const body = await c.req.parseBody();
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!authToken) return body;

  const signature = c.req.header("X-Twilio-Signature") ?? "";
  const publicUrl = process.env.PUBLIC_URL ?? new URL(c.req.url).origin;
  const fullUrl = `${publicUrl}${new URL(c.req.url).pathname}`;
  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(body)) {
    if (typeof value === "string") params[key] = value;
  }

  if (!twilio.validateRequest(authToken, signature, fullUrl, params)) {
    console.warn("Invalid Twilio signature", fullUrl);
    return null;
  }

  return body;
}

app.get("/health", (c) => c.json({ status: "ok", timestamp: Date.now() }));

app.post("/incoming-call", async (c) => {
  const body = await parseTwilioBody(c);
  if (!body) return c.text("Forbidden", 403);
  const from = (body["From"] as string) ?? "unknown";
  const to = (body["To"] as string) ?? "unknown";
  const callSid = (body["CallSid"] as string) ?? "unknown";
  console.log("Incoming call", { callSid, from, to });

  const host = process.env.PUBLIC_URL ?? new URL(c.req.url).origin;
  const wsHost = host.replace("https://", "wss://").replace("http://", "ws://");

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${wsHost}/media-stream">
      <Parameter name="callSid" value="${callSid}" />
      <Parameter name="from" value="${from}" />
      <Parameter name="to" value="${to}" />
    </Stream>
  </Connect>
</Response>`;

  return c.text(twiml, 200, { "Content-Type": "text/xml" });
});

app.post("/call-status", async (c) => {
  const body = await parseTwilioBody(c);
  if (!body) return c.text("Forbidden", 403);
  const callSid = body["CallSid"] as string;
  const status = body["CallStatus"] as string;

  console.log("Call status update", { callSid, status });

  if (status === "completed" || status === "failed" || status === "no-answer") {
    const call = callManager.remove(callSid);
    if (call) {
      const userTurns = call.transcript
        .filter((t) => t.role === "user")
        .map((t) => t.content)
        .join("\n");
      const assistantTurns = call.transcript
        .filter((t) => t.role === "assistant")
        .map((t) => t.content)
        .join("\n");

      let finalStatus: "completed" | "transferred" | "abandoned" | "failed";
      if (status === "failed" || status === "no-answer") {
        finalStatus = "failed";
      } else if (call.transferFailed) {
        finalStatus = "abandoned";
      } else if (call.transferred) {
        finalStatus = "transferred";
      } else {
        finalStatus = "completed";
      }

      call.span?.setAttribute("call.outcome", finalStatus);
      call.span?.setAttribute("call.duration_ms", Date.now() - call.startedAt);
      call.span?.setAttribute("call.transcript_turns", call.transcript.length);
      call.span?.setAttribute(INPUT_VALUE, userTurns);
      call.span?.setAttribute(OUTPUT_VALUE, assistantTurns);
      call.span?.setStatus({
        code: finalStatus === "completed" ? SpanStatusCode.OK : SpanStatusCode.ERROR,
        message: finalStatus,
      });
      call.span?.end();
      try {
        await convex.mutation(api.calls.end, {
          callId: call.callId,
          turnCount: call.transcript.length,
          finalStatus,
        });
      } catch (err) {
        console.error("Failed to end call in Convex", callSid, err);
      }
    }
  }

  return new Response(null, { status: 204 });
});

app.post("/whisper", async (c) => {
  const body = await parseTwilioBody(c);
  if (!body) return c.text("Forbidden", 403);
  const parentCallSid = body["ParentCallSid"] as string | undefined;
  const callSid = body["CallSid"] as string | undefined;
  const sid = parentCallSid ?? callSid ?? "";

  const rawSummary = await generateWhisperSummary(sid);
  console.log("Whisper summary generated", { sid, summary: rawSummary });

  const call = callManager.get(sid);
  if (call) {
    convex
      .mutation(api.calls.setTransferSummary, {
        callId: call.callId,
        summary: rawSummary,
      })
      .catch((err) => console.error("Failed to save transfer summary", sid, err));
  }

  const summary = rawSummary
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Amy">Incoming transfer from VoicyVoice. ${summary}</Say>
</Response>`;

  return c.text(twiml, 200, { "Content-Type": "text/xml" });
});

app.post("/transfer-fallback", async (c) => {
  const body = await parseTwilioBody(c);
  if (!body) return c.text("Forbidden", 403);
  const dialCallStatus = body["DialCallStatus"] as string;
  const callSid = body["CallSid"] as string;

  console.log("Transfer fallback triggered", { callSid, dialCallStatus });

  if (dialCallStatus !== "completed") {
    const call = callManager.get(callSid);
    if (call) {
      call.transferFailed = true;
    }

    if (call?.span) {
      const ctx = trace.setSpan(context.active(), call.span);
      const failSpan = tracer.startSpan(
        "transfer_failed",
        {
          attributes: {
            "openinference.span.kind": "TOOL",
            "transfer.dial_status": dialCallStatus,
            "call.sid": callSid,
          },
        },
        ctx
      );
      failSpan.setStatus({
        code: SpanStatusCode.ERROR,
        message: `Transfer failed: ${dialCallStatus}`,
      });
      failSpan.end();
    }

    const host = process.env.PUBLIC_URL ?? new URL(c.req.url).origin;
    const wsHost = host.replace("https://", "wss://").replace("http://", "ws://");
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${wsHost}/media-stream">
      <Parameter name="callSid" value="${callSid}" />
      <Parameter name="fallback" value="true" />
    </Stream>
  </Connect>
</Response>`;
    return c.text(twiml, 200, { "Content-Type": "text/xml" });
  }

  return c.text(
    `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
    200,
    { "Content-Type": "text/xml" }
  );
});

function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

const dashboardAuth = async (c: any, next: any) => {
  const authHeader = c.req.header("Authorization") ?? "";
  if (!authHeader.startsWith("Basic ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const decoded = atob(authHeader.slice(6));
  const [username, ...rest] = decoded.split(":");
  const password = rest.join(":");
  const expectedUser = process.env.DASHBOARD_USER ?? "";
  const expectedPass = process.env.DASHBOARD_PASS ?? "";
  if (!expectedUser || !safeCompare(username, expectedUser) || !safeCompare(password, expectedPass)) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  await next();
};

app.get("/api/calls/active", dashboardAuth, (c) => {
  return c.json(callManager.listActive());
});

app.post("/trigger-call", dashboardAuth, async (c) => {
  const body = await c.req.json();
  const to = body.to as string;
  if (!to) return c.json({ error: "Missing 'to' phone number" }, 400);

  const e164Regex = /^\+[1-9]\d{1,14}$/;
  if (!e164Regex.test(to)) {
    return c.json({ error: "Invalid phone number format. Use E.164 (e.g. +14155551234)" }, 400);
  }

  const twilioNumber = process.env.TWILIO_PHONE_NUMBER ?? "+14452751987";
  const host = process.env.PUBLIC_URL ?? `http://localhost:${PORT}`;

  try {
    const call = await twilioClient.calls.create({
      to,
      from: twilioNumber,
      url: `${host}/incoming-call`,
      statusCallback: `${host}/call-status`,
      statusCallbackEvent: ["completed", "failed", "no-answer"],
    });
    console.log("Manual outbound call triggered", { to, callSid: call.sid });
    return c.json({ success: true, callSid: call.sid });
  } catch (err: any) {
    console.error("Failed to trigger outbound call", to, err);
    return c.json({ error: err.message }, 500);
  }
});

app.get(
  "/media-stream",
  upgradeWebSocket((c) => {
    let openaiWs: WebSocket | null = null;
    let streamSid: string | null = null;
    let callSid: string | null = null;

    return {
      onMessage(event, ws) {
        const msg = JSON.parse(event.data as string);

        switch (msg.event) {
          case "connected":
            console.log("Twilio media stream connected");
            break;

          case "start":
            streamSid = msg.start.streamSid;
            callSid = msg.start.customParameters?.callSid ?? null;
            const from = msg.start.customParameters?.from ?? "unknown";
            const to = msg.start.customParameters?.to ?? "unknown";
            const isFallback =
              msg.start.customParameters?.fallback === "true";

            const host = `${process.env.PUBLIC_URL ?? `http://localhost:${PORT}`}`;

            if (isFallback && callSid) {
              const existingCall = callManager.get(callSid);
              if (existingCall) {
                openaiWs = createOpenAIRelay({
                  callId: existingCall.callId,
                  twilioSid: callSid,
                  host,
                  isFallback: true,
                  onAudioDelta: (base64Audio) => {
                    ws.send(
                      JSON.stringify({
                        event: "media",
                        streamSid,
                        media: { payload: base64Audio },
                      })
                    );
                  },
                  onSessionEnd: () => {
                    openaiWs = null;
                  },
                  sendMark: (name) => {
                    ws.send(
                      JSON.stringify({
                        event: "mark",
                        streamSid,
                        mark: { name },
                      })
                    );
                  },
                });
                return;
              }
            }

            if (callSid) {
              convex
                .mutation(api.calls.create, {
                  twilioSid: callSid,
                  channel: "phone",
                  fromNumber: from,
                  toNumber: to,
                })
                .then((callId) => {
                  const span = tracer.startSpan("voice.call", {
                    attributes: {
                      "openinference.span.kind": "AGENT",
                      "call.sid": callSid!,
                      "call.from": from,
                    },
                  });
                  callManager.add(callSid!, {
                    callId,
                    twilioSid: callSid!,
                    channel: "phone",
                    fromNumber: from,
                    startedAt: Date.now(),
                    transcript: [],
                    span,
                  });

                  openaiWs = createOpenAIRelay({
                    callId,
                    twilioSid: callSid!,
                    host,
                    onAudioDelta: (base64Audio) => {
                      ws.send(
                        JSON.stringify({
                          event: "media",
                          streamSid,
                          media: { payload: base64Audio },
                        })
                      );
                    },
                    onSessionEnd: () => {
                      openaiWs = null;
                    },
                    sendMark: (name) => {
                      ws.send(
                        JSON.stringify({
                          event: "mark",
                          streamSid,
                          mark: { name },
                        })
                      );
                    },
                  });
                })
                .catch((err) => {
                  console.error("Failed to create call in Convex", err);
                });
            }
            break;

          case "media":
            if (openaiWs) {
              sendAudioToOpenAI(openaiWs, msg.media.payload);
            }
            break;

          case "mark":
            if (msg.mark?.name === "transfer-ready" && callSid) {
              const call = callManager.get(callSid);
              if (call?.pendingTransfer) {
                const { reason, host: transferHost } = call.pendingTransfer;
                call.pendingTransfer = undefined;
                console.log("Audio playback complete — executing transfer now", { callSid, reason });
                transferToHuman(call.callId, callSid, reason, transferHost);
              }
            }
            break;

          case "stop":
            console.log("Twilio media stream stopped", streamSid);
            if (openaiWs) {
              openaiWs.close();
              openaiWs = null;
            }
            break;
        }
      },

      onClose() {
        console.log("WebSocket closed", streamSid);
        if (openaiWs) {
          openaiWs.close();
          openaiWs = null;
        }
      },

      onError(event) {
        console.error("WebSocket error", event);
        if (openaiWs) {
          openaiWs.close();
          openaiWs = null;
        }
      },
    };
  })
);

async function recoverOrphanedCalls() {
  try {
    const result = await convex.mutation(api.calls.recoverOrphans, {});
    if (result.recovered > 0) {
      console.log("Recovered orphaned calls on startup", result.recovered);
    }
  } catch (err) {
    console.error("Failed to recover orphaned calls", err);
  }
}

recoverOrphanedCalls();

app.get("/", (c) => c.redirect("/dashboard/"));
app.get("/dashboard", (c) => c.redirect("/dashboard/"));
app.use("/dashboard/*", serveStatic({ root: "./dashboard/dist", rewriteRequestPath: (path) => path.replace(/^\/dashboard/, "") }));
app.use("/dashboard/*", serveStatic({ root: "./dashboard/dist", rewriteRequestPath: () => "/index.html" }));

export { app, websocket, PORT };
