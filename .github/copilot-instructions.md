<Goals>
- Provide expert-level review of the repository's structure, technology stack, and critical patterns, with a focus on Model Context Protocol (MCP) best practices
- Highlight any non-obvious dependencies or architectural decisions that may impact code changes
- Ensure best practices are followed in terms of code organization, validation, and error handling
- Ensure architectural consistency across the codebase, especially in how MCP tools are implemented and how Census API interactions are handled
</Goals>

<HighLevelDetails>
This repository is a Model Context Protocol (MCP) server that provides AI-ready U.S. Census Bureau data.

**Technology Stack:**
- Language: TypeScript (Node.js runtime)
- API: U.S. Census Bureau API
- Database: SQLite (bundled, offline-capable geography and dataset metadata)
- Validation: Zod schemas
- Testing: Vitest
- Build: TypeScript compiler (tsc)
- Package Manager: npm

**Repository Size:** Medium-sized TypeScript project with:
- MCP server application (`mcp-server/`)
- SQLite database builder (`mcp-db/`)
- Comprehensive test suite with unit and integration tests

**Project Purpose:** To enable use of official Census Bureau statistics with AI assistants, leveraging the Model Context Protocol to provide token-optimized data that reduces hallucinations.
</HighLevelDetails>

<BuildInstructions>
**Prerequisites:**
- Node.js 18+
- A valid Census Bureau Data API key (only required for live-API tools and tests)

**Local Development Setup:**

```bash
cd mcp-server
npm install && npm run build
```

**Run Tests:**
```bash
cd mcp-server
npm run test
```

Tests run against the bundled SQLite database — no API key required except for the two live-API integration tests (`fetch-aggregate-data` and `list-datasets`).

**Run Linter:**
```bash
cd mcp-server
npm run lint
```

**Rebuild SQLite database:**
```bash
cd mcp-server
npm run build:db
```

This runs `scripts/build-sqlite.mjs` and writes a new `data/census.db`.

**Validation:**
All validation (build, lint, tests) is handled by CI/GitHub Actions on pull requests.
</BuildInstructions>

<ProjectLayout>
**Directory Structure:**
```
/
├── mcp-db/                       # SQLite database builder (ETL scripts)
│   ├── src/                      # Seeding and migration scripts
│   ├── migrations/               # Database schema migrations
│   ├── tests/                    # Test suite
│   ├── package.json
│   └── tsconfig.json
├── mcp-server/                   # Main MCP server application
│   ├── src/
│   │   ├── tools/                # MCP tool implementations
│   │   │   ├── base.tool.ts
│   │   │   ├── fetch-aggregate-data.tool.ts
│   │   │   ├── fetch-dataset-geography.tool.ts
│   │   │   ├── list-datasets.tool.ts
│   │   │   ├── list-variables.tool.ts
│   │   │   ├── resolve-geography-fips.tool.ts
│   │   │   └── search-data-tables.tool.ts
│   │   ├── prompts/              # MCP prompt implementations
│   │   │   ├── base.prompt.ts
│   │   │   ├── demographic.prompt.ts
│   │   │   ├── education.prompt.ts
│   │   │   ├── employment.prompt.ts
│   │   │   ├── housing.prompt.ts
│   │   │   ├── income.prompt.ts
│   │   │   └── population.prompt.ts
│   │   ├── schema/               # Zod validation schemas
│   │   ├── services/             # SQLite database service
│   │   ├── types/                # TypeScript definitions
│   │   ├── helpers/              # Shared utilities
│   │   ├── index.ts              # Entry point
│   │   └── server.ts             # Server initialization
│   ├── data/
│   │   └── census.db             # Bundled SQLite database (~23 MB)
│   ├── scripts/
│   │   └── build-sqlite.mjs      # Script to regenerate census.db
│   ├── tests/                    # Test suite (mirrors src/)
│   ├── package.json
│   ├── tsconfig.json
│   ├── vitest.config.ts
│   └── eslint.config.js
├── scripts/                      # Shell helper scripts (mcp-connect.sh, etc.)
```

