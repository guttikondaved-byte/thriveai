import { createClerkClient } from "@clerk/backend";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { sql } from "drizzle-orm";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

const clerk = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY!,
  publishableKey: process.env.CLERK_PUBLISHABLE_KEY!,
});

async function migrateUser(oldId: string, email: string, firstName: string | null, lastName: string | null) {
  try {
    // Check if Clerk user already exists
    const existingUsers = await clerk.users.getUserList({ emailAddress: [email] });
    let clerkUser;
    if (existingUsers.data.length > 0) {
      clerkUser = existingUsers.data[0];
      console.log(`  Clerk user already exists: ${clerkUser.id}`);
    } else {
      // Create a new Clerk user
      clerkUser = await clerk.users.createUser({
        emailAddress: [email],
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        password: "ThriveReset123!", // Temporary password
      });
      console.log(`  Created Clerk user: ${clerkUser.id}`);
    }

    const clerkId = clerkUser.id;

    // Update child tables in DB
    await db.execute(sql`UPDATE athlete_profile SET user_id = ${clerkId} WHERE user_id = ${oldId}`);
    await db.execute(sql`UPDATE teams SET coach_user_id = ${clerkId} WHERE coach_user_id = ${oldId}`);
    await db.execute(sql`UPDATE team_memberships SET athlete_user_id = ${clerkId} WHERE athlete_user_id = ${oldId}`);
    await db.execute(sql`UPDATE notifications SET user_id = ${clerkId} WHERE user_id = ${oldId}`);
    await db.execute(sql`UPDATE strava_tokens SET user_id = ${clerkId} WHERE user_id = ${oldId}`);
    await db.execute(sql`UPDATE activities SET user_id = ${clerkId} WHERE user_id = ${oldId}`);
    await db.execute(sql`UPDATE injury_alerts SET user_id = ${clerkId} WHERE user_id = ${oldId}`);
    await db.execute(sql`UPDATE training_plans SET user_id = ${clerkId} WHERE user_id = ${oldId}`);
    await db.execute(sql`UPDATE conversations SET user_id = ${clerkId} WHERE user_id = ${oldId}`);

    // Update users table PK
    await db.execute(sql`
      UPDATE users
      SET id = ${clerkId}, updated_at = NOW()
      WHERE id = ${oldId}
    `);

    console.log(`  Migrated to Clerk ID: ${clerkId}`);
    return { success: true, clerkId };
  } catch (err: unknown) {
    console.error(`  FAILED: ${err instanceof Error ? err.message : String(err)}`);
    return { success: false, error: err };
  }
}

async function main() {
  // Find coaches with multiple athletes
  const coaches = await db.execute(sql`
    SELECT DISTINCT u.id, u.email, u.first_name, u.last_name
    FROM users u
    JOIN teams t ON t.coach_user_id = u.id
    WHERE (SELECT COUNT(*) FROM team_memberships WHERE team_id = t.id) > 1
  `);

  console.log(`Found ${coaches.rowCount} coaches with multiple athletes`);

  for (const coach of coaches.rows) {
    console.log(`\nMigrating: ${coach.email} (${coach.first_name || ""} ${coach.last_name || ""})`);
    await migrateUser(coach.id, coach.email, coach.first_name, coach.last_name);
  }

  // Also migrate the specific athletes mentioned
  console.log("\n\n--- Migrating Aditya's account ---");
  const aditya = await db.execute(sql`
    SELECT id, email, first_name, last_name FROM users WHERE email = 'gargaditya061@gmail.com'
  `);
  if (aditya.rows.length > 0) {
    const row = aditya.rows[0];
    await migrateUser(row.id, row.email, row.first_name, row.last_name);
  }

  await pool.end();
  console.log("\nMigration complete!");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
