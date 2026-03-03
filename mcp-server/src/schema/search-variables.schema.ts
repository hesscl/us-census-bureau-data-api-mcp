import { z } from 'zod'

export const SearchVariablesSchema = {
  type: 'object',
  properties: {
    dataset: {
      type: 'string',
      description: 'The dataset identifier, e.g. "acs/acs5".',
      examples: ['acs/acs5', 'acs/acs1', 'dec/sf1'],
    },
    year: {
      type: 'number',
      description: 'The vintage year.',
      examples: [2023, 2022, 2020],
    },
    label_query: {
      type: 'string',
      description: 'Required concept or label search term, e.g. "bachelor degree" or "median income".',
      examples: ['bachelor degree', 'median household income', 'race'],
    },
    limit: {
      type: 'number',
      description: 'Maximum number of variable results to return. Default 20, max 100.',
    },
  },
  required: ['dataset', 'year', 'label_query'],
}

export const SearchVariablesToolSchema = z.object({
  dataset: z.string(),
  year: z.number(),
  label_query: z.string().min(1),
  limit: z.number().int().positive().max(100).optional(),
})

export type SearchVariablesArgs = z.infer<typeof SearchVariablesToolSchema>
