import { useLocation } from "wouter";
import { TrendingUp, Users, Activity, ChevronRight } from "lucide-react";
import { getFocusConfig } from "@/lib/coachingFocus";
import { DEMO_COACH_DATA } from "@/lib/demoData";
import { RiskBadge, RISK_CONFIG } from "@/components/coach/RiskBadge";
import { StatCard } from "@/components/coach/StatCard";
import { PageHeader, Eyebrow } from "@/components/coach/PageHeader";

export default function DemoCoachDashboard() {
  const [, navigate] = useLocation();
  const focus = getFocusConfig(DEMO_COACH_DATA.focus);
  const { team, roster } = DEMO_COACH_DATA;

  const avgMiles = roster.reduce((a, m) => a + m.weeklyDistanceKm, 0) / roster.length;
  const avgWorkouts = roster.reduce((a, m) => a + m.weeklyWorkouts, 0) / roster.length;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-8">
        <PageHeader
          eyebrow={`Team Dashboard · ${focus.label}`}
          title={team.name}
          meta={`Good morning, Coach ${DEMO_COACH_DATA.coachName} · ${roster.length} ${focus.athleteNoun}`}
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
        <StatCard label="Total Athletes" value={roster.length} sub="On your team" icon={Users} />
        <StatCard label={focus.distanceLabel} value={avgMiles.toFixed(1)} sub="avg mi this week" icon={Activity} />
        <StatCard label="Avg Workouts" value={avgWorkouts.toFixed(1)} sub="per athlete this week" icon={TrendingUp} />
      </div>

      <div className="mb-6">
        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <Eyebrow>Athlete Roster</Eyebrow>
            <span className="text-muted-foreground text-xs">{roster.length} athletes</span>
          </div>
          <div className="divide-y divide-border/60">
            {roster.map(athlete => {
              const cfg = RISK_CONFIG[athlete.riskLevel];
              return (
                <button
                  key={athlete.userId}
                  onClick={() => navigate(`/demo-coach/athletes/${athlete.userId}`)}
                  className={`w-full flex items-center gap-4 px-5 py-3.5 text-left hover:bg-muted/30 transition-colors ${cfg.row}`}
                >
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-foreground flex-shrink-0">
                    {athlete.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-foreground truncate">{athlete.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{athlete.primaryGoal}</div>
                  </div>
                  <div className="text-right hidden sm:block">
                    <div className="font-display font-bold text-sm text-foreground">{athlete.weeklyDistanceKm.toFixed(1)} mi</div>
                    <div className="text-[10px] text-muted-foreground">this week</div>
                  </div>
                  <div className="text-right hidden md:block">
                    <div className="text-xs text-foreground font-medium">HR {athlete.restingHeartRate}</div>
                    <div className="text-[10px] text-muted-foreground">HRV {athlete.hrv.toFixed(0)}</div>
                  </div>
                  <RiskBadge level={athlete.riskLevel} />
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
