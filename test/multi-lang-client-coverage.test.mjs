import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'

const clientSource = readFileSync(new URL('../lib/multi-lang-client.js', import.meta.url), 'utf8')
const domTranslationSource = readFileSync(new URL('../lib/dom-translation.js', import.meta.url), 'utf8')

const pack = (id, language, namespaces, options = {}) => ({
  plugin: { id, version: '1.0.0', source: 'https://example.test/plugin', license: 'MIT' },
  locale: language,
  sourceLocale: 'en',
  namespaces,
  ...(options.source === undefined ? {} : { source: options.source }),
  ...(options.dom === undefined ? {} : { dom: options.dom }),
})

const element = (type, props, ...children) => ({
  type,
  props: props || {},
  children: children.flat(Infinity).filter((child) => child !== null && child !== undefined && child !== false),
})

function allElements(root) {
  return [root, ...root.children.flatMap((child) => child && typeof child === 'object' ? allElements(child) : [])]
}

function textContent(root) {
  return root.children.map((child) => child && typeof child === 'object' ? textContent(child) : String(child ?? '')).join('')
}

async function mountCommunityPanel(activeLocale = 'en', { deferPacks = false, sourceConflict = false, caseVariant = false } = {}) {
  const builtInPack = pack('builtin-plugin', 'en', {
    settings: { title: 'Title', save: 'Save' },
  }, {
    source: { settings: { title: '标题', save: '保存' } },
    dom: [
      { selector: '[data-dsh-plugin="builtin-plugin"]', source: '打开', target: 'Open' },
      { selector: '[data-dsh-plugin="builtin-plugin"]', source: '关闭', target: 'Close' },
    ],
  })
  const importedPack = pack('@community/locale-tools', 'ru', {
    common: { hello: 'Привет', goodbye: 'До свидания' },
    settings: { save: 'Сохранить' },
  }, {
    ...(sourceConflict ? { source: { common: { hello: 'Hi', goodbye: 'Goodbye' }, settings: { save: 'Save' } } } : {}),
    dom: [{ selector: '[data-dsh-plugin="locale-tools"]', source: '保存', target: 'Сохранить' }],
  })
  if (caseVariant) importedPack.plugin.id = '@community/Locale-Tools'
  const sourceCommunityPack = pack('@community/locale-tools', 'en', {
    common: { hello: 'Hello', goodbye: 'Goodbye' },
    settings: { save: 'Save' },
  }, { dom: [] })
  if (caseVariant) sourceCommunityPack.plugin.id = '@Community/locale-tools'
  const storedValue = JSON.stringify([importedPack, sourceCommunityPack])
  let communityComponent
  let resolvePackResponse
  let renderUpdates = 0
  const hookState = []
  const hookEffects = []
  let stateIndex = 0
  let effectIndex = 0
  const context = {
    React: {
      createElement: element,
      useState: (initial) => {
        const index = stateIndex++
        if (!(index in hookState)) hookState[index] = initial
        return [hookState[index], (next) => {
          hookState[index] = typeof next === 'function' ? next(hookState[index]) : next
          renderUpdates += 1
        }]
      },
      useEffect: (effect) => {
        const index = effectIndex++
        if (!(index in hookEffects)) hookEffects[index] = effect
      },
    },
    fetch: () => deferPacks
      ? new Promise((resolve) => { resolvePackResponse = resolve })
      : Promise.resolve({ ok: true, json: async () => ({ packs: [builtInPack] }) }),
    localStorage: {
      getItem: () => storedValue,
      setItem: () => {},
    },
    ctx: {
      effect: () => {},
      locale: {
        getSnapshot: () => ({ active: activeLocale }),
        addLanguage: () => () => {},
        register: () => () => {},
        subscribe: () => () => {},
      },
      slots: {
        inject: (_slotName, initialize) => initialize(),
        register: (_slot, component) => {
          communityComponent = component
          return () => {}
        },
      },
    },
  }

  vm.runInNewContext(`${domTranslationSource}\n${clientSource}\napplyMultiLang(ctx)`, context)
  assert.equal(typeof communityComponent, 'function', 'the existing settings slot should register the community panel')
  if (!deferPacks) await new Promise((resolve) => setImmediate(resolve))
  const render = () => {
    stateIndex = 0
    effectIndex = 0
    return communityComponent()
  }
  return {
    render,
    flushEffects: () => hookEffects.map((effect) => effect()),
    resolvePacks: () => resolvePackResponse({ ok: true, json: async () => ({ packs: [builtInPack] }) }),
    get renderUpdates() { return renderUpdates },
  }
}

async function renderCommunityPanel(activeLocale = 'en', options = {}) {
  return (await mountCommunityPanel(activeLocale, options)).render()
}

test('community settings render accessible locale columns and pack-derived counts from built-in and imported packs', async () => {
  const panel = await renderCommunityPanel()
  const nodes = allElements(panel)
  const table = nodes.find((node) => node.type === 'table')
  assert.ok(table, 'coverage is presented as a table')
  const scrollContainer = nodes.find((node) => node.type === 'div' && node.children.includes(table))
  assert.equal(scrollContainer?.props.style.overflowX, 'auto')
  assert.equal(scrollContainer?.props.style.maxWidth, '100%')
  assert.ok(nodes.some((node) => node.type === 'caption'), 'the table has an accessible caption')
  assert.deepEqual(table.children.filter((node) => node.type === 'colgroup').map((node) => node.props.span), [1, 3, 3])
  assert.ok(nodes.some((node) => node.type === 'th' && node.props.scope === 'col' && textContent(node) === 'Plugin'))
  assert.ok(nodes.some((node) => node.type === 'th' && node.props.scope === 'colgroup' && textContent(node) === 'English (en)'))
  assert.ok(nodes.some((node) => node.type === 'th' && node.props.scope === 'colgroup' && textContent(node) === 'Russian (ru)'))
  assert.ok(nodes.some((node) => node.type === 'th' && node.props.scope === 'row' && textContent(node) === 'builtin-plugin'))
  assert.ok(nodes.some((node) => node.type === 'th' && node.props.scope === 'row' && textContent(node) === '@community/locale-tools'))

  const renderedText = textContent(panel)
  const body = table.children.find((node) => node.type === 'tbody')
  const rowFor = (id) => body.children.find((row) => textContent(row.children[0]) === id)
  const builtInRow = rowFor('builtin-plugin')
  const importedRow = rowFor('@community/locale-tools')
  assert.deepEqual(builtInRow.children.slice(1, 4).map(textContent), ['2', '2', 'included'])
  assert.deepEqual(importedRow.children.slice(1).map(textContent), ['3', '0', 'included', '3', '1', 'included'])
  assert.doesNotMatch(renderedText, /\d+\s*%/)
})

