import {
  closeSync,
  existsSync,
  fsyncSync,
  linkSync,
  lstatSync,
  mkdirSync,
  openSync,
  opendirSync,
  readFileSync,
  realpathSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { buildCoverageInventory } from './coverage.js'
import { validateTranslationPack as validatePack } from './contributions.js'
import { validateLocales } from '../scripts/validate-locales.mjs'

const PACKAGE_NAME = '@tommilevs/dsh-multi-lang-ui'
const PLUGIN_ID_PATTERN = /^(?:@[a-z0-9._-]+\/)?[a-z0-9][a-z0-9._-]*$/i
const LOCALE_PATTERN = /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/
const MAX_PLUGIN_ID_LENGTH = 200
const MAX_LOCALE_LENGTH = 35
const MAX_PACK_BYTES = 1024 * 1024
const MAX_CATALOG_BYTES = 32 * 1024 * 1024
const MAX_PACK_COUNT = 2000
const MAX_DIRECTORY_DEPTH = 2
const MAX_DIRECTORY_ENTRIES = 7000
const ALLOWED_PACK_FIELDS = ['plugin', 'locale', 'sourceLocale', 'namespaces', 'source', 'dom']
const ALLOWED_PLUGIN_FIELDS = ['id', 'version', 'source', 'license']
const ALLOWED_DOM_FIELDS = ['selector', 'source', 'target']
const TRANSLATION_DRAFT_MARKER = '⟦TRANSLATE:'

const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
const hasOnlyKeys = (value, allowed) => isRecord(value) && Object.keys(value).every((key) => allowed.includes(key))
const compareText = (left, right) => (left < right ? -1 : left > right ? 1 : 0)

function within(parent, candidate) {
  const relative = path.relative(parent, candidate)
  return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))
}

function assertRealDirectory(directory, label) {
  let info
  try {
    info = lstatSync(directory)
  } catch (error) {
    throw new Error(`${label} is not available: ${error.message}`)
  }
  if (info.isSymbolicLink()) throw new Error(`${label} must not be a symbolic link`)
  if (!info.isDirectory()) throw new Error(`${label} must be a directory`)
  return realpathSync(directory)
}

function resolveRepositoryRoot(repoPath) {
  if (typeof repoPath !== 'string' || repoPath.trim() === '') {
    throw new Error('Pass an explicit --repo path to a Git checkout of this repository')
  }
  const requested = path.resolve(repoPath)
  const root = assertRealDirectory(requested, 'Repository path')
  const gitPath = path.join(root, '.git')
  let gitInfo
  try {
    gitInfo = lstatSync(gitPath)
  } catch {
    throw new Error('--repo must point to a Git checkout, not an installed package directory')
  }
  if (gitInfo.isSymbolicLink() || (!gitInfo.isDirectory() && !gitInfo.isFile())) {
    throw new Error('Repository .git entry must be a real directory or worktree file')
  }

  const packagePath = path.join(root, 'package.json')
  const packageInfo = lstatSync(packagePath)
  if (packageInfo.isSymbolicLink() || !packageInfo.isFile() || packageInfo.size > 32 * 1024) {
    throw new Error('Repository package.json must be a small regular file')
  }
  let packageData
  try {
    packageData = JSON.parse(readFileSync(packagePath, 'utf8'))
  } catch {
    throw new Error('Repository package.json is invalid')
  }
  if (packageData.name !== PACKAGE_NAME) {
    throw new Error(`--repo must be the ${PACKAGE_NAME} checkout`)
  }

  const contributions = assertRealDirectory(path.join(root, 'contributions'), 'contributions directory')
  if (!within(root, contributions) || path.dirname(contributions) !== root || path.basename(contributions) !== 'contributions') {
    throw new Error('contributions directory must be a direct, non-symlink child of the repository')
  }
  return { root, contributions, packageData }
}

