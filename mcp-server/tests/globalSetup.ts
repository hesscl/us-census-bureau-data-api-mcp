// Global test setup
// The bundled SQLite database (mcp-server/data/census.db) is used directly —
// no Docker, Postgres, or network access required.

export async function setup(): Promise<void> {
  console.log('=== GLOBAL SETUP COMPLETE (SQLite, no Docker required) ===')
}

export async function teardown(): Promise<void> {
  // Nothing to tear down.
}
