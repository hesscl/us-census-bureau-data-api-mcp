import { describe, it, expect, vi } from 'vitest'

import { EducationPrompt } from '../../../src/prompts/education.prompt'
import { GeographyArgsSchema } from '../../../src/schema/geography.prompt.schema'

describe('Education Prompt', () => {
  it('has the correct name', () => {
    const prompt = new EducationPrompt()
    expect(prompt.name).toBe('get_education_data')
  })

  it('has a description', () => {
    const prompt = new EducationPrompt()
    expect(prompt.description).toBe(
      'Get official current education data for any US geographic area using U.S. Census Bureau Data',
    )
  })

  it('accepts the correct arguments', () => {
    const prompt = new EducationPrompt()
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
      const prompt = new EducationPrompt()
      expect(prompt.argsSchema).toBe(GeographyArgsSchema)
    })
  })

  describe('handler', () => {
    it('formats a prompt for server utilization using the provided geography_name', async () => {
      const prompt = new EducationPrompt()
      const testGeography = 'Boston'

      const mockResponse = {
        title: `Retrieve official Census education data for ${testGeography}`,
        prompt: `Get the most recent education data for ${testGeography} using the Census MCP Server.`,
      }

      prompt.createPromptResponse = vi.fn().mockReturnValue(mockResponse)

      const result = await prompt.handler({ geography_name: testGeography })

      expect(prompt.createPromptResponse).toHaveBeenCalledWith(
        `What's the education data for ${testGeography}?`,
        expect.stringContaining(`Get the most recent education data for ${testGeography}`),
      )

      expect(result).toEqual(mockResponse)
    })

    it('handles different geography names correctly', async () => {
      const prompt = new EducationPrompt()
      const testCases = [
        'California',
        'Los Angeles County',
        'Miami-Dade County',
      ]

      prompt.createPromptResponse = vi.fn()

      for (const geography of testCases) {
        await prompt.handler({ geography_name: geography })

        expect(prompt.createPromptResponse).toHaveBeenCalledWith(
          `What's the education data for ${geography}?`,
          expect.stringContaining(`Get the most recent education data for ${geography}`),
        )
      }
    })

    it('prompt text references key education table groups', async () => {
      const prompt = new EducationPrompt()
      let capturedText = ''

      prompt.createPromptResponse = vi.fn().mockImplementation((_desc, text) => {
        capturedText = text
        return {}
      })

      await prompt.handler({ geography_name: 'Atlanta' })

      expect(capturedText).toContain('B15003')
      expect(capturedText).toContain('S1501')
      expect(capturedText).toContain('acs/acs5')
    })
  })
})