function enumerateContributionFiles(contributionsRoot) {
  assertRealDirectory(contributionsRoot, 'contributions directory')
  const files = []
  let totalBytes = 0
  let directoryEntryCount = 0

  function visit(directory, depth) {
    if (depth > MAX_DIRECTORY_DEPTH) throw new Error(`contributions directory nesting exceeds ${MAX_DIRECTORY_DEPTH} levels`)
    const handle = opendirSync(directory)
    const entries = []
    try {
      let entry
      while ((entry = handle.readSync()) !== null) {
        directoryEntryCount += 1
        if (directoryEntryCount > MAX_DIRECTORY_ENTRIES) {
          throw new Error(`contributions exceeds ${MAX_DIRECTORY_ENTRIES} directory entries`)
        }
        entries.push(entry)
      }
    } finally {
      handle.closeSync()
    }
    entries.sort((left, right) => compareText(left.name, right.name))
    for (const entry of entries) {
      const absolute = path.join(directory, entry.name)
      const info = lstatSync(absolute)
      const relative = path.relative(contributionsRoot, absolute).split(path.sep).join('/')
      if (info.isSymbolicLink()) throw new Error(`${relative}: symbolic links are not allowed`)
      if (info.isDirectory()) {
        visit(absolute, depth + 1)
        continue
      }
      if (!info.isFile()) throw new Error(`${relative}: unsupported filesystem entry`)
      if (!entry.name.toLowerCase().endsWith('.json')) throw new Error(`${relative}: only JSON locale packs are allowed`)
      if (info.size > MAX_PACK_BYTES) throw new Error(`${relative}: locale pack exceeds the ${MAX_PACK_BYTES}-byte limit`)
      totalBytes += info.size
      if (totalBytes > MAX_CATALOG_BYTES) throw new Error(`contributions exceeds the ${MAX_CATALOG_BYTES}-byte read limit`)
      files.push({ absolute, relative, size: info.size })
      if (files.length > MAX_PACK_COUNT) throw new Error(`contributions exceeds the ${MAX_PACK_COUNT}-pack read limit`)
    }
  }

  visit(contributionsRoot, 0)
  return files
}

function readPackCatalog(contributionsRoot) {
  const files = enumerateContributionFiles(contributionsRoot)
  if (files.length) {
    const validation = validateLocales(contributionsRoot)
    if (validation.errors.length) {
      throw new Error(`Contribution catalog validation failed: ${validation.errors.slice(0, 12).join('; ')}`)
    }
  }

  const packs = files.map(({ absolute, relative }) => {
    let pack
    try {
      pack = JSON.parse(readFileSync(absolute, 'utf8'))
    } catch (error) {
      throw new Error(`${relative}: could not read JSON pack: ${error.message}`)
    }
    return pack
  })
  // The inventory builder also fails closed if two files claim one plugin/locale identity.
  buildCoverageInventory(packs)
  return packs
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  if (!isRecord(value)) return JSON.stringify(value)
  return `{${Object.keys(value).sort(compareText).map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`
}

function sortedStringMap(value) {
  const output = {}
  for (const namespace of Object.keys(value || {}).sort(compareText)) {
    const entries = {}
    for (const key of Object.keys(value[namespace] || {}).sort(compareText)) entries[key] = value[namespace][key]
    output[namespace] = entries
  }
  return output
}

