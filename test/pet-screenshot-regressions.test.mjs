import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const contributions = fileURLToPath(new URL('../contributions/', import.meta.url))

function petPack(locale) {
  return JSON.parse(readFileSync(`${contributions}/@linxin666/dsh-pet/${locale}.json`, 'utf8'))
}

function assertScreenshotText(locale, source, expected) {
  const entry = petPack(locale).dom?.find((item) => item.selector === '[data-dsh-pet-root]' && item.source === source)
  assert.equal(entry?.target, expected, `${locale} translation for screenshot text ${JSON.stringify(source)}`)
}

const builtinChatter = JSON.parse(readFileSync(new URL('./fixtures/dsh-pet-builtin-chatter.json', import.meta.url), 'utf8'))

test('every built-in pet chatter line has complete English and Russian translations', () => {
  assert.equal(builtinChatter.uniquePoolStrings.length, 293)
  for (const locale of ['en', 'ru']) {
    const translations = new Map(petPack(locale).dom
      .filter((item) => item.selector === '[data-dsh-pet-root]')
      .map((item) => [item.source, item.target]))
    for (const { source, category } of builtinChatter.uniquePoolStrings) {
      const target = translations.get(source)
      assert.ok(target, `${locale} translation is missing for ${category}: ${JSON.stringify(source)}`)
      assert.doesNotMatch(target, /[\u3400-\u9fff]/, `${locale} translation still contains Chinese: ${JSON.stringify(source)}`)
      assert.deepEqual(
        [...target.matchAll(/\{[A-Za-z0-9_]+\}/g)].map(([value]) => value).sort(),
        [...source.matchAll(/\{[A-Za-z0-9_]+\}/g)].map(([value]) => value).sort(),
        `${locale} translation must preserve placeholders for ${JSON.stringify(source)}`,
      )
    }
  }
})

test('pet screenshot speech bubbles and mixed-language bond label are bilingual', () => {
  assertScreenshotText('en', '囤粮 +1，今天也有好好被爱！', 'Food stash +1 — I feel so loved today!')
  assertScreenshotText('ru', '囤粮 +1，今天也有好好被爱！', 'Запасы корма +1 — и сегодня меня любят!')
  assertScreenshotText('en', '咕噜咕噜～被摸摸好舒服！', 'Purr, purr~ It feels so good to be petted!')
  assertScreenshotText('ru', '咕噜咕噜～被摸摸好舒服！', 'Буль-буль~ Как приятно, когда меня гладят!')
  assertScreenshotText('en', '哎呀，踩到小石子了', 'Oops, I stepped on a little pebble.')
  assertScreenshotText('ru', '哎呀，踩到小石子了', 'Ой, наступила на камешек.')
  assertScreenshotText('en', '竖起耳朵等回复', 'Perks up her ears, waiting for a reply.')
  assertScreenshotText('ru', '竖起耳朵等回复', 'Навострила ушки и ждёт ответа.')
  assertScreenshotText('en', '这波活儿，我陪着', 'I’ll stay with you through this.')
  assertScreenshotText('ru', '这波活儿，我陪着', 'Я побуду рядом, пока ты с этим справляешься.')
  assertScreenshotText('en', 'Уровень привязанности: 伙伴', 'Affinity: Companion')
  assertScreenshotText('ru', 'Уровень привязанности: 伙伴', 'Уровень привязанности: Спутник')

  const ranks = [
    ['幼鲸', 'Baby Whale', 'Детёныш кита'],
    ['伙伴', 'Companion', 'Спутник'],
    ['挚友', 'Close Friend', 'Близкий друг'],
    ['深海羁绊', 'Deep Sea Bond', 'Связь глубин'],
    ['心有灵犀', 'Kindred Spirit', 'Родственная душа'],
    ['传说羁绊', 'Legendary Bond', 'Легендарная связь'],
    ['神话羁绊', 'Mythic Bond', 'Мифическая связь'],
    ['永恒之契', 'Eternal Covenant', 'Вечный союз'],
    ['鲸生共渡', 'Lifelong Companion', 'Спутник на всю жизнь'],
  ]
  for (const [sourceRank, enRank, ruRank] of ranks) {
    assertScreenshotText('en', `亲密度 ${sourceRank}`, `Affinity: ${enRank}`)
    assertScreenshotText('ru', `亲密度 ${sourceRank}`, `Уровень привязанности: ${ruRank}`)
  }
})
