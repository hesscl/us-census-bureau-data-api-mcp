# U.S. Census Bureau Data API MCP
[![License: CC0-1.0](https://img.shields.io/badge/License-CC0%201.0-lightgrey.svg)](https://github.com/uscensusbureau/us-census-bureau-data-api-mcp/blob/main/LICENSE)

Bringing _official_ Census Bureau statistics to AI assistants everywhere.

The *U.S. Census Bureau Data API MCP* is a [Model Context Protocol (MCP)](https://modelcontextprotocol.io/introduction) server that connects AI assistants with data from the Census Data API and other official Census Bureau sources. This project is built using the [MCP Typescript SDK](https://github.com/modelcontextprotocol/typescript-sdk).

## Contents
* [Getting Started](#getting-started)
* [Using the MCP Server](#using-the-mcp-server)
* [How the MCP Server Works](#how-the-mcp-server-works)
* [Development](#development)
* [MCP Server Architecture](#mcp-server-architecture)
* [Available Methods](#available-methods)
* [Available Tools](#available-tools)
* [Available Prompts](#available-prompts)
* [Helper Scripts](#helper-scripts)
* [Additional Information](#additional-information)

## Getting Started
To get started, you will need:

* A valid Census Bureau [Data API key](https://api.census.gov/data/key_signup.html)
* Node 18+

That's it — no Docker, no PostgreSQL.

## Using the MCP Server
1. Clone or download the project locally.
2. Navigate to `mcp-server/` and run `npm install && npm run build`.
3. Configure your AI assistant to use the MCP server (see below).
4. Start your AI assistant.

### Claude Code

Add the following to `~/.claude/settings.json` under the `mcpServers` key, updating the path and API key:

```json
{
  "mcpServers": {
    "mcp-census-api": {
      "command": "node",
      "args": [
        "/Path/To/us-census-bureau-data-api-mcp/mcp-server/dist/index.js"
      ],
      "env": {
        "CENSUS_API_KEY": "YOUR_CENSUS_API_KEY"
      }
    }
  }
}
```

You can also add it via the CLI:

```bash
claude mcp add mcp-census-api \
  -e CENSUS_API_KEY=YOUR_CENSUS_API_KEY \
  -- node /Path/To/us-census-bureau-data-api-mcp/mcp-server/dist/index.js
```

### Claude Desktop

Add the following to your Claude Desktop config file, updating the path and API key:

* **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
* **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "mcp-census-api": {
      "command": "node",
      "args": [
        "/Path/To/us-census-bureau-data-api-mcp/mcp-server/dist/index.js"
      ],
      "env": {
        "CENSUS_API_KEY": "YOUR_CENSUS_API_KEY"
      }
    }
  }
}
```

Restart Claude Desktop after saving the config.

### Updating the MCP Server
When a new version is released, pull the latest changes and rebuild:

```bash
git pull
cd mcp-server
npm install && npm run build
```

Then relaunch your MCP Client.

## How the MCP Server Works

The U.S. Census Bureau Data API MCP server uses data from the Census Data API and other official sources to construct contextually rich responses for AI Assistants. The Census Data API is the primary source of data. Geography and dataset metadata is served from a bundled SQLite database (`mcp-server/data/census.db`) that enables fast, offline-capable fuzzy search without any infrastructure setup.

![Illustration of how the MCP Server works, starting with a user prompt, processing by an AI Assistant, tool or resource calls to the U.S. Census Bureau Data API MCP server, and finally queries to the local SQLite database or the Census Data API.](/us-census-burea-mcp-server-flow.jpg)

## Development

Navigate to `mcp-server/` and run `npm install && npm run build` to get started.

By default, all logging functions are disabled in the `mcp-server` to prevent JSON validation errors when interacting with the MCP server through MCP clients. To enable logging for development purposes, set `DEBUG_LOGS=true`, e.g.:

```bash
echo '{CALL_ARGUMENTS}' | DEBUG_LOGS=true CENSUS_API_KEY=YOUR_KEY node dist/index.js
```

### Rebuilding the SQLite database

The bundled `census.db` is pre-built and checked into the repo. If you need to regenerate it:

```bash
cd mcp-server
npm run build:db
```

This runs `scripts/build-sqlite.mjs` and writes a new `data/census.db`.

### Testing

This project uses [Vitest](https://vitest.dev/) to test the MCP Server. Tests run against the bundled SQLite database — no Docker or API key required for the test suite.

To run tests, navigate to `mcp-server/` and run:

```bash
npm run test
```

To run only unit tests or only integration tests:

```bash
npx vitest run --project unit
npx vitest run --project integration
```

A valid `CENSUS_API_KEY` is only needed for the live-API integration tests (`fetch-aggregate-data`, `fetch-time-series`, and `list-datasets`). All other tests run fully offline.

To run ESLint:

```bash
npm run lint
```

## MCP Server Architecture

* `mcp-server/src/` - Source code for the MCP Server.
* `mcp-server/src/index.ts` - Starts the MCP Server and registers tools.
* `mcp-server/src/server.ts` - Defines the `McpServer` class that handles calls to the server.
* `mcp-server/src/tools/` - Tool definitions and shared classes (e.g. `BaseTool`).
* `mcp-server/src/schema/` - Zod schemas for each tool's inputs and API responses.
* `mcp-server/src/services/database.service.ts` - SQLite singleton that powers geography and dataset search.
* `mcp-server/data/census.db` - Bundled SQLite database (~23 MB) containing geography, summary level, and dataset metadata.
* `mcp-server/scripts/build-sqlite.mjs` - Script to regenerate `census.db`.

## Available Methods

The MCP server exposes several methods: `tools/list`, `tools/call`, `prompts/list`, and `prompts/get`.

## Available Tools
This section covers tools that can be called.

### List Datasets
The `list-datasets` tool fetches metadata for all datasets available in the Census Bureau's API. It accepts the following arguments:
* Keyword (Optional) - Filter results to datasets whose title or identifier contains this text (case-insensitive), e.g. `income`, `housing`, `business patterns`

### Fetch Dataset Geography
The `fetch-dataset-geography` tool fetches available geography levels for a given dataset. It accepts the following arguments:
* Dataset (Required) - The identifier of the dataset, e.g. `'acs/acs1'`
* Year (Optional) - The vintage of the dataset, e.g. `1987`

### Fetch Aggregate Data
The `fetch-aggregate-data` tool fetches aggregate data from the Census Bureau's API. It accepts the following arguments:
* Dataset (Required) - The identifier of the dataset, e.g. `'acs/acs1'`
* Year (Required) - The vintage of the dataset, e.g. `1987`
* Get (Required) - An object with 2 optional sub-arguments:
	* Variables (Optional) - An array of variables, e.g. `'NAME'`, `'B01001_001E'`
	* Group (Optional) - A string returning a collection of variables, e.g. `S0101`
* For (Optional) - Restricts geography to various levels
* In (Optional) - Restricts geography to smaller areas than state level
* UCGID (Optional) - Restricts geography by Uniform Census Geography Identifier, e.g. `0400000US41`
* Predicates (Optional) - Filter options for the dataset
* Descriptive (Optional) - Adds variable labels to the API response (default: `false`)
* Format (Optional) - Output format: `text` (default, KEY: VALUE lines) or `json` (structured object with dataset, year, data array, and citation)

### Resolve Geography FIPS
The `resolve-geography-fips` tool searches across all Census Bureau geographies and returns potential matches with FIPS codes and query parameters. It accepts the following arguments:
* Geography Name (Required) - The name of the geography to search, e.g. `Philadelphia`
* Summary Level (Optional) - Filter by summary level name or code, e.g. `Place`, `160`

### Search Data Tables
The `search-data-tables` tool searches the Census Bureau's available data tables by ID or label. It accepts the following arguments:
* Data Table ID (Optional) - Full or prefix table ID, e.g. `B01001`
* Label Query (Optional) - Fuzzy label search, e.g. `median household income`
* Dataset ID (Optional) - Scope results to a specific dataset

### List Variables
The `list-variables` tool lists available variable codes inside a Census Bureau table group. Use this tool after finding a table group ID with `search-data-tables` and before calling `fetch-aggregate-data`, so you know which variable codes to request. It requires no API key. It accepts the following arguments:
* Dataset (Required) - The identifier of the dataset, e.g. `acs/acs5`
* Year (Required) - The vintage of the dataset, e.g. `2022`
* Group (Required) - Table group ID, e.g. `B01001` or `S0101`
* Label Query (Optional) - Filter variables by label text (case-insensitive substring match)
* Limit (Optional) - Maximum number of variables to return (default: 50)

### Search Variables
The `search-variables` tool finds Census variable codes by concept or label within a specific dataset and year in a single call. Use this instead of calling `search-data-tables` then `list-variables` separately. It searches table groups matching your query and returns variable codes with labels ready to pass to `fetch-aggregate-data`. It requires no API key. It accepts the following arguments:
* Dataset (Required) - The identifier of the dataset, e.g. `acs/acs5`
* Year (Required) - The vintage of the dataset, e.g. `2023`
* Label Query (Required) - Concept or label search term, e.g. `median household income`, `bachelor degree`
* Limit (Optional) - Maximum number of variable results to return (default: 20, max: 100)

### Fetch Time Series
The `fetch-time-series` tool fetches the same Census variables across multiple years in parallel, enabling trend analysis. Use this when comparing or tracking Census data over time. Accepts the same dataset, variables/group, and geography parameters as `fetch-aggregate-data`, but takes a list of years instead of a single year. Returns results year-by-year with a combined citation. It accepts the following arguments:
* Dataset (Required) - The identifier of the dataset, e.g. `acs/acs5`
* Years (Required) - List of vintage years to fetch (1–20 years), e.g. `[2019, 2021, 2023]`
* Get (Required) - An object with 2 optional sub-arguments:
	* Variables (Optional) - An array of variables, e.g. `'B19013_001E'`
	* Group (Optional) - A string returning a collection of variables, e.g. `B19013`
* For (Optional) - Restricts geography to various levels
* In (Optional) - Restricts geography to smaller areas than state level
* UCGID (Optional) - Restricts geography by Uniform Census Geography Identifier, e.g. `0400000US41`
* Predicates (Optional) - Filter options for the dataset
* Descriptive (Optional) - Adds variable labels to the API response (default: `false`)

## Available Prompts
Prompts are pre-built instruction templates that tell the model to work with specific tools. They are instructions, not constraints on server capability.

### Population
The `get_population_data` prompt retrieves population statistics for US states, counties, cities, and other geographic areas. It resolves geographic names to FIPS codes before fetching data. This prompt accepts the following argument:
- `geography_name` (required): Name of the geographic area (state, county, city, etc.)

### Income
The `get_income_data` prompt retrieves income and poverty statistics for any US geographic area. It guides the model to look for median household income (B19013), poverty status (B17001), and income distribution (B19001) tables via ACS. This prompt accepts the following argument:
- `geography_name` (required): Name of the geographic area (state, county, city, etc.)

### Housing
The `get_housing_data` prompt retrieves housing statistics for any US geographic area. It guides the model to look for housing units (B25001), tenure/ownership (B25003), median rent (B25064), and median home value (B25077) tables via ACS. This prompt accepts the following argument:
- `geography_name` (required): Name of the geographic area (state, county, city, etc.)

### Demographic
The `get_demographic_data` prompt retrieves demographic statistics for any US geographic area. It guides the model to look for sex by age (B01001), race (B02001), and Hispanic/Latino origin (B03003) tables via ACS. This prompt accepts the following argument:
- `geography_name` (required): Name of the geographic area (state, county, city, etc.)

### Education
The `get_education_data` prompt retrieves educational attainment statistics for any US geographic area. It guides the model to look for educational attainment (B15003) and subject table S1501 via ACS. This prompt accepts the following argument:
- `geography_name` (required): Name of the geographic area (state, county, city, etc.)

### Employment
The `get_employment_data` prompt retrieves employment statistics for any US geographic area. It guides the model to look for employment status (B23025), occupation (B24022), and industry (B08126) tables via ACS. This prompt accepts the following argument:
- `geography_name` (required): Name of the geographic area (state, county, city, etc.)

## Helper Scripts

For easier command-line usage, this project includes bash helper scripts in the `scripts/dev` directory.

## Additional Information
For more information about parameters and available predicates, review the Census Bureau's [API documentation](https://www.census.gov/data/developers/guidance/api-user-guide.Core_Concepts.html#list-tab-559651575).
