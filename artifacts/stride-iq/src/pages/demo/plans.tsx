import { Calendar } from "lucide-react";
import { DEMO_DATA } from "@/lib/demoData";

export default function DemoPlans() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground">Training Plans</h1>
        <p className="text-sm text-muted-foreground mt-1">Adapts week to week based on your real training</p>
      </div>

      <div className="bg-card border border-primary/30 rounded-lg p-5 mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Calendar className="w-4 h-4 text-primary" />
          <span className="text-xs font-semibold text-primary uppercase tracking-wider">Active Plan</span>
        </div>
        <p className="text-lg font-semibold text-foreground">{DEMO_DATA.currentPlanName}</p>
        <p className="text-sm text-muted-foreground mt-1">Goal: {DEMO_DATA.primaryGoal}</p>
      </div>

      <div className="bg-card border border-border rounded-lg divide-y divide-border">
        {DEMO_DATA.weeklyPlan.map(day => (
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
    </div>
  );
}
