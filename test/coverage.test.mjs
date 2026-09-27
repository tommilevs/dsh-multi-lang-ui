import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { buildCoverageInventory, readCoveragePacks } from '../lib/coverage.js'

function pack(pluginId, locale, overrides = {}) {
  const source = {
    common: { greeting: 'Hello', save: 'Save' },
    settings: { title: 'Settings' },
  }
  return {
    plugin: {
      id: pluginId,
      version: '1.2.3',
      source: `https://github.com/example/${pluginId.split('/').at(-1)}`,
      license: 'MIT',
    },
    locale,
    sourceLocale: 'en',
    namespaces: {
      common: { greeting: 'Привет', save: 'Сохранить' },
      settings: { title: 'Настройки' },
    },
    source,
    dom: [{ selector: '.example-root', source: 'Open', target: 'Открыть' }],
    ...overrides,
  }
}

test('builds deterministic scoped and unscoped coverage with per-locale counts and metadata', () => {
  const scoped = pack('@example/dsh-panel', 'ru')
  const domOnly = pack('dsh-plain', 'fr', {
    sourceLocale: 'zh',
    namespaces: {},
    source: undefined,
    dom: [
      { selector: '.example-root', source: 'Open', target: 'Ouvrir' },
      { selector: '.example-root', source: 'Close', target: 'Fermer' },
    ],
  })

  const expected = {
    packCount: 2,
    pluginCount: 2,
    plugins: [
      {
        id: '@example/dsh-panel',
        version: '1.2.3',
        source: 'https://github.com/example/dsh-panel',
        license: 'MIT',
        metadataConflict: false,
        locales: ['ru'],
        packs: [{
          locale: 'ru',
          sourceLocale: 'en',
          version: '1.2.3',
          source: 'https://github.com/example/dsh-panel',
          license: 'MIT',
          namespaceKeyCount: 3,
          namespaces: { common: 2, settings: 1 },
          domMappingCount: 1,
          sourceNamespaceMapAvailable: true,
        }],
      },
      {
        id: 'dsh-plain',
        version: '1.2.3',
        source: 'https://github.com/example/dsh-plain',
        license: 'MIT',
        metadataConflict: false,
        locales: ['fr'],
        packs: [{
          locale: 'fr',
          sourceLocale: 'zh',
          version: '1.2.3',
          source: 'https://github.com/example/dsh-plain',
          license: 'MIT',
          namespaceKeyCount: 0,
          namespaces: {},
          domMappingCount: 2,
          sourceNamespaceMapAvailable: false,
        }],
      },
    ],
  }

  assert.deepEqual(buildCoverageInventory([scoped, domOnly]), expected)
  assert.deepEqual(buildCoverageInventory([domOnly, scoped]), expected)
})

test('uses the source-language pack when a translation pack does not embed a source map', () => {
  const sourcePack = pack('dsh-catalog', 'en', {
    source: undefined,
    dom: [],
    namespaces: { settings: { save: 'Save', title: 'Settings' } },
  })
  const germanPack = pack('dsh-catalog', 'de', {
    source: undefined,
    dom: [],
    namespaces: { settings: { save: 'Speichern', title: 'Einstellungen' } },
  })

  const inventory = buildCoverageInventory([germanPack, sourcePack])

  assert.deepEqual(inventory.plugins[0].packs.map(({ locale, sourceNamespaceMapAvailable }) => ({ locale, sourceNamespaceMapAvailable })), [
    { locale: 'de', sourceNamespaceMapAvailable: true },
    { locale: 'en', sourceNamespaceMapAvailable: true },
  ])
})

test('does not report source strings as available when source maps disagree', () => {
  const sourcePack = pack('dsh-conflicting-source', 'en', {
    source: undefined,
    namespaces: { settings: { title: 'Settings' } },
  })
  const translatedPack = pack('dsh-conflicting-source', 'ru', {
    source: { settings: { title: 'Preferences' } },
    namespaces: { settings: { title: 'Настройки' } },
  })

  const inventory = buildCoverageInventory([sourcePack, translatedPack])

  assert.ok(inventory.plugins[0].packs.every((item) => item.sourceNamespaceMapAvailable === false))
})

