import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const PLUGIN_ID = /^(?:@[a-z0-9._-]+\/)?[a-z0-9][a-z0-9._-]*$/i
const LOCALE_ID = /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/
const PLACEHOLDER = /\{([A-Za-z0-9_]+)(?::[^{}]+)?\}/g
const UNSAFE_KEYS = new Set(['__proto__', 'prototype', 'constructor'])

const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
const placeholders = (value) => [...String(value).matchAll(PLACEHOLDER)].map((match) => match[1]).sort()
const sameList = (left, right) => left.length === right.length && left.every((value, index) => value === right[index])

function validateStringMap(value, path, issues) {
  if (!isRecord(value)) {
    issues.push(`${path} must be an object of string values`)
    return
  }
  if (Object.keys(value).length === 0) issues.push(`${path} must contain at least one key`)
  for (const [key, text] of Object.entries(value)) {
    if (UNSAFE_KEYS.has(key)) issues.push(`${path}.${key} uses an unsafe key`)
    if (typeof text !== 'string' || text.trim() === '') issues.push(`${path}.${key} must be a non-empty string`)
  }
}

function validateNamespaces(value, path, issues) {
  if (!isRecord(value)) {
    issues.push(`${path} must be an object keyed by DSH namespace`)
    return
  }
  for (const [namespace, dictionary] of Object.entries(value)) {
    if (UNSAFE_KEYS.has(namespace)) issues.push(`${path}.${namespace} uses an unsafe key`)
    if (!namespace.trim()) issues.push(`${path} contains an empty namespace`)
    validateStringMap(dictionary, `${path}.${namespace}`, issues)
  }
}

function compareKeys(source, translated, path, issues) {
  const sourceKeys = Object.keys(source).sort()
  const translatedKeys = Object.keys(translated).sort()
  if (!sameList(sourceKeys, translatedKeys)) issues.push(`${path} source and translation keys differ`)
  for (const key of sourceKeys) {
    if (typeof source[key] === 'string' && typeof translated[key] === 'string' && !sameList(placeholders(source[key]), placeholders(translated[key]))) {
      issues.push(`placeholder mismatch for ${path}.${key}`)
    }
  }
}

