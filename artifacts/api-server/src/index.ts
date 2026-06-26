import app from "./app";
import { logger } from "./lib/logger";
import { registerStravaWebhook, getStravaWebhookSubscription } from "./lib/strava";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, async (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // ── Validate Stripe configuration ──
  validateStripeConfiguration();

  // Auto-register Strava webhook subscription on startup if credentials are present
  if (process.env.STRAVA_CLIENT_ID && process.env.STRAVA_CLIENT_SECRET) {
    try {
      const existing = await getStravaWebhookSubscription() as Array<{ id: number }>;
      if (Array.isArray(existing) && existing.length === 0) {
        logger.info("No Strava webhook subscription found — registering…");
        const result = await registerStravaWebhook();
        logger.info({ result }, "Strava webhook registration result");
      } else {
        logger.info({ subscriptions: existing }, "Strava webhook already registered");
      }
    } catch (e) {
      logger.warn({ err: e }, "Could not check/register Strava webhook");
    }
  }
});

/**
 * Validate Stripe configuration on startup
 */
function validateStripeConfiguration() {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const athletePriceId = process.env.STRIPE_PRICE_ID_ATHLETE ?? process.env.STRIPE_PRICE_ID;
  const coachBasePriceId = process.env.STRIPE_PRICE_ID_COACH_BASE;
  const coachAdditionalPriceId = process.env.STRIPE_PRICE_ID_COACH_ADDITIONAL;
  const stripePriceMode = process.env.STRIPE_PRICE_MODE === "payment" ? "payment" : "subscription";

  const config = {
    stripeKeyConfigured: !!stripeSecretKey,
    athletePriceConfigured: !!athletePriceId,
    coachBasePriceConfigured: !!coachBasePriceId,
    coachAdditionalPriceConfigured: !!coachAdditionalPriceId,
    stripePriceMode,
  };

  if (!stripeSecretKey) {
    logger.warn({}, "⚠️  STRIPE_SECRET_KEY not configured. Payment features will be unavailable.");
  } else if (!athletePriceId && !coachBasePriceId) {
    logger.warn({}, "⚠️  Stripe price IDs not configured. Payment features will be unavailable.");
  } else {
    const missing = [];
    if (!athletePriceId) missing.push("STRIPE_PRICE_ID_ATHLETE");
    if (!coachBasePriceId) missing.push("STRIPE_PRICE_ID_COACH_BASE");
    if (!coachAdditionalPriceId) missing.push("STRIPE_PRICE_ID_COACH_ADDITIONAL");

    if (missing.length > 0) {
      logger.warn(
        { missing },
        `⚠️  Some Stripe price IDs are missing: ${missing.join(", ")}. Limited payment functionality.`,
      );
    } else {
      logger.info(config, "✓ Stripe configuration is complete");
    }
  }
}
