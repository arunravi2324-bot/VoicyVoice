import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { User, Bot } from "lucide-react";
import { formatTime } from "../lib/utils";

interface TranscriptEntry {
  _id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
}

interface TranscriptProps {
  entries: TranscriptEntry[];
}

export function Transcript({ entries }: TranscriptProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [entries.length]);

  if (entries.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-text-muted text-sm">
        Waiting for conversation...
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6 overflow-y-auto h-full">
      <AnimatePresence initial={false}>
        {entries.map((entry) => (
          <motion.div
            key={entry._id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex gap-2.5 lg:gap-3.5 ${entry.role === "assistant" ? "" : "flex-row-reverse"}`}
          >
            <div
              className={`flex-shrink-0 w-7 h-7 lg:w-8 lg:h-8 rounded-full flex items-center justify-center ${
                entry.role === "assistant"
                  ? "bg-primary/15"
                  : "bg-surface-hover"
              }`}
            >
              {entry.role === "assistant" ? (
                <Bot className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-primary-light" />
              ) : (
                <User className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-text-secondary" />
              )}
            </div>
            <div className={`max-w-[85%] lg:max-w-[75%] ${entry.role === "assistant" ? "" : "text-right"}`}>
              <div
                className={`rounded-2xl px-3.5 lg:px-4 py-2.5 lg:py-3 text-sm leading-relaxed inline-block text-left ${
                  entry.role === "assistant"
                    ? "bg-surface text-text-primary"
                    : "bg-primary/10 text-text-primary"
                }`}
              >
                {entry.content}
              </div>
              <p className="text-[10px] text-text-muted mt-1 px-1">
                {formatTime(entry.createdAt)}
              </p>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
      <div ref={bottomRef} />
    </div>
  );
}
