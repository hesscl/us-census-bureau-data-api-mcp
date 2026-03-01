import { z } from 'zod'

export const GeographyArgsSchema = z.object({
  geography_name: z
    .string()
    .describe('Name of the geographic area (city, state, county, etc.)'),
})
