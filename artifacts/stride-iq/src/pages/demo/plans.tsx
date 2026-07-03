import { useState } from "react";
import { Calendar, Pencil, X, Check, Bot, Loader2 } from "lucide-react";
import { DEMO_DATA } from "@/lib/demoData";

const SESSION_TYPES = ["Rest", "Easy Run", "Tempo Run", "Interval", "Long Run", "Cross Training"];

type PlanDay = { day: string; label: string; detail: string };
type AveraFlow = "idle" | "loading" | "proposal" | "applying" | "done";

export default function DemoPlans() {
  const [weeklyPlan, setWeeklyPlan] = useState<PlanDay[]>(DEMO_DATA.weeklyPlan);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<PlanDay[]>(DEMO_DATA.weeklyPlan);
  const [saved, setSaved] = useState(false);
  const [averaFlow, setAveraFlow] = useState<AveraFlow>("idle");

  const proposal = DEMO_DATA.averaWeeklyPlanProposal;
  const showAveraPanel = averaFlow !== "idle";

  function startEditing() {
    setDraft(weeklyPlan.map(d => ({ ...d })));
    setEditing(true);
    setSaved(false);
  }

  function updateDraftDay(index: number, patch: Partial<PlanDay>) {
    setDraft(prev => prev.map((d, i) => (i === index ? { ...d, ...patch } : d)));
  }

  function saveChanges() {
    setWeeklyPlan(draft);
    setEditing(false);
    setSaved(true);
  }

  function buildWithAvera() {
    setEditing(false);
    setAveraFlow("loading");
    setTimeout(() => setAveraFlow("proposal"), 1400);
  }

  function applyAveraPlan() {
    setAveraFlow("applying");
    setTimeout(() => {
      setWeeklyPlan(proposal.sessions);
      setAveraFlow("done");
      setSaved(false);
    }, 900);
  }

  return (
    <div className="p-8">
      <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display font-extrabold text-3xl tracking-[-0.01em] text-foreground">Training Plans</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Self-managed: Jordan isn't connected to a coach, so this plan is fully editable.
          </p>
        </div>
        {!editing && averaFlow === "idle" && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={buildWithAvera}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 border border-primary/30 text-primary text-sm font-semibold hover:bg-primary/20 transition-colors"
            >
              <Bot className="w-4 h-4" />
              Build with Avera
            </button>
            <button
              onClick={startEditing}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-foreground text-sm font-semibold hover:bg-secondary transition-colors"
            >
              <Pencil className="w-4 h-4" />
              Edit Plan
            </button>
          </div>
        )}
      </div>

      <div className="bg-card border border-primary/30 rounded-lg p-5 mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Calendar className="w-4 h-4 text-primary" />
          <span className="text-xs font-semibold text-primary uppercase tracking-wider">Active Plan</span>
        </div>
        <p className="text-lg font-semibold text-foreground">{DEMO_DATA.currentPlanName}</p>
        <p className="text-sm text-muted-foreground mt-1">Goal: {DEMO_DATA.primaryGoal}</p>
      </div>

      {saved && !editing && !showAveraPanel && (
        <div className="flex items-center gap-2 text-emerald-600 text-sm font-medium mb-4">
          <Check className="w-4 h-4" /> Plan updated (demo edit, sign up to save this for real).
        </div>
      )}

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
              Avera is reviewing your training and injury alerts…
            </div>
          )}

          {(averaFlow === "proposal" || averaFlow === "applying" || averaFlow === "done") && (
            <div className="px-5 py-4 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <p className="text-base font-semibold text-foreground">{proposal.name}</p>
                <p className="text-sm font-semibold text-foreground shrink-0">{proposal.weeklyMileage} mi/wk</p>
              </div>

              <p className="text-xs text-muted-foreground italic border-l-2 border-primary/30 pl-3 leading-relaxed">
                "{proposal.rationale}"
              </p>

              <div className="space-y-1.5">
                {proposal.sessions.map(s => (
                  <div key={s.day} className="flex items-center gap-3 text-xs bg-background rounded-lg px-3 py-2">
                    <span className="w-16 font-semibold text-muted-foreground shrink-0">{s.day.slice(0, 3)}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded font-medium shrink-0 ${
                        s.label === "Rest" ? "bg-secondary text-muted-foreground" : "bg-primary/10 text-primary"
                      }`}
                    >
                      {s.label}
                    </span>
                    <span className="text-foreground flex-1">{s.detail}</span>
                  </div>
                ))}
              </div>

              {averaFlow === "done" ? (
                <div className="flex items-center gap-2 text-emerald-600 text-sm font-medium">
                  <Check className="w-4 h-4" /> Plan updated (demo edit, sign up to save this for real).
                </div>
              ) : (
                <button
                  onClick={applyAveraPlan}
                  disabled={averaFlow === "applying"}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-60 transition-colors"
                >
                  {averaFlow === "applying" && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Use This Week's Plan
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {editing ? (
        <div className="bg-card border border-primary/30 rounded-lg divide-y divide-border">
          {draft.map((day, i) => (
            <div key={day.day} className="flex flex-col sm:flex-row sm:items-center gap-3 p-5">
              <p className="text-sm font-semibold text-foreground w-24 shrink-0">{day.day}</p>
              <select
                value={day.label}
                onChange={e => updateDraftDay(i, { label: e.target.value })}
                className="bg-secondary/50 border border-border rounded-lg px-3 py-1.5 text-sm text-foreground shrink-0"
              >
                {SESSION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <input
                value={day.detail}
                onChange={e => updateDraftDay(i, { detail: e.target.value })}
                placeholder="Session detail…"
                className="flex-1 bg-secondary/50 border border-border rounded-lg px-3 py-1.5 text-sm text-foreground"
              />
            </div>
          ))}
          <div className="flex items-center justify-end gap-3 p-5">
            <button
              onClick={() => setEditing(false)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              Cancel
            </button>
            <button
              onClick={saveChanges}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors"
            >
              <Check className="w-3.5 h-3.5" />
              Save Changes
            </button>
          </div>
        </div>
      ) : (
        !showAveraPanel && (
          <div className="bg-card border border-border rounded-lg divide-y divide-border">
            {weeklyPlan.map(day => (
              <div key={day.day} className="flex items-center justify-between p-5">
                <div>
                  <p className="text-sm font-semibold text-foreground">{day.day}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{day.detail}</p>
                </div>
                <span
                  className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                    day.label === "Rest"
                      ? "bg-secondary text-muted-foreground"
                      : "bg-primary/10 text-primary"
                  }`}
                >
                  {day.label}
                </span>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
