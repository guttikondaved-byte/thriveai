import { useState } from "react";
import { useClerk } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Footprints } from "lucide-react";
import { useUpdateAthleteProfile, getGetAthleteProfileQueryKey } from "@workspace/api-client-react";
import { PaywallCard } from "@/components/PaywallCard";

/**
 * Full-screen access gate shown when a user has finished onboarding but has no
 * active subscription/trial. Keeps the reverse-trial CTA front and centre and
 * always offers a way out (sign out) so nobody gets trapped.
 */
export default function Subscribe({ planType }: { planType: "athlete" | "coach" }) {
  const { signOut } = useClerk();
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const updateProfile = useUpdateAthleteProfile();
  const [switching, setSwitching] = useState(false);

  const otherPlan = planType === "coach" ? "athlete" : "coach";

  // Let the user switch which plan they're activating (e.g. they picked the
  // wrong role in onboarding). Updates the saved role, then refetches the
  // profile so this gate re-renders with the other plan.
  async function changePlan() {
    if (switching) return;
    setSwitching(true);
    try {
      await updateProfile.mutateAsync({ data: { userRole: otherPlan } });
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
          <h1 className="text-2xl font-bold text-foreground mb-2">Activate your account</h1>
          <p className="text-muted-foreground text-sm leading-relaxed max-w-xs">
            Start your free trial to unlock your {planType === "coach" ? "coach portal" : "training dashboard"}.
            You won't be charged until the trial ends.
          </p>
        </div>

        <PaywallCard planType={planType} fromOnboarding />

        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-xs text-muted-foreground">
          <button
            type="button"
            onClick={changePlan}
            disabled={switching}
            className="hover:text-foreground disabled:opacity-50 transition-colors"
          >
            {switching ? "Switching…" : `Switch to ${otherPlan === "coach" ? "Coach" : "Athlete"}`}
          </button>
          <span className="text-foreground">•</span>
          <button
            type="button"
            onClick={() => navigate("/onboarding")}
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
