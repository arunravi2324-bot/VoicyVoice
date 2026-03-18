import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const add = mutation({
  args: {
    callId: v.id("calls"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("transcriptEntries", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

export const byCall = query({
  args: { callId: v.id("calls") },
  handler: async (ctx, { callId }) => {
    return await ctx.db
      .query("transcriptEntries")
      .withIndex("by_call", (q) => q.eq("callId", callId))
      .collect();
  },
});
