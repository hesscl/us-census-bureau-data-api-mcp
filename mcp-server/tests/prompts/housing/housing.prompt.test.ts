import { describe, it, expect, vi } from 'vitest'

import { HousingPrompt } from '../../../src/prompts/housing.prompt'
import { GeographyArgsSchema } from '../../../src/schema/geography.prompt.schema'

describe('Housing Prompt', () => {
  it('has the correct name', () => {
    const prompt = new HousingPrompt()
    expect(prompt.name).toBe('get_housing_data')
  })

  it('has a description', () => {
    const prompt = new HousingPrompt()
    expect(prompt.description).toBe(
      'Get official current housing data for any US geographic area using U.S. Census Bureau Data',
    )
  })

  it('accepts the correct arguments', () => {
    const prompt = new HousingPrompt()
    expect(prompt.arguments).toEqual([
      {
        name: 'geography_name',
        description: 'Name of the geographic area (city, state, county, etc.)',
        required: true,
      },
    ])
  })

  describe('argsSchema', () => {
    it('returns the arguments schema', () => {
      const prompt = new HousingPrompt()
      expect(prompt.argsSchema).toBe(GeographyArgsSchema)
    })
  })

  describe('handler', () => {
    it('formats a prompt for server utilization using the provided geography_name', async () => {
      const prompt = new HousingPrompt()
      const testGeography = 'Austin'

      const mockResponse = {
        title: `Retrieve official Census housing data for ${testGeography}`,
        prompt: `Get the most recent housing data for ${testGeography} using the Census MCP Server.`,
      }

      prompt.createPromptResponse = vi.fn().mockReturnValue(mockResponse)

      const result = await prompt.handler({ geography_name: testGeography })

      expect(prompt.createPromptResponse).toHaveBeenCalledWith(
        `What's the housing data for ${testGeography}?`,
        expect.stringContaining(`Get the most recent housing data for ${testGeography}`),
      )

      expect(result).toEqual(mockResponse)
    })

    it('handles different geography names correctly', async () => {
      const prompt = new HousingPrompt()
      const testCases = [
        'California',
        'Los Angeles County',
        'Miami-Dade County',
      ]

      prompt.createPromptResponse = vi.fn()

      for (const geography of testCases) {
        await prompt.handler({ geography_name: geography })

        expect(prompt.createPromptResponse).toHaveBeenCalledWith(
          `What's the housing data for ${geography}?`,
          expect.stringContaining(`Get the most recent housing data for ${geography}`),
        )
      }
    })

    it('prompt text references key housing table groups', async () => {
      const prompt = new HousingPrompt()
      let capturedText = ''

      prompt.createPromptResponse = vi.fn().mockImplementation((_desc, text) => {
        capturedText = text
        return {}
      })

      await prompt.handler({ geography_name: 'Denver' })

      expect(capturedText).toContain('B25001')
      expect(capturedText).toContain('B25003')
      expect(capturedText).toContain('B25064')
      expect(capturedText).toContain('B25077')
      expect(capturedText).toContain('acs/acs5')
    })
  })
})
