import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { evaluateTranslationPullRequest } from '../lib/translation-pr-policy.cjs'

const pack = (filename, status = 'modified') => ({ filename, status })
const sourcePack = {
  plugin: { id: '@example/dsh-plugin', version: '1.0.0', source: 'https://github.com/example/dsh-plugin', license: 'MIT' },
  locale: 'en',
  sourceLocale: 'en',
  namespaces: { plugin: { greeting: 'Hello' } },
  dom: [{ selector: '.dsh-example-plugin', source: 'Apply', target: 'Apply' }],
}
const germanPack = {
  plugin: sourcePack.plugin,
  locale: 'de',
  sourceLocale: 'en',
  namespaces: { plugin: { greeting: 'Hallo' } },
  source: sourcePack.namespaces,
  dom: [{ selector: '.dsh-example-plugin', source: 'Apply', target: 'Anwenden' }],
}
const targetPath = 'contributions/@example/dsh-plugin/de.json'
const approvedContext = {
  baseRef: 'main',
  isDraft: false,
  changedFiles: [pack(targetPath, 'added')],
  basePacks: [sourcePack],
  candidatePacks: { [targetPath]: germanPack },
}

test('approves a target-language pack for a known plugin and trusted source strings', () => {
  const result = evaluateTranslationPullRequest(approvedContext)

  assert.deepEqual(result, { eligible: true, reasons: [] })
})

test('requires human review for source catalogs and newly introduced plugins', () => {
  const sourcePath = 'contributions/@example/dsh-plugin/en.json'
  const newPluginPath = 'contributions/@newcomer/new-plugin/de.json'
  const sourceCatalog = { ...sourcePack, source: sourcePack.namespaces }
  const newPlugin = {
    ...germanPack,
    plugin: { ...germanPack.plugin, id: '@newcomer/new-plugin' },
  }

  assert.equal(evaluateTranslationPullRequest({
    ...approvedContext,
    changedFiles: [pack(sourcePath, 'added')],
    candidatePacks: { [sourcePath]: sourceCatalog },
  }).eligible, false)
  assert.equal(evaluateTranslationPullRequest({
    ...approvedContext,
    changedFiles: [pack(newPluginPath, 'added')],
    candidatePacks: { [newPluginPath]: newPlugin },
  }).eligible, false)
})

test('requires human review for source-string edits, new keys, plugin metadata changes, or new DOM selectors', () => {
  const candidates = [
    { ...germanPack, source: { plugin: { greeting: 'Hi' } } },
    { ...germanPack, namespaces: { plugin: { greeting: 'Hallo', extra: 'Zusatz' } }, source: { plugin: { greeting: 'Hello', extra: 'Extra' } } },
    { ...germanPack, plugin: { ...germanPack.plugin, version: '2.0.0' } },
    { ...germanPack, dom: [...germanPack.dom, { selector: 'section[data-plugin-panel]', source: 'Danger', target: 'Gefahr' }] },
    { ...germanPack, dom: [] },
    { ...germanPack, dom: [...germanPack.dom, ...germanPack.dom] },
  ]

  for (const candidate of candidates) {
    assert.equal(evaluateTranslationPullRequest({
      ...approvedContext,
      candidatePacks: { [targetPath]: candidate },
    }).eligible, false)
  }
})

test('rejects plugin code, docs, workflow, and unrelated changes', () => {
  for (const changedFile of [
    pack('lib/index.js'),
    pack('README.md'),
    pack('.github/workflows/validate-locales.yml'),
    pack('contributions/dsh-plugin/fr.json/../../../../lib/evil.js'),
  ]) {
    const result = evaluateTranslationPullRequest({
      baseRef: 'main',
      isDraft: false,
      changedFiles: [pack('contributions/dsh-plugin/de.json', 'added'), changedFile],
    })
    assert.equal(result.eligible, false, changedFile.filename)
  }
})

test('rejects delete, rename, copy, and unsupported statuses', () => {
  for (const status of ['removed', 'renamed', 'copied', 'changed']) {
    const result = evaluateTranslationPullRequest({
      baseRef: 'main',
      isDraft: false,
      changedFiles: [pack('contributions/dsh-plugin/de.json', status)],
    })
    assert.equal(result.eligible, false, status)
  }
})

