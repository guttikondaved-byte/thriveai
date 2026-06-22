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
