import { format } from "date-fns";
import { DEMO_DATA, ACTIVITY_LABELS } from "@/lib/demoData";

export default function DemoActivities() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="font-display font-extrabold text-3xl tracking-[-0.01em] text-foreground">Activities</h1>
        <p className="text-sm text-muted-foreground mt-1">Every run, synced automatically from Strava</p>
      </div>

      <div className="bg-card border border-border rounded-lg divide-y divide-border">
        {DEMO_DATA.recentActivities.map(a => (
          <div key={a.id} className="flex items-center justify-between p-5 hover:bg-secondary/20 transition-colors">
            <div>
              <span className="text-sm font-semibold text-foreground">{ACTIVITY_LABELS[a.type] ?? a.type}</span>
              <span className="text-xs text-muted-foreground ml-3 font-medium">
                {format(new Date(a.activityDate), "EEEE, MMM d")}
              </span>
            </div>
            <div className="flex items-center gap-6 text-sm font-medium text-foreground">
              <span>{a.distanceKm} mi</span>
              <span className="text-muted-foreground">{a.durationMinutes} min</span>
              <span className="text-muted-foreground">{a.avgHeartRate} bpm</span>
              <span className="text-muted-foreground">
                {(a.durationMinutes / a.distanceKm).toFixed(1)} min/mi
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
