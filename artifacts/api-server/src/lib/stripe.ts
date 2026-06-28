import Stripe from "stripe";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

/**
 * Shared Stripe client. Null when no secret key is configured so callers can
 * degrade gracefully (e.g. account deletion still proceeds without Stripe).
 */
export const stripe: Stripe | null = stripeSecretKey
  ? new Stripe(stripeSecretKey, { apiVersion: "2022-11-15" })
  : null;
