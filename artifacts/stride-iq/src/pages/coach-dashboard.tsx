import { useState, useEffect } from "react";
import { TrendingUp, Users, Activity, Copy, Link as LinkIcon } from "lucide-react";
import { useGetAthleteProfile, useGetCurrentAuthUser } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
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
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const { data: authData } = useGetCurrentAuthUser();
  const { data: profile } = useGetAthleteProfile();
  const { toast } = useToast();
  const focus = getFocusConfig(profile?.primaryGoal);
  const authName = [authData?.user?.firstName, authData?.user?.lastName].filter(Boolean).join(" ");
  const profileName = profile?.name && profile.name.toLowerCase() !== "athlete" ? profile.name : "";
  const displayName = profileName || authName;
  const greeting = greetingFor(new Date());

  function copyCode() {
    if (!team) return;
    navigator.clipboard.writeText(team.inviteCode);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  function regenerateCode() {
    if (!team) return;
    setRegenerating(true);
    fetch(`/api/teams/${team.id}/code`, { method: "PATCH", credentials: "include" })
      .then(async r => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then(data => {
        setTeam(prev => prev ? { ...prev, inviteCode: data.inviteCode } : prev);
        toast({ title: "New code generated", description: "Old code is now invalid." });
      })
      .catch(() => {
        toast({ title: "Failed to regenerate code", variant: "destructive" });
      })
      .finally(() => setRegenerating(false));
  }

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
        <h1 className="text-2xl font-bold text-white mb-2 mt-1">{focus.headline}</h1>
        <div className="bg-[#06070E] border border-border rounded-xl p-8 text-center mt-6">
          <div className={`w-12 h-12 rounded-xl ${focus.accentBg} border ${focus.accentBorder} flex items-center justify-center mx-auto mb-3 ${focus.accentText}`}>
            <focus.icon className="w-6 h-6" />
          </div>
          <p className="text-white font-medium">No team yet</p>
          <p className="text-slate-500 text-sm mt-1">Create a team from the Team page and share the invite code to start tracking your {focus.athleteNoun} here.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <p className={`text-xs font-semibold uppercase tracking-[0.15em] ${focus.accentText}`}>{greeting}{displayName ? `, Coach ${displayName}` : ""}</p>
        <h1 className="text-2xl font-bold text-white mt-1">{focus.headline}</h1>
        <p className="text-slate-500 text-sm mt-0.5">{team.name} · {members.length} {focus.athleteNoun}</p>
      </div>

      {team && (
        <div className="mb-8 bg-card border border-border rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <LinkIcon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Team invite code</p>
              <p className="text-xs text-muted-foreground">Share this code with athletes so they can join your roster.</p>
            </div>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-[1.5fr_auto]">
            <div className="bg-secondary/50 border border-border rounded-xl px-5 py-4 font-mono text-xl font-semibold text-primary tracking-[0.2em] text-center">
              {team.inviteCode}
            </div>
            <div className="flex flex-col gap-3">
              <button
                onClick={copyCode}
                className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm font-medium text-foreground hover:bg-secondary transition-colors"
              >
                {copied ? "Copied" : "Copy code"}
              </button>
              <button
                onClick={regenerateCode}
                disabled={regenerating}
                className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {regenerating ? "Regenerating…" : "Regenerate code"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Discipline-tuned focus banner */}
      <div className={`mb-8 rounded-xl border ${focus.accentBorder} ${focus.accentBg} p-5`}>
        <div className="flex items-start gap-4">
          <div className={`w-10 h-10 rounded-lg ${focus.accentBg} border ${focus.accentBorder} flex items-center justify-center shrink-0 ${focus.accentText}`}>
            <focus.icon size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs font-bold uppercase tracking-[0.15em] ${focus.accentText}`}>{focus.label}</span>
              <span className="text-[10px] text-slate-500">·</span>
              <span className="text-[11px] text-slate-500">Portal tuned for your {focus.athleteNoun}</span>
            </div>
            <p className="text-sm text-slate-300 mt-1 leading-relaxed">{focus.tagline}</p>
            <p className={`text-[11px] italic mt-1 ${focus.accentText} opacity-80`}>"{focus.philosophy}"</p>
            <div className="mt-3 space-y-2">
              <div className="flex flex-wrap gap-2">
                {focus.focusAreas.map(area => (
                  <span
                    key={area}
                    className={`text-[11px] font-medium px-2.5 py-1 rounded-full border ${focus.accentBorder} ${focus.accentText} bg-[#06070E]/40`}
                  >
                    {area}
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider">Key sessions</span>
                {focus.keySessionTypes.map(s => (
                  <span key={s} className="text-[10px] text-slate-400 bg-slate-800/60 px-2 py-0.5 rounded">
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
        <StatCard label="Avg HRV" value={avgHrv != null ? avgHrv.toFixed(1) : "—"} sub={avgHrv != null ? "across team" : "no data yet"} icon={TrendingUp} accent="bg-[#F2D2CF]/10 text-[#F2D2CF]" />
      </div>

    </div>
  );
}
