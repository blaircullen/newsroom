# Newsroom code review — merged findings (2026-08-06)

Reviewers, two lineages per slice:

| slice | reviewer 1 | reviewer 2 |
|---|---|---|
| A — security / auth / API | GPT-5.6 (`gpt-5.6-sol`, codex MCP) | Kimi K3 (`k3[1m]`, subscription harness) |
| B — data / correctness | GPT-5.6 | DeepSeek-v4-pro (LiteLLM) |
| C — client / perf / footprint | GPT-5.6 | DeepSeek-v4-pro |

Kimi K3 ran out of subscription quota after slice A; DeepSeek covered B and C in its place.

Status key: **CONFIRMED** = both reviewers flagged it independently · **SINGLE** = one reviewer
only · **DISPUTED** = reviewers disagree · **VERIFIED** = I checked the source myself ·
**FIXED** = already repaired this session.

---

> **Correction (2026-08-06, after the first merge was written).** The Tier 3 and Tier 6
> sections below were built from a partial read of `ds-C.json`: DeepSeek was still writing when
> I summarised it at 15 findings, and it finished with **28**. The 13 findings it added are
> almost all dead code, they are listed in "Verified dead code" below, and I checked every one
> of them myself. Nothing already recorded changed — the merge was incomplete, not wrong.

## Already fixed this session

| # | file | what | status |
|---|---|---|---|
| F1 | 6 spotlight files (deleted) | Code referenced Prisma models the `0003_lean_strip` migration dropped. All 7 drifted files were untracked and absent from `origin/main`, so prod was never affected. | CONFIRMED · VERIFIED · FIXED |
| F2 | `src/lib/cron-lock.ts:59` | `release()` called `prisma.cronLock` with no such delegate; rewritten as `$executeRaw` to match `tryAcquire()`. | CONFIRMED · VERIFIED · FIXED |
| F3 | `src/app/(dashboard)/page.tsx` (deleted) | 857-line page resolving to `/` alongside `src/app/page.tsx`; unreachable, and broke the `output: 'standalone'` copy step. | CONFIRMED · VERIFIED · FIXED |
| F4 | `next.config.js` | `serverExternalPackages` was an unrecognized key naming a package that is not a dependency, not installed, and not imported. Entry removed. | SINGLE (DeepSeek) · VERIFIED · FIXED |

| F5 | `src/app/api/articles/route.ts:217`, `[id]/route.ts:131` | `bodyHtml` stored raw and published verbatim; now runs through the existing `sanitizeArticleHtml`. Verified against a 10-payload suite: script tags, `onerror`, `javascript:` hrefs, `data:text/html`, off-allowlist iframes and inline styles all stripped, while TipTap output and YouTube embeds pass through unchanged. | SINGLE (Kimi) · VERIFIED · FIXED |
| F6 | `src/app/api/getty/download/route.ts:75` | Sent `NEXTAUTH_SECRET` to an endpoint checking `INTERNAL_API_SECRET`; every analysis 401'd silently. Right secret + real status/body logging. | CONFIRMED · VERIFIED · FIXED |
| F7 | `src/lib/auth.ts` | JWT callback now re-reads the user on a 60s throttle and enforces `isActive` continuously. Revocation works by throwing, which `next-auth/core/routes/session.js:84-90` turns into cleared cookies. | CONFIRMED · FIXED (not exercised live) |
| F8 | `drive-images/upload/route.ts:9`, `[id]/raw/route.ts:28` | SVG rejected on upload; raw proxy serves an inert raster allowlist instead of `startsWith('image/')`. | CONFIRMED · VERIFIED · FIXED |
| F9 | `src/lib/url-validation.ts` + import/exemplars routes | Added `assertPublicUrl` (resolves DNS, every address must be public) and `safeFetch` (revalidates each redirect hop). Verified against 17 cases: loopback, metadata IPs, RFC1918, CGNAT, IPv4-mapped IPv6 in both spellings, non-HTTP schemes, and `localtest.me` (public name → 127.0.0.1) all blocked; real news URLs allowed; redirect-to-loopback refused in a local offline test. | CONFIRMED · VERIFIED · FIXED |

Gates: `tsc --noEmit` 14 errors → **0**. `next build` failing → **exit 0**, zero warnings.
Committed as `1cfe644` on branch `review/security-fixes-20260806` — **not pushed, not on main**.

⚠ None of the above has been exercised against a live database or a running instance. The
session-revocation path and the Getty secret are inference from source plus green gates, not
observed behavior. Smoke-test on staging before this reaches `main`.

## Verified dead code (all zero importers — I checked each)

From DeepSeek's completed slice C, independently confirmed with a repo-wide importer grep.
This is the bulk of the "minimize footprint" answer.

