import { useState } from "react";
import { useClerk } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Footprints } from "lucide-react";
import { useUpdateAthleteProfile, getGetAthleteProfileQueryKey } from "@workspace/api-client-react";
import { PaywallCard } from "@/components/PaywallCard";

/**
 * Full-screen access gate shown to a coach who's finished onboarding but has
 * no active subscription — coaches are the only paid tier; athletes are free.
 * Always offers a way out (sign out, or switch to the free athlete tier) so
 * nobody gets trapped.
 */
interface SubscribeProps {
  planType: "coach";
  /**
   * Flips AppContent's forceOnboarding flag directly, in the same click
   * handler as the navigate() below — without this, the paywall gate would
   * still render on the very next tick (it doesn't know about "redo" intent
   * from the URL alone) before the redirect effect's own detection caught up,
   * causing a visible flash back to this same paywall screen.
   */
  onRedoSurvey?: () => void;
}

export default function Subscribe({ onRedoSurvey }: SubscribeProps) {
  const { signOut } = useClerk();
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const updateProfile = useUpdateAthleteProfile();
  const [switching, setSwitching] = useState(false);

  // Let a coach who meant to sign up as an athlete switch roles instead —
  // athletes are free, so this is an instant escape from the paywall rather
  // than a plan change.
  async function switchToAthlete() {
    if (switching) return;
    setSwitching(true);
    try {
      await updateProfile.mutateAsync({ data: { userRole: "athlete" } });
      await qc.refetchQueries({ queryKey: getGetAthleteProfileQueryKey() });
    } catch {
      setSwitching(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-primary/15 border border-primary/30 flex items-center justify-center mb-4">
            <Footprints className="w-7 h-7 text-primary" />
          </div>
          <img src="/logo.svg" alt="Thrive" className="h-7 w-auto mb-5" />
          <h1 className="text-2xl font-bold text-foreground mb-2">Activate your coach account</h1>
          <p className="text-muted-foreground text-sm leading-relaxed max-w-xs">
            Subscribe to unlock your coach portal — team roster, AveraAI, and injury alerts for your athletes.
          </p>
        </div>

        <PaywallCard planType="coach" fromOnboarding />

        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-xs text-muted-foreground">
          <button
            type="button"
            onClick={switchToAthlete}
            disabled={switching}
            className="hover:text-foreground disabled:opacity-50 transition-colors"
          >
            {switching ? "Switching…" : "Switch to Athlete (free)"}
          </button>
          <span className="text-foreground">•</span>
          <button
            type="button"
            onClick={() => {
              onRedoSurvey?.();
              navigate("/onboarding");
            }}
            className="hover:text-foreground transition-colors"
          >
            Redo survey
          </button>
          <span className="text-foreground">•</span>
          <button
            type="button"
            onClick={() => signOut()}
            className="hover:text-foreground transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
