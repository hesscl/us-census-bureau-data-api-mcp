import { describe, it, expect, vi } from 'vitest'

import { DemographicPrompt } from '../../../src/prompts/demographic.prompt'
import { GeographyArgsSchema } from '../../../src/schema/geography.prompt.schema'

describe('Demographic Prompt', () => {
  it('has the correct name', () => {
    const prompt = new DemographicPrompt()
    expect(prompt.name).toBe('get_demographic_data')
  })

  it('has a description', () => {
    const prompt = new DemographicPrompt()
    expect(prompt.description).toBe(
      'Get official current demographic data for any US geographic area using U.S. Census Bureau Data',
    )
  })

  it('accepts the correct arguments', () => {
    const prompt = new DemographicPrompt()
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
      const prompt = new DemographicPrompt()
      expect(prompt.argsSchema).toBe(GeographyArgsSchema)
    })
  })

  describe('handler', () => {
    it('formats a prompt for server utilization using the provided geography_name', async () => {
      const prompt = new DemographicPrompt()
      const testGeography = 'Phoenix'

      const mockResponse = {
        title: `Retrieve official Census demographic data for ${testGeography}`,
        prompt: `Get the most recent demographic data for ${testGeography} using the Census MCP Server.`,
      }

      prompt.createPromptResponse = vi.fn().mockReturnValue(mockResponse)

      const result = await prompt.handler({ geography_name: testGeography })

      expect(prompt.createPromptResponse).toHaveBeenCalledWith(
        `What's the demographic data for ${testGeography}?`,
        expect.stringContaining(`Get the most recent demographic data for ${testGeography}`),
      )

      expect(result).toEqual(mockResponse)
    })

    it('handles different geography names correctly', async () => {
      const prompt = new DemographicPrompt()
      const testCases = [
        'California',
        'Los Angeles County',
        'Miami-Dade County',
      ]

      prompt.createPromptResponse = vi.fn()

      for (const geography of testCases) {
        await prompt.handler({ geography_name: geography })

        expect(prompt.createPromptResponse).toHaveBeenCalledWith(
          `What's the demographic data for ${geography}?`,
          expect.stringContaining(`Get the most recent demographic data for ${geography}`),
        )
      }
    })

    it('prompt text references key demographic table groups', async () => {
      const prompt = new DemographicPrompt()
      let capturedText = ''

      prompt.createPromptResponse = vi.fn().mockImplementation((_desc, text) => {
        capturedText = text
        return {}
      })

      await prompt.handler({ geography_name: 'Houston' })

      expect(capturedText).toContain('B01001')
      expect(capturedText).toContain('B02001')
      expect(capturedText).toContain('B03003')
      expect(capturedText).toContain('acs/acs5')
    })
  })
})
