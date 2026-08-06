# Newsroom full code review — reviewer brief (2026-08-06)

Repo: `~/projects/newsroom` (M3 Media Newsroom CMS)
Stack: Next.js 14.2 App Router, TypeScript, Prisma 5 + PostgreSQL, NextAuth v4, TipTap, Tailwind.
~538 TS/TSX files under `src/`. Sidecar service in `getty-worker/`.

You are ONE of two independent reviewers (the other is a different model lineage). Work
independently. Do NOT edit any files in this pass — this is a findings-only pass.

## Goal

Blair's stated goal: **zero MAJOR / HIGH / MEDIUM blockers remaining.** Beyond bugs, find
changes that (a) improve efficiency, (b) minimize footprint, (c) make the service more
effective for its users (newsroom editors publishing to WordPress properties).

## Scope — cover ALL of these, do not stop early

1. **Security & auth** — NextAuth config, `src/middleware.ts`, per-route authorization on
   every `src/app/api/**/route.ts` and every server action. Look for: routes that read
   `getServerSession` but never check role; IDOR (object fetched by id with no ownership
   check); secrets or tokens in client bundles (`NEXT_PUBLIC_*`); unsanitized HTML reaching
   `dangerouslySetInnerHTML`; SSRF in any fetch-by-user-URL path; upload handlers without
   type/size limits.
2. **Data layer** — Prisma: N+1 loops, missing `select`/`take` (unbounded `findMany`),
   missing indexes for hot `where` clauses, multi-write sequences that need `$transaction`,
   connection handling in serverless/route context.
3. **API routes & server actions** — input validation, error handling. FLAG ANY handler that
   collapses a failure into `null`/`false`/a generic string without first logging the HTTP
   status + response body. Swallowed errors are a named project constraint.
4. **Client/React** — unnecessary `'use client'`, client components that could be server
   components, heavy imports pulled into the client bundle, missing `next/image`, unstable
   deps causing render loops, unbounded lists without virtualization or pagination.
5. **Efficiency & footprint** — unused dependencies in `package.json`, dead code/routes with
   no importer, duplicated implementations that have drifted, oversized payloads (API routes
   returning whole rows where a projection would do), caching opportunities (`revalidate`,
   `cache`), image/asset handling.
6. **Correctness** — real bugs with a concrete failure path.

## Severity definitions (use exactly these)

- `CRITICAL` — data loss, auth bypass, secret exposure, or production outage path.
- `HIGH` — wrong behavior users will hit, or a security weakness needing a precondition.
- `MEDIUM` — real defect, degraded performance/footprint, or a maintenance hazard that will bite.
- `LOW` — style, minor cleanup, nice-to-have.

## Evidence bar (hard requirement)

Every finding MUST name `file:line` and quote the actual offending code. Every finding MUST
state a concrete failure scenario: specific input/state -> specific wrong outcome. A finding
you cannot ground in quoted source is not a finding — drop it. Do not speculate about files
you did not open. No invented APIs, no invented line numbers.

## Output format

Write your findings to the output path given in your launch instruction, as a JSON array.
Nothing else in the file — no prose preamble, no markdown fences.

```json
[
  {
    "id": "SEC-01",
    "severity": "HIGH",
    "category": "security|data|api|client|footprint|correctness",
    "file": "src/app/api/posts/[id]/route.ts",
    "line": 42,
    "title": "one line, the claim alone",
    "evidence": "verbatim quoted code from that file",
    "failure_scenario": "specific input/state -> specific wrong outcome",
    "fix": "concrete change, name the file and what to write"
  }
]
```

Aim for completeness over brevity. If you find 60 real findings, report 60.
