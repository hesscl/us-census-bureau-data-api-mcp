const enableDebugLogs = process.env.DEBUG_LOGS === 'true'

if (!enableDebugLogs) {
  console.log = () => {}
  console.info = () => {}
  console.warn = () => {}
}

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { MCPServer } from './server.js'

import { FetchAggregateDataTool } from './tools/fetch-aggregate-data.tool.js'
import { FetchDatasetGeographyTool } from './tools/fetch-dataset-geography.tool.js'
import { ListDatasetsTool } from './tools/list-datasets.tool.js'
import { ListVariablesTool } from './tools/list-variables.tool.js'
import { ResolveGeographyFipsTool } from './tools/resolve-geography-fips.tool.js'
import { SearchDataTablesTool } from './tools/search-data-tables.tool.js'

import { PopulationPrompt } from './prompts/population.prompt.js'
import { IncomePrompt } from './prompts/income.prompt.js'
import { HousingPrompt } from './prompts/housing.prompt.js'
import { DemographicPrompt } from './prompts/demographic.prompt.js'
import { EducationPrompt } from './prompts/education.prompt.js'
import { EmploymentPrompt } from './prompts/employment.prompt.js'

// MCP Server Setup
async function main() {
  const mcpServer = new MCPServer('census-api', '0.1.0')

  // Register prompts
  mcpServer.registerPrompt(new PopulationPrompt())
  mcpServer.registerPrompt(new IncomePrompt())
  mcpServer.registerPrompt(new HousingPrompt())
  mcpServer.registerPrompt(new DemographicPrompt())
  mcpServer.registerPrompt(new EducationPrompt())
  mcpServer.registerPrompt(new EmploymentPrompt())

  // Register tools
  mcpServer.registerTool(new FetchAggregateDataTool())
  mcpServer.registerTool(new FetchDatasetGeographyTool())
  mcpServer.registerTool(new ListDatasetsTool())
  mcpServer.registerTool(new ListVariablesTool())
  mcpServer.registerTool(new ResolveGeographyFipsTool())
  mcpServer.registerTool(new SearchDataTablesTool())

  const transport = new StdioServerTransport()
  await mcpServer.connect(transport)
}

main().catch(console.error)
