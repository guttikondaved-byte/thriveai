import { useState } from "react";
import { useLocation } from "wouter";
import { Copy, Check, ChevronRight } from "lucide-react";
import { DEMO_COACH_DATA } from "@/lib/demoData";
import { RiskBadge } from "@/components/coach/RiskBadge";
import { PageHeader, Eyebrow } from "@/components/coach/PageHeader";

export default function DemoCoachTeam() {
  const [, navigate] = useLocation();
  const [copied, setCopied] = useState(false);
  const { team, roster } = DEMO_COACH_DATA;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-8">
        <PageHeader
          eyebrow="Athlete Roster"
          title={team.name}
          meta={`${roster.length} athletes on your roster`}
        />
      </div>

      <div className="bg-card border border-primary/30 rounded-xl p-5 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Eyebrow accent className="mb-1">Invite Code</Eyebrow>
          <p className="text-2xl font-mono font-bold text-primary tracking-[0.2em]">{team.inviteCode}</p>
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
          <Eyebrow>Roster</Eyebrow>
        </div>
        <div className="divide-y divide-border/60">
          {roster.map(athlete => (
            <button
              key={athlete.userId}
              onClick={() => navigate(`/demo-coach/athletes/${athlete.userId}`)}
              className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-muted/30 transition-colors"
            >
              <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-foreground flex-shrink-0">
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
              <RiskBadge level={athlete.riskLevel} />
              <ChevronRight size={14} className="text-muted-foreground flex-shrink-0" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
