import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { approveTranslationPullRequest } from '../lib/translation-pr-approval.cjs'

const sourcePack = {
  plugin: { id: 'example-plugin', version: '1.0.0', source: 'https://github.com/example/plugin', license: 'MIT' },
  locale: 'en',
  sourceLocale: 'en',
  namespaces: { plugin: { greeting: 'Hello' } },
  dom: [],
}
const germanPack = {
  plugin: sourcePack.plugin,
  locale: 'de',
  sourceLocale: 'en',
  namespaces: { plugin: { greeting: 'Hallo' } },
  source: sourcePack.namespaces,
  dom: [],
}
const localePath = 'contributions/example-plugin/de.json'
const previousApproval = { id: 7, commit_id: 'old-head', state: 'APPROVED', body: 'Automatically approved: trusted validation passed and every changed pack only translates source strings and DOM mappings already cataloged for an existing plugin.', user: { login: 'github-actions[bot]' } }

function fixture({ changedFiles = [{ filename: localePath, status: 'modified' }], validationResult = 'success', currentAutoMerge = false, finalAutoMerge = false, contentError, postApprovalGetError, createReviewError, currentHeadSha = 'head-sha', reviews = [previousApproval], headChangesAfterApproval, headChangesAfterFirstGet, baseRefChangesAfterFirstGet, baseRefChangesAfterApproval, currentBaseRef = 'main' } = {}) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'translation-approval-'))
  const contributions = path.join(root, 'contributions', 'example-plugin')
  mkdirSync(contributions, { recursive: true })
  writeFileSync(path.join(contributions, 'en.json'), JSON.stringify(sourcePack))
  let getPullCount = 0
  let actualCurrentHeadSha = currentHeadSha
  let actualBaseRef = currentBaseRef
  const calls = { dismiss: [], create: [], failed: [], notices: [] }
  const github = {
    paginate: async (method, args) => method(args),
    rest: {
      pulls: {
        listReviews: async () => reviews,
        get: async () => {
          getPullCount += 1
          if (getPullCount === 3 && postApprovalGetError) throw postApprovalGetError
          const result = { data: {
            head: { sha: actualCurrentHeadSha },
            base: { sha: 'base-sha', ref: actualBaseRef },
            draft: false,
            auto_merge: getPullCount === 1 ? currentAutoMerge : finalAutoMerge,
          } }
          if (getPullCount === 1 && headChangesAfterFirstGet) actualCurrentHeadSha = headChangesAfterFirstGet
          if (getPullCount === 1 && baseRefChangesAfterFirstGet) actualBaseRef = baseRefChangesAfterFirstGet
          return result
        },
        dismissReview: async (request) => calls.dismiss.push(request),
          createReview: async (request) => {
            calls.create.push(request)
            if (headChangesAfterApproval) actualCurrentHeadSha = headChangesAfterApproval
            if (baseRefChangesAfterApproval) actualBaseRef = baseRefChangesAfterApproval
            if (createReviewError) {
              reviews.push({ id: 99, commit_id: request.commit_id, state: 'APPROVED', body: request.body, user: { login: 'github-actions[bot]' } })
              throw createReviewError
            }
            return { data: { id: 99 } }
        },
      },
      repos: {
        compareCommitsWithBasehead: async () => ({ data: { files: changedFiles } }),
        getContent: async () => {
          if (contentError) throw contentError
          return { data: { type: 'file', encoding: 'base64', size: Buffer.byteLength(JSON.stringify(germanPack)), content: Buffer.from(JSON.stringify(germanPack)).toString('base64') } }
        },
      },
    },
  }
  const context = {
    repo: { owner: 'owner', repo: 'repo' },
    payload: { pull_request: {
      number: 12,
      head: { sha: 'head-sha', repo: { owner: { login: 'contributor' }, name: 'repo' } },
      base: { sha: 'base-sha', ref: 'main' },
      draft: false,
    } },
  }
  const core = {
    notice: (message) => calls.notices.push(message),
    setFailed: (message) => calls.failed.push(message),
  }
  return {
    root,
    calls,
    run: () => approveTranslationPullRequest({ github, context, core, validationResult, trustedPolicyDirectory: root }),
  }
}

