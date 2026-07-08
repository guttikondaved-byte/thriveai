import { Router, type Request, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import Stripe from "stripe";
import { db, athleteProfileTable, teamsTable, teamMembershipsTable } from "@workspace/db";
import { logger } from "../lib/logger";
import { isActiveStatus, isAccessActive, isCoveredByTeam } from "../lib/access";
import { getOrCreateProfile } from "./athlete";

const router: IRouter = Router();

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripePriceMode = process.env.STRIPE_PRICE_MODE === "payment" ? "payment" : "subscription";
const athletePriceId = process.env.STRIPE_PRICE_ID_ATHLETE ?? process.env.STRIPE_PRICE_ID;
const coachBasePriceId = process.env.STRIPE_PRICE_ID_COACH_BASE;
const coachAdditionalPriceId = process.env.STRIPE_PRICE_ID_COACH_ADDITIONAL;
const stripeClient = stripeSecretKey ? new Stripe(stripeSecretKey, { apiVersion: "2022-11-15" }) : null;
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

/**
 * Persist the latest Stripe subscription state onto the athlete profile.
 * Keyed by our internal userId (carried on subscription metadata) so we never
 * depend on email matching. Returns the number of rows updated.
 */
async function persistSubscription(
  userId: string,
  sub: Stripe.Subscription,
): Promise<void> {
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  await db
    .update(athleteProfileTable)
    .set({
      stripeCustomerId: customerId,
      stripeSubscriptionId: sub.id,
      subscriptionStatus: sub.status,
      subscriptionCurrentPeriodEnd: sub.current_period_end
        ? new Date(sub.current_period_end * 1000)
        : null,
    })
    .where(eq(athleteProfileTable.userId, userId));
}

/**
 * Keep a coach's Stripe subscription quantity for the "extra athlete" line
 * item in sync with their actual roster size. The checkout session only sets
 * this once, at signup time — without this, a coach who grows past 25
 * athletes after subscribing (or shrinks back under 25) would never see
 * their bill change. Called after any roster change (join/leave/delete).
 * Best-effort: errors are logged but never surfaced to the caller, since
 * roster changes shouldn't fail just because Stripe reconciliation hiccuped.
 */
export async function syncCoachTeamSubscriptionQuantity(coachUserId: string): Promise<void> {
  if (!stripeClient || !coachAdditionalPriceId) return;

  try {
    const [profile] = await db
      .select({
        stripeSubscriptionId: athleteProfileTable.stripeSubscriptionId,
        subscriptionStatus: athleteProfileTable.subscriptionStatus,
      })
      .from(athleteProfileTable)
      .where(eq(athleteProfileTable.userId, coachUserId))
      .limit(1);

    // Only real Stripe subscriptions need reconciling — the free trial has no
    // underlying Stripe object, so there's nothing to sync until they pay.
    if (!profile?.stripeSubscriptionId || !isActiveStatus(profile.subscriptionStatus) || profile.subscriptionStatus === "trialing") {
      return;
    }

    const [team] = await db
      .select({ id: teamsTable.id })
      .from(teamsTable)
      .where(eq(teamsTable.coachUserId, coachUserId))
      .orderBy(desc(teamsTable.createdAt))
      .limit(1);
    const memberCount = team
      ? (await db.select().from(teamMembershipsTable).where(eq(teamMembershipsTable.teamId, team.id))).length
      : 0;
    const desiredExtra = Math.max(0, memberCount - 25);

    const sub = await stripeClient.subscriptions.retrieve(profile.stripeSubscriptionId);
    const existingItem = sub.items.data.find((item) => item.price.id === coachAdditionalPriceId);

    if (desiredExtra === 0) {
      if (existingItem) {
        await stripeClient.subscriptions.update(profile.stripeSubscriptionId, {
          items: [{ id: existingItem.id, deleted: true }],
        });
        logger.info({ coachUserId, memberCount }, "Removed extra-athlete line item (roster back to 25 or fewer)");
      }
      return;
    }

    if (existingItem) {
      if (existingItem.quantity === desiredExtra) return;
      await stripeClient.subscriptions.update(profile.stripeSubscriptionId, {
        items: [{ id: existingItem.id, quantity: desiredExtra }],
      });
    } else {
      await stripeClient.subscriptions.update(profile.stripeSubscriptionId, {
        items: [{ price: coachAdditionalPriceId, quantity: desiredExtra }],
      });
    }
    logger.info({ coachUserId, memberCount, desiredExtra }, "Synced extra-athlete subscription quantity");
  } catch (err) {
    logger.error(
      { coachUserId, err: err instanceof Error ? err.message : String(err) },
      "Failed to sync coach subscription quantity to roster size",
    );
  }
}

/**
 * Resolve the internal userId for a Stripe subscription. Prefers the
 * `userId` we stamp on subscription metadata; falls back to the customer's
 * metadata so older sessions still reconcile.
 */
async function resolveUserId(
  sub: Stripe.Subscription,
): Promise<string | null> {
  if (typeof sub.metadata?.userId === "string") return sub.metadata.userId;
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  if (!stripeClient) return null;
  try {
    const customer = await stripeClient.customers.retrieve(customerId);
    if (!customer.deleted && typeof customer.metadata?.userId === "string") {
      return customer.metadata.userId;
    }
  } catch {
    /* ignore — fall through to null */
  }
  return null;
}

/**
 * Map Stripe errors to user-friendly messages with troubleshooting info
 */
function getStripeErrorMessage(err: unknown): { message: string; code: string } {
  if (!(err instanceof Error)) {
    return { message: "An unexpected error occurred. Please try again.", code: "unknown" };
  }

  // Parse Stripe error
  if ("type" in err && err.type === "StripeInvalidRequestError") {
    const stripeErr = err as Stripe.errors.StripeInvalidRequestError;
    
    if (stripeErr.param === "price" || stripeErr.message.includes("price")) {
      return {
        message: "Invalid or expired price. The merchant may need to configure pricing.",
        code: "invalid_price_config",
      };
    }
    
    if (stripeErr.message.includes("country") || stripeErr.message.includes("region")) {
      return {
        message: "Payment is not available in your region. Please contact support.",
        code: "region_not_supported",
      };
    }

    return {
      message: `Payment configuration error: ${stripeErr.message}`,
      code: "invalid_request",
    };
  }

  if ("type" in err && err.type === "StripeAuthenticationError") {
    return {
      message: "Payment processing is temporarily unavailable. Please try again in a few moments.",
      code: "auth_failed",
    };
  }

  if ("type" in err && err.type === "StripeConnectionError") {
    return {
      message: "Unable to connect to payment processor. Please check your connection and try again.",
      code: "connection_failed",
    };
  }

  if ("type" in err && err.type === "StripeRateLimitError") {
    return {
      message: "Too many requests. Please wait a moment and try again.",
      code: "rate_limited",
    };
  }

  if (err.message.includes("API key")) {
    return {
      message: "Payment system is misconfigured. Please contact support.",
      code: "api_key_error",
    };
  }

  return {
    message: err.message || "An error occurred while processing your payment. Please try again.",
    code: "unknown_error",
  };
}

function getBaseUrl(req: Request): string {
  if (process.env.APP_PUBLIC_URL) return process.env.APP_PUBLIC_URL.replace(/\/$/, "");
  const host = req.get("host");
  if (!host) {
    throw new Error("Unable to determine public URL for Stripe checkout");
  }
  const protocol = req.protocol === "https" || req.secure ? "https" : "http";
  return `${protocol}://${host}`;
}

router.post("/stripe/checkout-session", async (req: Request, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  // ── Configuration validation ──
  if (!stripeClient) {
    logger.error({}, "Stripe checkout attempted but API key not configured");
    res.status(503).json({
      error: "Payment system is not available. Please contact support.",
      code: "stripe_not_configured",
    });
    return;
  }

  const planType = req.body?.planType === "coach" ? "coach" : "athlete";

  // ── Validate price IDs ──
  if (planType === "athlete") {
    if (!athletePriceId) {
      logger.error({}, "Athlete checkout attempted but STRIPE_PRICE_ID_ATHLETE not configured");
      res.status(503).json({
        error: "Athlete pricing is not configured. Please contact support.",
        code: "athlete_price_not_configured",
      });
      return;
    }
  } else {
    if (!coachBasePriceId) {
      logger.error({}, "Coach checkout attempted but STRIPE_PRICE_ID_COACH_BASE not configured");
      res.status(503).json({
        error: "Coach pricing is not configured. Please contact support.",
        code: "coach_price_not_configured",
      });
      return;
    }
    if (!coachAdditionalPriceId) {
      logger.error({}, "Coach checkout attempted but STRIPE_PRICE_ID_COACH_ADDITIONAL not configured");
      res.status(503).json({
        error: "Coach pricing is not configured. Please contact support.",
        code: "coach_additional_price_not_configured",
      });
      return;
    }
  }

  // Onboarding sends `fromOnboarding: true` so we return the user to the app
  // (where the gate now sees an active trial) instead of the profile page.
  const fromOnboarding = req.body?.fromOnboarding === true;

  try {
    const baseUrl = getBaseUrl(req);
    const successPath = fromOnboarding ? "/?checkout=success" : "/profile?checkout=success";
    const cancelPath = fromOnboarding ? "/onboarding?checkout=cancel" : "/profile?checkout=cancel";
    const successUrl = new URL(successPath, baseUrl).toString();
    const cancelUrl = new URL(cancelPath, baseUrl).toString();

    // Ensure a reusable Stripe customer stamped with our userId, so both the
    // webhook and the post-checkout refresh can map back to this account.
    const [profileForCustomer] = await db
      .select({ stripeCustomerId: athleteProfileTable.stripeCustomerId })
      .from(athleteProfileTable)
      .where(eq(athleteProfileTable.userId, req.user.id))
      .limit(1);

    let customerId = profileForCustomer?.stripeCustomerId ?? null;
    if (!customerId) {
      const customer = await stripeClient.customers.create({
        email: req.user.email ?? undefined,
        metadata: { userId: req.user.id },
      });
      customerId = customer.id;
      await db
        .update(athleteProfileTable)
        .set({ stripeCustomerId: customerId })
        .where(eq(athleteProfileTable.userId, req.user.id));
    }

    const lineItems: Array<{ price: string; quantity: number }> = [];

    if (planType === "athlete") {
      lineItems.push({ price: athletePriceId!, quantity: 1 });
    } else {
      // Verify user is a coach
      const [profile] = await db
        .select({ userRole: athleteProfileTable.userRole })
        .from(athleteProfileTable)
        .where(eq(athleteProfileTable.userId, req.user.id))
        .limit(1);

      if (profile?.userRole !== "coach") {
        logger.warn({ userId: req.user.id }, "Non-coach user attempted to purchase coach plan");
        res.status(403).json({
          error: "Only coaches can purchase the coach plan.",
          code: "not_a_coach",
        });
        return;
      }

      // Calculate team member count for coach pricing
      const [team] = await db
        .select()
        .from(teamsTable)
        .where(eq(teamsTable.coachUserId, req.user.id))
        .orderBy(desc(teamsTable.createdAt))
        .limit(1);

      const memberCount = team
        ? (await db.select().from(teamMembershipsTable).where(eq(teamMembershipsTable.teamId, team.id))).length
        : 0;

      lineItems.push({ price: coachBasePriceId!, quantity: 1 });

      const extraAthleteCount = Math.max(0, memberCount - 25);
      if (extraAthleteCount > 0) {
        lineItems.push({ price: coachAdditionalPriceId!, quantity: extraAthleteCount });
      }

      logger.info(
        { userId: req.user.id, teamId: team?.id, memberCount, extraAthleteCount },
        "Coach checkout initiated",
      );
    }

    logger.info(
      { userId: req.user.id, planType, lineItems: lineItems.length },
      "Creating Stripe checkout session",
    );

    // Create checkout session with detailed error context
    let session: Stripe.Checkout.Session;
    try {
      session = await stripeClient.checkout.sessions.create({
        mode: stripePriceMode,
        line_items: lineItems,
        customer: customerId,
        client_reference_id: req.user.id,
        metadata: { userId: req.user.id, planType },
        billing_address_collection: "auto",
        allow_promotion_codes: true,
        success_url: successUrl,
        cancel_url: cancelUrl,
        ...(stripePriceMode === "subscription"
          ? { subscription_data: { metadata: { userId: req.user.id, planType } } }
          : {}),
      });
    } catch (checkoutErr: unknown) {
      logger.error(
        {
          userId: req.user.id,
          planType,
          error: checkoutErr instanceof Error ? checkoutErr.message : String(checkoutErr),
          errorType: checkoutErr instanceof Error ? checkoutErr.constructor.name : typeof checkoutErr,
        },
        "Stripe checkout session creation failed",
      );
      throw checkoutErr;
    }

    if (!session.url) {
      logger.error(
        { userId: req.user.id, sessionId: session.id },
        "Stripe session created but no checkout URL provided",
      );
      res.status(500).json({
        error: "Failed to generate payment checkout. Please try again.",
        code: "no_checkout_url",
      });
      return;
    }

    logger.info(
      { userId: req.user.id, planType, sessionId: session.id },
      "Stripe checkout session created successfully",
    );

    res.status(201).json({ url: session.url });
  } catch (err: unknown) {
    const { message, code } = getStripeErrorMessage(err);
    
    logger.error(
      {
        userId: req.user.id,
        planType: req.body?.planType,
        errorCode: code,
        errorMessage: message,
        rawError: err instanceof Error ? err.message : String(err),
      },
      "Stripe checkout failed",
    );

    res.status(500).json({
      error: message,
      code: code,
    });
  }
});

/**
 * ── Health check endpoint for Stripe configuration ──
 * Returns current configuration status without exposing sensitive keys
 */
router.get("/stripe/health", async (req: Request, res): Promise<void> => {
  const status = {
    configured: !!stripeClient,
    apiKeyPresent: !!stripeSecretKey,
    athletePriceConfigured: !!athletePriceId,
    coachBasePriceConfigured: !!coachBasePriceId,
    coachAdditionalPriceConfigured: !!coachAdditionalPriceId,
    stripePriceMode,
    timestamp: new Date().toISOString(),
  };

  logger.info(status, "Stripe health check");
  res.json(status);
});

/**
 * ── Current user's subscription state ──
 * Read straight from our DB (kept in sync by the webhook / refresh). The app
 * gate calls this to decide whether to grant access.
 */
router.get("/stripe/subscription", async (req: Request, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  res.set("Cache-Control", "no-store");
  const [profile] = await db
    .select({
      status: athleteProfileTable.subscriptionStatus,
      currentPeriodEnd: athleteProfileTable.subscriptionCurrentPeriodEnd,
    })
    .from(athleteProfileTable)
    .where(eq(athleteProfileTable.userId, req.user.id))
    .limit(1);

  const status = profile?.status ?? null;

  // Athletes on a coach's team are covered by that coach's plan and don't need
  // their own subscription. Only check membership when the profile's own
  // subscription isn't already active, so we avoid the extra query for
  // self-paying users.
  let isActive = isAccessActive(status, profile?.currentPeriodEnd);
  let effectiveStatus = status;
  if (!isActive && (await isCoveredByTeam(req.user.id))) {
    isActive = true;
    effectiveStatus = "team";
  }

  res.json({
    status: effectiveStatus,
    isActive,
    currentPeriodEnd: profile?.currentPeriodEnd ? profile.currentPeriodEnd.toISOString() : null,
  });
});

/**
 * ── Dev access code ──
 * Grants a permanent, non-Stripe "comp" subscription (used for internal
 * testers/devs, not real customers) when the caller supplies the code set in
 * DEV_ACCESS_CODE. No-ops as 404 if that env var isn't configured, so this
 * silently doesn't exist in an environment where nobody set a code.
 */
router.post("/stripe/dev-access", async (req: Request, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const devAccessCode = process.env.DEV_ACCESS_CODE;
  if (!devAccessCode) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const code = typeof req.body?.code === "string" ? req.body.code.trim() : "";
  if (!code || code !== devAccessCode) {
    logger.warn({ userId: req.user.id }, "Dev access code redemption attempt failed");
    res.status(403).json({ error: "Invalid code" });
    return;
  }

  // The profile row is normally lazily created on first GET /athlete/profile
  // — ensure it exists first, otherwise this update silently affects 0 rows.
  await getOrCreateProfile(req.user.id);
  await db
    .update(athleteProfileTable)
    .set({ subscriptionStatus: "comp", subscriptionCurrentPeriodEnd: null })
    .where(eq(athleteProfileTable.userId, req.user.id));

  logger.info({ userId: req.user.id }, "Dev access code redeemed");
  res.json({ ok: true });
});

/**
 * ── Reconcile subscription state on demand ──
 * Called by the frontend right after returning from Stripe Checkout. Webhooks
 * are the source of truth but can lag a few seconds (and may be unconfigured in
 * local dev), so we pull the latest subscription for this customer and persist
 * it immediately for a snappy, reliable gate transition.
 */
router.post("/stripe/refresh", async (req: Request, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (!stripeClient) {
    res.status(503).json({ error: "Payment system is not available.", code: "stripe_not_configured" });
    return;
  }

  const [profile] = await db
    .select({ stripeCustomerId: athleteProfileTable.stripeCustomerId })
    .from(athleteProfileTable)
    .where(eq(athleteProfileTable.userId, req.user.id))
    .limit(1);

  const customerId = profile?.stripeCustomerId;
  if (!customerId) {
    res.json({ status: null, isActive: false, currentPeriodEnd: null });
    return;
  }

  try {
    const subs = await stripeClient.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 1,
    });
    const sub = subs.data[0];
    if (!sub) {
      res.json({ status: null, isActive: false, currentPeriodEnd: null });
      return;
    }
    await persistSubscription(req.user.id, sub);
    res.json({
      status: sub.status,
      isActive: isActiveStatus(sub.status),
      currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
    });
  } catch (err) {
    logger.error(
      { userId: req.user.id, err: err instanceof Error ? err.message : String(err) },
      "Stripe subscription refresh failed",
    );
    res.status(500).json({ error: "Unable to refresh subscription.", code: "refresh_failed" });
  }
});

