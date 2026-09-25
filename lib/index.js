import crypto from 'node:crypto'
import { registerPluginUpdater } from './plugin-updater.js'
import { registerTranslator } from './translator.js'
import { getCoreDictionaries, getPluginDictionaries, getPluginDictionariesByNames, getAllDictionaries, getZhRuMap, getTranslationPacks } from './locales.js'
// dsh-multi-lang-ui — серверная половина.
//
// Словари и переключатель живут в браузере (lib/client.js). Хосту переводить
// нечего, но у выбора языка есть сохраняемая настройка: регистрируем её схему
// в собственном namespace, чтобы запись переживала браузеры и машины череж
// штатный механизм настроек DSH.
import z from '@deepseek-ai/schemastery'
import { SYSTEM_PROMPT_PRESETS } from './pure.js'
import { readConfigValue, readSettings } from './config.js'


const sendJsonWithEtag = (request, response, obj, maxAge = 300) => {
  const body = Buffer.from(JSON.stringify(obj), 'utf-8')
  const etag = '"' + crypto.createHash('md5').update(body).digest('hex') + '"'
  const ifNoneMatch = request?.headers?.['if-none-match']
  if (ifNoneMatch && (ifNoneMatch === etag || ifNoneMatch === '*' || ifNoneMatch === `W/${etag}`)) {
    response.writeHead(304, {
      'etag': etag,
      'cache-control': `public, max-age=${maxAge}, must-revalidate`,
    })
    response.end()
    return
  }
  response.writeHead(200, {
    'content-type': 'application/json; charset=utf-8',
    'etag': etag,
    'cache-control': `public, max-age=${maxAge}, must-revalidate`,
    'content-length': body.length,
  })
  if (request?.method === 'HEAD') {
    response.end()
  } else {
    response.end(body)
  }
}

export const name = '@tommilevs/dsh-multi-lang-ui'

// DSH 0.1.7 replaced the old namespaced settings.register/get API with
// volatile plugin Config fields projected by @deepseek-ai/dsh-settings.
export const Config = z.object({
  enabled: z.boolean().default(true).volatile(),
  overrides: z.dict(z.string()).default({}).volatile(),
  typography: z.object({
    enabled: z.boolean().default(false),
    yo: z.boolean().default(true),
    liveInput: z.boolean().default(false)
  }).default({ enabled: false, yo: true, liveInput: false }).volatile(),
  agentPrompt: z.boolean().default(false).volatile(),
  agentPromptPreset: z.string().default('technical_expert').volatile(),
  slashAliases: z.boolean().default(false).volatile(),
  quickSwitch: z.boolean().default(true).volatile(),
  translateEngine: z.string().default('off').volatile(),
  localApiUrl: z.string().default('http://127.0.0.1:5000').volatile()
})


