---
status: accepted
---

# Hybrid Fast Path / Fallback Path architecture for Getty image fetch

Getty's editorial image search has no public API; the worker has always driven Getty's customer portal via Playwright. That approach has broken on cookie expiry three-plus times (per project memory) because every request pays the full cost and fragility of browser automation, not just login.

We decided to split the worker in two: a **Fast Path** that replays Getty's actual internal REST calls directly over HTTP (captured live from the real frontend, not guessed), used for every request by default; and a **Fallback Path** that keeps the existing Playwright flow alive, triggered only when the Fast Path hits a bot-wall, an HTTP error, or a Shape Mismatch. Login/session capture stays on Playwright since the account has no 2FA and can be automated headless — it's the one step actually gated behind Getty's bot-wall, so we don't try to bypass it too.

We considered going fully API-only (replaying the raw login request too) but rejected it: login is exactly the part most likely to trip Getty's bot-detection, and losing the ability to fall back to a working browser session would mean one Getty-side change takes the worker fully offline instead of just degrading its request latency.

## Consequences

- The Fast Path is a live map of Getty's frontend, not a contract Getty owns — it can silently go stale. We accept this: a Shape Mismatch falls back to the Fallback Path automatically, with no alert. If Fast Path use degrades to near-zero over time, that's the signal a re-capture is due, not something the worker itself detects or reports.
- Direct-HTTP calls are arguably easier for Getty to fingerprint as automated than full Playwright traffic (no real browser JS execution). Mitigated by replaying real captured headers/cookies/UA and rate-limiting to human click-pace; any 403/429/challenge trips the Fallback Path rather than retrying. This risk is accepted as no worse than the status quo, which already automates the same account via Playwright.
- Scope is capped to the three capabilities the CMS already needs (search, asset detail, download) — no new Getty capability was added while fixing reliability.
