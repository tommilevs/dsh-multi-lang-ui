import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

const helperPath = fileURLToPath(new URL('../lib/dom-translation.js', import.meta.url))
const helperSource = readFileSync(helperPath, 'utf8')
const context = {}
vm.runInNewContext(`${helperSource}\nglobalThis.api = { resolveDomTranslation, resolveDomValue, translateSelectOptions, isSafeDomSelector }`, context)
const { resolveDomTranslation, resolveDomValue, translateSelectOptions, isSafeDomSelector } = context.api

const entries = [
  {
    selector: '[data-dsh-plugin="session-archive"]',
    source: '共 {n} 条会话',
    targets: { ru: 'Всего: {n} диалогов', en: '{n} sessions total' },
  },
  {
    selector: '[data-dsh-plugin="mcp-manager"]',
    source: '全部状态',
    targets: { ru: 'Все статусы', en: 'All statuses' },
  },
  {
    selector: 'p[role="alert"]',
    source: '{provider} ({id}): model "{model}" declares native image input, so its "{alias}" entry no longer applies. Select the same model from the provider group without "{alias}".',
    targets: {
      ru: '{provider} ({id}): модель «{model}» сообщает о поддержке изображений, поэтому вариант «{alias}» к ней неприменим. Выберите эту же модель в группе провайдера без варианта «{alias}».',
      en: '{provider} ({id}): model "{model}" declares native image input, so its "{alias}" entry no longer applies. Select the same model from the provider group without "{alias}".',
    },
  },
]

test('translates dynamic values and can switch between rendered languages', () => {
  const russian = resolveDomTranslation(entries[0].selector, '共 34 条会话', 'ru', entries)
  assert.equal(russian, 'Всего: 34 диалогов')
  assert.equal(resolveDomTranslation(entries[0].selector, russian, 'en', entries), '34 sessions total')
  assert.equal(resolveDomTranslation(entries[0].selector, '34 sessions total', 'ru-RU', entries), 'Всего: 34 диалогов')
})

test('translates exact entries and leaves unknown text unchanged', () => {
  assert.equal(resolveDomTranslation(entries[1].selector, '全部状态', 'en', entries), 'All statuses')
  assert.equal(resolveDomTranslation(entries[1].selector, 'Unknown label', 'ru', entries), 'Unknown label')
})

test('exact unknown dates take precedence over dynamic date templates', () => {
  const dates = [
    { selector: '.archive', source: '最后活动：{time}', targets: { ru: 'Последняя активность: {time}', en: 'Last activity: {time}' } },
    { selector: '.archive', source: '最后活动：未知', targets: { ru: 'Последняя активность: неизвестно', en: 'Last activity: unknown' } },
  ]
  assert.equal(resolveDomTranslation('.archive', '最后活动：未知', 'en', dates), 'Last activity: unknown')
  assert.equal(resolveDomTranslation('.archive', 'Last activity: unknown', 'ru', dates), 'Последняя активность: неизвестно')
  assert.equal(resolveDomTranslation('.archive', 'Последняя активность: неизвестно', 'zh', dates), '最后活动：未知')
})

test('archive status labels retain distinct meanings across language changes', () => {
  const packs = ['en', 'ru'].map((language) => JSON.parse(readFileSync(new URL(`../contributions/@linxin666/dsh-web-all/${language}.json`, import.meta.url), 'utf8')))
  const combined = new Map()
  for (const pack of packs) for (const item of pack.dom || []) {
    const key = `${item.selector}:${item.source}`
    if (!combined.has(key)) combined.set(key, { selector: item.selector, source: item.source, targets: {} })
    combined.get(key).targets[pack.locale] = item.target
  }
  const archiveEntries = [...combined.values()]
  const selector = '[data-dsh-plugin="session-archive"]'
  for (const source of ['普通', '未归档', '最后活动：未知', '归档时间：未知']) {
    const owner = {}
    const originals = new WeakMap()
    const english = resolveDomValue(owner, 'text', selector, source, 'en', archiveEntries, originals)
    const russian = resolveDomValue(owner, 'text', selector, english, 'ru', archiveEntries, originals)
    assert.equal(resolveDomValue(owner, 'text', selector, russian, 'zh', archiveEntries, originals), source)
    assert.doesNotMatch(english, /[\u4e00-\u9fff]/)
    assert.doesNotMatch(russian, /[\u4e00-\u9fff]/)
  }
})

