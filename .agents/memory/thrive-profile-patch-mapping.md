---
name: Thrive athlete-profile PATCH field mapping
description: Why Health & History saves 500'd, and the resolver-scoping rule for per-user sub-resources
---

# athlete_profile PATCH builds updateData field-by-field — keep it in lockstep with the contract

The `PATCH /athlete/profile` handler maps each request field individually into an
`updateData` object (`if (parsed.data.X !== undefined) updateData.X = ...`). Any field
present in the OpenAPI contract + DB column but MISSING from this mapping silently
drops out, so a request that only sets such a field yields `updateData = {}` and
`db.update().set({})` throws **"No values to set"** → 500 on every save.

**Why:** Health & History (`history.tsx`) saved `pr5k/pr10k/prHalf/prMarathon` and
`healthNotes` via `useUpdateAthleteProfile`, but the handler only mapped the
onboarding/profile fields. Result: every PR/notes save 500'd even though the columns
and contract already had the fields.

**How to apply:**
- When you add a column + contract field to athlete_profile, you MUST also add its
  line to the `updateData` mapping in `athlete.ts`, or saves for that field 500.
- Keep an empty-update guard: if `Object.keys(updateData).length === 0`, return the
  existing profile instead of calling `.set({})`. Mirror the GET handler's
  `fitnessLevel` sanitization on that path so legacy-invalid rows don't fail `.parse`.

# Per-user sub-resource routes must scope by req.user.id, not "first row"

`injuries.ts` resolved the profile with a `SELECT ... LIMIT 1` and NO user filter, and
had no auth guard — so every user read/wrote the FIRST athlete_profile row in the
table (cross-user data leak + a user's own injuries appeared not to save).

**How to apply:** resolve the profile with `eq(athleteProfileTable.userId, req.user.id)`
and guard every route with `req.isAuthenticated()`. Use a read-only lookup for
GET/PATCH/DELETE (return `[]` / 404 when absent — never create on a read); only
get-or-create on POST. Note `injuries` date columns are `date(mode:"string")` but the
generated zod parses to `Date`, so normalize with a `toDateString` helper before insert/update.
