import { useLocation } from "wouter";
import { TrendingUp, Users, Activity, ChevronRight } from "lucide-react";
import { getFocusConfig } from "@/lib/coachingFocus";
import { DEMO_COACH_DATA } from "@/lib/demoData";

type RiskLevel = "high" | "medium" | "low";

const RISK_CONFIG: Record<RiskLevel, { label: string; dot: string; badge: string; row: string }> = {
  low:    { label: "Low Risk",    dot: "bg-[#10b981]", badge: "bg-[#10b981]/10 text-[#10b981] border-[#10b981]/20", row: "bg-[#10b981]/5" },
  medium: { label: "Caution",     dot: "bg-[#f59e0b]", badge: "bg-[#f59e0b]/10 text-[#f59e0b] border-[#f59e0b]/20", row: "bg-[#f59e0b]/5" },
  high:   { label: "Injury Risk", dot: "bg-[#ef4444] animate-pulse", badge: "bg-[#ef4444]/10 text-[#ef4444] border-[#ef4444]/20", row: "bg-[#ef4444]/5" },
};

function StatCard({ label, value, sub, icon: Icon, accent }: { label: string; value: string | number; sub: string; icon: React.ElementType; accent: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
      <div className="flex items-start justify-between mb-4">
        <span className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">{label}</span>
        <div className={`w-8 h-8 rounded-lg ${accent} flex items-center justify-center`}>
          <Icon size={16} />
        </div>
      </div>
      <div className="text-3xl font-bold text-foreground mb-1 tracking-tight">{value}</div>
      <div className="text-muted-foreground text-xs font-medium">{sub}</div>
    </div>
  );
}

export default function DemoCoachDashboard() {
  const [, navigate] = useLocation();
  const focus = getFocusConfig(DEMO_COACH_DATA.focus);
  const { team, roster } = DEMO_COACH_DATA;

  const avgMiles = roster.reduce((a, m) => a + m.weeklyDistanceKm, 0) / roster.length;
  const avgHrv = roster.reduce((a, m) => a + m.hrv, 0) / roster.length;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <p className={`text-xs font-semibold uppercase tracking-[0.15em] ${focus.accentText}`}>Good morning, Coach {DEMO_COACH_DATA.coachName}</p>
        <h1 className="text-2xl font-bold text-foreground mt-1">{focus.headline}</h1>
        <p className="text-muted-foreground text-sm mt-0.5">{team.name} · {roster.length} {focus.athleteNoun}</p>
      </div>

      <div className={`mb-8 rounded-xl border ${focus.accentBorder} ${focus.accentBg} p-5`}>
        <div className="flex items-start gap-4">
          <div className={`w-10 h-10 rounded-lg ${focus.accentBg} border ${focus.accentBorder} flex items-center justify-center shrink-0 ${focus.accentText}`}>
            <focus.icon size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs font-bold uppercase tracking-[0.15em] ${focus.accentText}`}>{focus.label}</span>
              <span className="text-[10px] text-muted-foreground">·</span>
              <span className="text-[11px] text-muted-foreground">Portal tuned for your {focus.athleteNoun}</span>
            </div>
            <p className="text-sm text-foreground mt-1 leading-relaxed">{focus.tagline}</p>
            <p className={`text-[11px] italic mt-1 ${focus.accentText} opacity-80`}>"{focus.philosophy}"</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {focus.focusAreas.map(area => (
                <span key={area} className={`text-[11px] font-medium px-2.5 py-1 rounded-full border ${focus.accentBorder} ${focus.accentText} bg-background/40`}>
                  {area}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <StatCard label={`Total ${focus.athleteNoun}`} value={roster.length} sub="On your team" icon={Users} accent={`${focus.accentBg} ${focus.accentText}`} />
        <StatCard label={focus.distanceLabel} value={avgMiles.toFixed(1)} sub="avg mi this week" icon={Activity} accent={`${focus.accentBg} ${focus.accentText}`} />
        <StatCard label="Avg HRV" value={avgHrv.toFixed(1)} sub="across team" icon={TrendingUp} accent="bg-primary/10 text-primary" />
      </div>

      <div className="mb-6">
        <div className="bg-background border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h2 className="font-semibold text-foreground text-sm">Athlete Roster</h2>
            <span className="text-muted-foreground text-xs">{roster.length} athletes</span>
          </div>
          <div className="divide-y divide-border/60">
            {roster.map(athlete => {
              const cfg = RISK_CONFIG[athlete.riskLevel];
              return (
                <button
                  key={athlete.userId}
                  onClick={() => navigate("/demo-coach/team")}
                  className={`w-full flex items-center gap-4 px-5 py-3.5 text-left hover:bg-muted/30 transition-colors ${cfg.row}`}
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-muted to-muted flex items-center justify-center text-xs font-bold text-foreground flex-shrink-0">
                    {athlete.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">{athlete.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{athlete.primaryGoal}</div>
                  </div>
                  <div className="text-right hidden sm:block">
                    <div className="text-xs text-foreground font-medium">{athlete.weeklyDistanceKm.toFixed(1)} mi</div>
                    <div className="text-[10px] text-muted-foreground">this week</div>
                  </div>
                  <div className="text-right hidden md:block">
                    <div className="text-xs text-foreground font-medium">HR {athlete.restingHeartRate}</div>
                    <div className="text-[10px] text-muted-foreground">HRV {athlete.hrv.toFixed(0)}</div>
                  </div>
                  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium flex-shrink-0 ${cfg.badge}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                    {cfg.label}
                  </div>
                  <ChevronRight size={14} className="text-muted-foreground flex-shrink-0" />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
