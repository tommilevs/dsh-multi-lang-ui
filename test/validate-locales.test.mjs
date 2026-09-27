import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const validator = path.join(repoRoot, 'scripts', 'validate-locales.mjs')

function makePack(overrides = {}) {
  return {
    plugin: {
      id: 'example-plugin',
      version: '1.2.3',
      source: 'https://github.com/example/example-plugin',
      license: 'MIT',
    },
    locale: 'ru',
    sourceLocale: 'en',
    namespaces: {
      settings: {
        greeting: 'Привет, {name}!',
      },
    },
    ...overrides,
  }
}

function withContributions(t, callback) {
  const temp = mkdtempSync(path.join(os.tmpdir(), 'dsh-multi-lang-locales-'))
  const contributions = path.join(temp, 'contributions')
  mkdirSync(contributions)
  t.after(() => rmSync(temp, { recursive: true, force: true }))
  return callback(contributions)
}

function writePack(contributions, directoryId, filenameLocale, pack) {
  const dir = path.join(contributions, directoryId)
  mkdirSync(dir, { recursive: true })
  writeFileSync(path.join(dir, `${filenameLocale}.json`), `${JSON.stringify(pack, null, 2)}\n`)
}

function validate(contributions) {
  return spawnSync(process.execPath, [validator, contributions], { encoding: 'utf8' })
}

test('accepts a well-formed locale pack with source text and matching placeholders', (t) => {
  withContributions(t, (contributions) => {
    const pack = makePack({
      dom: [{
        selector: '.example-plugin-root .greeting',
        source: 'Hello, {name}!',
        target: 'Привет, {name}!',
      }],
      source: {
        settings: {
          greeting: 'Hello, {name}!',
        },
      },
    })
    writePack(contributions, 'example-plugin', 'ru', pack)

    const result = validate(contributions)
    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /1 locale pack/)
  })
})

test('reports a missing contributions directory without throwing a type error', () => {
  const missing = path.join(os.tmpdir(), `dsh-missing-contributions-${process.pid}-${Date.now()}`)
  const result = validate(missing)

  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /contributions directory does not exist/i)
  assert.doesNotMatch(result.stderr, /TypeError/i)
})

test('accepts a DOM-only pack with empty namespaces and a valid mapping', (t) => {
  withContributions(t, (contributions) => {
    writePack(contributions, 'example-plugin', 'ru', makePack({
      namespaces: {},
      dom: [{ selector: '.example-plugin-root .label', source: 'Settings', target: 'Настройки' }],
    }))

    const result = validate(contributions)
    assert.equal(result.status, 0, result.stderr)
  })
})

test('accepts stable DSH plugin roots and the pet root for scoped DOM mappings', (t) => {
  withContributions(t, (contributions) => {
    writePack(contributions, 'example-plugin', 'ru', makePack({
      namespaces: {},
      dom: [
        { selector: '[data-dsh-plugin="usage"]', source: '今日消费', target: 'Расход за сегодня' },
        { selector: 'section[data-plugin-panel]', source: 'Installed', target: 'Установленные' },
        { selector: '[data-conversation-tabs]', source: 'Trajectory', target: 'Ход выполнения' },
        { selector: '[data-dsh-plugin="session-archive"] .title', source: '会话归档管理', target: 'Управление архивом диалогов' },
        { selector: '[data-dsh-pet-root]', source: '喂食', target: 'Покормить' },
        { selector: 'section[aria-labelledby="vision-title"]', source: 'English error', target: 'Русская ошибка' },
        { selector: 'p[role="alert"]', source: 'Provider {id} failed', target: 'Сбой провайдера {id}' },
      ],
    }))

    const result = validate(contributions)
    assert.equal(result.status, 0, result.stderr)
  })
})

test('rejects empty namespaces when no DOM mapping is supplied', (t) => {
  withContributions(t, (contributions) => {
    writePack(contributions, 'example-plugin', 'ru', makePack({ namespaces: {} }))

    const result = validate(contributions)
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /namespaces must be a non-empty namespace object/i)
  })
})