test('sorts locales and namespace names deterministically', () => {
  const result = buildCoverageInventory([
    pack('dsh-order', 'ru', {
      namespaces: { zeta: { z: 'Z' }, alpha: { b: 'B', a: 'A' } },
      source: { zeta: { z: 'Z' }, alpha: { b: 'B', a: 'A' } },
      dom: [],
    }),
    pack('dsh-order', 'en'),
    pack('dsh-order', 'de'),
  ])

  assert.deepEqual(result.plugins[0].locales, ['de', 'en', 'ru'])
  assert.deepEqual(result.plugins[0].packs[2].namespaces, { alpha: 2, zeta: 1 })
})

test('surfaces duplicate plugin and locale identities instead of counting them twice', () => {
  assert.throws(
    () => buildCoverageInventory([
      pack('@Example/dsh-panel', 'pt-BR'),
      pack('@example/dsh-panel', 'pt-br'),
    ]),
    /duplicate.*@example\/dsh-panel.*pt-br/i,
  )
})

test('groups plugin ids case-insensitively and preserves per-locale metadata conflicts', () => {
  const english = pack('@Example/dsh-panel', 'en', {
    plugin: {
      id: '@Example/dsh-panel',
      version: '1.2.3',
      source: 'https://github.com/example/old-panel',
      license: 'MIT',
    },
  })
  const russian = pack('@example/dsh-panel', 'ru', {
    plugin: {
      id: '@example/dsh-panel',
      version: '2.0.0',
      source: 'https://github.com/example/dsh-panel',
      license: 'Apache-2.0',
    },
  })

  const inventory = buildCoverageInventory([russian, english])
  assert.equal(inventory.pluginCount, 1)
  assert.equal(inventory.plugins[0].id, '@example/dsh-panel')
  assert.equal(inventory.plugins[0].metadataConflict, true)
  assert.deepEqual(inventory.plugins[0].packs.map(({ locale, version, source, license }) => ({ locale, version, source, license })), [
    { locale: 'en', version: '1.2.3', source: 'https://github.com/example/old-panel', license: 'MIT' },
    { locale: 'ru', version: '2.0.0', source: 'https://github.com/example/dsh-panel', license: 'Apache-2.0' },
  ])
})

test('coverage reader stops before retaining diagnostics for an oversized directory', (t) => {
  const temp = mkdtempSync(path.join(os.tmpdir(), 'dsh-coverage-limits-'))
  const contributions = path.join(temp, 'contributions')
  const pluginDirectory = path.join(contributions, 'example-plugin')
  mkdirSync(pluginDirectory, { recursive: true })
  t.after(() => rmSync(temp, { recursive: true, force: true }))
  for (let index = 0; index < 7001; index += 1) {
    writeFileSync(path.join(pluginDirectory, `ignored-${String(index).padStart(4, '0')}.txt`), '')
  }

  assert.throws(() => readCoveragePacks(contributions), /7000 directory entries/i)
})

test('coverage excludes packs with unsupported executable metadata', (t) => {
  const temp = mkdtempSync(path.join(os.tmpdir(), 'dsh-coverage-schema-'))
  const contributions = path.join(temp, 'contributions')
  const pluginDirectory = path.join(contributions, 'example-plugin')
  mkdirSync(pluginDirectory, { recursive: true })
  t.after(() => rmSync(temp, { recursive: true, force: true }))
  writeFileSync(path.join(pluginDirectory, 'ru.json'), JSON.stringify(pack('example-plugin', 'ru', { executable: 'not allowed' })))

  const result = readCoveragePacks(contributions)

  assert.deepEqual(result.packs, [])
  assert.equal(result.skippedPacks.length, 1)
  assert.match(result.skippedPacks[0].reasons.join(' '), /unsupported properties.*executable/i)
})
