import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'

const helperSource = readFileSync(new URL('../lib/dom-translation.js', import.meta.url), 'utf8')
const context = {}
vm.runInNewContext(`${helperSource}\nglobalThis.api = { resolveDomTranslation, isSafeDomSelector }`, context)
const { resolveDomTranslation, isSafeDomSelector } = context.api

const readPack = (plugin, language) => JSON.parse(readFileSync(
  new URL(`../contributions/${plugin}/${language}.json`, import.meta.url), 'utf8',
))

test('tab title selector stays scoped and translates the home quick actions', () => {
  const selector = '[data-dockkit-tab-title]'
  assert.equal(isSafeDomSelector(selector), true)

  const cases = [
    { plugin: 'dsh-server-deck', source: '服务器', en: 'Servers', ru: 'Серверы' },
    { plugin: '@wxg-prc-cpg/browser-skill-dsh-plugin', source: 'Browser Skill', en: 'Browser Skill', ru: 'Навык браузера' },
  ]
  for (const item of cases) {
    const entries = ['en', 'ru'].map((language) => readPack(item.plugin, language).dom)
      .flat()
      .filter((entry) => entry.selector === selector && entry.source === item.source)
      .map((entry) => ({ selector, source: item.source, targets: { [readPack(item.plugin, 'en').locale]: item.en, [readPack(item.plugin, 'ru').locale]: item.ru } }))
    assert.equal(entries.length, 2, `${item.plugin} needs a matching source in both locale packs`)
    assert.equal(resolveDomTranslation(selector, item.source, 'en', entries), item.en)
    assert.equal(resolveDomTranslation(selector, item.source, 'ru', entries), item.ru)
    assert.doesNotMatch(item.ru, /[\u3400-\u9fff]/)
  }
})
