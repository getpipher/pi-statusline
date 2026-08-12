# z.ai GLM Coding Plan — Quota & Credit Research

**Date:** 2026-08-12
**Purpose:** Establish what quota/usage data z.ai exposes, to drive the `pi-statusline` z.ai billing segment.
**Status:** Research complete. Conclusion: **no public quota API**; track credits locally via the published formula.

---

## Sources (official)

- [docs.z.ai/devpack/overview](https://docs.z.ai/devpack/overview) — plan tiers, credit allowance, multipliers, off-peak
- [docs.z.ai/devpack/usage-policy](https://docs.z.ai/devpack/usage-policy) — rate limits, fair use
- [docs.z.ai/devpack/faq](https://docs.z.ai/devpack/faq) — quota behavior, endpoints
- [docs.z.ai/devpack/notice/usage-revision](https://docs.z.ai/devpack/notice/usage-revision) — credits-based migration (Jul 30 2026)
- [docs.z.ai/api-reference/api-code](https://docs.z.ai/api-reference/api-code) — error codes incl. limit-hit
- [docs.z.ai/guides/develop/http/introduction](https://docs.z.ai/guides/develop/http/introduction) — endpoints, auth headers

## TL;DR — data availability

| Surface | Available? | Notes |
|---|---|---|
| Public quota/subscription API endpoint | ❌ No | None in api-reference; `/balance`, `/quota`, `/subscription` do not exist |
| Rate-limit headers on success responses | ❌ No | No `X-RateLimit-*` style headers documented |
| Web console quota view | ✅ but auth-gated | `z.ai/manage-apikey/subscription`, `…/coding-plan/personal/my-plan` — needs user session; not scrapeable without credentials |
| Limit-hit error responses | ✅ reactive | Codes `1308`/`1310`/`1316`/`1317` carry `{next_flush_time}` (authoritative reset) |
| Published credit formula + multipliers | ✅ Yes | Enables accurate **local** credit tracking |
| Plan-tier query | ❌ No | No way to read the user's tier via API |

**Conclusion:** track credits locally from per-message token usage using the published formula. Calibrate from limit-error responses when they occur.

## Credit formula

```
model_credits = (input_tokens × inMult
               + cached_input_tokens × cachedMult
               + output_tokens × outMult) / 10_000

mcp_credits  = num_calls × outMult
```

Off-peak hours: **charge at 50%** of the standard rate.

## Multipliers (per model)

| Model | Input mult | Cached-input mult | Output mult |
|---|---|---|---|
| GLM-5.2 | 6.9 | 1.7 | 24 |
| GLM-5-Turbo | 5.7 | 1.5 | 21 |
| GLM-4.7 | 4.6 | 1.2 | 16 |
| GLM-4.6V (Vision MCP) | 1.2 | 0.3 | 2.7 |
| MCP: Web Search | — | — | 1.2 |
| MCP: Web Reader | — | — | 1.2 |
| MCP: Zread | — | — | 1.2 |

## Plan tiers + credit ceilings

| Plan | 5-hour credits | Weekly credits | Price |
|---|---|---|---|
| Lite | 2,000 | 10,000 | $18/mo |
| Pro | 12,000 | 60,000 | $72/mo |
| Max | 28,000 | 140,000 | $160/mo |

## Reset rules

- **5-hour credits:** dynamically refreshed; quota resets **5 hours after consumption** (sliding window).
- **Weekly credits:** activated on subscription; resets **every 7 days** from the subscription anchor.

## Off-peak window

- **Off-peak = 50% credit rate.**
- **Peak:** Monday–Friday, **14:00–18:00 Singapore Standard Time (UTC+8)**.
- (Use a fixed SGT clock for peak detection, not the host's local tz.)

## Limit / balance error codes (from api-reference/api-code)

| Code | HTTP | Meaning |
|---|---|---|
| `1113` | 429 | Insufficient balance or no resource package |
| `1302` | 429 | Rate limit reached for requests |
| `1308` | 429 | Usage limit reached for `{number}{unit}`. Resets at `{next_flush_time}` |
| `1310` | 429 | Weekly/Monthly limit exhausted. Resets at `{next_flush_time}` |
| `1316` | 429 | Usage limit reached for the past **5 hours**. Resets at `{next_flush_time}` |
| `1317` | 429 | Usage limit reached for the past **7 days**. Resets at `{next_flush_time}` |
| `1318`–`1321` | 429 | 5h/7d limits with monthly-spend-cap variants |
| `1313` | 429 | Fair-Usage-Policy frequency limit |
| `1315` | 429 | API key limited to enterprise coding package |

**Calibration use:** when pi surfaces a `1316`/`1317` (via `after_provider_response` status 429 or the error body), parse `{next_flush_time}` and snap local window state to authoritative reset.

## Endpoints (coding plan)

- **Claude Code / Goose (Anthropic-compatible):** `https://api.z.ai/api/anthropic`
- **Other tools (OpenAI-compatible):** `https://api.z.ai/api/coding/paas/v4`
- Auth: `Authorization: Bearer <API_KEY>` (opaque bearer; **not** a decodable JWT with plan claims).
- ⚠️ The Coding Plan is **restricted to officially supported tools**. Using it from `pi` (as the user does, with `glm-5.2` as defaultModel against the paas/v4 endpoint) works as long as requests hit the coding endpoint; this is the user's existing working setup.

## Implications for pi-statusline

1. **No polling.** Don't call any z.ai endpoint for quota — there's nothing to call.
2. **Local tracking is the path.** Use the formula; maintain two rolling debit windows (5h, 7d).
3. **Cached tokens required.** The formula's cached term needs pi's per-message usage to expose cached token counts (Anthropic `cache_read_input_tokens` / OpenAI `cached_tokens`). **Verify the shape the user's glm-5.2 provider emits at build time.**
4. **Off-peak is real.** Apply 50% factor during the SGT peak window; it materially changes the credit cost.
5. **Tier is manual.** No detection API. Default `lite`; user sets via `/statusline`.
6. **Calibrate on errors.** Hook `after_provider_response` for 429s to snap authoritative reset times.

## Raw artifacts

Scraped pages saved under `~/local-dev/tmp/.firecrawl/` (`zai-overview.md`, `zai-faq.md`, `zai-usage-policy.md`, `zai-usage-revision.md`, `zai-errors.md`, `zai-http-intro.md`) for reference.
