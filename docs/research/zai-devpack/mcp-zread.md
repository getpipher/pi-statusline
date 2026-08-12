> Source: https://docs.z.ai/devpack/mcp/zread-mcp-server
> Scraped: 2026-08-12 via firecrawl

> ## Documentation Index
>
> Fetch the complete documentation index at: [/llms.txt](https://docs.z.ai/llms.txt)
>
> Use this file to discover all available pages before exploring further.

[Skip to main content](https://docs.z.ai/devpack/mcp/zread-mcp-server#content-area)

[Overview - Z.AI DEVELOPER DOCUMENT home page![light logo](https://mintcdn.com/zhipu-32152247/B_E8wI-eiNa1QlPV/logo/dark.svg?fit=max&auto=format&n=B_E8wI-eiNa1QlPV&q=85&s=75deefa9dea5bdbc84d4da68885c267f)![dark logo](https://mintcdn.com/zhipu-32152247/B_E8wI-eiNa1QlPV/logo/light.svg?fit=max&auto=format&n=B_E8wI-eiNa1QlPV&q=85&s=c1ecf1af358fa8eeab8c06052337f8f6)](https://z.ai/model-api)

English

Search...

Ctrl K

- [API Keys](https://z.ai/manage-apikey/apikey-list)
- [Payment Method](https://z.ai/manage-apikey/billing)

Search...

Navigation

MCP Integration

Zread MCP Server

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



  - [Vision MCP Server](https://docs.z.ai/devpack/mcp/vision-mcp-server)
  - [Web Search MCP Server](https://docs.z.ai/devpack/mcp/search-mcp-server)
  - [Web Reader MCP Server](https://docs.z.ai/devpack/mcp/reader-mcp-server)
  - [Zread MCP Server](https://docs.z.ai/devpack/mcp/zread-mcp-server)

### Notice

- [Plan Update Announcement](https://docs.z.ai/devpack/notice/usage-revision)
- [Legacy Plan Migration Notice](https://docs.z.ai/devpack/transition)

### Learning Resources

- [Best Practice](https://docs.z.ai/devpack/resources/best-practice)
- [Memory-mechanism](https://docs.z.ai/devpack/resources/memory-mechanism)

### Campaign Rules

- [Invite Friends, Get Credits](https://docs.z.ai/devpack/credit-campaign-rules)

## On this page

- [Features](https://docs.z.ai/devpack/mcp/zread-mcp-server#features)
- [Tools](https://docs.z.ai/devpack/mcp/zread-mcp-server#tools)
- [Example Scenarios](https://docs.z.ai/devpack/mcp/zread-mcp-server#example-scenarios)
- [Installation and Usage](https://docs.z.ai/devpack/mcp/zread-mcp-server#installation-and-usage)
  - [Quick Start](https://docs.z.ai/devpack/mcp/zread-mcp-server#quick-start)
  - [Supported Clients](https://docs.z.ai/devpack/mcp/zread-mcp-server#supported-clients)
- [Troubleshooting](https://docs.z.ai/devpack/mcp/zread-mcp-server#troubleshooting)
- [Resources](https://docs.z.ai/devpack/mcp/zread-mcp-server#resources)

MCP Integration

# Zread MCP Server

Copy pageCopy page

Copy pageCopy page

The ZRead MCP Server is an exclusive Remote MCP Server developed by Z.AI for GLM Coding Plan users. Built on the Model Context Protocol (MCP) and powered by zread.ai, it provides access to open-source repository documentation, code structures, and file contents for MCP-compatible clients, including Claude Code and Cline.

## [​](https://docs.z.ai/devpack/mcp/zread-mcp-server\#features)  Features

## Documentation Search

Search documentation, code, and comments in Github repositories

## Repository Structure

Get the directory structure and file list of GitHub repositories to quickly master project layout

## Code Reading

Read the complete code content of specified files in GitHub repositories to deeply analyze implementation details

## [​](https://docs.z.ai/devpack/mcp/zread-mcp-server\#tools)  Tools

This server implements the Model Context Protocol and works with any MCP-compatible client. Currently, it provides the following tools:

- **`search_doc`** — Search for knowledge documentation corresponding to the GitHub repository, quickly understanding repository knowledge, news, recent issues, PRs, and contributors.
- **`get_repo_structure`** — Get the directory structure and file list of the GitHub repository to understand project module splitting and directory organization.
- **`read_file`** — Read the complete code content of specified files in the GitHub repository to deeply analyze the implementation details of the file code.

## [​](https://docs.z.ai/devpack/mcp/zread-mcp-server\#example-scenarios)  Example Scenarios

Quick Start with Open Source Libraries

Quickly understand the core concepts, installation steps, and code organization of open source libraries by searching documentation and obtaining repository structures, accelerating the learning curve.

Issue Troubleshooting and History

When encountering problems, search the repository’s Issue and Commit history to find solutions or fix records for similar problems.

Deep Source Code Analysis

Directly read the code content of core files, analyze implementation logic, and assist in secondary development or Debugging.

Dependency Library Research

Before introducing a new dependency library, evaluate its activity, code quality, and maintenance status by viewing its repository structure and documentation.

## [​](https://docs.z.ai/devpack/mcp/zread-mcp-server\#installation-and-usage)  Installation and Usage

### [​](https://docs.z.ai/devpack/mcp/zread-mcp-server\#quick-start)  Quick Start

1

Get API Key

Visit [Z.AI Console](https://z.ai/manage-apikey/apikey-list) to get your api key

2

Configure MCP Server

According to the client you’re using, **choose the corresponding installation method from the options below**.

### [​](https://docs.z.ai/devpack/mcp/zread-mcp-server\#supported-clients)  Supported Clients

- Claude Code

- Cline (VS Code)

- OpenCode

- Crush

- Goose

- Roo Code, Kilo Code, Others


**One-click install command**Replace `your_api_key` with the API key you obtained in the previous step

```
claude mcp add -s user -t http zread https://api.z.ai/api/mcp/zread/mcp --header "Authorization: Bearer your_api_key"
```

**Manual configuration**Edit the Claude Code configuration file under your home directory, the MCP section of `.claude.json`:

```
{
  "mcpServers": {
    "zread": {
      "type": "http",
      "url": "https://api.z.ai/api/mcp/zread/mcp",
      "headers": {
        "Authorization": "Bearer your_api_key"
      }
    }
  }
}
```

Add the MCP server configuration in the Cline extension settings:Replace `your_api_key` with the API key you obtained in the previous step

```
{
  "mcpServers": {
    "zread": {
      "type": "streamableHttp",
      "url": "https://api.z.ai/api/mcp/zread/mcp",
      "headers": {
        "Authorization": "Bearer your_api_key"
      }
    }
  }
}
```

If Cline older version does not support StreamableHttp type MCP server, you can use SSE type configuration:

```
{
  "mcpServers": {
    "zread": {
      "type": "sse",
      "url": "https://api.z.ai/api/mcp/zread/sse?Authorization=your_api_key"
    }
  }
}
```

Add the MCP server configuration in OpenCode settings:See the [OpenCode MCP documentation](https://opencode.ai/docs/mcp-servers)Replace `your_api_key` with the API key you obtained in the previous step

```
{
    "$schema": "https://opencode.ai/config.json",
    "mcp": {
        "zread": {
            "type": "remote",
            "url": "https://api.z.ai/api/mcp/zread/mcp",
            "headers": {
                "Authorization": "Bearer your_api_key"
            }
        }
    }
}
```

Add the MCP server configuration in Crush settings:Replace `your_api_key` with the API key you obtained in the previous step

```
{
    "$schema": "https://charm.land/crush.json",
    "mcp": {
        "zread": {
            "type": "http",
            "url": "https://api.z.ai/api/mcp/zread/mcp",
            "headers": {
                "Authorization": "Bearer your_api_key"
            }
        }
    }
}
```

Not support Goose now，refer [Issue](https://github.com/block/goose/issues/6576)Add the MCP server in Goose:Go to `Extensions` -\> `Add custom extension`Set Extension Name to `zread`, Type to `HTTP`, and use the following endpoint:

```
https://api.z.ai/api/mcp/zread/mcp
```

Set Request Headers Add `Authorization` : `your_api_key`Click `Add Extension` at the bottom. Remember to replace `your_api_key` with the API key you obtained in the previous step.

For Roo Code, Kilo Code, and other MCP-compatible clients, use the following general configuration:Replace `your_api_key` with the API key you obtained in the previous step

```
{
  "mcpServers": {
    "zread": {
      "type": "streamable-http",
      "url": "https://api.z.ai/api/mcp/zread/mcp",
      "headers": {
        "Authorization": "Bearer your_api_key"
      }
    }
  }
}
```

## [​](https://docs.z.ai/devpack/mcp/zread-mcp-server\#troubleshooting)  Troubleshooting

Invalid access token

**Issue:** Received an invalid access token error**Solutions:**

1. Verify the token was copied correctly
2. Check that the token is activated
3. Ensure the token has sufficient balance
4. Confirm the Authorization header format is correct

Connection timeout

**Issue:** Connection to the MCP server timed out**Solutions:**

1. Check your network connection
2. Verify firewall settings
3. Ensure the server URL is correct
4. Increase client timeout settings

Repository access failed

**Issue:** Unable to search or read specified repository content**Solutions:**

1. Confirm the repository exists and is open source (public)
2. Check if the repository name is spelled correctly (owner/repo)
3. Visit zread.ai to search if this open source repository is supported

## [​](https://docs.z.ai/devpack/mcp/zread-mcp-server\#resources)  Resources

- [Model Context Protocol (MCP) Documentation](https://modelcontextprotocol.io/)
- [Claude Code MCP Configuration Guide](https://docs.anthropic.com/en/docs/claude-code/mcp)
- [MCP Usage Limits](https://docs.z.ai/devpack/overview#usage-instruction)
- [GLM Coding Plan Overview](https://docs.z.ai/devpack/overview)

Was this page helpful?

YesNo

[Web Reader MCP Server](https://docs.z.ai/devpack/mcp/reader-mcp-server) [Plan Update Announcement](https://docs.z.ai/devpack/notice/usage-revision)

Ctrl+I

[x](https://x.com/Zai_org) [github](https://github.com/zai-org) [discord](https://discord.gg/QR7SARHRxK) [linkedin](https://www.linkedin.com/company/zdotai)

[Powered byThis documentation is built and hosted on Mintlify, a developer documentation platform](https://www.mintlify.com/?utm_campaign=poweredBy&utm_medium=referral&utm_source=zhipu-32152247)