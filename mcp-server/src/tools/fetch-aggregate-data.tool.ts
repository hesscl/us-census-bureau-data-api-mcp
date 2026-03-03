import fetch from 'node-fetch'
import { Tool } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'

import { BaseTool } from './base.tool.js'
import { buildCitation } from '../helpers/citation.js'
import {
  FetchAggregateDataToolSchema,
  TableArgs,
  TableSchema,
} from '../schema/fetch-aggregate-data.schema.js'
import { ToolContent } from '../types/base.types.js'

import {
  datasetValidator,
  validateGeographyArgs,
} from '../schema/validators.js'

const FETCH_TIMEOUT_MS = 30_000

export const toolDescription = `
  Fetches statistical data from U.S. Census Bureau datasets including population, demographics, income, housing, employment, and economic indicators. Use this tool when users request Census statistics, demographic breakdowns, or socioeconomic data for specific geographic areas. Requires a dataset identifier, year/vintage, geographic scope (state, county, tract, etc.), and specific variables or table groups. Returns structured data with proper citations for authoritative government statistics. Note: ACS 1-year (acs/acs1) data is only published for geographies with 65,000+ population. For smaller areas use acs/acs5.
`

export class FetchAggregateDataTool extends BaseTool<TableArgs> {
  name = 'fetch-aggregate-data'
  description = toolDescription
  inputSchema: Tool['inputSchema'] = TableSchema as Tool['inputSchema']
  readonly requiresApiKey = true

  get argsSchema() {
    return FetchAggregateDataToolSchema.superRefine((args, ctx) => {
      //Check that the correct tool is used to fetch data
      const identifiedDataset = datasetValidator(args.dataset)

      if (identifiedDataset.tool !== this.name) {
        ctx.addIssue({
          path: ['dataset'],
          code: z.ZodIssueCode.custom,
          message: identifiedDataset.message,
        })
      }

      validateGeographyArgs(args, ctx)
    })
  }

  constructor() {
    super()
    this.handler = this.handler.bind(this)
  }

  validateArgs(input: unknown) {
    return this.argsSchema.safeParse(input)
  }

  async toolHandler(
    args: TableArgs,
    apiKey: string,
  ): Promise<{ content: ToolContent[] }> {
    const baseUrl = `https://api.census.gov/data/${args.year}/${args.dataset}`

    let getParams = ''

    if (args.get.variables || args.get.group) {
      if (args.get.variables) {
        getParams = args.get.variables.join(',')
      }

      if (args.get.group) {
        if (getParams != '') {
          getParams += ','
        }
        getParams += `group(${args.get.group})`
      }
    }

    const query = new URLSearchParams({
      get: getParams,
    })

    if (args.for) {
      query.append('for', args.for)
    }

    if (args.in) {
      query.append('in', args.in)
    }

    if (args.ucgid) {
      query.append('ucgid', args.ucgid)
    }

    if (args.predicates) {
      for (const [key, value] of Object.entries(args.predicates)) {
        query.append(key, value)
      }
    }

    const descriptive = args.descriptive?.toString() ?? 'false'

    query.append('descriptive', descriptive)
    query.append('key', apiKey)

    const url = `${baseUrl}?${query.toString()}`

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

      const data = (await res.json()) as string[][]
      const [headers, ...rows] = data

      const citation = buildCitation(url)

      if (rows.length === 0) {
        const acs1Note = args.dataset.includes('acs1')
          ? ' ACS 1-year estimates are only available for geographies with 65,000+ population — try acs/acs5 for smaller areas.'
          : ''
        return this.createSuccessResponse(
          `The API returned no data rows for the requested geography and variables.${acs1Note}`,
        )
      }

      if (args.format === 'json') {
        const records = rows.map((row) =>
          Object.fromEntries(headers.map((h, i) => [h, row[i]])),
        )
        const result = JSON.stringify(
          { dataset: args.dataset, year: args.year, data: records, citation },
          null,
          2,
        )
        return this.createSuccessResponse(result)
      }

      const output = rows
        .map((row) => headers.map((h, i) => `${h}: ${row[i]}`).join(', '))
        .join('\n')

      return this.createSuccessResponse(
        `Response from ${args.dataset}:\n${output}\n${citation}`,
      )
    } catch (err) {
      return this.createErrorResponse(`Fetch failed: ${(err as Error).message}`)
    }
  }
}
