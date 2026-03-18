import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { AnimatePresence, motion } from "framer-motion";
import {
  PhoneOff,
  X,
  ArrowRightLeft,
  Clock,
  MessageSquare,
  Phone,
  Search,
  ArrowLeft,
  Loader2,
  CheckCircle,
} from "lucide-react";
import { CallCard } from "../components/CallCard";
import { Transcript } from "../components/Transcript";
import { SentimentBadge } from "../components/SentimentBadge";
import { formatDuration } from "../lib/utils";

const TRANSFER_REASON_LABELS: Record<string, string> = {
  off_topic: "The caller asked about something outside the agent's scope.",
  frustrated_caller: "The caller became frustrated and needed a human touch.",
  user_request: "The caller explicitly asked to speak with a human agent.",
};

type StatusFilter = "all" | "completed" | "transferred";

export function LiveCalls() {
  const activeCalls = useQuery(api.calls.listActive);
  const recentCalls = useQuery(api.calls.listAll, { limit: 50 });
  const resolveCall = useMutation(api.calls.resolve);
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const isLoading = activeCalls === undefined || recentCalls === undefined;
  const activeList = activeCalls ?? [];
  const recentList = recentCalls ?? [];

  const filteredRecent = recentList
    .filter((rc: any) => rc.status !== "active")
    .filter((rc: any) => {
      if (search) {
        return rc.fromNumber.includes(search);
      }
      return true;
    })
    .filter((rc: any) => {
      if (statusFilter === "all") return true;
      return rc.status === statusFilter;
    });

  const allCalls = [...activeList, ...recentList.filter(
    (rc: any) => !activeList.some((ac: any) => ac._id === rc._id)
  )];

  const selectedCall = allCalls.find((c: any) => c._id === selectedCallId) as any;
  const transcriptEntries =
    useQuery(
      api.transcripts.byCall,
      selectedCallId ? { callId: selectedCallId as any } : "skip"
    ) ?? [];

  return (
    <div className="flex h-[calc(100vh-56px)] lg:h-[calc(100vh-64px)]">
      <div
        className={`${
          selectedCallId ? "hidden lg:flex" : "flex"
        } w-full lg:w-96 border-r border-border flex-col overflow-hidden`}
      >
        <div className="p-4 pb-3 space-y-3 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
            <input
              type="text"
              placeholder="Search by phone number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-bg border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary/50 transition-colors"
            />
          </div>
          <div className="flex gap-1.5">
            {(["all", "completed", "transferred"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                  statusFilter === f
                    ? "bg-primary/15 text-primary-light"
                    : "text-text-muted hover:text-text-secondary hover:bg-surface-hover"
                }`}
              >
                {f === "all" ? "All" : f === "completed" ? "Resolved" : "Transferred"}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="w-6 h-6 text-text-muted animate-spin" />
              <p className="text-text-muted text-xs mt-3">Loading calls...</p>
            </div>
          ) : (
            <>
              <div className="mb-5">
                <p className="text-xs text-primary-light font-semibold mb-3 px-1 flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full ${activeList.length > 0 ? "bg-primary-light animate-pulse" : "bg-text-muted"}`} />
                  Live{activeList.length > 0 ? ` (${activeList.length})` : ""}
                </p>
                {activeList.length > 0 ? (
                  <div className="space-y-1">
                    <AnimatePresence>
                      {activeList.map((call: any) => (
                        <CallCard
                          key={call._id}
                          call={call}
                          selected={selectedCallId === call._id}
                          onClick={() => setSelectedCallId(call._id)}
                          live
                        />
                      ))}
                    </AnimatePresence>
                  </div>
                ) : (
                  <div className="px-4 py-3 rounded-xl border border-dashed border-border text-center">
                    <p className="text-xs text-text-muted">No active calls</p>
                  </div>
                )}
              </div>

              {filteredRecent.length > 0 ? (
                <div>
                  <p className="text-xs text-text-muted font-semibold mb-3 px-1">
                    Recent ({filteredRecent.length})
                  </p>
                  <div className="space-y-1">
                    {filteredRecent.map((call: any) => (
                      <CallCard
                        key={call._id}
                        call={call}
                        selected={selectedCallId === call._id}
                        onClick={() => setSelectedCallId(call._id)}
                      />
                    ))}
                  </div>
                </div>
              ) : search || statusFilter !== "all" ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <p className="text-text-muted text-sm">No matching calls</p>
                  <p className="text-text-muted text-xs mt-1">Try adjusting your filters</p>
                </div>
              ) : null}

              {allCalls.length === 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center justify-center py-20 text-center"
                >
                  <div className="w-16 h-16 rounded-2xl bg-surface border border-border flex items-center justify-center mb-5">
                    <PhoneOff className="w-7 h-7 text-text-muted" />
                  </div>
                  <p className="text-text-secondary text-sm font-medium">No calls yet</p>
                  <p className="text-text-muted text-xs mt-1.5">
                    Calls will appear here in real-time
                  </p>
                </motion.div>
              )}
            </>
          )}
        </div>
      </div>

      <div className={`flex-1 flex flex-col min-w-0 ${selectedCallId ? "" : "hidden lg:flex"}`}>
        {selectedCall ? (
          <>
            <div className="border-b border-border">
              <div className="flex items-center justify-between px-4 lg:px-8 py-4 lg:py-5">
                <div className="flex items-center gap-3 lg:gap-4 min-w-0">
                  <button
                    onClick={() => setSelectedCallId(null)}
                    className="lg:hidden p-1.5 rounded-lg hover:bg-surface-hover transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4 text-text-muted" />
                  </button>
                  <div className="w-10 h-10 rounded-xl bg-surface flex items-center justify-center flex-shrink-0">
                    <Phone className="w-5 h-5 text-primary-light" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold truncate">{selectedCall.fromNumber}</h3>
                    {selectedCall.toNumber && selectedCall.toNumber !== selectedCall.fromNumber ? (
                      <p className="text-xs text-text-muted mt-0.5">→ {selectedCall.toNumber}</p>
                    ) : (
                      <p className="text-xs text-text-muted mt-0.5">Phone call</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 lg:gap-3 flex-shrink-0">
                  <SentimentBadge
                    status={selectedCall.status}
                    transferReason={selectedCall.transferReason}
                  />
                  {selectedCall.status !== "completed" && selectedCall.status !== "active" && (
                    <button
                      onClick={() => resolveCall({ callId: selectedCall._id as any })}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-resolved/15 text-resolved hover:bg-resolved/25 transition-colors"
                    >
                      <CheckCircle className="w-3 h-3" />
                      Resolve
                    </button>
                  )}
                  <button
                    onClick={() => setSelectedCallId(null)}
                    className="hidden lg:block p-2 rounded-xl hover:bg-surface-hover transition-colors"
                  >
                    <X className="w-4 h-4 text-text-muted" />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-4 lg:gap-6 px-4 lg:px-8 pb-4 flex-wrap">
                {selectedCall.durationMs != null && (
                  <div className="flex items-center gap-2 text-xs text-text-secondary">
                    <Clock className="w-3.5 h-3.5 text-text-muted" />
                    {formatDuration(selectedCall.durationMs)}
                  </div>
                )}
                {selectedCall.turnCount != null && (
                  <div className="flex items-center gap-2 text-xs text-text-secondary">
                    <MessageSquare className="w-3.5 h-3.5 text-text-muted" />
                    {selectedCall.turnCount} turns
                  </div>
                )}
                {selectedCall.transferred && (
                  <div className="flex items-center gap-2 text-xs text-text-secondary">
                    <ArrowRightLeft className="w-3.5 h-3.5 text-text-muted" />
                    Transferred to human
                  </div>
                )}
              </div>

              {selectedCall.transferred && (
                <div className="mx-4 lg:mx-8 mb-4 rounded-xl bg-transferred/8 border border-transferred/15 p-4">
                  <p className="text-xs font-semibold text-transferred mb-1">
                    Transfer Reason
                  </p>
                  <p className="text-sm text-text-secondary leading-relaxed">
                    {TRANSFER_REASON_LABELS[selectedCall.transferReason ?? ""] ??
                      "Transferred to a human agent."}
                  </p>
                  {selectedCall.transferSummary && (
                    <>
                      <p className="text-xs font-semibold text-transferred mt-3 mb-1">
                        Handoff Summary
                      </p>
                      <p className="text-sm text-text-secondary leading-relaxed">
                        {selectedCall.transferSummary}
                      </p>
                    </>
                  )}
                </div>
              )}
            </div>

            <Transcript entries={transcriptEntries as any} />
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-text-muted text-sm">
            Select a call to view its transcript
          </div>
        )}
      </div>
    </div>
  );
}
