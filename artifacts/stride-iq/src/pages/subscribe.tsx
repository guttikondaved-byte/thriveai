import { useState } from "react";
import { useClerk } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useUpdateAthleteProfile, getGetAthleteProfileQueryKey } from "@workspace/api-client-react";
import { PaywallCard } from "@/components/PaywallCard";

/**
 * Full-screen access gate shown when a user has finished onboarding but has no
 * active subscription/trial. Keeps the reverse-trial CTA front and centre and
 * always offers a way out (sign out) so nobody gets trapped.
 */
export default function Subscribe({ planType }: { planType: "athlete" | "coach" }) {
  const { signOut } = useClerk();
  const navigate = useNavigate();
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
        <div className="flex items-center gap-2 mb-8">
          <img src="/logo.svg" alt="Thrive" className="h-8 w-auto" />
        </div>

        <h1 className="text-2xl font-bold text-foreground mb-1">Activate your account</h1>
        <p className="text-muted-foreground text-sm mb-6">
          Start your free trial to unlock your {planType === "coach" ? "coach portal" : "training dashboard"}.
          You won't be charged until the trial ends.
        </p>

        <PaywallCard planType={planType} fromOnboarding />

        <button
          type="button"
          onClick={changePlan}
          disabled={switching}
          className="mt-4 w-full text-center text-xs text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors"
        >
          {switching ? "Switching…" : `Change plan — switch to ${otherPlan === "coach" ? "Coach" : "Athlete"}`}
        </button>

        <button
          type="button"
          onClick={() => navigate("/onboarding")}
          className="mt-3 w-full text-center text-xs text-slate-400 hover:text-slate-200 transition-colors"
        >
          Redo survey
        </button>

        <button
          type="button"
          onClick={() => signOut()}
          className="mt-3 w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
