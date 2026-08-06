---
title: Newsroom Lite — security and correctness carryover from the 2026-08-06 review
type: addendum
date: 2026-08-06
applies_to: docs/plans/2026-08-06-001-feat-newsroom-lite-cloudflare-plan.md
status: requirements — not yet accepted into the plan's units
---

# Carryover requirements for Newsroom Lite

Newsroom was reviewed on 2026-08-06 by two independent model lineages (GPT-5.6 and
Kimi K3 on security; GPT-5.6 and DeepSeek-v4-pro on data and footprint). Full
findings: `docs/review-2026-08-06/MERGED.md`. Fixes landed on branch
`review/security-fixes-20260806` (`1cfe644`, `73720e1`).

Those fixes protect a decommissioned system. **This document exists so the greenfield
rebuild starts with the lessons instead of rediscovering them.** Each item below is
the *requirement*, not the old code — the old implementations assume Node, and
Newsroom Lite targets Cloudflare Workers, which is a different runtime. Where that
difference bites, it is called out.

## C1. Sanitize stored HTML at every write path, not one of them

**What happened.** `src/lib/html-sanitize.ts` was written specifically because
"writers (or AI output via prompt injection) can post bodyHtml directly via the API"
— its own header comment says so. It was then wired into the import route only.
`POST /api/articles` and `PUT /api/articles/[id]` stored `bodyHtml` raw, and
`publish.ts` pushed it verbatim to WordPress. Content fetched from a stranger's URL
was sanitized; content submitted by a user was not.

**Requirement.** Sanitization belongs at the single point where draft content enters
storage, not at each caller. In the Lite plan that is the `stories` write path (U5).
If there is more than one way to write `stories.body_html`, they must share one
sanitizing function, and a new entry point must be unable to skip it.

⚠ **Runtime check needed before adopting the old implementation.** The old code uses
the `sanitize-html` npm package, which is written for Node. Whether it runs on
workerd is unverified — confirm before depending on it. Cloudflare's native
`HTMLRewriter` is the runtime-blessed alternative and is a plausible substitute for
an allowlist pass. Do not assume either works; test one and pick it in U5.

**Reusable as-is:** the allowlist itself (tags, attributes, schemes, iframe
hostnames) at `src/lib/html-sanitize.ts:9-58`, which is tuned to TipTap output plus
your embed hosts, and the 10-payload test suite the fix was verified against.

## C2. SSRF: the guard must survive DNS and redirects — but the Node version will not run on Workers

**What happened.** `isPrivateUrl` was a regex test against the hostname *string*. It
could not see a public hostname resolving to a private address (`localtest.me` →
127.0.0.1 passed it), and it never looked at redirects, so a public URL that 302'd to
loopback sailed through. One route had no guard at all.

**Requirement for any endpoint that fetches a user-supplied URL:**
1. Scheme allowlist — `http:`/`https:` only. `file:` and `gopher:` must be rejected.
2. Redirects followed manually with the destination revalidated at every hop, capped.
3. Destination validated against the actual address, not the hostname string.

⚠ **The old implementation needs one specific change to run on Workers, verified
against Cloudflare's docs 2026-08-06.** `src/lib/url-validation.ts` (as of `1cfe644`)
imports `node:dns` and `node:net`. With the `nodejs_compat` flag (compatibility date
2024-09-23 or later) both modules exist on workerd — `node:net` is listed as fully
supported and `node:dns` as partially supported. But the one function the guard
depends on is in the unsupported set: Cloudflare's `node:dns` page states that all
functions are available "except `lookup`, `lookupService`, and `resolve` which throw
'Not implemented' errors when called." `assertPublicUrl` calls
`dns.promises.lookup`, so it would throw at runtime.

Two ways forward, in order of preference:

1. **Destination allowlist instead of a private-range denylist.** The two WordPress
   hosts are the only outbound targets this plan needs. An allowlist is strictly
   stronger than what we built and sidesteps DNS entirely. Prefer this.
2. If a denylist is ever genuinely needed, swap `lookup` for `dns.promises.resolve4` /
   `resolve6`, which are *not* in the unsupported set — then keep the rest of the
   implementation, including the IPv4/IPv6 classification helpers, unchanged. Note
   that DNS requests consume Worker subrequests.

