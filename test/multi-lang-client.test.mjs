import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'

const clientSource = readFileSync(new URL('../lib/multi-lang-client.js', import.meta.url), 'utf8')

test('fetches current built-in locale packs without reusing a stale browser cache entry', () => {
  const calls = []
  const context = {
    ctx: {
      locale: {
        getSnapshot: () => ({ active: 'en' }),
        subscribe: () => () => {},
      },
      effect: () => {},
    },
    fetch: (...args) => {
      calls.push(args)
      return Promise.resolve({ ok: true, json: async () => ({ packs: [] }) })
    },
    localStorage: { getItem: () => null, setItem: () => {} },
    React: null,
  }

  vm.runInNewContext(`${clientSource}\napplyMultiLang(ctx)`, context)

  assert.equal(calls.length, 1)
  assert.equal(calls[0][0], '/api/dsh-multi-lang-ui/packs')
  assert.equal(calls[0][1].cache, 'no-store')
  assert.equal(calls[0][1].headers.Accept, 'application/json')
})
