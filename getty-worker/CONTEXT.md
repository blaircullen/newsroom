# Getty Worker

Internal newsroom service that fetches licensed Getty editorial images for CMS articles. Reachable only inside the newsroom Docker network, no published Getty API — everything is derived from what Getty's own web frontend does.

## Language

**Fast Path**:
The reverse-engineered direct-HTTP call to one of Getty's internal REST endpoints (search, asset detail, download), replaying captured session cookies/headers. Used by default for every request.
_Avoid_: direct API, raw HTTP path

**Fallback Path**:
The original Playwright browser-automation flow, driving Getty's customer portal UI. Used only when the Fast Path fails (bot-wall, 403/429, or a response-shape mismatch). Kept alive as the safety net so the worker never goes fully dark on a single Getty-side detection change.
_Avoid_: legacy path, old flow, Playwright mode

**Capture**:
A one-time (or periodically repeated) live browser-harness session against gettyimages.com, logged in as the real editorial account, used to observe the actual network calls Getty's frontend makes and derive the Fast Path's endpoint shapes, headers, and auth flow. Not a runtime concept — it's how the Fast Path gets built/updated, never called during normal request handling.
_Avoid_: recording, sniffing, scrape session

**Shape Mismatch**:
A Fast Path response that returns 200 but doesn't match the expected schema (renamed/missing field, changed structure) — distinct from a bot-wall block. Treated as a signal the Fast Path map is stale, but resolved the same way at runtime: fall back to the Fallback Path silently, no paging.
_Avoid_: schema drift, API change (too vague — this term is specifically about the runtime detection, not the underlying cause)
