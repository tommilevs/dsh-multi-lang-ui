import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url))
const SERVER_PATH = path.join(REPO_ROOT, 'bin', 'dsh-i18n-mcp.mjs')
const NODE = process.execPath
const PLUGIN_ID = 'dsh-example'

function makePack({ locale = 'en', greeting = 'Hello {name}', extra } = {}) {
  return {
    plugin: {
      id: PLUGIN_ID,
      version: '1.2.3',
      source: 'https://example.test/dsh-example',
      license: 'MIT'
    },
    locale,
    sourceLocale: 'en',
    namespaces: { example: { greeting } },
    source: { example: { greeting: 'Hello {name}' } },
    dom: [{ selector: '.dsh-example', source: 'Exact source', target: 'Exact source' }],
    ...extra
  }
}

function makeRepository({ withSourcePack = true } = {}) {
  const repo = mkdtempSync(path.join(os.tmpdir(), 'dsh-i18n-mcp-'))
  mkdirSync(path.join(repo, '.git'))
  mkdirSync(path.join(repo, 'contributions'))
  writeFileSync(path.join(repo, 'package.json'), JSON.stringify({ name: '@tommilevs/dsh-multi-lang-ui' }))
  if (withSourcePack) {
    const pluginDirectory = path.join(repo, 'contributions', PLUGIN_ID)
    mkdirSync(pluginDirectory)
    writeFileSync(path.join(pluginDirectory, 'en.json'), JSON.stringify(makePack()))
  }
  return repo
}

function callMcp(repo, requests) {
  const messages = [
    {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'mcp-tools-test', version: '1.0.0' }
      }
    },
    { jsonrpc: '2.0', method: 'notifications/initialized', params: {} },
    ...requests
  ]
  const child = spawnSync(NODE, [SERVER_PATH, '--repo', repo], {
    input: `${messages.map((message) => JSON.stringify(message)).join('\n')}\n`,
    encoding: 'utf8',
    timeout: 10000,
    maxBuffer: 8 * 1024 * 1024
  })
  assert.equal(child.error, undefined, child.error?.message)
  assert.equal(child.status, 0, `MCP process failed (${child.status}): ${child.stderr}`)
  const responses = child.stdout.trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line))
  return new Map(responses.filter((message) => Object.hasOwn(message, 'id')).map((message) => [message.id, message]))
}

function toolRequest(id, name, args = {}) {
  return { jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: args } }
}

function toolData(response) {
  assert.ok(response, 'expected an MCP response')
  assert.equal(response.error, undefined, JSON.stringify(response.error))
  assert.equal(response.result?.isError, undefined, response.result?.content?.[0]?.text)
  return response.result?.structuredContent
}

test('stdio MCP server advertises the translation tools', (t) => {
  const repo = makeRepository()
  t.after(() => rmSync(repo, { recursive: true, force: true }))
  const responses = callMcp(repo, [
    { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} },
    toolRequest(3, 'list_translation_coverage')
  ])
  const response = responses.get(2)
  assert.deepEqual(response?.result?.tools?.map((tool) => tool.name).sort(), [
    'get_translation_source',
    'list_translation_coverage',
    'scaffold_translation_pack',
    'stage_source_catalog',
    'stage_translation_pack',
    'validate_translation_pack'
  ])
  const coverage = toolData(responses.get(3))
  assert.equal(coverage.packCount, 1)
  assert.equal(coverage.pluginCount, 1)
  assert.equal(coverage.plugins[0].id, PLUGIN_ID)
  assert.equal(coverage.plugins[0].packs[0].namespaceKeyCount, 1)
  assert.equal(coverage.plugins[0].packs[0].sourceNamespaceMapAvailable, true)
})

