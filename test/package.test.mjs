import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))

test('published MCP binary includes its trusted locale validator dependency', () => {
  assert.ok(packageJson.files.includes('scripts/validate-locales.mjs'))
  assert.ok(packageJson.files.includes('lib'))
  assert.ok(packageJson.files.includes('bin'))
  assert.equal(packageJson.bin['dsh-i18n-mcp'], './bin/dsh-i18n-mcp.mjs')
})
