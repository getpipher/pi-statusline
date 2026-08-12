> Source: 
> Scraped: 2026-08-12 via firecrawl

> ## Documentation Index
>
> Fetch the complete documentation index at: [/llms.txt](https://docs.z.ai/llms.txt)
>
> Use this file to discover all available pages before exploring further.

[Skip to main content](https://docs.z.ai/devpack/quick-start#content-area)

[Overview - Z.AI DEVELOPER DOCUMENT home page![light logo](https://mintcdn.com/zhipu-32152247/B_E8wI-eiNa1QlPV/logo/dark.svg?fit=max&auto=format&n=B_E8wI-eiNa1QlPV&q=85&s=75deefa9dea5bdbc84d4da68885c267f)![dark logo](https://mintcdn.com/zhipu-32152247/B_E8wI-eiNa1QlPV/logo/light.svg?fit=max&auto=format&n=B_E8wI-eiNa1QlPV&q=85&s=c1ecf1af358fa8eeab8c06052337f8f6)](https://z.ai/model-api)

English

Search...

Ctrl K

- [API Keys](https://z.ai/manage-apikey/apikey-list)
- [Payment Method](https://z.ai/manage-apikey/billing)

Search...

Navigation

Guide

Quick Start

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

- [Getting Started](https://docs.z.ai/devpack/quick-start#getting-started)
- [Advanced Features](https://docs.z.ai/devpack/quick-start#advanced-features)

Guide

# Quick Start

Copy pageCopy page

Copy pageCopy page

This guide will help you get started with [GLM Coding Plan](https://z.ai/subscribe?utm_source=zai&utm_medium=link&utm_term=quickstart&utm_campaign=Platform_Ops&_channel_track_key=DRUfXN42) in minutes—from subscribing to using GLM models in officially [supported tools and products](https://docs.z.ai/devpack/tool/others#step-1-supported-tools).

## [​](https://docs.z.ai/devpack/quick-start\#getting-started)  Getting Started

1

Register or Login

- Access [Z.AI Open Platform](https://z.ai/model-api), Register or Login.

2

Subscribe to GLM Coding Plan

After logging in, navigate to the [GLM Coding Plan](https://z.ai/subscribe?utm_source=zai&utm_medium=link&utm_term=quickstart&utm_campaign=Platform_Ops&_channel_track_key=DRUfXN42) to select your preferred subscription plan.

3

Obtain API Key

After subscribing,Individual Plan users can create an API Key under [Individual Coding Plan > Plan Overview](https://z.ai/manage-apikey/apikey-list).Team Plan members can obtain their API Key under [Team Coding Plan > My Plan](https://z.ai/manage-apikey/coding-plan/team/my-plan). The Team Plan Key is not interchangeable with other Z.AI’s API Keys. To use your Team Plan quota, make sure to use the Team Plan Key.

Safeguard your API Key by keeping it confidential and avoiding hard-coding it in your code.

4

Connect a Coding Tool

The GLM Coding Plan is strictly limited to use within officially [supported tools and products](https://docs.z.ai/devpack/tool/others#step-1-supported-tools). Click a tool below to open its configuration guide:

[**Claude Code**](https://docs.z.ai/devpack/tool/claude)

[**Roo Code**](https://docs.z.ai/devpack/tool/roo)

[**Kilo Code**](https://docs.z.ai/devpack/tool/kilo)

[**Cline**](https://docs.z.ai/devpack/tool/cline)

[**OpenCode**](https://docs.z.ai/devpack/tool/opencode)

[**OpenClaw**](https://docs.z.ai/devpack/tool/openclaw)

[**Crush**](https://docs.z.ai/devpack/tool/crush)

[**Goose**](https://docs.z.ai/devpack/tool/goose)

[**Cursor**](https://docs.z.ai/devpack/tool/cursor)

[**Other Tools**](https://docs.z.ai/devpack/tool/others)

5

Endpoint Guide

GLM Coding Plan supports both the Anthropic and OpenAI protocols. Make sure to configure the correct `Base URL`:

| Protocol | Base URL |
| --- | --- |
| Anthropic Messages | `https://api.z.ai/api/anthropic` |
| OpenAI Chat Completions | `https://api.z.ai/api/coding/paas/v4` |

6

Start Coding

Once configured, you can begin coding with the GLM model!

- Conversational Programming

- Code Debugging

- Code Optimization


```
# Using natural language commands in Claude Code
Please create a React component containing a user login form
```

```
# Describe the issue encountered
My API request returns a 404 error. Please help me check the code.
```

```
# Code optimization
This function performs poorly. Please optimize it for me.
```

## [​](https://docs.z.ai/devpack/quick-start\#advanced-features)  Advanced Features

Vision MCP Server (Coding Plan Exclusive)

All users can utilize the Vision MCP Server, which employs the flagship vision reasoning model GLM-4.6V to comprehend and analyze image content.

- Analyze UI design mockups and generate corresponding code
- Understand flowcharts and architecture diagrams
- Extract text and information from screenshots

For detailed usage instructions, refer to the [Vision MCP Server](https://docs.z.ai/devpack/mcp/vision-mcp-server) documentation.

Web Search MCP Server (Coding Plan Exclusive)

All users can utilize the Web Search MCP Server to access the latest technical information.

- Search for the latest technical documentation and API changes
- Obtain the latest information on open-source projects
- Find solutions and best practices

For detailed usage instructions, refer to the [Web Search MCP Server](https://docs.z.ai/devpack/mcp/search-mcp-server) documentation.

Web Reader MCP Server (Coding Plan Exclusive)

All users can utilize the Web Reader MCP Server to fetch full webpage content and extract structured data.

- Fetch complete webpage content including text, and links
- Extract structured data such as title, body, and metadata
- Remote HTTP-based MCP service, no local installation required

For detailed usage instructions, refer to the [Web Reader MCP Server](https://docs.z.ai/devpack/mcp/reader-mcp-server) documentation.

Was this page helpful?

YesNo

[Team Plan Benefits](https://docs.z.ai/devpack/teamplan) [Coding Tool Helper](https://docs.z.ai/devpack/extension/coding-tool-helper)

Ctrl+I

[x](https://x.com/Zai_org) [github](https://github.com/zai-org) [discord](https://discord.gg/QR7SARHRxK) [linkedin](https://www.linkedin.com/company/zdotai)

[Powered byThis documentation is built and hosted on Mintlify, a developer documentation platform](https://www.mintlify.com/?utm_campaign=poweredBy&utm_medium=referral&utm_source=zhipu-32152247)