export function apply(ctx, config) {
  // A custom settings card owns its page, so leave schema-generated UI disabled.
  ctx.inject(['settings'], (settingsCtx) => {
    settingsCtx.effect(() => settingsCtx.settings.configure({ auto: false }, ctx.fiber))
  })

  // #68: русский системный промпт агента (опционально). Регистрируем секцию
  // промпта, которая задёт стиль ответов по-русски, когда включён флаг
  // russian-lang.agentPrompt. Секция — официальная точка расширения ядра.
  ctx.inject(['settings', 'systemPrompt'], (settingsCtx, prompt) => {
    const RU_SECTION = 'dsh-multi-lang-ui-agent-prompt'
    const DEFAULT_RU_TEXT = 'Отвечай пользователю на русском языке. Если пользователь пишет на другом языке, отвечай на его языке.'
    let currentText = ''
    const sync = () => {
      const want = !!readConfigValue(config, 'agentPrompt', false)
      const presetKey = readConfigValue(config, 'agentPromptPreset', 'technical_expert')
      const preset = SYSTEM_PROMPT_PRESETS[presetKey]
      const text = want ? (preset ? preset.text : DEFAULT_RU_TEXT) : ''
      if (text === currentText) return
      currentText = text
      prompt.section({ name: RU_SECTION, order: 1000, text })
    }
    ctx.on('settings/document-updated', (entryId) => { if (entryId === 'russian-lang') sync() })
    sync()
  })

  // Web endpoints: One-click plugin updater, modular lazy-plugin dictionary serving, & translator gateway
  if (typeof ctx.inject === 'function') {
    ctx.inject(['webServer'], (wctx) => {
      try {
        const mount = () => {
          const unregUpdater = registerPluginUpdater(wctx, {
            endpoint: '/api/dsh-multi-lang-ui/update',
            packageName: '@tommilevs/dsh-multi-lang-ui',
            manifestUrl: new URL('../package.json', import.meta.url),
          })

          const unregTranslator = registerTranslator(wctx, () => readSettings(config))

          let ws = null
          try { ws = wctx?.webServer } catch (_) { ws = null }

          const unregsDict = []
          if (ws && typeof ws.register === 'function') {
            // 1. Core dictionary only (fast-boot, ~135 KB)
            unregsDict.push(ws.register({
              kind: 'exact',
              path: '/api/dsh-multi-lang-ui/dict/core',
              handler: async (request, response) => {
                try {
                  if (request.method !== 'GET' && request.method !== 'HEAD') {
                    response.writeHead(405, { allow: 'GET, HEAD', 'content-type': 'application/json; charset=utf-8' })
                    response.end(JSON.stringify({ error: 'Method not allowed' }))
                    return
                  }
                  const core = getCoreDictionaries()
                  const zhRu = getZhRuMap()
                  sendJsonWithEtag(request, response, { core, zhRu })
                } catch (err) {
                  response.writeHead(500, { 'content-type': 'application/json; charset=utf-8' })
                  response.end(JSON.stringify({ error: String(err) }))
                }
              },
            }))

            // 2. On-demand plugins dictionary serving (query: ?names=p1,p2...)
            unregsDict.push(ws.register({
              kind: 'prefix',
              path: '/api/dsh-multi-lang-ui/dict/plugins',
              handler: async (request, response) => {
                try {
                  if (request.method !== 'GET' && request.method !== 'HEAD') {
                    response.writeHead(405, { allow: 'GET, HEAD', 'content-type': 'application/json; charset=utf-8' })
                    response.end(JSON.stringify({ error: 'Method not allowed' }))
                    return
                  }
                  const url = new URL(request.url, 'http://localhost')
                  const namesParam = url.searchParams.get('names') || url.searchParams.get('list') || ''
                  const names = namesParam ? namesParam.split(',').map((s) => s.trim()).filter(Boolean) : null
                  const plugins = getPluginDictionariesByNames(names)
                  sendJsonWithEtag(request, response, { plugins })
                } catch (err) {
                  response.writeHead(500, { 'content-type': 'application/json; charset=utf-8' })
                  response.end(JSON.stringify({ error: String(err) }))
                }
              },
            }))

            // 3. Backward compatibility all-dictionaries endpoint
            unregsDict.push(ws.register({
              kind: 'exact',
              path: '/api/dsh-multi-lang-ui/dict/all',
              handler: async (request, response) => {
                try {
                  if (request.method !== 'GET' && request.method !== 'HEAD') {
                    response.writeHead(405, { allow: 'GET, HEAD', 'content-type': 'application/json; charset=utf-8' })
                    response.end(JSON.stringify({ error: 'Method not allowed' }))
                    return
                  }
                  const all = getAllDictionaries()
                  const zhRu = getZhRuMap()
                  sendJsonWithEtag(request, response, Object.assign({}, all, { core: getCoreDictionaries(), plugins: getPluginDictionaries(), zhRu }))
                } catch (err) {
                  response.writeHead(500, { 'content-type': 'application/json; charset=utf-8' })
                  response.end(JSON.stringify({ error: String(err) }))
                }
              },
            }))

            // Community packs contain inert JSON only. Client modules register
            // the locale dictionaries and apply exact-text DOM mappings inside
            // each pack's explicitly scoped plugin root.
            unregsDict.push(ws.register({
              kind: 'exact',
              path: '/api/dsh-multi-lang-ui/packs',
              handler: async (request, response) => {
                try {
                  if (request.method !== 'GET' && request.method !== 'HEAD') {
                    response.writeHead(405, { allow: 'GET, HEAD', 'content-type': 'application/json; charset=utf-8' })
                    response.end(JSON.stringify({ error: 'Method not allowed' }))
                    return
                  }
                  sendJsonWithEtag(request, response, { packs: getTranslationPacks() })
                } catch (err) {
                  response.writeHead(500, { 'content-type': 'application/json; charset=utf-8' })
                  response.end(JSON.stringify({ error: String(err) }))
                }
              },
            }))
          }

          return () => {
            if (typeof unregUpdater === 'function') unregUpdater()
            if (typeof unregTranslator === 'function') unregTranslator()
            for (const u of unregsDict) {
              if (typeof u === 'function') u()
            }
          }
        }
        if (typeof wctx.effect === 'function') wctx.effect(mount, 'dsh-multi-lang-ui: web routes')
        else mount()
      } catch (err) {
        if (typeof wctx.logger?.warn === 'function') {
          wctx.logger.warn('Failed to mount web routes:', err)
        }
      }
    })
  }
}
