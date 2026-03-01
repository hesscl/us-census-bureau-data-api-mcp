import { describe, it, expect, vi } from 'vitest'

import { EmploymentPrompt } from '../../../src/prompts/employment.prompt'
import { GeographyArgsSchema } from '../../../src/schema/geography.prompt.schema'

describe('Employment Prompt', () => {
  it('has the correct name', () => {
    const prompt = new EmploymentPrompt()
    expect(prompt.name).toBe('get_employment_data')
  })

  it('has a description', () => {
    const prompt = new EmploymentPrompt()
    expect(prompt.description).toBe(
      'Get official current employment data for any US geographic area using U.S. Census Bureau Data',
    )
  })

  it('accepts the correct arguments', () => {
    const prompt = new EmploymentPrompt()
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
      const prompt = new EmploymentPrompt()
      expect(prompt.argsSchema).toBe(GeographyArgsSchema)
    })
  })

  describe('handler', () => {
    it('formats a prompt for server utilization using the provided geography_name', async () => {
      const prompt = new EmploymentPrompt()
      const testGeography = 'Detroit'

      const mockResponse = {
        title: `Retrieve official Census employment data for ${testGeography}`,
        prompt: `Get the most recent employment data for ${testGeography} using the Census MCP Server.`,
      }

      prompt.createPromptResponse = vi.fn().mockReturnValue(mockResponse)

      const result = await prompt.handler({ geography_name: testGeography })

      expect(prompt.createPromptResponse).toHaveBeenCalledWith(
        `What's the employment data for ${testGeography}?`,
        expect.stringContaining(`Get the most recent employment data for ${testGeography}`),
      )

      expect(result).toEqual(mockResponse)
    })

    it('handles different geography names correctly', async () => {
      const prompt = new EmploymentPrompt()
      const testCases = [
        'California',
        'Los Angeles County',
        'Miami-Dade County',
      ]

      prompt.createPromptResponse = vi.fn()

      for (const geography of testCases) {
        await prompt.handler({ geography_name: geography })

        expect(prompt.createPromptResponse).toHaveBeenCalledWith(
          `What's the employment data for ${geography}?`,
          expect.stringContaining(`Get the most recent employment data for ${geography}`),
        )
      }
    })

    it('prompt text references key employment table groups', async () => {
      const prompt = new EmploymentPrompt()
      let capturedText = ''

      prompt.createPromptResponse = vi.fn().mockImplementation((_desc, text) => {
        capturedText = text
        return {}
      })

      await prompt.handler({ geography_name: 'Portland' })

      expect(capturedText).toContain('B23025')
      expect(capturedText).toContain('B24022')
      expect(capturedText).toContain('B08126')
      expect(capturedText).toContain('acs/acs5')
    })
  })
})
