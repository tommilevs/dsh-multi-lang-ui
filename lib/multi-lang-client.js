/* Client-side community locale packs and exact plugin-scoped DOM translations. */
function applyMultiLang(ctx) {
  const locale = ctx.locale
  const PACKS_URL = '/api/dsh-multi-lang-ui/packs'
  const STORAGE_KEY = 'dsh-multi-lang-ui.community-packs.v1'
  const localPacks = new Map()
  const builtInPacks = new Map()
  const registrations = []
  const domIndex = new Map()
  const domOriginals = new WeakMap()
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
        review: 'Help translate a plugin', reviewHint: 'Add a locale pack under contributions/<plugin-id>/<locale>.json and submit a pull request.' },
      ru: { title: 'Переводы сообщества', intro: 'Импортируйте и экспортируйте JSON-пакеты с данными. Код из пакетов не запускается.', import: 'Импортировать пакет перевода', empty: 'Локальные пакеты не добавлены.', remove: 'Удалить', export: 'Экспорт', saved: 'Пакет перевода импортирован.', removed: 'Пакет перевода удалён.', failed: 'Не удалось импортировать пакет. Проверьте JSON и метаданные.',
        review: 'Помочь перевести плагин', reviewHint: 'Добавьте языковой пакет в contributions/<plugin-id>/<locale>.json и отправьте pull request.' },
    }
    return (texts[activeId()] || texts[activeBaseId()] || texts.en)[key]
  }
  const validatePlaceholders = (source, target) => {
    const get = (value) => [...String(value).matchAll(/\{([A-Za-z0-9_]+)(?::[^{}]+)?\}/g)].map((match) => match[1]).sort().join('|')
    return get(source) === get(target)
  }
  const packKey = (pack) => `${pack.plugin.id}\0${pack.locale.toLowerCase()}`
  const allPacks = () => [...builtInPacks.values(), ...localPacks.values()]
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

  if (typeof fetch === 'function') {
    fetch(PACKS_URL, { headers: { Accept: 'application/json' }, cache: 'no-store' }).then((response) => response.ok ? response.json() : null).then((data) => {
      for (const pack of data?.packs || []) registerPack(pack, true)
      for (const pack of getStoredPacks()) registerPack(pack)
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
      const h = React.createElement
      React.useEffect(() => locale.subscribe(() => forceUpdate((n) => n + 1)), [])
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
      return h('section', { style: { padding: 16, maxWidth: 760 } },
        h('h2', null, uiText('title')),
        h('p', null, uiText('intro')),
        h('label', { style: { display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' } }, uiText('import'), h('input', { type: 'file', accept: 'application/json,.json', onChange, style: { maxWidth: 240 } })),
        status ? h('p', { role: 'status' }, status) : null,
        h('div', { style: { marginTop: 14 } }, ...rows),
        h('h3', null, uiText('review')),
        h('p', null, uiText('reviewHint')),
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
    for (const dispose of registrations.reverse()) {
      try { dispose?.() } catch (_) { /* noop */ }
    }
  }, 'dsh-multi-lang-ui: community packs and scoped UI translation')
}
