> Source: 
> Scraped: 2026-08-12 via firecrawl

> ## Documentation Index
>
> Fetch the complete documentation index at: [/llms.txt](https://docs.z.ai/llms.txt)
>
> Use this file to discover all available pages before exploring further.

[Skip to main content](https://docs.z.ai/devpack/teamplan#content-area)

[Overview - Z.AI DEVELOPER DOCUMENT home page![light logo](https://mintcdn.com/zhipu-32152247/B_E8wI-eiNa1QlPV/logo/dark.svg?fit=max&auto=format&n=B_E8wI-eiNa1QlPV&q=85&s=75deefa9dea5bdbc84d4da68885c267f)![dark logo](https://mintcdn.com/zhipu-32152247/B_E8wI-eiNa1QlPV/logo/light.svg?fit=max&auto=format&n=B_E8wI-eiNa1QlPV&q=85&s=c1ecf1af358fa8eeab8c06052337f8f6)](https://z.ai/model-api)

English

Search...

Ctrl K

- [API Keys](https://z.ai/manage-apikey/apikey-list)
- [Payment Method](https://z.ai/manage-apikey/billing)

Search...

Navigation

GLM Coding Plan

Team Plan Benefits

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

- [Exclusive Capabilities](https://docs.z.ai/devpack/teamplan#exclusive-capabilities)
- [Usage Details](https://docs.z.ai/devpack/teamplan#usage-details)
  - [Usage Credit Allowance](https://docs.z.ai/devpack/teamplan#usage-credit-allowance)
  - [Credit Calculation](https://docs.z.ai/devpack/teamplan#credit-calculation)
  - [Estimated Token Allowance](https://docs.z.ai/devpack/teamplan#estimated-token-allowance)
- [Team Plan Key](https://docs.z.ai/devpack/teamplan#team-plan-key)
- [Seat Rules](https://docs.z.ai/devpack/teamplan#seat-rules)
- [Subscription Changes](https://docs.z.ai/devpack/teamplan#subscription-changes)
- [Account Usage Rules](https://docs.z.ai/devpack/teamplan#account-usage-rules)
- [FAQ](https://docs.z.ai/devpack/teamplan#faq)
- [Next Steps](https://docs.z.ai/devpack/teamplan#next-steps)

GLM Coding Plan

# Team Plan Benefits

Copy pageCopy page

Learn about GLM Coding Team Plan usage quotas, benefits, and usage rules

Copy pageCopy page

GLM Coding Team Plan is a self-service subscription for enterprises and development teams. Building on the individual plan’s generous access to Z.AI’s top-tier models and broad coding tool compatibility, it adds flexible organization management, enterprise-grade data security, and centralized billing and invoicing—helping teams scale AI coding efficiently with predictable costs.

## [​](https://docs.z.ai/devpack/teamplan\#exclusive-capabilities)  Exclusive Capabilities

- **Centralized seat and access management**: Manage seats, roles, and permissions in one place, with clear visibility into personnel changes, access updates, and resource usage.
- **Team usage and productivity insights**: Track usage and consumption trends by member and time period to better understand AI adoption and productivity gains.
- **on-demand usage overage and budget control**: Keep services running after the included quota is used by enabling on-demand usage overage. Set per-member spending limits to protect key projects and prevent unexpected costs from high-frequency usage.


( _Limited-time offer: Overage usage is billed at a 10% discount from the model API list price._)
- **Centralized billing and invoicing**: Consolidate billing, invoicing, and reconciliation across the organization. Verified enterprises can request special VAT invoices, reducing finance and reimbursement overhead.
- **Data is not used for model training by default**: Code, prompts, conversations, and related content are excluded from model training by default, helping protect your organization’s core R&D assets.
- **Early access to new flagship models and features ( _Premium Seat only_)**: Get priority access to the latest models to help teams continuously improve their AI coding experience and development efficiency.
- **Priority access during peak hours ( _Premium Seat only_)**: Benefit from more reliable resource allocation and response times during periods of high demand, with fewer delays, rate limits, and productivity disruptions.

## [​](https://docs.z.ai/devpack/teamplan\#usage-details)  Usage Details

### [​](https://docs.z.ai/devpack/teamplan\#usage-credit-allowance)  Usage Credit Allowance

Each plan is subject to both a 5-hour usage limit and a weekly usage limit. You can check your quota consumption progress in [Usage Statistics](https://z.ai/manage-apikey/coding-plan/team/usage-stats).

| Plan Type | 5-Hour Credits | Weekly Credits |
| --- | --- | --- |
| Standard Seat | 15,000 | 66,000 |
| Premium Seat | 35,000 | 155,000 |

**Credit Reset Rules**

- **5-hour credits**: Dynamically refreshed; credit quota resets 5 hours after consumption.
- **Weekly credits**: Activated upon subscription; resets every 7 days.

### [​](https://docs.z.ai/devpack/teamplan\#credit-calculation)  Credit Calculation

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

**During off-peak hours, model usage is charged at 50% of the standard credit rate.**

**Peak hours**: Monday to Friday, 14:00–18:00 Singapore Standard Time (UTC+8).

### [​](https://docs.z.ai/devpack/teamplan\#estimated-token-allowance)  Estimated Token Allowance

Assuming all usage is on GLM-5.2 and the cache hit rate is 90.9%—the average level for coding workloads—the estimated weekly token allowance for each plan tier is approximately:

- Standard Seat: 289M–578 million tokens/week
- Premium Seat: 679M–1357 million tokens/week

**How the Range Is Calculated**

- Maximum token allowance: All usage occurs during off-peak hours and is charged at 0.5× the standard credit rate.
- Minimum token allowance: All usage occurs during peak hours and is charged at 1× the standard credit rate.

By making full use of the off-peak benefit, you can **save up to 92%** compared with calling GLM-5.2 through the standard on-demand usage API.

## [​](https://docs.z.ai/devpack/teamplan\#team-plan-key)  Team Plan Key

The Team Plan Key is the dedicated access credential for the Team Plan. After each team member receives a seat assignment invitation, joins the team, and enters the [Team Plan](https://z.ai/manage-apikey/coding-plan/team/my-plan) page in the console, they can obtain their own Key.

Please note that the **Team Plan Key is independent from other platform API Keys**. To use your Team Plan quota, make sure to use the Team Plan Key in the relevant scenarios.

## [​](https://docs.z.ai/devpack/teamplan\#seat-rules)  Seat Rules

Team plans are subscribed to and assigned by seat:

1. A minimum of 2 seats is required, with no upper limit on the number of seats
2. Members and seats follow a 1:1 relationship; multiple members cannot share the same seat
3. Mixed purchases of Standard Seat and Premium Seat are not currently supported
4. Administrators can reassign seats during the validity period of the plan benefits
5. The seat validity period is the same as the validity period of the plan benefits. After the plan expires, all seat benefits will also expire

## [​](https://docs.z.ai/devpack/teamplan\#subscription-changes)  Subscription Changes

**Plan changes:**

1. Continuous subscription users can cancel automatic renewal at any time and re-enable automatic renewal at any time
2. Monthly or annual purchases can be extended by purchasing the plan again
3. Upgrading from the Standard Seat to the Premium Seat is not currently supported

**Seat quantity changes:**

1. Additional seats can be added during the subscription period, with fees calculated based on the remaining time in the current billing cycle
2. Directly reducing the number of seats is not supported. To reduce seats, please purchase again after the current subscription cycle ends

## [​](https://docs.z.ai/devpack/teamplan\#account-usage-rules)  Account Usage Rules

To protect subscriber rights, ensure system fairness, and maintain service stability, GLM Coding Plan must be used in [officially supported tools and products](https://docs.z.ai/devpack/tool/others#1-coding-agent-tool), and must comply with the [Subscriptions, Fees, and Payment](https://docs.z.ai/legal-agreement/subscription-terms) and related usage rules.Improper behavior such as multiple people sharing the same seat, use in unsupported tools, or abnormally high-frequency calls may trigger platform risk control rules, resulting in corresponding restrictions on subscription benefits. In serious cases, it may affect normal account usage.

## [​](https://docs.z.ai/devpack/teamplan\#faq)  FAQ

**Q: Can the Team Plan and Individual Plan be active and used at the same time?****A:** Yes. Each user can have both an Individual Plan and a Team Plan at the same time, and can also be invited to join different teams and use the plan benefits assigned by those teams. However, within the same team, each member can only have one active Team Plan seat at a time.**Q: What happens after a seat exceeds its plan quota?****A:** Plan usage is limited separately by seat. If a seat exceeds its quota, the model cannot be used during the limit period until the next reset cycle begins. The team administrator can enable on-demand usage overage in advance. After a seat exceeds its usage quota, the service can continue to be used and will be billed based on the actual overage. When the next reset cycle begins, the seat will resume using the quota included in the plan, helping avoid business interruptions.**Q: How is concurrency limited for each Team Plan seat?****A:** Rate limits and concurrency limits are related to your plan tier, and the platform dynamically adjusts them based on available resources. Each development project can use methods such as Subagents to make concurrent model calls. Our recommended number of projects is as follows:

- Standard Seat: recommended for 1–2 concurrent development projects
- Premium Seat: recommended for 2+ concurrent development projects

During off-peak hours, plan users will enjoy higher concurrency benefits through dynamic upgrades, supporting a larger number of development projects.**Q: Does the primary administrator, meaning the account that purchases the Team Plan, occupy a seat?****A:** No. By default, the primary administrator account does not occupy a team seat. If the primary administrator needs to use the quota associated with a seat, they can assign a seat to their own account. After joining the seat, they will receive the corresponding quota.

## [​](https://docs.z.ai/devpack/teamplan\#next-steps)  Next Steps

- [Quick Start](https://docs.z.ai/devpack/quick-start): Complete the basic integration process in just a few minutes and get started quickly
- [Tool Integration](https://docs.z.ai/devpack/tool/others): View the coding tools supported by the plan and their configuration methods, and choose the development environment that best suits your needs
- [How to Switch Models](https://docs.z.ai/devpack/latest-model): Make sure your coding tool is using your target model version

Was this page helpful?

YesNo

[FAQ](https://docs.z.ai/devpack/faq) [Quick Start](https://docs.z.ai/devpack/quick-start)

Ctrl+I

[x](https://x.com/Zai_org) [github](https://github.com/zai-org) [discord](https://discord.gg/QR7SARHRxK) [linkedin](https://www.linkedin.com/company/zdotai)

[Powered byThis documentation is built and hosted on Mintlify, a developer documentation platform](https://www.mintlify.com/?utm_campaign=poweredBy&utm_medium=referral&utm_source=zhipu-32152247)