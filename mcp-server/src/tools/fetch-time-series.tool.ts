import fetch from 'node-fetch'
import { Tool } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'

import { BaseTool } from './base.tool.js'
import { buildCitation } from '../helpers/citation.js'
import {
  FetchTimeSeriesArgs,
  FetchTimeSeriesSchema,
  FetchTimeSeriesToolSchema,
} from '../schema/fetch-time-series.schema.js'
import { ToolContent } from '../types/base.types.js'
import { datasetValidator, validateGeographyArgs } from '../schema/validators.js'

type TimeSeriesSchema = z.ZodType<FetchTimeSeriesArgs, z.ZodTypeDef, FetchTimeSeriesArgs>

const FETCH_TIMEOUT_MS = 30_000

export const toolDescription = `
  Fetches the same Census variables across multiple years in parallel, enabling trend analysis. Use this when users want to compare or track Census data over time (e.g., population change from 2019 to 2023). Accepts the same dataset, variables/group, and geography parameters as fetch-aggregate-data, but takes a list of years instead of a single year. Returns results year-by-year with a combined citation.
`

export class FetchTimeSerieseTool extends BaseTool<FetchTimeSeriesArgs> {
  name = 'fetch-time-series'
  description = toolDescription
  inputSchema: Tool['inputSchema'] = FetchTimeSeriesSchema as Tool['inputSchema']
  readonly requiresApiKey = true

  get argsSchema(): TimeSeriesSchema {
    return FetchTimeSeriesToolSchema.superRefine((args, ctx) => {
      const identifiedDataset = datasetValidator(args.dataset)

      if (identifiedDataset.tool !== 'fetch-aggregate-data') {
        ctx.addIssue({
          path: ['dataset'],
          code: z.ZodIssueCode.custom,
          message: identifiedDataset.message,
        })
      }

      validateGeographyArgs(args, ctx)
    }) as TimeSeriesSchema
  }

  constructor() {
    super()
    this.handler = this.handler.bind(this)
  }

  private buildQuery(args: FetchTimeSeriesArgs, year: number, apiKey: string): string {
    const baseUrl = `https://api.census.gov/data/${year}/${args.dataset}`

    let getParams = ''
    if (args.get.variables) {
      getParams = args.get.variables.join(',')
    }
    if (args.get.group) {
      if (getParams !== '') getParams += ','
      getParams += `group(${args.get.group})`
    }

    const query = new URLSearchParams({ get: getParams })

    if (args.for) query.append('for', args.for)
    if (args.in) query.append('in', args.in)
    if (args.ucgid) query.append('ucgid', args.ucgid)

    if (args.predicates) {
      for (const [key, value] of Object.entries(args.predicates)) {
        query.append(key, value)
      }
    }

    const descriptive = args.descriptive?.toString() ?? 'false'
    query.append('descriptive', descriptive)
    query.append('key', apiKey)

    return `${baseUrl}?${query.toString()}`
  }

  private async fetchYear(
    url: string,
    year: number,
  ): Promise<{ year: number; output: string; error?: string }> {
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
        return { year, output: '', error: `Census API error: ${res.status} ${res.statusText}${detail}` }
      }

      const data = (await res.json()) as string[][]
      const [headers, ...rows] = data

      if (rows.length === 0) {
        return { year, output: '(no data rows returned)' }
      }

      const output = rows
        .map((row) => headers.map((h, i) => `${h}: ${row[i]}`).join(', '))
        .join('\n')

      return { year, output }
    } catch (err) {
      return { year, output: '', error: `Fetch failed: ${(err as Error).message}` }
    }
  }

  async toolHandler(
    args: FetchTimeSeriesArgs,
    apiKey: string,
  ): Promise<{ content: ToolContent[] }> {
    const yearResults = await Promise.allSettled(
      args.years.map((year) => {
        const url = this.buildQuery(args, year, apiKey)
        return this.fetchYear(url, year)
      }),
    )

    const sections: string[] = []

    for (const result of yearResults) {
      if (result.status === 'fulfilled') {
        const { year, output, error } = result.value
        sections.push(
          `--- Year ${year} ---\n${error ? `Error: ${error}` : output}`,
        )
      } else {
        sections.push(`--- Year (unknown) ---\nError: ${result.reason}`)
      }
    }

    // Build a single citation using the first year's URL (key redacted)
    const firstUrl = this.buildQuery(args, args.years[0], apiKey)
    const baseCitation = buildCitation(firstUrl)
    const yearsStr = args.years.join(', ')
    const citation = `${baseCitation.replace(/\/\d{4}\//, '/[YEAR]/')} — years: ${yearsStr}`

    const text = sections.join('\n\n') + `\n\n${citation}`

    return this.createSuccessResponse(text)
  }
}