function validatePackShape(pack) {
  const errors = []
  let serialized
  try {
    serialized = `${JSON.stringify(pack, null, 2)}\n`
  } catch (error) {
    return { errors: [`pack is not JSON serializable: ${error.message}`] }
  }
  if (serialized === undefined) return { errors: ['pack must be a JSON object'] }
  const sizeBytes = Buffer.byteLength(serialized, 'utf8')
  if (sizeBytes > MAX_PACK_BYTES) return { errors: [`pack exceeds the ${MAX_PACK_BYTES}-byte limit when serialized for staging`], sizeBytes }
  if (!isRecord(pack)) return { errors: ['pack must be a JSON object'], sizeBytes }

  if (!hasOnlyKeys(pack, ALLOWED_PACK_FIELDS)) {
    errors.push(`pack has unsupported properties: ${Object.keys(pack).filter((key) => !ALLOWED_PACK_FIELDS.includes(key)).join(', ')}`)
  }
  if (pack.plugin !== undefined && !hasOnlyKeys(pack.plugin, ALLOWED_PLUGIN_FIELDS)) {
    errors.push('plugin has unsupported properties')
  }
  if (Array.isArray(pack.dom)) {
    pack.dom.forEach((entry, index) => {
      if (isRecord(entry) && !hasOnlyKeys(entry, ALLOWED_DOM_FIELDS)) errors.push(`dom[${index}] has unsupported properties`)
    })
  }

  const validationErrors = validatePack(pack, {
    pluginId: isRecord(pack.plugin) ? pack.plugin.id : undefined,
    locale: pack.locale,
  })
  errors.push(...validationErrors)

  const inspectDraftValues = (dictionary, label) => {
    if (!isRecord(dictionary)) return
    for (const [key, value] of Object.entries(dictionary)) {
      if (typeof value === 'string' && value.includes(TRANSLATION_DRAFT_MARKER)) {
        errors.push(`${label}.${key} still contains an untranslated draft placeholder`)
      }
    }
  }
  if (isRecord(pack.namespaces)) {
    for (const [namespace, entries] of Object.entries(pack.namespaces)) inspectDraftValues(entries, `namespaces.${namespace}`)
  }
  if (Array.isArray(pack.dom)) {
    pack.dom.forEach((entry, index) => {
      if (isRecord(entry) && typeof entry.target === 'string' && entry.target.includes(TRANSLATION_DRAFT_MARKER)) {
        errors.push(`dom[${index}].target still contains an untranslated draft placeholder`)
      }
    })
  }

  return { errors, sizeBytes }
}

function normalizedIdentity(pluginId, locale) {
  return `${String(pluginId).toLowerCase()}\0${String(locale).toLowerCase()}`
}

function candidateValidation(pack, contributionsRoot) {
  const shape = validatePackShape(pack)
  const errors = [...shape.errors]
  if (errors.length) return { valid: false, errors, sizeBytes: shape.sizeBytes }

  let existing
  try {
    existing = readPackCatalog(contributionsRoot)
  } catch (error) {
    return { valid: false, errors: [error.message], sizeBytes: shape.sizeBytes }
  }

  const pluginId = pack.plugin.id
  const locale = pack.locale
  const candidateIdentity = normalizedIdentity(pluginId, locale)
  const matchingIdentity = existing.filter((other) => normalizedIdentity(other.plugin.id, other.locale) === candidateIdentity)
  const exactIdentity = matchingIdentity.filter((other) => other.plugin.id === pluginId && other.locale === locale)
  if (matchingIdentity.some((other) => other.plugin.id !== pluginId || other.locale !== locale)) {
    errors.push(`duplicate locale pack identity ${pluginId}:${locale} differs only by identifier casing`)
  }
  if (exactIdentity.length > 1) errors.push(`duplicate locale pack identity ${pluginId}:${locale}`)

  const ownPack = exactIdentity[0]
  const conflicts = new Set()
  for (const other of existing) {
    if (other === ownPack || other.locale.toLowerCase() !== locale.toLowerCase()) continue
    for (const [namespace, entries] of Object.entries(pack.namespaces || {})) {
      for (const key of Object.keys(entries || {})) {
        if (Object.hasOwn(other.namespaces?.[namespace] || {}, key)) conflicts.add(`${namespace}.${key}`)
      }
    }
  }
  for (const key of [...conflicts].sort(compareText)) errors.push(`duplicate locale namespace/key "${key}" already exists in another contribution pack`)

  return { valid: errors.length === 0, errors, sizeBytes: shape.sizeBytes }
}

