import { useState } from "react";
import { useLocation } from "wouter";
import { Users, Copy, Check, ChevronRight } from "lucide-react";
import { DEMO_COACH_DATA } from "@/lib/demoData";

type RiskLevel = "high" | "medium" | "low";

const RISK_BADGE: Record<RiskLevel, string> = {
  low: "bg-[#10b981]/10 text-[#10b981] border-[#10b981]/20",
  medium: "bg-[#f59e0b]/10 text-[#f59e0b] border-[#f59e0b]/20",
  high: "bg-[#ef4444]/10 text-[#ef4444] border-[#ef4444]/20",
};

export default function DemoCoachTeam() {
  const [, navigate] = useLocation();
  const [copied, setCopied] = useState(false);
  const { team, roster } = DEMO_COACH_DATA;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
          <Users className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">{team.name}</h1>
          <p className="text-muted-foreground text-sm">{roster.length} athletes on your roster</p>
        </div>
      </div>

      <div className="bg-card border border-primary/30 rounded-xl p-5 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs text-primary font-semibold uppercase tracking-wider mb-1">Invite Code</p>
          <p className="text-lg font-mono font-bold text-foreground">{team.inviteCode}</p>
          <p className="text-xs text-muted-foreground mt-1">Share this with athletes to add them to your team.</p>
        </div>
        <button
          onClick={() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-secondary transition-colors shrink-0"
        >
          {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
          {copied ? "Copied" : "Copy code"}
        </button>
      </div>

      <div className="bg-background border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-foreground text-sm">Roster</h2>
        </div>
        <div className="divide-y divide-border/60">
          {roster.map(athlete => (
            <button
              key={athlete.userId}
              onClick={() => navigate("/sign-up?role=coach")}
              className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-muted/30 transition-colors"
            >
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-muted to-muted flex items-center justify-center text-xs font-bold text-foreground flex-shrink-0">
                {athlete.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-foreground truncate">{athlete.name}</div>
                <div className="text-xs text-muted-foreground truncate">{athlete.email}</div>
              </div>
              <div className="text-right hidden sm:block">
                <div className="text-xs text-foreground font-medium">{athlete.fitnessLevel}</div>
                <div className="text-[10px] text-muted-foreground">{athlete.weeklyDistanceKm.toFixed(1)} mi/wk</div>
              </div>
              <div className={`px-2.5 py-1 rounded-full border text-xs font-medium flex-shrink-0 ${RISK_BADGE[athlete.riskLevel]}`}>
                {athlete.riskLevel === "low" ? "Low Risk" : athlete.riskLevel === "medium" ? "Caution" : "Injury Risk"}
              </div>
              <ChevronRight size={14} className="text-muted-foreground flex-shrink-0" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
