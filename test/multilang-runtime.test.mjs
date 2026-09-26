import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'

test('loaded packs translate root accessibility attributes and restore them on language changes', async () => {
  const pack = JSON.parse(readFileSync(new URL('../contributions/dsh-mcp-manager-ui/ru.json', import.meta.url), 'utf8'))
  const attributes = new Map([['title', 'MCP 管理面板（可拖拽移动）'], ['aria-label', '打开 MCP 管理面板']])
  const root = {
    matches: (selector) => selector === '.dsh-mcp-fab' || selector === '[title],[placeholder],[aria-label]',
    querySelectorAll: () => [],
    getAttribute: (name) => attributes.get(name),
    setAttribute: (name, value) => attributes.set(name, value),
  }
  let language = 'ru'
  let onLocale
  const context = {
    React: null,
    NodeFilter: { SHOW_TEXT: 4 },
    document: {
      querySelectorAll: (selector) => selector === '.dsh-mcp-fab' ? [root] : [],
      createTreeWalker: () => ({ nextNode: () => false }),
    },
    fetch: async () => ({ ok: true, json: async () => ({ packs: [pack] }) }),
    localStorage: { getItem: () => null },
    ctx: {
      effect: () => {},
      locale: {
        getSnapshot: () => ({ active: language }),
        register: () => () => {},
        subscribe: (listener) => { onLocale = listener; return () => {} },
      },
    },
  }
  const helper = readFileSync(new URL('../lib/dom-translation.js', import.meta.url), 'utf8')
  const client = readFileSync(new URL('../lib/multi-lang-client.js', import.meta.url), 'utf8')
  vm.runInNewContext(`${helper}\n${client}\napplyMultiLang(ctx)`, context)
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(attributes.get('aria-label'), 'Открыть панель управления MCP')
  assert.doesNotMatch(attributes.get('title'), /[\u4e00-\u9fff]/)
  language = 'zh'
  onLocale()
  assert.equal(attributes.get('aria-label'), '打开 MCP 管理面板')
  assert.equal(attributes.get('title'), 'MCP 管理面板（可拖拽移动）')
})
