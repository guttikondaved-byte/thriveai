// One-off recovery tool for the Render free-database expiration incident
// (2026-07-24): the old Postgres instance is unreachable and its data is
// gone, but Stripe is the real source of truth for who paid, and Clerk is
// the real source of truth for who they are — neither was affected. This
// re-derives each paying user's role + subscription state from Stripe and
// writes it into the fresh database, so they land back on their dashboard
// already unlocked instead of hitting the paywall or onboarding again.
//
// Everything else (training plans, activities, manual profile fields, chat
// history) is NOT recoverable this way and is genuinely gone.
//
// Usage:
//   DATABASE_URL=... STRIPE_SECRET_KEY=... CLERK_SECRET_KEY=... \
//   STRIPE_PRICE_ID_ATHLETE=... STRIPE_PRICE_ID_COACH_BASE=... \
//     pnpm --filter @workspace/scripts recover-paid-subscribers -- [--dry-run]

import { clerkClient } from "@clerk/express";
import Stripe from "stripe";
import { db, usersTable, athleteProfileTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const dryRun = process.argv.includes("--dry-run");

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const athletePriceId = process.env.STRIPE_PRICE_ID_ATHLETE;
const coachBasePriceId = process.env.STRIPE_PRICE_ID_COACH_BASE;

if (!stripeSecretKey) throw new Error("STRIPE_SECRET_KEY must be set");
if (!process.env.CLERK_SECRET_KEY) throw new Error("CLERK_SECRET_KEY must be set");
if (!athletePriceId && !coachBasePriceId) {
  throw new Error("Set STRIPE_PRICE_ID_ATHLETE and/or STRIPE_PRICE_ID_COACH_BASE to identify plan roles");
}

const stripe = new Stripe(stripeSecretKey, { apiVersion: "2022-11-15" });

function roleForPriceIds(priceIds: string[]): "athlete" | "coach" | null {
  if (coachBasePriceId && priceIds.includes(coachBasePriceId)) return "coach";
  if (athletePriceId && priceIds.includes(athletePriceId)) return "athlete";
  return null;
}

async function main() {
  console.log(dryRun ? "DRY RUN — no writes will happen\n" : "LIVE RUN — writing to the database\n");

  const restored: string[] = [];
  const skipped: Record<string, string[]> = {};

  function skip(email: string, reason: string) {
    (skipped[reason] ??= []).push(email);
  }

  // Recover-worthy statuses: someone who paid at least once, even if their
  // subscription has since lapsed — that's still a real account to restore,
  // just without an active plan.
  const statuses: Stripe.Subscription.Status[] = ["active", "trialing", "past_due", "canceled", "unpaid"];

  for (const status of statuses) {
    for await (const sub of stripe.subscriptions.list({ status, expand: ["data.customer"], limit: 100 })) {
      const customer = sub.customer;
      if (typeof customer === "string" || customer.deleted) {
        skip(`(subscription ${sub.id})`, "customer not expanded or deleted");
        continue;
      }
      const email = customer.email;
      if (!email) {
        skip(`(subscription ${sub.id})`, "customer has no email");
        continue;
      }

      const priceIds = sub.items.data.map(item => item.price.id);
      const role = roleForPriceIds(priceIds);
      if (!role) {
        skip(email, `no matching price id (${priceIds.join(", ")}) — can't infer athlete vs coach`);
        continue;
      }

      const clerkUsers = await clerkClient.users.getUserList({ emailAddress: [email] });
      const clerkUser = clerkUsers.data[0];
      if (!clerkUser) {
        skip(email, "no matching Clerk account");
        continue;
      }

      console.log(`${email} → ${role}, ${sub.status} (Clerk ${clerkUser.id})`);
      restored.push(email);

      if (dryRun) continue;

      await db
        .insert(usersTable)
        .values({
          id: clerkUser.id,
          email,
          firstName: clerkUser.firstName,
          lastName: clerkUser.lastName,
          profileImageUrl: clerkUser.imageUrl,
        })
        .onConflictDoNothing({ target: usersTable.id });

      const existing = await db
        .select({ id: athleteProfileTable.id })
        .from(athleteProfileTable)
        .where(eq(athleteProfileTable.userId, clerkUser.id));

      const subscriptionFields = {
        userRole: role,
        stripeCustomerId: customer.id,
        stripeSubscriptionId: sub.id,
        subscriptionStatus: sub.status,
        subscriptionCurrentPeriodEnd: new Date(sub.current_period_end * 1000),
      };

      if (existing.length > 0) {
        await db.update(athleteProfileTable).set(subscriptionFields).where(eq(athleteProfileTable.userId, clerkUser.id));
      } else {
        await db.insert(athleteProfileTable).values({ userId: clerkUser.id, ...subscriptionFields });
      }
    }
  }

  console.log(`\nRestored ${restored.length} account(s)${dryRun ? " (dry run — nothing written)" : ""}`);
  const skippedTotal = Object.values(skipped).reduce((a, b) => a + b.length, 0);
  if (skippedTotal > 0) {
    console.log(`\nSkipped ${skippedTotal} — needs manual review:`);
    for (const [reason, emails] of Object.entries(skipped)) {
      console.log(`  ${reason}:`);
      for (const email of emails) console.log(`    ${email}`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
