import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { mergeTranslationPacks, readTranslationPacks, validateTranslationPack } from '../lib/contributions.js'

const pack = (overrides = {}) => ({
  plugin: {
    id: 'example-plugin',
    version: '1.2.3',
    source: 'https://github.com/example/example-plugin',
    license: 'MIT',
  },
  locale: 'ru',
  sourceLocale: 'en',
  source: { 'example-namespace': { greet: 'Hello, {name}!' } },
  namespaces: { 'example-namespace': { greet: 'Привет, {name}!' } },
  dom: [{ selector: '.example-root', source: 'Open {name}', target: 'Открыть {name}' }],
  ...overrides,
})

test('accepts a bilingual namespace and scoped DOM pack', () => {
  assert.deepEqual(validateTranslationPack(pack()), [])
})

test('allows DOM-only packs but rejects empty translation namespaces', () => {
  const domOnly = pack({ namespaces: {}, source: undefined })
  assert.deepEqual(validateTranslationPack(domOnly), [])
  assert.ok(validateTranslationPack(pack({ namespaces: { empty: {} } })).some((issue) => issue.includes('at least one key')))
  assert.ok(validateTranslationPack(pack({ namespaces: {}, source: undefined, dom: [] })).some((issue) => issue.includes('DOM mappings')))
})

test('rejects placeholder mismatches and unsafe DOM selectors', () => {
  const issues = validateTranslationPack(pack({
    namespaces: { 'example-namespace': { greet: 'Здравствуйте!' } },
    dom: [{ selector: 'body', source: 'Open {name}', target: 'Открыть' }],
  }))
  assert.ok(issues.some((issue) => issue.includes('placeholder')))
  assert.ok(issues.some((issue) => issue.includes('selector')))
})

test('accepts every established plugin DOM root', () => {
  const selectors = [
    '.example-root',
    '[data-dsh-plugin="usage"]',
    '[data-dsh-plugin="session-archive"] .title',
    '[data-dsh-pet-root]',
    '#settings-pet-pet',
    'section[aria-labelledby="vision-title"]',
    'section[aria-labelledby="compact-title"]',
    'p[role="alert"]',
  ]
  for (const selector of selectors) {
    assert.deepEqual(validateTranslationPack(pack({ dom: [{ selector, source: 'Open', target: 'Открыть' }] })), [], selector)
  }
})

test('rejects global and unrecognized DOM roots', () => {
  const selectors = [
    'body', 'html', '*', '.example-root body', '.example-root > html', '.example-root *',
    '[data-arbitrary="usage"]', 'section[aria-labelledby="other-title"]', '#settings-other',
    'p[role="status"]', '[data-dsh-plugin="usage"],body',
  ]
  for (const selector of selectors) {
    const issues = validateTranslationPack(pack({ dom: [{ selector, source: 'Open', target: 'Открыть' }] }))
    assert.ok(issues.some((issue) => issue.includes('selector')), selector)
  }
})

test('loads every shipped contribution JSON pack without skipping any', () => {
  const root = fileURLToPath(new URL('../contributions/', import.meta.url))
  const shipped = []
  const walk = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const filename = path.join(directory, entry.name)
      if (entry.isDirectory()) walk(filename)
      else if (entry.isFile() && entry.name.endsWith('.json')) {
        const value = JSON.parse(readFileSync(filename, 'utf8'))
        assert.deepEqual(validateTranslationPack(value), [], path.relative(root, filename))
        shipped.push(value)
      }
    }
  }
  walk(root)
  assert.ok(shipped.length >= 18)
  const identity = (value) => `${value.plugin.id}:${value.locale}`
  assert.deepEqual(readTranslationPacks(root).map(identity).sort(), shipped.map(identity).sort())
})

test('merges matching locale packs and reports collisions deterministically', () => {
  const result = mergeTranslationPacks([
    pack(),
    pack({
      plugin: { ...pack().plugin, id: 'second-plugin' },
      namespaces: { 'example-namespace': { greet: 'Здравствуй, {name}!' } },
      dom: [],
    }),
    pack({ locale: 'fr' }),
  ], 'ru')

  assert.equal(result.dictionaries['example-namespace'].greet, 'Здравствуй, {name}!')
  assert.equal(result.dom.length, 1)
  assert.deepEqual(result.conflicts, [{
    locale: 'ru', namespace: 'example-namespace', key: 'greet',
    previousPlugin: 'example-plugin', plugin: 'second-plugin',
  }])
})

test('does not accept prototype-pollution keys', () => {
  const bad = JSON.parse('{"plugin":{"id":"example-plugin","version":"1","source":"https://example.test","license":"MIT"},"locale":"ru","sourceLocale":"en","namespaces":{"safe":{"__proto__":"polluted"}}}')
  assert.ok(validateTranslationPack(bad).some((issue) => issue.includes('unsafe key')))
})

test('reads scoped and unscoped locale packs from nested contribution folders', (t) => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'dsh-i18n-runtime-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  mkdirSync(path.join(root, 'plain-plugin'), { recursive: true })
  mkdirSync(path.join(root, '@example', 'scoped-plugin'), { recursive: true })
  writeFileSync(path.join(root, 'plain-plugin', 'ru.json'), JSON.stringify(pack({
    plugin: { ...pack().plugin, id: 'plain-plugin' },
  })))
  writeFileSync(path.join(root, '@example', 'scoped-plugin', 'de.json'), JSON.stringify(pack({
    plugin: { ...pack().plugin, id: '@example/scoped-plugin' },
    locale: 'de',
    namespaces: { 'example-namespace': { greet: 'Hallo, {name}!' } },
  })))

  const result = readTranslationPacks(root)
  assert.deepEqual(result.map((item) => `${item.plugin.id}:${item.locale}`), [
    '@example/scoped-plugin:de',
    'plain-plugin:ru',
  ])
})
