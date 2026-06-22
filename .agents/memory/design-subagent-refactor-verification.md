---
name: Verifying DESIGN subagent emoji→icon refactors
description: Post-checks to run after a DESIGN subagent does a broad styling/icon refactor of an existing app
---

# Verifying a DESIGN subagent's emoji→lucide-icon refresh

When you delegate a "make it less AI / clean up UI" refresh of an existing app to a DESIGN
subagent, it tends to leave two specific, app-breaking gaps that its own "it still works"
report misses. Always check these before accepting the work:

1. **Module-scope undefined icon imports.** The subagent moves emoji strings in top-level
   data arrays (e.g. `const DATA_SOURCES = [{ Icon: Activity, ... }]`) to lucide components
   but forgets to add the `import { Activity } from "lucide-react"`. Because the array is
   evaluated at module load, this throws a ReferenceError that crashes the page on load
   (Vite error overlay), not just on render.

2. **Data-array key casing vs. renderer mismatch.** It renames the array key (`icon` →
   `Icon`) but leaves the JSX renderer reading the old key (`{src.icon}` instead of
   `<src.Icon />`). No crash — the icon area just renders empty, so it slips past a quick
   glance.

**Why:** the subagent verifies compile/typecheck, but `tsc` here halts on a pre-existing
TS6306 project-reference error and does NOT fully type-check sources, so missing imports and
casing mismatches are not caught by typecheck.

**How to apply:** after the subagent finishes,
- grep for emoji across `src/**/*.tsx` to confirm none remain,
- for each changed file, confirm every lucide icon referenced in module-scope data arrays
  is imported,
- grep for lowercase `.icon` member access and confirm it matches the array's key casing,
- reload the app and confirm the Vite error overlay is gone (clean browser console),
- run the architect review with `includeGitDiff: true` — it ran a full `vite build` which
  surfaced the renderer/key mismatch that typecheck missed.

Note: storing a JSX element directly in a lowercase `icon` field (e.g.
`{ icon: <Activity className="w-5 h-5" /> }`) and rendering `{f.icon}` is valid and fine —
only the array-key-vs-renderer casing *mismatch* is a bug.