test('translates a changing provider/model error while preserving identifiers', () => {
  const source = 'DeepSeek (models_vision): model "deepseek-v4-pro" declares native image input, so its "(models_vision)" entry no longer applies. Select the same model from the provider group without "(models_vision)".'
  const russian = 'DeepSeek (models_vision): модель «deepseek-v4-pro» сообщает о поддержке изображений, поэтому вариант «(models_vision)» к ней неприменим. Выберите эту же модель в группе провайдера без варианта «(models_vision)».'
  assert.equal(resolveDomTranslation(entries[2].selector, source, 'ru', entries), russian)
})

test('translates native select options without changing their values', () => {
  const options = [
    { textContent: '全部状态', value: 'all' },
    { textContent: 'All statuses', value: 'all' },
    { textContent: 'Custom option', value: 'custom' },
  ]

  assert.equal(translateSelectOptions(options, entries[1].selector, 'ru', entries), 2)
  assert.deepEqual(options.map((option) => [option.textContent, option.value]), [
    ['Все статусы', 'all'],
    ['Все статусы', 'all'],
    ['Custom option', 'custom'],
  ])
})

test('retains original labels across ambiguous translations and new renderer values', () => {
  const shared = [
    { selector: '.archive', source: 'First original', targets: { ru: 'Общий перевод', en: 'First' } },
    { selector: '.archive', source: 'Second original', targets: { ru: 'Общий перевод', en: 'Second' } },
  ]
  const owner = {}
  const originals = new WeakMap()
  assert.equal(resolveDomValue(owner, 'text', '.archive', 'Second original', 'ru', shared, originals), 'Общий перевод')
  assert.equal(resolveDomValue(owner, 'text', '.archive', 'Общий перевод', 'en', shared, originals), 'Second')
  assert.equal(resolveDomValue(owner, 'text', '.archive', 'First original', 'ru', shared, originals), 'Общий перевод')
  assert.equal(resolveDomValue(owner, 'text', '.archive', 'Общий перевод', 'zh', shared, originals), 'First original')
})

test('retains implicit native option values when translating their visible text', () => {
  const option = {
    textContent: '全部状态',
    get value() { return this.explicitValue ?? this.textContent },
    set value(value) { this.explicitValue = value },
  }
  translateSelectOptions([option], entries[1].selector, 'ru', entries)
  assert.equal(option.textContent, 'Все статусы')
  assert.equal(option.value, '全部状态')
})

test('allows only established plugin-root selectors', () => {
  assert.equal(isSafeDomSelector('[data-dsh-plugin="usage"]'), true)
  assert.equal(isSafeDomSelector('[data-conversation-tabs]'), true)
  assert.equal(isSafeDomSelector('[data-dsh-plugin="session-archive"] .title'), true)
  assert.equal(isSafeDomSelector('[data-dsh-pet-root]'), true)
  assert.equal(isSafeDomSelector('p[role="alert"]'), true)
  assert.equal(isSafeDomSelector('section[aria-labelledby="vision-title"]'), true)
  assert.equal(isSafeDomSelector('section[aria-labelledby="approve-title"]'), true)
  assert.equal(isSafeDomSelector('section[aria-labelledby="subagent-title"]'), true)
  assert.equal(isSafeDomSelector('section[aria-labelledby="title-title"]'), true)
  assert.equal(isSafeDomSelector('section[aria-labelledby="imagegen-title"]'), true)
  assert.equal(isSafeDomSelector('section[aria-labelledby="other-title"]'), false)
  assert.equal(isSafeDomSelector('[data-arbitrary="x"] .title'), false)
  assert.equal(isSafeDomSelector('.plugin-root body'), false)
})