test('approves only the validated event head commit when the current PR remains eligible', async (t) => {
  const testFixture = fixture()
  t.after(() => rmSync(testFixture.root, { recursive: true, force: true }))

  await testFixture.run()

  assert.equal(testFixture.calls.create.length, 1)
  assert.equal(testFixture.calls.create[0].commit_id, 'head-sha')
  assert.equal(testFixture.calls.create[0].event, 'APPROVE')
  assert.equal(testFixture.calls.dismiss.length, 0)
  assert.deepEqual(testFixture.calls.failed, [])
})

test('withdraws its previous approval after validation fails without dismissing a human review', async (t) => {
  const humanApproval = { id: 11, commit_id: 'head-sha', state: 'APPROVED', body: 'Human review', user: { login: 'maintainer' } }
  const testFixture = fixture({ validationResult: 'failure', reviews: [previousApproval, humanApproval] })
  t.after(() => rmSync(testFixture.root, { recursive: true, force: true }))

  await testFixture.run()

  assert.deepEqual(testFixture.calls.dismiss.map(({ review_id }) => review_id), [7])
  assert.equal(testFixture.calls.create.length, 0)
})

test('does not approve when the changed-file cap is exceeded', async (t) => {
  const testFixture = fixture({
    changedFiles: Array.from({ length: 51 }, (_, index) => ({ filename: `contributions/example-plugin/de-${index}.json`, status: 'added' })),
  })
  t.after(() => rmSync(testFixture.root, { recursive: true, force: true }))

  await testFixture.run()

  assert.deepEqual(testFixture.calls.dismiss.map(({ review_id }) => review_id), [7])
  assert.equal(testFixture.calls.create.length, 0)
})

test('does not approve if candidate content cannot be fetched', async (t) => {
  const testFixture = fixture({ contentError: new Error('API unavailable') })
  t.after(() => rmSync(testFixture.root, { recursive: true, force: true }))

  await testFixture.run()

  assert.deepEqual(testFixture.calls.dismiss.map(({ review_id }) => review_id), [7])
  assert.equal(testFixture.calls.create.length, 0)
  assert.match(testFixture.calls.failed[0], /API unavailable/)
})

test('does not approve if the current target branch changes after initial validation', async (t) => {
  const testFixture = fixture({ reviews: [], baseRefChangesAfterFirstGet: 'release' })
  t.after(() => rmSync(testFixture.root, { recursive: true, force: true }))

  await testFixture.run()

  assert.equal(testFixture.calls.create.length, 0)
  assert.equal(testFixture.calls.dismiss.length, 0)
  assert.match(testFixture.calls.notices.at(-1), /target changed away from main/i)
})

test('does not approve a pull request already retargeted from main at the same base SHA', async (t) => {
  const currentApproval = { ...previousApproval, commit_id: 'head-sha' }
  const testFixture = fixture({ reviews: [currentApproval], currentBaseRef: 'release' })
  t.after(() => rmSync(testFixture.root, { recursive: true, force: true }))

  await testFixture.run()

  assert.equal(testFixture.calls.create.length, 0)
  assert.deepEqual(testFixture.calls.dismiss.map(({ review_id }) => review_id), [7])
  assert.match(testFixture.calls.notices.at(-1), /target must be main/i)
})

test('dismisses its new approval if the pull request is retargeted immediately after review creation', async (t) => {
  const testFixture = fixture({ reviews: [], baseRefChangesAfterApproval: 'release' })
  t.after(() => rmSync(testFixture.root, { recursive: true, force: true }))

  await testFixture.run()

  assert.equal(testFixture.calls.create.length, 1)
  assert.deepEqual(testFixture.calls.dismiss.map(({ review_id }) => review_id), [99])
  assert.match(testFixture.calls.notices.at(-1), /target changed from main/i)
})

