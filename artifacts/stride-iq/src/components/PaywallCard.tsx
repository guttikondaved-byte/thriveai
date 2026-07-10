import { useState, useEffect } from "react";
import { Sparkles, Loader2, ChevronRight } from "lucide-react";

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
    title: "Athlete Pro",
    price: "$4.99/mo",
    sub: "Unlimited AveraAI + voice input, automatic Strava sync, unlimited AI-designed plans, the intensity map and what-if risk simulator, a weekly summary email, and CSV export.",
  },
  coach: {
    title: "Coach",
    price: "25 athletes included",
    sub: "Then $4 per athlete per month after 25. Team dashboard, alerts, and analytics.",
  },
};

/**
 * Upgrade card: a paid Stripe subscription. For coaches this is required to
 * manage a team; for athletes it's optional — the free tier already includes
 * the full dashboard, just with AveraAI/Strava-sync caps this removes.
 */
export function PaywallCard({ planType, fromOnboarding }: PaywallCardProps) {
  const [subLoading, setSubLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Only show the "subscribe" path when Stripe is actually configured on the
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
          onClick={subscribe}
          disabled={subLoading || !stripeAvailable}
          className="w-full flex items-center gap-4 rounded-xl border-2 border-primary bg-primary/10 px-4 py-4 text-left hover:bg-primary/15 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
        >
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-foreground">Subscribe</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {stripeAvailable ? copy.price : "Payment system unavailable — please contact support."}
            </p>
          </div>
          {subLoading ? (
            <Loader2 size={18} className="animate-spin text-primary shrink-0" />
          ) : (
            <ChevronRight size={18} className="text-primary shrink-0" />
          )}
        </button>
      </div>
    </div>
  );
}
