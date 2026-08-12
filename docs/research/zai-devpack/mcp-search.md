> Source: 
> Scraped: 2026-08-12 via firecrawl

> ## Documentation Index
>
> Fetch the complete documentation index at: [/llms.txt](https://docs.z.ai/llms.txt)
>
> Use this file to discover all available pages before exploring further.

[Skip to main content](https://docs.z.ai/devpack/mcp/search-mcp-server#content-area)

[Overview - Z.AI DEVELOPER DOCUMENT home page![light logo](https://mintcdn.com/zhipu-32152247/B_E8wI-eiNa1QlPV/logo/dark.svg?fit=max&auto=format&n=B_E8wI-eiNa1QlPV&q=85&s=75deefa9dea5bdbc84d4da68885c267f)![dark logo](https://mintcdn.com/zhipu-32152247/B_E8wI-eiNa1QlPV/logo/light.svg?fit=max&auto=format&n=B_E8wI-eiNa1QlPV&q=85&s=c1ecf1af358fa8eeab8c06052337f8f6)](https://z.ai/model-api)

English

Search...

Ctrl K

- [API Keys](https://z.ai/manage-apikey/apikey-list)
- [Payment Method](https://z.ai/manage-apikey/billing)

Search...

Navigation

MCP Integration

Web Search MCP Server

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

- [Features](https://docs.z.ai/devpack/mcp/search-mcp-server#features)
- [Supported Tools](https://docs.z.ai/devpack/mcp/search-mcp-server#supported-tools)
- [Installation and Usage](https://docs.z.ai/devpack/mcp/search-mcp-server#installation-and-usage)
  - [Quick Start](https://docs.z.ai/devpack/mcp/search-mcp-server#quick-start)
  - [Supported Clients](https://docs.z.ai/devpack/mcp/search-mcp-server#supported-clients)
- [Usage Example](https://docs.z.ai/devpack/mcp/search-mcp-server#usage-example)
- [Troubleshooting](https://docs.z.ai/devpack/mcp/search-mcp-server#troubleshooting)
- [Related Resources](https://docs.z.ai/devpack/mcp/search-mcp-server#related-resources)

MCP Integration

# Web Search MCP Server

Copy pageCopy page

Copy pageCopy page

The Web Search MCP Server is an exclusive Remote MCP Server developed by Z.AI for GLM Coding Plan users. Built on the Model Context Protocol (MCP), it connects to search capabilities to provide web search and real-time information retrieval for MCP-compatible clients, including Claude Code and Cline.

## [​](https://docs.z.ai/devpack/mcp/search-mcp-server\#features)  Features

## Web Search

Supports comprehensive web search to retrieve the latest web information and resources

## Real-time Information

Retrieves real-time updated information including news, stock prices, weather, and more

## Remote Service

HTTP protocol-based remote MCP service, no local installation required

## [​](https://docs.z.ai/devpack/mcp/search-mcp-server\#supported-tools)  Supported Tools

This server implements the Model Context Protocol and can be used with any MCP-compatible client. Currently provides the following tools:

- **`webSearchPrime`** \- Search web information, returning results including page titles, URLs, summaries, site names, site icons, and more.

## [​](https://docs.z.ai/devpack/mcp/search-mcp-server\#installation-and-usage)  Installation and Usage

### [​](https://docs.z.ai/devpack/mcp/search-mcp-server\#quick-start)  Quick Start

1

Get API Key

Visit [Z.AI Console](https://z.ai/manage-apikey/apikey-list) to get your api key

2

Configure MCP Server

According to the client you’re using, **choose the corresponding installation method from the options below**.

### [​](https://docs.z.ai/devpack/mcp/search-mcp-server\#supported-clients)  Supported Clients

- Claude Code

- Cline (VS Code)

- OpenCode

- Crush

- Goose

- Roo Code, Kilo Code and Other MCP Clients


**One-click Installation Command**Be sure to replace `your_api_key` with the API Key you obtained.

```
claude mcp add -s user -t http web-search-prime https://api.z.ai/api/mcp/web_search_prime/mcp --header "Authorization: Bearer your_api_key"
```

**Manual Configuration**Edit Claude Code’s configuration file `.claude.json` in the user directory, MCP section:

```
{
  "mcpServers": {
    "web-search-prime": {
      "type": "http",
      "url": "https://api.z.ai/api/mcp/web_search_prime/mcp",
      "headers": {
        "Authorization": "Bearer your_api_key"
      }
    }
  }
}
```

Add MCP server configuration in Cline extension settings:Be sure to replace `your_api_key` with the API Key you obtained.

```
{
  "mcpServers": {
    "web-search-prime": {
      "type": "streamableHttp",
      "url": "https://api.z.ai/api/mcp/web_search_prime/mcp",
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
    "web-search-prime": {
      "type": "sse",
      "url": "https://api.z.ai/api/mcp/web_search_prime/sse?Authorization=your_api_key"
    }
  }
}
```

Add MCP server configuration in OpenCode settings:Refer [OpenCode MCP Doc](https://opencode.ai/docs/mcp-servers)Be sure to replace `your_api_key` with the API Key you obtained.

```
{
    "$schema": "https://opencode.ai/config.json",
    "mcp": {
        "web-search-prime": {
            "type": "remote",
            "url": "https://api.z.ai/api/mcp/web_search_prime/mcp",
            "headers": {
                "Authorization": "Bearer your_api_key"
            }
        }
    }
}
```

Add MCP server configuration in Crush settings:Be sure to replace `your_api_key` with the API Key you obtained.

```
{
    "$schema": "https://charm.land/crush.json",
    "mcp": {
        "web-search-prime": {
            "type": "http",
            "url": "https://api.z.ai/api/mcp/web_search_prime/mcp",
            "headers": {
                "Authorization": "Bearer your_api_key"
            }
        }
    }
}
```

Not support Goose now，refer [Issue](https://github.com/block/goose/issues/6576)Add MCP server configuration in Goose settings:Click `Extensions` -\> `Add custom extension`Set `Extension Name` is `web-search-prime`，`Type` switch `HTTP`，`Endpoint` as follow：

```
https://api.z.ai/api/mcp/web_search_prime/mcp
```

Set Request Headers Add `Authorization` : `your_api_key`Finally, click `Add Extension` at the bottom. Remember to replace your\_api\_key with the API Key you obtained in the previous step.

For Roo Code, Kilo Code and other clients that support MCP protocol, use the following general configuration:Be sure to replace `your_api_key` with the API Key you obtained.

```
{
  "mcpServers": {
    "web-search-prime": {
      "type": "streamable-http",
      "url": "https://api.z.ai/api/mcp/web_search_prime/mcp",
      "headers": {
        "Authorization": "Bearer your_api_key"
      }
    }
  }
}
```

## [​](https://docs.z.ai/devpack/mcp/search-mcp-server\#usage-example)  Usage Example

Through the previous step of installing the Search MCP server to the client, you can directly use MCP in your Coding client.

You can directly use search functionality in conversations:

- “Help me search for the latest AI technology developments”
- “Find best practices for Python asynchronous programming”

## [​](https://docs.z.ai/devpack/mcp/search-mcp-server\#troubleshooting)  Troubleshooting

Invalid API Key

**Issue:** Receiving invalid api key error**Solutions:**

1. Confirm the api key is correctly copied
2. Check if the api key is activated
3. Confirm the api key has sufficient balance
4. Check if the Authorization header format is correct

Connection Timeout

**Issue:** MCP server connection timeout**Solutions:**

1. Check network connection
2. Confirm firewall settings
3. Verify the server URL is correct
4. Increase timeout settings

Empty Search Results

**Issue:** Search returns empty results**Solutions:**

1. Try using different search keywords
2. Check if the search query is too specific
3. Confirm network connection is normal
4. Contact technical support for assistance

## [​](https://docs.z.ai/devpack/mcp/search-mcp-server\#related-resources)  Related Resources

- [Model Context Protocol (MCP) Official Documentation](https://modelcontextprotocol.io/)
- [Claude Code MCP Configuration Guide](https://docs.anthropic.com/en/docs/claude-code/mcp)
- [MCP Usage Limits](https://docs.z.ai/devpack/overview#usage-instruction)
- [GLM Coding Plan Overview](https://docs.z.ai/devpack/overview)

Was this page helpful?

YesNo

[Vision MCP Server](https://docs.z.ai/devpack/mcp/vision-mcp-server) [Web Reader MCP Server](https://docs.z.ai/devpack/mcp/reader-mcp-server)

Ctrl+I

[x](https://x.com/Zai_org) [github](https://github.com/zai-org) [discord](https://discord.gg/QR7SARHRxK) [linkedin](https://www.linkedin.com/company/zdotai)

[Powered byThis documentation is built and hosted on Mintlify, a developer documentation platform](https://www.mintlify.com/?utm_campaign=poweredBy&utm_medium=referral&utm_source=zhipu-32152247)