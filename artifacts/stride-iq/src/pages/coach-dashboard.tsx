import { useState, useEffect } from "react";
import { AlertTriangle, TrendingUp, Users, Activity, ChevronRight, Flame } from "lucide-react";
import { useAuth } from "@workspace/replit-auth-web";
import AthleteProfileModal from "../components/AthleteProfileModal";

const KM_TO_MI = 0.621371;
const toMiles = (km: number) => km * KM_TO_MI;

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
  low:    { label: "Low Risk",    dot: "bg-yellow-400", badge: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20", row: "bg-yellow-500/5" },
  medium: { label: "Caution",     dot: "bg-amber-400",  badge: "bg-amber-500/10 text-amber-400 border-amber-500/20",   row: "bg-amber-500/5" },
  high:   { label: "Injury Risk", dot: "bg-red-400 animate-pulse", badge: "bg-red-500/10 text-red-400 border-red-500/20", row: "bg-red-500/5" },
};

const READY = { label: "Ready", dot: "bg-emerald-400", badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" };

function StatCard({ label, value, sub, icon: Icon, accent }: { label: string; value: string | number; sub: string; icon: React.ElementType; accent: string }) {
  return (
    <div className="bg-[#0d1529] border border-slate-800 rounded-xl p-5">
      <div className="flex items-start justify-between mb-3">
        <span className="text-slate-500 text-xs font-medium uppercase tracking-wider">{label}</span>
        <div className={`w-8 h-8 rounded-lg ${accent} flex items-center justify-center`}>
          <Icon size={15} />
        </div>
      </div>
      <div className="text-3xl font-bold text-white mb-0.5">{value}</div>
      <div className="text-slate-500 text-xs">{sub}</div>
    </div>
  );
}

export default function CoachDashboard() {
  const { isAuthenticated } = useAuth();
  const [team, setTeam] = useState<TeamInfo | null>(null);
  const [members, setMembers] = useState<RosterMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;
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
  }, [isAuthenticated]);

  const highRisk = members.filter(m => m.riskLevel === "high").length;
  const caution = members.filter(m => m.riskLevel === "medium" || m.riskLevel === "low").length;
  const weeklyMiles = members.map(m => toMiles(m.weeklyDistanceKm));
  const avgMiles = members.length > 0 ? (weeklyMiles.reduce((a, b) => a + b, 0) / members.length) : 0;
  const hrvVals = members.map(m => m.hrv).filter((v): v is number => v != null);
  const avgHrv = hrvVals.length > 0 ? (hrvVals.reduce((a, b) => a + b, 0) / hrvVals.length) : null;
  const atRisk = members.filter(m => m.riskLevel != null);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-5 h-5 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!team) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-2">Team Dashboard</h1>
        <div className="bg-[#0d1529] border border-slate-800 rounded-xl p-8 text-center mt-6">
          <Users className="w-8 h-8 text-slate-600 mx-auto mb-3" />
          <p className="text-white font-medium">No team yet</p>
          <p className="text-slate-500 text-sm mt-1">Create a team from the Team page and share the invite code to start seeing your athletes here.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Team Dashboard</h1>
          <p className="text-slate-500 text-sm mt-0.5">{team.name}</p>
        </div>
        {highRisk > 0 && (
          <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            <AlertTriangle size={14} className="text-red-400" />
            <span className="text-red-400 text-sm font-medium">{highRisk} athlete{highRisk !== 1 ? "s" : ""} need attention</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Athletes" value={members.length} sub="On your team" icon={Users} accent="bg-cyan-500/10 text-cyan-400" />
        <StatCard label="Injury Risk" value={highRisk} sub={`${caution} on caution`} icon={AlertTriangle} accent="bg-red-500/10 text-red-400" />
        <StatCard label="Team Avg" value={avgMiles.toFixed(1)} sub="mi this week" icon={Activity} accent="bg-cyan-500/10 text-cyan-400" />
        <StatCard label="Avg HRV" value={avgHrv != null ? avgHrv.toFixed(1) : "—"} sub={avgHrv != null ? "across team" : "no data yet"} icon={TrendingUp} accent="bg-violet-500/10 text-violet-400" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2 bg-[#0d1529] border border-slate-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
            <h2 className="font-semibold text-white text-sm">Athlete Roster</h2>
            <span className="text-slate-500 text-xs">{members.length} athlete{members.length !== 1 ? "s" : ""}</span>
          </div>

          {members.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-slate-500">
              No athletes yet. Share your invite code <span className="font-mono text-cyan-400">{team.inviteCode}</span> from the Team page.
            </div>
          ) : (
            <div className="divide-y divide-slate-800/60">
              {members.map((athlete) => {
                const cfg = athlete.riskLevel ? RISK_CONFIG[athlete.riskLevel] : null;
                const badge = cfg ?? READY;
                return (
                  <button
                    key={athlete.userId}
                    onClick={() => setSelectedUserId(athlete.userId)}
                    className={`w-full flex items-center gap-4 px-5 py-3.5 text-left hover:bg-slate-800/30 transition-colors ${cfg?.row ?? ""}`}
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                      {athlete.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white truncate">{athlete.name}</div>
                      <div className="text-xs text-slate-500 truncate">{athlete.primaryGoal ?? (athlete.fitnessLevel ? `${athlete.fitnessLevel} runner` : "Athlete")}</div>
                    </div>
                    <div className="text-right hidden sm:block">
                      <div className="text-xs text-slate-300 font-medium">{toMiles(athlete.weeklyDistanceKm).toFixed(1)} mi</div>
                      <div className="text-[10px] text-slate-600">this week</div>
                    </div>
                    <div className="text-right hidden md:block">
                      <div className="text-xs text-slate-300 font-medium">{athlete.restingHeartRate != null ? `HR ${athlete.restingHeartRate}` : "HR —"}</div>
                      <div className="text-[10px] text-slate-600">{athlete.hrv != null ? `HRV ${athlete.hrv.toFixed(0)}` : "HRV —"}</div>
                    </div>
                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium flex-shrink-0 ${badge.badge}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                      {badge.label}
                    </div>
                    <ChevronRight size={14} className="text-slate-600 flex-shrink-0" />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="space-y-5">
          <div className="bg-[#0d1529] border border-slate-800 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Flame size={15} className="text-red-400" />
              <h2 className="font-semibold text-white text-sm">Risk Alerts</h2>
            </div>
            {atRisk.length === 0 ? (
              <p className="text-xs text-slate-500">No active risk alerts. Your team is training within safe limits.</p>
            ) : (
              <div className="space-y-3">
                {atRisk.map((athlete) => {
                  const cfg = RISK_CONFIG[athlete.riskLevel!];
                  return (
                    <button
                      key={athlete.userId}
                      onClick={() => setSelectedUserId(athlete.userId)}
                      className="w-full flex items-start gap-2.5 text-left hover:opacity-80 transition-opacity"
                    >
                      <span className={`w-2 h-2 rounded-full mt-1 flex-shrink-0 ${cfg.dot}`} />
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-white truncate">{athlete.name}</div>
                        <div className="text-[10px] text-slate-500 leading-relaxed">{cfg.label} — open profile for details</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
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
