const mockFetch = vi.hoisted(() => vi.fn())

vi.mock('node-fetch', () => ({
  default: mockFetch,
}))

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  ListVariablesTool,
  toolDescription,
} from '../../../src/tools/list-variables.tool'
import {
  validateToolStructure,
  validateResponseStructure,
  createMockResponse,
  createMockFetchError,
} from '../../helpers/test-utils'

const sampleGroupResponse = {
  variables: {
    B01001_001E: {
      label: 'Estimate!!Total:',
      concept: 'Sex By Age',
      predicateType: 'int',
      group: 'B01001',
      limit: 0,
    },
    B01001_002E: {
      label: 'Estimate!!Total:!!Male:',
      concept: 'Sex By Age',
      predicateType: 'int',
      group: 'B01001',
      limit: 0,
    },
    B01001_026E: {
      label: 'Estimate!!Total:!!Female:',
      concept: 'Sex By Age',
      predicateType: 'int',
      group: 'B01001',
      limit: 0,
    },
    for: {
      label: 'Census API FIPS \'for\' clause',
      predicateType: 'fips-for',
      predicateOnly: true,
    },
    in: {
      label: 'Census API FIPS \'in\' clause',
      predicateType: 'fips-in',
      predicateOnly: true,
    },
  },
}

describe('ListVariablesTool', () => {
  let tool: ListVariablesTool

  beforeEach(() => {
    tool = new ListVariablesTool()
    mockFetch.mockClear()
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  describe('Tool Configuration', () => {
    it('should have correct tool metadata', () => {
      validateToolStructure(tool)
      expect(tool.name).toBe('list-variables')
      expect(tool.description).toBe(toolDescription)
      expect(tool.requiresApiKey).toBe(false)
    })

    it('should have valid input schema', () => {
      const schema = tool.inputSchema
      expect(schema.type).toBe('object')
      expect(schema.properties).toHaveProperty('dataset')
      expect(schema.properties).toHaveProperty('year')
      expect(schema.properties).toHaveProperty('group')
      expect(schema.properties).toHaveProperty('label_query')
      expect(schema.properties).toHaveProperty('limit')
      expect(schema.required).toEqual(['dataset', 'year', 'group'])
    })

    it('should validate required parameters', () => {
      const missingGroup = { dataset: 'acs/acs5', year: 2022 }
      expect(() => tool.argsSchema.parse(missingGroup)).toThrow()
    })

    it('should accept valid args', () => {
      const validArgs = { dataset: 'acs/acs5', year: 2022, group: 'B01001' }
      expect(() => tool.argsSchema.parse(validArgs)).not.toThrow()
    })

    it('should accept optional parameters', () => {
      const argsWithOptionals = {
        dataset: 'acs/acs5',
        year: 2022,
        group: 'B01001',
        label_query: 'male',
        limit: 10,
      }
      expect(() => tool.argsSchema.parse(argsWithOptionals)).not.toThrow()
    })
  })

  describe('toolHandler - happy path', () => {
    it('fetches from the correct URL', async () => {
      mockFetch.mockResolvedValue(createMockResponse(sampleGroupResponse))

      await tool.toolHandler({
        dataset: 'acs/acs5',
        year: 2022,
        group: 'B01001',
      })

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.census.gov/data/2022/acs/acs5/groups/B01001.json',
        expect.anything(),
      )
    })

    it('returns formatted variable list', async () => {
      mockFetch.mockResolvedValue(createMockResponse(sampleGroupResponse))

      const response = await tool.toolHandler({
        dataset: 'acs/acs5',
        year: 2022,
        group: 'B01001',
      })

      validateResponseStructure(response)
      const text = response.content[0].text
      expect(text).toContain('Variables in group B01001 (acs/acs5, 2022)')
      expect(text).toContain('B01001_001E: Estimate!!Total:')
      expect(text).toContain('B01001_002E: Estimate!!Total:!!Male:')
      expect(text).toContain("Use these variable codes in the 'get.variables' parameter of fetch-aggregate-data.")
    })

    it('excludes reserved geography parameters (for, in, ucgid)', async () => {
      mockFetch.mockResolvedValue(createMockResponse(sampleGroupResponse))

      const response = await tool.toolHandler({
        dataset: 'acs/acs5',
        year: 2022,
        group: 'B01001',
      })

      const text = response.content[0].text
      expect(text).not.toContain('for:')
      expect(text).not.toContain('in:')
    })
  })

  describe('toolHandler - label_query filtering', () => {
    it('filters variables by label_query (case-insensitive)', async () => {
      mockFetch.mockResolvedValue(createMockResponse(sampleGroupResponse))

      const response = await tool.toolHandler({
        dataset: 'acs/acs5',
        year: 2022,
        group: 'B01001',
        label_query: 'female',
      })

      validateResponseStructure(response)
      const text = response.content[0].text
      expect(text).toContain('B01001_026E')
      expect(text).not.toContain('B01001_001E')
      expect(text).not.toContain('B01001_002E')
    })

    it('returns empty message when no variables match', async () => {
      mockFetch.mockResolvedValue(createMockResponse(sampleGroupResponse))

      const response = await tool.toolHandler({
        dataset: 'acs/acs5',
        year: 2022,
        group: 'B01001',
        label_query: 'zzznomatch',
      })

      validateResponseStructure(response)
      expect(response.content[0].text).toContain('No variables found')
      expect(response.content[0].text).toContain('"zzznomatch"')
    })
  })

  describe('toolHandler - limit', () => {
    it('caps results at the specified limit', async () => {
      mockFetch.mockResolvedValue(createMockResponse(sampleGroupResponse))

      const response = await tool.toolHandler({
        dataset: 'acs/acs5',
        year: 2022,
        group: 'B01001',
        limit: 1,
      })

      validateResponseStructure(response)
      const text = response.content[0].text
      // Only 1 variable line should appear (excluding header and footer lines)
      const variableLines = text
        .split('\n')
        .filter((line) => line.match(/^B01001_\d+/))
      expect(variableLines).toHaveLength(1)
    })
  })

  describe('toolHandler - error handling', () => {
    it('returns error on non-ok API response', async () => {
      mockFetch.mockResolvedValue(
        new Response('Not Found', { status: 404, statusText: 'Not Found' }),
      )

      const response = await tool.toolHandler({
        dataset: 'acs/acs5',
        year: 2022,
        group: 'BADGROUP',
      })

      validateResponseStructure(response)
      expect(response.content[0].text).toContain('Census API error: 404')
    })

    it('returns error on network failure', async () => {
      mockFetch.mockImplementation(() => createMockFetchError('Network error'))

      const response = await tool.toolHandler({
        dataset: 'acs/acs5',
        year: 2022,
        group: 'B01001',
      })

      validateResponseStructure(response)
      expect(response.content[0].text).toContain('Fetch failed: Network error')
    })

    it('returns error when variables field is missing', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ unexpected: true }))

      const response = await tool.toolHandler({
        dataset: 'acs/acs5',
        year: 2022,
        group: 'B01001',
      })

      validateResponseStructure(response)
      expect(response.content[0].text).toContain('Unexpected response format')
    })
  })
})
