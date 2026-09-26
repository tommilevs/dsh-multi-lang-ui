import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

const helperPath = fileURLToPath(new URL('../lib/dom-translation.js', import.meta.url))
const context = {}
vm.runInNewContext(`${readFileSync(helperPath, 'utf8')}\nglobalThis.resolve = resolveDomTranslation`, context)

const liveCopy = [
  {
    source: '免密限额；可添加 API Key 提升额度',
    en: 'Free quota without an API key; add one to increase the quota',
    ru: 'Бесплатный лимит без API-ключа; добавьте ключ, чтобы увеличить квоту',
  },
  {
    source: '免密限额（Search / Extract）；可切换免费账号 API Key',
    en: 'Free quota (Search / Extract); switch to a free-account API key',
    ru: 'Бесплатный лимит (поиск / извлечение); можно использовать API-ключ бесплатного аккаунта',
  },
  {
    source: '免密限额（Search / Scrape / Parse）；可添加 API Key',
    en: 'Free quota (Search / Scrape / Parse); add an API key',
    ru: 'Бесплатный лимит (поиск / загрузка страниц / разбор); можно добавить API-ключ',
  },
  {
    source: '浏览器调试、网络检查与性能分析',
    en: 'Browser debugging, network inspection, and performance analysis',
    ru: 'Отладка браузера, проверка сети и анализ производительности',
  },
  {
    source: '本地 npx；需要 Node.js 与 Chrome',
    en: 'Local npx; requires Node.js and Chrome',
    ru: 'Локальный запуск через npx; требуются Node.js и Chrome',
  },
  {
    source: '本地 npx；需要 Node.js 20+',
    en: 'Local npx; requires Node.js 20+',
    ru: 'Локальный запуск через npx; требуется Node.js 20 или новее',
  },
]

const packs = Object.fromEntries(['en', 'ru'].map((locale) => [
  locale,
  JSON.parse(readFileSync(new URL(`../contributions/dsh-mcp-manager-ui/${locale}.json`, import.meta.url), 'utf8')),
]))

const entries = []
for (const locale of ['en', 'ru']) {
  for (const item of packs[locale].dom) {
    const key = `${item.selector}\n${item.source}`
    let entry = entries.find((candidate) => candidate.key === key)
    if (!entry) {
      entry = { key, selector: item.selector, source: item.source, targets: {} }
      entries.push(entry)
    }
    entry.targets[locale] = item.target
  }
}

test('translates the exact live MCP catalog copy in English and Russian for both panel roots', () => {
  for (const selector of ['.dsh-mcp-panel-overlay', '.dsh-mcp-overlay']) {
    for (const item of liveCopy) {
      for (const locale of ['en', 'ru']) {
        const translated = context.resolve(selector, item.source, locale, entries)
        assert.equal(translated, item[locale], `${selector}: ${item.source} (${locale})`)
        assert.doesNotMatch(translated, /[\u4e00-\u9fff]/, `${selector}: leftover Chinese for ${locale}`)
      }
    }
  }
})
