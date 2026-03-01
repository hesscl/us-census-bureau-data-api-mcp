import { z } from 'zod'
import { BasePrompt } from './base.prompt.js'
import { GeographyArgsSchema } from '../schema/geography.prompt.schema.js'

export class HousingPrompt extends BasePrompt<
  z.infer<typeof GeographyArgsSchema>
> {
  name = 'get_housing_data'
  description =
    'Get official current housing data for any US geographic area using U.S. Census Bureau Data'

  arguments = [
    {
      name: 'geography_name',
      description: 'Name of the geographic area (city, state, county, etc.)',
      required: true,
    },
  ]

  constructor() {
    super()
    this.handler = this.handler.bind(this)
  }

  get argsSchema() {
    return GeographyArgsSchema
  }

  async handler(args: z.infer<typeof GeographyArgsSchema>) {
    const { geography_name } = args

    const promptText =
      `Get the most recent housing data for ${geography_name}` +
      ' using the Census MCP Server. Start by using the `resolve-geography-fips` tool to identify the correct geography.' +
      ' Then use `search-data-tables` with label query \'housing\' to find relevant table groups' +
      ' (e.g., B25001 for housing units, B25003 for tenure/ownership, B25064 for median rent, B25077 for median home value).' +
      ' Fetch data using `fetch-aggregate-data` with dataset `acs/acs5` and the most recent available year.'

    return this.createPromptResponse(
      `What's the housing data for ${geography_name}?`,
      promptText,
    )
  }
}
