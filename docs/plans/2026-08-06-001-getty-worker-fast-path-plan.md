---
artifact_contract: ce-unified-plan/v1
artifact_readiness: requirements-only
product_contract_source: ce-brainstorm
---

# Getty Worker Fast Path - Plan

## Goal Capsule

**Objective:** Replace getty-worker's per-request Playwright browser automation with direct
reverse-engineered HTTP calls (Fast Path), keeping Playwright only for login/session capture and
as a per-call Fallback Path when the Fast Path fails. Root cause of 3+ prior breakages: every
search/download request paid the full cost and fragility of full-page browser automation, not
just login.

**Product authority:** session-settled via `/ce-brainstorm` dialogue + `/grill-with-docs`
(2026-08-06). See ADR: `getty-worker/docs/adr/0001-hybrid-fast-fallback-architecture.md` and
glossary: `getty-worker/CONTEXT.md`.

**Open blockers:** none — live capture completed against the real account
(NickRizzuto@iheartmedia.com, cust 9871544, no 2FA) via browser-harness on 2026-08-06.

## Product Contract

### Current state (verified live, 2026-08-06)

- getty-worker already runs on **Beast** (10.0.0.13), container `newsroom-getty-worker`,
  compose at `/var/docker/getty-worker`, port `3012->3001`. No move needed — memory claiming
  "not confirmed" was stale.
- `/health` returns ok with `x-api-key: newsroom-getty-2026`.
- `/search` currently fails: `{"error":"Getty bot-wall encountered — session cookies may have
  expired..."}` — confirms the cookie-expiry root cause.
- Source: `~/projects/newsroom/getty-worker/src/getty.ts` (Playwright-based).
- Consumer: `~/projects/newsroom/src/lib/getty-client.ts` calls `/auto-image` `/search`
  `/download` `/health` over `GETTY_WORKER_URL` (`http://getty-worker:3001` in prod), header
  `x-api-key`.

### Key Decisions (session-settled)

- **Hybrid split** (session-settled: user-directed — chosen over full-API-reverse-engineer or
  patch-cookie-flow-again: login stays Playwright since it's the actual bot-wall-gated step;
  search/detail/download become direct HTTP).
