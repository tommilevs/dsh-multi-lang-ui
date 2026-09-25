// dsh-multi-lang-ui — браузерная половина. ФАЙЛ СГЕНЕРИРОВАН, правьте ru/*.json
// и ru-plugins/*.json и запускайте build.py.
//
// Плагин докладывает русский словарь в чужие namespace'ы: реестр локалей это
// разрешает — register(ns, locale, dict) конфликтует только если пара
// (namespace, язык) уже занята, а "ru" не занимает никто.
//
// Ядро без русского: список языков (LOCALES) зашит в @deepseek-ai/dsh-client-locale,
// из него родная строка Language строит меню и setLocale() берёт валидацию.
// Список живёт в snapshot локаль-runtime — плагин расширяет snapshot пунктом
// "Русский", и родной селектор показывает его третьей позицией. Файлы ядра не
// правятся; если ядро когда-нибудь узнает "ru" само, расширение не происходит.
window.__ModuleLoader__.load({
  id: '@tommilevs/dsh-multi-lang-ui',
  factory: (require) => {
    var module = { exports: {} }
    var React = null
    try { React = require('react') } catch (e) { /* карточка настроек необязательна */ }

    let isInspectorActive = false
    let hoverBoxEl = null
    let pillEl = null

//__PURE_JS__

    /** namespace -> { ключ: перевод } */
    const RU = /*__RU_BOOTSTRAP__*/{}

    /** zh-строка -> ru-строка для DOM-перевода панелей вне locale-ядра. */
    const ZH_RU = /*__ZH_RU__*/{}

    // Подписи собственной карточки настроек (namespace russian-lang).
    RU['russian-lang'] = /*__CARD_RU__*/{}

    const SETTINGS_NS_NAME = 'russian-lang'
    // Plugins page row seat (DSH 0.1.6-alpha.2): key = '<package name>#<row id>'.
    const ROW_CONFIG_KEY = '@tommilevs/dsh-multi-lang-ui#russian-lang'

    function apply(ctx) {
      const runtime = ctx.locale
      const resolveScope = (c) => {
        try {
          if (c && c.configForms) return c.configForms.get(SETTINGS_NS_NAME)
          if (c && c.settingsScope) return c.settingsScope.bind({ namespace: SETTINGS_NS_NAME })
        } catch (err) { void err }
        return null
      }
      const rawScope = resolveScope(ctx)
      const scope = (rawScope && typeof rawScope.getSnapshot === 'function') ? rawScope : {
        getSnapshot: () => ({ status: 'ready', value: {} }),
        subscribe: () => () => {},
        set: () => Promise.resolve()
      }

      // 1. Словари ядра DSH: каждый namespace — свой эффект, снимается вместе с плагином
      for (const ns of Object.keys(RU)) {
        ctx.effect(() => {
          try { return ctx.locale.register(ns, 'ru', RU[ns]) }
          catch (err) { return () => {} }
        }, 'dsh-multi-lang-ui: ' + ns)
      }

      // 1a. Двухфазная быстрая загрузка и клиентский кэш словарей (CacheStorage / localStorage) (Issue #284, #285)
      const registerDictMap = (dictMap) => {
        if (!dictMap || typeof dictMap !== 'object') return
        for (const ns of Object.keys(dictMap)) {
          if (ns === 'zhRu' || ns === 'plugins' || ns === 'core') continue
          const dict = dictMap[ns]
          if (typeof dict !== 'object' || !dict) continue
          if (!RU[ns]) {
            RU[ns] = dict
            ctx.effect(() => {
              try { return ctx.locale.register(ns, 'ru', dict) }
              catch (err) { return () => {} }
            }, 'dsh-multi-lang-ui: ' + ns)
          } else {
            Object.assign(RU[ns], dict)
          }
        }
      }

      const CACHE_NAME = 'dsh-ru-cache-v1'
      const loadLocalDict = (key) => {
        try {
          const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('dsh_ru_' + key) : null
          return raw ? JSON.parse(raw) : null
        } catch (_) { return null }
      }
      const saveLocalDict = (key, etag, data) => {
        try {
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem('dsh_ru_' + key, JSON.stringify({ etag, data }))
          }
        } catch (_e) { void _e }
      }

      // Мгновенная синхронная гидратация ядра из кэша (zero FOUT при перезагрузке)
      try {
        const cachedCore = loadLocalDict('core')
        if (cachedCore && cachedCore.data && cachedCore.data.core) {
          registerDictMap(cachedCore.data.core)
          if (cachedCore.data.zhRu && typeof ZH_RU === 'object') {
            Object.assign(ZH_RU, cachedCore.data.zhRu)
          }
        }
      } catch (_e) { void _e }

      const fetchCachedResource = async (url, cacheKey, onData) => {
        let etag = null
        let delivered = false

        if (typeof caches !== 'undefined') {
          try {
            const cache = await caches.open(CACHE_NAME)
            const matched = await cache.match(url)
            if (matched) {
              etag = matched.headers.get('etag')
              const parsed = await matched.json()
              if (parsed) {
                delivered = true
                onData(parsed)
              }
            }
          } catch (_e) { void _e }
        }

        if (!delivered && cacheKey) {
          const local = loadLocalDict(cacheKey)
          if (local && local.data) {
            etag = local.etag
            delivered = true
            onData(local.data)
          }
        }

        if (typeof fetch !== 'function') return
        try {
          const headers = { 'Accept': 'application/json' }
          if (etag) headers['If-None-Match'] = etag
          const res = await fetch(url, { headers })
          if (res.status === 304) return
          if (res.ok) {
            const newEtag = res.headers.get('etag')
            const cloned = res.clone()
            const data = await res.json()
            if (data) {
              onData(data)
              if (typeof caches !== 'undefined') {
                try {
                  const cache = await caches.open(CACHE_NAME)
                  await cache.put(url, cloned)
                } catch (_e) { void _e }
              }
              if (cacheKey) saveLocalDict(cacheKey, newEtag, data)
            }
          }
        } catch (_e) { void _e }
      }

      const loadedPluginNames = new Set()
      const pendingPluginLoads = new Set()
      let pluginBatchTimer = null

      const loadPluginDictionaries = (names) => {
        if (typeof fetch !== 'function') return
        const toLoad = []
        for (const raw of names) {
          const n = String(raw).trim()
          if (!n || loadedPluginNames.has(n) || pendingPluginLoads.has