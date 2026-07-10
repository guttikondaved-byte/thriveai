import { useState, useEffect } from "react";
import { Link, useSearch } from "wouter";
import { useListActivities, useCreateActivity, getListActivitiesQueryKey } from "@workspace/api-client-react";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { Plus, X, Upload, Activity, RefreshCw, Unlink, CheckCircle2, Download } from "lucide-react";
import { format } from "date-fns";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import GpxImport from "@/components/GpxImport";
import type { GpxResult } from "@/lib/parseGpx";

const ACTIVITY_TYPES = ["easy_run", "tempo_run", "interval", "long_run", "race", "cross_training", "rest"] as const;

const ACTIVITY_LABELS: Record<string, string> = {
  easy_run: "Easy Run", tempo_run: "Tempo", interval: "Interval",
  long_run: "Long Run", race: "Race", cross_training: "Cross Training", rest: "Rest",
};

const ACTIVITY_COLORS: Record<string, string> = {
  easy_run: "text-[#10b981] bg-[#10b981]/10 border-[#10b981]/20", // Emerald
  tempo_run: "text-accent bg-accent/10 border-accent/20",
  interval: "text-primary bg-primary/10 border-primary/20",
  long_run: "text-[#f59e0b] bg-[#f59e0b]/10 border-[#f59e0b]/20", // Amber
  race: "text-[#ef4444] bg-[#ef4444]/10 border-[#ef4444]/20", // Red
  cross_training: "text-primary bg-primary/10 border-primary/20",
  rest: "text-muted-foreground bg-secondary border-border",
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

function useStravaStatus() {
  return useQuery({
    queryKey: ["strava-status"],
    queryFn: async () => {
      const r = await fetch("/api/strava/status");
      if (!r.ok) throw new Error("failed");
      return r.json() as Promise<{ connected: boolean; stravaAthleteId: number | null }>;
    },
    staleTime: 60_000,
  });
}

function useStravaSync() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/strava/sync", { method: "POST" });
      if (!r.ok) throw new Error("sync failed");
      return r.json() as Promise<{ synced: number }>;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: getListActivitiesQueryKey() }),
  });
}

function useStravaFullSync() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/strava/sync-all", { method: "POST" });
      if (!r.ok) throw new Error("full sync failed");
      return r.json() as Promise<{ imported: number; detailed: number; scanned: number }>;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: getListActivitiesQueryKey() }),
  });
}

function useStravaDisconnect() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/strava/disconnect", { method: "DELETE" });
      if (!r.ok) throw new Error("failed");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["strava-status"] }),
  });
}

