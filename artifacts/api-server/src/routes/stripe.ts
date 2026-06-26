import { Router, type Request, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import Stripe from "stripe";
import { db, athleteProfileTable, teamsTable, teamMembershipsTable } from "@workspace/db";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripePriceMode = process.env.STRIPE_PRICE_MODE === "payment" ? "payment" : "subscription";
const athletePriceId = process.env.STRIPE_PRICE_ID_ATHLETE ?? process.env.STRIPE_PRICE_ID;
const coachBasePriceId = process.env.STRIPE_PRICE_ID_COACH_BASE;
const coachAdditionalPriceId = process.env.STRIPE_PRICE_ID_COACH_ADDITIONAL;
const stripeClient = stripeSecretKey ? new Stripe(stripeSecretKey, { apiVersion: "2022-11-15" }) : null;

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

  try {
    const baseUrl = getBaseUrl(req);
    const successUrl = new URL("/profile?checkout=success", baseUrl).toString();
    const cancelUrl = new URL("/profile?checkout=cancel", baseUrl).toString();

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
        customer_email: req.user.email ?? undefined,
        billing_address_collection: "auto",
        allow_promotion_codes: true,
        success_url: successUrl,
        cancel_url: cancelUrl,
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

export default router;
