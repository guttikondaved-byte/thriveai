import { clerkClient } from "@clerk/express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

async function migrateUser(oldId: string, email: string, firstName: string | null, lastName: string | null) {
  try {
    // Check if a Clerk user with this email already exists
    const existingList = await clerkClient.users.getUserList({
      emailAddress: [email],
    });
    let clerkUser;
    if (existingList.data.length > 0) {
      clerkUser = existingList.data[0];
      console.log(`  Clerk user already exists: ${clerkUser.id}`);
    } else {
      // Create a new Clerk user with a temporary password
      clerkUser = await clerkClient.users.createUser({
        emailAddress: [email],
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        password: "ThriveReset123!",
      });
      console.log(`  Created Clerk user: ${clerkUser.id}`);
    }

    const clerkId = clerkUser.id;

    // Run transaction to update all child tables
    await db.transaction(async (tx) => {
      await tx.execute(sql`UPDATE athlete_profile SET user_id = ${clerkId} WHERE user_id = ${oldId}`);
      await tx.execute(sql`UPDATE teams SET coach_user_id = ${clerkId} WHERE coach_user_id = ${oldId}`);
      await tx.execute(sql`UPDATE team_memberships SET athlete_user_id = ${clerkId} WHERE athlete_user_id = ${oldId}`);
      await tx.execute(sql`UPDATE notifications SET user_id = ${clerkId} WHERE user_id = ${oldId}`);
      await tx.execute(sql`UPDATE strava_tokens SET user_id = ${clerkId} WHERE user_id = ${oldId}`);
      await tx.execute(sql`UPDATE activities SET user_id = ${clerkId} WHERE user_id = ${oldId}`);
      await tx.execute(sql`UPDATE injury_alerts SET user_id = ${clerkId} WHERE user_id = ${oldId}`);
      await tx.execute(sql`UPDATE training_plans SET user_id = ${clerkId} WHERE user_id = ${oldId}`);
      await tx.execute(sql`UPDATE conversations SET user_id = ${clerkId} WHERE user_id = ${oldId}`);
      await tx.execute(sql`
        UPDATE users
        SET id = ${clerkId},
            first_name = COALESCE(${firstName}, first_name),
            last_name = COALESCE(${lastName}, last_name),
            updated_at = NOW()
        WHERE id = ${oldId}
      `);
    });

    console.log(`  Migrated to Clerk ID: ${clerkId}`);
    return { success: true, clerkId };
  } catch (err: unknown) {
    console.error(`  FAILED: ${err instanceof Error ? err.message : String(err)}`);
    return { success: false, error: err };
  }
}

async function main() {
  // Find coaches with multiple athletes (more than 1 athlete in any team)
  const coaches = await db.execute(sql`
    SELECT DISTINCT u.id, u.email, u.first_name, u.last_name
    FROM users u
    JOIN teams t ON t.coach_user_id = u.id
    WHERE (SELECT COUNT(*) FROM team_memberships WHERE team_id = t.id) > 1
  `);

  console.log(`Found ${coaches.rowCount} coaches with multiple athletes`);
  for (const coach of coaches.rows) {
    console.log(`\nMigrating coach: ${coach.email} (${coach.first_name || ""} ${coach.last_name || ""})`);
    await migrateUser(coach.id, coach.email, coach.first_name, coach.last_name);
  }

  // Also migrate Aditya's athlete account
  console.log("\n\n--- Migrating Aditya's athlete account ---");
  const aditya = await db.execute(sql`
    SELECT id, email, first_name, last_name FROM users WHERE email = 'gargaditya061@gmail.com'
  `);
  if (aditya.rows.length > 0) {
    const row = aditya.rows[0];
    await migrateUser(row.id, row.email, row.first_name, row.last_name);
  }

  console.log("\nMigration complete!");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
