import { z } from 'zod'

export const ResolveGeographyFipsInputSchema = z
  .object({
    geography_name: z
      .string()
      .optional()
      .describe('The name of a single geography to resolve.'),
    geography_names: z
      .array(z.string().min(1))
      .min(2)
      .max(10)
      .optional()
      .describe('List of 2–10 geography names to resolve in batch.'),
    summary_level: z
      .string()
      .describe('The name or code of the Summary Level to search.')
      .optional(),
  })
  .refine((data) => data.geography_name || data.geography_names, {
    message: 'At least one of geography_name or geography_names must be provided.',
    path: ['geography_name'],
  })

export const ResolveGeographyFipsArgsSchema = {
  type: 'object',
  properties: {
    geography_name: {
      type: 'string',
      description: 'The name of a single geography to resolve. Use geography_names for batch lookups.',
      examples: [
        'Philadelphia city, Pennsylvania',
        'Philadelphia County, Pennsylvania',
        'Philadelphia, Pennsylvania',
        'Philadelphia',
      ],
    },
    geography_names: {
      type: 'array',
      items: { type: 'string' },
      minItems: 2,
      maxItems: 10,
      description: 'List of 2–10 geography names to resolve in a single batch call.',
      examples: [['Cook County, IL', 'Los Angeles County, CA']],
    },
    summary_level: {
      type: 'string',
      description:
        'Filters the geography resolution by the name or summary level code of a matching summary level.',
      examples: [
        'Place',
        '160',
        'County Subdivision',
        'County',
        'State',
        '040',
        'Division',
        'Region',
      ],
    },
  },
  required: [],
}

export type ResolveGeographyFipsArgs = z.infer<
  typeof ResolveGeographyFipsInputSchema
>