Requirements 1 and 2 above are pure JavaScript and port unchanged either way.

**Reusable as-is:** requirements 1-2, and the 17-case test suite
(`~/.../scratchpad/newsroom-ssrf-tests/`) as a specification of what must be refused —
including the IPv4-mapped IPv6 case that caught a bug in my own first implementation.

## C3. Identity must be re-checked, not cached for the session's lifetime

**What happened.** The NextAuth JWT callback wrote `role` at login and never again.
A deactivated or demoted account kept its access for the full 14-day token life.

**Requirement.** KTD1 already verifies the `Cf-Access-Jwt-Assertion` signature and
`aud` per request, which is the right shape and structurally avoids this bug. Keep it
that way: **do not** add an identity cache with a long TTL as an optimization later.
If a writer is removed from the Access policy, the next request must fail.

## C4. A failure must never collapse into a plausible-looking value

**What happened, three ways.**
- `getty/download` sent the wrong secret to the analyze endpoint. Every call 401'd.
  `.catch(() => {})` meant nobody knew, possibly for months.
- Umami failures returned `[]`, rendering as "no traffic" rather than "unknown."
- Home Assistant failures returned `null`, rendering as **$0 revenue**.

**Requirement.** Any handler that swallows a failure must first log the HTTP status
and a bounded slice of the response body. A `catch` that returns `null`/`false`/`[]`
without that is not acceptable. Where a value is displayed to a human, an outage must
render distinguishably from a real zero.

This applies directly to U3's scanner ingest, U6's WordPress publish, and KTD5's
heartbeat — a dead-man's-switch that cannot tell "no runs" from "no data" is
decoration.

## C5. Bounded queries must report what they left behind

**What happened.** Two analytics routes did `findMany` across the entire published
archive on every request. Cost grew with the archive until timeout.

**Requirement.** Every list query gets an explicit bound. More important: **a bounded
run must return how much work remains**, or a partial result is indistinguishable
from a complete one. The fix in `73720e1` returns `remaining` and `batchLimit`.

D1 has hard per-query row and time limits, so this is stricter here than it was on
Postgres — an unbounded query does not merely get slow, it fails.

## C6. Paired writes must be atomic

**What happened.** A review decision inserted a `reviews` row and then updated the
article status as two separate writes; a failure between them recorded a decision
against an article that never moved. Tag replacement committed in its own transaction
before the article update that could still fail.

**Requirement.** The Lite equivalents — claiming a pick (`picks.status` +
`stories` row) and publishing (`stories.status` + `wp_post_id`) — must each be one
atomic unit. D1 offers `batch()`; use it. U4's claim flow and U6's `publishing`
transient status are the two places this matters.

Related, and already anticipated by U6: the old `publish.ts` guarded duplicate
publishes with a read-then-write on a delimited string column, which two concurrent
requests both pass. Both reviewers flagged it. U6's transient `publishing` status is
the right instinct — make sure the transition into it is a conditional update
(`WHERE status = 'drafted'`) whose affected-row count is checked, not a read followed
by a write.

## C7. Deploy from what is committed, and check that it is

**What happened, twice.** (a) Six files referencing dropped Prisma models sat in the
working tree breaking every local build — they were never committed, so production
never saw them, and nobody noticed for a month. (b) An earlier incident: an import
was added referencing an untracked file; the push succeeded and the Docker build
failed on the server.

**Requirement.** Before any deploy, verify that every import resolves to a committed
file. Cloudflare Pages/Workers builds from the repository, so this failure mode
carries over unchanged.

## What is NOT worth carrying

- The dead-code and dependency removals (`4b5152d`) — greenfield has none of it.
- The `(dashboard)/page.tsx` route conflict and `next.config.js` key — Next-specific,
  and Lite is Hono, not Next.
- The Prisma index and unique-constraint findings — D1 schema is being written fresh
  in U2; add `UNIQUE` where the old schema lacked it rather than porting a migration.

## Open question for U2

The old `ArticleVersion` table had no `@@unique([articleId, version])`, and version
numbers were assigned by read-then-increment. Whether prod actually accumulated
duplicates can no longer be checked — the database was destroyed with the
decommission. If Lite grows any versioning, put the unique constraint in from the
start.
