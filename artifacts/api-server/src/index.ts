import app from "./app";
import { logger } from "./lib/logger";
import {
  registerStravaWebhook,
  getStravaWebhookSubscription,
  deleteStravaWebhookSubscription,
  getWebhookCallbackUrl,
  backfillStravaDetails,
} from "./lib/strava";
import { sendWeeklyCoachDigests } from "./lib/weeklyDigest";

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

  // Auto-register Strava webhook subscription on startup if credentials are present.
  // Also self-heals a stale subscription (e.g. left pointing at an old hosting
  // domain) by deleting and re-registering it against the current callback URL.
  if (process.env.STRAVA_CLIENT_ID && process.env.STRAVA_CLIENT_SECRET) {
    try {
      const existing = await getStravaWebhookSubscription() as Array<{ id: number; callback_url?: string }>;
      const expectedUrl = getWebhookCallbackUrl();
      const stale = Array.isArray(existing) ? existing.find((s) => s.callback_url !== expectedUrl) : undefined;

      if (Array.isArray(existing) && existing.length === 0) {
        logger.info("No Strava webhook subscription found — registering…");
        const result = await registerStravaWebhook();
        logger.info({ result }, "Strava webhook registration result");
      } else if (stale) {
        logger.warn(
          { staleUrl: stale.callback_url, expectedUrl },
          "Strava webhook subscription points at a stale URL — re-registering",
        );
        await deleteStravaWebhookSubscription(stale.id);
        const result = await registerStravaWebhook();
        logger.info({ result }, "Strava webhook re-registration result");
      } else {
        logger.info({ subscriptions: existing }, "Strava webhook already registered");
      }
    } catch (e) {
      logger.warn({ err: e }, "Could not check/register Strava webhook");
    }
  }

  // Gradual Strava detail backfill: tops up splits/best-efforts for
  // summary-only imports, 80 per 15-minute window (inside Strava's read
  // rate limit). Costs zero API calls when nothing is pending.
  const BACKFILL_INTERVAL_MS = 15 * 60 * 1000;
  const runBackfill = async () => {
    try {
      await backfillStravaDetails(80);
    } catch (e) {
      logger.warn({ err: e }, "Strava detail backfill run failed");
    }
  };
  setTimeout(runBackfill, 30_000); // first run shortly after boot
  setInterval(runBackfill, BACKFILL_INTERVAL_MS);

  // Weekly coach digest: sendWeeklyCoachDigests() is idempotent per team/week
  // (skips teams already sent this week), so checking every few hours costs
  // nothing on the other 6 days and just means it fires within a few hours
  // of Monday rather than needing a real cron trigger.
  const DIGEST_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
  const runDigestCheck = async () => {
    try {
      await sendWeeklyCoachDigests();
    } catch (e) {
      logger.warn({ err: e }, "Weekly coach digest run failed");
    }
  };
  setTimeout(runDigestCheck, 60_000); // first run shortly after boot
  setInterval(runDigestCheck, DIGEST_CHECK_INTERVAL_MS);
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
