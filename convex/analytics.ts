import { query } from "./_generated/server";
import { v } from "convex/values";

export const overview = query({
  args: {
    from: v.optional(v.number()),
    to: v.optional(v.number()),
  },
  handler: async (ctx, { from, to }) => {
    let allCalls = await ctx.db.query("calls").collect();
    if (from) allCalls = allCalls.filter((c) => c.startedAt >= from);
    if (to) allCalls = allCalls.filter((c) => c.startedAt <= to);

    const completed = allCalls.filter(
      (c) => c.status === "completed" || c.status === "transferred"
    );
    const transferred = allCalls.filter((c) => c.transferred);
    const withDuration = completed.filter((c) => c.durationMs);

    const avgDurationMs =
      withDuration.length > 0
        ? withDuration.reduce((sum, c) => sum + (c.durationMs ?? 0), 0) /
          withDuration.length
        : 0;

    const resolutionRate =
      completed.length > 0
        ? ((completed.length - transferred.length) / completed.length) * 100
        : 0;

    const deflectionRate =
      completed.length > 0
        ? (transferred.length / completed.length) * 100
        : 0;

    return {
      totalCalls: allCalls.length,
      avgDurationMs: Math.round(avgDurationMs),
      resolutionRate: Math.round(resolutionRate * 10) / 10,
      deflectionRate: Math.round(deflectionRate * 10) / 10,
    };
  },
});

export const transferReasons = query({
  args: {
    from: v.optional(v.number()),
    to: v.optional(v.number()),
  },
  handler: async (ctx, { from, to }) => {
    let transferred = await ctx.db
      .query("calls")
      .filter((q) => q.eq(q.field("transferred"), true))
      .collect();
    if (from) transferred = transferred.filter((c) => c.startedAt >= from);
    if (to) transferred = transferred.filter((c) => c.startedAt <= to);

    const reasons: Record<string, number> = {
      off_topic: 0,
      frustrated_caller: 0,
      user_request: 0,
    };
    for (const call of transferred) {
      if (call.transferReason) {
        reasons[call.transferReason] = (reasons[call.transferReason] ?? 0) + 1;
      }
    }
    return reasons;
  },
});

export const volumeOverTime = query({
  args: {
    from: v.optional(v.number()),
    to: v.optional(v.number()),
  },
  handler: async (ctx, { from, to }) => {
    let allCalls = await ctx.db
      .query("calls")
      .withIndex("by_started")
      .collect();
    if (from) allCalls = allCalls.filter((c) => c.startedAt >= from);
    if (to) allCalls = allCalls.filter((c) => c.startedAt <= to);

    const byDay: Record<string, number> = {};
    for (const call of allCalls) {
      const day = new Date(call.startedAt).toISOString().split("T")[0]!;
      byDay[day] = (byDay[day] ?? 0) + 1;
    }

    return Object.entries(byDay)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  },
});
