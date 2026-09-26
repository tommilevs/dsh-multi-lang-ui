/* Shared DOM translation helpers. This file is embedded into the browser client at build time. */
function isSafeDomSelector(selector) {
  if (typeof selector !== 'string' || selector.length > 300) return false
  const value = selector.trim()
  const root = /^(?:\.[A-Za-z_][\w-]*|\[data-dsh-plugin="[A-Za-z0-9][A-Za-z0-9._-]*"\]|\[data-conversation-tabs\]|\[data-dsh-pet-root\]|#settings-pet-[A-Za-z0-9_-]+|section\[aria-labelledby="(?:vision|compact|approve|subagent|title|imagegen)-title"\]|p\[role="alert"\])/.exec(value)
  if (!root || !/^[\s>+~.#:[\]="'()\w-]*$/.test(value.slice(root[0].length))) return false
  return !/(?:^|[\s>+~])(?:body|html|\*)\b/i.test(value)
}

function matchDomTemplate(template, text) {
  const tokens = [...String(template).matchAll(/\{([A-Za-z0-9_]+)(?::[^{}]+)?\}/g)]
  if (!tokens.length) return template === text ? {} : null

  let source = '^'
  let cursor = 0
  let groupIndex = 0
  const groups = new Map()
  for (const token of tokens) {
    source += String(template).slice(cursor, token.index).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const name = token[1]
    if (groups.has(name)) source += `\\k<${groups.get(name)}>`
    else {
      const group = `p${groupIndex++}`
      groups.set(name, group)
      source += `(?<${group}>[\\s\\S]*?)`
    }
    cursor = token.index + token[0].length
  }
  source += String(template).slice(cursor).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$'
  const match = new RegExp(source).exec(text)
  if (!match) return null
  return Object.fromEntries([...groups].map(([name, group]) => [name, match.groups[group]]))
}

function formatDomTemplate(template, values) {
  return String(template).replace(/\{([A-Za-z0-9_]+)(?::[^{}]+)?\}/g, (placeholder, name) => (
    Object.prototype.hasOwnProperty.call(values, name) ? values[name] : placeholder
  ))
}

function resolveDomTranslation(selector, text, language, entries) {
  const normalizedLanguage = String(language || 'en').toLowerCase()
  const baseLanguage = normalizedLanguage.split('-')[0]
  // Exact labels (including unknown dates) must win over broad templates.
  for (const entry of entries) {
    if (entry.selector !== selector) continue
    const target = entry.targets[normalizedLanguage] ?? entry.targets[baseLanguage] ?? entry.source
    if (entry.source === text || Object.values(entry.targets).includes(text)) return target
  }
  for (const entry of entries) {
    if (entry.selector !== selector) continue
    const target = entry.targets[normalizedLanguage] ?? entry.targets[baseLanguage]
    const sourceValues = matchDomTemplate(entry.source, text)
    if (sourceValues !== null) return formatDomTemplate(target ?? entry.source, sourceValues)
    for (const [sourceLanguage, currentTemplate] of Object.entries(entry.targets)) {
      const currentValues = matchDomTemplate(currentTemplate, text)
      if (currentValues === null) continue
      const sameLanguage = normalizedLanguage === sourceLanguage || normalizedLanguage.startsWith(`${sourceLanguage}-`)
      return formatDomTemplate(sameLanguage ? currentTemplate : (target ?? entry.source), currentValues)
    }
  }
  return text
}

function resolveDomValue(owner, key, selector, text, language, entries, originals) {
  let values = originals.get(owner)
  if (!values) { values = new Map(); originals.set(owner, values) }
  const previous = values.get(key)
  const original = previous?.rendered === text ? previous.original : text
  const translated = resolveDomTranslation(selector, original, language, entries)
  values.set(key, { original, rendered: translated })
  return translated
}

function translateSelectOptions(options, selector, language, entries, originals = new WeakMap()) {
  let translatedCount = 0
  for (const option of options || []) {
    if (typeof option?.textContent !== 'string') continue
    const text = option.textContent
    const leading = text.match(/^\s*/)?.[0] || ''
    const trailing = text.match(/\s*$/)?.[0] || ''
    const value = text.trim()
    const translated = resolveDomValue(option, 'text', selector, value, language, entries, originals)
    if (translated !== value) {
      const optionValue = option.value
      option.textContent = leading + translated + trailing
      if (optionValue !== undefined) option.value = optionValue
      translatedCount += 1
    }
  }
  return translatedCount
}
