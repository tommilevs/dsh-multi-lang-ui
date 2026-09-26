import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'

const POSITION_KEY = 'dsh-mcp-manager-ui/fab-pos'
const MIGRATION_KEY = 'dsh-multi-lang-ui:mcp-fab-position-reset:v1'
const clientSource = readFileSync(new URL('../lib/multi-lang-client.js', import.meta.url), 'utf8')
const helperContext = {}
vm.runInNewContext(`${clientSource}\nglobalThis.reset = resetPersistedMcpFabPosition`, helperContext)
const resetPersistedMcpFabPosition = helperContext.reset

test('resets the MCP floating button saved position once and reloads the renderer', () => {
  const values = new Map([[POSITION_KEY, JSON.stringify({ x: 482, y: 314 })]])
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  }
  let reloads = 0

  assert.equal(resetPersistedMcpFabPosition(storage, () => { reloads += 1 }), true)
  assert.equal(values.has(POSITION_KEY), false)
  assert.equal(values.get(MIGRATION_KEY), '1')
  assert.equal(reloads, 1)

  assert.equal(resetPersistedMcpFabPosition(storage, () => { reloads += 1 }), false)
  assert.equal(reloads, 1)
})

test('does not reload when there is no saved MCP button position', () => {
  const storage = { getItem: () => null, setItem() {}, removeItem() {} }
  let reloads = 0

  assert.equal(resetPersistedMcpFabPosition(storage, () => { reloads += 1 }), false)
  assert.equal(reloads, 0)
})

test('community client startup applies the one-time MCP position cleanup', () => {
  const values = new Map([[POSITION_KEY, JSON.stringify({ x: 482, y: 314 })]])
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  }
  let reloads = 0
  const ctx = {
    locale: { getSnapshot: () => ({ active: 'ru' }), subscribe: () => () => {} },
    effect: () => {},
  }
  const context = {
    ctx,
    localStorage: storage,
    window: { location: { reload: () => { reloads += 1 } } },
    fetch: () => Promise.resolve({ ok: true, json: async () => ({ packs: [] }) }),
    React: null,
  }
  vm.runInNewContext(`${clientSource}\napplyMultiLang(ctx)`, context)

  assert.equal(values.has(POSITION_KEY), false)
  assert.equal(values.get(MIGRATION_KEY), '1')
  assert.equal(reloads, 1)
})