test('accepts scoped plugin ids using matching scoped directories', (t) => {
  withContributions(t, (contributions) => {
    const pack = makePack({ plugin: { ...makePack().plugin, id: '@example/plugin' } })
    writePack(contributions, '@example/plugin', 'ru', pack)

    const result = validate(contributions)
    assert.equal(result.status, 0, result.stderr)
  })
})

test('rejects a plugin id that does not match its directory', (t) => {
  withContributions(t, (contributions) => {
    writePack(contributions, 'example-plugin', 'ru', makePack({
      plugin: { ...makePack().plugin, id: 'other-plugin' },
    }))

    const result = validate(contributions)
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /plugin\.id.*example-plugin/i)
  })
})

test('rejects a locale that does not match the file name', (t) => {
  withContributions(t, (contributions) => {
    writePack(contributions, 'example-plugin', 'ru', makePack({ locale: 'de' }))

    const result = validate(contributions)
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /locale.*file name/i)
  })
})

test('rejects empty translation strings', (t) => {
  withContributions(t, (contributions) => {
    writePack(contributions, 'example-plugin', 'ru', makePack({
      namespaces: { settings: { greeting: '   ' } },
    }))

    const result = validate(contributions)
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /non-empty string/i)
  })
})

test('requires the plugin source to be an HTTP or HTTPS URL', (t) => {
  withContributions(t, (contributions) => {
    writePack(contributions, 'example-plugin', 'ru', makePack({
      plugin: { ...makePack().plugin, source: 'local folder' },
    }))

    const result = validate(contributions)
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /plugin\.source.*http/i)
  })
})

test('rejects a locale pack larger than the per-file limit before parsing it', (t) => {
  withContributions(t, (contributions) => {
    const directory = path.join(contributions, 'example-plugin')
    mkdirSync(directory)
    writeFileSync(path.join(directory, 'ru.json'), Buffer.alloc(1024 * 1024 + 1))

    const result = validate(contributions)
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /pack exceeds 1048576 bytes/i)
    assert.doesNotMatch(result.stderr, /invalid json/i)
  })
})

test('rejects the catalog when aggregate locale JSON exceeds the read limit', (t) => {
  withContributions(t, (contributions) => {
    const oneMiB = Buffer.alloc(1024 * 1024, 32)
    for (let index = 0; index < 32; index += 1) {
      const directory = path.join(contributions, `plugin-${String(index).padStart(2, '0')}`)
      mkdirSync(directory)
      writeFileSync(path.join(directory, 'ru.json'), oneMiB)
    }
    const lastDirectory = path.join(contributions, 'plugin-over-limit')
    mkdirSync(lastDirectory)
    writeFileSync(path.join(lastDirectory, 'ru.json'), ' ')

    const result = validate(contributions)
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /contributions exceeds 33554432 bytes/i)
    assert.doesNotMatch(result.stderr, /invalid json/i)
  })
})

test('rejects more than 2000 locale packs without parsing the catalog', (t) => {
  withContributions(t, (contributions) => {
    const directory = path.join(contributions, 'example-plugin')
    mkdirSync(directory)
    for (let index = 0; index < 2001; index += 1) {
      writeFileSync(path.join(directory, `locale-${String(index).padStart(4, '0')}.json`), '')
    }

    const result = validate(contributions)
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /contributions exceeds 2000 locale packs/i)
    assert.doesNotMatch(result.stderr, /invalid json/i)
  })
})

test('rejects contribution directory nesting deeper than scoped plugin paths', (t) => {
  withContributions(t, (contributions) => {
    const directory = path.join(contributions, 'scope', 'plugin', 'nested')
    mkdirSync(directory, { recursive: true })
    writeFileSync(path.join(directory, 'ru.json'), '{}')

    const result = validate(contributions)
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /contributions directory nesting exceeds 2 levels/i)
  })
})

