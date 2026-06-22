import { useState, useEffect } from "react";
import { Users, Copy, Check, Link as LinkIcon, UserPlus, Zap } from "lucide-react";
import { useAuth } from "@workspace/replit-auth-web";

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
                <div key={m.userId} className="flex items-center gap-3 px-5 py-4">
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
                    <p className="text-xs text-muted-foreground">
                      Joined {new Date(m.joinedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