test('MCP coverage stops when a contribution directory exceeds the entry limit', (t) => {
  const repo = makeRepository({ withSourcePack: false })
  t.after(() => rmSync(repo, { recursive: true, force: true }))
  const pluginDirectory = path.join(repo, 'contributions', PLUGIN_ID)
  mkdirSync(pluginDirectory)
  for (let index = 0; index < 7001; index += 1) {
    writeFileSync(path.join(pluginDirectory, `ignored-${String(index).padStart(4, '0')}.txt`), '')
  }

  const response = callMcp(repo, [toolRequest(2, 'list_translation_coverage')]).get(2)
  assert.equal(response?.result?.isError, true)
  assert.match(response?.result?.content?.[0]?.text || '', /7000 directory entries/i)
})

test('a new plugin source catalog can be staged and used to scaffold a target locale', (t) => {
  const repo = makeRepository({ withSourcePack: false })
  t.after(() => rmSync(repo, { recursive: true, force: true }))
  const sourceCatalog = {
    plugin: {
      id: 'dsh-new-plugin',
      version: '0.1.0',
      source: 'https://example.test/dsh-new-plugin',
      license: 'MIT'
    },
    sourceLocale: 'de',
    namespaces: { settings: { greeting: 'Hallo {name}', save: 'Speichern' } },
    dom: [{ selector: '.dsh-new-plugin', source: 'Exact source {name}' }]
  }
  const staged = toolData(callMcp(repo, [toolRequest(2, 'stage_source_catalog', { ...sourceCatalog })]).get(2))
  assert.equal(staged.staged, true)
  assert.equal(staged.path, 'contributions/dsh-new-plugin/de.json')
  const saved = JSON.parse(readFileSync(path.join(repo, staged.path), 'utf8'))
  assert.equal(saved.locale, 'de')
  assert.equal(saved.sourceLocale, 'de')
  assert.deepEqual(saved.namespaces, sourceCatalog.namespaces)
  assert.deepEqual(saved.source, sourceCatalog.namespaces)
  assert.deepEqual(saved.dom, [{
    selector: '.dsh-new-plugin',
    source: 'Exact source {name}',
    target: 'Exact source {name}'
  }])

  const draft = toolData(callMcp(repo, [toolRequest(2, 'scaffold_translation_pack', {
    pluginId: 'dsh-new-plugin',
    locale: 'fr'
  })]).get(2)).pack
  assert.equal(draft.plugin.id, sourceCatalog.plugin.id)
  assert.equal(draft.sourceLocale, 'de')
  assert.match(draft.namespaces.settings.greeting, /⟦TRANSLATE: Hallo \{name\}/)
  assert.match(draft.dom[0].target, /⟦TRANSLATE: Exact source \{name\}/)
})

test('source catalog staging rejects unknown fields and refuses an existing source locale pack', (t) => {
  const repo = makeRepository({ withSourcePack: false })
  t.after(() => rmSync(repo, { recursive: true, force: true }))
  const sourceCatalog = {
    plugin: {
      id: 'dsh-new-plugin',
      version: '0.1.0',
      source: 'https://example.test/dsh-new-plugin',
      license: 'MIT'
    },
    sourceLocale: 'de',
    namespaces: { settings: { greeting: 'Hallo {name}' } }
  }
  const unexpected = callMcp(repo, [toolRequest(2, 'stage_source_catalog', {
    ...sourceCatalog,
    executable: 'must not be accepted'
  })]).get(2)
  assert.equal(unexpected?.result?.isError, true)
  assert.match(unexpected?.result?.content?.[0]?.text || '', /Invalid arguments.*Unrecognized key/i)
  assert.equal(existsSync(path.join(repo, 'contributions', 'dsh-new-plugin', 'de.json')), false)

  const staged = toolData(callMcp(repo, [toolRequest(2, 'stage_source_catalog', sourceCatalog)]).get(2))
  assert.equal(staged.staged, true)
  const refused = toolData(callMcp(repo, [toolRequest(2, 'stage_source_catalog', sourceCatalog)]).get(2))
  assert.equal(refused.staged, false)
  assert.match(refused.error, /already exists/i)
})