test('dismisses its new approval if the final GitHub state check fails', async (t) => {
  const testFixture = fixture({ reviews: [], postApprovalGetError: new Error('GitHub API unavailable') })
  t.after(() => rmSync(testFixture.root, { recursive: true, force: true }))

  await testFixture.run()

  assert.equal(testFixture.calls.create.length, 1)
  assert.deepEqual(testFixture.calls.dismiss.map(({ review_id }) => review_id), [99])
  assert.match(testFixture.calls.failed[0], /GitHub API unavailable/)
})

test('finds and dismisses an approval accepted by GitHub when the create-review request times out', async (t) => {
  const testFixture = fixture({ reviews: [], createReviewError: new Error('request timed out') })
  t.after(() => rmSync(testFixture.root, { recursive: true, force: true }))

  await testFixture.run()

  assert.deepEqual(testFixture.calls.dismiss.map(({ review_id }) => review_id), [99])
  assert.match(testFixture.calls.failed[0], /request timed out/)
})

test('does not approve when GitHub auto-merge becomes enabled during review', async (t) => {
  const testFixture = fixture({ finalAutoMerge: { enabled: true } })
  t.after(() => rmSync(testFixture.root, { recursive: true, force: true }))

  await testFixture.run()

  assert.deepEqual(testFixture.calls.dismiss.map(({ review_id }) => review_id), [7])
  assert.equal(testFixture.calls.create.length, 0)
})

test('an obsolete run never creates or dismisses an approval for another pull request head', async (t) => {
  const currentApproval = { id: 8, commit_id: 'newer-head', state: 'APPROVED', user: { login: 'github-actions[bot]' } }
  const testFixture = fixture({ currentHeadSha: 'newer-head', reviews: [previousApproval, currentApproval] })
  t.after(() => rmSync(testFixture.root, { recursive: true, force: true }))

  await testFixture.run()

  assert.equal(testFixture.calls.dismiss.length, 0)
  assert.equal(testFixture.calls.create.length, 0)
})

test('an obsolete validation failure cannot dismiss the newer head approval', async (t) => {
  const currentApproval = { id: 8, commit_id: 'newer-head', state: 'APPROVED', body: previousApproval.body, user: { login: 'github-actions[bot]' } }
  const testFixture = fixture({ validationResult: 'failure', currentHeadSha: 'newer-head', reviews: [previousApproval, currentApproval] })
  t.after(() => rmSync(testFixture.root, { recursive: true, force: true }))

  await testFixture.run()

  assert.equal(testFixture.calls.dismiss.length, 0)
  assert.equal(testFixture.calls.create.length, 0)
})

test('does not dismiss an existing review if the pull request changes before early return', async (t) => {
  const currentApproval = { id: 10, commit_id: 'head-sha', state: 'APPROVED', user: { login: 'github-actions[bot]' } }
  const testFixture = fixture({ reviews: [currentApproval], headChangesAfterFirstGet: 'pushed-before-early-return' })
  t.after(() => rmSync(testFixture.root, { recursive: true, force: true }))

  await testFixture.run()

  assert.equal(testFixture.calls.dismiss.length, 0)
  assert.equal(testFixture.calls.create.length, 0)
})

test('keeps any new approval pinned to the reviewed SHA if the pull request head changes immediately after review creation', async (t) => {
  const testFixture = fixture({ reviews: [], headChangesAfterApproval: 'pushed-during-review' })
  t.after(() => rmSync(testFixture.root, { recursive: true, force: true }))

  await testFixture.run()

  assert.equal(testFixture.calls.create.length, 1)
  assert.equal(testFixture.calls.create[0].commit_id, 'head-sha')
  assert.deepEqual(testFixture.calls.dismiss.map(({ review_id }) => review_id), [99])
  assert.match(testFixture.calls.notices.at(-1), /branch protection/i)
})

test('workflow runs on every pull request update and cancels obsolete runs', () => {
  const workflow = readFileSync(new URL('../.github/workflows/validate-locales.yml', import.meta.url), 'utf8')

  assert.match(workflow, /cancel-in-progress: true/)
  assert.match(workflow, /converted_to_draft/)
  assert.doesNotMatch(workflow, /paths:/)
  assert.match(workflow, /if: always\(\)/)
})
