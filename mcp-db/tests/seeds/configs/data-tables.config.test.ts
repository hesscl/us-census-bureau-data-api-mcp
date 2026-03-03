import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { Client } from 'pg'

import {
  DataTablesConfig,
  state,
  isValidDataset,
  fetchGroups,
} from '../../../src/seeds/configs/data-tables.config'

const makeDataset = (overrides: Record<string, unknown> = {}) => ({
  identifier: 'http://api.census.gov/data/id/ACSDT1Y2019',
  c_dataset: ['acs', 'acs1'],
  c_vintage: 2019,
  c_isAggregate: true,
  ...overrides,
})

const mockGroupsResponse = {
  groups: [
    { name: 'B25032', description: 'TENURE BY UNITS IN STRUCTURE' },
    { name: 'B19013', description: 'MEDIAN HOUSEHOLD INCOME IN THE PAST 12 MONTHS' },
  ],
}

describe('DataTables Config', () => {
  let mockClient: Partial<Client>

  beforeEach(() => {
    mockClient = {
      query: vi.fn().mockResolvedValue({ rows: [] }),
    }
    state.capturedRelationships = []
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockGroupsResponse),
      }),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('should have valid configuration structure', () => {
    expect(DataTablesConfig).toBeDefined()
    expect(DataTablesConfig.url).toBe('https://api.census.gov/data/')
    expect(DataTablesConfig.table).toBe('data_tables')
    expect(DataTablesConfig.conflictColumn).toBe('data_table_id')
    expect(DataTablesConfig.alwaysFetch).toBe(true)
    expect(DataTablesConfig.beforeSeed).toBeDefined()
    expect(DataTablesConfig.afterSeed).toBeDefined()
  })

  describe('isValidDataset', () => {
    it('accepts aggregate datasets with vintage year and c_dataset', () => {
      expect(isValidDataset(makeDataset())).toBe(true)
    })

    it('rejects datasets without c_isAggregate', () => {
      expect(isValidDataset(makeDataset({ c_isAggregate: false }))).toBe(false)
      expect(isValidDataset(makeDataset({ c_isAggregate: undefined }))).toBe(false)
    })

    it('rejects datasets without c_vintage', () => {
      expect(isValidDataset(makeDataset({ c_vintage: null }))).toBe(false)
      expect(isValidDataset(makeDataset({ c_vintage: undefined }))).toBe(false)
    })

    it('rejects datasets with empty c_dataset array', () => {
      expect(isValidDataset(makeDataset({ c_dataset: [] }))).toBe(false)
    })

    it('rejects non-objects', () => {
      expect(isValidDataset(null)).toBe(false)
      expect(isValidDataset('string')).toBe(false)
      expect(isValidDataset(42)).toBe(false)
    })
  })

  describe('fetchGroups', () => {
    it('returns groups from a successful response', async () => {
      const groups = await fetchGroups('https://api.census.gov/data/2019/acs/acs1/groups.json')
      expect(groups).toEqual(mockGroupsResponse.groups)
    })

    it('returns empty array when response is not ok', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({ ok: false, status: 404 }),
      )
      const groups = await fetchGroups('https://api.census.gov/data/2019/acs/acs1/groups.json')
      expect(groups).toEqual([])
    })

    it('returns empty array on network error', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')))
      const groups = await fetchGroups('https://api.census.gov/data/2019/acs/acs1/groups.json')
      expect(groups).toEqual([])
    })

    it('returns empty array when groups field is missing', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({}),
        }),
      )
      const groups = await fetchGroups('https://api.census.gov/data/2019/acs/acs1/groups.json')
      expect(groups).toEqual([])
    })
  })

  describe('beforeSeed', () => {
    it('fetches groups for each aggregate dataset and replaces rawData with deduped tables', async () => {
      const rawData: unknown[] = [
        makeDataset({ identifier: 'http://api.census.gov/data/id/ACSDT1Y2019' }),
        makeDataset({ identifier: 'http://api.census.gov/data/id/ACSDT1Y2018' }),
      ]

      await DataTablesConfig.beforeSeed!(mockClient as Client, rawData)

      // Two datasets fetched groups from the same two tables — rawData should have 2 deduped tables
      expect(rawData).toHaveLength(2)
      expect(rawData).toContainEqual(
        expect.objectContaining({ data_table_id: 'B25032' }),
      )
      expect(rawData).toContainEqual(
        expect.objectContaining({ data_table_id: 'B19013' }),
      )
    })

    it('constructs the correct groups URL from dataset vintage and param', async () => {
      const rawData: unknown[] = [
        makeDataset({
          identifier: 'http://api.census.gov/data/id/ACSDT5Y2022',
          c_dataset: ['acs', 'acs5'],
          c_vintage: 2022,
        }),
      ]

      await DataTablesConfig.beforeSeed!(mockClient as Client, rawData)

      expect(fetch).toHaveBeenCalledWith(
        'https://api.census.gov/data/2022/acs/acs5/groups.json',
        expect.any(Object),
      )
    })

    it('extracts datasetId from the last path segment of identifier', async () => {
      const rawData: unknown[] = [
        makeDataset({ identifier: 'http://api.census.gov/data/id/ACSDT1Y2019' }),
      ]

      await DataTablesConfig.beforeSeed!(mockClient as Client, rawData)

      expect(state.capturedRelationships[0].dataset_id).toBe('ACSDT1Y2019')
    })

    it('skips non-aggregate datasets', async () => {
      const rawData: unknown[] = [
        makeDataset({ c_isAggregate: false }),
        makeDataset({ c_isAggregate: undefined }),
        { identifier: 'http://api.census.gov/data/id/ACSPUMS1Y2019', c_dataset: ['acs', 'acs1'], c_vintage: 2019 },
      ]

      await DataTablesConfig.beforeSeed!(mockClient as Client, rawData)

      expect(fetch).not.toHaveBeenCalled()
      expect(rawData).toHaveLength(0)
      expect(state.capturedRelationships).toHaveLength(0)
    })

    it('populates capturedRelationships with one entry per group per dataset', async () => {
      const rawData: unknown[] = [
        makeDataset({ identifier: 'http://api.census.gov/data/id/ACSDT1Y2019' }),
        makeDataset({ identifier: 'http://api.census.gov/data/id/ACSDT1Y2018' }),
      ]

      await DataTablesConfig.beforeSeed!(mockClient as Client, rawData)

      // 2 datasets × 2 groups = 4 relationships
      expect(state.capturedRelationships).toHaveLength(4)
      expect(state.capturedRelationships).toContainEqual({
        data_table_id: 'B25032',
        dataset_id: 'ACSDT1Y2019',
        label: expect.any(String),
      })
      expect(state.capturedRelationships).toContainEqual({
        data_table_id: 'B25032',
        dataset_id: 'ACSDT1Y2018',
        label: expect.any(String),
      })
    })

    it('skips groups with empty name or description', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              groups: [
                { name: '', description: 'Empty name' },
                { name: 'B25032', description: '' },
                { name: 'B19013', description: 'MEDIAN HOUSEHOLD INCOME' },
              ],
            }),
        }),
      )

      const rawData: unknown[] = [makeDataset()]
      await DataTablesConfig.beforeSeed!(mockClient as Client, rawData)

      expect(rawData).toHaveLength(1)
      expect((rawData[0] as { data_table_id: string }).data_table_id).toBe('B19013')
    })

    it('deduplicates tables that appear in multiple datasets', async () => {
      const rawData: unknown[] = [
        makeDataset({ identifier: 'http://api.census.gov/data/id/ACSDT1Y2019' }),
        makeDataset({ identifier: 'http://api.census.gov/data/id/ACSDT5Y2019', c_dataset: ['acs', 'acs5'] }),
      ]

      await DataTablesConfig.beforeSeed!(mockClient as Client, rawData)

      // Both datasets have B25032 and B19013 — rawData should only have 2 unique tables
      expect(rawData).toHaveLength(2)
      const tableIds = (rawData as { data_table_id: string }[]).map((t) => t.data_table_id)
      expect(new Set(tableIds).size).toBe(2)
    })

    it('applies titleCase transformation to group descriptions', async () => {
      const rawData: unknown[] = [makeDataset()]
      await DataTablesConfig.beforeSeed!(mockClient as Client, rawData)

      const table = rawData.find(
        (t) => (t as { data_table_id: string }).data_table_id === 'B25032',
      ) as { label: string }
      // titleCase converts "TENURE BY UNITS IN STRUCTURE" → title case
      expect(table.label).toMatch(/^Tenure/)
      expect(table.label).not.toBe(table.label.toUpperCase())
    })
  })

  describe('afterSeed', () => {
    it('should map string IDs to numeric IDs and insert relationships', async () => {
      state.capturedRelationships = [
        {
          data_table_id: 'B16005D',
          dataset_id: 'ACSDT5Y2009',
          label: 'Nativity by Language Spoken at Home',
        },
      ]

      const mockQuery = mockClient.query as ReturnType<typeof vi.fn>

      mockQuery
        .mockResolvedValueOnce({
          rows: [{ id: 1, data_table_id: 'B16005D' }],
        })
        .mockResolvedValueOnce({
          rows: [{ id: 10, dataset_id: 'ACSDT5Y2009' }],
        })
        .mockResolvedValueOnce({ rows: [] })

      await DataTablesConfig.afterSeed!(mockClient as Client)

      expect(mockQuery).toHaveBeenCalledTimes(3)

      const insertCall = mockQuery.mock.calls[2]
      const insertParams = insertCall[1]

      expect(insertParams[0]).toBe(1)
      expect(insertParams[1]).toBe(10)
      expect(insertParams[2]).toBe('Nativity by Language Spoken at Home')
    })

    it('should handle empty relationships', async () => {
      state.capturedRelationships = []

      const mockQuery = mockClient.query as ReturnType<typeof vi.fn>

      await DataTablesConfig.afterSeed!(mockClient as Client)

      expect(mockQuery).not.toHaveBeenCalled()
    })

    it('should warn and skip relationships with missing IDs', async () => {
      state.capturedRelationships = [
        {
          data_table_id: 'UNKNOWN',
          dataset_id: 'ACSDT5Y2009',
          label: 'Test',
        },
      ]

      const mockQuery = mockClient.query as ReturnType<typeof vi.fn>
      const consoleWarnSpy = vi
        .spyOn(console, 'warn')
        .mockImplementation(() => {})

      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{ id: 10, dataset_id: 'ACSDT5Y2009' }],
        })

      await DataTablesConfig.afterSeed!(mockClient as Client)

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'Could not find numeric ID for data_table_id: UNKNOWN',
        ),
      )

      expect(mockQuery).toHaveBeenCalledTimes(2)

      consoleWarnSpy.mockRestore()
    })

    it('should reset capturedRelationships after inserting', async () => {
      state.capturedRelationships = [
        {
          data_table_id: 'B16005D',
          dataset_id: 'ACSDT5Y2009',
          label: 'Nativity by Language Spoken at Home',
        },
      ]

      const mockQuery = mockClient.query as ReturnType<typeof vi.fn>

      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: 1, data_table_id: 'B16005D' }] })
        .mockResolvedValueOnce({ rows: [{ id: 10, dataset_id: 'ACSDT5Y2009' }] })
        .mockResolvedValueOnce({ rows: [] })

      await DataTablesConfig.afterSeed!(mockClient as Client)

      expect(state.capturedRelationships).toEqual([])
    })

    it('should insert into data_table_datasets with correct SQL', async () => {
      state.capturedRelationships = [
        {
          data_table_id: 'B16005D',
          dataset_id: 'ACSDT5Y2009',
          label: 'Nativity by Language Spoken at Home',
        },
      ]

      const mockQuery = mockClient.query as ReturnType<typeof vi.fn>

      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: 1, data_table_id: 'B16005D' }] })
        .mockResolvedValueOnce({ rows: [{ id: 10, dataset_id: 'ACSDT5Y2009' }] })
        .mockResolvedValueOnce({ rows: [] })

      await DataTablesConfig.afterSeed!(mockClient as Client)

      const insertSQL = mockQuery.mock.calls[2][0]
      expect(insertSQL).toContain('INSERT INTO data_table_datasets')
      expect(insertSQL).toContain('(data_table_id, dataset_id, label)')
      expect(insertSQL).toContain('ON CONFLICT (data_table_id, dataset_id) DO NOTHING')
    })

    it('should process large batches correctly', async () => {
      const manyRelationships = Array.from({ length: 10000 }, (_, i) => ({
        data_table_id: `TABLE_${i % 100}`,
        dataset_id: `DATASET_${i % 50}`,
        label: `Label ${i}`,
      }))

      state.capturedRelationships = manyRelationships

      const mockQuery = mockClient.query as ReturnType<typeof vi.fn>

      const uniqueTableIds = [...new Set(manyRelationships.map((r) => r.data_table_id))]
      const uniqueDatasetIds = [...new Set(manyRelationships.map((r) => r.dataset_id))]

      mockQuery
        .mockResolvedValueOnce({
          rows: uniqueTableIds.map((id, idx) => ({ id: idx + 1, data_table_id: id })),
        })
        .mockResolvedValueOnce({
          rows: uniqueDatasetIds.map((id, idx) => ({ id: idx + 1, dataset_id: id })),
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })

      await DataTablesConfig.afterSeed!(mockClient as Client)

      // 2 lookups + 2 batches
      expect(mockQuery).toHaveBeenCalledTimes(4)
      expect(state.capturedRelationships).toEqual([])
    })
  })
})