function assertPluginAndLocale(pluginId, locale) {
  if (typeof pluginId !== 'string' || pluginId.length > MAX_PLUGIN_ID_LENGTH || !PLUGIN_ID_PATTERN.test(pluginId)) {
    throw new Error('pluginId must be a valid DSH package id')
  }
  if (typeof locale !== 'string' || locale.length > MAX_LOCALE_LENGTH || !LOCALE_PATTERN.test(locale)) {
    throw new Error('locale must be a valid language id such as ru or pt-BR')
  }
}

function makeSourceContext(packs, pluginId, sourceLocale) {
  if (typeof pluginId !== 'string' || pluginId.length > MAX_PLUGIN_ID_LENGTH || !PLUGIN_ID_PATTERN.test(pluginId)) {
    throw new Error('pluginId must be a valid DSH package id')
  }
  const pluginPacks = packs.filter((pack) => pack.plugin.id.toLowerCase() === pluginId.toLowerCase())
  if (!pluginPacks.length) throw new Error(`No translation packs found for plugin ${pluginId}`)
  const sourceLocales = [...new Set(pluginPacks.map((pack) => pack.sourceLocale))].sort(compareText)
  let selectedLocale = sourceLocale
  if (selectedLocale !== undefined) {
    if (typeof selectedLocale !== 'string' || selectedLocale.length > MAX_LOCALE_LENGTH || !LOCALE_PATTERN.test(selectedLocale)) {
      throw new Error('sourceLocale must be a valid language id')
    }
    if (!sourceLocales.some((locale) => locale.toLowerCase() === selectedLocale.toLowerCase())) {
      throw new Error(`No source context for ${pluginId} uses source locale ${selectedLocale}`)
    }
    selectedLocale = sourceLocales.find((locale) => locale.toLowerCase() === selectedLocale.toLowerCase())
  } else if (sourceLocales.length === 1) {
    selectedLocale = sourceLocales[0]
  } else {
    throw new Error(`Source locale is ambiguous for ${pluginId}; pass sourceLocale explicitly`)
  }

  const matchingPacks = pluginPacks.filter((pack) => pack.sourceLocale.toLowerCase() === selectedLocale.toLowerCase())
  const sourceCandidates = matchingPacks.map((pack) => ({
    pack,
    namespaces: pack.source ?? (pack.locale.toLowerCase() === pack.sourceLocale.toLowerCase() ? pack.namespaces : undefined),
  })).filter((candidate) => isRecord(candidate.namespaces) && Object.keys(candidate.namespaces).length > 0)
  const first = sourceCandidates[0]
  if (first && sourceCandidates.some((candidate) => stableJson(candidate.namespaces) !== stableJson(first.namespaces))) {
    throw new Error(`Source namespace maps disagree for ${pluginId} (${selectedLocale})`)
  }

  const domEntries = new Map()
  for (const pack of matchingPacks) {
    for (const entry of pack.dom || []) {
      const identity = `${entry.selector}\0${entry.source}`
      domEntries.set(identity, { selector: entry.selector, source: entry.source })
    }
  }
  const dom = [...domEntries.values()].sort((left, right) => compareText(left.selector, right.selector) || compareText(left.source, right.source))
  const namespaces = first ? sortedStringMap(first.namespaces) : null
  const namespaceKeys = namespaces
    ? Object.fromEntries(Object.entries(namespaces).map(([namespace, entries]) => [namespace, Object.keys(entries)]))
    : null
  const metadataPack = first?.pack || matchingPacks[0]

  return {
    pluginId: metadataPack.plugin.id,
    plugin: { ...metadataPack.plugin },
    sourceLocale: selectedLocale,
    namespaces,
    namespaceKeys,
    sourceNamespaceMapAvailable: namespaces !== null,
    dom,
  }
}

