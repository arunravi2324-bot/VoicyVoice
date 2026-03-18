import twilio from "twilio";
import OpenAI from "openai";
import { context, trace, SpanStatusCode } from "@opentelemetry/api";
import {
  INPUT_VALUE,
  OUTPUT_VALUE,
  LLM_MODEL_NAME,
  OpenInferenceSpanKind,
} from "@arizeai/openinference-semantic-conventions";
import { convex } from "../lib/convex.ts";
import { api } from "../../convex/_generated/api";
import { callManager } from "./call-manager.ts";
import { tracer } from "../tracing.ts";
import type { Id } from "../../convex/_generated/dataModel";
import pino from "pino";

const log = pino({ name: "transfer" });

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const openai = new OpenAI();

export async function transferToHuman(
  callId: Id<"calls">,
  twilioSid: string,
  reason: "off_topic" | "frustrated_caller" | "user_request",
  host: string
) {
  const humanPhone = process.env.HUMAN_AGENT_PHONE;
  if (!humanPhone) {
    log.error("HUMAN_AGENT_PHONE not configured");
    return;
  }

  const call = callManager.get(twilioSid);
  const parentSpan = call?.span;
  const ctx = parentSpan
    ? trace.setSpan(context.active(), parentSpan)
    : context.active();

  const transferSpan = tracer.startSpan(
    "transfer_to_human",
    {
      attributes: {
        "openinference.span.kind": "TOOL",
        "transfer.reason": reason,
        "call.sid": twilioSid,
      },
    },
    ctx
  );

  try {
    await convex.mutation(api.calls.transfer, { callId, reason });

    const inMemoryCall = callManager.get(twilioSid);
    if (inMemoryCall) {
      inMemoryCall.transferred = true;
    }

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial timeout="30" action="${host}/transfer-fallback" method="POST" waitUrl="${host}/hold-music-twiml">
    <Number url="${host}/whisper" method="POST">${humanPhone}</Number>
  </Dial>
</Response>`;

    await twilioClient.calls(twilioSid).update({ twiml });
    transferSpan.setStatus({ code: SpanStatusCode.OK });
    log.info({ twilioSid, reason }, "Call transferred to human agent");
  } catch (err) {
    transferSpan.setStatus({
      code: SpanStatusCode.ERROR,
      message: String(err),
    });
    transferSpan.recordException(err as Error);
    log.error({ err, twilioSid }, "Failed to transfer call");
  } finally {
    transferSpan.end();
  }
}

export async function generateWhisperSummary(
  twilioSid: string
): Promise<string> {
  const transcriptText = callManager.getTranscriptSummaryText(twilioSid);

  const call = callManager.get(twilioSid);
  const parentSpan = call?.span;
  const ctx = parentSpan
    ? trace.setSpan(context.active(), parentSpan)
    : context.active();

  const whisperSpan = tracer.startSpan(
    "whisper_summary",
    {
      attributes: {
        "openinference.span.kind": OpenInferenceSpanKind.LLM,
        [LLM_MODEL_NAME]: "gpt-4o-mini",
        [INPUT_VALUE]: transcriptText,
      },
    },
    ctx
  );

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "Summarize this caller's issue in one sentence for the human agent who is about to take the call. Be concise and include the key problem and any relevant details like transfer destination or timeframe.",
        },
        { role: "user", content: transcriptText },
      ],
      max_tokens: 100,
    });

    const summary =
      response.choices[0]?.message?.content ??
      "Caller needs assistance with a Wise transfer issue.";

    whisperSpan.setAttribute(OUTPUT_VALUE, summary);
    if (response.usage) {
      whisperSpan.setAttribute(
        "llm.token_count.prompt",
        response.usage.prompt_tokens
      );
      whisperSpan.setAttribute(
        "llm.token_count.completion",
        response.usage.completion_tokens
      );
    }
    whisperSpan.setStatus({ code: SpanStatusCode.OK });
    return summary;
  } catch (err) {
    whisperSpan.setStatus({
      code: SpanStatusCode.ERROR,
      message: String(err),
    });
    whisperSpan.recordException(err as Error);
    log.error({ err }, "Failed to generate whisper summary");
    return "Caller needs assistance with a Wise transfer issue.";
  } finally {
    whisperSpan.end();
  }
}
