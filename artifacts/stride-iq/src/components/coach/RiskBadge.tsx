export type RiskLevel = "high" | "medium" | "low";

export const RISK_CONFIG: Record<RiskLevel, { label: string; dot: string; badge: string; row: string }> = {
  low:    { label: "Low Risk",    dot: "bg-[#10b981]", badge: "bg-[#10b981]/10 text-[#10b981] border-[#10b981]/20", row: "bg-[#10b981]/5" },
  medium: { label: "Caution",     dot: "bg-[#f59e0b]", badge: "bg-[#f59e0b]/10 text-[#f59e0b] border-[#f59e0b]/20", row: "bg-[#f59e0b]/5" },
  high:   { label: "Injury Risk", dot: "bg-[#ef4444] animate-pulse", badge: "bg-[#ef4444]/10 text-[#ef4444] border-[#ef4444]/20", row: "bg-[#ef4444]/5" },
};

export const READY_CONFIG = { label: "Ready", dot: "bg-[#10b981]", badge: "bg-[#10b981]/10 text-[#10b981] border-[#10b981]/20", row: "" };

export function RiskBadge({ level }: { level: RiskLevel | null }) {
  const cfg = level ? RISK_CONFIG[level] : READY_CONFIG;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border font-display font-semibold text-[10px] uppercase tracking-[0.06em] flex-shrink-0 ${cfg.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}
