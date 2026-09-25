import test from 'node:test'
import assert from 'node:assert/strict'
import { getContributionDictionariesByNames } from '../lib/locales.js'

const pack = (pluginId, namespaces, locale = 'ru') => ({
  plugin: { id: pluginId },
  locale,
  namespaces,
})

test('selects Russian contribution packs by scoped or unscoped plugin id', () => {
  const packs = [
    pack('@linxin666/dsh-web-all', { 'dsh-web-ui-usage': { title: 'Использование' } }),
    pack('another-plugin', { 'another-ui': { title: 'Другой' } }),
    pack('english-only', { 'english-ui': { title: 'English' } }, 'en'),
  ]

  assert.deepEqual(
    getContributionDictionariesByNames(packs, ['dsh-web-all']),
    { 'dsh-web-ui-usage': { title: 'Использование' } },
  )
  assert.deepEqual(
    getContributionDictionariesByNames(packs, []),
    {
      'dsh-web-ui-usage': { title: 'Использование' },
      'another-ui': { title: 'Другой' },
    },
  )
})
