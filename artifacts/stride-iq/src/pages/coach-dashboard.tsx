import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { TrendingUp, Users, Activity, ChevronRight, Link as LinkIcon, Check } from "lucide-react";
import { useGetAthleteProfile, useGetCurrentAuthUser } from "@workspace/api-client-react";
import { getFocusConfig } from "@/lib/coachingFocus";
import { RiskBadge, RISK_CONFIG, type RiskLevel } from "@/components/coach/RiskBadge";
import { StatCard } from "@/components/coach/StatCard";
import { PageHeader, Eyebrow } from "@/components/coach/PageHeader";

function greetingFor(date: Date): string {
  const h = date.getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

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
  weeklyWorkouts: number;
  riskLevel: RiskLevel | null;
}

export default function CoachDashboard() {
  const [, navigate] = useLocation();
  const [team, setTeam] = useState<TeamInfo | null>(null);
  const [members, setMembers] = useState<RosterMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [linkCopied, setLinkCopied] = useState(false);
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
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

  const inviteLink = team ? `${window.location.origin}${basePath}/join/${team.inviteCode}` : "";
  function copyInviteLink() {
    if (!team) return;
    navigator.clipboard.writeText(inviteLink);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }

  const weeklyMiles = members.map(m => m.weeklyDistanceKm);
  const avgMiles = members.length > 0 ? (weeklyMiles.reduce((a, b) => a + b, 0) / members.length) : 0;
  const avgWorkouts = members.length > 0
    ? members.reduce((a, m) => a + (m.weeklyWorkouts ?? 0), 0) / members.length
    : null;

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
        <PageHeader
          eyebrow={`Team Dashboard · ${focus.label}`}
          title={`${greeting}${displayName ? `, Coach ${displayName}` : ""}`}
        />
        <div className="bg-card border border-border rounded-xl p-8 text-center mt-8">
          <p className="font-display font-bold text-lg text-foreground">No team yet</p>
          <p className="text-muted-foreground text-sm mt-1.5">Create a team from the Team page and share the invite code to start tracking your {focus.athleteNoun} here.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-8">
        <PageHeader
          eyebrow={`Team Dashboard · ${focus.label}`}
          title={team.name}
          meta={`${greeting}${displayName ? `, Coach ${displayName}` : ""} · ${members.length} ${focus.athleteNoun}`}
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <StatCard label="Total Athletes" value={members.length} sub="On your team" icon={Users} />
        <StatCard label={focus.distanceLabel} value={avgMiles.toFixed(1)} sub="avg mi this week" icon={Activity} />
        <StatCard label="Avg Workouts" value={avgWorkouts != null ? avgWorkouts.toFixed(1) : "—"} sub={avgWorkouts != null ? "per athlete this week" : "no data yet"} icon={TrendingUp} />
      </div>

      {/* Invite link — free for the first 25 athletes */}
      <div className="bg-card border border-border rounded-xl p-4 mb-10 shadow-sm flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
            <LinkIcon className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">Invite athletes — free for your first 25</p>
            <p className="text-xs text-muted-foreground truncate">{inviteLink}</p>
          </div>
        </div>
        <button
          onClick={copyInviteLink}
          className="p-2.5 px-4 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 shrink-0 shadow-sm"
        >
          {linkCopied ? <Check className="w-4 h-4" /> : <LinkIcon className="w-4 h-4" />}
          <span className="text-sm font-medium">{linkCopied ? "Copied" : "Copy link"}</span>
        </button>
      </div>

      <div className="mb-6">
        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <Eyebrow>Athlete Roster</Eyebrow>
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
                return (
                  <button
                    key={athlete.userId}
                    onClick={() => navigate(`/athletes/${athlete.userId}`)}
                    className={`w-full flex items-center gap-4 px-5 py-3.5 text-left hover:bg-muted/30 transition-colors ${cfg?.row ?? ""}`}
                  >
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-foreground flex-shrink-0">
                      {athlete.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-foreground truncate">{athlete.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{athlete.primaryGoal ?? (athlete.fitnessLevel ? `${athlete.fitnessLevel} runner` : "Athlete")}</div>
                    </div>
                    <div className="text-right hidden sm:block">
                      <div className="font-display font-bold text-sm text-foreground">{athlete.weeklyDistanceKm.toFixed(1)} mi</div>
                      <div className="text-[10px] text-muted-foreground">this week</div>
                    </div>
                    <div className="text-right hidden md:block">
                      <div className="text-xs text-foreground font-medium">{athlete.restingHeartRate != null ? `HR ${athlete.restingHeartRate}` : "HR —"}</div>
                      <div className="text-[10px] text-muted-foreground">{athlete.hrv != null ? `HRV ${athlete.hrv.toFixed(0)}` : "HRV —"}</div>
                    </div>
                    <RiskBadge level={athlete.riskLevel} />
                    <ChevronRight size={14} className="text-muted-foreground flex-shrink-0" />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
