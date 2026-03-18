import { cn } from "../lib/utils";

interface SentimentBadgeProps {
  status: "active" | "completed" | "transferred" | "abandoned" | "failed";
  transferReason?: string;
  className?: string;
}

export function SentimentBadge({
  status,
  transferReason,
  className,
}: SentimentBadgeProps) {
  if (status === "transferred") {
    const reasonLabel =
      transferReason === "frustrated_caller"
        ? "Frustrated"
        : transferReason === "user_request"
          ? "Requested Human"
          : "Off Topic";

    const reasonColor =
      transferReason === "frustrated_caller"
        ? "bg-frustrated/15 text-frustrated"
        : "bg-transferred/15 text-transferred";

    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium",
          reasonColor,
          className
        )}
      >
        {reasonLabel}
      </span>
    );
  }

  if (status === "abandoned") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-frustrated/15 text-frustrated",
          className
        )}
      >
        Abandoned
      </span>
    );
  }

  if (status === "failed") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-frustrated/15 text-frustrated",
          className
        )}
      >
        Failed
      </span>
    );
  }

  if (status === "completed") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-resolved/15 text-resolved",
          className
        )}
      >
        Resolved
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-primary/15 text-primary-light",
        className
      )}
    >
      <span className="w-1.5 h-1.5 bg-primary-light rounded-full animate-pulse" />
      Active
    </span>
  );
}
