import * as oidc from "openid-client";
import { Router, type IRouter, type Request, type Response } from "express";
import { clerkClient } from "@clerk/express";
import bcrypt from "bcryptjs";
import {
  GetCurrentAuthUserResponse,
  ExchangeMobileAuthorizationCodeBody,
  ExchangeMobileAuthorizationCodeResponse,
  LogoutMobileSessionResponse,
} from "@workspace/api-zod";
import {
  db,
  usersTable,
  activitiesTable,
  notificationsTable,
  stravaTokensTable,
  athleteProfileTable,
  teamMembershipsTable,
  teamsTable,
  trainingPlansTable,
  injuryAlertsTable,
  conversations,
  sessionsTable,
} from "@workspace/db";
import { eq, inArray, sql } from "drizzle-orm";
import { stripe } from "../lib/stripe";
import {
  clearSession,
  getOidcConfig,
  getSessionId,
  createSession,
  deleteSession,
  SESSION_COOKIE,
  SESSION_TTL,
  ISSUER_URL,
  type SessionData,
} from "../lib/auth";

const OIDC_COOKIE_TTL = 10 * 60 * 1000;

const router: IRouter = Router();

function getOrigin(req: Request): string {
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host =
    req.headers["x-forwarded-host"] || req.headers["host"] || "localhost";
  return `${proto}://${host}`;
}

function setSessionCookie(res: Response, sid: string) {
  res.cookie(SESSION_COOKIE, sid, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL,
  });
}

function setOidcCookie(res: Response, name: string, value: string) {
  res.cookie(name, value, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: OIDC_COOKIE_TTL,
  });
}

function getSafeReturnTo(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }
  return value;
}

async function upsertUser(claims: Record<string, unknown>) {
  const userData = {
    id: claims.sub as string,
    email: (claims.email as string) || null,
    firstName: (claims.first_name as string) || null,
    lastName: (claims.last_name as string) || null,
    profileImageUrl: (claims.profile_image_url || claims.picture) as
      | string
      | null,
  };

  const [user] = await db
    .insert(usersTable)
    .values(userData)
    .onConflictDoUpdate({
      target: usersTable.id,
      set: {
        ...userData,
        updatedAt: new Date(),
      },
    })
    .returning();
  return user;
}

router.get("/auth/user", (req: Request, res: Response) => {
  res.set("Cache-Control", "no-store");
  res.json(
    GetCurrentAuthUserResponse.parse({
      user: req.isAuthenticated() ? req.user : null,
    }),
  );
});

// ── Email / password register ──────────────────────────────────────────────
router.post("/auth/register", async (req: Request, res: Response) => {
  const { email, password, name } = req.body;

  if (!email || typeof email !== "string" || !email.includes("@")) {
    res.status(400).json({ error: "A valid email address is required" });
    return;
  }
  if (!password || typeof password !== "string" || password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters" });
    return;
  }

  const existing = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, email.toLowerCase())).limit(1);
  if (existing.length > 0) {
    res.status(409).json({ error: "An account with that email already exists" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const nameParts = (name ?? "").trim().split(/\s+/);
  const firstName = nameParts[0] ?? null;
  const lastName = nameParts.slice(1).join(" ") || null;

  const [user] = await db.insert(usersTable).values({
    email: email.toLowerCase(),
    firstName,
    lastName,
    passwordHash,
  }).returning();

  const sessionData: SessionData = {
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      profileImageUrl: user.profileImageUrl,
    },
    access_token: "",
    refresh_token: undefined,
    expires_at: undefined,
  };

  const sid = await createSession(sessionData);
  setSessionCookie(res, sid);
  res.json({ ok: true, sid });
});

// ── Email / password login ─────────────────────────────────────────────────
router.post("/auth/login", async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || typeof email !== "string" || !password || typeof password !== "string") {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase())).limit(1);
  if (!user || !user.passwordHash) {
    res.status(401).json({ error: "Incorrect email or password" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Incorrect email or password" });
    return;
  }

  const sessionData: SessionData = {
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      profileImageUrl: user.profileImageUrl,
    },
    access_token: "",
    refresh_token: undefined,
    expires_at: undefined,
  };

  const sid = await createSession(sessionData);
  setSessionCookie(res, sid);
  res.json({ ok: true });
});

