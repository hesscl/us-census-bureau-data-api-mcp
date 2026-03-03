import { z } from 'zod'

import {
  baseFields,
  baseProperties,
  formatField,
  formatProperty,
  geoFields,
  geoProperties,
  getFields,
  getProperties,
  yearField,
  yearProperty,
} from './table.schema.js'

export const TableSchema = {
  type: 'object',
  properties: {
    ...baseProperties,
    ...yearProperty,
    ...getProperties,
    ...geoProperties,
    ...formatProperty,
  },
  required: ['dataset', 'year', 'get'],
}

export const FetchAggregateDataToolSchema = z.object({
  ...baseFields,
  ...yearField,
  ...getFields,
  ...geoFields,
  ...formatField,
})

export type TableArgs = z.infer<typeof FetchAggregateDataToolSchema>
