import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
  args: {
    twilioSid: v.string(),
    channel: v.literal("phone"),
    fromNumber: v.string(),
    toNumber: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("calls", {
      ...args,
      status: "active",
      startedAt: Date.now(),
      transferred: false,
    });
  },
});

export const end = mutation({
  args: {
    callId: v.id("calls"),
    turnCount: v.optional(v.number()),
    finalStatus: v.optional(
      v.union(
        v.literal("completed"),
        v.literal("transferred"),
        v.literal("abandoned"),
        v.literal("failed")
      )
    ),
  },
  handler: async (ctx, { callId, turnCount, finalStatus }) => {
    const call = await ctx.db.get(callId);
    if (!call) return;
    const durationMs = Date.now() - call.startedAt;

    let status = finalStatus;
    if (!status) {
      if (call.transferred) {
        status = "transferred";
      } else {
        status = "completed";
      }
    }

    await ctx.db.patch(callId, {
      status,
      endedAt: Date.now(),
      durationMs,
      turnCount,
    });
  },
});

export const transfer = mutation({
  args: {
    callId: v.id("calls"),
    reason: v.union(
      v.literal("off_topic"),
      v.literal("frustrated_caller"),
      v.literal("user_request")
    ),
  },
  handler: async (ctx, { callId, reason }) => {
    await ctx.db.patch(callId, {
      transferred: true,
      transferReason: reason,
    });
  },
});

export const resolve = mutation({
  args: { callId: v.id("calls") },
  handler: async (ctx, { callId }) => {
    const call = await ctx.db.get(callId);
    if (!call) return;
    await ctx.db.patch(callId, { status: "completed" });
  },
});

export const setTransferSummary = mutation({
  args: {
    callId: v.id("calls"),
    summary: v.string(),
  },
  handler: async (ctx, { callId, summary }) => {
    await ctx.db.patch(callId, { transferSummary: summary });
  },
});

export const listActive = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("calls")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();
  },
});

export const listAll = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    return await ctx.db
      .query("calls")
      .withIndex("by_started")
      .order("desc")
      .take(limit ?? 100);
  },
});

export const recoverOrphans = mutation({
  args: {},
  handler: async (ctx) => {
    const active = await ctx.db
      .query("calls")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();

    let recovered = 0;
    for (const call of active) {
      const age = Date.now() - call.startedAt;
      if (age > 30 * 60 * 1000) {
        await ctx.db.patch(call._id, {
          status: "abandoned",
          endedAt: Date.now(),
          durationMs: age,
        });
        recovered++;
      }
    }
    return { recovered };
  },
});

export const findByTwilioSid = query({
  args: { twilioSid: v.string() },
  handler: async (ctx, { twilioSid }) => {
    return await ctx.db
      .query("calls")
      .withIndex("by_twilioSid", (q) => q.eq("twilioSid", twilioSid))
      .first();
  },
});
