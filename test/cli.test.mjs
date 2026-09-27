import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const cli = path.join(repoRoot, 'bin', 'dsh-i18n.mjs')

function pack(pluginId, locale) {
  return {
    plugin: {
      id: pluginId,
      version: '2.0.0',
      source: 'https://github.com/example/plugin',
      license: 'Apache-2.0',
    },
    locale,
    sourceLocale: 'en',
    namespaces: { settings: { title: 'Настройки', save: 'Сохранить' } },
    source: { settings: { title: 'Settings', save: 'Save' } },
    dom: [{ selector: '.example-root', source: 'Open', target: 'Открыть' }],
  }
}

function withContributions(t, callback) {
  const temp = mkdtempSync(path.join(os.tmpdir(), 'dsh-i18n-coverage-'))
  const contributions = path.join(temp, 'contributions')
  mkdirSync(contributions)
  t.after(() => rmSync(temp, { recursive: true, force: true }))
  callback(contributions)
  return contributions
}

function writePack(contributions, directory, filenameLocale, value) {
  const targetDirectory = path.join(contributions, directory)
  mkdirSync(targetDirectory, { recursive: true })
  writeFileSync(path.join(targetDirectory, `${filenameLocale}.json`), `${JSON.stringify(value, null, 2)}\n`)
}

function run(...args) {
  return spawnSync(process.execPath, [cli, 'coverage', ...args], { encoding: 'utf8' })
}

test('coverage --json reports sorted pack counts for the requested contribution directory', (t) => {
  const contributions = withContributions(t, (directory) => {
    writePack(directory, '@example/dsh-panel', 'ru', pack('@example/dsh-panel', 'ru'))
    writePack(directory, 'dsh-plain', 'en', pack('dsh-plain', 'en'))
  })

  const result = run(contributions, '--json')
  assert.equal(result.status, 0, result.stderr)
  const inventory = JSON.parse(result.stdout)
  assert.equal(inventory.packCount, 2)
  assert.equal(inventory.pluginCount, 2)
  assert.deepEqual(inventory.plugins.map((plugin) => plugin.id), ['@example/dsh-panel', 'dsh-plain'])
  assert.deepEqual(inventory.plugins[0].packs[0], {
    locale: 'ru',
    sourceLocale: 'en',
    version: '2.0.0',
    source: 'https://github.com/example/plugin',
    license: 'Apache-2.0',
    namespaceKeyCount: 2,
    namespaces: { settings: 2 },
    domMappingCount: 1,
    sourceNamespaceMapAvailable: true,
  })
})

test('human coverage output includes metadata and raw counts without whole-plugin percentages', (t) => {
  const contributions = withContributions(t, (directory) => {
    writePack(directory, 'dsh-plain', 'ru', pack('dsh-plain', 'ru'))
  })

  const result = run(contributions)
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /Locale packs: 1/)
  assert.match(result.stdout, /Plugins: 1/)
  assert.match(result.stdout, /dsh-plain.*v2\.0\.0/)
  assert.match(result.stdout, /Apache-2\.0/)
  assert.match(result.stdout, /ru.*2 namespace keys.*1 DOM mapping/)
  assert.match(result.stdout, /source namespace map: available/i)
  assert.doesNotMatch(result.stdout, /%|percent|coverage rate/i)
})

test('coverage --json lists invalid packs instead of omitting them from the inventory', (t) => {
  const contributions = withContributions(t, (directory) => {
    writePack(directory, 'dsh-plain', 'ru', pack('dsh-plain', 'ru'))
    const invalidDirectory = path.join(directory, 'dsh-broken')
    mkdirSync(invalidDirectory, { recursive: true })
    writeFileSync(path.join(invalidDirectory, 'ru.json'), '{not json')
  })

  const result = run(contributions, '--json')
  assert.equal(result.status, 0, result.stderr)
  const inventory = JSON.parse(result.stdout)
  assert.equal(inventory.packCount, 1)
  assert.ok(Array.isArray(inventory.skippedPacks), 'invalid packs are included in the CLI result')
  assert.equal(inventory.skippedPacks.length, 1)
  assert.equal(inventory.skippedPacks[0].path, 'dsh-broken/ru.json')
  assert.match(inventory.skippedPacks[0].reasons.join(' '), /invalid JSON/i)

  const humanResult = run(contributions)
  assert.equal(humanResult.status, 0, humanResult.stderr)
  assert.match(humanResult.stdout, /Skipped or invalid packs: 1/)
  assert.match(humanResult.stdout, /dsh-broken\/ru\.json.*invalid JSON/i)
})

test('coverage includes a valid pack smaller than the shared one-megabyte limit', (t) => {
  const contributions = withContributions(t, (directory) => {
    const largePack = pack('dsh-large', 'ru')
    delete largePack.source
    largePack.namespaces.settings.title = 'A'.repeat(600 * 1024)
    writePack(directory, 'dsh-large', 'ru', largePack)
  })

  const result = run(contributions, '--json')
  assert.equal(result.status, 0, result.stderr)
  assert.equal(JSON.parse(result.stdout).packCount, 1)
})

test('human coverage output escapes terminal control characters from pack metadata', (t) => {
  const contributions = withContributions(t, (directory) => {
    const value = pack('dsh-plain', 'ru')
    value.plugin.version = '2.0.0\u001b[2J'
    writePack(directory, 'dsh-plain', 'ru', value)
  })

  const result = run(contributions)
  assert.equal(result.status, 0, result.stderr)
  assert.doesNotMatch(result.stdout, /\u001b/)
  assert.match(result.stdout, /2\.0\.0\\u001B\[2J/)
})

test('human coverage output flags conflicting metadata and shows it per locale', (t) => {
  const contributions = withContributions(t, (directory) => {
    const english = pack('dsh-plain', 'en')
    english.plugin.version = '1.0.0'
    writePack(directory, 'dsh-plain', 'en', english)
    const russian = pack('dsh-plain', 'ru')
    russian.plugin.version = '2.0.0'
    russian.plugin.license = 'Apache-2.0'
    writePack(directory, 'dsh-plain', 'ru', russian)
  })

  const result = run(contributions)
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /metadata differs between locale packs/i)
  assert.match(result.stdout, /en .*metadata: v1\.0\.0 — Apache-2\.0/)
  assert.match(result.stdout, /ru .*metadata: v2\.0\.0 — Apache-2\.0/)
})

test('coverage --json escapes DEL and C1 controls while preserving valid JSON', (t) => {
  const contributions = withContributions(t, (directory) => {
    const value = pack('dsh-plain', 'ru')
    const controlKey = 'control\u009Bname\u007F'
    value.namespaces[controlKey] = { greeting: 'Value' }
    value.source[controlKey] = { greeting: 'Value' }
    writePack(directory, 'dsh-plain', 'ru', value)
  })

  const result = run(contributions, '--json')
  assert.equal(result.status, 0, result.stderr)
  assert.doesNotMatch(result.stdout, /[\u007F-\u009F]/)
  assert.match(result.stdout, /control\\u009Bname\\u007F/)
  const inventory = JSON.parse(result.stdout)
  assert.equal(inventory.plugins[0].packs[0].namespaces['control\u009Bname\u007F'], 1)
})