test('source retrieval returns exact namespace values and scoped DOM source text', (t) => {
  const repo = makeRepository()
  t.after(() => rmSync(repo, { recursive: true, force: true }))
  const response = callMcp(repo, [toolRequest(2, 'get_translation_source', { pluginId: PLUGIN_ID })]).get(2)
  const data = toolData(response)
  assert.equal(data.sourceLocale, 'en')
  assert.equal(data.namespaces.example.greeting, 'Hello {name}')
  assert.deepEqual(data.dom, [{ selector: '.dsh-example', source: 'Exact source' }])
})

test('DOM-only source catalogs report no namespace source map while preserving DOM mappings', (t) => {
  const repo = makeRepository({ withSourcePack: false })
  t.after(() => rmSync(repo, { recursive: true, force: true }))
  const sourcePack = makePack({ locale: 'zh', extra: { namespaces: {}, source: undefined } })
  sourcePack.sourceLocale = 'zh'
  mkdirSync(path.join(repo, 'contributions', PLUGIN_ID))
  writeFileSync(path.join(repo, 'contributions', PLUGIN_ID, 'zh.json'), JSON.stringify(sourcePack))

  const data = toolData(callMcp(repo, [toolRequest(2, 'get_translation_source', { pluginId: PLUGIN_ID })]).get(2))
  assert.equal(data.sourceNamespaceMapAvailable, false)
  assert.deepEqual(data.namespaces, null)
  assert.equal(data.dom.length, 1)
})

test('scaffolding marks every target as a draft and the validator rejects it', (t) => {
  const repo = makeRepository()
  t.after(() => rmSync(repo, { recursive: true, force: true }))
  const responses = callMcp(repo, [toolRequest(2, 'scaffold_translation_pack', { pluginId: PLUGIN_ID, locale: 'ru' })])
  const draft = toolData(responses.get(2)).pack
  assert.match(draft.namespaces.example.greeting, /⟦TRANSLATE:/)
  assert.equal(draft.dom[0].target.includes('⟦TRANSLATE:'), true)

  const validation = callMcp(repo, [toolRequest(2, 'validate_translation_pack', { pack: draft })]).get(2)
  const result = toolData(validation)
  assert.equal(result.valid, false)
  assert.ok(result.errors.some((error) => /draft placeholder/i.test(error)))
})

test('validation reports placeholder mismatches and unsupported pack properties', (t) => {
  const repo = makeRepository()
  t.after(() => rmSync(repo, { recursive: true, force: true }))
  const invalid = makePack({ locale: 'ru', greeting: 'Здравствуйте', extra: { executable: 'must not be accepted' } })
  invalid.source.example.missing = 'This key has no translation'
  const response = callMcp(repo, [toolRequest(2, 'validate_translation_pack', { pack: invalid })]).get(2)
  const result = toolData(response)
  assert.equal(result.valid, false)
  assert.ok(result.errors.some((error) => /placeholder mismatch/i.test(error)))
  assert.ok(result.errors.some((error) => /source and translation keys differ/i.test(error)))
  assert.ok(result.errors.some((error) => /unsupported/i.test(error)))
})

test('validation rejects a namespace key already used by another pack in the same locale', (t) => {
  const repo = makeRepository()
  t.after(() => rmSync(repo, { recursive: true, force: true }))
  const duplicate = makePack()
  duplicate.plugin.id = 'dsh-another-plugin'
  duplicate.plugin.source = 'https://example.test/dsh-another-plugin'
  const response = callMcp(repo, [toolRequest(2, 'validate_translation_pack', { pack: duplicate })]).get(2)
  const result = toolData(response)
  assert.equal(result.valid, false)
  assert.ok(result.errors.some((error) => /duplicate locale namespace\/key.*example\.greeting/i.test(error)))
})