export default function Activities() {
  const [showForm, setShowForm] = useState(false);
  const [showGpx, setShowGpx] = useState(false);
  const qc = useQueryClient();
  const { toast } = useToast();
  const search = useSearch();
  const dateFilter = new URLSearchParams(search).get("date") ?? undefined;
  const { data: activities, isLoading } = useListActivities({
    limit: 50,
    ...(dateFilter ? { date: dateFilter } : {}),
  });
  const createActivity = useCreateActivity();
  const stravaStatus = useStravaStatus();
  const stravaSync = useStravaSync();
  const stravaFullSync = useStravaFullSync();
  const stravaDisconnect = useStravaDisconnect();

  // Show toast when redirected back from Strava OAuth
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const stravaParam = params.get("strava");
    if (stravaParam === "connected") {
      toast({ title: "Strava connected!", description: "Your runs will sync automatically." });
      stravaStatus.refetch();
      window.history.replaceState({}, "", "/activities");
    } else if (stravaParam === "error") {
      toast({ title: "Strava connection failed", description: "Please try again.", variant: "destructive" });
      window.history.replaceState({}, "", "/activities");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const [exporting, setExporting] = useState(false);

  async function handleExportCsv() {
    if (exporting) return;
    setExporting(true);
    try {
      const res = await fetch("/api/activities/export", { credentials: "include" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast({
          title: res.status === 402 ? "Athlete Pro perk" : "Export failed",
          description: data.error ?? "Couldn't export your activities. Please try again.",
          variant: "destructive",
        });
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `thrive-activities-${format(new Date(), "yyyy-MM-dd")}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: "Export failed", description: "Please check your connection and try again.", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  }

  function handleGpxImport(gpx: GpxResult) {
    const type = ACTIVITY_TYPES.includes(gpx.suggestedType as typeof ACTIVITY_TYPES[number])
      ? (gpx.suggestedType as typeof ACTIVITY_TYPES[number])
      : "easy_run";

    createActivity.mutate({
      data: {
        type,
        activityDate: gpx.activityDate,
        distanceKm: gpx.distanceKm,
        durationMinutes: gpx.durationMinutes,
        ...(gpx.avgHeartRate ? { avgHeartRate: gpx.avgHeartRate } : {}),
        notes: gpx.name
          ? `${gpx.name}${gpx.elevationGainM ? ` · +${gpx.elevationGainM}m elevation` : ""}${gpx.avgCadence ? ` · ${gpx.avgCadence} spm` : ""}`
          : gpx.elevationGainM
          ? `+${gpx.elevationGainM}m elevation${gpx.avgCadence ? ` · ${gpx.avgCadence} spm` : ""}`
          : undefined,
      }
    }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListActivitiesQueryKey() });
        toast({ title: "GPX activity imported", description: `${gpx.distanceKm} mi · ${gpx.durationMinutes} min` });
        setShowGpx(false);
      },
      onError: () => {
        toast({ title: "Import failed", description: "Could not save the activity.", variant: "destructive" });
      },
    });
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="font-display font-semibold text-[11px] uppercase tracking-[0.08em] text-primary">Training Log</p>
          <h1 className="font-display font-extrabold text-3xl tracking-[-0.01em] text-foreground mt-1.5" data-testid="activities-title">Activities</h1>
          <p className="text-sm text-muted-foreground mt-1">Your training log</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleExportCsv}
            disabled={exporting}
            className="gap-2 border-border text-muted-foreground hover:text-foreground hover:border-primary"
          >
            <Download className="w-4 h-4" />
            {exporting ? "Exporting…" : "Export CSV"}
          </Button>
          <Button
            variant="outline"
            onClick={() => { setShowGpx(!showGpx); setShowForm(false); }}
            className="gap-2 border-border text-muted-foreground hover:text-foreground hover:border-primary"
          >
            <Upload className="w-4 h-4" />
            Import GPX
          </Button>
          <Button
            onClick={() => { setShowForm(!showForm); setShowGpx(false); }}
            data-testid="button-log-activity"
            className="gap-2"
          >
            {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showForm ? "Cancel" : "Log Activity"}
          </Button>
        </div>
      </div>

      {dateFilter && (
        <div className="flex items-center justify-between bg-primary/10 border border-primary/30 rounded-xl px-5 py-3.5 mb-6">
          <div className="flex items-center gap-3">
            <Activity className="w-4 h-4 text-primary" />
            <span className="text-sm text-foreground">
              Showing activities on <strong>{format(new Date(`${dateFilter}T00:00:00`), "EEEE, MMM d, yyyy")}</strong>
            </span>
          </div>
          <Link href="/activities" className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
            <X className="w-3.5 h-3.5" /> Clear
          </Link>
        </div>
      )}

      {/* Strava connection banner */}
      {stravaStatus.data?.connected ? (
        <div className="flex items-center justify-between bg-[#FC4C02]/10 border border-[#FC4C02]/30 rounded-xl px-5 py-3.5 mb-6">
          <div className="flex items-center gap-3">
            <CheckCircle2 size={18} className="text-[#FC4C02] shrink-0" />
            <div>
              <p className="text-sm font-semibold text-foreground">Strava connected</p>
              <p className="text-xs text-muted-foreground">New runs sync automatically via webhook.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => stravaSync.mutate(undefined, {
                onSuccess: (d) => toast({ title: `Synced ${d.synced} activities from Strava` }),
                onError: () => toast({ title: "Sync failed", variant: "destructive" }),
              })}
              disabled={stravaSync.isPending}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-secondary hover:bg-secondary/80 text-foreground border border-border transition-colors disabled:opacity-50"
            >
              <RefreshCw size={12} className={stravaSync.isPending ? "animate-spin" : ""} />
              {stravaSync.isPending ? "Syncing…" : "Sync now"}
            </button>
            <button
              onClick={() => stravaFullSync.mutate(undefined, {
                onSuccess: (d) => toast({
                  title: `Imported ${d.imported} activities`,
                  description: d.imported > 0
                    ? "Your full Strava history is now in Thrive. Your intensity map and AI coaching just got smarter."
                    : "Everything was already imported.",
                }),
                onError: () => toast({ title: "Full sync failed", variant: "destructive" }),
              })}
              disabled={stravaFullSync.isPending}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-[#FC4C02]/10 hover:bg-[#FC4C02]/20 text-[#FC4C02] border border-[#FC4C02]/30 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={12} className={stravaFullSync.isPending ? "animate-spin" : ""} />
              {stravaFullSync.isPending ? "Importing history…" : "Sync full history"}
            </button>
            <button
              onClick={() => stravaDisconnect.mutate(undefined, {
                onSuccess: () => toast({ title: "Strava disconnected" }),
              })}
              disabled={stravaDisconnect.isPending}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-secondary hover:bg-secondary/80 text-muted-foreground border border-border transition-colors disabled:opacity-50"
            >
              <Unlink size={12} />
              Disconnect
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between bg-secondary border border-border rounded-xl px-5 py-3.5 mb-6">
          <div className="flex items-center gap-3">
            <Activity size={18} className="text-[#FC4C02] shrink-0" />
            <div>
              <p className="text-sm font-semibold text-foreground">Connect Strava to import your runs</p>
              <p className="text-xs text-muted-foreground">Sync anytime with one tap — automatic background sync is a Pro perk.</p>
            </div>
          </div>
          <a
            href="/api/strava/connect"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg bg-[#FC4C02] hover:bg-[#e34400] text-foreground transition-colors shrink-0"
          >
            Connect Strava
          </a>
        </div>
      )}

      {showGpx && (
        <GpxImport
          onImport={handleGpxImport}
          onClose={() => setShowGpx(false)}
        />
      )}

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
                  <FormLabel>Distance (mi)</FormLabel>
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
          <ActivityIcon className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          {dateFilter ? (
            <>
              <p className="text-sm text-muted-foreground">No activities on this day.</p>
              <p className="text-xs text-muted-foreground mt-1">
                <Link href="/activities" className="text-primary hover:underline">View all activities</Link>
              </p>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">No activities logged yet.</p>
              <p className="text-xs text-muted-foreground mt-1">Log a run manually or import a GPX file from your GPS watch.</p>
            </>
          )}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg divide-y divide-border">
          {activities.map(a => (
            <Link
              key={a.id}
              href={`/activities/${a.id}`}
              className="flex items-center px-5 py-4 hover:bg-secondary/40 transition-colors cursor-pointer"
              data-testid={`activity-item-${a.id}`}
            >
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1.5">
                  <span className={`text-[10px] px-2 py-0.5 rounded border font-semibold tracking-wide uppercase ${ACTIVITY_COLORS[a.type] ?? "text-muted-foreground bg-secondary border-border"}`}>
                    {ACTIVITY_LABELS[a.type] ?? a.type}
                  </span>
                  <span className="text-xs text-muted-foreground font-medium">{format(new Date(a.activityDate), "MMM d, yyyy")}</span>
                  {a.stravaActivityId != null && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded border border-[#FC4C02]/30 bg-[#FC4C02]/10 text-[#FC4C02] font-semibold uppercase tracking-wide">Strava</span>
                  )}
                </div>
                {a.notes && <p className="text-sm text-foreground/80 leading-relaxed">{a.notes}</p>}
              </div>
              <div className="flex items-center gap-6 text-sm text-muted-foreground">
                {a.distanceKm != null && <span data-testid={`text-distance-${a.id}`}>{a.distanceKm} mi</span>}
                {a.durationMinutes != null && <span>{a.durationMinutes} min</span>}
                {a.avgHeartRate != null && <span>{a.avgHeartRate} bpm</span>}
                {a.perceivedEffort != null && (
                  <span className="text-xs">RPE {a.perceivedEffort}</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function ActivityIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
