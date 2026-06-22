import { useState, useEffect } from "react";
import { Plus, X, Trash2, Calendar, ChevronDown, ChevronUp, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Link } from "wouter";

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

const STATUS_COLORS: Record<string, string> = {
  active: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  completed: "text-slate-400 bg-slate-400/10 border-slate-400/20",
  paused: "text-amber-400 bg-amber-400/10 border-amber-400/20",
};

export default function CoachPlans() {
  const { toast } = useToast();
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [plans, setPlans] = useState<TeamPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedAthleteId, setExpandedAthleteId] = useState<string | null>(null);
  const [showFormFor, setShowFormFor] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    name: "", goal: "", startDate: format(new Date(), "yyyy-MM-dd"), endDate: "", weeklyMileage: "",
  });

  useEffect(() => {
    Promise.all([
      fetch("/api/coach/team-athletes", { credentials: "include" }).then(r => r.json()),
      fetch("/api/coach/team-plans", { credentials: "include" }).then(r => r.json()),
    ]).then(([a, p]) => {
      setAthletes(Array.isArray(a) ? a : []);
      setPlans(Array.isArray(p) ? p : []);
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

  if (loading) {
    return (
      <div className="p-8 space-y-4">
        {[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-white/5 border border-slate-800 rounded-xl animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Training Plans</h1>
          <p className="text-sm text-slate-400 mt-0.5">Manage training plans for each athlete</p>
        </div>
        <Link href="/ai-assistant">
          <Button className="gap-2 bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/20">
            <Bot className="w-4 h-4" />
            Ask AveraAI
          </Button>
        </Link>
      </div>

      {athletes.length === 0 ? (
        <div className="bg-white/5 border border-slate-800 rounded-xl p-12 text-center">
          <Calendar className="w-8 h-8 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">No athletes on your team yet.</p>
          <p className="text-slate-600 text-xs mt-1">Add athletes from the Team page first.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {athletes.map(athlete => {
            const athletePlans = plans.filter(p => p.userId === athlete.userId);
            const isExpanded = expandedAthleteId === athlete.userId;
            const isCreating = showFormFor === athlete.userId;

            return (
              <div key={athlete.userId} className="bg-[#0d1529] border border-slate-800 rounded-xl overflow-hidden">
                <button
                  onClick={() => {
                    setExpandedAthleteId(isExpanded ? null : athlete.userId);
                    if (isCreating) setShowFormFor(null);
                  }}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/20 flex items-center justify-center text-sm font-bold text-cyan-400">
                      {athlete.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold text-white">{athlete.name}</p>
                      <p className="text-xs text-slate-500">{athlete.fitnessLevel} · {athlete.primaryGoal}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-500">
                      {athletePlans.length} plan{athletePlans.length !== 1 ? "s" : ""}
                    </span>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-slate-800 px-5 py-4 space-y-3">
                    {athletePlans.length === 0 && !isCreating && (
                      <p className="text-xs text-slate-500 py-2">No training plans yet for this athlete.</p>
                    )}

                    {athletePlans.map(plan => {
                      const start = new Date(plan.startDate);
                      const end = new Date(plan.endDate);
                      const totalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000));
                      const elapsed = Math.max(0, Math.ceil((Date.now() - start.getTime()) / 86400000));
                      const progress = Math.min(100, Math.round((elapsed / totalDays) * 100));

                      return (
                        <div key={plan.id} className="bg-[#0a0f1e] border border-slate-800 rounded-lg p-4">
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <p className="text-sm font-medium text-white truncate">{plan.name}</p>
                                <span className={`text-xs px-2 py-0.5 rounded border font-medium capitalize shrink-0 ${STATUS_COLORS[plan.status] ?? ""}`}>
                                  {plan.status}
                                </span>
                              </div>
                              <p className="text-xs text-slate-400">{plan.goal}</p>
                            </div>
                            <button
                              onClick={() => deletePlan(plan.id)}
                              disabled={deleting === plan.id}
                              className="p-1.5 rounded text-slate-600 hover:text-red-400 hover:bg-red-400/10 transition-colors shrink-0"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-slate-500 mb-2">
                            <span>{format(start, "MMM d")} – {format(end, "MMM d, yyyy")}</span>
                            {plan.weeklyMileage && <span>{plan.weeklyMileage} mi/wk</span>}
                          </div>
                          {plan.status === "active" && (
                            <div>
                              <div className="flex justify-between text-xs text-slate-500 mb-1">
                                <span>Progress</span><span>{progress}%</span>
                              </div>
                              <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                                <div className="h-full bg-cyan-500 rounded-full" style={{ width: `${progress}%` }} />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {isCreating ? (
                      <div className="bg-[#0a0f1e] border border-cyan-500/20 rounded-lg p-4 space-y-3">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">New Plan for {athlete.name}</p>
                          <button onClick={() => setShowFormFor(null)} className="text-slate-500 hover:text-slate-300">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="col-span-2">
                            <label className="text-xs text-slate-400 mb-1 block">Plan Name *</label>
                            <Input
                              value={form.name}
                              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                              placeholder="8-Week 5K Build"
                              className="bg-[#0d1529] border-slate-700 text-white text-sm placeholder:text-slate-600"
                            />
                          </div>
                          <div className="col-span-2">
                            <label className="text-xs text-slate-400 mb-1 block">Goal *</label>
                            <Input
                              value={form.goal}
                              onChange={e => setForm(f => ({ ...f, goal: e.target.value }))}
                              placeholder="Sub-25 min 5K"
                              className="bg-[#0d1529] border-slate-700 text-white text-sm placeholder:text-slate-600"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-slate-400 mb-1 block">Start Date *</label>
                            <Input
                              type="date"
                              value={form.startDate}
                              onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                              className="bg-[#0d1529] border-slate-700 text-white text-sm"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-slate-400 mb-1 block">End Date *</label>
                            <Input
                              type="date"
                              value={form.endDate}
                              onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                              className="bg-[#0d1529] border-slate-700 text-white text-sm"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-slate-400 mb-1 block">Weekly Mileage (mi)</label>
                            <Input
                              type="number"
                              step="0.1"
                              value={form.weeklyMileage}
                              onChange={e => setForm(f => ({ ...f, weeklyMileage: e.target.value }))}
                              placeholder="30"
                              className="bg-[#0d1529] border-slate-700 text-white text-sm placeholder:text-slate-600"
                            />
                          </div>
                        </div>
                        <div className="flex justify-end">
                          <Button
                            onClick={() => createPlan(athlete.userId)}
                            disabled={submitting}
                            size="sm"
                            className="bg-cyan-600 hover:bg-cyan-500 text-white"
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
                        className="flex items-center gap-2 text-xs text-cyan-400 hover:text-cyan-300 transition-colors py-1"
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
