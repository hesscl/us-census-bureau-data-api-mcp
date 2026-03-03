import fetch from 'node-fetch'
import { Tool } from '@modelcontextprotocol/sdk/types.js'

import { BaseTool } from './base.tool.js'
import { DatabaseService } from '../services/database.service.js'
import {
  SearchVariablesArgs,
  SearchVariablesSchema,
  SearchVariablesToolSchema,
} from '../schema/search-variables.schema.js'
import { ToolContent } from '../types/base.types.js'

const FETCH_TIMEOUT_MS = 30_000

export const toolDescription = `
  Finds Census variable codes by concept or label within a specific dataset and year. Use this instead of calling search-data-tables then list-variables separately. Searches table groups matching your query and returns variable codes with labels in one call. Returns variable codes ready to pass to fetch-aggregate-data.
`

interface CensusVariable {
  label: string
  concept?: string
  group?: string
}

interface CensusGroupResponse {
  variables: Record<string, CensusVariable>
}

export class SearchVariablesTool extends BaseTool<SearchVariablesArgs> {
  name = 'search-variables'
  description = toolDescription
  inputSchema: Tool['inputSchema'] = SearchVariablesSchema as Tool['inputSchema']
  readonly requiresApiKey = false

  private dbService: DatabaseService

  get argsSchema() {
    return SearchVariablesToolSchema
  }

  constructor() {
    super()
    this.handler = this.handler.bind(this)
    this.dbService = DatabaseService.getInstance()
  }

  private async fetchGroupVariables(
    year: number,
    dataset: string,
    group: string,
  ): Promise<{ group: string; variables: Array<{ code: string; label: string }> } | null> {
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

      if (!res.ok) return null

      const data = (await res.json()) as CensusGroupResponse

      if (!data.variables || typeof data.variables !== 'object') return null

      const variables = Object.entries(data.variables)
        .filter(([code]) => !['for', 'in', 'ucgid'].includes(code))
        .map(([code, variable]) => ({ code, label: variable.label ?? '' }))

      return { group, variables }
    } catch {
      return null
    }
  }

  async toolHandler(args: SearchVariablesArgs): Promise<{ content: ToolContent[] }> {
    const limit = args.limit ?? 20

    if (!this.dbService.healthCheck()) {
      return this.createErrorResponse(
        'Database connection failed - cannot search data tables.',
      )
    }

    // Step 1: Find matching table groups from the database
    const matchingTables = this.dbService.searchDataTables({
      label_query: args.label_query,
      limit: 5,
    })

    // Step 2: Filter to groups available for the requested dataset and year
    const matchingGroups: Array<{ groupId: string; groupLabel: string }> = []

    for (const table of matchingTables) {
      const hasMatch = table.datasets.some(
        (ds) =>
          ds.dataset_param === args.dataset &&
          (ds.year === null || ds.year === args.year),
      )
      if (hasMatch) {
        matchingGroups.push({
          groupId: table.data_table_id,
          groupLabel: table.label,
        })
      }
    }

    if (matchingGroups.length === 0) {
      return this.createSuccessResponse(
        `No table groups found matching "${args.label_query}" for dataset ${args.dataset} (${args.year}).`,
      )
    }

    // Step 3: Fetch variables from up to 3 matching groups in parallel
    const groupsToFetch = matchingGroups.slice(0, 3)

    const groupResults = await Promise.all(
      groupsToFetch.map((g) =>
        this.fetchGroupVariables(args.year, args.dataset, g.groupId),
      ),
    )

    // Step 4: Filter variables by label_query across all fetched groups
    const query = args.label_query.toLowerCase()

    const allMatches: Array<{
      variable_code: string
      label: string
      group: string
      group_label: string
    }> = []

    for (let i = 0; i < groupsToFetch.length; i++) {
      const result = groupResults[i]
      if (!result) continue

      const groupMeta = groupsToFetch[i]
      const filtered = result.variables.filter((v) =>
        v.label.toLowerCase().includes(query),
      )

      for (const v of filtered) {
        allMatches.push({
          variable_code: v.code,
          label: v.label,
          group: result.group,
          group_label: groupMeta.groupLabel,
        })
      }
    }

    if (allMatches.length === 0) {
      return this.createSuccessResponse(
        `No variables found matching "${args.label_query}" in the top table groups for ${args.dataset} (${args.year}).`,
      )
    }

    // Step 5: Return up to limit results
    const results = allMatches.slice(0, limit)

    const lines = results.map(
      (r) => `${r.variable_code}: ${r.label} — Group: ${r.group} (${r.group_label})`,
    )

    const output =
      `Variables matching "${args.label_query}" in ${args.dataset} (${args.year}):\n\n` +
      lines.join('\n') +
      `\n\nUse these variable codes in the 'get.variables' parameter of fetch-aggregate-data.`

    return this.createSuccessResponse(output)
  }
}
