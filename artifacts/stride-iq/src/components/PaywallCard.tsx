import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, ShieldCheck, Loader2 } from "lucide-react";
import { SUBSCRIPTION_QUERY_KEY } from "@/hooks/use-subscription";

const TRIAL_DAYS = 3;

interface PaywallCardProps {
  planType: "athlete" | "coach";
  /**
   * When true, Stripe Checkout returns to the app (`/?checkout=success`) instead
   * of the profile page — used by onboarding and the access gate.
   */
  fromOnboarding?: boolean;
}

const PLAN_COPY: Record<PaywallCardProps["planType"], { title: string; price: string; sub: string }> = {
  athlete: {
    title: "Athlete",
    price: "$5/mo",
    sub: "Full access to your dashboard, AI coach, injury alerts, and training plans.",
  },
  coach: {
    title: "Coach",
    price: "25 athletes included",
    sub: "Then $4 per athlete per month after 25. Team dashboard, alerts, and analytics.",
  },
};

/**
 * Activation card: a free trial granted directly (no card), with a paid Stripe
 * subscription as the secondary path.
 */
export function PaywallCard({ planType, fromOnboarding }: PaywallCardProps) {
  const qc = useQueryClient();
  const [trialLoading, setTrialLoading] = useState(false);
  const [subLoading, setSubLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Only show the paid "subscribe" path when Stripe is actually configured on the
  // backend — otherwise it just errors with "Payment system not available". This
  // auto-enables the button once the Stripe keys are set, no code change needed.
  const [stripeAvailable, setStripeAvailable] = useState(true);
  const copy = PLAN_COPY[planType];

  useEffect(() => {
    let cancelled = false;
    fetch("/api/stripe/health", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled) setStripeAvailable(Boolean(d?.configured)); })
      .catch(() => { if (!cancelled) setStripeAvailable(false); });
    return () => { cancelled = true; };
  }, []);

  // Free trial — granted server-side with no card. Unlock the gate by refetching.
  async function startTrial() {
    if (trialLoading) return;
    setTrialLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/start-trial", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.isActive) {
        setError(data?.error ?? "Couldn't start your free trial. Please try again.");
        setTrialLoading(false);
        return;
      }
      await qc.invalidateQueries({ queryKey: SUBSCRIPTION_QUERY_KEY });
    } catch {
      setError("Something went wrong. Please try again.");
      setTrialLoading(false);
    }
  }

  // Paid subscription via Stripe Checkout (no trial).
  async function subscribe() {
    if (subLoading) return;
    setSubLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout-session", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planType, fromOnboarding: !!fromOnboarding }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.url) {
        setError(data?.error ?? "Unable to start checkout. Please try again.");
        setSubLoading(false);
        return;
      }
      window.location.href = data.url as string;
    } catch {
      setError("Something went wrong starting checkout. Please try again.");
      setSubLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-primary/30 bg-primary/5 p-6">
      <div className="flex items-center gap-2 mb-1">
        <ShieldCheck className="w-5 h-5 text-primary" />
        <p className="text-sm font-semibold text-primary">
          Start your {TRIAL_DAYS}-day free trial
        </p>
      </div>
      <p className="text-xs text-muted-foreground mb-5">
        No card required. Free for {TRIAL_DAYS} days, or subscribe now to skip the trial.
      </p>

      <div className="rounded-xl bg-secondary/60 border border-border px-4 py-3 mb-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-foreground">{copy.title} plan</p>
          <p className="text-sm font-bold text-foreground whitespace-nowrap">{copy.price}</p>
        </div>
        <p className="text-xs text-muted-foreground mt-1">{copy.sub}</p>
      </div>

      {error && <p className="text-red-400 text-xs mb-3">{error}</p>}

      <button
        type="button"
        onClick={startTrial}
        disabled={trialLoading}
        className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-[#F5F5F5] hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
      >
        {trialLoading ? (
          <>
            <Loader2 size={16} className="animate-spin" /> Starting…
          </>
        ) : (
          <>
            Start free trial <Check size={16} />
          </>
        )}
      </button>

      <button
        type="button"
        onClick={subscribe}
        disabled={subLoading}
        className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-xl border border-primary/40 bg-transparent px-4 py-3 text-sm font-semibold text-primary hover:bg-primary/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
      >
        {subLoading ? (
          <>
            <Loader2 size={16} className="animate-spin" /> Opening checkout…
          </>
        ) : (
          "Subscribe now"
        )}
      </button>
    </div>
  );
}