| file | size | note |
|---|---|---|
| `src/components/ui/Button.tsx` | 58 lines | **Also flagged by GPT-5.6.** The project's own `CLAUDE.md` lists Button as a key component — the doc is stale, not the finding. |
| `src/hooks/useAutosave.ts` | 130 lines | entire hook unused |
| `src/components/dashboard/TrendingTopics.tsx` | — | unused |
| `src/components/dashboard/StatsGrid.tsx` | — | unused |
| `src/components/dashboard/GlobalSearch.tsx` | — | unused |
| `src/components/editor/DraftRecoveryModal.tsx` | — | unused |
| `src/components/dashboard/ExemplarTab.tsx` | — | transitively dead; the training tab was never wired to a page |
| `src/hooks/use-mobile.ts` | — | unused |
| `src/components/ui/*` (9 shadcn components) | ~800 lines | unused, and they pull in otherwise-orphaned `@radix-ui` deps |

Plus dead exports: `SkeletonText`, `formatLastSaved`, `SparklineWithTrend`, `STATUS_CONFIG` /
`STATUS_DOT`, `FastPathError`. And `src/components/dashboard/ExemplarCard.tsx:48` defines a
local `StatusBadge` that shadows the shared one.

Unused dependencies, all verified: `@google-cloud/storage`, `date-fns`, `google-trends-api`
(its only mention in `src` is a comment saying the package is dead and RSS is used instead).
`react-icons` duplicates `lucide-react`.

---

## Tier 1 — security, confirmed by both reviewers

| # | sev | file:line | finding | status |
|---|---|---|---|---|
| 1 | HIGH | `src/lib/auth.ts:82` | JWT callback writes role only at login and never re-reads the user. A disabled or demoted account keeps its role until the token expires (14 days). | CONFIRMED · VERIFIED |
| 2 | HIGH | `src/app/api/getty/download/route.ts:73` | Sends `NEXTAUTH_SECRET`, but `api/media/[id]/analyze/route.ts:13` checks `INTERNAL_API_SECRET`. Every Getty analysis 401s and `.catch(() => {})` eats it. | CONFIRMED · VERIFIED |
| 3 | HIGH | `drive-images/upload/route.ts:11` + `drive-images/[id]/raw/route.ts:76` | Upload accepts `image/svg+xml`; the raw proxy serves it back as `image/svg+xml` from the app origin. Stored XSS. | CONFIRMED · VERIFIED |
| 4 | HIGH | `src/app/api/articles/route.ts:142` | `bodyHtml` stored raw on POST/PUT. `sanitizeArticleHtml` exists but is wired only into the import route. Stored XSS that flows out to published WordPress pages. | SINGLE (Kimi) — **highest-value single-source finding, verify first** |
| 5 | MEDIUM | `articles/import/route.ts:63`, `exemplars/route.ts:101`, `src/lib/url-validation.ts:30` | SSRF cluster: `isPrivateUrl` is a string check that never resolves DNS, redirects are unvalidated, and the exemplars route has no guard at all. | CONFIRMED |
| 6 | MEDIUM | `src/middleware.ts:121` | Rate-limit key is the client-controlled first hop of `x-forwarded-for`. | CONFIRMED |
| 7 | MEDIUM | `media/analyze-backfill/route.ts:11` | Authenticates against the JWT signing secret while its sibling route uses `INTERNAL_API_SECRET`. | CONFIRMED · VERIFIED |

## Tier 2 — data and correctness, confirmed by both

| # | sev | file:line | finding |
|---|---|---|---|
| 8 | HIGH | `src/lib/publish.ts:1167` / `:1201` | Duplicate-publish guard is read-then-write on `publishedSite`. Concurrent publishes create duplicate live posts. |
| 9 | HIGH | `analytics/refresh/route.ts:25` | Unbounded `findMany` over every published article in one request. |
| 10 | HIGH | `analytics/top-articles/route.ts:111` | Loads the entire published archive plus author relations to return a short ranking. |
| 11 | MEDIUM | `prisma/schema.prisma` (Media) | No index supporting the hot `aiStatus` filter in analyze-backfill. |
| 12 | MEDIUM | `articles/[id]/review/route.ts:63` | Review insert and article status transition are separate writes. |
| 13 | MEDIUM | `articles/[id]/versions/route.ts:85` | `lastVersion + 1` with no `@@unique([articleId, version])`. |
| 14 | MEDIUM | `articles/[id]/route.ts:179` | Tag replacement commits in its own transaction before an article update that can fail. |

## Tier 3 — client and footprint, confirmed by both

| # | sev | file:line | finding |
|---|---|---|---|
| 15 | MEDIUM | `package.json:23` | `@google-cloud/storage` — zero importers repo-wide. VERIFIED. |
| 16 | MEDIUM | `components/cuts/CandidatePicker.tsx:52` | Bare `<img>`, eslint-disabled because the Grabien CDN host was never added to `next.config`. |
| 17 | MEDIUM | `app/dashboard/page.tsx:555` | Full-size hero image rendered into a 128×80 box. |

