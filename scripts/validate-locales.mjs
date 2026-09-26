#!/usr/bin/env node

import { lstatSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const LOCALE_PATTERN = /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/
const PLUGIN_ID_PATTERN = /^(?:@[a-z0-9._-]+\/)?[a-z0-9][a-z0-9._-]*$/i
const PLACEHOLDER_PATTERN = /\{([A-Za-z0-9_]+)(?::[^{}]+)?\}/g
const UNSAFE_KEYS = new Set(['__proto__', 'prototype', 'constructor'])

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function hasOnlyKeys(value, allowed) {
  return Object.keys(value).every((key) => allowed.includes(key))
}

function placeholders(value) {
  return [...value.matchAll(PLACEHOLDER_PATTERN)].map((match) => match[1]).sort()
}

function placeholdersMatch(source, target) {
  const left = placeholders(source)
  const right = placeholders(target)
  return left.length === right.length && left.every((value, index) => value === right[index])
}

function isSafeDomSelector(selector) {
  if (typeof selector !== 'string' || selector.length > 300) return false
  const value = selector.trim()
  const root = /^(?:\.[A-Za-z_][\w-]*|\[data-dsh-plugin="[A-Za-z0-9][A-Za-z0-9._-]*"\]|\[data-conversation-tabs\]|\[data-dsh-pet-root\]|#settings-pet-[A-Za-z0-9_-]+|section\[aria-labelledby="(?:vision|compact|approve|subagent|title|imagegen)-title"\]|p\[role="alert"\])/.exec(value)
  if (!root || !/^[\s>+~.#:[\]="'()\w-]*$/.test(value.slice(root[0].length))) return false
  return !/(?:^|[\s>+~])(?:body|html|\*)\b/i.test(value)
}

function walkContributionFiles(root, errors) {
  const files = []

  let rootInfo
  try {
    rootInfo = lstatSync(root)
  } catch {
    errors.push(`contributions directory does not exist: ${root}`)
    return files
  }
  if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink()) {
    errors.push(`contributions path must be a real directory: ${root}`)
    return files
  }

  function visit(directory) {
    let entries
    try {
      entries = readdirSync(directory, { withFileTypes: true })
    } catch (error) {
      errors.push(`${path.relative(root, directory) || '.'}: cannot read directory: ${error.message}`)
      return
    }

    for (const entry of entries) {
      const absolute = path.join(directory, entry.name)
      const relative = path.relative(root, absolute).split(path.sep).join('/')
      if (entry.isSymbolicLink()) {
        errors.push(`${relative}: symbolic links are not allowed`)
      } else if (entry.isDirectory()) {
        visit(absolute)
      } else if (entry.isFile()) {
        if (!entry.name.toLowerCase().endsWith('.json')) {
          errors.push(`${relative}: only JSON locale packs are allowed under contributions`)
        } else {
          files.push({ absolute, relative })
        }
      } else {
        errors.push(`${relative}: unsupported filesystem entry`)
      }
    }
  }

  visit(root)
  if (files.length === 0 && errors.length === 0) errors.push('no locale contribution JSON files found')
  return files
}

function validateString(value, label, errors) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    errors.push(`${label} must be a non-empty string`)
    return false
  }
  return true
}

function validateTextMap(value, label, errors, { allowEmpty = false } = {}) {
  if (!isRecord(value) || (Object.keys(value).length === 0 && !allowEmpty)) {
    errors.push(`${label} must be a non-empty namespace object`)
    return null
  }

  const flat = new Map()
  for (const [namespace, entries] of Object.entries(value)) {
    if (UNSAFE_KEYS.has(namespace)) errors.push(`${label}.${namespace} uses an unsafe key`)
    if (!namespace.trim()) errors.push(`${label} has an empty namespace name`)
    if (!isRecord(entries) || Object.keys(entries).length === 0) {
      errors.push(`${label}.${namespace} must be a non-empty key/value object`)
      continue
    }
    for (const [key, text] of Object.entries(entries)) {
      if (UNSAFE_KEYS.has(key)) errors.push(`${label}.${namespace}.${key} uses an unsafe key`)
      if (!key.trim()) errors.push(`${label}.${namespace} has an empty key`)
      const itemLabel = `${label}.${namespace}.${key}`
      if (validateString(text, itemLabel, errors)) flat.set(`${namespace}\0${key}`, text)
    }
  }
  return flat
}

function validateDomMappings(value, prefix, errors) {
  if (value === undefined) return 0
  if (!Array.isArray(value)) {
    errors.push(`${prefix}: dom must be an array of scoped exact-text mappings`)
    return 0
  }

  let validCount = 0
  value.forEach((entry, index) => {
    const label = `${prefix}: dom[${index}]`
    if (!isRecord(entry)) {
      errors.push(`${label} must be an object`)
      return
    }

    const hasAllowedKeys = hasOnlyKeys(entry, ['selector', 'source', 'target'])
    if (!hasAllowedKeys) errors.push(`${label} has unsupported properties`)
    const validSelector = validateString(entry.selector, `${label}.selector`, errors)
    const validSource = validateString(entry.source, `${label}.source`, errors)
    const validTarget = validateString(entry.target, `${label}.target`, errors)
    const scopedSelector = validSelector && isSafeDomSelector(entry.selector)
    if (validSelector && !scopedSelector) errors.push(`${label}.selector must be a scoped CSS selector rooted at a plugin marker`)

    const samePlaceholders = validSource && validTarget && placeholdersMatch(entry.source, entry.target)
    if (validSource && validTarget && !samePlaceholders) errors.push(`${label}: DOM placeholder mismatch`)
    if (hasAllowedKeys && scopedSelector && validSource && validTarget && samePlaceholders) validCount += 1
  })
  return validCount
}

function compareMaps(left, right, label, errors) {
  const leftKeys = [...left.keys()].sort()
  const rightKeys = [...right.keys()].sort()
  if (leftKeys.length === rightKeys.length && leftKeys.every((key, index) => key === rightKeys[index])) return

  const missing = leftKeys.filter((key) => !right.has(key)).map((key) => key.replace('\0', '.'))
  const extra = rightKeys.filter((key) => !left.has(key)).map((key) => key.replace('\0', '.'))
  const details = []
  if (missing.length) details.push(`missing from ${label}: ${missing.join(', ')}`)
  if (extra.length) details.push(`extra in ${label}: ${extra.join(', ')}`)
  errors.push(`${label} key parity mismatch (${details.join('; ')})`)
}

function validatePack(file, errors) {
  let pack
  try {
    pack = JSON.parse(readFileSync(file.absolute, 'utf8'))
  } catch (error) {
    errors.push(`${file.relative}: invalid JSON: ${error.message}`)
    return null
  }

  const prefix = file.relative
  if (!isRecord(pack)) {
    errors.push(`${prefix}: pack must be a JSON object`)
    return null
  }
  const allowedPackKeys = ['plugin', 'locale', 'sourceLocale', 'namespaces', 'source', 'dom']
  if (!hasOnlyKeys(pack, allowedPackKeys)) {
    errors.push(`${prefix}: pack has unsupported properties: ${Object.keys(pack).filter((key) => !allowedPackKeys.includes(key)).join(', ')}`)
  }
  for (const key of ['plugin', 'locale', 'sourceLocale', 'namespaces']) {
    if (!(key in pack)) errors.push(`${prefix}: missing required property "${key}"`)
  }

  const segments = prefix.split('/')
  const pluginId = segments.slice(0, -1).join('/')
  const filename = segments.at(-1) ?? ''
  const filenameLocale = filename.replace(/\.json$/i, '')
  if (!PLUGIN_ID_PATTERN.test(pluginId)) {
    errors.push(`${prefix}: directory path is not a supported plugin id`)
  }
  if (segments.length < 2 || segments.length > 3 || (segments.length === 3 && !pluginId.startsWith('@'))) {
    errors.push(`${prefix}: expected contributions/<plugin-id>/<locale>.json (scoped ids use @scope/name)`)
  }
  if (!LOCALE_PATTERN.test(filenameLocale)) errors.push(`${prefix}: file name has an invalid locale code`)

  if (!isRecord(pack.plugin)) {
    errors.push(`${prefix}: plugin must be an object`)
  } else {
    if (!hasOnlyKeys(pack.plugin, ['id', 'version', 'source', 'license'])) {
      errors.push(`${prefix}: plugin has unsupported properties`)
    }
    for (const key of ['id', 'version', 'source', 'license']) {
      if (validateString(pack.plugin[key], `${prefix}: plugin.${key}`, errors) && key === 'id' && pack.plugin.id !== pluginId) {
        errors.push(`${prefix}: plugin.id "${pack.plugin.id}" does not match directory "${pluginId}"`)
      }
    }
    if (typeof pack.plugin.source === 'string' && !/^https?:\/\//i.test(pack.plugin.source)) {
      errors.push(`${prefix}: plugin.source must be an HTTP(S) URL`)
    }
  }

  const localeValid = validateString(pack.locale, `${prefix}: locale`, errors)
  if (localeValid) {
    if (!LOCALE_PATTERN.test(pack.locale)) errors.push(`${prefix}: locale is not a valid language tag`)
    if (pack.locale !== filenameLocale) errors.push(`${prefix}: locale "${pack.locale}" does not match file name locale "${filenameLocale}"`)
  }
  if (validateString(pack.sourceLocale, `${prefix}: sourceLocale`, errors) && !LOCALE_PATTERN.test(pack.sourceLocale)) {
    errors.push(`${prefix}: sourceLocale is not a valid language tag`)
  }

  const validDomCount = validateDomMappings(pack.dom, prefix, errors)
  const translated = validateTextMap(pack.namespaces, `${prefix}: namespaces`, errors, { allowEmpty: validDomCount > 0 })
  let source = null
  if ('source' in pack) source = validateTextMap(pack.source, `${prefix}: source`, errors)
  if (translated && source) {
    compareMaps(translated, source, 'source', errors)
    for (const [key, targetText] of translated) {
      if (source.has(key) && !placeholdersMatch(source.get(key), targetText)) {
        errors.push(`${prefix}: placeholder mismatch for ${key.replace('\0', '.')}`)
      }
    }
  }

  if (!localeValid || !LOCALE_PATTERN.test(String(pack.locale))) return null
  return { locale: pack.locale, namespaces: translated, file: prefix }
}

export function validateLocales(directory) {
  const errors = []
  const files = walkContributionFiles(path.resolve(directory), errors)
  const packs = files.map((file) => validatePack(file, errors)).filter(Boolean)
  const seen = new Map()

  for (const pack of packs) {
    for (const key of pack.namespaces?.keys() ?? []) {
      const globalKey = `${pack.locale}\0${key}`
      const previous = seen.get(globalKey)
      if (previous) {
        const printableKey = key.replace('\0', '.')
        errors.push(`duplicate ${pack.locale} namespace/key "${printableKey}" in ${previous} and ${pack.file}`)
      } else {
        seen.set(globalKey, pack.file)
      }
    }
  }

  return { errors, packCount: files.length }
}

function main() {
  const input = process.argv[2]
  if (input === '--help' || input === '-h') {
    console.log('Usage: node scripts/validate-locales.mjs [contributions-directory]')
    process.exit(0)
  }
  const directory = input ? path.resolve(input) : path.resolve('contributions')
  const result = validateLocales(directory)
  if (result.errors.length > 0) {
    console.error(`Locale validation failed:\n${result.errors.map((error) => `- ${error}`).join('\n')}`)
    process.exitCode = 1
    return
  }
  console.log(`Validated ${result.packCount} locale pack${result.packCount === 1 ? '' : 's'}; no duplicate keys found.`)
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) main()
