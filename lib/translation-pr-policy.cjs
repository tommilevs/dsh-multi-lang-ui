'use strict'

const MAX_CHANGED_FILES = 50
const PLUGIN_ID = '(?:@[a-z0-9._-]+\\/[a-z0-9][a-z0-9._-]*|[a-z0-9][a-z0-9._-]*)'
const LOCALE = '[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*'
const LOCALE_FILE = new RegExp(`^contributions/(${PLUGIN_ID})/(${LOCALE})\\.json$`, 'i')

const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
const compareText = (left, right) => (left < right ? -1 : left > right ? 1 : 0)

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  if (!isRecord(value)) return JSON.stringify(value)
  return `{${Object.keys(value).sort(compareText).map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`
}

function parseLocalePackPath(filename) {
  if (typeof filename !== 'string') return null
  const match = LOCALE_FILE.exec(filename)
  return match ? { pluginId: match[1], locale: match[2] } : null
}

function sourceMapFor(pluginPacks, sourceLocale) {
  const candidates = pluginPacks
    .filter((pack) => typeof pack.sourceLocale === 'string' && pack.sourceLocale.toLowerCase() === sourceLocale.toLowerCase())
    .map((pack) => pack.source ?? (pack.locale?.toLowerCase() === sourceLocale.toLowerCase() ? pack.namespaces : undefined))
    .filter(isRecord)
  if (candidates.length === 0) return null
  const serialized = new Set(candidates.map(stableJson))
  return serialized.size === 1 ? candidates[0] : null
}

function metadataIsConsistent(pluginPacks) {
  const metadata = new Set(pluginPacks.map((pack) => stableJson({
    version: pack.plugin.version,
    source: pack.plugin.source,
    license: pack.plugin.license,
  })))
  return metadata.size === 1
}

function knownDomSourcesFor(pluginPacks, sourceLocale) {
  return new Set(pluginPacks
    .filter((pack) => typeof pack.sourceLocale === 'string' && pack.sourceLocale.toLowerCase() === sourceLocale.toLowerCase())
    .flatMap((pack) => Array.isArray(pack.dom) ? pack.dom : [])
    .filter((entry) => isRecord(entry) && typeof entry.selector === 'string' && typeof entry.source === 'string')
    .map((entry) => `${entry.selector}\0${entry.source}`))
}

function evaluateTranslationPullRequest({
  baseRef,
  isDraft,
  changedFiles,
  basePacks = [],
  candidatePacks = {},
  maxChangedFiles = MAX_CHANGED_FILES,
} = {}) {
  const reasons = []
  if (baseRef !== 'main') reasons.push('pull request target must be main')
  if (isDraft) reasons.push('draft pull requests are not approved')
  if (!Array.isArray(changedFiles) || changedFiles.length === 0) reasons.push('pull request has no changed files')
  if (Array.isArray(changedFiles) && changedFiles.length > maxChangedFiles) {
    reasons.push(`pull request changes more than ${maxChangedFiles} files`)
  }

  const seen = new Set()
  for (const file of Array.isArray(changedFiles) ? changedFiles : []) {
    const identity = parseLocalePackPath(file?.filename)
    if (!identity) {
      reasons.push('every changed path must be contributions/<plugin-id>/<locale>.json')
      continue
    }
    const normalized = file.filename.toLowerCase()
    if (seen.has(normalized)) reasons.push('changed file list contains duplicate paths')
    seen.add(normalized)
    if (file.status !== 'added' && file.status !== 'modified') reasons.push('locale packs may only be added or modified')

    const candidate = candidatePacks?.[file.filename]
    if (!isRecord(candidate)) {
      reasons.push(`could not read candidate locale pack ${file.filename}`)
      continue
    }
    if (!isRecord(candidate.plugin) || typeof candidate.plugin.id !== 'string' ||
        candidate.plugin.id.toLowerCase() !== identity.pluginId.toLowerCase() ||
        typeof candidate.locale !== 'string' || candidate.locale.toLowerCase() !== identity.locale.toLowerCase()) {
      reasons.push(`candidate pack metadata does not match ${file.filename}`)
      continue
    }
    if (typeof candidate.sourceLocale !== 'string' || candidate.locale.toLowerCase() === candidate.sourceLocale.toLowerCase()) {
      reasons.push('source-language catalogs require human review')
      continue
    }

    const pluginPacks = (Array.isArray(basePacks) ? basePacks : []).filter((pack) =>
      isRecord(pack) && isRecord(pack.plugin) && typeof pack.plugin.id === 'string' &&
      pack.plugin.id.toLowerCase() === identity.pluginId.toLowerCase()
    )
    if (pluginPacks.length === 0) {
      reasons.push('new plugins require human review before locale packs can be auto-approved')
      continue
    }
    if (!metadataIsConsistent(pluginPacks) || stableJson(candidate.plugin) !== stableJson(pluginPacks[0].plugin)) {
      reasons.push('plugin metadata changes or conflicts with the trusted base catalog')
      continue
    }

    const sourceMap = sourceMapFor(pluginPacks, candidate.sourceLocale)
    const hasCandidateNamespaces = isRecord(candidate.namespaces) && Object.keys(candidate.namespaces).length > 0
    const hasSourceNamespaces = isRecord(candidate.source) && Object.keys(candidate.source).length > 0
    if (sourceMap) {
      if (!isRecord(candidate.source) || stableJson(candidate.source) !== stableJson(sourceMap)) {
        reasons.push('new or changed source strings require human review')
      }
    } else if (hasCandidateNamespaces || hasSourceNamespaces) {
      reasons.push('namespace source strings are not established in the trusted base catalog')
    }

    const knownDomSources = knownDomSourcesFor(pluginPacks, candidate.sourceLocale)
    const candidateDom = Array.isArray(candidate.dom) ? candidate.dom : []
    const candidateDomSources = new Set(candidateDom
      .filter((entry) => isRecord(entry) && typeof entry.selector === 'string' && typeof entry.source === 'string')
      .map((entry) => `${entry.selector}\0${entry.source}`))
    if (candidateDomSources.size !== candidateDom.length || candidateDomSources.size !== knownDomSources.size ||
        [...candidateDomSources].some((identity) => !knownDomSources.has(identity))) {
      reasons.push('new, removed, or duplicated DOM mappings require human review')
    }
    if (!sourceMap && candidateDom.length === 0) {
      reasons.push('translation source context is not established in the trusted base catalog')
    }
  }

  return { eligible: reasons.length === 0, reasons: [...new Set(reasons)] }
}

module.exports = { evaluateTranslationPullRequest, parseLocalePackPath, MAX_CHANGED_FILES }
