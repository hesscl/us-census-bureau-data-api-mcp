import { z } from 'zod'

export const ListVariablesSchema = {
  type: 'object',
  properties: {
    dataset: {
      type: 'string',
      description: 'Dataset identifier, e.g. acs/acs5',
    },
    year: {
      type: 'number',
      description: 'Dataset vintage year, e.g. 2022',
    },
    group: {
      type: 'string',
      description: 'Table group ID, e.g. B01001 or S0101',
    },
    label_query: {
      type: 'string',
      description: 'Optional filter: only return variables whose label contains this text (case-insensitive)',
    },
    limit: {
      type: 'number',
      description: 'Maximum number of variables to return (default 50)',
    },
  },
  required: ['dataset', 'year', 'group'],
}

export const ListVariablesToolSchema = z.object({
  dataset: z.string().describe('Dataset identifier, e.g. acs/acs5'),
  year: z.number().int().describe('Dataset vintage year, e.g. 2022'),
  group: z.string().describe('Table group ID, e.g. B01001 or S0101'),
  label_query: z
    .string()
    .optional()
    .describe(
      'Optional filter: only return variables whose label contains this text (case-insensitive)',
    ),
  limit: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Maximum number of variables to return (default 50)'),
})

export type ListVariablesArgs = z.infer<typeof ListVariablesToolSchema>