## Tier 4 — single-source, GPT-5.6 only

Security: exemplars GET has only a session check so a WRITER reads the whole corpus plus
submitter emails (`exemplars/route.ts:225`) · password-reset tokens stored in plaintext
(`forgot-password/route.ts:45`) · reset-token consumption is check-then-act, so concurrent
reuse is possible (`reset-password/route.ts:40`) · `void sendPasswordResetEmail(...)` reports
success regardless of SMTP outcome (`forgot-password/route.ts:57`) · three analytics routes
convert upstream failures to empty/zero without logging status or body.

Data: analytics refresh is a lost-update read-modify-write (`analytics/refresh/route.ts:58`) ·
scheduled publishing re-runs the same `publishTarget.findFirst` per article
(`cron-jobs.ts:28`) · media create/delete order storage writes around the DB write so a failure
orphans objects or strands rows (`media.ts:136`, `:281`).

Client: auth providers and command palette hydrate on public login pages (`layout.tsx:33`) ·
both admin pages redirect while `useSession` is still `loading`, bouncing real admins
(`admin/users/page.tsx:45`, `admin/sites/page.tsx:44`) · users table and scanner history have
no pagination · `StatusBadge.tsx` is `'use client'` with no state or handlers ·
`components/ui/Button.tsx` reported dead — **conflicts with the project's own CLAUDE.md, which
lists Button as a key component; verify before acting** · `date-fns` unused (VERIFIED) ·
getty-worker temp files never cleaned, searches never cached, `limit` unbounded.

## Tier 5 — single-source, Kimi K3 only (slice A)

`/api/auth` rate limit also covers NextAuth's `session`/`csrf` GETs, so shared-IP users get
locked out (`middleware.ts:9`) · trending webhook `url` stored verbatim and rendered as an
`href`, allowing `javascript:` (`trending/route.ts:117`) · scanner ingest accepts any URL
scheme (`scanner/ingest/route.ts:11`) · `SCANNER_API_KEY` compared with `===` rather than the
repo's own `timingSafeCompare` (`:26`) · drive raw proxy will fetch any file the service
account can read, not just the images folder (`drive-images/[id]/raw/route.ts:19`) · sites list
leaks the first 8 chars of the Shopify `clientId` (`sites/route.ts:27`) · the timing-attack
dummy bcrypt hash is not a valid bcrypt string so the compare short-circuits (`auth.ts:46`) ·
middleware `protectedPaths` omits `/scanner` (`:136`) · swallowed errors in publish ACF SEO
(`publish.ts:960`), media usage counts (`articles/[id]/route.ts:141`), and R2 delete
(`media.ts:44`).

## Tier 6 — single-source, DeepSeek only (slices B and C)

Data: analytics cron has the same unbounded `findMany` (`analytics/cron/route.ts:35`) ·
`recap-generator.ts:81` silently returns 0 pageviews on Umami failure · missing
`ScanPick(scanRunId, priority)` composite index · missing `onDelete` cascade and index on
`CutPull.createdBy` and `ArticleExemplar.submittedBy`, so user deletion is blocked by FK ·
`cron-jobs.ts:17` strips `scheduledPublishAt` from non-APPROVED articles with no audit trail ·
`getWebsiteConfigs` defined identically in three files.

Footprint: `google-trends-api` unused — the only mention in `src` is a comment saying the
package is dead and RSS is used instead (VERIFIED) · dead exports `SkeletonText`,
`useIsMobile`, `formatLastSaved` · `export const dynamic` is a no-op in client components
across 5 pages · `react-icons` duplicates `lucide-react` · getty-worker installs
`puppeteer-extra-plugin-stealth` but runs Playwright · getty-worker startup logging confirms
which secrets are set.

## Disputed

| claim | resolution |
|---|---|
| GPT-5.6 SEC-04: `/api/media/upload` stores active SVG on the app origin (HIGH) | **Wrong.** `src/lib/media.ts:47` carries the comment "SVG intentionally excluded" and rejects it. Kimi's reading is correct: the route advertises SVG, `saveMedia` rejects it, so users get a 500 instead of a clean 400. Real but LOW. |
| GPT-5.6 DATA-01..04: schema drift "blocks deployment" (CRITICAL) | **Half right.** The code was genuinely broken and both gates failed locally, but all 7 files were untracked and absent from `origin/main`, so production never had them. Local-only. |
| Severity of the JWT stale-role issue | GPT-5.6 CRITICAL, Kimi MEDIUM. Settled at HIGH: real privilege persistence, but it needs an admin to have disabled someone and an attacker to hold a live token. |
