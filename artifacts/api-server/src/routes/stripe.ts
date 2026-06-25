import { Router, type Request, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import Stripe from "stripe";
import { db, athleteProfileTable, teamsTable, teamMembershipsTable } from "@workspace/db";

const router: IRouter = Router();

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripePriceMode = process.env.STRIPE_PRICE_MODE === "payment" ? "payment" : "subscription";
const athletePriceId = process.env.STRIPE_PRICE_ID_ATHLETE ?? process.env.STRIPE_PRICE_ID;
const coachBasePriceId = process.env.STRIPE_PRICE_ID_COACH_BASE;
const coachAdditionalPriceId = process.env.STRIPE_PRICE_ID_COACH_ADDITIONAL;
const stripeClient = stripeSecretKey ? new Stripe(stripeSecretKey, { apiVersion: "2024-11-08" }) : null;

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

  if (!stripeClient) {
    res.status(503).json({ error: "Stripe is not configured" });
    return;
  }

  const planType = req.body?.planType === "coach" ? "coach" : "athlete";

  if (planType === "athlete") {
    if (!athletePriceId) {
      res.status(503).json({ error: "Stripe athlete price ID is not configured" });
      return;
    }
  } else {
    if (!coachBasePriceId) {
      res.status(503).json({ error: "Stripe coach base price ID is not configured" });
      return;
    }
    if (!coachAdditionalPriceId) {
      res.status(503).json({ error: "Stripe coach additional athlete price ID is not configured" });
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
      const [profile] = await db
        .select({ userRole: athleteProfileTable.userRole })
        .from(athleteProfileTable)
        .where(eq(athleteProfileTable.userId, req.user.id))
        .limit(1);

      if (profile?.userRole !== "coach") {
        res.status(403).json({ error: "Only coaches can purchase the coach plan" });
        return;
      }

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
    }

    const session = await stripeClient.checkout.sessions.create({
      mode: stripePriceMode,
      line_items: lineItems,
      customer_email: req.user.email ?? undefined,
      billing_address_collection: "auto",
      allow_promotion_codes: true,
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    if (!session.url) {
      res.status(500).json({ error: "Failed to create Stripe checkout session" });
      return;
    }

    res.status(201).json({ url: session.url });
  } catch (err: unknown) {
    console.error("Stripe checkout session error", err);
    res.status(500).json({ error: "Unable to create checkout session" });
  }
});

export default router;
