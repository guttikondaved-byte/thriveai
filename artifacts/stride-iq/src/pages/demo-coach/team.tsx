import { useState } from "react";
import { useLocation } from "wouter";
import { Copy, Check, ChevronRight, Radar, Loader2 } from "lucide-react";
import { DEMO_COACH_DATA, getDemoAthleteDetail } from "@/lib/demoData";
import { RiskBadge } from "@/components/coach/RiskBadge";
import { PageHeader, Eyebrow } from "@/components/coach/PageHeader";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useDemoState, setSuroEnabled, setSuroLastRunAt, addDirectMessage } from "@/lib/demoStore";

// Simulated autonomous pass — same conservative shape as the real Suro
// (lib/suroAgent.ts): check the roster, act on at most one athlete only if
// the data clearly warrants it, otherwise do nothing. Runs against the
// static demo fixture instead of a live LLM + database.
function runSuroDemoPass(): { summary: string; acted: boolean } {
  const { roster } = DEMO_COACH_DATA;
  const flagged = roster.filter(m => m.riskLevel === "high" || m.riskLevel === "medium");
  if (flagged.length === 0) {
    return { summary: "Reviewed the roster — nobody needs attention right now.", acted: false };
  }
  const worst = flagged.find(m => m.riskLevel === "high") ?? flagged[0];
  const detail = getDemoAthleteDetail(worst.userId);
  const alert = detail?.alerts[0];
  const content = alert
    ? `Noticed your ${alert.bodyPart} alert (${alert.riskLevel} risk): ${alert.recommendation}`
    : `Your training load looks elevated this week (${worst.weeklyDistanceKm}km, HRV ${worst.hrv}ms) — consider an easy day before your next hard session.`;
  addDirectMessage(worst.userId, "coach", content, "suro");
  return { summary: `Sent ${worst.name} a check-in about their ${alert ? alert.bodyPart + " alert" : "training load"}.`, acted: true };
}

export default function DemoCoachTeam() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [suroRunning, setSuroRunning] = useState(false);
  const demoState = useDemoState();
  const { team, roster } = DEMO_COACH_DATA;

  function runSuroNow() {
    setSuroRunning(true);
    setTimeout(() => {
      const result = runSuroDemoPass();
      setSuroLastRunAt(new Date().toISOString());
      setSuroRunning(false);
      toast({ title: result.acted ? "Suro took action" : "Suro found nothing to act on", description: result.summary });
    }, 1200);
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-8">
        <PageHeader
          eyebrow="Athlete Roster"
          title={team.name}
          meta={`${roster.length} athletes on your roster`}
        />
      </div>

      <div className="bg-card border border-border rounded-xl p-5 mb-6 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <Radar className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Suro</p>
              <p className="text-xs text-muted-foreground mt-0.5 max-w-sm">
                An autonomous agent that reviews your roster on its own schedule and can message an athlete or leave an alert note without you asking — no approval step.
              </p>
              {demoState.suroEnabled && (
                <p className="text-[11px] text-muted-foreground mt-2">
                  {demoState.suroLastRunAt ? `Last ran ${new Date(demoState.suroLastRunAt).toLocaleString()}` : "Hasn't run yet — runs roughly once a day."}
                </p>
              )}
            </div>
          </div>
          <Switch checked={demoState.suroEnabled} onCheckedChange={setSuroEnabled} aria-label="Toggle Suro" />
        </div>
        {demoState.suroEnabled && (
          <button
            onClick={runSuroNow}
            disabled={suroRunning}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-secondary transition-colors disabled:opacity-50"
          >
            {suroRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Radar className="w-3.5 h-3.5" />}
            {suroRunning ? "Running…" : "Run Suro now"}
          </button>
        )}
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
