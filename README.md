# Oracle FCC MCP Server

An MCP (Model Context Protocol) server for **Oracle Financial Consolidation and Close (FCC)**. Connect any LLM (Claude, Gemini, OpenAI, Kimi) to your FCC application and perform consolidation, journal management, ownership, intercompany matching, and data operations in plain English.

## Features

- **24 tools** covering all FCC operations:
  - Consolidation & Close (run consolidation, check status, manage periods)
  - Data Management (export, MDX queries, cell write-back, bulk import)
  - Journals (create, submit, approve, post, reject)
  - Ownership Management (get/update ownership percentages and methods)
  - Intercompany (list transactions, match/unmatch/dispute)
  - Metadata (dimensions, members, substitution variables)
- **Multi-tenant support** — switch between production, UAT, and dev environments
- **Two auth methods** — Basic Auth and OAuth 2.0 Device Code Flow (MFA-compatible)
- **Works with any LLM client** — Claude Desktop, Cursor, Gemini CLI, OpenAI Agents

## Prerequisites

- Node.js 18+
- Access to an Oracle EPM FCC Cloud environment

## Installation

```bash
git clone https://github.com/your-org/oracle-fcc-mcp.git
cd oracle-fcc-mcp
npm install
npm run build
```

## Configuration

### Single-tenant (Basic Auth)

Copy `.env.example` to `.env` and fill in your values:

```env
FCC_URL=https://myenv-mycompany.epm.us2.oraclecloud.com
FCC_APP_NAME=MyFCCApp
FCC_AUTH_METHOD=basic
FCC_USERNAME=user@company.com
FCC_PASSWORD=YourPassword123
```

### Single-tenant (OAuth — MFA environments)

```env
FCC_URL=https://myenv-mycompany.epm.us2.oraclecloud.com
FCC_APP_NAME=MyFCCApp
FCC_AUTH_METHOD=oauth
FCC_IDCS_URL=https://idcs-xxx.identity.oraclecloud.com
FCC_CLIENT_ID=your_client_id
FCC_CLIENT_SECRET=your_client_secret
```

### Multi-tenant

Copy `tenants.example.json` to `tenants.json`, fill in your environments, then:

```env
FCC_TENANTS_CONFIG=C:/path/to/tenants.json
```

## LLM Client Setup

### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "oracle-fcc": {
      "command": "node",
      "args": ["C:/Claude Projects/oracle-fcc-mcp/dist/index.js"],
      "env": {
        "FCC_URL": "https://myenv.epm.us2.oraclecloud.com",
        "FCC_APP_NAME": "FCC_PROD",
        "FCC_AUTH_METHOD": "basic",
        "FCC_USERNAME": "user@company.com",
        "FCC_PASSWORD": "..."
      }
    }
  }
}
```

Or with a tenants file:

```json
{
  "mcpServers": {
    "oracle-fcc": {
      "command": "node",
      "args": ["C:/Claude Projects/oracle-fcc-mcp/dist/index.js"],
      "env": {
        "FCC_TENANTS_CONFIG": "C:/path/to/tenants.json"
      }
    }
  }
}
```

### Cursor / VS Code (Copilot)

Add to `.cursor/mcp.json` or workspace MCP settings:

```json
{
  "oracle-fcc": {
    "command": "node",
    "args": ["C:/Claude Projects/oracle-fcc-mcp/dist/index.js"],
    "env": { "FCC_TENANTS_CONFIG": "C:/path/to/tenants.json" }
  }
}
```

### Gemini CLI / OpenAI Agents SDK

Same stdio transport — configure using the same `command` + `args` + `env` pattern in your MCP client settings.

## Usage Examples

Once connected, ask your LLM in natural English:

```
"Run consolidation for Total Geography for January 2024, Actual scenario"
→ fcc_run_consolidation(entity="Total Geography", period="Jan", year="FY2024", scenario="Actual")

"Show me the Q1 2024 revenue for all US entities"
→ fcc_export_data(entity="US Holdings", scenario="Actual", period=["Jan","Feb","Mar"], year="FY2024", accounts=["Revenue"])

"List all unmatched intercompany transactions for January"
→ fcc_get_ic_transactions(period="Jan", year="FY2024", match_status="Unmatched")

"Create a journal adjustment for EMEA entity, January 2024, Actual"
→ fcc_manage_journal(action="create", journal_label="EMEA_ADJ_Jan24", period="Jan", year="FY2024", ...)

"What is the ownership percentage for Germany subsidiary?"
→ fcc_get_ownership(entity="DE001", period="Jan", year="FY2024", scenario="Actual")

"Update CurPeriod to Feb and CurYear to FY2024"
→ fcc_set_substitution_variables(variables=[{name:"CurPeriod",value:"Feb"},{name:"CurYear",value:"FY2024"}])
```

## OAuth Authentication Flow

For MFA-enabled environments, the first call to `fcc_test_connection` will return a verification URL and code:

1. Open the URL shown in the response
2. Enter the code and complete MFA
3. Call `fcc_complete_oauth` with the `device_code` to finalize

The token is then cached and auto-refreshed for the session.

## Available Tools

| Tool | Category | Description |
|------|----------|-------------|
| `fcc_list_tenants` | Connection | List configured environments |
| `fcc_test_connection` | Connection | Test connection + OAuth flow |
| `fcc_complete_oauth` | Connection | Complete OAuth after user authenticates |
| `fcc_get_app_info` | Connection | Get app dimensions and plan types |
| `fcc_run_consolidation` | Consolidation | Run consolidation/translate/calculate-all |
| `fcc_get_consolidation_status` | Consolidation | Check cell consolidation status |
| `fcc_run_calculation` | Consolidation | Run business rules/calculation |
| `fcc_get_period_status` | Consolidation | Get period open/close status |
| `fcc_manage_period` | Consolidation | Open, close, or lock a period |
| `fcc_export_data` | Data | Export data slice (grid definition) |
| `fcc_query_mdx` | Data | Execute MDX query |
| `fcc_write_data` | Data | Write cell-level data (importdataslice) |
| `fcc_import_data` | Data | Bulk file import (IMPORT_DATA job) |
| `fcc_manage_journal` | Journals | Create/list/submit/approve/post/reject journals |
| `fcc_get_journal` | Journals | Get journal details with line items |
| `fcc_get_ownership` | Ownership | Get entity ownership data |
| `fcc_update_ownership` | Ownership | Update ownership percentages/methods |
| `fcc_get_entity_hierarchy` | Ownership | Browse entity consolidation hierarchy |
| `fcc_get_ic_transactions` | Intercompany | List IC transactions |
| `fcc_manage_ic_matching` | Intercompany | Match/unmatch/dispute IC transactions |
| `fcc_list_dimensions` | Metadata | List all FCC dimensions |
| `fcc_get_members` | Metadata | Get dimension members |
| `fcc_get_substitution_variables` | Metadata | Get substitution variable values |
| `fcc_set_substitution_variables` | Metadata | Update substitution variables |
| `fcc_run_job` | Jobs | Generic job runner |

## Notes on FCC-Specific Endpoints

Some FCC operations (journals, ownership, intercompany) use endpoints that vary between FCC versions and tenants. The server includes graceful error messages guiding you to the correct endpoint when it cannot be auto-detected. Reference:

- [Oracle EPM FCC REST API Documentation](https://docs.oracle.com/en/cloud/saas/enterprise-performance-management-common/prest/GUID-185E11F9-8420-414A-B2EA-9098767FC24F.pdf)

## License

MIT