function makeDraft(context, locale) {
  assertPluginAndLocale(context.pluginId, locale)
  if (locale.toLowerCase() === context.sourceLocale.toLowerCase()) {
    throw new Error('locale must differ from sourceLocale')
  }
  if (!context.sourceNamespaceMapAvailable && context.dom.length === 0) {
    throw new Error(`No source strings are available for ${context.pluginId}`)
  }
  const namespaces = {}
  for (const [namespace, entries] of Object.entries(context.namespaces || {})) {
    namespaces[namespace] = Object.fromEntries(Object.entries(entries).map(([key, value]) => [key, `${TRANSLATION_DRAFT_MARKER} ${value} ⟧`]))
  }
  const pack = {
    plugin: context.plugin,
    locale,
    sourceLocale: context.sourceLocale,
    namespaces,
  }
  if (context.sourceNamespaceMapAvailable) pack.source = context.namespaces
  if (context.dom.length) {
    pack.dom = context.dom.map(({ selector, source }) => ({
      selector,
      source,
      target: `${TRANSLATION_DRAFT_MARKER} ${source} ⟧`,
    }))
  }
  return pack
}

function pluginDirectorySegments(pluginId) {
  return pluginId.startsWith('@') ? pluginId.split('/') : [pluginId]
}

function ensurePluginDirectory(contributionsRoot, pluginId) {
  let current = assertRealDirectory(contributionsRoot, 'contributions directory')
  const root = current
  for (const segment of pluginDirectorySegments(pluginId)) {
    if (!segment || segment === '.' || segment === '..' || segment.includes('/') || segment.includes('\\')) {
      throw new Error('pluginId contains an unsafe path segment')
    }
    const next = path.join(current, segment)
    if (!within(root, next)) throw new Error('plugin path escaped contributions')
    if (existsSync(next)) {
      const info = lstatSync(next)
      if (info.isSymbolicLink()) throw new Error(`${path.relative(root, next)}: symbolic links are not allowed`)
      if (!info.isDirectory()) throw new Error(`${path.relative(root, next)}: plugin path must be a directory`)
    } else {
      mkdirSync(next, { mode: 0o700 })
    }
    current = realpathSync(next)
    if (!within(root, current)) throw new Error('plugin path resolved outside contributions')
  }
  return current
}

function stagePack(contributionsRoot, pack, overwrite = false) {
  if (typeof overwrite !== 'boolean') return { staged: false, valid: false, errors: ['overwrite must be a boolean'] }
  const validation = candidateValidation(pack, contributionsRoot)
  if (!validation.valid) return { staged: false, valid: false, errors: validation.errors }

  let temporaryPath
  let fileDescriptor
  try {
    const destinationDirectory = ensurePluginDirectory(contributionsRoot, pack.plugin.id)
    const targetPath = path.join(destinationDirectory, `${pack.locale}.json`)
    const relativePath = path.posix.join('contributions', ...pluginDirectorySegments(pack.plugin.id), `${pack.locale}.json`)
    if (!within(contributionsRoot, targetPath)) throw new Error('target escaped contributions')

    let targetInfo = null
    try {
      targetInfo = lstatSync(targetPath)
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
    }
    if (targetInfo?.isSymbolicLink()) throw new Error('target path is a symbolic link')
    if (targetInfo && !targetInfo.isFile()) throw new Error('target path must be a regular file')
    if (targetInfo && !overwrite) {
      return { staged: false, valid: true, error: 'target already exists; pass overwrite: true to replace it', path: relativePath }
    }

    const contents = `${JSON.stringify(pack, null, 2)}\n`
    const sizeBytes = Buffer.byteLength(contents, 'utf8')
    if (sizeBytes > MAX_PACK_BYTES) {
      return { staged: false, valid: false, errors: [`pack exceeds the ${MAX_PACK_BYTES}-byte limit when serialized for staging`], sizeBytes }
    }
    temporaryPath = path.join(destinationDirectory, `.dsh-i18n-${randomUUID()}.tmp`)
    fileDescriptor = openSync(temporaryPath, 'wx', 0o600)
    writeFileSync(fileDescriptor, contents, 'utf8')
    fsyncSync(fileDescriptor)
    closeSync(fileDescriptor)
    fileDescriptor = undefined

    if (overwrite) {
      // Explicit overwrite opts into the platform's atomic same-directory replacement.
      renameSync(temporaryPath, targetPath)
    } else {
      // Linking the completed temp file is an atomic no-clobber promotion, including under races.
      linkSync(temporaryPath, targetPath)
      unlinkSync(temporaryPath)
    }
    temporaryPath = undefined
    return { staged: true, valid: true, path: relativePath, sizeBytes }
  } catch (error) {
    if (error.code === 'EEXIST') {
      return { staged: false, valid: true, error: 'target already exists; pass overwrite: true to replace it' }
    }
    return { staged: false, valid: false, errors: [error.message] }
  } finally {
    if (fileDescriptor !== undefined) closeSync(fileDescriptor)
    if (temporaryPath && existsSync(temporaryPath)) unlinkSync(temporaryPath)
  }
}