test('bounds non-JSON directory entries before retaining per-entry diagnostics', (t) => {
  withContributions(t, (contributions) => {
    const directory = path.join(contributions, 'example-plugin')
    mkdirSync(directory)
    for (let index = 0; index < 7001; index += 1) {
      writeFileSync(path.join(directory, `ignored-${String(index).padStart(4, '0')}.txt`), '')
    }

    const result = validate(contributions)
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /contributions exceeds 7000 directory entries/i)
    assert.match(result.stderr, /additional directory-entry diagnostics omitted/i)
    assert.equal((result.stderr.match(/only JSON locale packs are allowed under contributions/g) || []).length, 50)
  })
})

test('rejects unsafe prototype-related namespace and translation keys', (t) => {
  withContributions(t, (contributions) => {
    const pack = JSON.parse('{"plugin":{"id":"example-plugin","version":"1.2.3","source":"https://github.com/example/example-plugin","license":"MIT"},"locale":"ru","sourceLocale":"en","namespaces":{"safe":{"__proto__":"bad"}}}')
    writePack(contributions, 'example-plugin', 'ru', pack)

    const result = validate(contributions)
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /unsafe key/i)
  })
})

test('requires exact namespace and key parity when source text is supplied', (t) => {
  withContributions(t, (contributions) => {
    writePack(contributions, 'example-plugin', 'ru', makePack({
      source: { settings: { differentKey: 'Hello, {name}!' } },
    }))

    const result = validate(contributions)
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /source.*key parity/i)
  })
})

test('rejects translated text with different placeholder multiplicity', (t) => {
  withContributions(t, (contributions) => {
    writePack(contributions, 'example-plugin', 'ru', makePack({
      namespaces: { settings: { greeting: 'Привет!' } },
      source: { settings: { greeting: 'Hello, {name}!' } },
    }))

    const result = validate(contributions)
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /placeholder/i)
  })
})

test('rejects a DOM adapter entry with an empty selector, source, or target', (t) => {
  withContributions(t, (contributions) => {
    writePack(contributions, 'example-plugin', 'ru', makePack({
      dom: [{ selector: '  ', source: 'Hello', target: 'Привет' }],
    }))

    const result = validate(contributions)
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /dom.*selector.*non-empty string/i)
  })
})

test('rejects a DOM adapter target with different placeholders', (t) => {
  withContributions(t, (contributions) => {
    writePack(contributions, 'example-plugin', 'ru', makePack({
      dom: [{ selector: '.greeting', source: 'Hello, {name}!', target: 'Привет!' }],
    }))

    const result = validate(contributions)
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /dom.*placeholder/i)
  })
})

test('rejects a DOM selector that is not scoped to a plugin root', (t) => {
  withContributions(t, (contributions) => {
    writePack(contributions, 'example-plugin', 'ru', makePack({
      dom: [{ selector: 'body', source: 'Hello', target: 'Привет' }],
    }))

    const result = validate(contributions)
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /scoped.*selector/i)
  })
})

test('rejects duplicate namespace/key pairs across packs for the same locale', (t) => {
  withContributions(t, (contributions) => {
    writePack(contributions, 'plugin-one', 'ru', makePack({
      plugin: { ...makePack().plugin, id: 'plugin-one' },
    }))
    writePack(contributions, 'plugin-two', 'ru', makePack({
      plugin: { ...makePack().plugin, id: 'plugin-two' },
    }))

    const result = validate(contributions)
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /duplicate.*settings\.greeting/i)
  })
})

test('allows the same namespace/key pair in different locales', (t) => {
  withContributions(t, (contributions) => {
    writePack(contributions, 'example-plugin', 'ru', makePack())
    writePack(contributions, 'example-plugin', 'de', makePack({
      locale: 'de',
      namespaces: { settings: { greeting: 'Hallo, {name}!' } },
    }))

    const result = validate(contributions)
    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /2 locale packs/)
  })
})
