import { Users } from "lucide-react";
import { DEMO_DATA } from "@/lib/demoData";

export default function DemoTeam() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="font-display font-extrabold text-3xl tracking-[-0.01em] text-foreground">My Team</h1>
        <p className="text-sm text-muted-foreground mt-1">Your coach and teammates</p>
      </div>

      <div className="bg-card border border-primary/30 rounded-lg p-5 mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Users className="w-4 h-4 text-primary" />
          <span className="text-xs font-semibold text-primary uppercase tracking-wider">Team</span>
        </div>
        <p className="text-lg font-semibold text-foreground">{DEMO_DATA.team.teamName}</p>
        <p className="text-sm text-muted-foreground mt-1">Coached by {DEMO_DATA.team.coachName}</p>
      </div>

      <div className="bg-card border border-border rounded-lg divide-y divide-border">
        {DEMO_DATA.team.teammates.map(t => (
          <div key={t.name} className="flex items-center justify-between p-5">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/15 border border-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                {t.name.charAt(0)}
              </div>
              <p className="text-sm font-semibold text-foreground">{t.name}</p>
            </div>
            <p className="text-sm text-muted-foreground">{t.weeklyMiles} mi this week</p>
          </div>
        ))}
      </div>
    </div>
  );
}