function buildSourceCatalog(input = {}) {
  const { plugin, sourceLocale, namespaces, dom = [], overwrite = false } = input
  if (!hasOnlyKeys(input, ['plugin', 'sourceLocale', 'namespaces', 'dom', 'overwrite'])) {
    throw new Error('source catalog has unsupported properties')
  }
  if (!hasOnlyKeys(plugin, ALLOWED_PLUGIN_FIELDS)) throw new Error('plugin has unsupported properties')
  if (!isRecord(namespaces)) throw new Error('namespaces must be an object keyed by DSH namespace')
  if (!Array.isArray(dom)) throw new Error('dom must be an array of selector/source mappings')
  for (const [index, entry] of dom.entries()) {
    if (!hasOnlyKeys(entry, ['selector', 'source'])) {
      throw new Error(`dom[${index}] must contain only selector and source`)
    }
  }

  const pack = {
    plugin,
    locale: sourceLocale,
    sourceLocale,
    namespaces: sortedStringMap(namespaces),
  }
  if (Object.keys(pack.namespaces).length) pack.source = pack.namespaces
  if (dom.length) {
    pack.dom = dom.map(({ selector, source }) => ({ selector, source, target: source }))
  }
  return { pack, overwrite }
}

/** Create the repository-scoped operations exposed by the optional stdio MCP server. */
export function createTranslationTools(repoPath) {
  const { root, contributions } = resolveRepositoryRoot(repoPath)
  return {
    listTranslationCoverage() {
      return buildCoverageInventory(readPackCatalog(contributions))
    },
    getTranslationSource({ pluginId, sourceLocale } = {}) {
      return makeSourceContext(readPackCatalog(contributions), pluginId, sourceLocale)
    },
    scaffoldTranslationPack({ pluginId, locale, sourceLocale } = {}) {
      const source = makeSourceContext(readPackCatalog(contributions), pluginId, sourceLocale)
      return { pack: makeDraft(source, locale), sourceNamespaceMapAvailable: source.sourceNamespaceMapAvailable }
    },
    validateTranslationPack(pack) {
      const validation = candidateValidation(pack, contributions)
      return {
        valid: validation.valid,
        errors: validation.errors,
        sizeBytes: validation.sizeBytes,
        pluginId: pack?.plugin?.id,
        locale: pack?.locale,
      }
    },
    stageTranslationPack({ pack, overwrite = false } = {}) {
      return stagePack(contributions, pack, overwrite)
    },
    stageSourceCatalog(input = {}) {
      try {
        const { pack, overwrite } = buildSourceCatalog(input)
        return stagePack(contributions, pack, overwrite)
      } catch (error) {
        return { staged: false, valid: false, errors: [error.message] }
      }
    },
    repositoryRoot: root,
  }
}

export function makeMcpToolResult(data, { isError = false } = {}) {
  return {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
    structuredContent: data,
    ...(isError ? { isError: true } : {}),
  }
}

export function getPackageVersion() {
  const packagePath = fileURLToPath(new URL('../package.json', import.meta.url))
  try {
    return JSON.parse(readFileSync(packagePath, 'utf8')).version || '0.0.0'
  } catch {
    return '0.0.0'
  }
}
