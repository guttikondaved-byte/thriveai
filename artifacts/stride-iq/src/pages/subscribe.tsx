import { useClerk } from "@clerk/react";
import { PaywallCard } from "@/components/PaywallCard";

/**
 * Full-screen access gate shown when a user has finished onboarding but has no
 * active subscription/trial. Keeps the reverse-trial CTA front and centre and
 * always offers a way out (sign out) so nobody gets trapped.
 */
export default function Subscribe({ planType }: { planType: "athlete" | "coach" }) {
  const { signOut } = useClerk();

  return (
    <div className="min-h-screen bg-[#06070E] flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2 mb-8">
          <img src="/logo.svg" alt="Thrive" className="h-8 w-auto" />
        </div>

        <h1 className="text-2xl font-bold text-white mb-1">Activate your account</h1>
        <p className="text-slate-400 text-sm mb-6">
          Start your free trial to unlock your {planType === "coach" ? "coach portal" : "training dashboard"}.
          You won't be charged until the trial ends.
        </p>

        <PaywallCard planType={planType} fromOnboarding />

        <button
          type="button"
          onClick={() => signOut()}
          className="mt-6 w-full text-center text-xs text-slate-500 hover:text-slate-300 transition-colors"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