/** Validate a data-only community translation pack. Returns human-readable issues. */
export function validateTranslationPack(pack, options = {}) {
  const issues = []
  if (!isRecord(pack)) return ['pack must be a JSON object']
  if (!isRecord(pack.plugin)) {
    issues.push('plugin must be an object')
  } else {
    if (typeof pack.plugin.id !== 'string' || !PLUGIN_ID.test(pack.plugin.id)) issues.push('plugin.id must be a valid package id')
    if (typeof pack.plugin.version !== 'string' || !pack.plugin.version.trim()) issues.push('plugin.version must be a non-empty string')
    if (typeof pack.plugin.source !== 'string' || !/^https?:\/\//i.test(pack.plugin.source)) issues.push('plugin.source must be an http(s) URL')
    if (typeof pack.plugin.license !== 'string' || !pack.plugin.license.trim()) issues.push('plugin.license must be a non-empty string')
    if (options.pluginId && pack.plugin.id !== options.pluginId) issues.push(`plugin.id does not match expected id ${options.pluginId}`)
  }
  if (typeof pack.locale !== 'string' || !LOCALE_ID.test(pack.locale)) issues.push('locale must be a language id such as ru or pt-BR')
  if (options.locale && pack.locale !== options.locale) issues.push(`locale does not match expected id ${options.locale}`)
  if (typeof pack.sourceLocale !== 'string' || !LOCALE_ID.test(pack.sourceLocale)) issues.push('sourceLocale must be a language id')

  validateNamespaces(pack.namespaces, 'namespaces', issues)
  if (isRecord(pack.namespaces) && Object.keys(pack.namespaces).length === 0 && (!Array.isArray(pack.dom) || pack.dom.length === 0)) {
    issues.push('namespaces must be non-empty unless the pack contains DOM mappings')
  }
  if (pack.source !== undefined) validateNamespaces(pack.source, 'source', issues)

  if (isRecord(pack.source) && isRecord(pack.namespaces)) {
    const sourceNamespaces = Object.keys(pack.source).sort()
    const translatedNamespaces = Object.keys(pack.namespaces).sort()
    if (!sameList(sourceNamespaces, translatedNamespaces)) issues.push('source and translation namespaces differ')
    for (const namespace of sourceNamespaces) {
      const source = pack.source[namespace]
      const translated = pack.namespaces[namespace]
      if (!isRecord(source) || !isRecord(translated)) continue
      compareKeys(source, translated, namespace, issues)
    }
  }

  if (pack.dom !== undefined) {
    if (!Array.isArray(pack.dom)) {
      issues.push('dom must be an array of scoped exact-text mappings')
    } else {
      pack.dom.forEach((entry, index) => {
        const path = `dom[${index}]`
        if (!isRecord(entry)) {
          issues.push(`${path} must be an object`)
          return
        }
        // DOM packs must have an explicit local root. Refuse global selectors
        // such as body/html/* so contributor data cannot rewrite the whole UI.
        if (typeof entry.selector !== 'string' || entry.selector.length > 300 || !/^\.[A-Za-z_][\w-]*(?:[\s>+~.#:[\]="'()\w-]*)$/.test(entry.selector.trim()) || /(?:^|[\s>+~])(?:body|html|\*)\b/i.test(entry.selector)) {
          issues.push(`${path}.selector must be a scoped CSS selector rooted at a class`)
        }
        if (typeof entry.source !== 'string' || entry.source.trim() === '') issues.push(`${path}.source must be a non-empty exact source string`)
        if (typeof entry.target !== 'string' || entry.target.trim() === '') issues.push(`${path}.target must be a non-empty translated string`)
        if (typeof entry.source === 'string' && typeof entry.target === 'string' && !sameList(placeholders(entry.source), placeholders(entry.target))) {
          issues.push(`placeholder mismatch for ${path}`)
        }
      })
    }
  }

  return issues
}

/** Merge packs in order; later packs are explicit overrides and every collision is reported. */
export function mergeTranslationPacks(packs, locale) {
  const dictionaries = Object.create(null)
  const owners = new Map()
  const dom = []
  const conflicts = []

  for (const pack of packs || []) {
    if (!pack || pack.locale?.toLowerCase() !== String(locale || '').toLowerCase()) continue
    const plugin = String(pack.plugin?.id || 'unknown')
    if (Array.isArray(pack.dom)) dom.push(...pack.dom.map((entry) => ({ ...entry, plugin })))
    if (!isRecord(pack.namespaces)) continue
    for (const [namespace, entries] of Object.entries(pack.namespaces)) {
      if (!isRecord(entries)) continue
      if (!dictionaries[namespace]) dictionaries[namespace] = Object.create(null)
      for (const [key, value] of Object.entries(entries)) {
        const ownerKey = `${namespace}\0${key}`
        const previousPlugin = owners.get(ownerKey)
        if (previousPlugin && previousPlugin !== plugin) {
          conflicts.push({ locale, namespace, key, previousPlugin, plugin })
        }
        dictionaries[namespace][key] = value
        owners.set(ownerKey, plugin)
      }
    }
  }
  return { dictionaries, dom, conflicts }
}

/** Read bundled community packs from a directory without executing package code. */
export function readTranslationPacks(directory) {
  if (!existsSync(directory)) return []
  const result = []
  const walk = (currentDirectory, segments = []) => {
    const entries = readdirSync(currentDirectory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))
    for (const entry of entries) {
      if (entry.isDirectory()) {
        // Package IDs may be scoped (contributions/@scope/name/ru.json).
        if (segments.length < 2 || segments[0].startsWith('@')) walk(join(currentDirectory, entry.name), [...segments, entry.name])
      } else if (entry.isFile() && entry.name.endsWith('.json') && segments.length > 0 && segments.length <= 2) {
        try {
          const filePath = join(currentDirectory, entry.name)
          if (statSync(filePath).size > 512 * 1024) continue
          const pack = JSON.parse(readFileSync(filePath, 'utf8'))
          const pluginId = segments.join('/')
          const filenameLocale = entry.name.slice(0, -5)
          if (validateTranslationPack(pack, { pluginId, locale: filenameLocale }).length === 0) result.push(pack)
        } catch {
          // Invalid local data is ignored; validation details are exposed by the CLI.
        }
      }
    }
  }
  walk(directory)
  return result
}
