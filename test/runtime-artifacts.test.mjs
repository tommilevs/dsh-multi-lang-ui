import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { generateBugReportSnippet } from '../lib/pure.js'

const libDir = fileURLToPath(new URL('../lib/', import.meta.url))
const runtimeFiles = readdirSync(libDir, { withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith('.js'))
  .map((entry) => join(libDir, entry.name))

test('all shipped JavaScript runtime artifacts are complete parseable modules', () => {
  const failures = runtimeFiles.flatMap((file) => {
    const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' })
    return result.status === 0 ? [] : [{ file, status: result.status, stderr: result.stderr.trim() }]
  })

  assert.deepEqual(failures, [], 'runtime JavaScript artifacts must not be truncated or syntactically invalid')
})

test('browser translation reports use the current package version', () => {
  const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  const bundle = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')

  assert.ok(bundle.includes(packageJson.version), 'built client should contain the manifest version')
  assert.ok(!bundle.includes('0.3.9'), 'built client must not report the inherited upstream version')
  assert.ok(
    generateBugReportSnippet({ key: 'test' }).includes(`@v${packageJson.version}`),
    'host-generated reports should default to the manifest version',
  )
})