/**
 * ── Stripe webhook (source of truth for subscription state) ──
 * Mounted with a raw body parser in app.ts so the signature can be verified.
 */
router.post("/stripe/webhook", async (req: Request, res): Promise<void> => {
  if (!stripeClient) {
    res.status(503).json({ error: "stripe_not_configured" });
    return;
  }
  if (!stripeWebhookSecret) {
    logger.error({}, "Stripe webhook received but STRIPE_WEBHOOK_SECRET not configured");
    res.status(503).json({ error: "webhook_secret_not_configured" });
    return;
  }

  const signature = req.headers["stripe-signature"];
  let event: Stripe.Event;
  try {
    event = stripeClient.webhooks.constructEvent(
      req.body as Buffer,
      signature as string,
      stripeWebhookSecret,
    );
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : String(err) },
      "Stripe webhook signature verification failed",
    );
    res.status(400).json({ error: "invalid_signature" });
    return;
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId ?? session.client_reference_id ?? null;
        if (userId && session.subscription) {
          const subId = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
          const sub = await stripeClient.subscriptions.retrieve(subId);
          await persistSubscription(userId, sub);
          logger.info({ userId, subId, status: sub.status }, "Subscription activated via checkout");
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = await resolveUserId(sub);
        if (userId) {
          await persistSubscription(userId, sub);
          logger.info({ userId, subId: sub.id, status: sub.status }, "Subscription state synced via webhook");
        } else {
          logger.warn({ subId: sub.id }, "Stripe webhook: could not resolve userId for subscription");
        }
        break;
      }
      default:
        break;
    }
    res.json({ received: true });
  } catch (err) {
    logger.error(
      { err: err instanceof Error ? err.message : String(err), type: event.type },
      "Stripe webhook handler error",
    );
    res.status(500).json({ error: "handler_error" });
  }
});

export default router;
