# z.ai Coding-Plan MCPs vs Firecrawl (and our other tools) — Comparison

**Status:** STUB — provisional verdicts only. **To be finalized with evidence** (head-to-head tests on identical tasks). Deferred per RECTOR (2026-08-12): "the verdict should come from evidence."

**Scope:** compare the 4 GLM Coding Plan MCPs against Firecrawl and the rest of the workflow (`gh`, `curl`, the agent's `read`/`grep`, Context7 MCP) to decide which MCPs are worth wiring.

**All 4 MCPs are entitlements of the GLM Coding Plan** (no extra sub) and bill against the **same plan credit bucket** that pi-statusline monitors via `/quota/limit`. So cost is plan credits, not cash — but they still eat the 5h/weekly budget.

## Provisional verdicts (pending evidence)

| MCP | Provisional verdict | Rationale (to confirm with tests) |
|---|---|---|
| **Vision** (`@z_ai/mcp-server`, GLM-4.6V) | ✅ **WIRE** | No Firecrawl equivalent (Firecrawl screenshots bytes; does not *understand* images). Fills GLM-5.2's no-vision gap. Confirmed needed (image reading was broken when Ollama vision rate-limited). |
| **Web Search** (`webSearchPrime`) | ❌ **SKIP → Firecrawl** | Appears to fully overlap Firecrawl `/search`, which is richer (full page markdown, structured, schema). Confirm with a same-query test. |
| **Web Reader** (`webReader`) | ❌ **SKIP → Firecrawl** | Appears to fully overlap Firecrawl `/scrape`, which is richer (JS-render, screenshots, anti-bot, structured extract). Confirm with a same-URL test. |
| **Zread** (`search_doc`/`get_repo_structure`/`read_file`) | ⚠️ **OPTIONAL** | GitHub-public-only. Mechanics overlap `gh` (structure/files/issues). Unique edge = *semantic* search over a repo's issues/PRs/contributors that `gh` can't do. Confirm whether that edge justifies a wire. |

## MCP quick reference (from scraped devpack docs)

| MCP | Deploy | Endpoint | Tool(s) | Input → Output |
|---|---|---|---|---|
| Vision | local stdio | `npx -y @z_ai/mcp-server@latest` + env `Z_AI_API_KEY`,`Z_AI_MODE=ZAI` | `image_analysis`,`extract_text_from_screenshot`,`diagnose_error_screenshot`,`understand_technical_diagram`,`analyze_data_visualization`,`ui_to_artifact`,`ui_diff_check`,`video_analysis` | image/video path → understanding |
| Web Search | remote HTTP | `https://api.z.ai/api/mcp/web_search_prime/mcp` + Bearer | `webSearchPrime` | query → result list (titles, URLs, summaries) |
| Web Reader | remote HTTP | `https://api.z.ai/api/mcp/web_reader/mcp` + Bearer | `webReader` | URL → page content (title, body, metadata, links) |
| Zread | remote HTTP | `https://api.z.ai/api/mcp/zread/mcp` + Bearer | `search_doc`,`get_repo_structure`,`read_file` | GitHub repo (+query/path) → docs/issues/PRs, dir tree, or file content |

## Comparison methodology (to run when finalizing)

For each MCP, run an **identical task** through the MCP and through the Firecrawl/tool equivalent, then compare on:

1. **Output richness** — fields, structure, completeness.
2. **Quality / accuracy** — correctness, noise, relevance.
3. **JS-rendering / anti-bot** — does it handle SPAs, paywalls, bot protection?
4. **Coverage** — what can each reach that the other can't?
5. **Cost** — plan credits (MCP) vs Firecrawl credits; per-call rate.
6. **Latency** — round-trip time.

### Planned head-to-heads
- **Search:** same query (e.g. "Solana token-2022 transfer guard") → z.ai `webSearchPrime` vs Firecrawl `/search`.
- **Reader:** same URL (a JS-rendered SPA, e.g. a Mintlify docs page) → z.ai `webReader` vs Firecrawl `/scrape`.
- **Zread:** same repo (e.g. `badlogic/pi-mono`) → z.ai `search_doc`/`get_repo_structure`/`read_file` vs `gh` (+ Firecrawl on the docs site).

### Decision rule (per RECTOR)
- If an MCP **fully overlaps** Firecrawl → use Firecrawl (RECTOR's stated preference).
- If an MCP offers a **capability Firecrawl can't match** → wire it.
- Vision is the clear wire (no overlap). Search/Reader likely skip. Zread is the genuine judgment call.

## When to run
Deferred. Trigger when (a) RECTOR wants to finalize the MCP wiring, or (b) before any pi-statusline work that would need to distinguish MCP vs model credit drain in the local fast-path (it doesn't — the authoritative poll counts both). Not blocking pi-statusline v1.