- **Silent fallback** (session-settled: user-directed — Shape Mismatch or bot-wall on the Fast
  Path falls back to the Fallback Path with no paging/alert; still logs status+body internally
  per the project's error-evidence rule).
- **Scope capped** (session-settled: user-directed — exactly the 3 existing capabilities: search,
  asset detail, download. No new Getty capability added.)
- **ToS/fingerprint risk accepted** (session-settled: user-directed — mitigate via replaying real
  captured headers/cookies/UA and human-pace rate limiting; any 403/429/challenge trips Fallback
  Path rather than retrying raw).
- **Capture-before-build ordering** (session-settled: user-directed — Fast Path implementation
  must be built from the verified endpoint map below, not inferred from Playwright selectors).

### Verified Fast Path API map (captured live via browser-harness, 2026-08-06)

**Search** — no separate JSON API call needed. The search results page itself is server-rendered
with results embedded inline:

```
GET https://www.gettyimages.com/search/2/image?family=editorial&groupbyevent=false&agreements=pa:243539,ed:736&phrase={phrase}&sort=best
```
Auth: session cookie only (`cookie:` header, captured from login). Response is HTML; the payload
is inside:
```html
<script type="application/json" data-component='Search'>
  {"search":{"gallery":{"assets":[...],"page":1,"pageSize":60,"lastPage":1000,"totalNumberOfResults":...}}}
</script>
```
Each asset object includes `id`/`assetId`, `altText`, `thumbUrl` (612x612 signed preview),
`agreementDetails[].Permissions` (e.g. `["Search","Download"]`), `editorialOnly`, `family`.
Parse via a JSON-in-HTML extraction (find `data-component='Search'`, take the following
`<script>...</script>` body), not a DOM scrape.

**Asset detail:**
```
GET https://www.gettyimages.com/detail/news-photo/{any-slug}/{assetId}
```
The trailing numeric `assetId` is authoritative; the slug appears cosmetic (a garbage slug with
the correct ID resolved 200 in testing — verify this holds broadly before relying on it, since
only one non-canonical slug was tested). Embedded JSON at `data-component='AssetDetail'` script
tag: `asset.actualMaxDimensions`, `artist`, `caption`, `allowedUseText`, `agreementDetails`.

**Download (3-step flow):**
```
1. GET  /components/asset-acquisition/api/downloads/download-agreements/{assetId}
   -> {"assetId","agreements":[{"agreementDetails":{"hasUnlimitedDownload":true,...},
       "authorizedSizes":[{"teeShirtSize":"Small|Medium|Large","downloadToken":"<base64>",
       "widthPx","heightPx","dpi","bytes","contentType"}]}]}
   downloadToken decodes to {"iid":assetId,"sz":"master|comp_1024|594_screen","cid":customerId,
   "sid":100,"pid":agreementId,"pit":"EditorialSubscription","tlid":0}

2. POST /components/asset-acquisition/api/downloads/create-download
   body: {"data":{"tokens":["<downloadToken for chosen size>"],"notes":"","projectCode":null,
          "assetId":"{assetId}","customerId":9871544}}

3. GET https://delivery.gettyimages.com/downloads/{assetId}?e=...&i=...&k=...&c=...
   -> signed, time-limited binary. (URL params observed in step-3 request; whether create-download's
      response body directly returns this URL or the browser follows a redirect was not captured
      — verify this one hop during implementation, e.g. by re-running the capture with the
      create-download response body retained.)
```
Account confirmed **`hasUnlimitedDownload:true`** under the Editorial Subscription agreement (id
736) — no per-download quota risk for this account.

**Headers needed on every Fast Path call** (captured from a real session): `cookie` (full session
cookie jar — `csrf`, `uac`, `unisess`, `sp`, `giu`, etc.), `user-agent` (real Chrome UA string),
`referer` (matching the page the action would occur on), `gi-source-mfe: search` (present on the
search XHR — verify whether required on detail/download too), standard `sec-ch-ua*` /
`sec-fetch-*` client-hint headers. These must be captured from a live Playwright-driven login,
not hand-typed.

### Requirements

- **Fast Path client** (new module in getty-worker, e.g. `src/fast-path.ts`): implements search,
  asset-detail, and the 3-step download flow above using plain HTTP (`fetch`/`undici`), replaying
  session cookies/headers obtained from the Playwright login step.
- **Session capture stays on Playwright**: existing login flow in `src/getty.ts` continues to run
  headless (no 2FA on the account — confirmed), producing the cookie jar the Fast Path client
  consumes. Re-run on expiry detection, same as today's cookie-refresh logic
  (`newsroom-getty-worker-cookie-expiry.md`).
- **Fallback Path**: on Fast Path failure — non-2xx, bot-wall-shaped error body, or a Shape
  Mismatch (response 200 but `data-component='Search'`/`AssetDetail` JSON block missing or
  unparseable) — retry the same logical operation through the existing Playwright automation.
  Log status + response body on every fallback trigger (error-evidence rule); do not page/alert.
- **`/search` `/auto-image` `/download` `/health` endpoints unchanged** from the CMS's
  perspective — `getty-client.ts` and its callers require no changes. All rework is internal to
  the worker.
- **Rate limiting**: Fast Path calls paced to roughly human click-cadence; no burst automation.
- **No new capabilities**: do not add bulk download, richer metadata, or anything beyond what the
  3 existing endpoints already expose.

### Out of scope

- Any change to the newsroom CMS's `getty-client.ts` contract.
- 2FA handling (account doesn't have it; revisit if that ever changes).
- Paging/alerting on Fast Path degradation (explicitly rejected — silent fallback only).

### Verification before shipping

- Confirm the create-download -> delivery.gettyimages.com hop (response body vs. redirect) with
  one more live capture during implementation.
- Confirm slug-independence of the detail URL isn't load-bearing (fall back to the exact
  Getty-provided slug if unverified assumption proves wrong).
- Deploy target: same Beast container (`newsroom-getty-worker`, `/var/docker/getty-worker`) —
  this is a code change to the existing service, not a new deployment.
