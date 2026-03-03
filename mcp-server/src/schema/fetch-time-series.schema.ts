import { z } from 'zod'

import {
  baseFields,
  baseProperties,
  geoFields,
  geoProperties,
  getFields,
  getProperties,
} from './table.schema.js'

export const FetchTimeSeriesSchema = {
  type: 'object',
  properties: {
    ...baseProperties,
    years: {
      type: 'array',
      items: { type: 'number' },
      description: 'List of years/vintages to fetch data for (1–20 years).',
      minItems: 1,
      maxItems: 20,
    },
    ...getProperties,
    ...geoProperties,
  },
  required: ['dataset', 'years', 'get'],
}

export const FetchTimeSeriesToolSchema = z.object({
  ...baseFields,
  years: z.array(z.number().int()).min(1).max(20),
  ...getFields,
  ...geoFields,
})

export type FetchTimeSeriesArgs = z.infer<typeof FetchTimeSeriesToolSchema>
