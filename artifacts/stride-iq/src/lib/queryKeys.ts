// React Query keys shared across multiple pages. Team status (GET
// /api/teams/my) is read by both team.tsx and plans.tsx — they must use the
// exact same key, or a mutation in one (join/leave/create/delete team) won't
// invalidate the other's cached copy, leaving it showing stale "do I have a
// coach" state until it naturally expires.
export const TEAMS_MY_QUERY_KEY = ["teams-my"];
