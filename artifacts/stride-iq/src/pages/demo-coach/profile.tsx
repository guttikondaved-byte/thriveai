import { useLocation } from "wouter";
import { Settings } from "lucide-react";
import { DEMO_COACH_DATA } from "@/lib/demoData";

export default function DemoCoachProfile() {
  const [, navigate] = useLocation();
  const { team } = DEMO_COACH_DATA;

  const FIELDS = [
    { label: "Name", value: `Coach ${DEMO_COACH_DATA.coachName}` },
    { label: "Coaching Focus", value: DEMO_COACH_DATA.focus },
    { label: "Team", value: team.name },
    { label: "Team Created", value: team.createdAt },
    { label: "Invite Code", value: team.inviteCode },
  ];

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
          <Settings className="w-6 h-6 text-primary" />
          Settings
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Sample coach profile</p>
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
        onClick={() => navigate("/sign-up?role=coach")}
        className="mt-6 rounded-lg bg-primary text-white text-sm font-semibold px-5 py-2.5 hover:bg-primary/90 transition-colors"
      >
        Sign up to create your own team
      </button>
    </div>
  );
}
