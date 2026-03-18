import { motion } from "framer-motion";
import { Phone } from "lucide-react";
import { SentimentBadge } from "./SentimentBadge";
import { useEffect, useState } from "react";
import { formatDuration, timeAgo } from "../lib/utils";

interface CallCardProps {
  call: {
    _id: string;
    channel: "phone";
    fromNumber: string;
    toNumber: string;
    status: "active" | "completed" | "transferred" | "abandoned" | "failed";
    startedAt: number;
    transferReason?: string;
    durationMs?: number;
  };
  selected?: boolean;
  live?: boolean;
  onClick: () => void;
}

export function CallCard({ call, selected, live, onClick }: CallCardProps) {
  const [elapsed, setElapsed] = useState(Date.now() - call.startedAt);

  useEffect(() => {
    if (call.status !== "active") return;
    const interval = setInterval(() => {
      setElapsed(Date.now() - call.startedAt);
    }, 1000);
    return () => clearInterval(interval);
  }, [call.status, call.startedAt]);

  const duration =
    call.status === "active"
      ? formatDuration(elapsed)
      : formatDuration(call.durationMs ?? 0);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      onClick={onClick}
      className={`px-4 py-3.5 rounded-xl cursor-pointer transition-all ${
        selected
          ? "bg-primary/10 shadow-sm"
          : "hover:bg-surface-hover"
      } ${live ? "border border-primary/25 bg-primary/5" : ""}`}
    >
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <Phone className="w-4 h-4 text-primary-light flex-shrink-0" />
          <div className="min-w-0">
            <span className="text-sm font-mono text-text-primary truncate block">
              {call.fromNumber}
            </span>
            {call.toNumber && call.toNumber !== call.fromNumber && (
              <span className="text-[10px] font-mono text-text-muted truncate block">
                → {call.toNumber}
              </span>
            )}
          </div>
        </div>
        <span className="text-xs font-mono text-text-muted tabular-nums flex-shrink-0 ml-2">{duration}</span>
      </div>
      <div className="flex items-center justify-between">
        <SentimentBadge
          status={call.status}
          transferReason={call.transferReason}
        />
        <span className="text-[10px] text-text-muted">
          {timeAgo(call.startedAt)}
        </span>
      </div>
    </motion.div>
  );
}
