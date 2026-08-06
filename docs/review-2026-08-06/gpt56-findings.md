# GPT-5.6 (Sol) findings — newsroom, 2026-08-06

53 findings across 3 slices. Condensed from the raw JSON (evidence quotes dropped; every
item was grounded in quoted source at review time).

## Slice A — security, auth, API routes (20)

| id | sev | file:line | claim |
|---|---|---|---|
| SEC-01 | CRITICAL | src/lib/auth.ts:82 | JWT callback never re-reads the user, so a disabled/demoted account keeps its old role for the full 14-day maxAge |
| SEC-02 | HIGH | src/app/api/exemplars/route.ts:74 | Exemplar submission fetches any user-supplied URL server-side — SSRF to loopback/metadata |
| SEC-03 | HIGH | src/app/api/articles/import/route.ts:45 | `isPrivateUrl` is a string check only: no DNS resolution, no redirect validation |
| SEC-04 | HIGH | src/app/api/media/upload/route.ts:6 | `image/svg+xml` in ALLOWED_TYPES → stored active content on the app origin |
| SEC-05 | HIGH | src/app/api/drive-images/upload/route.ts:6 | Same SVG hole on the drive-images upload path |
| SEC-06 | MEDIUM | src/middleware.ts:121 | Rate-limit key is the client-controlled `x-forwarded-for` first hop — spoof it for a fresh bucket |
| SEC-07 | HIGH | src/app/api/getty/download/route.ts:71 | Analyze trigger sends `NEXTAUTH_SECRET` where the endpoint expects `INTERNAL_API_SECRET`; 401 is swallowed, images never analyzed |
| SEC-08 | MEDIUM | src/app/api/media/analyze-backfill/route.ts:10 | Backfill endpoint authenticates against the JWT signing secret |
| SEC-09 | MEDIUM | src/app/api/analytics/top-articles/route.ts:80 | Umami failure → `return []` with no status/body logged |
| SEC-10 | MEDIUM | src/app/api/articles/hot-today/route.ts:98 | Same swallowed-error shape on hot-today |
| SEC-11 | MEDIUM | src/app/api/analytics/revenue/route.ts:18 | Home Assistant failure → `null` → rendered as $0 revenue |
| SEC-12 | MEDIUM | src/app/api/getty/download/route.ts:68 | `fs.unlink(...).catch(() => {})` and fire-and-forget analyze fetch, both fully silent |
| SEC-13 | MEDIUM | src/app/api/articles/import/route.ts:25 | `request.json()` outside try/catch → framework 500 on malformed body |
| SEC-14 | MEDIUM | src/app/api/getty/download/route.ts:21 | Same unguarded parse + `.trim()` on an unvalidated field |
| SEC-15 | MEDIUM | src/app/api/articles/[id]/publish/route.ts:40 | `targetIds` shape untrusted — 500 or unbounded external publish loop |
| SEC-16 | MEDIUM | src/app/api/sites/route.ts:49 | Site creation accepts unvalidated `type`/`url`; `url.replace` on a non-string 500s |
| SEC-17 | MEDIUM | src/app/api/exemplars/route.ts:225 | GET has only a session check — a WRITER reads the whole corpus plus submitter emails |
| SEC-18 | MEDIUM | src/app/api/auth/forgot-password/route.ts:57 | `void sendPasswordResetEmail(...)` — rejection unhandled, success reported regardless |
| SEC-19 | MEDIUM | src/app/api/auth/forgot-password/route.ts:45 | Reset tokens stored in plaintext; a DB read is an account takeover |
| SEC-20 | MEDIUM | src/app/api/auth/reset-password/route.ts:40 | Check-then-act on `usedAt` — concurrent reuse of a single-use token |

## Slice B — data layer + correctness (16)

