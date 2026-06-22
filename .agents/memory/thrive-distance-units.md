---
name: Thrive distance units
description: The distance_km / distanceKm / weeklyDistanceKm fields actually store MILES, not km — despite the name.
---

# Distance units in Thrive are MILES, despite "km" field names

The DB column `activities.distance_km`, `plan_sessions.distance_km`, plan
`weekly_mileage`, athlete profile `weekly_mileage_goal`, and the derived
`weeklyDistanceKm` API field **all store MILES**, not kilometers. The "km"
naming is a misnomer.

**Why:** Every write path produces miles — Strava sync divides meters by
1609.344 (→ miles, not /1000 km), the GPX parser stores `distanceMi` into the
`distanceKm` field, and the manual activity form / plan forms store the raw
number entered under a "Distance (mi)" / "(mi)" label. Every display surface
(activities, athlete dashboard, plan-detail, plans, coach-plans) renders the raw
value with a "mi" label. So the consistent app-wide convention is
**miles stored, miles displayed — no conversion**.

**How to apply:**
- Do NOT multiply any distance field by 0.621371. That was a recurring
  double-conversion bug (previously in `coach-dashboard.tsx`,
  `AthleteProfileModal.tsx`, and the coach context builder in `openai.ts`).
- When seeding demo data, insert MILES values directly (e.g. a 17-mile long run
  is `17.0`, not `27.36`).
- Pace is `durationMinutes / distanceKm` = min/mile (already correct).
- The column rename (distance_km → distance_mi) is deferred tech debt; treating
  it as km anywhere reintroduces the bug.
