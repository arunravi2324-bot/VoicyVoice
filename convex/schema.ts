import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  calls: defineTable({
    twilioSid: v.string(),
    channel: v.literal("phone"),
    fromNumber: v.string(),
    toNumber: v.string(),
    status: v.union(
      v.literal("active"),
      v.literal("completed"),
      v.literal("transferred"),
      v.literal("abandoned"),
      v.literal("failed")
    ),
    startedAt: v.number(),
    endedAt: v.optional(v.number()),
    transferred: v.boolean(),
    transferReason: v.optional(
      v.union(
        v.literal("off_topic"),
        v.literal("frustrated_caller"),
        v.literal("user_request")
      )
    ),
    durationMs: v.optional(v.number()),
    transferSummary: v.optional(v.string()),
    turnCount: v.optional(v.number()),
  })
    .index("by_status", ["status"])
    .index("by_started", ["startedAt"])
    .index("by_twilioSid", ["twilioSid"]),

  transcriptEntries: defineTable({
    callId: v.id("calls"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    createdAt: v.number(),
  }).index("by_call", ["callId", "createdAt"]),
});