**Configuration Files:**
- `mcp-server/tsconfig.json` - TypeScript config
- `mcp-server/vitest.config.ts` - Test configuration with coverage
- `mcp-server/eslint.config.js` - Linting rules
- `mcp-server/.prettierrc` - Code formatting rules
- `mcp-db/tsconfig.json` - TypeScript config for SQLite builder

**Key Architectural Elements:**

1. **MCP Tools** (`mcp-server/src/tools/`)
   - `base.tool.ts` - Abstract base class for all tools
   - Each tool file implements one MCP tool following Model Context Protocol
   - Tools use Zod schemas for validation
   - **Data sources:**
     - `fetch-aggregate-data.tool.ts` - Queries Census API directly (requires API key)
     - `list-datasets.tool.ts` - Queries Census API directly, 24h in-memory cache (requires API key)
     - `list-variables.tool.ts` - Queries Census API directly (no API key required)
     - `fetch-dataset-geography.tool.ts` - Queries SQLite database
     - `resolve-geography-fips.tool.ts` - Queries SQLite database
     - `search-data-tables.tool.ts` - Queries SQLite database

2. **MCP Prompts** (`mcp-server/src/prompts/`)
   - `base.prompt.ts` - Abstract base class for all prompts
   - Each prompt guides the model to use the right tools and Census tables for a topic
   - All geography-based prompts accept a single `geography_name` argument

3. **SQLite Database** (`mcp-server/data/census.db`)
   - Bundled and checked into the repo (~23 MB)
   - Contains geography, summary level, and dataset metadata
   - Singleton managed by `mcp-server/src/services/database.service.ts`
   - Rebuilt via `npm run build:db` using `scripts/build-sqlite.mjs`

4. **Schemas** (`mcp-server/src/schema/`)
   - Zod validation schemas for all tool inputs and Census API responses
   - `validators.ts` - Shared validation utilities
   - Each tool has a corresponding schema file

5. **Services** (`mcp-server/src/services/`)
   - `database.service.ts` - SQLite singleton for geography and dataset metadata search

6. **Testing Structure** (`mcp-server/tests/`)
   - Unit tests: `*.test.ts`
   - Integration tests: `*.integration.test.ts`
   - Mocks in `tests/mocks/`
   - Most tests run fully offline against the bundled SQLite database

**CI/CD Checks:**
- GitHub Actions workflows
- All PRs must pass: build + lint + test suite

**Critical Patterns:**
- **Tool Naming:** All tools extend `base.tool.ts`; `requiresApiKey` controls whether an API key is injected
- **Schema Validation:** Every tool has a corresponding `.schema.ts` file in `schema/`
- **Test Organization:** Tests mirror `src/` structure with unit + integration
- **FIPS Geography Codes:** Handled in `resolve-geography-fips.tool.ts`
- **Database Service:** SQLite singleton in `database.service.ts`

**Dependencies Not Obvious from Structure:**
- `list-datasets` has an in-memory 24h cache to avoid hammering the Census catalog endpoint
- `list-variables` and `fetch-aggregate-data` require no local database — they call the Census API directly
- Geography and dataset metadata tools rely on the bundled `census.db`
- All tools depend on `base.tool.ts`

**Important Files:**
- `mcp-server/src/index.ts` - MCP server entry point, registers all tools and prompts
- `mcp-server/src/server.ts` - `McpServer` class definition
- `mcp-server/data/census.db` - Bundled SQLite database
- `mcp-server/scripts/build-sqlite.mjs` - Regenerates census.db
- `scripts/mcp-connect.sh` - Shell script used by MCP clients to launch the server

**Trust These Instructions:**
The information above reflects the actual repository structure. Only search for additional information if these instructions are incomplete or incorrect for your specific task.
</ProjectLayout>
