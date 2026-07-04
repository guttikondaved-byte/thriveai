import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useUser } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import { Users, Check, AlertTriangle, Loader2 } from "lucide-react";
import { SUBSCRIPTION_QUERY_KEY } from "@/hooks/use-subscription";

// Stashes the pending invite so a logged-out visitor can sign up first and get
// auto-joined afterward (consumed in App.tsx once they have a profile).
export const PENDING_INVITE_KEY = "thrive_pending_invite";

interface TeamPreview {
  id: number;
  name: string;
  inviteCode: string;
  memberCount: number;
  createdAt: string;
}

export default function Join({ params }: { params: { inviteCode: string } }) {
  const inviteCode = params.inviteCode?.toUpperCase() ?? "";
  const [, navigate] = useLocation();
  const { isLoaded, isSignedIn } = useUser();
  const qc = useQueryClient();

  const [team, setTeam] = useState<TeamPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/teams/invite/${encodeURIComponent(inviteCode)}`, { credentials: "include" })
      .then(async r => {
        if (!r.ok) {
          if (r.status === 404) throw new Error("This invite link is invalid or has expired.");
          throw new Error("Couldn't load this invite. Please try again.");
        }
        return r.json() as Promise<TeamPreview>;
      })
      .then(t => { if (!cancelled) { setTeam(t); setLoading(false); } })
      .catch((err: Error) => { if (!cancelled) { setError(err.message); setLoading(false); } });
    return () => { cancelled = true; };
  }, [inviteCode]);

  async function handleJoin() {
    if (joining) return;
    // Not signed in — stash the code and route through sign-up as an athlete.
    if (isLoaded && !isSignedIn) {
      sessionStorage.setItem(PENDING_INVITE_KEY, inviteCode);
      sessionStorage.setItem("thrive_pending_role", "athlete");
      navigate("/sign-up?role=athlete");
      return;
    }
    setJoining(true);
    setError(null);
    try {
      const res = await fetch("/api/teams/join", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteCode }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Couldn't join the team. Please try again.");
      setJoined(true);
      await qc.invalidateQueries({ queryKey: SUBSCRIPTION_QUERY_KEY });
      setTimeout(() => navigate("/"), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setJoining(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error && !team ? (
          <>
            <div className="w-12 h-12 rounded-full bg-destructive/10 border border-destructive/20 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-5 h-5 text-destructive" />
            </div>
            <h1 className="text-lg font-bold text-foreground">Invite not found</h1>
            <p className="text-sm text-muted-foreground mt-1">{error}</p>
            <button
              onClick={() => navigate("/")}
              className="mt-6 w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
            >
              Go to StrideIQ
            </button>
          </>
        ) : joined ? (
          <>
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-4">
              <Check className="w-6 h-6 text-emerald-600" />
            </div>
            <h1 className="text-lg font-bold text-foreground">You're in!</h1>
            <p className="text-sm text-muted-foreground mt-1">Welcome to {team?.name}. Taking you to your dashboard…</p>
          </>
        ) : team ? (
          <>
            <div className="w-14 h-14 rounded-2xl bg-primary/15 border border-primary/20 flex items-center justify-center mx-auto mb-4 text-primary">
              <Users className="w-7 h-7" />
            </div>
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-primary">You've been invited</p>
            <h1 className="text-2xl font-bold text-foreground mt-1">{team.name}</h1>
            <p className="text-sm text-muted-foreground mt-2">
              Join this team to share your training with your coach — free for you, always.
            </p>

            {error && (
              <div className="mt-4 rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2">
                <p className="text-destructive text-xs">{error}</p>
              </div>
            )}

            <button
              onClick={handleJoin}
              disabled={joining}
              className="mt-6 w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
            >
              {joining ? <><Loader2 className="w-4 h-4 animate-spin" /> Joining…</> : "Join team"}
            </button>
            {isLoaded && !isSignedIn && (
              <p className="text-[11px] text-muted-foreground mt-3">You'll create a free account first — takes about a minute.</p>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
