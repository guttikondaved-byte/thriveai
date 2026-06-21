import { useState } from "react";
import { useListActivities, useCreateActivity, getListActivitiesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, X } from "lucide-react";
import { format } from "date-fns";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const ACTIVITY_TYPES = ["easy_run", "tempo_run", "interval", "long_run", "race", "cross_training", "rest"] as const;

const ACTIVITY_LABELS: Record<string, string> = {
  easy_run: "Easy Run", tempo_run: "Tempo", interval: "Interval",
  long_run: "Long Run", race: "Race", cross_training: "Cross Training", rest: "Rest",
};

const ACTIVITY_COLORS: Record<string, string> = {
  easy_run: "text-emerald-400 bg-emerald-400/10",
  tempo_run: "text-cyan-400 bg-cyan-400/10",
  interval: "text-violet-400 bg-violet-400/10",
  long_run: "text-blue-400 bg-blue-400/10",
  race: "text-amber-400 bg-amber-400/10",
  cross_training: "text-slate-400 bg-slate-400/10",
  rest: "text-muted-foreground bg-secondary",
};

const schema = z.object({
  type: z.enum(ACTIVITY_TYPES),
  activityDate: z.string().min(1),
  distanceKm: z.string().optional(),
  durationMinutes: z.string().optional(),
  avgHeartRate: z.string().optional(),
  perceivedEffort: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export default function Activities() {
  const [showForm, setShowForm] = useState(false);
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: activities, isLoading } = useListActivities({ limit: 50 });
  const createActivity = useCreateActivity();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { type: "easy_run", activityDate: format(new Date(), "yyyy-MM-dd") },
  });

  function onSubmit(values: FormValues) {
    createActivity.mutate({
      data: {
        type: values.type,
        activityDate: values.activityDate,
        ...(values.distanceKm ? { distanceKm: parseFloat(values.distanceKm) } : {}),
        ...(values.durationMinutes ? { durationMinutes: parseInt(values.durationMinutes) } : {}),
        ...(values.avgHeartRate ? { avgHeartRate: parseInt(values.avgHeartRate) } : {}),
        ...(values.perceivedEffort ? { perceivedEffort: parseInt(values.perceivedEffort) } : {}),
        ...(values.notes ? { notes: values.notes } : {}),
      }
    }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListActivitiesQueryKey() });
        toast({ title: "Activity logged" });
        setShowForm(false);
        form.reset({ type: "easy_run", activityDate: format(new Date(), "yyyy-MM-dd") });
      },
    });
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-foreground" data-testid="activities-title">Activities</h1>
          <p className="text-sm text-muted-foreground mt-1">Your training log</p>
        </div>
        <Button
          onClick={() => setShowForm(!showForm)}
          data-testid="button-log-activity"
          className="gap-2"
        >
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showForm ? "Cancel" : "Log Activity"}
        </Button>
      </div>

      {showForm && (
        <div className="bg-card border border-border rounded-lg p-6 mb-6" data-testid="form-log-activity">
          <h2 className="text-sm font-medium text-foreground mb-4">Log New Activity</h2>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="type" render={({ field }) => (
                <FormItem>
                  <FormLabel>Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-activity-type">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {ACTIVITY_TYPES.map(t => <SelectItem key={t} value={t}>{ACTIVITY_LABELS[t]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="activityDate" render={({ field }) => (
                <FormItem>
                  <FormLabel>Date</FormLabel>
                  <FormControl><Input type="date" data-testid="input-activity-date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="distanceKm" render={({ field }) => (
                <FormItem>
                  <FormLabel>Distance (km)</FormLabel>
                  <FormControl><Input type="number" step="0.01" placeholder="10.5" data-testid="input-distance" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="durationMinutes" render={({ field }) => (
                <FormItem>
                  <FormLabel>Duration (min)</FormLabel>
                  <FormControl><Input type="number" placeholder="60" data-testid="input-duration" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="avgHeartRate" render={({ field }) => (
                <FormItem>
                  <FormLabel>Avg Heart Rate (bpm)</FormLabel>
                  <FormControl><Input type="number" placeholder="148" data-testid="input-heart-rate" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="perceivedEffort" render={({ field }) => (
                <FormItem>
                  <FormLabel>Effort (1-10)</FormLabel>
                  <FormControl><Input type="number" min="1" max="10" placeholder="6" data-testid="input-effort" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Notes</FormLabel>
                  <FormControl><Input placeholder="How did it feel?" data-testid="input-notes" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="col-span-2 flex justify-end">
                <Button type="submit" disabled={createActivity.isPending} data-testid="button-submit-activity">
                  {createActivity.isPending ? "Saving..." : "Save Activity"}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => <div key={i} className="h-16 bg-card border border-border rounded-lg animate-pulse" />)}
        </div>
      ) : !activities?.length ? (
        <div className="bg-card border border-border rounded-lg py-16 text-center">
          <Activity className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No activities logged yet. Start by logging your first run.</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg divide-y divide-border">
          {activities.map(a => (
            <div key={a.id} className="flex items-center px-5 py-4 hover:bg-secondary/40 transition-colors" data-testid={`activity-item-${a.id}`}>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <span className={`text-xs px-2 py-0.5 rounded font-medium ${ACTIVITY_COLORS[a.type] ?? "text-muted-foreground bg-secondary"}`}>
                    {ACTIVITY_LABELS[a.type] ?? a.type}
                  </span>
                  <span className="text-xs text-muted-foreground">{format(new Date(a.activityDate), "MMM d, yyyy")}</span>
                </div>
                {a.notes && <p className="text-xs text-muted-foreground">{a.notes}</p>}
              </div>
              <div className="flex items-center gap-6 text-sm text-muted-foreground">
                {a.distanceKm != null && <span data-testid={`text-distance-${a.id}`}>{a.distanceKm} km</span>}
                {a.durationMinutes != null && <span>{a.durationMinutes} min</span>}
                {a.avgHeartRate != null && <span>{a.avgHeartRate} bpm</span>}
                {a.perceivedEffort != null && (
                  <span className="text-xs">RPE {a.perceivedEffort}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Activity({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
