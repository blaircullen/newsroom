# Newsroom — Upgrade Tracking

## Next.js 14.2.15 → later (Server Action `.workers` crash)

- **Logged:** 2026-07-11, from error-sweep nightly triage (`error-sweep/reports/newsroom-2026-07-11.md`)
- **Symptom:** `Error: Failed to find Server Action "x"... Cannot read properties of undefined (reading 'workers')` — 9 hits/24h, `app-page.runtime.prod.js`
- **Cause:** Next.js internal bug (`node_modules/next/dist/server/app-render/action-utils.js:30`), not app code — repo has zero Server Actions (`"use server"` grep = 0, empty `server-reference-manifest.json`). Stale-deployment action-ID lookup miss dereferences `.workers` on an undefined map.
- **Upstream refs:** vercel/next.js #70229, #78540, #75541, #69756, #69882
- **Fix:** requires a Next.js version bump past whatever patches these upstream issues — check issue threads for the fixed version before upgrading.
- **Status:** not code-fixable in-repo. Revisit when planning next Next.js upgrade.