test('community contribution guidance is bilingual and links to MCP setup and the manual contribution guide', async () => {
  const englishPanel = await renderCommunityPanel('en')
  const englishNodes = allElements(englishPanel)
  assert.ok(englishNodes.some((node) => node.type === 'a' && node.props.href.endsWith('/CONTRIBUTING.md#mcp-setup')))
  assert.ok(englishNodes.some((node) => node.type === 'a' && node.props.href.endsWith('/CONTRIBUTING.md')))
  assert.match(textContent(englishPanel), /MCP/)
  assert.match(textContent(englishPanel), /CLI|pull request/i)

  const russianPanel = await renderCommunityPanel('ru')
  const russianText = textContent(russianPanel)
  assert.match(russianText, /Переводы сообщества/)
  assert.match(russianText, /MCP/)
  assert.match(russianText, /запрос на внесение перевода/i)
})

test('Russian coverage panel translates user-facing metrics and contribution instructions', async () => {
  const panel = await renderCommunityPanel('ru')
  const nodes = allElements(panel)
  const renderedText = textContent(panel)
  assert.ok(nodes.some((node) => node.type === 'th' && textContent(node) === 'Ключи пространств имён'))
  assert.ok(nodes.some((node) => node.type === 'th' && textContent(node) === 'DOM-подстановки'))
  assert.ok(nodes.some((node) => node.type === 'p' && textContent(node) === 'Добавьте языковой пакет и отправьте запрос на внесение перевода.'))
  assert.ok(nodes.some((node) => node.type === 'p' && textContent(node) === 'Используйте сервер dsh-i18n-mcp в MCP-клиенте или подготовьте пакет в командной строке, затем отправьте запрос на внесение перевода.'))
  assert.ok(nodes.some((node) => node.type === 'a' && node.props.href.endsWith('/CONTRIBUTING.md#mcp-setup') && textContent(node) === 'Настройка MCP'))
  assert.ok(nodes.some((node) => node.type === 'a' && textContent(node) === 'Командная строка и инструкция по внесению перевода'))
  assert.doesNotMatch(renderedText, /\b(?:namespace|CLI|pull request|Help translate a plugin|MCP setup|manual contribution guide|Source map|DOM mappings|Namespace keys|No pack)\b/i)
})

test('coverage panel keeps the existing local-pack import and export controls', async () => {
  const panel = await renderCommunityPanel()
  const nodes = allElements(panel)
  assert.ok(nodes.some((node) => node.type === 'input' && node.props.type === 'file'))
  assert.ok(nodes.some((node) => node.type === 'button' && textContent(node) === 'Export'))
  assert.ok(nodes.some((node) => node.type === 'button' && textContent(node) === 'Remove'))
})

test('coverage marks source maps unavailable when sibling packs disagree on source strings', async () => {
  const panel = await renderCommunityPanel('en', { sourceConflict: true })
  const table = allElements(panel).find((node) => node.type === 'table')
  const body = table.children.find((node) => node.type === 'tbody')
  const row = body.children.find((item) => textContent(item.children[0]) === '@community/locale-tools')

  assert.deepEqual(row.children.slice(-3).map(textContent), ['3', '1', 'not included'])
})

test('coverage groups plugin IDs without regard to casing', async () => {
  const panel = await renderCommunityPanel('en', { caseVariant: true })
  const table = allElements(panel).find((node) => node.type === 'table')
  const body = table.children.find((node) => node.type === 'tbody')
  const pluginRows = body.children.filter((row) => textContent(row.children[0]).toLowerCase() === '@community/locale-tools')

  assert.equal(pluginRows.length, 1)
  assert.equal(textContent(pluginRows[0].children[0]), '@community/locale-tools')
})

test('saved local-pack coverage appears before the built-in pack request settles', async () => {
  const mounted = await mountCommunityPanel('en', { deferPacks: true })
  const panel = mounted.render()
  const table = allElements(panel).find((node) => node.type === 'table')
  const body = table.children.find((node) => node.type === 'tbody')
  const importedRow = body.children.find((row) => textContent(row.children[0]) === '@community/locale-tools')
  assert.deepEqual(importedRow.children.slice(-3).map(textContent), ['3', '1', 'included'])
})

test('coverage rerenders when the built-in pack request settles after the panel mounts', async () => {
  const mounted = await mountCommunityPanel('en', { deferPacks: true })
  mounted.render()
  mounted.flushEffects()
  mounted.resolvePacks()
  await new Promise((resolve) => setImmediate(resolve))
  assert.ok(mounted.renderUpdates > 0, 'the pack subscriber requests a render when built-in packs load')
  const panel = mounted.render()
  assert.ok(allElements(panel).some((node) => node.type === 'th' && node.props.scope === 'row' && textContent(node) === 'builtin-plugin'))
})
