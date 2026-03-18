import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { MetricCard } from "../components/MetricCard";
import { formatDuration } from "../lib/utils";
import { Loader2 } from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const COLORS = {
  primary: "#c4622a",
  resolved: "#22c55e",
  transferred: "#d4a040",
  frustrated: "#c43030",
};

const tooltipStyle = {
  backgroundColor: "hsl(330 10% 18%)",
  border: "1px solid hsl(330 8% 25%)",
  borderRadius: "12px",
  color: "hsl(40 20% 90%)",
  fontSize: "12px",
  fontFamily: "Geist, system-ui",
  padding: "8px 12px",
};

type DateRange = "7d" | "30d" | "90d" | "all";

const RANGE_LABELS: Record<DateRange, string> = {
  "7d": "7 days",
  "30d": "30 days",
  "90d": "90 days",
  all: "All time",
};

function getRangeTimestamp(range: DateRange): number | undefined {
  if (range === "all") return undefined;
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  return Date.now() - days * 24 * 60 * 60 * 1000;
}

export function Analytics() {
  const [range, setRange] = useState<DateRange>("all");

  const rangeArgs = useMemo(() => {
    const from = getRangeTimestamp(range);
    return from ? { from } : {};
  }, [range]);

  const overview = useQuery(api.analytics.overview, rangeArgs);
  const reasons = useQuery(api.analytics.transferReasons, rangeArgs);
  const volume = useQuery(api.analytics.volumeOverTime, rangeArgs);

  const isLoading = overview === undefined;

  const reasonsData = reasons
    ? [
        { name: "Off Topic", value: reasons.off_topic, color: COLORS.transferred },
        {
          name: "Frustrated",
          value: reasons.frustrated_caller,
          color: COLORS.frustrated,
        },
        {
          name: "Requested Human",
          value: reasons.user_request,
          color: COLORS.primary,
        },
      ]
    : [];

  return (
    <div className="p-4 lg:p-8 space-y-6 lg:space-y-8 overflow-y-auto h-[calc(100vh-56px)] lg:h-[calc(100vh-64px)]">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex gap-1.5 flex-wrap">
          {(Object.keys(RANGE_LABELS) as DateRange[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                range === r
                  ? "bg-primary/15 text-primary-light"
                  : "text-text-muted hover:text-text-secondary hover:bg-surface-hover"
              }`}
            >
              {RANGE_LABELS[r]}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-text-muted animate-spin" />
          <p className="text-text-muted text-xs mt-3">Loading analytics...</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-5">
            <MetricCard
              label="Total Calls"
              value={overview?.totalCalls ?? 0}
              color="primary"
            />
            <MetricCard
              label="Avg Duration"
              value={
                overview ? formatDuration(overview.avgDurationMs) : "0:00"
              }
              color="primary"
            />
            <MetricCard
              label="Resolution Rate"
              value={`${overview?.resolutionRate ?? 0}%`}
              subtitle="Handled by bot"
              color="resolved"
            />
            <MetricCard
              label="Deflection Rate"
              value={`${overview?.deflectionRate ?? 0}%`}
              subtitle="Transferred to human"
              color="transferred"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-5">
            <div className="bg-surface/60 border border-border rounded-2xl p-4 lg:p-6">
              <h3 className="text-sm font-semibold text-text-secondary mb-5">
                Call Volume
              </h3>
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={volume ?? []}>
                  <defs>
                    <linearGradient id="volumeGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.25} />
                      <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(330 8% 22%)" />
                  <XAxis
                    dataKey="date"
                    stroke="hsl(30 8% 40%)"
                    fontSize={11}
                    fontFamily="Geist, system-ui"
                    tickFormatter={(d) => new Date(d).toLocaleDateString("en", { month: "short", day: "numeric" })}
                  />
                  <YAxis stroke="hsl(30 8% 40%)" fontSize={11} fontFamily="Geist, system-ui" />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke={COLORS.primary}
                    fill="url(#volumeGradient)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-surface/60 border border-border rounded-2xl p-4 lg:p-6">
              <h3 className="text-sm font-semibold text-text-secondary mb-5">
                Transfer Reasons
              </h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={reasonsData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(330 8% 22%)" />
                  <XAxis type="number" stroke="hsl(30 8% 40%)" fontSize={11} fontFamily="Geist, system-ui" />
                  <YAxis
                    type="category"
                    dataKey="name"
                    stroke="hsl(30 8% 40%)"
                    fontSize={11}
                    fontFamily="Geist, system-ui"
                    width={100}
                  />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="value" radius={[0, 8, 8, 0]}>
                    {reasonsData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
