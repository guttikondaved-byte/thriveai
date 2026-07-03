import { useState } from "react";
import { useGetTrainingPlan, useGetCurrentAuthUser } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useParams } from "wouter";
import { CheckCircle2, Circle, Pencil, Send, X, Check } from "lucide-react";
import BackButton from "@/components/BackButton";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const SESSION_TYPES = ["easy_run", "tempo_run", "interval", "long_run", "cross_training", "rest", "race"];

const SESSION_COLORS: Record<string, string> = {
  easy_run: "text-[#10b981] bg-[#10b981]/10 border-[#10b981]/20",
  tempo_run: "text-accent bg-accent/10 border-accent/20",
  interval: "text-primary bg-primary/10 border-primary/20",
  long_run: "text-[#f59e0b] bg-[#f59e0b]/10 border-[#f59e0b]/20",
  race: "text-[#ef4444] bg-[#ef4444]/10 border-[#ef4444]/20",
  cross_training: "text-primary bg-primary/10 border-primary/20",
  rest: "text-muted-foreground bg-secondary border-border",
};

const SESSION_LABELS: Record<string, string> = {
  easy_run: "Easy", tempo_run: "Tempo", interval: "Interval",
  long_run: "Long Run", race: "Race", cross_training: "X-Train", rest: "Rest",
};

type SessionDraft = {
  sessionType: string;
  description: string;
  distanceKm: string;
  durationMinutes: string;
};

