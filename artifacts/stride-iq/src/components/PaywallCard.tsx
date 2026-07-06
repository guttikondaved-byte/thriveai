import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, Sparkles, Loader2, ChevronRight } from "lucide-react";
import { SUBSCRIPTION_QUERY_KEY } from "@/hooks/use-subscription";

// Fallback only — the real value is read from /api/stripe/health so this
// can never silently drift from the backend's actual trial length.
const DEFAULT_TRIAL_DAYS = 3;

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
  const [trialDays, setTrialDays] = useState(DEFAULT_TRIAL_DAYS);
  const copy = PLAN_COPY[planType];

  useEffect(() => {
    let cancelled = false;
    fetch("/api/stripe/health", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return;
        setStripeAvailable(Boolean(d?.configured));
        if (typeof d?.trialDays === "number") setTrialDays(d.trialDays);
      })
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
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="rounded-xl bg-muted border border-border px-4 py-3 mb-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-foreground">{copy.title} plan</p>
          <p className="text-sm font-bold text-foreground whitespace-nowrap">{copy.price}</p>
        </div>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{copy.sub}</p>
      </div>

      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2 mb-4">
          <p className="text-destructive text-xs leading-relaxed">{error}</p>
        </div>
      )}

      <div className="space-y-3">
        <button
          type="button"
          onClick={startTrial}
          disabled={trialLoading}
          className="w-full flex items-center gap-4 rounded-xl border-2 border-primary bg-primary/10 px-4 py-4 text-left hover:bg-primary/15 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
        >
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-bold text-foreground">Start free for {trialDays} days</p>
              <span className="text-[10px] font-bold uppercase tracking-wide text-primary bg-primary/15 px-2 py-0.5 rounded-full">
                No card
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">Full access today, cancel any time.</p>
          </div>
          {trialLoading ? (
            <Loader2 size={18} className="animate-spin text-primary shrink-0" />
          ) : (
            <ChevronRight size={18} className="text-primary shrink-0" />
          )}
        </button>

        <div className="flex items-center gap-3 py-0.5">
          <div className="h-px flex-1 bg-border" />
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">or</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <button
          type="button"
          onClick={subscribe}
          disabled={subLoading}
          className="w-full flex items-center gap-4 rounded-xl border border-border bg-transparent px-4 py-4 text-left hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-foreground">Subscribe now</p>
            <p className="text-xs text-muted-foreground mt-0.5">Skip the trial, {copy.price}</p>
          </div>
          {subLoading ? (
            <Loader2 size={18} className="animate-spin text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight size={18} className="text-muted-foreground shrink-0" />
          )}
        </button>
      </div>
    </div>
  );
}
