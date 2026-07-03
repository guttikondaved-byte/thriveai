import { useLocation } from "wouter";
import { User } from "lucide-react";
import { DEMO_DATA } from "@/lib/demoData";

const FIELDS: { label: string; value: string }[] = [
  { label: "Name", value: DEMO_DATA.name },
  { label: "Fitness Level", value: DEMO_DATA.fitnessLevel },
  { label: "Primary Goal", value: DEMO_DATA.primaryGoal },
  { label: "Weekly Mileage Goal", value: `${DEMO_DATA.weeklyMileageGoal} mi` },
  { label: "Resting Heart Rate", value: `${DEMO_DATA.restingHeartRate} bpm` },
  { label: "HRV", value: `${DEMO_DATA.hrv} ms` },
];

export default function DemoProfile() {
  const [, navigate] = useLocation();

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="font-display font-extrabold text-3xl tracking-[-0.01em] text-foreground flex items-center gap-2">
          <User className="w-6 h-6 text-primary" />
          Profile
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Sample athlete profile</p>
      </div>

      <div className="bg-card border border-border rounded-lg divide-y divide-border max-w-lg">
        {FIELDS.map(f => (
          <div key={f.label} className="flex items-center justify-between px-5 py-4">
            <span className="text-sm text-muted-foreground">{f.label}</span>
            <span className="text-sm font-semibold text-foreground">{f.value}</span>
          </div>
        ))}
      </div>

      <button
        onClick={() => navigate("/sign-up")}
        className="mt-6 rounded-lg bg-primary text-white text-sm font-semibold px-5 py-2.5 hover:bg-primary/90 transition-colors"
      >
        Sign up to create your own profile
      </button>
    </div>
  );
}
