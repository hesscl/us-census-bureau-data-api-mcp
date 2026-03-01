import { describe, it, expect, vi } from 'vitest'

import { IncomePrompt } from '../../../src/prompts/income.prompt'
import { GeographyArgsSchema } from '../../../src/schema/geography.prompt.schema'

describe('Income Prompt', () => {
  it('has the correct name', () => {
    const prompt = new IncomePrompt()
    expect(prompt.name).toBe('get_income_data')
  })

  it('has a description', () => {
    const prompt = new IncomePrompt()
    expect(prompt.description).toBe(
      'Get official current income and poverty data for any US geographic area using U.S. Census Bureau Data',
    )
  })

  it('accepts the correct arguments', () => {
    const prompt = new IncomePrompt()
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
      const prompt = new IncomePrompt()
      expect(prompt.argsSchema).toBe(GeographyArgsSchema)
    })
  })

  describe('handler', () => {
    it('formats a prompt for server utilization using the provided geography_name', async () => {
      const prompt = new IncomePrompt()
      const testGeography = 'Seattle'

      const mockResponse = {
        title: `Retrieve official Census income data for ${testGeography}`,
        prompt: `Get the most recent income and poverty data for ${testGeography} using the Census MCP Server.`,
      }

      prompt.createPromptResponse = vi.fn().mockReturnValue(mockResponse)

      const result = await prompt.handler({ geography_name: testGeography })

      expect(prompt.createPromptResponse).toHaveBeenCalledWith(
        `What's the income and poverty data for ${testGeography}?`,
        expect.stringContaining(`Get the most recent income and poverty data for ${testGeography}`),
      )

      expect(result).toEqual(mockResponse)
    })

    it('handles different geography names correctly', async () => {
      const prompt = new IncomePrompt()
      const testCases = [
        'California',
        'Los Angeles County',
        'Miami-Dade County',
      ]

      prompt.createPromptResponse = vi.fn()

      for (const geography of testCases) {
        await prompt.handler({ geography_name: geography })

        expect(prompt.createPromptResponse).toHaveBeenCalledWith(
          `What's the income and poverty data for ${geography}?`,
          expect.stringContaining(`Get the most recent income and poverty data for ${geography}`),
        )
      }
    })

    it('prompt text references key income table groups', async () => {
      const prompt = new IncomePrompt()
      let capturedText = ''

      prompt.createPromptResponse = vi.fn().mockImplementation((_desc, text) => {
        capturedText = text
        return {}
      })

      await prompt.handler({ geography_name: 'Chicago' })

      expect(capturedText).toContain('B19013')
      expect(capturedText).toContain('B17001')
      expect(capturedText).toContain('B19001')
      expect(capturedText).toContain('acs/acs5')
    })
  })
})
