import { useGetTrainingPlan, getGetTrainingPlanQueryKey, getListTrainingPlansQueryKey, useDeleteTrainingPlan, customFetch } from "@workspace/api-client-react";
import { useParams, useLocation } from "wouter";
import { useEffect, useState } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckCircle2, Circle, Edit3, Trash2 } from "lucide-react";
import BackButton from "@/components/BackButton";
import { Button } from "@/components/ui/button";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const SESSION_COLORS: Record<string, string> = {
  easy_run: "text-[#10b981] bg-[#10b981]/10 border-[#10b981]/20",
  tempo_run: "text-[#A2AE98] bg-[#A2AE98]/10 border-[#A2AE98]/20",
  interval: "text-[#F2D2CF] bg-[#F2D2CF]/10 border-[#F2D2CF]/20",
  long_run: "text-[#f59e0b] bg-[#f59e0b]/10 border-[#f59e0b]/20",
  race: "text-[#ef4444] bg-[#ef4444]/10 border-[#ef4444]/20",
  cross_training: "text-primary bg-primary/10 border-primary/20",
  rest: "text-slate-400 bg-secondary border-border",
};

const SESSION_LABELS: Record<string, string> = {
  easy_run: "Easy",
  tempo_run: "Tempo",
  interval: "Interval",
  long_run: "Long Run",
  race: "Race",
  cross_training: "X-Train",
  rest: "Rest",
};

const planUpdateSchema = z.object({
  name: z.string().min(1, "Required"),
  goal: z.string().min(1, "Required"),
  startDate: z.string().min(1, "Required"),
  endDate: z.string().min(1, "Required"),
  weeklyMileage: z.string().optional().nullable(),
});

type PlanUpdateValues = z.infer<typeof planUpdateSchema>;

