import { HeartPulse, Trophy } from "lucide-react";
import { DEMO_DATA } from "@/lib/demoData";

export default function DemoHistory() {
  const maxHrv = Math.max(...DEMO_DATA.weeklyHrv.map(d => d.value));

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground">Health & History</h1>
        <p className="text-sm text-muted-foreground mt-1">Recovery trends and personal records</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-card border border-border rounded-lg p-5">
          <div className="flex items-center gap-2 mb-4">
            <HeartPulse className="w-4 h-4 text-primary" />
            <h2 className="text-xs text-muted-foreground uppercase tracking-wider">HRV — last 7 days</h2>
          </div>
          <div className="flex items-end gap-2 h-28">
            {DEMO_DATA.weeklyHrv.map(d => (
              <div key={d.day} className="flex-1 flex flex-col items-center gap-2">
                <div
                  className="w-full rounded-t bg-primary/70"
                  style={{ height: `${(d.value / maxHrv) * 100}%` }}
                />
                <span className="text-[10px] text-muted-foreground">{d.day}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between mt-4 text-sm">
            <span className="text-muted-foreground">Resting HR</span>
            <span className="font-semibold text-foreground">{DEMO_DATA.restingHeartRate} bpm</span>
          </div>
          <div className="flex items-center justify-between mt-1 text-sm">
            <span className="text-muted-foreground">Avg HRV</span>
            <span className="font-semibold text-foreground">{DEMO_DATA.hrv} ms</span>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-5">
          <div className="flex items-center gap-2 mb-4">
            <Trophy className="w-4 h-4 text-primary" />
            <h2 className="text-xs text-muted-foreground uppercase tracking-wider">Personal Records</h2>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">5K</span>
              <span className="text-sm font-semibold text-foreground">{DEMO_DATA.pr5k}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">10K</span>
              <span className="text-sm font-semibold text-foreground">{DEMO_DATA.pr10k}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Half Marathon</span>
              <span className="text-sm font-semibold text-foreground">{DEMO_DATA.prHalf}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-5">
        <h2 className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Profile Summary</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground text-xs">Fitness Level</p>
            <p className="font-semibold text-foreground mt-0.5">{DEMO_DATA.fitnessLevel}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Goal</p>
            <p className="font-semibold text-foreground mt-0.5">{DEMO_DATA.primaryGoal}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Weekly Mileage Goal</p>
            <p className="font-semibold text-foreground mt-0.5">{DEMO_DATA.weeklyMileageGoal} mi</p>
          </div>
        </div>
      </div>
    </div>
  );
}
