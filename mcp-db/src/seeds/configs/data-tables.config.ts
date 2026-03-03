import { Client } from 'pg'
import { titleCase } from 'title-case'

import { SeedConfig } from '../../schema/seed-config.schema.js'
import {
  DataTableDatasetRecord,
  DataTableRecord,
} from '../../schema/data-table.schema.js'

interface ApiDatasetRaw {
  identifier: string
  c_dataset: string[]
  c_vintage: number | string
  c_isAggregate?: boolean
}

interface CensusGroup {
  name: string
  description: string
}

interface GroupsResponse {
  groups?: CensusGroup[]
}

// Use an object so tests can mutate it
export const state = {
  capturedRelationships: [] as DataTableDatasetRecord[],
}

const CONCURRENCY = 10

export function isValidDataset(item: unknown): item is ApiDatasetRaw {
  if (typeof item !== 'object' || item === null) return false
  const d = item as Record<string, unknown>
  return (
    typeof d.identifier === 'string' &&
    Array.isArray(d.c_dataset) &&
    (d.c_dataset as unknown[]).length > 0 &&
    d.c_vintage != null &&
    d.c_isAggregate === true
  )
}

export async function fetchGroups(url: string): Promise<CensusGroup[]> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) })
    if (!res.ok) return []
    const data = (await res.json()) as GroupsResponse
    return Array.isArray(data.groups) ? data.groups : []
  } catch {
    return []
  }
}

export async function fetchAllDatasetGroups(
  datasets: ApiDatasetRaw[],
  concurrency: number,
): Promise<{ datasetId: string; groups: CensusGroup[] }[]> {
  const results: { datasetId: string; groups: CensusGroup[] }[] = new Array(
    datasets.length,
  )
  let index = 0

  async function worker() {
    while (index < datasets.length) {
      const i = index++
      const dataset = datasets[i]
      const datasetId = dataset.identifier.split('/').pop()!
      const url = `https://api.census.gov/data/${dataset.c_vintage}/${dataset.c_dataset.join('/')}/groups.json`
      results[i] = { datasetId, groups: await fetchGroups(url) }
      if ((i + 1) % 10 === 0 || i + 1 === datasets.length) {
        console.log(`  Fetched groups for ${i + 1}/${datasets.length} datasets`)
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker))
  return results
}

export const DataTablesConfig: SeedConfig = {
  url: 'https://api.census.gov/data/',
  table: 'data_tables',
  conflictColumn: 'data_table_id',
  dataPath: 'dataset',
  alwaysFetch: true,
  beforeSeed: async (_client: Client, rawData: unknown[]): Promise<void> => {
    const datasets = rawData.filter(isValidDataset)
    console.log(`Fetching groups for ${datasets.length} aggregate datasets...`)

    const allResults = await fetchAllDatasetGroups(datasets, CONCURRENCY)
    const uniqueTables = new Map<string, DataTableRecord>()
    const relationships: DataTableDatasetRecord[] = []

    for (const { datasetId, groups } of allResults) {
      for (const group of groups) {
        if (!group.name?.trim() || !group.description?.trim()) continue
        const label = titleCase(group.description.toLowerCase())
        if (!uniqueTables.has(group.name)) {
          uniqueTables.set(group.name, { data_table_id: group.name, label })
        }
        relationships.push({ data_table_id: group.name, dataset_id: datasetId, label })
      }
    }

    state.capturedRelationships = relationships
    rawData.length = 0
    rawData.push(...Array.from(uniqueTables.values()))
    console.log(
      `Collected ${uniqueTables.size} unique tables across ${relationships.length} dataset-table relationships`,
    )
  },

  afterSeed: async (client: Client): Promise<void> => {
    if (state.capturedRelationships.length === 0) {
      console.log('No data_table <-> dataset relationships to insert')
      return
    }

    const dataTableIds = [
      ...new Set(state.capturedRelationships.map((r) => r.data_table_id)),
    ]
    const dataTableQuery = await client.query(
      `SELECT id, data_table_id FROM data_tables WHERE data_table_id = ANY($1)`,
      [dataTableIds],
    )
    const dataTableIdMap = new Map<string, number>(
      dataTableQuery.rows.map((row) => [
        row.data_table_id,
        parseInt(row.id, 10),
      ]),
    )

    const datasetIds = [
      ...new Set(state.capturedRelationships.map((r) => r.dataset_id)),
    ]
    const datasetQuery = await client.query(
      `SELECT id, dataset_id FROM datasets WHERE dataset_id = ANY($1)`,
      [datasetIds],
    )
    const datasetIdMap = new Map<string, number>(
      datasetQuery.rows.map((row) => [row.dataset_id, parseInt(row.id, 10)]),
    )

    const joinRecords = state.capturedRelationships
      .map((rel) => {
        const dataTableNumericId = dataTableIdMap.get(rel.data_table_id)
        const datasetNumericId = datasetIdMap.get(rel.dataset_id)

        if (!dataTableNumericId) {
          console.warn(
            `Could not find numeric ID for data_table_id: ${rel.data_table_id}`,
          )
          return null
        }
        if (!datasetNumericId) {
          console.warn(
            `Could not find numeric ID for dataset_id: ${rel.dataset_id}`,
          )
          return null
        }

        return {
          data_table_id: dataTableNumericId,
          dataset_id: datasetNumericId,
          label: rel.label,
        }
      })
      .filter((record): record is NonNullable<typeof record> => record !== null)

    if (joinRecords.length === 0) {
      console.log('No valid relationships to insert (missing IDs)')
      state.capturedRelationships = []
      return
    }

    const BATCH_SIZE = 5000
    const totalBatches = Math.ceil(joinRecords.length / BATCH_SIZE)

    console.log(
      `Processing ${joinRecords.length} records in batches of ${BATCH_SIZE}`,
    )

    for (let i = 0; i < joinRecords.length; i += BATCH_SIZE) {
      const batch = joinRecords.slice(i, i + BATCH_SIZE)
      console.log(
        `Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${totalBatches}`,
      )

      const columns = Object.keys(batch[0])
      const values = batch.map((record) =>
        columns.map((col) => record[col as keyof typeof record]),
      )

      const placeholders = values
        .map(
          (_, idx) =>
            `(${columns.map((_, j) => `$${idx * columns.length + j + 1}`).join(', ')})`,
        )
        .join(', ')

      const query = `
        INSERT INTO data_table_datasets (${columns.join(', ')})
        VALUES ${placeholders}
        ON CONFLICT (data_table_id, dataset_id) DO NOTHING
      `

      await client.query(query, values.flat())

      if (i + BATCH_SIZE < joinRecords.length) {
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
    }

    console.log(
      `Inserted ${joinRecords.length} data_table <-> dataset relationships`,
    )
    state.capturedRelationships = []
  },
}
