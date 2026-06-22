import { clerkClient } from "@clerk/express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

async function migrateUser(oldId, email, firstName, lastName) {
  try {
    const existingList = await clerkClient.users.getUserList({
      emailAddress: [email],
    });
    let clerkUser;
    if (existingList.data.length > 0) {
      clerkUser = existingList.data[0];
      console.log(`  Clerk user already exists: ${clerkUser.id}`);
    } else {
      clerkUser = await clerkClient.users.createUser({
        emailAddress: [email],
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        password: "ThriveReset123!",
      });
      console.log(`  Created Clerk user: ${clerkUser.id}`);
    }

    const clerkId = clerkUser.id;
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
        SET id = ${clerkId}, updated_at = NOW()
        WHERE id = ${oldId}
      `);
    });
    console.log(`  Migrated successfully to: ${clerkId}`);
  } catch (err) {
    console.error(`  FAILED: ${err.message || err}`);
  }
}

async function main() {
  console.log("--- Migrating taylorsmith@gmail.com ---");
  await migrateUser("e433a331-58bb-41d5-82cf-1b4b15caa0b6", "taylorsmith@gmail.com", "Taylor", "Smith");

  console.log("\n--- Migrating gargaditya061@gmail.com ---");
  await migrateUser("93a74eff-ccac-45ce-9ea0-bae2327d2cae", "gargaditya061@gmail.com", "Aditya", "Garg");

  console.log("\nDone!");
  process.exit(0);
}

main();
