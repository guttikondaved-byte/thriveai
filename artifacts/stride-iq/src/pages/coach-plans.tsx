import { useState, useEffect } from "react";
import { Plus, X, Trash2, Calendar, ChevronDown, ChevronUp, Bot, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { PageHeader, Eyebrow } from "@/components/coach/PageHeader";

interface Athlete {
  userId: string;
  name: string;
  fitnessLevel: string;
  primaryGoal: string;
}

interface TeamPlan {
  id: number;
  userId: string;
  athleteName: string;
  name: string;
  goal: string;
  startDate: string;
  endDate: string;
  weeklyMileage: number | null;
  status: string;
  createdAt: string;
}

interface ProposedSessionChange {
  sessionId: number | null;
  weekNumber: number;
  dayOfWeek: number;
  sessionType: string;
  description: string;
  distanceKm: number | null;
  durationMinutes: number | null;
}

interface PlanSuggestion {
  id: number;
  planId: number;
  planName: string;
  athleteName: string;
  submittedBy: string;
  sessions: ProposedSessionChange[];
  note: string | null;
  status: string;
  createdAt: string;
}

type AveraFlow = "idle" | "loading" | "proposal" | "applying" | "done" | "error";

interface AveraProposal {
  athleteUserId: string;
  athleteName: string;
  name: string;
  goal: string;
  startDate: string;
  endDate: string;
  weeklyMileage: number;
  rationale: string;
  sessions: Array<{
    weekNumber: number;
    dayOfWeek: number;
    sessionType: string;
    description: string;
    distanceMiles: number;
    durationMinutes: number;
  }>;
}

const STATUS_COLORS: Record<string, string> = {
  active: "text-[#10b981] bg-[#10b981]/10 border-[#10b981]/20",
  completed: "text-muted-foreground bg-muted/10 border-border/20",
  paused: "text-[#f59e0b] bg-[#f59e0b]/10 border-[#f59e0b]/20",
  pending: "text-primary bg-primary/10 border-primary/20",
  rejected: "text-red-600 bg-red-500/10 border-red-500/20",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Suggested — pending review",
  rejected: "Not approved",
};

const SESSION_LABELS: Record<string, string> = {
  easy_run: "Easy", tempo_run: "Tempo", interval: "Intervals",
  long_run: "Long", cross_training: "Cross", rest: "Rest", race: "Race",
};
const DAY_LABELS = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function CoachPlans() {
  const { toast } = useToast();
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [plans, setPlans] = useState<TeamPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedAthleteId, setExpandedAthleteId] = useState<string | null>(null);
  const [showFormFor, setShowFormFor] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [reviewing, setReviewing] = useState<number | null>(null);
  const [suggestions, setSuggestions] = useState<PlanSuggestion[]>([]);
  const [reviewingSuggestion, setReviewingSuggestion] = useState<number | null>(null);

  const [averaFlow, setAveraFlow] = useState<AveraFlow>("idle");
  const [averaProposal, setAveraProposal] = useState<AveraProposal | null>(null);
  const [averaError, setAveraError] = useState("");

  const [form, setForm] = useState({
    name: "", goal: "", startDate: format(new Date(), "yyyy-MM-dd"), endDate: "", weeklyMileage: "",
  });

  useEffect(() => {
    Promise.all([
      fetch("/api/coach/team-athletes", { credentials: "include" }).then(r => r.json()),
      fetch("/api/coach/team-plans", { credentials: "include" }).then(r => r.json()),
      fetch("/api/coach/plan-suggestions", { credentials: "include" }).then(r => r.json()),
    ]).then(([a, p, s]) => {
      setAthletes(Array.isArray(a) ? a : []);
      setPlans(Array.isArray(p) ? p : []);
      setSuggestions(Array.isArray(s) ? s.filter((x: PlanSuggestion) => x.status === "pending") : []);
      if (Array.isArray(a) && a.length > 0) setExpandedAthleteId(a[0].userId);
    }).catch(() => {
      toast({ title: "Error", description: "Failed to load team data", variant: "destructive" });
    }).finally(() => setLoading(false));
  }, []);

  async function createPlan(athleteUserId: string) {
    if (!form.name || !form.goal || !form.startDate || !form.endDate) {
      toast({ title: "Fill in all required fields", variant: "destructive" }); return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/coach/team-plans", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          athleteUserId,
          name: form.name,
          goal: form.goal,
          startDate: form.startDate,
          endDate: form.endDate,
          ...(form.weeklyMileage ? { weeklyMileage: parseFloat(form.weeklyMileage) } : {}),
        }),
      });
      if (!res.ok) throw new Error();
      const newPlan = await res.json() as TeamPlan;
      const athlete = athletes.find(a => a.userId === athleteUserId);
      setPlans(prev => [...prev, { ...newPlan, athleteName: athlete?.name ?? "Athlete" }]);
      setShowFormFor(null);
      setForm({ name: "", goal: "", startDate: format(new Date(), "yyyy-MM-dd"), endDate: "", weeklyMileage: "" });
      toast({ title: "Training plan created" });
    } catch {
      toast({ title: "Error", description: "Failed to create plan", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  async function reviewPlan(planId: number, action: "approve" | "reject") {
    setReviewing(planId);
    try {
      const res = await fetch(`/api/coach/team-plans/${planId}/${action}`, { method: "POST", credentials: "include" });
      if (!res.ok) throw new Error();
      const updated = await res.json() as TeamPlan;
      setPlans(prev => prev.map(p => (p.id === planId ? { ...p, status: updated.status } : p)));
      toast({ title: action === "approve" ? "Plan approved" : "Plan not approved" });
    } catch {
      toast({ title: "Error", description: `Failed to ${action} plan`, variant: "destructive" });
    } finally {
      setReviewing(null);
    }
  }

  async function reviewSuggestion(suggestionId: number, action: "approve" | "reject") {
    setReviewingSuggestion(suggestionId);
    try {
      const res = await fetch(`/api/coach/plan-suggestions/${suggestionId}/${action}`, { method: "POST", credentials: "include" });
      if (!res.ok) throw new Error();
      setSuggestions(prev => prev.filter(s => s.id !== suggestionId));
      toast({ title: action === "approve" ? "Changes approved" : "Changes not approved" });
    } catch {
      toast({ title: "Error", description: `Failed to ${action} changes`, variant: "destructive" });
    } finally {
      setReviewingSuggestion(null);
    }
  }

  async function deletePlan(planId: number) {
    setDeleting(planId);
    try {
      await fetch(`/api/coach/team-plans/${planId}`, { method: "DELETE", credentials: "include" });
      setPlans(prev => prev.filter(p => p.id !== planId));
      toast({ title: "Plan deleted" });
    } catch {
      toast({ title: "Error", description: "Failed to delete plan", variant: "destructive" });
    } finally {
      setDeleting(null);
    }
  }

  async function buildWithAvera() {
    setAveraFlow("loading");
    setAveraError("");
    setAveraProposal(null);
    try {
      const res = await fetch("/api/openai/suggest-plan", { credentials: "include" });
      const data = await res.json() as { proposal?: AveraProposal; error?: string };
      if (!res.ok || !data.proposal) {
        setAveraError(data.error || "Couldn't generate a plan. Try again.");
        setAveraFlow("error");
        return;
      }
      setAveraProposal(data.proposal);
      setAveraFlow("proposal");
    } catch {
      setAveraError("Network error. Please try again.");
      setAveraFlow("error");
    }
  }

  async function applyAveraPlan() {
    if (!averaProposal) return;
    setAveraFlow("applying");
    setAveraError("");
    try {
      const res = await fetch("/api/openai/apply-plan", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(averaProposal),
      });
      const data = await res.json() as { planId?: number; error?: string };
      if (!res.ok || !data.planId) {
        setAveraError(data.error || "Couldn't add the plan. Try again.");
        setAveraFlow("error");
        return;
      }
      setAveraFlow("done");
      const athlete = athletes.find(a => a.userId === averaProposal.athleteUserId);
      const newPlan: TeamPlan = {
        id: data.planId,
        userId: averaProposal.athleteUserId,
        athleteName: averaProposal.athleteName,
        name: averaProposal.name,
        goal: averaProposal.goal,
        startDate: averaProposal.startDate,
        endDate: averaProposal.endDate,
        weeklyMileage: averaProposal.weeklyMileage,
        status: "active",
        createdAt: new Date().toISOString(),
      };
      setPlans(prev => [...prev, newPlan]);
      setExpandedAthleteId(averaProposal.athleteUserId);
      toast({ title: `Plan added for ${athlete?.name ?? averaProposal.athleteName}` });
    } catch {
      setAveraError("Network error. Please try again.");
      setAveraFlow("error");
    }
  }

  if (loading) {
    return (
      <div className="p-8 space-y-4">
        {[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-muted border border-border rounded-xl animate-pulse" />)}
      </div>
    );
  }

  const showAveraPanel = averaFlow !== "idle";

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-8">
        <PageHeader
          eyebrow="Coach Tools"
          title="Training Plans"
          meta="Manage training plans for each athlete"
          action={
        <Button
          onClick={averaFlow === "idle" || averaFlow === "error" ? buildWithAvera : undefined}
          disabled={averaFlow === "loading" || averaFlow === "applying"}
          className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_14px_30px_-12px_rgba(46,144,217,0.6)] disabled:opacity-60"
        >
          {(averaFlow === "loading" || averaFlow === "applying")
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <Bot className="w-4 h-4" />}
          {averaFlow === "loading" ? "Avera is thinking…"
            : averaFlow === "applying" ? "Adding plan…"
            : "Build plan with Avera"}
        </Button>
          }
        />
      </div>

      {suggestions.length > 0 && (
        <div className="mb-6">
          <Eyebrow className="mb-3">Suggested Changes ({suggestions.length})</Eyebrow>
          <div className="space-y-3">
            {suggestions.map(s => (
              <div key={s.id} className="bg-background border border-primary/40 rounded-xl p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{s.athleteName} · {s.planName}</p>
                    <p className="text-xs text-muted-foreground">{s.sessions.length} session{s.sessions.length === 1 ? "" : "s"} proposed</p>
                  </div>
                </div>
                {s.note && (
                  <p className="text-xs text-muted-foreground italic border-l-2 border-primary/30 pl-3 mb-3">"{s.note}"</p>
                )}
                <div className="space-y-1.5 mb-3">
                  {s.sessions.map((sess, i) => (
                    <div key={i} className="flex items-center gap-3 text-xs bg-card rounded-lg px-3 py-2">
                      <span className="w-8 font-semibold text-muted-foreground shrink-0">{DAY_LABELS[sess.dayOfWeek]}</span>
                      <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium shrink-0">
                        {SESSION_LABELS[sess.sessionType] ?? sess.sessionType}
                      </span>
                      <span className="text-foreground flex-1">{sess.description}</span>
                      {sess.distanceKm != null && <span className="text-muted-foreground shrink-0">{sess.distanceKm} mi</span>}
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => reviewSuggestion(s.id, "approve")}
                    disabled={reviewingSuggestion === s.id}
                    size="sm"
                    className="bg-primary hover:bg-primary/80 text-primary-foreground gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Approve
                  </Button>
                  <Button
                    onClick={() => reviewSuggestion(s.id, "reject")}
                    disabled={reviewingSuggestion === s.id}
                    size="sm"
                    variant="outline"
                  >
                    Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
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
              onClick={() => { setAveraFlow("idle"); setAveraProposal(null); setAveraError(""); }}
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

          {(averaFlow === "proposal" || averaFlow === "applying" || averaFlow === "done") && averaProposal && (
            <div className="px-5 py-4 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-base font-semibold text-foreground">{averaProposal.name}</p>
                  <p className="text-sm text-primary mt-0.5">for {averaProposal.athleteName}</p>
                  <p className="text-sm text-muted-foreground mt-1">{averaProposal.goal}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-foreground">{averaProposal.weeklyMileage} mi/wk</p>
                  <p className="text-xs text-muted-foreground">{averaProposal.sessions.length} sessions</p>
                </div>
              </div>

              <div className="flex gap-4 text-xs text-muted-foreground">
                <span>{averaProposal.startDate} → {averaProposal.endDate}</span>
              </div>

              {averaProposal.rationale && (
                <p className="text-xs text-muted-foreground italic border-l-2 border-primary/30 pl-3 leading-relaxed">
                  "{averaProposal.rationale}"
                </p>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(["easy_run","tempo_run","interval","long_run","cross_training","rest","race"] as const).map(type => {
                  const count = averaProposal.sessions.filter(s => s.sessionType === type).length;
                  if (count === 0) return null;
                  const labels: Record<string, string> = {
                    easy_run: "Easy", tempo_run: "Tempo", interval: "Intervals",
                    long_run: "Long", cross_training: "Cross", rest: "Rest", race: "Race",
                  };
                  return (
                    <div key={type} className="bg-background rounded-lg px-3 py-2 text-center">
                      <p className="text-sm font-semibold text-foreground">{count}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{labels[type]}</p>
                    </div>
                  );
                })}
              </div>

              {averaFlow === "done" ? (
                <div className="flex items-center gap-2 text-emerald-600 text-sm font-medium">
                  <Check className="w-4 h-4" /> Plan added to {averaProposal.athleteName}'s profile
                </div>
              ) : (
                <div className="flex items-center gap-3 pt-1">
                  <Button
                    onClick={applyAveraPlan}
                    disabled={averaFlow === "applying"}
                    size="sm"
                    className="bg-primary hover:bg-primary/80 text-primary-foreground gap-2"
                  >
                    {averaFlow === "applying" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                    Add to Training Plan
                  </Button>
                  <button
                    onClick={buildWithAvera}
                    disabled={averaFlow === "applying"}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Generate different plan
                  </button>
                </div>
              )}
            </div>
          )}

          {averaFlow === "error" && (
            <div className="px-5 py-4 flex items-center justify-between">
              <p className="text-sm text-red-600">{averaError}</p>
              <button
                onClick={buildWithAvera}
                className="text-xs text-primary hover:text-primary/80 font-medium transition-colors"
              >
                Try again
              </button>
            </div>
          )}
        </div>
      )}

      {athletes.length === 0 ? (
        <div className="bg-primary/5 border border-border rounded-xl p-12 text-center">
          <Calendar className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">No athletes on your team yet.</p>
          <p className="text-muted-foreground text-xs mt-1">Add athletes from the Team page first.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {athletes.map(athlete => {
            const athletePlans = plans.filter(p => p.userId === athlete.userId);
            const isExpanded = expandedAthleteId === athlete.userId;
            const isCreating = showFormFor === athlete.userId;

            return (
              <div key={athlete.userId} className="bg-background border border-border rounded-xl overflow-hidden">
                <button
                  onClick={() => {
                    setExpandedAthleteId(isExpanded ? null : athlete.userId);
                    if (isCreating) setShowFormFor(null);
                  }}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-sm font-bold text-primary">
                      {athlete.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold text-foreground">{athlete.name}</p>
                      <p className="text-xs text-muted-foreground">{athlete.fitnessLevel} · {athlete.primaryGoal}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">
                      {athletePlans.length} plan{athletePlans.length !== 1 ? "s" : ""}
                    </span>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-border px-5 py-4 space-y-3">
                    {athletePlans.length === 0 && !isCreating && (
                      <p className="text-xs text-muted-foreground py-2">No training plans yet for this athlete.</p>
                    )}

                    {athletePlans.map(plan => {
                      const start = new Date(plan.startDate);
                      const end = new Date(plan.endDate);
                      const totalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000));
                      const elapsed = Math.max(0, Math.ceil((Date.now() - start.getTime()) / 86400000));
                      const progress = Math.min(100, Math.round((elapsed / totalDays) * 100));

                      const isPending = plan.status === "pending";

                      return (
                        <div key={plan.id} className={`bg-background border rounded-lg p-4 ${isPending ? "border-primary/40" : "border-border"}`}>
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <p className="text-sm font-medium text-foreground truncate">{plan.name}</p>
                                <span className={`font-mono text-[10px] uppercase tracking-[0.1em] px-2 py-0.5 rounded-md border shrink-0 ${STATUS_COLORS[plan.status] ?? ""}`}>
                                  {STATUS_LABELS[plan.status] ?? plan.status}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground">{plan.goal}</p>
                            </div>
                            <button
                              onClick={() => deletePlan(plan.id)}
                              disabled={deleting === plan.id}
                              className="p-1.5 rounded text-muted-foreground hover:text-red-600 hover:bg-red-400/10 transition-colors shrink-0"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground mb-2">
                            <span>{format(start, "MMM d")} – {format(end, "MMM d, yyyy")}</span>
                            {plan.weeklyMileage && <span>{plan.weeklyMileage} mi/wk</span>}
                          </div>
                          {plan.status === "active" && (
                            <div>
                              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                                <span>Progress</span><span>{progress}%</span>
                              </div>
                              <div className="h-1 bg-secondary rounded-full overflow-hidden">
                                <div className="h-full bg-primary rounded-full" style={{ width: `${progress}%` }} />
                              </div>
                            </div>
                          )}
                          {isPending && (
                            <div className="flex items-center gap-2 mt-3">
                              <Button
                                onClick={() => reviewPlan(plan.id, "approve")}
                                disabled={reviewing === plan.id}
                                size="sm"
                                className="bg-primary hover:bg-primary/80 text-primary-foreground gap-1.5"
                              >
                                <Check className="w-3.5 h-3.5" />
                                Approve
                              </Button>
                              <Button
                                onClick={() => reviewPlan(plan.id, "reject")}
                                disabled={reviewing === plan.id}
                                size="sm"
                                variant="outline"
                              >
                                Reject
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {isCreating ? (
                      <div className="bg-background border border-primary/20 rounded-lg p-4 space-y-3">
                        <div className="flex items-center justify-between mb-1">
                          <p className="font-mono text-[11px] text-primary uppercase tracking-[0.15em]">New Plan for {athlete.name}</p>
                          <button onClick={() => setShowFormFor(null)} className="text-muted-foreground hover:text-foreground">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="col-span-2">
                            <label className="text-xs text-muted-foreground mb-1 block">Plan Name *</label>
                            <Input
                              value={form.name}
                              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                              placeholder="8-Week 5K Build"
                              className="bg-background border-border text-foreground text-sm placeholder:text-muted-foreground"
                            />
                          </div>
                          <div className="col-span-2">
                            <label className="text-xs text-muted-foreground mb-1 block">Goal *</label>
                            <Input
                              value={form.goal}
                              onChange={e => setForm(f => ({ ...f, goal: e.target.value }))}
                              placeholder="Sub-25 min 5K"
                              className="bg-background border-border text-foreground text-sm placeholder:text-muted-foreground"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Start Date *</label>
                            <Input
                              type="date"
                              value={form.startDate}
                              onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                              className="bg-background border-border text-foreground text-sm placeholder:text-muted-foreground"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground mb-1 block">End Date *</label>
                            <Input
                              type="date"
                              value={form.endDate}
                              onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                              className="bg-background border-border text-foreground text-sm placeholder:text-muted-foreground"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Weekly Mileage (mi)</label>
                            <Input
                              type="number"
                              step="0.1"
                              value={form.weeklyMileage}
                              onChange={e => setForm(f => ({ ...f, weeklyMileage: e.target.value }))}
                              placeholder="30"
                              className="bg-background border-border text-foreground text-sm placeholder:text-muted-foreground"
                            />
                          </div>
                        </div>
                        <div className="flex justify-end">
                          <Button
                            onClick={() => createPlan(athlete.userId)}
                            disabled={submitting}
                            size="sm"
                            className="bg-primary hover:bg-primary/80 text-primary-foreground"
                          >
                            {submitting ? "Creating..." : "Create Plan"}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setShowFormFor(athlete.userId);
                          setForm({ name: "", goal: "", startDate: format(new Date(), "yyyy-MM-dd"), endDate: "", weeklyMileage: "" });
                        }}
                        className="flex items-center gap-2 text-xs text-primary hover:text-primary/80 transition-colors py-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Create plan for {athlete.name}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