test('rejects drafts, non-main targets, empty changes, and excessive change sets', () => {
  const ordinary = [pack('contributions/dsh-plugin/de.json', 'added')]
  assert.equal(evaluateTranslationPullRequest({ baseRef: 'develop', isDraft: false, changedFiles: ordinary }).eligible, false)
  assert.equal(evaluateTranslationPullRequest({ baseRef: 'main', isDraft: true, changedFiles: ordinary }).eligible, false)
  assert.equal(evaluateTranslationPullRequest({ baseRef: 'main', isDraft: false, changedFiles: [] }).eligible, false)
  assert.equal(evaluateTranslationPullRequest({
    baseRef: 'main', isDraft: false, changedFiles: Array.from({ length: 51 }, (_, i) => pack(`contributions/dsh-plugin/lang-${i}.json`, 'added')),
  }).eligible, false)
})

test('rejects malformed locale pack paths and duplicate paths', () => {
  for (const changedFiles of [
    [pack('contributions/dsh-plugin/../ru.json', 'added')],
    [pack('contributions/dsh-plugin/../../lib/x.json', 'added')],
    [pack('contributions/dsh-plugin/fr.txt', 'added')],
    [pack('contributions/dsh-plugin/de.json', 'added'), pack('contributions/dsh-plugin/de.json', 'modified')],
  ]) {
    assert.equal(evaluateTranslationPullRequest({ baseRef: 'main', isDraft: false, changedFiles }).eligible, false)
  }
})

test('GitHub workflow validates fork files as data before narrowly approving translation-only PRs', () => {
  const workflow = readFileSync(new URL('../.github/workflows/validate-locales.yml', import.meta.url), 'utf8')
  const approval = readFileSync(new URL('../lib/translation-pr-approval.cjs', import.meta.url), 'utf8')
  const candidateCheckout = workflow.split('name: Check out contribution data only')[1]?.split('name: Validate all submitted locale packs')[0]
  const validationJob = workflow.split('jobs:')[1]?.split('  approve-translation-only:')[0]
  const approvalJob = workflow.split('  approve-translation-only:')[1]

  assert.match(workflow, /pull_request_target:/)
  assert.equal((workflow.match(/uses: actions\/checkout@v4\.4\.0/g) || []).length, 3)
  assert.match(candidateCheckout, /allow-unsafe-pr-checkout: true/)
  assert.match(candidateCheckout, /ref: \$\{\{ github\.event\.pull_request\.head\.sha \}\}/)
  assert.match(candidateCheckout, /sparse-checkout: contributions/)
  assert.match(candidateCheckout, /persist-credentials: false/)
  assert.match(validationJob, /ref: \$\{\{ github\.event\.pull_request\.base\.sha \}\}/)
  assert.match(validationJob, /run: node trusted-validator\/scripts\/validate-locales\.mjs candidate-data\/contributions/)
  assert.doesNotMatch(validationJob, /node candidate-data\/|npm (?:install|run)|pnpm (?:install|run)/)
  assert.match(approvalJob, /needs: validate/)
  assert.match(approvalJob, /if: always\(\)/)
  assert.match(approvalJob, /require\('\.\/trusted-policy\/lib\/translation-pr-approval\.cjs'\)/)
  assert.match(approvalJob, /pull-requests: write/)
  assert.match(approval, /compareCommitsWithBasehead/)
  assert.match(approval, /currentPull\.data\.head\.sha !== pull\.head\.sha/)
  assert.match(approval, /finalPull\.data\.base\.sha !== pull\.base\.sha/)
  assert.match(approval, /postApprovalPull\.data\.head\.sha !== pull\.head\.sha/)
  assert.match(approval, /repos\.getContent/)
  assert.match(approval, /basePacks/)
  assert.match(approval, /commit_id: pull\.head\.sha/)
  assert.match(approval, /pulls\.dismissReview/)
  assert.match(approval, /review\.user\?\.login === 'github-actions\[bot\]'/)
  assert.match(approval, /review\.body\.startsWith\(AUTOMATED_APPROVAL_PREFIX\)/)
  assert.doesNotMatch(approval, /pulls\.listFiles/)
  assert.doesNotMatch(approval, /contents: write|mergePullRequest|pulls\.merge/)
  assert.match(approval, /event: 'APPROVE'/)
})
