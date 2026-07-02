import { useState, useEffect } from "react";
import { TrendingUp, Users, Activity, ChevronRight } from "lucide-react";
import { useGetAthleteProfile, useGetCurrentAuthUser } from "@workspace/api-client-react";
import AthleteProfileModal from "../components/AthleteProfileModal";
import { getFocusConfig } from "@/lib/coachingFocus";

function greetingFor(date: Date): string {
  const h = date.getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

type RiskLevel = "high" | "medium" | "low";

interface TeamInfo {
  id: number;
  name: string;
  inviteCode: string;
  memberCount: number;
  createdAt: string;
}

interface RosterMember {
  userId: string;
  name: string;
  email: string | null;
  joinedAt: string;
  primaryGoal: string | null;
  fitnessLevel: string | null;
  restingHeartRate: number | null;
  hrv: number | null;
  weeklyDistanceKm: number;
  riskLevel: RiskLevel | null;
}

const RISK_CONFIG: Record<RiskLevel, { label: string; dot: string; badge: string; row: string }> = {
  low:    { label: "Low Risk",    dot: "bg-[#10b981]", badge: "bg-[#10b981]/10 text-[#10b981] border-[#10b981]/20", row: "bg-[#10b981]/5" }, // Emerald
  medium: { label: "Caution",     dot: "bg-[#f59e0b]", badge: "bg-[#f59e0b]/10 text-[#f59e0b] border-[#f59e0b]/20", row: "bg-[#f59e0b]/5" }, // Amber
  high:   { label: "Injury Risk", dot: "bg-[#ef4444] animate-pulse", badge: "bg-[#ef4444]/10 text-[#ef4444] border-[#ef4444]/20", row: "bg-[#ef4444]/5" }, // Red
};

const READY = { label: "Ready", dot: "bg-[#10b981]", badge: "bg-[#10b981]/10 text-[#10b981] border-[#10b981]/20" };

function StatCard({ label, value, sub, icon: Icon, accent }: { label: string; value: string | number; sub: string; icon: React.ElementType; accent: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
      <div className="flex items-start justify-between mb-4">
        <span className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">{label}</span>
        <div className={`w-8 h-8 rounded-lg ${accent} flex items-center justify-center`}>
          <Icon size={16} />
        </div>
      </div>
      <div className="text-3xl font-bold text-foreground mb-1 tracking-tight">{value}</div>
      <div className="text-muted-foreground text-xs font-medium">{sub}</div>
    </div>
  );
}

export default function CoachDashboard() {
  const [team, setTeam] = useState<TeamInfo | null>(null);
  const [members, setMembers] = useState<RosterMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const { data: authData } = useGetCurrentAuthUser();
  const { data: profile } = useGetAthleteProfile();
  const focus = getFocusConfig(profile?.primaryGoal);
  const authName = [authData?.user?.firstName, authData?.user?.lastName].filter(Boolean).join(" ");
  const profileName = profile?.name && profile.name.toLowerCase() !== "athlete" ? profile.name : "";
  const displayName = profileName || authName;
  const greeting = greetingFor(new Date());

  useEffect(() => {
    fetch("/api/teams/my", { credentials: "include" })
      .then(r => r.ok ? r.json() : { team: null })
      .then(data => {
        setTeam(data.team);
        if (data.team) {
          fetch(`/api/teams/${data.team.id}/members`, { credentials: "include" })
            .then(r => r.ok ? r.json() : [])
            .then((rows: RosterMember[]) => {
              setMembers(rows);
              setLoading(false);
            })
            .catch(() => setLoading(false));
        } else {
          setLoading(false);
        }
      })
      .catch(() => setLoading(false));
  }, []);

  const weeklyMiles = members.map(m => m.weeklyDistanceKm);
  const avgMiles = members.length > 0 ? (weeklyMiles.reduce((a, b) => a + b, 0) / members.length) : 0;
  const hrvVals = members.map(m => m.hrv).filter((v): v is number => v != null);
  const avgHrv = hrvVals.length > 0 ? (hrvVals.reduce((a, b) => a + b, 0) / hrvVals.length) : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!team) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <p className={`text-xs font-semibold uppercase tracking-[0.15em] ${focus.accentText}`}>{greeting}{displayName ? `, Coach ${displayName}` : ""}</p>
        <h1 className="text-2xl font-bold text-foreground mb-2 mt-1">{focus.headline}</h1>
        <div className="bg-background border border-border rounded-xl p-8 text-center mt-6">
          <div className={`w-12 h-12 rounded-xl ${focus.accentBg} border ${focus.accentBorder} flex items-center justify-center mx-auto mb-3 ${focus.accentText}`}>
            <focus.icon className="w-6 h-6" />
          </div>
          <p className="text-foreground font-medium">No team yet</p>
          <p className="text-muted-foreground text-sm mt-1">Create a team from the Team page and share the invite code to start tracking your {focus.athleteNoun} here.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <p className={`text-xs font-semibold uppercase tracking-[0.15em] ${focus.accentText}`}>{greeting}{displayName ? `, Coach ${displayName}` : ""}</p>
        <h1 className="text-2xl font-bold text-foreground mt-1">{focus.headline}</h1>
        <p className="text-muted-foreground text-sm mt-0.5">{team.name} · {members.length} {focus.athleteNoun}</p>
      </div>

      {/* Discipline-tuned focus banner */}
      <div className={`mb-8 rounded-xl border ${focus.accentBorder} ${focus.accentBg} p-5`}>
        <div className="flex items-start gap-4">
          <div className={`w-10 h-10 rounded-lg ${focus.accentBg} border ${focus.accentBorder} flex items-center justify-center shrink-0 ${focus.accentText}`}>
            <focus.icon size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs font-bold uppercase tracking-[0.15em] ${focus.accentText}`}>{focus.label}</span>
              <span className="text-[10px] text-muted-foreground">·</span>
              <span className="text-[11px] text-muted-foreground">Portal tuned for your {focus.athleteNoun}</span>
            </div>
            <p className="text-sm text-foreground mt-1 leading-relaxed">{focus.tagline}</p>
            <p className={`text-[11px] italic mt-1 ${focus.accentText} opacity-80`}>"{focus.philosophy}"</p>
            <div className="mt-3 space-y-2">
              <div className="flex flex-wrap gap-2">
                {focus.focusAreas.map(area => (
                  <span
                    key={area}
                    className={`text-[11px] font-medium px-2.5 py-1 rounded-full border ${focus.accentBorder} ${focus.accentText} bg-background/40`}
                  >
                    {area}
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Key sessions</span>
                {focus.keySessionTypes.map(s => (
                  <span key={s} className="text-[10px] text-muted-foreground bg-muted/60 px-2 py-0.5 rounded">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <StatCard label={`Total ${focus.athleteNoun}`} value={members.length} sub="On your team" icon={Users} accent={`${focus.accentBg} ${focus.accentText}`} />
        <StatCard label={focus.distanceLabel} value={avgMiles.toFixed(1)} sub="avg mi this week" icon={Activity} accent={`${focus.accentBg} ${focus.accentText}`} />
        <StatCard label="Avg HRV" value={avgHrv != null ? avgHrv.toFixed(1) : "—"} sub={avgHrv != null ? "across team" : "no data yet"} icon={TrendingUp} accent="bg-primary/10 text-primary" />
      </div>

      <div className="mb-6">
        <div className="bg-background border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h2 className="font-semibold text-foreground text-sm">Athlete Roster</h2>
            <span className="text-muted-foreground text-xs">{members.length} athlete{members.length !== 1 ? "s" : ""}</span>
          </div>

          {members.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-muted-foreground">
              No athletes yet. Share your invite code <span className="font-mono text-primary">{team.inviteCode}</span> from the Team page.
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {members.map((athlete) => {
                const cfg = athlete.riskLevel ? RISK_CONFIG[athlete.riskLevel] : null;
                const badge = cfg ?? READY;
                return (
                  <button
                    key={athlete.userId}
                    onClick={() => setSelectedUserId(athlete.userId)}
                    className={`w-full flex items-center gap-4 px-5 py-3.5 text-left hover:bg-muted/30 transition-colors ${cfg?.row ?? ""}`}
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-muted to-muted flex items-center justify-center text-xs font-bold text-foreground flex-shrink-0">
                      {athlete.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-foreground truncate">{athlete.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{athlete.primaryGoal ?? (athlete.fitnessLevel ? `${athlete.fitnessLevel} runner` : "Athlete")}</div>
                    </div>
                    <div className="text-right hidden sm:block">
                      <div className="text-xs text-foreground font-medium">{athlete.weeklyDistanceKm.toFixed(1)} mi</div>
                      <div className="text-[10px] text-muted-foreground">this week</div>
                    </div>
                    <div className="text-right hidden md:block">
                      <div className="text-xs text-foreground font-medium">{athlete.restingHeartRate != null ? `HR ${athlete.restingHeartRate}` : "HR —"}</div>
                      <div className="text-[10px] text-muted-foreground">{athlete.hrv != null ? `HRV ${athlete.hrv.toFixed(0)}` : "HRV —"}</div>
                    </div>
                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium flex-shrink-0 ${badge.badge}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                      {badge.label}
                    </div>
                    <ChevronRight size={14} className="text-muted-foreground flex-shrink-0" />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {selectedUserId && (
        <AthleteProfileModal
          teamId={team.id}
          userId={selectedUserId}
          onClose={() => setSelectedUserId(null)}
        />
      )}
    </div>
  );
}
