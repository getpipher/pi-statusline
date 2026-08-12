> Source: 
> Scraped: 2026-08-12 via firecrawl

> ## Documentation Index
>
> Fetch the complete documentation index at: [/llms.txt](https://docs.z.ai/llms.txt)
>
> Use this file to discover all available pages before exploring further.

[Skip to main content](https://docs.z.ai/devpack/tool/others#content-area)

[Overview - Z.AI DEVELOPER DOCUMENT home page![light logo](https://mintcdn.com/zhipu-32152247/B_E8wI-eiNa1QlPV/logo/dark.svg?fit=max&auto=format&n=B_E8wI-eiNa1QlPV&q=85&s=75deefa9dea5bdbc84d4da68885c267f)![dark logo](https://mintcdn.com/zhipu-32152247/B_E8wI-eiNa1QlPV/logo/light.svg?fit=max&auto=format&n=B_E8wI-eiNa1QlPV&q=85&s=c1ecf1af358fa8eeab8c06052337f8f6)](https://z.ai/model-api)

English

Search...

Ctrl K

- [API Keys](https://z.ai/manage-apikey/apikey-list)
- [Payment Method](https://z.ai/manage-apikey/billing)

Search...

Navigation

Guide

Tool Integration

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

- [Supported Tools](https://docs.z.ai/devpack/tool/others#supported-tools)
  - [1\. Coding Agent Tool](https://docs.z.ai/devpack/tool/others#1-coding-agent-tool)
  - [2\. General-purpose Agent Tool](https://docs.z.ai/devpack/tool/others#2-general-purpose-agent-tool)
- [Coding Endpoint](https://docs.z.ai/devpack/tool/others#coding-endpoint)
- [Config Example](https://docs.z.ai/devpack/tool/others#config-example)
  - [1\. Install the Cline Plugin](https://docs.z.ai/devpack/tool/others#1-install-the-cline-plugin)
  - [2\. Configure API Endpoint](https://docs.z.ai/devpack/tool/others#2-configure-api-endpoint)
  - [3\. Get Started](https://docs.z.ai/devpack/tool/others#3-get-started)

Guide

# Tool Integration

Copy pageCopy page

Copy pageCopy page

## [​](https://docs.z.ai/devpack/tool/others\#supported-tools)  Supported Tools

The GLM Coding Plan is limited to use within the following officially supported tools and product environments; users may not use their subscription benefits for tools or scenarios outside of this scope.

### [​](https://docs.z.ai/devpack/tool/others\#1-coding-agent-tool)  1\. Coding Agent Tool

Click on the tool documentation below that you wish to use, and follow the corresponding integration guide to set it up.

[**Claude Code** \\
\\
The Claude Code IDE plugin supports VSCode and JetBrains.](https://docs.z.ai/devpack/tool/claude)

[**Claude for IDE** \\
\\
The Claude Code IDE plugin supports VSCode and JetBrains.](https://docs.z.ai/devpack/tool/claude-for-ide)

[**ZCode** \\
\\
ZCode integrates AI agents into your existing toolchain.](https://docs.z.ai/devpack/tool/zcode)

[**OpenCode** \\
\\
The Claude Code IDE plugin supports VSCode and JetBrains.](https://docs.z.ai/devpack/tool/opencode)

[**Pi** \\
\\
A minimalist terminal coding agent with a small core, extensible via extensions, Skills, and Pi Packages.](https://docs.z.ai/devpack/tool/pi)

[**Cursor** \\
\\
An AI-first code editor that supports custom model configurations.](https://docs.z.ai/devpack/tool/cursor)

[**Cline** \\
\\
An AI programming extension for VS Code that supports code generation and file operations.](https://docs.z.ai/devpack/tool/cline)

[**TRAE** \\
\\
An AI editor capable of independently completing various development tasks.](https://docs.z.ai/devpack/tool/trae)

[**Qoder** \\
\\
An agentic coding platform designed for real software development.](https://docs.z.ai/devpack/tool/qoder)

[**Droid** \\
\\
Enterprise-grade AI coding agent that runs in the terminal to handle end-to-end workflows.](https://docs.z.ai/devpack/tool/droid)

[**Kilo Code** \\
\\
A powerful VS Code extension for code generation and project management.](https://docs.z.ai/devpack/tool/kilo)

[**Roo Code** \\
\\
A smart VS Code extension for code writing and refactoring.](https://docs.z.ai/devpack/tool/roo)

[**Crush** \\
\\
A terminal-based AI programming tool that supports both CLI and TUI interfaces.](https://docs.z.ai/devpack/tool/crush)

[**Goose** \\
\\
AI Agent tool, supporting local execution and automated engineering tasks.](https://docs.z.ai/devpack/tool/goose)

[**Eigent** \\
\\
A desktop AI agent built on a multi-agent architecture, capable of automating browser, terminal, and MCP-powered workflows.](https://docs.z.ai/devpack/tool/eigent)

### [​](https://docs.z.ai/devpack/tool/others\#2-general-purpose-agent-tool)  2\. General-purpose Agent Tool

The general-purpose agent tools listed below are also supported and will continue to be served on a best-effort basis. Under high inference load, some requests may face temporary rate limits.

[**OpenClaw** \\
\\
An open-source AI assistant that runs on local devices, supports multi-platform use.](https://docs.z.ai/devpack/tool/openclaw)

[**Hermes Agent** \\
\\
An open-source evolving AI agent with persistent memory,getting smarter with use.](https://docs.z.ai/devpack/tool/others#)

[**SillyTavern** \\
\\
A highly customizable AI chat frontend for immersive roleplay with multi-model & media support.](https://docs.z.ai/devpack/tool/others#)

## [​](https://docs.z.ai/devpack/tool/others\#coding-endpoint)  Coding Endpoint

GLM Coding Plan supports both the Anthropic and OpenAI protocols. Make sure to configure the correct `Base URL`:

| Protocol | Base URL |
| --- | --- |
| Anthropic Messages | `https://api.z.ai/api/anthropic` |
| OpenAI Chat Completions | `https://api.z.ai/api/coding/paas/v4` |

**Core Steps**

1. Choose the protocol that fits your tool (Anthropic Messages or OpenAI Chat Completions).
2. Configure the correct Base URL.
3. Enter your API Key and select a GLM model.

Please select the correct endpoint address based on the tool you are using. Incorrect endpoint configuration will result in inability to use GLM Coding Plan subscription quota.

## [​](https://docs.z.ai/devpack/tool/others\#config-example)  Config Example

Using **Cline** as an example, the following steps demonstrate how to integrate GLM models via the OpenAI Compatible protocol. Similarly, other tools supporting the OpenAI-compatible protocol can adopt the same configuration approach.

### [​](https://docs.z.ai/devpack/tool/others\#1-install-the-cline-plugin)  1\. Install the Cline Plugin

1. Open VS Code and click the Extensions Marketplace icon on the left.
2. Enter `cline` in the search box and locate the `Cline` extension.
3. Click `Install` to install it, then choose to trust the developer.

### [​](https://docs.z.ai/devpack/tool/others\#2-configure-api-endpoint)  2\. Configure API Endpoint

In Cline, select `Use your own API Key`, then fill in the following configuration:

- **API Provider**: Select `OpenAI Compatible`
- **Base URL**: Enter `https://api.z.ai/api/coding/paas/v4`
- **API Key**: Enter your Z.AI API Key
- **Model**: Select “Use custom” and enter the GLM model code you want to use (e.g., `glm-5.2`)
- **Other Configurations**:

  - Uncheck **Support Images**
  - Adjust **Context Window Size** based on your model (`glm-5.2` is `1000000`; other models `200000`)

### [​](https://docs.z.ai/devpack/tool/others\#3-get-started)  3\. Get Started

Once configured, you can enter your requirements in the input box to let the model assist you with code generation, file editing, refactoring, explaining code logic, debugging, and more.

Was this page helpful?

YesNo

[Coding Tool Helper](https://docs.z.ai/devpack/extension/coding-tool-helper) [How to Switch Models](https://docs.z.ai/devpack/latest-model)

Ctrl+I

[x](https://x.com/Zai_org) [github](https://github.com/zai-org) [discord](https://discord.gg/QR7SARHRxK) [linkedin](https://www.linkedin.com/company/zdotai)

[Powered byThis documentation is built and hosted on Mintlify, a developer documentation platform](https://www.mintlify.com/?utm_campaign=poweredBy&utm_medium=referral&utm_source=zhipu-32152247)