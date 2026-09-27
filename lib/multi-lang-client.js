/* Client-side community locale packs and exact plugin-scoped DOM translations. */
function resetPersistedMcpFabPosition(storage, reload) {
  const positionKey = 'dsh-mcp-manager-ui/fab-pos'
  const migrationKey = 'dsh-multi-lang-ui:mcp-fab-position-reset:v1'
  try {
    if (!storage || storage.getItem(migrationKey) === '1' || !storage.getItem(positionKey)) return false
    storage.removeItem(positionKey)
    try { storage.setItem(migrationKey, '1') } catch (_) { /* a removed position must still be applied */ }
    try { reload?.() } catch (_) { /* the cleanup is complete even if reload is unavailable */ }
    return true
  } catch (_) {
    return false
  }
}

function applyMultiLang(ctx) {
  try {
    resetPersistedMcpFabPosition(
      typeof localStorage !== 'undefined' ? localStorage : null,
      () => { if (typeof window !== 'undefined') window.location.reload() },
    )
  } catch (_) { /* do not let a storage migration prevent translations from loading */ }
  const locale = ctx.locale
  const PACKS_URL = '/api/dsh-multi-lang-ui/packs'
  const STORAGE_KEY = 'dsh-multi-lang-ui.community-packs.v1'
  const localPacks = new Map()
  const builtInPacks = new Map()
  const registrations = []
  const domIndex = new Map()
  const packSubscribers = new Set()
  let packRevision = 0
  const domOriginals = new WeakMap()
  const originalConfirm = typeof window !== 'undefined' && typeof window.confirm === 'function' ? window.confirm : null
  let observer = null
  let scheduled = false

  const getStoredPacks = () => {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
      return Array.isArray(value) ? value.filter(isSafePack) : []
    } catch (_) { return [] }
  }
  const isSafePack = (pack) => {
    if (!pack || typeof pack !== 'object' || Array.isArray(pack) || !pack.plugin || typeof pack.plugin.id !== 'string') return false
    if (!/^(?:@[a-z0-9._-]+\/)?[a-z0-9][a-z0-9._-]*$/i.test(pack.plugin.id)) return false
    if (typeof pack.plugin.version !== 'string' || !pack.plugin.version.trim()) return false
    if (typeof pack.plugin.source !== 'string' || !/^https?:\/\//i.test(pack.plugin.source)) return false
    if (typeof pack.plugin.license !== 'string' || !pack.plugin.license.trim()) return false
    if (typeof pack.locale !== 'string' || !/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(pack.locale)) return false
    if (typeof pack.sourceLocale !== 'string' || !/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(pack.sourceLocale)) return false
    if (!pack.namespaces || typeof pack.namespaces !== 'object' || Array.isArray(pack.namespaces)) return false
    for (const [namespace, dictionary] of Object.entries(pack.namespaces)) {
      if (!namespace || ['__proto__', 'constructor', 'prototype'].includes(namespace) || !dictionary || typeof dictionary !== 'object' || Array.isArray(dictionary) || Object.keys(dictionary).length === 0) return false
      for (const [key, value] of Object.entries(dictionary)) {
        if (['__proto__', 'constructor', 'prototype'].includes(key) || typeof value !== 'string' || !value.trim()) return false
      }
    }
    if (!Object.keys(pack.namespaces).length && (!Array.isArray(pack.dom) || !pack.dom.length)) return false
    if (pack.source !== undefined) {
      if (!pack.source || typeof pack.source !== 'object' || Array.isArray(pack.source)) return false
      const namespaceKeys = Object.keys(pack.namespaces).sort()
      const sourceNamespaceKeys = Object.keys(pack.source).sort()
      if (namespaceKeys.length !== sourceNamespaceKeys.length || namespaceKeys.some((key, index) => key !== sourceNamespaceKeys[index])) return false
      for (const [namespace, source] of Object.entries(pack.source)) {
        const translated = pack.namespaces[namespace]
        if (['__proto__', 'constructor', 'prototype'].includes(namespace) || !source || typeof source !== 'object' || Array.isArray(source) || !translated) return false
        const sourceKeys = Object.keys(source).sort()
        const translatedKeys = Object.keys(translated).sort()
        if (sourceKeys.length !== translatedKeys.length || sourceKeys.some((key, index) => key !== translatedKeys[index])) return false
        for (const key of sourceKeys) {
          if (typeof source[key] !== 'string' || !source[key].trim() || !validatePlaceholders(source[key], translated[key])) return false
        }
      }
    }
    if (pack.dom !== undefined) {
      if (!Array.isArray(pack.dom)) return false
      if (pack.dom.some((entry) => !entry || !isSafeDomSelector(entry.selector) || typeof entry.source !== 'string' || !entry.source.trim() || typeof entry.target !== 'string' || !entry.target.trim() || !validatePlaceholders(entry.source, entry.target))) return false
    }
    return true
  }
  const activeId = () => {
    try { return String(locale.getSnapshot().active || 'en').toLowerCase() }
    catch (_) { return 'en' }
  }
  const activeBaseId = () => activeId().split('-')[0]
  const uiText = (key) => {
    const texts = {
      en: { title: 'Community translations', intro: 'Import or export data-only JSON packs. Packs never execute code.', import: 'Import translation pack', empty: 'No local packs imported.', remove: 'Remove', export: 'Export', saved: 'Translation pack imported.', removed: 'Translation pack removed.', failed: 'Could not import this pack. Check its JSON and metadata.',
        review: 'Help translate a plugin', reviewHint: 'Add a locale pack under contributions/<plugin-id>/<locale>.json and submit a pull request.',
        coverage: 'Pack coverage', coverageCaption: 'These are entries included in translation packs, not percentages of all strings in an upstream plugin.', plugin: 'Plugin', english: 'English (en)', russian: 'Russian (ru)', namespaceKeys: 'Namespace keys', domMappings: 'DOM mappings', sourceMap: 'Source map', sourceIncluded: 'included', sourceMissing: 'not included', noPack: 'No pack', coverageEmpty: 'No built-in or local translation packs are loaded.',
        contributionHelp: 'Use dsh-i18n-mcp from an MCP client, or use the CLI and submit a regular pull request.', mcpGuide: 'MCP setup', manualGuide: 'CLI and manual contribution guide' },
      ru: { title: 'Переводы сообщества', intro: 'Импортируйте и экспортируйте JSON-пакеты с данными. Код из пакетов не запускается.', import: 'Импортировать пакет перевода', empty: 'Локальные пакеты не добавлены.', remove: 'Удалить', export: 'Экспорт', saved: 'Пакет перевода импортирован.', removed: 'Пакет перевода удалён.', failed: 'Не удалось импортировать пакет. Проверьте JSON и метаданные.',
        review: 'Помочь перевести плагин', reviewHint: 'Добавьте языковой пакет и отправьте запрос на внесение перевода.',
        coverage: 'Покрытие пакетами', coverageCaption: 'Здесь указаны записи в пакетах, а не процент всех строк исходного плагина.', plugin: 'Плагин', english: 'Английский (en)', russian: 'Русский (ru)', namespaceKeys: 'Ключи пространств имён', domMappings: 'DOM-подстановки', sourceMap: 'Карта исходных строк', sourceIncluded: 'есть', sourceMissing: 'нет', noPack: 'Нет пакета', coverageEmpty: 'Загруженных встроенных и локальных пакетов нет.',
        contributionHelp: 'Используйте сервер dsh-i18n-mcp в MCP-клиенте или подготовьте пакет в командной строке, затем отправьте запрос на внесение перевода.', mcpGuide: 'Настройка MCP', manualGuide: 'Командная строка и инструкция по внесению перевода' },
    }
    return (texts[activeId()] || texts[activeBaseId()] || texts.en)[key]
  }
  const validatePlaceholders = (source, target) => {
    const get = (value) => [...String(value).matchAll(/\{([A-Za-z0-9_]+)(?::[^{}]+)?\}/g)].map((match) => match[1]).sort().join('|')
    return get(source) === get(target)
  }
  const packKey = (pack) => `${pack.plugin.id}\0${pack.locale.toLowerCase()}`
  const allPacks = () => [...builtInPacks.values(), ...localPacks.values()]
  const coverageRows = () => {
    const packs = allPacks()
    const sourceCatalogs = new Map()
    const sourceCatalogId = (pluginId, sourceLocale) => `${pluginId.toLowerCase()}\0${sourceLocale.toLowerCase()}`
    const stableJson = (value) => {
      if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
      if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`
      return JSON.stringify(value)
    }
    const addSourceKeys = (catalog, namespaces) => {
      for (const [namespace, dictionary] of Object.entries(namespaces || {})) {
        for (const key of Object.keys(dictionary)) catalog.add(`${namespace}\0${key}`)
      }
    }
    for (const pack of packs) {
      const key = sourceCatalogId(pack.plugin.id, pack.sourceLocale)
      if (!sourceCatalogs.has(key)) sourceCatalogs.set(key, { keys: new Set(), canonicalMap: null, conflict: false })
      const catalog = sourceCatalogs.get(key)
      const sourceNamespaces = pack.source ?? (pack.locale.toLowerCase() === pack.sourceLocale.toLowerCase() ? pack.namespaces : null)
      if (sourceNamespaces) {
        const candidate = stableJson(sourceNamespaces)
        if (catalog.canonicalMap !== null && catalog.canonicalMap !== candidate) catalog.conflict = true
        else catalog.canonicalMap = candidate
        addSourceKeys(catalog.keys, sourceNamespaces)
      }
    }

    const plugins = new Map()
    for (const pack of packs) {
      const pluginId = pack.plugin.id.toLowerCase()
      const localeId = pack.locale.toLowerCase()
      if (!plugins.has(pluginId)) plugins.set(pluginId, new Map())
      const locales = plugins.get(pluginId)
      if (!locales.has(localeId)) locales.set(localeId, { namespaceKeys: new Set(), sourceRequirements: new Map(), domMappings: new Set(), sourceMapAvailable: false })
      const counts = locales.get(localeId)
      const sourceLocaleId = pack.sourceLocale.toLowerCase()
      if (!counts.sourceRequirements.has(sourceLocaleId)) counts.sourceRequirements.set(sourceLocaleId, new Set())
      const sourceRequirements = counts.sourceRequirements.get(sourceLocaleId)
      for (const [namespace, dictionary] of Object.entries(pack.namespaces)) {
        for (const key of Object.keys(dictionary)) {
          const keyId = `${namespace}\0${key}`
          counts.namespaceKeys.add(keyId)
          sourceRequirements.add(keyId)
        }
      }
      for (const entry of pack.dom || []) counts.domMappings.add(`${entry.selector}\0${entry.source}`)
    }
    for (const [pluginId, locales] of plugins) {
      for (const counts of locales.values()) {
        counts.sourceMapAvailable = counts.namespaceKeys.size > 0 && [...counts.sourceRequirements].every(([sourceLocale, keys]) => {
          const catalog = sourceCatalogs.get(sourceCatalogId(pluginId, sourceLocale))
          return catalog && !catalog.conflict && [...keys].every((key) => catalog.keys.has(key))
        })
        delete counts.sourceRequirements
      }
    }
    return [...plugins].sort(([left], [right]) => left.localeCompare(right)).map(([pluginId, locales]) => ({ pluginId, locales }))
  }
  const coverageLocaleIds = (rows) => {
    const localeIds = new Set(['en', 'ru'])
    for (const row of rows) for (const localeId of row.locales.keys()) localeIds.add(localeId)
    return [...localeIds].sort((left, right) => {
      const priority = { en: 0, ru: 1 }
      return (priority[left] ?? 2) - (priority[right] ?? 2) || left.localeCompare(right)
    })
  }
  const sourceMapAvailable = (counts) => counts.sourceMapAvailable
  const notifyPackSubscribers = () => {
    packRevision += 1
    for (const subscriber of [...packSubscribers]) {
      try { subscriber() } catch (_) { /* one panel subscriber must not block the others */ }
    }
  }
  const rebuildPackRegistrations = () => {
    for (const dispose of registrations.splice(0).reverse()) {
      try { dispose?.() } catch (_) { /* ignore stale registrar disposers */ }
    }
    domIndex.clear()

    const languages = new Map()
    const dictionaries = new Map()
    for (const pack of allPacks()) {
      const localeId = pack.locale.toLowerCase()
      if (!['en', 'zh', 'ru'].includes(localeId) && !languages.has(localeId)) {
        languages.set(localeId, { id: pack.locale, label: pack.label || pack.locale, fallback: 'en' })
      }
      for (const [namespace, dictionary] of Object.entries(pack.namespaces)) {
        const key = `${localeId}\0${namespace}`
        if (!dictionaries.has(key)) dictionaries.set(key, { locale: pack.locale, namespace, entries: Object.create(null) })
        Object.assign(dictionaries.get(key).entries, dictionary)
      }
      for (const entry of pack.dom || []) {
        const key = `${entry.selector}\0${entry.source}`
        const value = domIndex.get(key) || { selector: entry.selector, source: entry.source, targets: Object.create(null) }
        value.targets[localeId] = entry.target
        domIndex.set(key, value)
      }
    }

    for (const language of languages.values()) {
      try { registrations.push(locale.addLanguage(language)) }
      catch (_) { /* a native plugin or another pack already owns this locale */ }
    }
    for (const { locale: localeId, namespace, entries } of dictionaries.values()) {
      try { registrations.push(locale.register(namespace, localeId, entries)) }
      catch (_) { /* a native plugin dictionary already owns this namespace/locale */ }
    }
  }
  const registerPack = (pack, isBuiltin = false) => {
    if (!isSafePack(pack)) return false
    const target = isBuiltin ? builtInPacks : localPacks
    target.set(packKey(pack), pack)
    rebuildPackRegistrations()
    return true
  }
  const importPack = async (file) => {
    if (!file || file.size > 512 * 1024) throw new Error('Translation pack must be smaller than 512 KB')
    const pack = JSON.parse(await file.text())
    if (!isSafePack(pack)) throw new Error('Invalid translation pack')
    const stored = getStoredPacks().filter((item) => packKey(item) !== packKey(pack))
    if (stored.length >= 50) throw new Error('The local pack limit (50) has been reached')
    stored.push(pack)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))
    registerPack(pack)
    return pack
  }
  const exportPack = (pack) => {
    const blob = new Blob([JSON.stringify(pack, null, 2) + '\n'], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${pack.plugin.id.replace(/[^a-z0-9._-]/gi, '-')}-${pack.locale}.json`
    anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  const setStoredPacks = (packs) => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(packs)) }
    catch (_) { /* storage may be disabled */ }
  }

  const rootElements = () => {
    const roots = new Set()
    for (const entry of domIndex.values()) {
      try { document.querySelectorAll(entry.selector).forEach((root) => roots.add(root)) }
      catch (_) { /* invalid selectors are rejected by pack validation */ }
    }
    return roots
  }
  const resolveText = (selector, text, language, entries) => resolveDomTranslation(selector, text, language, entries)
  const translatedConfirm = originalConfirm && function (message, ...args) {
    if (typeof message === 'string') {
      const selectors = [...new Set([...domIndex.values()].map((entry) => entry.selector))]
      for (const selector of selectors) {
        const entries = [...domIndex.values()].filter((entry) => entry.selector === selector)
        const translated = resolveDomTranslation(selector, message, activeId(), entries)
        if (translated !== message) return Reflect.apply(originalConfirm, this, [translated, ...args])
      }
    }
    return Reflect.apply(originalConfirm, this, [message, ...args])
  }
  if (originalConfirm && typeof window !== 'undefined') window.confirm = translatedConfirm
  const insideIgnoredNode = (node) => {
    const parent = node.parentElement
    return !parent || parent.closest('code,pre,script,style,textarea,input,select,kbd,samp,[contenteditable="true"],[role="textbox"]') !== null
  }
  const translateRoot = (root, language) => {
    const selectors = [...new Set([...domIndex.values()].map((entry) => entry.selector))]
    let selector = selectors.find((candidate) => {
      try { return root.matches?.(candidate) }
      catch (_) { return false }
    })
    if (!selector) selector = selectors.find((candidate) => root.closest?.(candidate))
    if (!selector) return
    const entries = [...domIndex.values()].filter((entry) => entry.selector === selector)
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    const nodes = []
    while (walker.nextNode()) nodes.push(walker.currentNode)
    for (const node of nodes) {
      if (!node.nodeValue || insideIgnoredNode(node)) continue
      const leading = node.nodeValue.match(/^\s*/)?.[0] || ''
      const trailing = node.nodeValue.match(/\s*$/)?.[0] || ''
      const translated = resolveDomValue(node, 'text', selector, node.nodeValue.trim(), language, entries, domOriginals)
      if (translated !== node.nodeValue.trim()) node.nodeValue = leading + translated + trailing
    }
    const selects = []
    if (root.matches?.('select')) selects.push(root)
    root.querySelectorAll?.('select').forEach((select) => selects.push(select))
    translateSelectOptions(selects.flatMap((select) => [...select.options]), selector, language, entries, domOriginals)
    const attributeElements = [...root.querySelectorAll?.('[title],[placeholder],[aria-label]') || []]
    if (root.matches?.('[title],[placeholder],[aria-label]')) attributeElements.unshift(root)
    for (const element of attributeElements) {
      if (element.matches('input,textarea,[contenteditable="true"]') && !element.hasAttribute('placeholder')) continue
      for (const attribute of ['title', 'placeholder', 'aria-label']) {
        const value = element.getAttribute(attribute)
        if (!value) continue
        const translated = resolveDomValue(element, attribute, selector, value.trim(), language, entries, domOriginals)
        if (translated !== value.trim()) element.setAttribute(attribute, translated)
      }
    }
  }
  const syncDOM = () => {
    if (typeof document === 'undefined') return
    for (const root of rootElements()) translateRoot(root, activeId())
  }
  const scheduleDOM = () => {
    if (scheduled) return
    scheduled = true
    requestAnimationFrame(() => { scheduled = false; syncDOM() })
  }

  // Local packs are immediately available even when the built-in pack route is slow or offline.
  for (const pack of getStoredPacks()) registerPack(pack)

  if (typeof fetch === 'function') {
    fetch(PACKS_URL, { headers: { Accept: 'application/json' }, cache: 'no-store' }).then((response) => response.ok ? response.json() : null).then((data) => {
      for (const pack of data?.packs || []) registerPack(pack, true)
      notifyPackSubscribers()
      syncDOM()
    }).catch(() => {})
  }

  if (typeof document !== 'undefined' && typeof MutationObserver !== 'undefined') {
    observer = new MutationObserver(scheduleDOM)
    observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['title', 'placeholder', 'aria-label'] })
    syncDOM()
  }
  const unsubscribeLocale = typeof locale.subscribe === 'function' ? locale.subscribe(syncDOM) : () => {}

  if (React && typeof ctx.slots?.inject === 'function') {
    function CommunityPackCard() {
      const [, forceUpdate] = React.useState(0)
      const [status, setStatus] = React.useState('')
      const packs = getStoredPacks()
      const renderedPackRevision = packRevision
      const coverage = coverageRows()
      const locales = coverageLocaleIds(coverage)
      const h = React.createElement
      React.useEffect(() => locale.subscribe(() => forceUpdate((n) => n + 1)), [])
      React.useEffect(() => {
        const refreshCoverage = () => forceUpdate((n) => n + 1)
        packSubscribers.add(refreshCoverage)
        if (packRevision !== renderedPackRevision) refreshCoverage()
        return () => packSubscribers.delete(refreshCoverage)
      }, [])
      const onChange = async (event) => {
        const file = event.target.files?.[0]
        event.target.value = ''
        if (!file) return
        try { await importPack(file); setStatus(uiText('saved')); forceUpdate((n) => n + 1) }
        catch (error) { setStatus(`${uiText('failed')} ${error?.message || ''}`) }
      }
      const rows = packs.length ? packs.map((pack, index) => h('div', { key: `${pack.plugin.id}:${pack.locale}`, style: { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--dsw-alias-border-l2)' } },
        h('span', { style: { flex: 1 } }, `${pack.plugin.id} · ${pack.locale}`),
        h('button', { type: 'button', onClick: () => exportPack(pack) }, uiText('export')),
        h('button', { type: 'button', onClick: () => {
          const next = packs.filter((_, i) => i !== index)
          setStoredPacks(next)
          localPacks.clear()
          for (const item of next) localPacks.set(packKey(item), item)
          rebuildPackRegistrations()
          setStatus(uiText('removed'))
          forceUpdate((n) => n + 1)
        } }, uiText('remove')),
      )) : h('p', null, uiText('empty'))
      const localeHeader = (localeId) => localeId === 'en' ? uiText('english') : localeId === 'ru' ? uiText('russian') : localeId
      const coverageHeader = h('thead', null,
        h('tr', null,
          h('th', { scope: 'col', rowSpan: 2, style: { textAlign: 'left', padding: '6px 8px' } }, uiText('plugin')),
          ...locales.map((localeId) => h('th', { key: localeId, scope: 'colgroup', colSpan: 3, style: { textAlign: 'center', padding: '6px 8px' } }, localeHeader(localeId))),
        ),
        h('tr', null,
          ...locales.flatMap((localeId) => [
            h('th', { key: `${localeId}:namespace`, scope: 'col', style: { textAlign: 'right', padding: '6px 8px' } }, uiText('namespaceKeys')),
            h('th', { key: `${localeId}:dom`, scope: 'col', style: { textAlign: 'right', padding: '6px 8px' } }, uiText('domMappings')),
            h('th', { key: `${localeId}:source`, scope: 'col', style: { textAlign: 'left', padding: '6px 8px' } }, uiText('sourceMap')),
          ]),
        ),
      )
      const coverageBody = coverage.length ? coverage.map(({ pluginId, locales: pluginLocales }) => h('tr', { key: pluginId },
        h('th', { scope: 'row', style: { textAlign: 'left', padding: '6px 8px' } }, pluginId),
        ...locales.flatMap((localeId) => {
          const counts = pluginLocales.get(localeId)
          if (!counts) return [h('td', { key: `${localeId}:missing`, colSpan: 3, style: { padding: '6px 8px' } }, uiText('noPack'))]
          return [
            h('td', { key: `${localeId}:namespace`, style: { textAlign: 'right', padding: '6px 8px' } }, counts.namespaceKeys.size),
            h('td', { key: `${localeId}:dom`, style: { textAlign: 'right', padding: '6px 8px' } }, counts.domMappings.size),
            h('td', { key: `${localeId}:source`, style: { padding: '6px 8px' } }, sourceMapAvailable(counts) ? uiText('sourceIncluded') : uiText('sourceMissing')),
          ]
        }),
      )) : [h('tr', { key: 'empty' }, h('td', { colSpan: 1 + locales.length * 3, style: { padding: '6px 8px' } }, uiText('coverageEmpty')))]
      const coverageTable = h('table', { style: { borderCollapse: 'collapse', width: '100%', marginTop: 8 } },
        h('caption', { style: { textAlign: 'left', padding: '6px 8px' } }, uiText('coverageCaption')),
        h('colgroup', { span: 1 }),
        ...locales.map((localeId) => h('colgroup', { key: localeId, span: 3 })),
        coverageHeader,
        h('tbody', null, ...coverageBody),
      )
      const contributionDoc = 'https://github.com/tommilevs/dsh-multi-lang-ui/blob/main/CONTRIBUTING.md'
      return h('section', { style: { padding: 16, maxWidth: 760 } },
        h('h2', null, uiText('title')),
        h('p', null, uiText('intro')),
        h('h3', null, uiText('coverage')),
        h('div', { style: { overflowX: 'auto', maxWidth: '100%' } }, coverageTable),
        h('label', { style: { display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' } }, uiText('import'), h('input', { type: 'file', accept: 'application/json,.json', onChange, style: { maxWidth: 240 } })),
        status ? h('p', { role: 'status' }, status) : null,
        h('div', { style: { marginTop: 14 } }, ...rows),
        h('h3', null, uiText('review')),
        h('p', null, uiText('reviewHint')),
        h('p', null, uiText('contributionHelp')),
        h('p', null,
          h('a', { href: `${contributionDoc}#mcp-setup` }, uiText('mcpGuide')),
          ' · ',
          h('a', { href: contributionDoc }, uiText('manualGuide')),
        ),
      )
    }
    ctx.slots.inject('settings.section', () => {
      try {
        const unregister = ctx.slots.register({
          name: 'settings.section',
          id: 'dsh-multi-lang-community-packs',
          order: 61,
          label: () => uiText('title'),
          inject: () => ({}),
        }, CommunityPackCard)
        return () => unregister()
      } catch (_) { return () => {} }
    })
  }

  ctx.effect(() => () => {
    try { observer?.disconnect() } catch (_) { /* noop */ }
    try { unsubscribeLocale?.() } catch (_) { /* noop */ }
    if (typeof window !== 'undefined' && window.confirm === translatedConfirm) window.confirm = originalConfirm
    for (const dispose of registrations.reverse()) {
      try { dispose?.() } catch (_) { /* noop */ }
    }
  }, 'dsh-multi-lang-ui: community packs and scoped UI translation')
}
