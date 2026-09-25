import test from 'node:test'
import assert from 'node:assert/strict'
import { Config } from '../lib/index.js'

test('plugin preferences are exposed as volatile fields for DSH 0.1.7 settings forms', () => {
  for (const name of [
    'enabled', 'overrides', 'typography', 'agentPrompt', 'agentPromptPreset',
    'slashAliases', 'quickSwitch', 'translateEngine', 'localApiUrl'
  ]) {
    assert.equal(Config.dict[name].meta.volatile, true, `${name} must be editable through DSH settings`)
  }
})

import { readSettings } from '../lib/config.js'

test('live DSH config references are unwrapped into a settings snapshot', () => {
  const actual = readSettings({
    enabled: { get: () => false },
    overrides: { get: () => ({ Hello: 'Привет' }) },
    typography: { get: () => ({ enabled: true, yo: false, liveInput: true }) },
    translateEngine: { get: () => 'local' },
    localApiUrl: { get: () => 'http://127.0.0.1:5001' }
  })
  assert.equal(actual.enabled, false)
  assert.deepEqual(actual.overrides, { Hello: 'Привет' })
  assert.deepEqual(actual.typography, { enabled: true, yo: false, liveInput: true })
  assert.equal(actual.translateEngine, 'local')
  assert.equal(actual.localApiUrl, 'http://127.0.0.1:5001')
})

test('missing config references use stable plugin defaults', () => {
  assert.deepEqual(readSettings({}), {
    enabled: true,
    overrides: {},
    typography: { enabled: false, yo: true, liveInput: false },
    agentPrompt: false,
    agentPromptPreset: 'technical_expert',
    slashAliases: false,
    quickSwitch: true,
    translateEngine: 'off',
    localApiUrl: 'http://127.0.0.1:5000'
  })
})

import { apply } from '../lib/index.js'

test('host apply uses the DSH 0.1.7 settings configuration seam', () => {
  const configured = []
  const events = []
  const promptSections = []
  const context = {
    fiber: {},
    inject(services, callback) {
      if (services.length === 1 && services[0] === 'settings') {
        callback({
          effect(run) { run() },
          settings: { configure(options, owner) { configured.push({ options, owner }) } }
        })
      } else if (services.includes('systemPrompt')) {
        callback({}, { section(section) { promptSections.push(section) } })
      }
    },
    on(name, callback) { events.push({ name, callback }) }
  }
  apply(context, {
    agentPrompt: { get: () => true },
    agentPromptPreset: { get: () => 'technical_expert' }
  })
  assert.equal(configured.length, 1)
  assert.deepEqual(configured[0].options, { auto: false })
  assert.equal(configured[0].owner, context.fiber)
  assert.ok(promptSections.length > 0)
  assert.ok(events.some(event => event.name === 'settings/document-updated'))
})