export default function PlanDetail() {
  const params = useParams<{ id: string }>();
  const planId = Number(params.id);
  const [isEditing, setIsEditing] = useState(false);
  const qc = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const { data: plan, isLoading } = useGetTrainingPlan(planId, {
    query: { enabled: !!planId, queryKey: getGetTrainingPlanQueryKey(planId) },
  });

  const editForm = useForm<PlanUpdateValues>({
    resolver: zodResolver(planUpdateSchema),
    defaultValues: {
      name: "",
      goal: "",
      startDate: "",
      endDate: "",
      weeklyMileage: "",
    },
  });

  useEffect(() => {
    if (!plan) return;
    editForm.reset({
      name: plan.name,
      goal: plan.goal,
      startDate: plan.startDate.slice(0, 10),
      endDate: plan.endDate.slice(0, 10),
      weeklyMileage: plan.weeklyMileage != null ? String(plan.weeklyMileage) : "",
    });
  }, [plan]);

  const deletePlanMutation = useDeleteTrainingPlan({
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: getListTrainingPlansQueryKey() });
      setLocation("/plans");
      toast({ title: "Plan deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete plan", variant: "destructive" });
    },
  });

  const updatePlanMutation = useMutation(
    async (data: PlanUpdateValues) => {
      return customFetch(`/api/plans/${planId}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: data.name,
          goal: data.goal,
          startDate: data.startDate,
          endDate: data.endDate,
          weeklyMileage: data.weeklyMileage ? Number(data.weeklyMileage) : null,
        }),
      });
    },
    {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetTrainingPlanQueryKey(planId) });
        qc.invalidateQueries({ queryKey: getListTrainingPlansQueryKey() });
        toast({ title: "Plan updated" });
        setIsEditing(false);
      },
      onError: () => {
        toast({ title: "Unable to update plan", variant: "destructive" });
      },
    },
  );

  const updateSessionMutation = useMutation(
    async ({ sessionId, completed }: { sessionId: number; completed: boolean }) => {
      return customFetch(`/api/plans/${planId}/sessions/${sessionId}`, {
        method: "PATCH",
        body: JSON.stringify({ completed }),
      });
    },
    {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetTrainingPlanQueryKey(planId) });
      },
      onError: () => {
        toast({ title: "Could not update session status", variant: "destructive" });
      },
    },
  );

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="h-8 w-48 bg-card border border-border rounded animate-pulse mb-8" />
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-32 bg-card border border-border rounded-lg animate-pulse" />
          ))}
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

  const weeks = Array.from(new Set(plan.sessions.map((s) => s.weekNumber))).sort((a, b) => a - b);

  function handleDelete() {
    if (!window.confirm("Delete this plan? This cannot be undone.")) return;
    deletePlanMutation.mutate({ id: plan.id });
  }

  function handleSubmit(values: PlanUpdateValues) {
    updatePlanMutation.mutate(values);
  }

  function toggleSessionCompleted(sessionId: number, completed: boolean) {
    updateSessionMutation.mutate({ sessionId, completed: !completed });
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <BackButton href="/plans" />
          <h1 className="text-2xl font-semibold text-foreground" data-testid="plan-detail-title">
            {plan.name}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{plan.goal}</p>
          <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-muted-foreground">
            <span>
              {format(new Date(plan.startDate), "MMM d, yyyy")} – {format(new Date(plan.endDate), "MMM d, yyyy")}
            </span>
            {plan.weeklyMileage && <span>{plan.weeklyMileage} mi/week target</span>}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={() => setIsEditing(!isEditing)}>
            <Edit3 className="w-4 h-4" />
            {isEditing ? "Cancel" : "Edit Plan"}
          </Button>
          <Button type="button" variant="destructive" size="sm" onClick={handleDelete}>
            <Trash2 className="w-4 h-4" />
            Delete Plan
          </Button>
        </div>
      </div>

      {isEditing && (
        <div className="bg-card border border-border rounded-lg p-6 mb-6">
          <h2 className="text-sm font-medium text-foreground mb-4">Edit training plan</h2>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(handleSubmit)} className="grid grid-cols-2 gap-4">
              <FormField name="name" control={editForm.control} render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Plan Name</FormLabel>
                  <FormControl>
                    <Input placeholder="12-Week Marathon Build" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField name="goal" control={editForm.control} render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Goal</FormLabel>
                  <FormControl>
                    <Input placeholder="Sub-4:00 marathon finish" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField name="startDate" control={editForm.control} render={({ field }) => (
                <FormItem>
                  <FormLabel>Start Date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField name="endDate" control={editForm.control} render={({ field }) => (
                <FormItem>
                  <FormLabel>End Date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField name="weeklyMileage" control={editForm.control} render={({ field }) => (
                <FormItem>
                  <FormLabel>Weekly Mileage Target (mi)</FormLabel>
                  <FormControl>
                    <Input placeholder="40" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="col-span-2 flex justify-end gap-2">
                <Button type="submit" disabled={updatePlanMutation.isLoading}>
                  {updatePlanMutation.isLoading ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      )}

      {weeks.length === 0 ? (
        <div className="bg-card border border-border rounded-lg py-12 text-center">
          <p className="text-sm text-muted-foreground">No sessions scheduled yet.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {weeks.map((week) => {
            const weekSessions = plan.sessions.filter((s) => s.weekNumber === week);
            const completedCount = weekSessions.filter((s) => s.completed).length;
            return (
              <div key={week} className="bg-card border border-border rounded-lg overflow-hidden" data-testid={`week-${week}`}>
                <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-secondary/30">
                  <h2 className="text-sm font-medium text-foreground">Week {week}</h2>
                  <span className="text-xs text-muted-foreground">
                    {completedCount}/{weekSessions.length} sessions done
                  </span>
                </div>
                <div className="divide-y divide-border">
                  {weekSessions.map((session) => (
                    <button
                      key={session.id}
                      type="button"
                      onClick={() => toggleSessionCompleted(session.id, session.completed)}
                      className="flex w-full items-start gap-4 px-5 py-4 text-left hover:bg-slate-50"
                      disabled={updateSessionMutation.isLoading}
                      data-testid={`session-${session.id}`}
                    >
                      <span className="mt-0.5 shrink-0">
                        {session.completed ? (
                          <CheckCircle2 className="w-4 h-4 text-primary" />
                        ) : (
                          <Circle className="w-4 h-4 text-muted-foreground" />
                        )}
                      </span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs px-2 py-0.5 rounded border font-medium ${SESSION_COLORS[session.sessionType] ?? "text-muted-foreground bg-secondary border-border"}`}>
                            {SESSION_LABELS[session.sessionType] ?? session.sessionType}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {DAY_LABELS[(session.dayOfWeek - 1) % 7]}
                          </span>
                        </div>
                        <p className="text-sm text-foreground">{session.description}</p>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mt-1">
                          {session.distanceKm && <span>{session.distanceKm} mi</span>}
                          {session.durationMinutes && <span>{session.durationMinutes} min</span>}
                        </div>
                      </div>
                    </button>
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
