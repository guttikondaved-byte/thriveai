import { useQuery } from "@tanstack/react-query";

export interface SubscriptionStatus {
  status: string | null;
  isActive: boolean;
  currentPeriodEnd: string | null;
}

export const SUBSCRIPTION_QUERY_KEY = ["subscription"] as const;

/**
 * Reads the current user's subscription state. Only enabled once we know the
 * user has a role (i.e. has finished the role/profile part of onboarding),
 * since the gate is meaningless before then.
 */
export function useSubscription(enabled: boolean) {
  return useQuery<SubscriptionStatus>({
    queryKey: SUBSCRIPTION_QUERY_KEY,
    enabled,
    staleTime: 30_000,
    queryFn: async () => {
      const res = await fetch("/api/stripe/subscription", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load subscription");
      return (await res.json()) as SubscriptionStatus;
    },
  });
}

/**
 * Forces Stripe → DB reconciliation. Called right after returning from Checkout
 * so the gate flips to "active" without waiting on webhook delivery.
 */
export async function refreshSubscription(): Promise<SubscriptionStatus | null> {
  try {
    const res = await fetch("/api/stripe/refresh", { method: "POST", credentials: "include" });
    if (!res.ok) return null;
    return (await res.json()) as SubscriptionStatus;
  } catch {
    return null;
  }
}