export default function PlanDetail() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id, 10);
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: plan, isLoading, refetch } = useGetTrainingPlan(id, { query: { enabled: !!id, queryKey: ["getTrainingPlan", id] } });
  const { data: authData } = useGetCurrentAuthUser();
  const myUserId = authData?.user?.id;

  const [editingSessionId, setEditingSessionId] = useState<number | null>(null);
  const [draft, setDraft] = useState<SessionDraft | null>(null);
  const [suggestMode, setSuggestMode] = useState(false);
  const [proposals, setProposals] = useState<Map<number, SessionDraft>>(new Map());
  const [submittingSuggestion, setSubmittingSuggestion] = useState(false);

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

  const isSelfAuthored = !plan.createdBy || plan.createdBy === myUserId;
  const weeks = Array.from(new Set(plan.sessions.map(s => s.weekNumber))).sort((a, b) => a - b);

  function toDraft(session: { sessionType: string; description: string; distanceKm?: number | null; durationMinutes?: number | null }): SessionDraft {
    return {
      sessionType: session.sessionType,
      description: session.description,
      distanceKm: session.distanceKm != null ? String(session.distanceKm) : "",
      durationMinutes: session.durationMinutes != null ? String(session.durationMinutes) : "",
    };
  }

  async function saveSessionEdit(sessionId: number) {
    if (!draft) return;
    try {
      const res = await fetch(`/api/plans/${id}/sessions/${sessionId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionType: draft.sessionType,
          description: draft.description,
          distanceKm: draft.distanceKm === "" ? null : Number(draft.distanceKm),
          durationMinutes: draft.durationMinutes === "" ? null : Number(draft.durationMinutes),
        }),
      });
      if (!res.ok) throw new Error();
      await refetch();
      toast({ title: "Session updated" });
      setEditingSessionId(null);
      setDraft(null);
    } catch {
      toast({ title: "Error", description: "Failed to update session", variant: "destructive" });
    }
  }

  async function toggleCompleted(sessionId: number, completed: boolean) {
    try {
      await fetch(`/api/plans/${id}/sessions/${sessionId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed }),
      });
      await refetch();
    } catch {
      toast({ title: "Error", description: "Failed to update session", variant: "destructive" });
    }
  }

  function updateProposal(sessionId: number, base: SessionDraft, patch: Partial<SessionDraft>) {
    setProposals(prev => {
      const next = new Map(prev);
      next.set(sessionId, { ...(next.get(sessionId) ?? base), ...patch });
      return next;
    });
  }

  async function submitSuggestions() {
    if (proposals.size === 0) {
      toast({ title: "No changes to suggest", description: "Edit at least one session first.", variant: "destructive" });
      return;
    }
    if (!plan) return;
    setSubmittingSuggestion(true);
    try {
      const sessions = Array.from(proposals.entries()).map(([sessionId, d]) => {
        const original = plan.sessions.find(s => s.id === sessionId)!;
        return {
          sessionId,
          weekNumber: original.weekNumber,
          dayOfWeek: original.dayOfWeek,
          sessionType: d.sessionType,
          description: d.description,
          distanceKm: d.distanceKm === "" ? null : Number(d.distanceKm),
          durationMinutes: d.durationMinutes === "" ? null : Number(d.durationMinutes),
        };
      });
      const res = await fetch(`/api/plans/${id}/suggest-changes`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessions }),
      });
      if (!res.ok) throw new Error();
      toast({ title: "Changes suggested", description: "Your coach will review them." });
      setSuggestMode(false);
      setProposals(new Map());
      qc.invalidateQueries();
    } catch {
      toast({ title: "Error", description: "Failed to suggest changes", variant: "destructive" });
    } finally {
      setSubmittingSuggestion(false);
    }
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <BackButton href="/plans" />
          <h1 className="font-display font-extrabold text-3xl tracking-[-0.01em] text-foreground" data-testid="plan-detail-title">{plan.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">{plan.goal}</p>
          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
            <span>{format(new Date(plan.startDate), "MMM d, yyyy")} – {format(new Date(plan.endDate), "MMM d, yyyy")}</span>
            {plan.weeklyMileage && <span>{plan.weeklyMileage} mi/week target</span>}
          </div>
          {!isSelfAuthored && (
            <p className="text-xs text-muted-foreground mt-2">
              This plan was created by your coach. {suggestMode ? "Edit sessions below to propose changes." : "You can suggest changes instead of editing it directly."}
            </p>
          )}
        </div>
        {!isSelfAuthored && (
          <div className="shrink-0">
            {suggestMode ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setSuggestMode(false); setProposals(new Map()); }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                >
                  <X className="w-4 h-4" />
                  Cancel
                </button>
                <button
                  onClick={submitSuggestions}
                  disabled={submittingSuggestion}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-60 transition-colors"
                >
                  <Send className="w-4 h-4" />
                  {submittingSuggestion ? "Sending…" : `Send to Coach${proposals.size ? ` (${proposals.size})` : ""}`}
                </button>
              </div>
            ) : (
              <button
                onClick={() => setSuggestMode(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary/10 border border-primary/30 text-primary text-sm font-semibold hover:bg-primary/20 transition-colors"
              >
                <Pencil className="w-4 h-4" />
                Suggest Changes
              </button>
            )}
          </div>
        )}
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
                  {weekSessions.map(session => {
                    const canEditInline = isSelfAuthored && !suggestMode;
                    const isEditingThis = editingSessionId === session.id;
                    const proposal = proposals.get(session.id);
                    const showProposalForm = suggestMode && proposal !== undefined;

                    if (isEditingThis && draft) {
                      return (
                        <div key={session.id} className="px-5 py-4 space-y-2 bg-primary/5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <select
                              value={draft.sessionType}
                              onChange={e => setDraft({ ...draft, sessionType: e.target.value })}
                              className="bg-card border border-border rounded-lg px-2 py-1.5 text-sm text-foreground"
                            >
                              {SESSION_TYPES.map(t => <option key={t} value={t}>{SESSION_LABELS[t]}</option>)}
                            </select>
                            <span className="text-xs text-muted-foreground">{DAY_LABELS[(session.dayOfWeek - 1) % 7]}</span>
                          </div>
                          <input
                            value={draft.description}
                            onChange={e => setDraft({ ...draft, description: e.target.value })}
                            placeholder="Description…"
                            className="w-full bg-card border border-border rounded-lg px-3 py-1.5 text-sm text-foreground"
                          />
                          <div className="flex items-center gap-3">
                            <input
                              type="number" step="0.1" placeholder="mi"
                              value={draft.distanceKm}
                              onChange={e => setDraft({ ...draft, distanceKm: e.target.value })}
                              className="w-24 bg-card border border-border rounded-lg px-2 py-1.5 text-sm text-foreground"
                            />
                            <input
                              type="number" placeholder="min"
                              value={draft.durationMinutes}
                              onChange={e => setDraft({ ...draft, durationMinutes: e.target.value })}
                              className="w-24 bg-card border border-border rounded-lg px-2 py-1.5 text-sm text-foreground"
                            />
                          </div>
                          <div className="flex items-center justify-end gap-2 pt-1">
                            <button onClick={() => { setEditingSessionId(null); setDraft(null); }} className="text-xs text-muted-foreground hover:text-foreground px-3 py-1.5">Cancel</button>
                            <button onClick={() => saveSessionEdit(session.id)} className="inline-flex items-center gap-1 text-xs bg-primary text-white rounded-lg px-3 py-1.5 font-semibold hover:bg-primary/90">
                              <Check className="w-3 h-3" /> Save
                            </button>
                          </div>
                        </div>
                      );
                    }

                    if (showProposalForm && proposal) {
                      return (
                        <div key={session.id} className="px-5 py-4 space-y-2 bg-primary/5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <select
                              value={proposal.sessionType}
                              onChange={e => updateProposal(session.id, toDraft(session), { sessionType: e.target.value })}
                              className="bg-card border border-border rounded-lg px-2 py-1.5 text-sm text-foreground"
                            >
                              {SESSION_TYPES.map(t => <option key={t} value={t}>{SESSION_LABELS[t]}</option>)}
                            </select>
                            <span className="text-xs text-muted-foreground">{DAY_LABELS[(session.dayOfWeek - 1) % 7]}</span>
                            <span className="text-[10px] font-bold uppercase tracking-wide text-primary bg-primary/15 px-2 py-0.5 rounded-full ml-auto">Proposed</span>
                          </div>
                          <input
                            value={proposal.description}
                            onChange={e => updateProposal(session.id, toDraft(session), { description: e.target.value })}
                            className="w-full bg-card border border-border rounded-lg px-3 py-1.5 text-sm text-foreground"
                          />
                          <div className="flex items-center gap-3">
                            <input
                              type="number" step="0.1" placeholder="mi"
                              value={proposal.distanceKm}
                              onChange={e => updateProposal(session.id, toDraft(session), { distanceKm: e.target.value })}
                              className="w-24 bg-card border border-border rounded-lg px-2 py-1.5 text-sm text-foreground"
                            />
                            <input
                              type="number" placeholder="min"
                              value={proposal.durationMinutes}
                              onChange={e => updateProposal(session.id, toDraft(session), { durationMinutes: e.target.value })}
                              className="w-24 bg-card border border-border rounded-lg px-2 py-1.5 text-sm text-foreground"
                            />
                            <button
                              onClick={() => setProposals(prev => { const next = new Map(prev); next.delete(session.id); return next; })}
                              className="text-xs text-muted-foreground hover:text-foreground ml-auto"
                            >
                              Revert
                            </button>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={session.id} className="flex items-start gap-4 px-5 py-4 group" data-testid={`session-${session.id}`}>
                        <button onClick={() => toggleCompleted(session.id, !session.completed)} className="shrink-0 mt-0.5">
                          {session.completed
                            ? <CheckCircle2 className="w-4 h-4 text-primary" />
                            : <Circle className="w-4 h-4 text-muted-foreground" />
                          }
                        </button>
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
                        {canEditInline && (
                          <button
                            onClick={() => { setEditingSessionId(session.id); setDraft(toDraft(session)); }}
                            className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-primary transition-opacity shrink-0"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {suggestMode && (
                          <button
                            onClick={() => setProposals(prev => new Map(prev).set(session.id, toDraft(session)))}
                            className="text-muted-foreground hover:text-primary transition-colors shrink-0"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