router.get("/login", async (req: Request, res: Response) => {
  const config = await getOidcConfig();
  const callbackUrl = `${getOrigin(req)}/api/callback`;

  const returnTo = getSafeReturnTo(req.query.returnTo);

  const state = oidc.randomState();
  const nonce = oidc.randomNonce();
  const codeVerifier = oidc.randomPKCECodeVerifier();
  const codeChallenge = await oidc.calculatePKCECodeChallenge(codeVerifier);

  const redirectTo = oidc.buildAuthorizationUrl(config, {
    redirect_uri: callbackUrl,
    scope: "openid email profile offline_access",
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    prompt: "login consent",
    state,
    nonce,
  });

  setOidcCookie(res, "code_verifier", codeVerifier);
  setOidcCookie(res, "nonce", nonce);
  setOidcCookie(res, "state", state);
  setOidcCookie(res, "return_to", returnTo);

  res.redirect(redirectTo.href);
});

// Query params are not validated because the OIDC provider may include
// parameters not expressed in the schema.
router.get("/callback", async (req: Request, res: Response) => {
  const config = await getOidcConfig();
  const callbackUrl = `${getOrigin(req)}/api/callback`;

  const codeVerifier = req.cookies?.code_verifier;
  const nonce = req.cookies?.nonce;
  const expectedState = req.cookies?.state;

  if (!codeVerifier || !expectedState) {
    res.redirect("/api/login");
    return;
  }

  const currentUrl = new URL(
    `${callbackUrl}?${new URL(req.url, `http://${req.headers.host}`).searchParams}`,
  );

  let tokens: oidc.TokenEndpointResponse & oidc.TokenEndpointResponseHelpers;
  try {
    tokens = await oidc.authorizationCodeGrant(config, currentUrl, {
      pkceCodeVerifier: codeVerifier,
      expectedNonce: nonce,
      expectedState,
      idTokenExpected: true,
    });
  } catch {
    res.redirect("/api/login");
    return;
  }

  const returnTo = getSafeReturnTo(req.cookies?.return_to);

  res.clearCookie("code_verifier", { path: "/" });
  res.clearCookie("nonce", { path: "/" });
  res.clearCookie("state", { path: "/" });
  res.clearCookie("return_to", { path: "/" });

  const claims = tokens.claims();
  if (!claims) {
    res.redirect("/api/login");
    return;
  }

  const dbUser = await upsertUser(
    claims as unknown as Record<string, unknown>,
  );

  const now = Math.floor(Date.now() / 1000);
  const sessionData: SessionData = {
    user: {
      id: dbUser.id,
      email: dbUser.email,
      firstName: dbUser.firstName,
      lastName: dbUser.lastName,
      profileImageUrl: dbUser.profileImageUrl,
    },
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: tokens.expiresIn() ? now + tokens.expiresIn()! : claims.exp,
  };

  const sid = await createSession(sessionData);
  setSessionCookie(res, sid);
  res.redirect(returnTo);
});

router.get("/logout", async (req: Request, res: Response) => {
  const config = await getOidcConfig();
  const origin = getOrigin(req);

  const sid = getSessionId(req);
  await clearSession(res, sid);

  const endSessionUrl = oidc.buildEndSessionUrl(config, {
    client_id: process.env.REPL_ID!,
    post_logout_redirect_uri: origin,
  });

  res.redirect(endSessionUrl.href);
});

router.post(
  "/mobile-auth/token-exchange",
  async (req: Request, res: Response) => {
    const parsed = ExchangeMobileAuthorizationCodeBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Missing or invalid required parameters" });
      return;
    }

    const { code, code_verifier, redirect_uri, state, nonce } = parsed.data;

    try {
      const config = await getOidcConfig();

      const callbackUrl = new URL(redirect_uri);
      callbackUrl.searchParams.set("code", code);
      callbackUrl.searchParams.set("state", state);
      callbackUrl.searchParams.set("iss", ISSUER_URL);

      const tokens = await oidc.authorizationCodeGrant(config, callbackUrl, {
        pkceCodeVerifier: code_verifier,
        expectedNonce: nonce ?? undefined,
        expectedState: state,
        idTokenExpected: true,
      });

      const claims = tokens.claims();
      if (!claims) {
        res.status(401).json({ error: "No claims in ID token" });
        return;
      }

      const dbUser = await upsertUser(
        claims as unknown as Record<string, unknown>,
      );

      const now = Math.floor(Date.now() / 1000);
      const sessionData: SessionData = {
        user: {
          id: dbUser.id,
          email: dbUser.email,
          firstName: dbUser.firstName,
          lastName: dbUser.lastName,
          profileImageUrl: dbUser.profileImageUrl,
        },
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: tokens.expiresIn() ? now + tokens.expiresIn()! : claims.exp,
      };

      const sid = await createSession(sessionData);
      res.json(ExchangeMobileAuthorizationCodeResponse.parse({ token: sid }));
    } catch (err) {
      req.log.error({ err }, "Mobile token exchange error");
      res.status(500).json({ error: "Token exchange failed" });
    }
  },
);

