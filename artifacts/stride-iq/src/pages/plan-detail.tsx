import { useGetTrainingPlan } from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { ArrowLeft, CheckCircle2, Circle } from "lucide-react";
import { format } from "date-fns";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const SESSION_COLORS: Record<string, string> = {
  easy_run: "text-[#10b981] bg-[#10b981]/10 border-[#10b981]/20", // Emerald
  tempo_run: "text-[#3b82f6] bg-[#3b82f6]/10 border-[#3b82f6]/20", // Blue
  interval: "text-[#8b5cf6] bg-[#8b5cf6]/10 border-[#8b5cf6]/20", // Violet
  long_run: "text-[#f59e0b] bg-[#f59e0b]/10 border-[#f59e0b]/20", // Amber
  race: "text-[#ef4444] bg-[#ef4444]/10 border-[#ef4444]/20", // Red
  cross_training: "text-[#06b6d4] bg-[#06b6d4]/10 border-[#06b6d4]/20", // Cyan
  rest: "text-slate-400 bg-slate-800 border-slate-700",
};

const SESSION_LABELS: Record<string, string> = {
  easy_run: "Easy", tempo_run: "Tempo", interval: "Interval",
  long_run: "Long Run", race: "Race", cross_training: "X-Train", rest: "Rest",
};

export default function PlanDetail() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id, 10);
  const { data: plan, isLoading } = useGetTrainingPlan(id, { query: { enabled: !!id, queryKey: ["getTrainingPlan", id] } });

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="h-8 w-48 bg-card border border-border rounded animate-pulse mb-8" />
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => <div key={i} className="h-32 bg-card border border-border rounded-lg animate-pulse" />)}
        </div>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="p-8">
        <p className="text-muted-foreground">Plan not found.</p>
      </div>
    );
  }

  const weeks = Array.from(new Set(plan.sessions.map(s => s.weekNumber))).sort((a, b) => a - b);

  return (
    <div className="p-8">
      <div className="mb-6">
        <Link href="/plans" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-4 transition-colors" data-testid="link-back-to-plans">
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Plans
        </Link>
        <h1 className="text-2xl font-semibold text-foreground" data-testid="plan-detail-title">{plan.name}</h1>
        <p className="text-sm text-muted-foreground mt-1">{plan.goal}</p>
        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
          <span>{format(new Date(plan.startDate), "MMM d, yyyy")} – {format(new Date(plan.endDate), "MMM d, yyyy")}</span>
          {plan.weeklyMileage && <span>{plan.weeklyMileage} mi/week target</span>}
        </div>
      </div>

      {weeks.length === 0 ? (
        <div className="bg-card border border-border rounded-lg py-12 text-center">
          <p className="text-sm text-muted-foreground">No sessions scheduled yet.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {weeks.map(week => {
            const weekSessions = plan.sessions.filter(s => s.weekNumber === week);
            const completedCount = weekSessions.filter(s => s.completed).length;
            return (
              <div key={week} className="bg-card border border-border rounded-lg overflow-hidden" data-testid={`week-${week}`}>
                <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-secondary/30">
                  <h2 className="text-sm font-medium text-foreground">Week {week}</h2>
                  <span className="text-xs text-muted-foreground">{completedCount}/{weekSessions.length} sessions done</span>
                </div>
                <div className="divide-y divide-border">
                  {weekSessions.map(session => (
                    <div key={session.id} className="flex items-start gap-4 px-5 py-4" data-testid={`session-${session.id}`}>
                      {session.completed
                        ? <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                        : <Circle className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                      }
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs px-2 py-0.5 rounded border font-medium ${SESSION_COLORS[session.sessionType] ?? "text-muted-foreground bg-secondary border-border"}`}>
                            {SESSION_LABELS[session.sessionType] ?? session.sessionType}
                          </span>
                          <span className="text-xs text-muted-foreground">{DAY_LABELS[(session.dayOfWeek - 1) % 7]}</span>
                        </div>
                        <p className="text-sm text-foreground">{session.description}</p>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                          {session.distanceKm && <span>{session.distanceKm} mi</span>}
                          {session.durationMinutes && <span>{session.durationMinutes} min</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
