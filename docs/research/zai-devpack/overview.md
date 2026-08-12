> Source: 
> Scraped: 2026-08-12 via firecrawl

> ## Documentation Index
>
> Fetch the complete documentation index at: [/llms.txt](https://docs.z.ai/llms.txt)
>
> Use this file to discover all available pages before exploring further.

[Skip to main content](https://docs.z.ai/devpack/overview#content-area)

[Overview - Z.AI DEVELOPER DOCUMENT home page![light logo](https://mintcdn.com/zhipu-32152247/B_E8wI-eiNa1QlPV/logo/dark.svg?fit=max&auto=format&n=B_E8wI-eiNa1QlPV&q=85&s=75deefa9dea5bdbc84d4da68885c267f)![dark logo](https://mintcdn.com/zhipu-32152247/B_E8wI-eiNa1QlPV/logo/light.svg?fit=max&auto=format&n=B_E8wI-eiNa1QlPV&q=85&s=c1ecf1af358fa8eeab8c06052337f8f6)](https://z.ai/model-api)

English

Search...

Ctrl K

- [API Keys](https://z.ai/manage-apikey/apikey-list)
- [Payment Method](https://z.ai/manage-apikey/billing)

Search...

Navigation

GLM Coding Plan

Overview

[Guides](https://docs.z.ai/guides/overview/quick-start) [API Reference](https://docs.z.ai/api-reference/introduction) [Coding Plan](https://docs.z.ai/devpack/overview) [Released Notes](https://docs.z.ai/release-notes/new-released) [Terms and Policy](https://docs.z.ai/legal-agreement/privacy-policy) [Help Center](https://docs.z.ai/help/faq)

### GLM Coding Plan

- [Overview](https://docs.z.ai/devpack/overview)
- [Usage Policy](https://docs.z.ai/devpack/usage-policy)
- [FAQ](https://docs.z.ai/devpack/faq)
- [Team Plan Benefits](https://docs.z.ai/devpack/teamplan)

### Guide

- [Quick Start](https://docs.z.ai/devpack/quick-start)
- [Coding Tool Helper](https://docs.z.ai/devpack/extension/coding-tool-helper)
- [Tool Integration](https://docs.z.ai/devpack/tool/others)
- [How to Switch Models](https://docs.z.ai/devpack/latest-model)
- MCP Integration


### Notice

- [Plan Update Announcement](https://docs.z.ai/devpack/notice/usage-revision)
- [Legacy Plan Migration Notice](https://docs.z.ai/devpack/transition)

### Learning Resources

- [Best Practice](https://docs.z.ai/devpack/resources/best-practice)
- [Memory-mechanism](https://docs.z.ai/devpack/resources/memory-mechanism)

### Campaign Rules

- [Invite Friends, Get Credits](https://docs.z.ai/devpack/credit-campaign-rules)

## On this page

- [Usage](https://docs.z.ai/devpack/overview#usage)
- [Advantages](https://docs.z.ai/devpack/overview#advantages)
- [Benefits](https://docs.z.ai/devpack/overview#benefits)
  - [Supported Models](https://docs.z.ai/devpack/overview#supported-models)
  - [Usage Instruction](https://docs.z.ai/devpack/overview#usage-instruction)
  - [Usage Credit Allowance](https://docs.z.ai/devpack/overview#usage-credit-allowance)
  - [Credit Calculation](https://docs.z.ai/devpack/overview#credit-calculation)
  - [Estimated Token Allowance](https://docs.z.ai/devpack/overview#estimated-token-allowance)
  - [Exclusive MCP Access](https://docs.z.ai/devpack/overview#exclusive-mcp-access)
- [Next Steps](https://docs.z.ai/devpack/overview#next-steps)

GLM Coding Plan

# Overview

Copy pageCopy page

Copy pageCopy page

The GLM Coding Plan is a subscription package designed specifically for AI-powered coding.

## [​](https://docs.z.ai/devpack/overview\#usage)  Usage

The plan can be applied to coding tools such as Claude Code, Cline, and OpenCode, covering a wide range of development scenarios:

Natural Language Programming

Describe requirements in plain language to automatically generate plans, write code, debug issues, and ensure smooth execution.

Intelligent Code Completion

Get real-time, context-aware completion suggestions that reduce manual typing and significantly improve productivity.

Code Debugging & Repair

Input error messages or descriptions to automatically analyze your codebase, locate problems, and provide fixes.

Codebase Q&A

Ask questions about your team’s codebase anytime, maintain global understanding, and receive precise answers with external data integration.

Automated Task Handling

Automatically fix lint issues, resolve merge conflicts, and generate release notes—allowing developers to stay focused on core logic.

## [​](https://docs.z.ai/devpack/overview\#advantages)  Advantages

- **Access to high-intelligence Coding Model:** Upon release, the GLM series achieved SOTA performance among open-source models in reasoning, coding, and agent capabilities, delivering outstanding results in tool use and complex task execution.
- **Works with Multiple Tools:** Beyond Claude Code, it also supports Cline, OpenCode, and some [specific tools](https://docs.z.ai/devpack/tool/others#step-1-supported-tools), giving you flexibility across development workflows.
- **Generous Usage at a Fair Price:** Get higher call limits than standard plans. Starting at just 18 USD per month, with Pro and Max plans designed for high-frequency, complex projects.
- **Expanded Capabilities:** All plans support Vision Understanding, Web Search MCP， Web Reader MCP and Zread MCP helping you tackle a wider range of development tasks.

## [​](https://docs.z.ai/devpack/overview\#benefits)  Benefits

### [​](https://docs.z.ai/devpack/overview\#supported-models)  Supported Models

- All plans support **GLM-5.2**, GLM-5-Turbo and GLM-4.7.

### [​](https://docs.z.ai/devpack/overview\#usage-instruction)  Usage Instruction

For information on Team Plan usage limits, please visit [Team Plan Benefits](https://docs.z.ai/devpack/teamplan).

#### [​](https://docs.z.ai/devpack/overview\#usage-credit-allowance)  Usage Credit Allowance

Each plan is subject to both a 5-hour usage limit and a weekly usage limit.

| Plan Type | 5-Hour Credits | Weekly Credits |
| --- | --- | --- |
| Lite | 2,000 | 10,000 |
| Pro | 12,000 | 60,000 |
| Max | 28,000 | 140,000 |

**Credit Reset Rules**

- **5-hour credits**: Dynamically refreshed; credit quota resets 5 hours after consumption.
- **Weekly credits**: Activated upon subscription; resets every 7 days.

#### [​](https://docs.z.ai/devpack/overview\#credit-calculation)  Credit Calculation

- Model credit usage = (Input tokens × Input multiplier + Cached Input tokens × Cached Input multiplier + Output tokens × Output multiplier) / 10,000
- MCP tool credit usage = Number of calls × Output multiplier

You can view the number of tokens consumed under each pricing type and the number of tool calls on the [Charge Type](https://z.ai/manage-apikey/billing) page.

| Product Type | Product | Input Multiplier | Cached Input Multiplier | Output Multiplier |
| --- | --- | --- | --- | --- |
| Model | GLM-5.2 | 6.9 | 1.7 | 24 |
| GLM-5-Turbo | 5.7 | 1.5 | 21 |
| GLM-4.7 | 4.6 | 1.2 | 16 |
| GLM-4.6V（Vision MCP） | 1.2 | 0.3 | 2.7 |
| MCP Server | Web Search | — | — | 1.2 |
| Web Reader | — | — | 1.2 |
| Zread | — | — | 1.2 |

**During off-peak hours, model usage is charged at 50% of the standard credit rate**.

**Peak hours**: Monday to Friday, 14:00–18:00 Singapore Standard Time (UTC+8).

#### [​](https://docs.z.ai/devpack/overview\#estimated-token-allowance)  Estimated Token Allowance

Assuming all usage is on GLM-5.2 and the cache hit rate is 90.9%—the average level for coding workloads—the estimated weekly token allowance for each plan tier is approximately:

- Lite: 43–87 million tokens/week
- Pro: 263–526 million tokens/week
- Max: 613–1226 million tokens/week

**How the Range Is Calculated**

- Maximum token allowance: All usage occurs during off-peak hours and is charged at 0.5× the standard credit rate.
- Minimum token allowance: All usage occurs during peak hours and is charged at 1× the standard credit rate.

By making full use of the off-peak benefit, you can **save up to 92%** compared with calling GLM-5.2 through the standard on-demand usage API.

### [​](https://docs.z.ai/devpack/overview\#exclusive-mcp-access)  Exclusive MCP Access

[**Vision Understanding**](https://docs.z.ai/devpack/mcp/vision-mcp-server)

[**Web Search**](https://docs.z.ai/devpack/mcp/search-mcp-server)

[**Web Reader**](https://docs.z.ai/devpack/mcp/reader-mcp-server)

[**Zread**](https://docs.z.ai/devpack/mcp/zread-mcp-server)

## [​](https://docs.z.ai/devpack/overview\#next-steps)  Next Steps

[**Quick Start** \\
\\
Get up and running in minutes — from subscribing to the plan to using it in your coding tools.](https://docs.z.ai/devpack/quick-start)

[**Usage Policy** \\
\\
Learn about account usage rules, rate limits, refund policies, and other important guidelines.](https://docs.z.ai/devpack/usage-policy)

[**FAQ** \\
\\
Find answers to common questions about subscriptions, promotions, and using the plan.](https://docs.z.ai/devpack/faq)

Was this page helpful?

YesNo

[Usage Policy](https://docs.z.ai/devpack/usage-policy)

Ctrl+I

[x](https://x.com/Zai_org) [github](https://github.com/zai-org) [discord](https://discord.gg/QR7SARHRxK) [linkedin](https://www.linkedin.com/company/zdotai)

[Powered byThis documentation is built and hosted on Mintlify, a developer documentation platform](https://www.mintlify.com/?utm_campaign=poweredBy&utm_medium=referral&utm_source=zhipu-32152247)