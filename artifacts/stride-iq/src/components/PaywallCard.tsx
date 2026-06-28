import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, ShieldCheck, Loader2 } from "lucide-react";
import { SUBSCRIPTION_QUERY_KEY } from "@/hooks/use-subscription";

const TRIAL_DAYS = 3;

interface PaywallCardProps {
  planType: "athlete" | "coach";
  /**
   * When true, Checkout returns to the app (`/?checkout=success`) instead of the
   * profile page — used by onboarding and the access gate.
   */
  fromOnboarding?: boolean;
}

const PLAN_COPY: Record<PaywallCardProps["planType"], { title: string; price: string; sub: string }> = {
  athlete: {
    title: "Athlete",
    price: "$10/mo",
    sub: "Full access to your dashboard, AI coach, injury alerts, and training plans.",
  },
  coach: {
    title: "Coach",
    price: "25 athletes included",
    sub: "Then $4 per athlete per month after 25. Team dashboard, alerts, and analytics.",
  },
};

/**
 * Reverse-trial CTA: collect a card now, start a 14-day free trial, charge later.
 * Shared by the onboarding "Activate" step and the subscription gate.
 */
export function PaywallCard({ planType, fromOnboarding }: PaywallCardProps) {
  const qc = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCode, setShowCode] = useState(false);
  const [code, setCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const copy = PLAN_COPY[planType];

  async function redeemCode() {
    if (redeeming || !code.trim()) return;
    setRedeeming(true);
    setCodeError(null);
    try {
      const res = await fetch("/api/stripe/redeem-code", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.isActive) {
        setCodeError(data?.error ?? "That code isn't valid.");
        setRedeeming(false);
        return;
      }
      // Unlock the gate: refetch subscription state so AppContent re-renders.
      await qc.invalidateQueries({ queryKey: SUBSCRIPTION_QUERY_KEY });
    } catch {
      setCodeError("Couldn't redeem that code. Please try again.");
      setRedeeming(false);
    }
  }

  async function startTrial() {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout-session", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planType, trial: true, fromOnboarding: !!fromOnboarding }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.url) {
        setError(data?.error ?? "Unable to start checkout. Please try again.");
        setLoading(false);
        return;
      }
      window.location.href = data.url as string;
    } catch {
      setError("Something went wrong starting checkout. Please try again.");
      setLoading(false);
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
      <p className="text-xs text-slate-400 mb-5">
        No charge today. Cancel anytime before your trial ends and you won't be billed.
      </p>

      <div className="flex items-baseline justify-between rounded-xl bg-[#0e1a19]/60 border border-border px-4 py-3 mb-4">
        <div>
          <p className="text-sm font-semibold text-white">{copy.title} plan</p>
          <p className="text-xs text-slate-400 mt-0.5 max-w-sm">{copy.sub}</p>
        </div>
        <p className="text-sm font-bold text-white whitespace-nowrap ml-3">{copy.price}</p>
      </div>

      {error && <p className="text-red-400 text-xs mb-3">{error}</p>}

      <button
        type="button"
        onClick={startTrial}
        disabled={loading}
        className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-[#F5F5F5] hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
      >
        {loading ? (
          <>
            <Loader2 size={16} className="animate-spin" /> Opening checkout…
          </>
        ) : (
          <>
            Start free trial <Check size={16} />
          </>
        )}
      </button>
      <p className="text-[11px] text-slate-600 mt-3 text-center">
        Secured by Stripe. You'll enter your card on the next screen.
      </p>

      {/* Developer / staff access code — comps the paywall without Stripe. */}
      <div className="mt-4 border-t border-border/60 pt-3">
        {!showCode ? (
          <button
            type="button"
            onClick={() => setShowCode(true)}
            className="w-full text-center text-[11px] text-slate-500 hover:text-slate-300 transition-colors"
          >
            Have an access code?
          </button>
        ) : (
          <div>
            <div className="flex gap-2">
              <input
                value={code}
                onChange={(e) => { setCode(e.target.value); setCodeError(null); }}
                onKeyDown={(e) => { if (e.key === "Enter") redeemCode(); }}
                placeholder="Access code"
                autoFocus
                className="flex-1 bg-[#0e1a19]/60 border border-border rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              <button
                type="button"
                onClick={redeemCode}
                disabled={redeeming || !code.trim()}
                className="inline-flex items-center justify-center rounded-lg bg-secondary/70 border border-border px-4 py-2 text-sm font-semibold text-white hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {redeeming ? <Loader2 size={15} className="animate-spin" /> : "Apply"}
              </button>
            </div>
            {codeError && <p className="text-red-400 text-xs mt-2">{codeError}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
