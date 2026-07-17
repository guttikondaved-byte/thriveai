import { useState } from "react";
import { Calendar, Bot, Loader2, X, Check, Pencil } from "lucide-react";
import { DEMO_COACH_DATA } from "@/lib/demoData";
import { PageHeader } from "@/components/coach/PageHeader";
import { useDemoState } from "@/lib/demoStore";

const STATUS_COLORS: Record<string, string> = {
  active: "text-[#10b981] bg-[#10b981]/10 border-[#10b981]/20",
  paused: "text-[#f59e0b] bg-[#f59e0b]/10 border-[#f59e0b]/20",
};

const SESSION_LABELS: Record<string, string> = {
  easy_run: "Easy", tempo_run: "Tempo", interval: "Intervals",
  long_run: "Long", cross_training: "Cross", rest: "Rest", race: "Race",
};

type AveraFlow = "idle" | "loading" | "proposal" | "applying" | "done";
type Plan = (typeof DEMO_COACH_DATA)["plans"][number];

export default function DemoCoachPlans() {
  const [manualPlans, setManualPlans] = useState(DEMO_COACH_DATA.plans);
  const demoState = useDemoState();
  // Plans AveraAI actually assigned via chat (see demo-coach/coach.tsx's
  // create_team_plan-equivalent flow) — merged in here so a chat action
  // really does show up on the Plans page, not just as a chat bubble.
  const chatPlans: Plan[] = demoState.extraPlans.map(p => ({
    id: p.id,
    athleteName: p.athleteName,
    name: p.name,
    goal: p.goal,
    status: p.status,
    weeklyMileage: p.weeklyMileage,
  }));
  // Edits AveraAI made to an EXISTING plan (update_team_plan-equivalent),
  // applied on top of the base fixture rather than appended as a new row.
  const overriddenManualPlans = manualPlans.map(p =>
    demoState.planOverrides[p.id] ? { ...p, ...demoState.planOverrides[p.id] } : p
  );
  const plans = [...overriddenManualPlans, ...chatPlans];
  const setPlans = setManualPlans;
  const [averaFlow, setAveraFlow] = useState<AveraFlow>("idle");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Plan | null>(null);
  const proposal = DEMO_COACH_DATA.averaPlanProposal;

  function startEdit(plan: Plan) {
    setEditingId(plan.id);
    setDraft({ ...plan });
  }

  function saveEdit() {
    if (!draft) return;
    setPlans(prev => prev.map(p => (p.id === draft.id ? draft : p)));
    setEditingId(null);
    setDraft(null);
  }

  function buildWithAvera() {
    setAveraFlow("loading");
    setTimeout(() => setAveraFlow("proposal"), 1400);
  }

  function applyAveraPlan() {
    setAveraFlow("applying");
    setTimeout(() => {
      setAveraFlow("done");
      setPlans(prev => [
        ...prev,
        {
          id: Math.max(0, ...prev.map(p => p.id)) + 1,
          athleteName: proposal.athleteName,
          name: proposal.name,
          goal: proposal.goal,
          status: "active" as const,
          weeklyMileage: proposal.weeklyMileage,
        },
      ]);
    }, 900);
  }

  const showAveraPanel = averaFlow !== "idle";

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-8">
        <PageHeader
          eyebrow="Coach Tools"
          title="Training Plans"
          meta="Assigned across your roster"
          action={
            <button
              onClick={averaFlow === "idle" ? buildWithAvera : undefined}
              disabled={averaFlow === "loading" || averaFlow === "applying"}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 shadow-[0_14px_30px_-12px_rgba(46,144,217,0.6)] disabled:opacity-60 transition-colors"
            >
              {averaFlow === "loading" || averaFlow === "applying" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Bot className="w-4 h-4" />
              )}
              {averaFlow === "loading" ? "Avera is thinking…" : averaFlow === "applying" ? "Adding plan…" : "Build plan with Avera"}
            </button>
          }
        />
      </div>

      {showAveraPanel && (
        <div className="mb-6 rounded-xl border border-primary/30 bg-primary/5 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-primary/15">
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold text-primary">AveraAI Plan Builder</span>
            </div>
            <button
              onClick={() => setAveraFlow("idle")}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {averaFlow === "loading" && (
            <div className="px-5 py-8 flex items-center justify-center gap-3 text-muted-foreground text-sm">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              Avera is reviewing your team and designing a personalised plan…
            </div>
          )}

          {(averaFlow === "proposal" || averaFlow === "applying" || averaFlow === "done") && (
            <div className="px-5 py-4 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-base font-semibold text-foreground">{proposal.name}</p>
                  <p className="text-sm text-primary mt-0.5">for {proposal.athleteName}</p>
                  <p className="text-sm text-muted-foreground mt-1">{proposal.goal}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-foreground">{proposal.weeklyMileage} mi/wk</p>
                  <p className="text-xs text-muted-foreground">{proposal.sessions.length} sessions</p>
                </div>
              </div>

              <div className="flex gap-4 text-xs text-muted-foreground">
                <span>{proposal.startDate} → {proposal.endDate}</span>
              </div>

              <p className="text-xs text-muted-foreground italic border-l-2 border-primary/30 pl-3 leading-relaxed">
                "{proposal.rationale}"
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(["easy_run", "tempo_run", "interval", "long_run", "cross_training", "rest", "race"] as const).map(type => {
                  const count = proposal.sessions.filter(s => s.sessionType === type).length;
                  if (count === 0) return null;
                  return (
                    <div key={type} className="bg-background rounded-lg px-3 py-2 text-center">
                      <p className="text-sm font-semibold text-foreground">{count}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{SESSION_LABELS[type]}</p>
                    </div>
                  );
                })}
              </div>

              <div className="space-y-1.5">
                {proposal.sessions.map((s, i) => (
                  <div key={i} className="flex items-center gap-3 text-xs bg-background rounded-lg px-3 py-2">
                    <span className="w-8 font-semibold text-muted-foreground shrink-0">
                      {["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][s.dayOfWeek]}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium shrink-0">
                      {SESSION_LABELS[s.sessionType] ?? s.sessionType}
                    </span>
                    <span className="text-foreground flex-1">{s.description}</span>
                    {s.distanceMiles > 0 && <span className="text-muted-foreground shrink-0">{s.distanceMiles} mi</span>}
                  </div>
                ))}
              </div>

              {averaFlow === "done" ? (
                <div className="flex items-center gap-2 text-emerald-600 text-sm font-medium">
                  <Check className="w-4 h-4" /> Plan added to {proposal.athleteName}'s profile
                </div>
              ) : (
                <div className="flex items-center gap-3 pt-1">
                  <button
                    onClick={applyAveraPlan}
                    disabled={averaFlow === "applying"}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-60 transition-colors"
                  >
                    {averaFlow === "applying" && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Add to Training Plan
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="bg-background border border-border rounded-xl divide-y divide-border/60">
        {plans.map(plan =>
          editingId === plan.id && draft ? (
            <div key={plan.id} className="px-5 py-4 space-y-3 bg-primary/5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <Calendar className="w-4 h-4" />
                </div>
                <input
                  value={draft.name}
                  onChange={e => setDraft({ ...draft, name: e.target.value })}
                  className="flex-1 bg-card border border-border rounded-lg px-3 py-1.5 text-sm font-semibold text-foreground"
                />
              </div>
              <input
                value={draft.goal}
                onChange={e => setDraft({ ...draft, goal: e.target.value })}
                placeholder="Goal…"
                className="w-full bg-card border border-border rounded-lg px-3 py-1.5 text-sm text-foreground"
              />
              <div className="flex items-center gap-3 flex-wrap">
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  Weekly mileage
                  <input
                    type="number"
                    value={draft.weeklyMileage}
                    onChange={e => setDraft({ ...draft, weeklyMileage: Number(e.target.value) })}
                    className="w-20 bg-card border border-border rounded-lg px-2 py-1 text-sm text-foreground"
                  />
                </label>
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  Status
                  <select
                    value={draft.status}
                    onChange={e => setDraft({ ...draft, status: e.target.value as Plan["status"] })}
                    className="bg-card border border-border rounded-lg px-2 py-1 text-sm text-foreground"
                  >
                    <option value="active">active</option>
                    <option value="paused">paused</option>
                  </select>
                </label>
              </div>
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  onClick={() => { setEditingId(null); setDraft(null); }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                  Cancel
                </button>
                <button
                  onClick={saveEdit}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors"
                >
                  <Check className="w-3.5 h-3.5" />
                  Save
                </button>
              </div>
            </div>
          ) : (
            <div key={plan.id} className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <Calendar className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{plan.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{plan.athleteName} · {plan.goal}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="text-right hidden sm:block">
                  <p className="text-xs font-medium text-foreground">{plan.weeklyMileage} mi/wk</p>
                </div>
                <span className={`font-display font-semibold text-[10px] uppercase tracking-[0.05em] px-2.5 py-1 rounded-md border ${STATUS_COLORS[plan.status]}`}>
                  {plan.status}
                </span>
                <button
                  onClick={() => startEdit(plan)}
                  aria-label={`Edit ${plan.name}`}
                  className="text-muted-foreground hover:text-primary transition-colors"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              </div>
            </div>
          ),
        )}
      </div>
    </div>
  );
}
