import { useState, useEffect } from "react";
import { Users, Copy, Check, Link as LinkIcon, UserPlus, Zap, X, ChevronRight, Activity, AlertTriangle, Heart, Target } from "lucide-react";
import { useAuth } from "@workspace/replit-auth-web";

const KM_TO_MI = 0.621371;
const toMiles = (km: number) => km * KM_TO_MI;

interface TeamInfo {
  id: number;
  name: string;
  inviteCode: string;
  memberCount: number;
  createdAt: string;
}

interface TeamMember {
  userId: string;
  name: string;
  email: string | null;
  joinedAt: string;
}

interface StravaStatus {
  userId: string;
  connected: boolean;
  lastSync: string | null;
}

interface AthleteProfileDetail {
  userId: string;
  name: string;
  email: string | null;
  joinedAt: string;
  profile: {
    age: number | null;
    fitnessLevel: string;
    primaryGoal: string;
    weeklyMileageGoal: number | null;
    restingHeartRate: number | null;
    hrv: number | null;
    pr5k: string | null;
    pr10k: string | null;
    prHalf: string | null;
    prMarathon: string | null;
    healthNotes: string | null;
  } | null;
  weeklyDistanceKm: number;
  recentActivities: Array<{
    id: number;
    type: string;
    distanceKm: number | null;
    durationMinutes: number | null;
    avgHeartRate: number | null;
    perceivedEffort: number | null;
    activityDate: string;
  }>;
  alerts: Array<{
    id: number;
    riskLevel: string;
    bodyPart: string;
    message: string;
    recommendation: string;
    createdAt: string;
  }>;
}