test('valid packs are staged only under contributions and can be explicitly overwritten', (t) => {
  const repo = makeRepository()
  t.after(() => rmSync(repo, { recursive: true, force: true }))
  const pack = makePack({ locale: 'ru', greeting: 'Привет {name}', extra: { dom: undefined } })
  delete pack.dom
  const target = path.join(repo, 'contributions', PLUGIN_ID, 'ru.json')
  const first = toolData(callMcp(repo, [toolRequest(2, 'stage_translation_pack', { pack })]).get(2))
  assert.equal(first.staged, true)
  assert.equal(first.path, `contributions/${PLUGIN_ID}/ru.json`)
  assert.deepEqual(JSON.parse(readFileSync(target, 'utf8')), pack)

  const changed = { ...pack, namespaces: { example: { greeting: 'Здравствуйте, {name}' } } }
  const refused = toolData(callMcp(repo, [toolRequest(2, 'stage_translation_pack', { pack: changed })]).get(2))
  assert.equal(refused.staged, false)
  assert.match(refused.error, /already exists/i)
  assert.deepEqual(JSON.parse(readFileSync(target, 'utf8')), pack)

  const replaced = toolData(callMcp(repo, [toolRequest(2, 'stage_translation_pack', { pack: changed, overwrite: true })]).get(2))
  assert.equal(replaced.staged, true)
  assert.deepEqual(JSON.parse(readFileSync(target, 'utf8')), changed)
  assert.equal(existsSync(path.join(repo, 'outside.json')), false)
})

test('staging rejects traversal and leaves paths outside contributions untouched', (t) => {
  const repo = makeRepository()
  t.after(() => rmSync(repo, { recursive: true, force: true }))
  const outside = path.resolve(repo, 'contributions', '../../outside', 'ru.json')
  const malicious = makePack({ locale: 'ru', extra: undefined })
  malicious.plugin.id = '../../outside'
  delete malicious.extra
  const result = toolData(callMcp(repo, [toolRequest(2, 'stage_translation_pack', { pack: malicious })]).get(2))
  assert.equal(result.staged, false)
  assert.equal(existsSync(outside), false)
  assert.equal(existsSync(path.join(repo, 'contributions', 'outside.json')), false)
})

test('staging rejects symlinked plugin directories', (t) => {
  const repo = makeRepository({ withSourcePack: false })
  const outside = mkdtempSync(path.join(os.tmpdir(), 'dsh-i18n-outside-'))
  t.after(() => {
    rmSync(repo, { recursive: true, force: true })
    rmSync(outside, { recursive: true, force: true })
  })
  try {
    symlinkSync(outside, path.join(repo, 'contributions', PLUGIN_ID), 'junction')
  } catch (error) {
    if (['EPERM', 'EACCES', 'ENOTSUP', 'EINVAL'].includes(error.code)) {
      t.skip(`directory symlinks are unavailable in this environment: ${error.code}`)
      return
    }
    throw error
  }

  const pack = makePack({ locale: 'ru' })
  const result = toolData(callMcp(repo, [toolRequest(2, 'stage_translation_pack', { pack })]).get(2))
  assert.equal(result.staged, false)
  assert.match(result.errors.join(' '), /symbolic link|symlink/i)
  assert.deepEqual(readdirSync(outside), [])
})

test('an empty contributions tree has zero coverage and accepts its first valid pack', (t) => {
  const repo = makeRepository({ withSourcePack: false })
  t.after(() => rmSync(repo, { recursive: true, force: true }))
  const responses = callMcp(repo, [
    toolRequest(2, 'list_translation_coverage'),
    toolRequest(3, 'stage_translation_pack', { pack: makePack({ locale: 'ru', greeting: 'Привет {name}' }) })
  ])
  assert.deepEqual(toolData(responses.get(2)), { packCount: 0, pluginCount: 0, plugins: [] })
  assert.equal(toolData(responses.get(3)).staged, true)
})
