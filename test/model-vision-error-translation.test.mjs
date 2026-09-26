import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'

const helperSource = readFileSync(new URL('../lib/dom-translation.js', import.meta.url), 'utf8')
const context = {}
vm.runInNewContext(`${helperSource}\nglobalThis.api = { resolveDomTranslation }`, context)
const { resolveDomTranslation } = context.api
const languages = ['en', 'ru'].map((locale) => JSON.parse(readFileSync(
  new URL(`../contributions/dsh-plugin-desktop/${locale}.json`, import.meta.url), 'utf8',
)))
const selector = 'p[role="alert"]'

test('translates the mixed-language vision fallback while retaining the model id', () => {
  const source = 'DeepSeek (models vision) не загрузился: model "deepseek-v4-pro" declares native image input, so its "(models vision)" entry no longer applies. Select the same model from the provider group without "(models vision)".'
  const targets = {
    en: 'DeepSeek (models vision) failed to load: model "deepseek-v4-pro" accepts images natively, so its "(models vision)" entry no longer applies. Select the same model from the provider group without the "(models vision)" entry.',
    ru: 'Не удалось запустить DeepSeek (models vision): модель «deepseek-v4-pro» принимает изображения напрямую, поэтому вариант «(models vision)» для неё неприменим. Выберите ту же модель в группе провайдера без записи «(models vision)».',
  }
  const combined = new Map()
  for (const pack of languages) for (const entry of pack.dom || []) {
    if (entry.selector !== selector) continue
    const current = combined.get(entry.source) || { selector, source: entry.source, targets: {} }
    current.targets[pack.locale] = entry.target
    combined.set(entry.source, current)
  }
  const entries = [...combined.values()].filter((entry) => entry.source.includes('{alias}') && entry.source.includes('model "{model}"'))

  assert.equal(entries.length, 1, 'both locale packs must cover the changing provider/model error')
  assert.equal(resolveDomTranslation(selector, source, 'ru', entries), targets.ru)
  assert.equal(resolveDomTranslation(selector, source, 'en', entries), targets.en)
  assert.match(targets.ru, /deepseek-v4-pro/)
  assert.doesNotMatch(targets.ru, /\b(?:model|declares|native|input|Select|provider group)\b/i)
})