export default function Team() {
  const { isAuthenticated } = useAuth();
  const [team, setTeam] = useState<TeamInfo | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [stravaStatus, setStravaStatus] = useState<Map<string, StravaStatus>>(new Map());
  const [loading, setLoading] = useState(true);
  const [teamName, setTeamName] = useState("");
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [inviteInput, setInviteInput] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState("");
  const [selected, setSelected] = useState<AthleteProfileDetail | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [retry, setRetry] = useState<{ teamId: number; userId: string } | null>(null);

  function closeModal() {
    setSelected(null);
    setProfileLoading(false);
    setProfileError(null);
    setRetry(null);
  }

  function openProfile(teamId: number, userId: string) {
    setProfileLoading(true);
    setSelected(null);
    setProfileError(null);
    setRetry({ teamId, userId });
    fetch(`/api/teams/${teamId}/members/${userId}/profile`, { credentials: "include" })
      .then(async r => {
        if (!r.ok) {
          if (r.status === 401) throw new Error("Your session expired. Please sign in again.");
          if (r.status === 403) throw new Error("You don't have access to this athlete's profile.");
          if (r.status === 404) throw new Error("This athlete is no longer on your team.");
          throw new Error("Couldn't load this athlete's profile. Please try again.");
        }
        return r.json() as Promise<AthleteProfileDetail>;
      })
      .then(data => {
        setSelected(data);
        setProfileLoading(false);
      })
      .catch((err: Error) => {
        setProfileError(err.message);
        setProfileLoading(false);
      });
  }

  useEffect(() => {
    if (!isAuthenticated) return;
    fetch("/api/teams/my", { credentials: "include" })
      .then(r => r.ok ? r.json() : { team: null })
      .then(data => {
        setTeam(data.team);
        setLoading(false);
        if (data.team) {
          fetchMembers(data.team.id);
          fetchStravaStatus(data.team.id);
        }
      })
      .catch(() => setLoading(false));
  }, [isAuthenticated]);

  function fetchMembers(teamId: number) {
    fetch(`/api/teams/${teamId}/members`, { credentials: "include" })
      .then(r => r.ok ? r.json() : [])
      .then(setMembers)
      .catch(() => {});
  }

  function fetchStravaStatus(teamId: number) {
    fetch(`/api/teams/${teamId}/strava-status`, { credentials: "include" })
      .then(r => r.ok ? r.json() : [])
      .then((rows: StravaStatus[]) => {
        setStravaStatus(new Map(rows.map(r => [r.userId, r])));
      })
      .catch(() => {});
  }

  function createTeam() {
    if (!teamName.trim()) return;
    setCreating(true);
    fetch("/api/teams", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: teamName.trim() }),
    })
      .then(r => r.json())
      .then(data => {
        setTeam(data);
        setCreating(false);
        fetchMembers(data.id);
        fetchStravaStatus(data.id);
      })
      .catch(() => setCreating(false));
  }

  function joinTeam() {
    if (!inviteInput.trim()) return;
    setJoining(true);
    setJoinError("");
    fetch("/api/teams/join", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inviteCode: inviteInput.trim() }),
    })
      .then(async r => {
        if (!r.ok) {
          const err = await r.json();
          throw new Error(err.error ?? "Not found");
        }
        return r.json();
      })
      .then(data => {
        setTeam(data);
        setJoining(false);
      })
      .catch(err => {
        setJoinError(err.message ?? "Invalid invite code");
        setJoining(false);
      });
  }

  function copyCode() {
    if (!team) return;
    navigator.clipboard.writeText(team.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!team) {
    return (
      <div className="p-6 max-w-xl mx-auto space-y-8">
        <h1 className="text-2xl font-bold text-foreground">Team</h1>

        <div className="bg-card border border-border rounded-xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            Create a team
          </h2>
          <p className="text-xs text-muted-foreground">Coaches can create a team and share an invite code with athletes.</p>
          <input
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="Team / club name"
            value={teamName}
            onChange={e => setTeamName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && createTeam()}
          />
          <button
            onClick={createTeam}
            disabled={creating || !teamName.trim()}
            className="w-full py-2 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {creating ? "Creating…" : "Create team"}
          </button>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-primary" />
            Join a team
          </h2>
          <p className="text-xs text-muted-foreground">Have an invite code from your coach? Enter it below.</p>
          <input
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono uppercase tracking-widest"
            placeholder="INVITE CODE"
            value={inviteInput}
            onChange={e => setInviteInput(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === "Enter" && joinTeam()}
            maxLength={8}
          />
          {joinError && <p className="text-xs text-destructive">{joinError}</p>}
          <button
            onClick={joinTeam}
            disabled={joining || !inviteInput.trim()}
            className="w-full py-2 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {joining ? "Joining…" : "Join team"}
          </button>
        </div>
      </div>
    );
  }

  const connectedCount = Array.from(stravaStatus.values()).filter(s => s.connected).length;
  const totalMembers = members.length;

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">{team.name}</h1>
        <span className="text-xs text-muted-foreground">{team.memberCount} member{team.memberCount !== 1 ? "s" : ""}</span>
      </div>

      {/* Invite code card */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Invite Code</p>
        <div className="flex items-center gap-3">
          <div className="flex-1 bg-background border border-border rounded-lg px-4 py-3 font-mono text-xl font-bold text-primary tracking-widest text-center">
            {team.inviteCode}
          </div>
          <button
            onClick={copyCode}
            className="p-3 rounded-lg border border-border bg-background hover:bg-secondary transition-colors"
            title="Copy code"
          >
            {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-muted-foreground" />}
          </button>
        </div>
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <LinkIcon className="w-3 h-3" />
          Share this code with athletes to invite them to your team.
        </p>
      </div>

      {/* Strava summary banner */}
      {totalMembers > 0 && (
        <div className={`flex items-center gap-3 rounded-xl px-5 py-3.5 border ${
          connectedCount === totalMembers
            ? "bg-[#FC4C02]/10 border-[#FC4C02]/30"
            : "bg-slate-800/50 border-slate-700/60"
        }`}>
          <Zap size={16} className="text-[#FC4C02] shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-white">
              {connectedCount} / {totalMembers} athlete{totalMembers !== 1 ? "s" : ""} connected to Strava
            </p>
            <p className="text-xs text-slate-400">
              {connectedCount < totalMembers
                ? "Athletes without Strava need to connect from their Activities page."
                : "All athletes are syncing runs automatically."}
            </p>
          </div>
        </div>
      )}

      {/* Athlete roster */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-semibold text-foreground">Athletes</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Zap size={11} className="text-[#FC4C02]" />
            Strava
          </div>
        </div>

        {members.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-muted-foreground">
            No athletes yet. Share the invite code to get started.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {members.map(m => {
              const strava = stravaStatus.get(m.userId);
              return (
                <button
                  key={m.userId}
                  onClick={() => openProfile(team.id, m.userId)}
                  className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-secondary/50 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-primary/15 border border-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                    {m.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{m.name}</p>
                    {m.email && <p className="text-xs text-muted-foreground truncate">{m.email}</p>}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {strava?.connected ? (
                      <div className="flex items-center gap-1.5">
                        <span className="flex items-center gap-1 text-xs font-medium text-[#FC4C02] bg-[#FC4C02]/10 border border-[#FC4C02]/25 px-2 py-0.5 rounded-full">
                          <Zap size={9} fill="currentColor" />
                          Strava linked
                        </span>
                        {strava.lastSync && (
                          <span className="text-[10px] text-muted-foreground hidden sm:block">
                            {new Date(strava.lastSync).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground bg-secondary border border-border px-2 py-0.5 rounded-full">
                        No Strava
                      </span>
                    )}
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {(profileLoading || selected || profileError) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={closeModal}
        >
          <div
            className="bg-card border border-border rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {profileLoading ? (
              <div className="flex items-center justify-center h-48">
                <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : profileError ? (
              <div className="p-6 flex flex-col items-center text-center gap-4">
                <div className="w-12 h-12 rounded-full bg-destructive/10 border border-destructive/20 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-destructive" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-foreground">Couldn't load profile</h2>
                  <p className="text-sm text-muted-foreground mt-1">{profileError}</p>
                </div>
                <div className="flex items-center gap-2">
                  {retry && (
                    <button
                      onClick={() => openProfile(retry.teamId, retry.userId)}
                      className="py-2 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
                    >
                      Try again
                    </button>
                  )}
                  <button
                    onClick={closeModal}
                    className="py-2 px-4 rounded-lg border border-border bg-background text-foreground text-sm font-medium hover:bg-secondary transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : selected ? (
              <div className="p-6 space-y-5">
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-full bg-primary/15 border border-primary/20 flex items-center justify-center text-lg font-bold text-primary shrink-0">
                      {selected.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-lg font-bold text-foreground truncate">{selected.name}</h2>
                      {selected.email && <p className="text-xs text-muted-foreground truncate">{selected.email}</p>}
                      <p className="text-[11px] text-muted-foreground">Joined {new Date(selected.joinedAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <button
                    onClick={closeModal}
                    className="p-1.5 rounded-lg hover:bg-secondary transition-colors shrink-0"
                  >
                    <X className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>

                {/* Stat grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-background border border-border rounded-xl p-3">
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                      <Activity className="w-3 h-3" /> This week
                    </p>
                    <p className="text-base font-bold text-foreground mt-1">
                      {toMiles(selected.weeklyDistanceKm).toFixed(1)} mi
                    </p>
                  </div>
                  <div className="bg-background border border-border rounded-xl p-3">
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                      <Target className="w-3 h-3" /> Weekly goal
                    </p>
                    <p className="text-base font-bold text-foreground mt-1">
                      {selected.profile?.weeklyMileageGoal != null
                        ? `${toMiles(selected.profile.weeklyMileageGoal).toFixed(0)} mi`
                        : "—"}
                    </p>
                  </div>
                  <div className="bg-background border border-border rounded-xl p-3">
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                      <Heart className="w-3 h-3" /> Resting HR
                    </p>
                    <p className="text-base font-bold text-foreground mt-1">
                      {selected.profile?.restingHeartRate != null ? `${selected.profile.restingHeartRate} bpm` : "—"}
                    </p>
                  </div>
                  <div className="bg-background border border-border rounded-xl p-3">
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wide">HRV</p>
                    <p className="text-base font-bold text-foreground mt-1">
                      {selected.profile?.hrv != null ? selected.profile.hrv.toFixed(0) : "—"}
                    </p>
                  </div>
                </div>

                {/* Profile details */}
                {selected.profile && (
                  <div className="bg-background border border-border rounded-xl p-4 space-y-2.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Age</span>
                      <span className="text-foreground font-medium">{selected.profile.age ?? "—"}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Fitness level</span>
                      <span className="text-foreground font-medium capitalize">{selected.profile.fitnessLevel}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm gap-3">
                      <span className="text-muted-foreground shrink-0">Primary goal</span>
                      <span className="text-foreground font-medium text-right">{selected.profile.primaryGoal}</span>
                    </div>
                  </div>
                )}

                {/* Personal records */}
                {selected.profile && (selected.profile.pr5k || selected.profile.pr10k || selected.profile.prHalf || selected.profile.prMarathon) && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Personal Records</p>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { label: "5K", val: selected.profile.pr5k },
                        { label: "10K", val: selected.profile.pr10k },
                        { label: "Half", val: selected.profile.prHalf },
                        { label: "Full", val: selected.profile.prMarathon },
                      ].map(pr => (
                        <div key={pr.label} className="bg-background border border-border rounded-lg p-2 text-center">
                          <p className="text-[10px] text-muted-foreground">{pr.label}</p>
                          <p className="text-xs font-bold text-foreground mt-0.5">{pr.val || "—"}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Risk alerts */}
                {selected.alerts.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
                      <AlertTriangle className="w-3 h-3 text-amber-500" /> Active Risk Alerts
                    </p>
                    <div className="space-y-2">
                      {selected.alerts.map(a => (
                        <div key={a.id} className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-foreground capitalize">{a.bodyPart}</span>
                            <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                              a.riskLevel === "high" ? "bg-red-500/15 text-red-400" :
                              a.riskLevel === "medium" ? "bg-amber-500/15 text-amber-400" :
                              "bg-yellow-500/15 text-yellow-400"
                            }`}>{a.riskLevel}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{a.message}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Health notes */}
                {selected.profile?.healthNotes && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Health Notes</p>
                    <p className="text-sm text-foreground bg-background border border-border rounded-lg p-3">{selected.profile.healthNotes}</p>
                  </div>
                )}

                {/* Recent activities */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Recent Activity</p>
                  {selected.recentActivities.length === 0 ? (
                    <p className="text-sm text-muted-foreground bg-background border border-border rounded-lg p-3">No runs logged yet.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {selected.recentActivities.map(a => (
                        <div key={a.id} className="flex items-center justify-between bg-background border border-border rounded-lg px-3 py-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground capitalize truncate">{a.type}</p>
                            <p className="text-[11px] text-muted-foreground">{new Date(a.activityDate).toLocaleDateString()}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-semibold text-foreground">
                              {a.distanceKm != null ? `${toMiles(a.distanceKm).toFixed(1)} mi` : "—"}
                            </p>
                            {a.durationMinutes != null && (
                              <p className="text-[11px] text-muted-foreground">{a.durationMinutes} min</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
