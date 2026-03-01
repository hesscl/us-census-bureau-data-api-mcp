import fetch from 'node-fetch'
import { Tool } from '@modelcontextprotocol/sdk/types.js'

import { BaseTool } from './base.tool.js'
import {
  ListVariablesSchema,
  ListVariablesToolSchema,
  ListVariablesArgs,
} from '../schema/list-variables.schema.js'
import { ToolContent } from '../types/base.types.js'

const FETCH_TIMEOUT_MS = 30_000

export const toolDescription = `
  Lists available variables inside a Census Bureau table group (e.g. B01001, S0101). Use this tool after finding a table group ID with search-data-tables and before calling fetch-aggregate-data, so you know which variable codes to request. Returns variable codes and their labels. Supports optional text filtering and result limits.
`

interface CensusVariable {
  label: string
  concept?: string
  predicateType?: string
  group?: string
  limit?: number
  predicateOnly?: boolean
  attributes?: string
  required?: string
}

interface CensusGroupResponse {
  variables: Record<string, CensusVariable>
}

export class ListVariablesTool extends BaseTool<ListVariablesArgs> {
  name = 'list-variables'
  description = toolDescription
  inputSchema: Tool['inputSchema'] = ListVariablesSchema as Tool['inputSchema']
  readonly requiresApiKey = false

  get argsSchema() {
    return ListVariablesToolSchema
  }

  constructor() {
    super()
    this.handler = this.handler.bind(this)
  }

  async toolHandler(args: ListVariablesArgs): Promise<{ content: ToolContent[] }> {
    const { dataset, year, group, label_query, limit = 50 } = args

    const url = `https://api.census.gov/data/${year}/${dataset}/groups/${group}.json`

    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

      let res
      try {
        res = await fetch(url, { signal: controller.signal as AbortSignal })
      } finally {
        clearTimeout(timeout)
      }

      if (!res.ok) {
        const body = await res.text?.().catch(() => '') ?? ''
        const detail = body ? ` — ${body.trim()}` : ''
        return this.createErrorResponse(
          `Census API error: ${res.status} ${res.statusText}${detail}`,
        )
      }

      const data = (await res.json()) as CensusGroupResponse

      if (!data.variables || typeof data.variables !== 'object') {
        return this.createErrorResponse(
          `Unexpected response format: missing variables field`,
        )
      }

      let entries = Object.entries(data.variables)
        .filter(([code]) => !['for', 'in', 'ucgid'].includes(code))
        .map(([code, variable]) => ({ code, label: variable.label ?? '' }))

      if (label_query) {
        const query = label_query.toLowerCase()
        entries = entries.filter((e) =>
          e.label.toLowerCase().includes(query),
        )
      }

      entries = entries.slice(0, limit)

      if (entries.length === 0) {
        return this.createSuccessResponse(
          `No variables found in group ${group} (${dataset}, ${year})${label_query ? ` matching "${label_query}"` : ''}.`,
        )
      }

      const lines = entries.map((e) => `${e.code}: ${e.label}`)
      const output =
        `Variables in group ${group} (${dataset}, ${year}):\n\n` +
        lines.join('\n') +
        `\n\nUse these variable codes in the 'get.variables' parameter of fetch-aggregate-data.`

      return this.createSuccessResponse(output)
    } catch (err) {
      return this.createErrorResponse(`Fetch failed: ${(err as Error).message}`)
    }
  }
}
