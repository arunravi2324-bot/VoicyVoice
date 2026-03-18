import { motion } from "framer-motion";

interface MetricCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  color?: "primary" | "resolved" | "transferred" | "frustrated";
}

const colorMap = {
  primary: "bg-primary/10 border-primary/20",
  resolved: "bg-resolved/10 border-resolved/20",
  transferred: "bg-transferred/10 border-transferred/20",
  frustrated: "bg-frustrated/10 border-frustrated/20",
};

export function MetricCard({
  label,
  value,
  subtitle,
  color = "primary",
}: MetricCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl border p-6 ${colorMap[color]}`}
    >
      <p className="text-text-secondary text-sm font-medium">{label}</p>
      <p className="text-3xl font-semibold mt-2 tracking-tight">{value}</p>
      {subtitle && (
        <p className="text-text-muted text-xs mt-1.5">{subtitle}</p>
      )}
    </motion.div>
  );
}
