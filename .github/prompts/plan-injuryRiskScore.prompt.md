
## Plan: Build Injury Risk Score System

TL;DR: Create a centralized server-side injury risk calculator, persist score/level on athlete profiles, recalculate on activity/wellness/injury changes, and update dashboard/alerts UI while preserving existing alert flows.

### Key goals
- Centralize injury risk logic in `artifacts/api-server/src/lib/injuryRisk.ts`
- Persist `injuryRiskScore` and `injuryRiskLevel` on athlete profiles
- Trigger recalculation from:
  - manual activity logging
  - Strava imports/webhook sync
  - athlete profile wellness updates
  - injury create/update/delete
  - athlete profile updates (e.g., age, weight, etc.)
  - Update dashboard and alerts UI to show risk score/level prominently
- Keep alerts page live, but add risk score visibility in dashboard/alerts
- risk score should be centralized and alerts should come secondary to the score, not the other way around
- Send notifications on meaningful risk changes

### Implementation steps
1. Backend storage
   - Add new columns in `lib/db/src/schema/athlete.ts`
   - Use Drizzle schema migration/push after changes

2. Shared risk service
   - New helper `artifacts/api-server/src/lib/injuryRisk.ts`
   - Compute score from:
     - recent activities
     - active injury history
     - wellness fields like HRV/resting heart rate
   - Map score to `low/medium/high/critical`
   - Persist to athlete profile
   - Update or insert injury alerts and create notifications as needed

3. Notification helper
   - Add reusable notification helper if needed
   - Use existing `notificationsTable` and route model

4. Trigger points
   - `artifacts/api-server/src/routes/activities.ts`
   - `artifacts/api-server/src/lib/strava.ts`
   - `artifacts/api-server/src/routes/injuries.ts`
   - `artifacts/api-server/src/routes/athlete.ts`
   - Possibly `artifacts/api-server/src/routes/dashboard.ts`

5. API contract
   - Update `lib/api-spec/openapi.yaml`
   - Regenerate client code with `pnpm --filter ./lib/api-spec codegen`

6. Frontend changes
   - `artifacts/stride-iq/src/pages/dashboard.tsx`
   - `artifacts/stride-iq/src/pages/alerts.tsx`
   - `artifacts/stride-iq/src/pages/activities.tsx`
   - `artifacts/stride-iq/src/pages/history.tsx`
   - `artifacts/stride-iq/src/pages/profile.tsx`

7. Verification
   - Run backend/frontend typechecks
   - Validate manual activity, Strava sync, wellness save, and injury changes update risk and alerts

### Files to modify
- `lib/db/src/schema/athlete.ts`
- `artifacts/api-server/src/lib/injuryRisk.ts`
- `artifacts/api-server/src/lib/notifications.ts` (if needed)
- `artifacts/api-server/src/routes/activities.ts`
- `artifacts/api-server/src/lib/strava.ts`
- `artifacts/api-server/src/routes/injuries.ts`
- `artifacts/api-server/src/routes/athlete.ts`
- `artifacts/api-server/src/routes/dashboard.ts`
- `artifacts/api-server/src/routes/alerts.ts`
- `artifacts/stride-iq/src/pages/dashboard.tsx`
- `artifacts/stride-iq/src/pages/alerts.tsx`
- `artifacts/stride-iq/src/pages/activities.tsx`
- `artifacts/stride-iq/src/pages/history.tsx`
- `lib/api-spec/openapi.yaml`

### Decision
- Keep existing alert list as supplementary warnings
- Add score/level storage for fast UI access
- Use notifications for high-risk or threshold-change events

### Further considerations
1. If you want a cleaner separation later, the risk score can be exposed on a dedicated endpoint instead of only via dashboard summary.
2. If sensor/wellness history is needed later, a separate risk history table is the right next step.
