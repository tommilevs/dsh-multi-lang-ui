import { lstatSync, opendirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { validateTranslationPack } from './contributions.js'

const compareText = (left, right) => (left < right ? -1 : left > right ? 1 : 0)
const MAX_PACK_BYTES = 1024 * 1024
const MAX_CATALOG_BYTES = 32 * 1024 * 1024
const MAX_PACK_COUNT = 2000
const MAX_DIRECTORY_DEPTH = 2
const MAX_DIRECTORY_ENTRIES = 7000
const stableJson = (value) => {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort(compareText).map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

function countNamespaces(namespaces = {}) {
  const counts = {}
  let total = 0
  for (const name of Object.keys(namespaces).sort(compareText)) {
    const count = Object.keys(namespaces[name]).length
    counts[name] = count
    total += count
  }
  return { counts, total }
}

/** Build a stable coverage inventory from already validated locale packs. */
export function buildCoverageInventory(packs = []) {
  const orderedPacks = [...packs].sort((left, right) => {
    const leftId = left.plugin.id.toLowerCase()
    const rightId = right.plugin.id.toLowerCase()
    const pluginOrder = compareText(leftId, rightId) || compareText(left.plugin.id, right.plugin.id)
    if (pluginOrder) return pluginOrder
    const localeOrder = compareText(left.locale.toLowerCase(), right.locale.toLowerCase()) || compareText(left.locale, right.locale)
    if (localeOrder) return localeOrder
    return compareText(left.sourceLocale, right.sourceLocale)
  })

  const seen = new Set()
  const plugins = new Map()
  const sourceCatalogs = new Map()
  for (const pack of orderedPacks) {
    const id = pack.plugin.id
    const locale = pack.locale
    const identity = `${id.toLowerCase()}\0${locale.toLowerCase()}`
    if (seen.has(identity)) {
      throw new Error(`Duplicate locale pack identity ${id.toLowerCase()}:${locale.toLowerCase()}`)
    }
    seen.add(identity)

    const normalizedId = id.toLowerCase()
    const normalizedSourceLocale = pack.sourceLocale.toLowerCase()
    const sourceCatalogId = `${normalizedId}\0${normalizedSourceLocale}`
    if (!sourceCatalogs.has(sourceCatalogId)) sourceCatalogs.set(sourceCatalogId, { keys: new Set(), canonicalMap: null, conflict: false })
    const sourceNamespaces = pack.source ?? (locale.toLowerCase() === normalizedSourceLocale ? pack.namespaces : null)
    if (sourceNamespaces) {
      const sourceCatalog = sourceCatalogs.get(sourceCatalogId)
      const canonicalMap = stableJson(sourceNamespaces)
      if (sourceCatalog.canonicalMap !== null && sourceCatalog.canonicalMap !== canonicalMap) sourceCatalog.conflict = true
      else sourceCatalog.canonicalMap = canonicalMap
      for (const [namespace, dictionary] of Object.entries(sourceNamespaces)) {
        for (const key of Object.keys(dictionary)) sourceCatalog.keys.add(`${namespace}\0${key}`)
      }
    }

    let plugin = plugins.get(normalizedId)
    if (!plugin) {
      plugin = {
        id: normalizedId,
        version: pack.plugin.version,
        source: pack.plugin.source,
        license: pack.plugin.license,
        metadataConflict: false,
        locales: [],
        packs: [],
      }
      plugins.set(normalizedId, plugin)
    } else if (plugin.version !== pack.plugin.version || plugin.source !== pack.plugin.source || plugin.license !== pack.plugin.license) {
      plugin.metadataConflict = true
    }

    const { counts, total } = countNamespaces(pack.namespaces)
    plugin.locales.push(locale)
    plugin.packs.push({
      locale,
      sourceLocale: pack.sourceLocale,
      version: pack.plugin.version,
      source: pack.plugin.source,
      license: pack.plugin.license,
      namespaceKeyCount: total,
      namespaces: counts,
      domMappingCount: Array.isArray(pack.dom) ? pack.dom.length : 0,
      sourceNamespaceMapAvailable: false,
      _sourceCatalogId: sourceCatalogId,
      _namespaceKeys: Object.entries(pack.namespaces ?? {}).flatMap(([namespace, dictionary]) =>
        Object.keys(dictionary).map((key) => `${namespace}\0${key}`)
      ),
    })
  }

  const inventory = [...plugins.values()].sort((left, right) => compareText(left.id, right.id))
  for (const plugin of inventory) {
    for (const pack of plugin.packs) {
      const sourceCatalog = sourceCatalogs.get(pack._sourceCatalogId)
      pack.sourceNamespaceMapAvailable = Boolean(sourceCatalog && !sourceCatalog.conflict)
        && pack._namespaceKeys.length > 0
        && pack._namespaceKeys.every((key) => sourceCatalog.keys.has(key))
      delete pack._sourceCatalogId
      delete pack._namespaceKeys
    }
  }
  return {
    packCount: orderedPacks.length,
    pluginCount: inventory.length,
    plugins: inventory,
  }
}

/** Read and validate JSON locale packs while retaining diagnostics for rejected packs. */
export function readCoveragePacks(directory) {
  const root = path.resolve(directory)
  let rootInfo
  try {
    rootInfo = lstatSync(root)
  } catch {
    throw new Error(`contributions directory does not exist: ${root}`)
  }
  if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink()) {
    throw new Error(`contributions path must be a real directory: ${root}`)
  }

  const packs = []
  const skippedPacks = []
  let totalBytes = 0
  let packCount = 0
  let directoryEntryCount = 0
  const skip = (relativePath, reasons) => {
    skippedPacks.push({ path: relativePath, reasons: [...reasons].sort(compareText) })
  }

  function visit(current, segments = []) {
    if (segments.length > MAX_DIRECTORY_DEPTH) {
      throw new Error(`contributions directory nesting exceeds ${MAX_DIRECTORY_DEPTH} levels`)
    }
    const handle = opendirSync(current)
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
      const nextSegments = [...segments, entry.name]
      const relativePath = nextSegments.join('/')
      const absolutePath = path.join(current, entry.name)

      if (entry.isSymbolicLink()) {
        skip(relativePath, ['symbolic links are not followed'])
      } else if (entry.isDirectory()) {
        visit(absolutePath, nextSegments)
      } else if (entry.isFile() && path.extname(entry.name).toLowerCase() === '.json') {
        packCount += 1
        if (packCount > MAX_PACK_COUNT) throw new Error(`contributions exceeds ${MAX_PACK_COUNT} locale packs`)
        const pluginId = segments.join('/')
        const locale = entry.name.slice(0, -path.extname(entry.name).length)
        const validPackPath = (segments.length === 1 && !segments[0].startsWith('@'))
          || (segments.length === 2 && segments[0].startsWith('@'))
        if (!validPackPath) {
          skip(relativePath, ['expected contributions/<plugin-id>/<locale>.json (scoped ids use @scope/name)'])
          continue
        }

        try {
          const size = lstatSync(absolutePath).size
          if (size > MAX_PACK_BYTES) {
            skip(relativePath, [`pack exceeds ${MAX_PACK_BYTES} bytes`])
            continue
          }
          totalBytes += size
          if (totalBytes > MAX_CATALOG_BYTES) throw new Error(`contributions exceeds ${MAX_CATALOG_BYTES} bytes`)
          const value = JSON.parse(readFileSync(absolutePath, 'utf8'))
          const issues = validateTranslationPack(value, { pluginId, locale })
          if (issues.length) skip(relativePath, issues)
          else packs.push(value)
        } catch (error) {
          if (error.message.startsWith('contributions exceeds ')) throw error
          skip(relativePath, [`invalid JSON or unreadable pack: ${error.message}`])
        }
      }
    }
  }

  visit(root)
  skippedPacks.sort((left, right) => compareText(left.path, right.path))
  return { packs, skippedPacks }
}
