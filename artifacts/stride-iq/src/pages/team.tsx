import { useState, useEffect } from "react";
import { Users, Copy, Check, Link as LinkIcon, UserPlus, ChevronRight, RefreshCw, Trash2, LogOut, AlertTriangle } from "lucide-react";
import { useGetAthleteProfile } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import AthleteProfileModal from "../components/AthleteProfileModal";
import { PageHeader, Eyebrow } from "@/components/coach/PageHeader";

interface TeamInfo {
  id: number;
  name: string;
  inviteCode: string;
  memberCount: number;
  createdAt: string;
  isPrimaryCoach?: boolean;
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
  const basePath = import.meta.env.BASE_URL || "";
  const { data: profile } = useGetAthleteProfile();
  const isCoach = profile?.userRole === "coach";
  const { toast } = useToast();

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
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // New state for management actions
  const [regenerating, setRegenerating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);

  useEffect(() => {
    fetch("/api/teams/my", { credentials: "include" })
      .then(r => r.ok ? r.json() : { team: null })
      .then(data => {
        setTeam(data.team);
        setLoading(false);
        if (data.team && isCoach) {
          fetchMembers(data.team.id);
          fetchStravaStatus(data.team.id);
        }
      })
      .catch(() => setLoading(false));
  }, [isCoach]);

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
        setTeam({ ...data, isPrimaryCoach: true });
        setCreating(false);
        fetchMembers(data.id);
        fetchStravaStatus(data.id);
        toast({ title: "Team created!", description: `Share the invite code to add athletes.` });
      })
      .catch(() => {
        setCreating(false);
        toast({ title: "Failed to create team", variant: "destructive" });
      });
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
        const joinedAsCoCoach = data.role === "coach";
        setTeam({ ...data, isPrimaryCoach: !joinedAsCoCoach });
        setJoining(false);
        if (joinedAsCoCoach) {
          fetchMembers(data.id);
          fetchStravaStatus(data.id);
        }
        toast({
          title: joinedAsCoCoach ? "Joined as co-coach!" : "Joined team!",
          description: joinedAsCoCoach ? `You now co-coach ${data.name}.` : `Welcome to ${data.name}.`,
        });
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

  function regenerateCode() {
    setRegenerating(true);
    fetch("/api/teams/code", { method: "PATCH", credentials: "include" })
      .then(async r => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then(data => {
        setTeam(prev => prev ? { ...prev, inviteCode: data.inviteCode } : prev);
        setRegenerating(false);
        toast({ title: "New code generated", description: `Old code is now invalid.` });
      })
      .catch(() => {
        setRegenerating(false);
        toast({ title: "Failed to regenerate code", variant: "destructive" });
      });
  }

  function deleteTeam() {
    setDeleting(true);
    fetch("/api/teams", { method: "DELETE", credentials: "include" })
      .then(r => {
        if (!r.ok && r.status !== 204) throw new Error();
        setTeam(null);
        setMembers([]);
        setStravaStatus(new Map());
        setConfirmDelete(false);
        setDeleting(false);
        toast({ title: "Team deleted", description: "All members have been removed." });
      })
      .catch(() => {
        setDeleting(false);
        toast({ title: "Failed to delete team", variant: "destructive" });
      });
  }

  function leaveTeam() {
    setLeaving(true);
    fetch("/api/teams/leave", { method: "DELETE", credentials: "include" })
      .then(r => {
        if (!r.ok && r.status !== 204) throw new Error();
        setTeam(null);
        setConfirmLeave(false);
        setLeaving(false);
        toast({ title: "You've left the team" });
      })
      .catch(() => {
        setLeaving(false);
        toast({ title: "Failed to leave team", variant: "destructive" });
      });
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

        {isCoach && (
          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              Create a team
            </h2>
            <p className="text-xs text-muted-foreground">Create a team and share the invite code with your athletes.</p>
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
        )}

        {(
          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-primary" />
              {isCoach ? "Join as a co-coach" : "Join a team"}
            </h2>
            <p className="text-xs text-muted-foreground">
              {isCoach
                ? "Have an invite code from another coach? Enter it below to co-coach their team."
                : "Have an invite code from your coach? Enter it below to join their team."}
            </p>
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
              {joining ? "Joining…" : isCoach ? "Join as co-coach" : "Join team"}
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── Athlete view ──────────────────────────────────────────────────────────
  if (!isCoach) {
    return (
      <div className="p-6 max-w-xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Team</h1>
        <div className="bg-card border border-border rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/15 border border-primary/20 flex items-center justify-center">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">You're on the team</p>
              <h2 className="text-lg font-semibold text-foreground">{team.name}</h2>
            </div>
          </div>
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5 text-green-500" />
            Your coach can now see your training and send you guidance.
          </p>

          <div className="pt-2 border-t border-border">
            <button
              onClick={() => setConfirmLeave(true)}
              className="flex items-center gap-2 text-xs text-destructive hover:text-destructive/80 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              Leave team
            </button>
          </div>
        </div>

        {/* Leave team confirmation modal */}
        {confirmLeave && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full mx-4 space-y-4 shadow-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-destructive/10 border border-destructive/20 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5 text-destructive" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Leave team?</p>
                  <p className="text-xs text-muted-foreground mt-0.5">You'll be removed from <span className="font-medium text-foreground">{team.name}</span>. You can rejoin with the invite code.</p>
                </div>
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => setConfirmLeave(false)}
                  className="flex-1 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-secondary transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={leaveTeam}
                  disabled={leaving}
                  className="flex-1 py-2 rounded-lg bg-destructive text-foreground text-sm font-medium hover:bg-destructive/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {leaving ? <><div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />Leaving…</> : "Leave team"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Coach view ────────────────────────────────────────────────────────────
  const connectedCount = Array.from(stravaStatus.values()).filter(s => s.connected).length;
  const totalMembers = members.length;

  const isPrimaryCoach = team.isPrimaryCoach !== false;

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <PageHeader
        eyebrow="Athlete Roster"
        title={
          <span className="inline-flex items-center gap-2.5">
            {team.name}
            {!isPrimaryCoach && (
              <span className="font-mono font-normal text-[10px] uppercase tracking-[0.12em] text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-md">
                Co-coach
              </span>
            )}
          </span>
        }
        meta={`${team.memberCount} member${team.memberCount !== 1 ? "s" : ""}`}
      />

      {/* Invite code card */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <LinkIcon className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Invite Athletes</p>
            <p className="text-xs text-muted-foreground">Share this code with athletes to add them to your roster.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex-1 bg-secondary/50 border border-border rounded-lg px-5 py-3.5 font-mono text-2xl font-bold text-primary tracking-[0.2em] text-center select-all">
            {team.inviteCode}
          </div>
          <button
            onClick={copyCode}
            className="p-3.5 rounded-lg border border-border bg-background hover:bg-secondary transition-colors group flex items-center gap-2 shadow-sm"
            title="Copy code"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-[#10b981]" />
                <span className="text-sm font-medium text-[#10b981]">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-muted-foreground group-hover:text-foreground" />
                <span className="text-sm font-medium text-foreground">Copy</span>
              </>
            )}
          </button>
        </div>
        {isPrimaryCoach && (
          <div className="flex items-center gap-3 pt-1 border-t border-border">
            <button
              onClick={regenerateCode}
              disabled={regenerating}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${regenerating ? "animate-spin" : ""}`} />
              {regenerating ? "Regenerating…" : "Regenerate code"}
            </button>
            <span className="text-border">·</span>
            <p className="text-xs text-muted-foreground">Old code will stop working immediately.</p>
          </div>
        )}
      </div>

      {/* Strava summary banner */}
      {totalMembers > 0 && (
        <div className={`flex items-center gap-3 rounded-xl px-5 py-3.5 border ${
          connectedCount === totalMembers
            ? "bg-[#FC4C02]/10 border-[#FC4C02]/30"
            : "bg-muted/50 border-border/60"
        }`}>
          <img src={`${window.location.origin}${basePath}/logo-mark.svg`} className="w-4 h-4 shrink-0" alt="Strava" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">
              {connectedCount} / {totalMembers} athlete{totalMembers !== 1 ? "s" : ""} connected to Strava
            </p>
            <p className="text-xs text-muted-foreground">
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
            <Eyebrow>Athletes</Eyebrow>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
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
                  onClick={() => setSelectedUserId(m.userId)}
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
                          <span className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.1em] text-[#FC4C02] bg-[#FC4C02]/10 border border-[#FC4C02]/25 px-2 py-0.5 rounded-md">
                          <img src={`${window.location.origin}${basePath}/logo-mark.svg`} className="w-2.5 h-2.5" alt="Strava" />
                          Strava linked
                        </span>
                        {strava.lastSync && (
                          <span className="text-[10px] text-muted-foreground hidden sm:block">
                            {new Date(strava.lastSync).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground bg-secondary border border-border px-2 py-0.5 rounded-md">
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

      {/* Danger zone */}
      <div className="bg-card border border-border rounded-xl p-5">
        <Eyebrow className="mb-3">Danger zone</Eyebrow>
        {isPrimaryCoach ? (
          <>
            <button
              onClick={() => setConfirmDelete(true)}
              className="flex items-center gap-2 text-sm text-destructive hover:text-destructive/80 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Delete team
            </button>
            <p className="text-xs text-muted-foreground mt-1.5">Permanently removes the team and all memberships.</p>
          </>
        ) : (
          <>
            <button
              onClick={() => setConfirmLeave(true)}
              className="flex items-center gap-2 text-sm text-destructive hover:text-destructive/80 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Leave as co-coach
            </button>
            <p className="text-xs text-muted-foreground mt-1.5">You'll lose access to this team's roster and plans.</p>
          </>
        )}
      </div>

      {/* Leave co-coach confirmation modal */}
      {!isPrimaryCoach && confirmLeave && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full mx-4 space-y-4 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-destructive/10 border border-destructive/20 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Leave as co-coach?</p>
                <p className="text-xs text-muted-foreground mt-0.5">You'll be removed from <span className="font-medium text-foreground">{team.name}</span>. You can rejoin with the invite code.</p>
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setConfirmLeave(false)}
                className="flex-1 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-secondary transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={leaveTeam}
                disabled={leaving}
                className="flex-1 py-2 rounded-lg bg-destructive text-white text-sm font-medium hover:bg-destructive/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {leaving ? <><div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />Leaving…</> : "Leave team"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete team confirmation modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full mx-4 space-y-4 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-destructive/10 border border-destructive/20 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Delete <span className="text-destructive">{team.name}</span>?</p>
                <p className="text-xs text-muted-foreground mt-0.5">This will remove the team and all {team.memberCount} member{team.memberCount !== 1 ? "s" : ""}. This cannot be undone.</p>
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setConfirmDelete(false)}
                className="flex-1 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-secondary transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={deleteTeam}
                disabled={deleting}
                className="flex-1 py-2 rounded-lg bg-destructive text-foreground text-sm font-medium hover:bg-destructive/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deleting ? <><div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />Deleting…</> : "Delete team"}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedUserId && team && (
        <AthleteProfileModal
          teamId={team.id}
          userId={selectedUserId}
          onClose={() => setSelectedUserId(null)}
        />
      )}
    </div>
  );
}