router.post("/mobile-auth/logout", async (req: Request, res: Response) => {
  const sid = getSessionId(req);
  if (sid) {
    await deleteSession(sid);
  }
  res.json(LogoutMobileSessionResponse.parse({ success: true }));
});

// ── Delete account ──────────────────────────────────────────────────────────

/** A Clerk Backend API "user not found" (404) — i.e. the identity is already gone. */
function isClerkNotFound(err: unknown): boolean {
  const e = err as { status?: unknown; statusCode?: unknown } | null;
  return !!e && (e.status === 404 || e.statusCode === 404);
}

async function deleteClerkUserAndAwaitRemoval(userId: string): Promise<void> {
  try {
    await clerkClient.users.deleteUser(userId);
  } catch (err) {
    if (isClerkNotFound(err)) {
      return;
    }
    throw err;
  }

  const maxAttempts = 20;
  const delayMs = 250;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      await clerkClient.users.getUser(userId);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    } catch (err) {
      if (isClerkNotFound(err)) {
        return;
      }
      throw err;
    }
  }

  throw new Error("Clerk user still visible after delete");
}

router.delete("/account", async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const userId = req.user.id;

  // Delete the Clerk identity FIRST, as a hard precondition. The client keeps a valid
  // Clerk session for a moment after this request and immediately refetches authed
  // endpoints (profile, notifications). If we deleted the DB row first, those in-flight
  // requests would miss the authMiddleware fast path and JIT-reprovision the user:
  // clerkClient.users.getUser() would still succeed and re-insert the row, resurrecting
  // the email. Deleting the Clerk user first makes that getUser() 404 so provisioning
  // aborts. We must NOT proceed to the DB delete unless this succeeds, or the surviving
  // session would simply resurrect the account.
  // Track the Clerk user's email (if available) so we can defensively wipe
  // any leftover DB rows that reference the same email.
  let clerkEmail: string | null = null;
  try {
    try {
      const clerk = await clerkClient.users.getUser(userId);
      clerkEmail = clerk.emailAddresses[0]?.emailAddress ?? null;
    } catch (err) {
      if (!isClerkNotFound(err)) throw err;
      // Clerk user already gone — email is unknown.
      clerkEmail = null;
    }

    await deleteClerkUserAndAwaitRemoval(userId);
  } catch (err) {
    // 404 = the Clerk user is already gone (a retry after a partial failure, or deleted
    // from the dashboard) — that satisfies our goal, so continue. Any other error means
    // the identity may still be live; abort so we don't half-delete, and let the client
    // retry rather than leaving an account that resurrects itself.
    if (!isClerkNotFound(err)) {
      req.log.error({ err }, "Failed to delete Clerk user; aborting account deletion");
      res.status(502).json({ error: "Could not delete account. Please try again." });
      return;
    }
    req.log.warn({ userId }, "Clerk user already absent during account deletion; continuing");
  }

  // Gather every Stripe customer this account owns BEFORE we wipe the DB rows
  // (the customer id lives on athlete_profile, which the transaction deletes).
  // Includes any stale rows sharing the same email so a delete + recreate leaves
  // no billing/subscription memory behind.
  const stripeCustomerIds = new Set<string>();
  try {
    const [own] = await db
      .select({ c: athleteProfileTable.stripeCustomerId })
      .from(athleteProfileTable)
      .where(eq(athleteProfileTable.userId, userId))
      .limit(1);
    if (own?.c) stripeCustomerIds.add(own.c);

    if (clerkEmail) {
      const sameEmailUsers = await db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(eq(usersTable.email, clerkEmail));
      for (const u of sameEmailUsers) {
        const [p] = await db
          .select({ c: athleteProfileTable.stripeCustomerId })
          .from(athleteProfileTable)
          .where(eq(athleteProfileTable.userId, u.id))
          .limit(1);
        if (p?.c) stripeCustomerIds.add(p.c);
      }
    }
  } catch (err) {
    req.log?.warn({ err, userId }, "Failed to collect Stripe customer ids for deletion cleanup");
  }

  try {
    // Run as a single transaction so a partial failure never orphans the account.
    await db.transaction(async (tx) => {
      // Rows with a direct user_id FK to users
      await tx.delete(activitiesTable).where(eq(activitiesTable.userId, userId));
      await tx.delete(notificationsTable).where(eq(notificationsTable.userId, userId));
      await tx.delete(stravaTokensTable).where(eq(stravaTokensTable.userId, userId));
      await tx.delete(injuryAlertsTable).where(eq(injuryAlertsTable.userId, userId));
      // training_plans -> plan_sessions are removed via ON DELETE CASCADE
      await tx.delete(trainingPlansTable).where(eq(trainingPlansTable.userId, userId));

      // This user's own team memberships (as an athlete)
      await tx.delete(teamMembershipsTable).where(eq(teamMembershipsTable.athleteUserId, userId));

      // Teams this user coaches: other athletes' memberships reference team_id with no
      // cascade, so delete every membership for those teams before deleting the teams.
      const ownedTeams = await tx
        .select({ id: teamsTable.id })
        .from(teamsTable)
        .where(eq(teamsTable.coachUserId, userId));
      if (ownedTeams.length > 0) {
        const teamIds = ownedTeams.map((t) => t.id);
        await tx.delete(teamMembershipsTable).where(inArray(teamMembershipsTable.teamId, teamIds));
        await tx.delete(teamsTable).where(eq(teamsTable.coachUserId, userId));
      }

      // conversations.userId has no FK so they won't cascade; delete explicitly.
      // (messages cascade off conversations automatically)
      await tx.delete(conversations).where(eq(conversations.userId, userId));

      // athlete_profile -> injuries cascade (messages cascade off conversations)
      await tx.delete(athleteProfileTable).where(eq(athleteProfileTable.userId, userId));

      // Finally the user row
      await tx.delete(usersTable).where(eq(usersTable.id, userId));
    });

    // Clear the active session (sessions table stores data as JSONB with no direct userId column)
    const sid = getSessionId(req);
    if (sid) await deleteSession(sid);

    // Also purge any stale sessions belonging to this deleted user.
    // Session JSON is stored in `sess`; the user object lives under `sess.user.id`.
    await db
      .delete(sessionsTable)
      .where(sql`(sess->'user'->>'id') = ${userId}`);

    // Defensive wipe: if we know the user's email, remove any remaining
    // pre-Clerk user rows that still contain the same email. This prevents a
    // stale DB row from being re-attached to a newly-created Clerk identity
    // for the same email.
    if (clerkEmail) {
      try {
        await db.transaction(async (tx) => {
          const stale = await tx.select().from(usersTable).where(eq(usersTable.email, clerkEmail));
          for (const u of stale) {
            // Remove child rows that reference this user id (defensive, mirror above)
            await tx.delete(activitiesTable).where(eq(activitiesTable.userId, u.id));
            await tx.delete(notificationsTable).where(eq(notificationsTable.userId, u.id));
            await tx.delete(stravaTokensTable).where(eq(stravaTokensTable.userId, u.id));
            await tx.delete(injuryAlertsTable).where(eq(injuryAlertsTable.userId, u.id));
            await tx.delete(trainingPlansTable).where(eq(trainingPlansTable.userId, u.id));
            await tx.delete(teamMembershipsTable).where(eq(teamMembershipsTable.athleteUserId, u.id));
            const owned = await tx.select({ id: teamsTable.id }).from(teamsTable).where(eq(teamsTable.coachUserId, u.id));
            if (owned.length > 0) {
              const ids = owned.map(t => t.id);
              await tx.delete(teamMembershipsTable).where(inArray(teamMembershipsTable.teamId, ids));
              await tx.delete(teamsTable).where(eq(teamsTable.coachUserId, u.id));
            }
            await tx.delete(conversations).where(eq(conversations.userId, u.id));
            await tx.delete(athleteProfileTable).where(eq(athleteProfileTable.userId, u.id));
            await tx.delete(usersTable).where(eq(usersTable.id, u.id));
          }
        });
      } catch (err) {
        req.log?.warn({ err, userId, clerkEmail }, "Defensive wipe of stale email rows failed");
      }
    }

    // Erase Stripe memory: deleting the customer immediately cancels any active
    // trial/subscription and removes the customer record, so the email can sign
    // up again as a brand-new payer with no leftover billing history. Best-effort
    // — never block account deletion on a Stripe failure.
    if (stripe && stripeCustomerIds.size > 0) {
      for (const customerId of stripeCustomerIds) {
        try {
          await stripe.customers.del(customerId);
          req.log?.info({ userId, customerId }, "Deleted Stripe customer on account deletion");
        } catch (err) {
          req.log?.warn({ err, userId, customerId }, "Failed to delete Stripe customer on account deletion");
        }
      }
    }

    res.clearCookie(SESSION_COOKIE, { path: "/" });
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Account deletion failed");
    res.status(500).json({ error: "Account deletion failed" });
  }
});

export default router;