| id | sev | file:line | claim |
|---|---|---|---|
| DATA-01 | CRITICAL | src/lib/conservative-spotlight-runner.ts:7 | Imports `FactCheckStatus`, calls `prisma.storyIntelligence` / `prisma.conservativeSpotlightRun` — none exist after the lean-strip migration |
| DATA-02 | CRITICAL | src/app/api/spotlight/route.ts:5 | Same drift: `SpotlightFreshness`, `ConservativeSpotlightRunInclude`, `...GetPayload`, `conservativeSpotlightRun` |
| DATA-03 | CRITICAL | src/lib/conservative-spotlight-service.ts:471 | Queries `story_intelligence`, dropped by `prisma/migrations/0003_lean_strip/migration.sql` |
| DATA-04 | CRITICAL | src/lib/cron-lock.ts:62 | `prisma.cronLock.deleteMany` — no CronLock model; acquire uses raw SQL, release does not |
| DATA-05 | HIGH | src/lib/publish.ts:1167 | Duplicate-publish guard is a read-then-write on `publishedSite` — concurrent publishes create duplicate live posts |
| DATA-06 | HIGH | src/app/api/analytics/refresh/route.ts:58 | Lost-update read-modify-write on `totalPageviews`/`totalUniqueVisitors` |
| DATA-07 | MEDIUM | src/app/api/analytics/refresh/route.ts:25 | Unbounded `findMany` over every published article in one request |
| DATA-08 | MEDIUM | src/app/api/analytics/top-articles/route.ts:111 | Loads the entire published archive plus author relations to return a short ranking |
| DATA-09 | MEDIUM | src/app/api/articles/[id]/review/route.ts:63 | Review insert and status transition are two separate writes |
| DATA-10 | MEDIUM | src/app/api/articles/[id]/versions/route.ts:85 | `lastVersion + 1` with no `@@unique([articleId, version])` — duplicate version numbers |
| DATA-11 | MEDIUM | src/app/api/articles/[id]/route.ts:179 | Tag replacement commits in its own transaction before the article update that may fail |
| DATA-12 | MEDIUM | src/lib/cron-jobs.ts:28 | Unbounded due-article query + the same `publishTarget.findFirst` re-run per article |
| DATA-13 | MEDIUM | src/app/api/scanner/feedback-export/route.ts:26 | No pagination and no `@@index([status, processedAt])` for its own query |
| DATA-14 | MEDIUM | src/app/api/media/analyze-backfill/route.ts:17 | Hot `aiStatus` filter has no supporting index |
| DATA-15 | MEDIUM | src/lib/media.ts:281 | Deletes disk + R2 objects *before* the DB delete — DB failure leaves a row pointing at nothing |
| DATA-16 | MEDIUM | src/lib/media.ts:136 | Writes disk + R2 before `prisma.media.create` — insert failure orphans both objects |

## Slice C — client, perf, footprint (17)

| id | sev | file:line | claim |
|---|---|---|---|
| FOOTPRINT-01 | HIGH | src/app/(dashboard)/page.tsx:45 | Route group resolves to `/` alongside src/app/page.tsx — conflicting parallel pages, and a third drifted copy at src/app/dashboard/page.tsx |
| CLIENT-01 | MEDIUM | src/app/layout.tsx:33 | AuthProvider + CommandPalette + Toaster hydrate on public login/reset pages |
| CLIENT-02 | MEDIUM | src/components/editor/ImagePicker.tsx:434 | Raw `<img>` grid, no next/image |
| CLIENT-03 | MEDIUM | src/app/dashboard/page.tsx:555 | Full-size hero image rendered into a 128×80 box |
| CLIENT-04 | MEDIUM | src/components/cuts/CandidatePicker.tsx:52 | eslint-disabled `<img>` because the Grabien CDN host was never added to next.config |
| CLIENT-05 | MEDIUM | src/app/admin/users/page.tsx:45 | Redirects on `session?.user?.role !== 'ADMIN'` while status is still `loading` — bounces real admins |
| CLIENT-06 | MEDIUM | src/app/admin/sites/page.tsx:44 | Same premature redirect |
| CLIENT-07 | MEDIUM | src/app/admin/users/page.tsx:53 | Users table has no pagination, rendered twice for responsive layouts |
| CLIENT-08 | MEDIUM | src/app/scanner/page.tsx:431 | Scanner runs and picks loaded unbounded into state |
| CLIENT-09 | MEDIUM | src/components/ui/StatusBadge.tsx:1 | `'use client'` on a component with no state, effects, or handlers |
| FOOTPRINT-02 | MEDIUM | src/components/ui/Button.tsx:26 | Dead component — no importer anywhere |
| FOOTPRINT-03 | MEDIUM | package.json:23 | `@google-cloud/storage` unused |
| FOOTPRINT-04 | MEDIUM | package.json:48 | `date-fns` unused |
| FOOTPRINT-05 | MEDIUM | getty-worker/src/getty.ts:315 | Downloaded JPEGs accumulate in `/data/media/tmp` with no TTL cleanup |
| FOOTPRINT-06 | MEDIUM | getty-worker/src/getty.ts:190 | Identical searches never cached or coalesced |
| FOOTPRINT-07 | MEDIUM | getty-worker/src/server.ts:40 | `limit` accepted unbounded from the caller |
