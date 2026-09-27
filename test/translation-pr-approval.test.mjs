import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import {
  approveTranslationPullRequest,
  resolveWorkflowRunPullRequest,
} from '../lib/translation-pr-approval.cjs'

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

function fixture({ changedFiles = [{ filename: localePath, status: 'modified' }], validationResult = 'success', currentAutoMerge = false, finalAutoMerge = false, contentError, postApprovalGetError, createReviewError, currentHeadSha = 'head-sha', currentBaseSha = 'base-sha', reviews = [previousApproval], headChangesAfterApproval, headChangesAfterFirstGet, baseRefChangesAfterFirstGet, baseRefChangesAfterApproval, currentBaseRef = 'main' } = {}) {
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
            base: { sha: currentBaseSha, ref: actualBaseRef },
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

function workflowRunResolverFixture({ associatedPulls, currentPull, workflowRun = {}, workflowPath = '.github/workflows/validate-locales.yml' } = {}) {
  const calls = { get: [], notices: [] }
  const run = {
    id: 55,
    workflow_id: 321,
    event: 'pull_request',
    name: 'Validate community locale packs',
    head_sha: 'head-sha',
    head_branch: 'contrib/german',
    head_repository: { full_name: 'contributor/locale-packs' },
    repository: { full_name: 'owner/repo' },
    ...workflowRun,
  }
  const defaultPull = {
    number: 12,
    state: 'open',
    draft: false,
    head: {
      sha: 'head-sha',
      ref: 'contrib/german',
      repo: { full_name: 'contributor/locale-packs', owner: { login: 'contributor' }, name: 'locale-packs' },
    },
    base: { sha: 'base-sha', ref: 'main' },
  }
  const github = {
    paginate: async (method, request) => (await method(request)).data,
    rest: {
      actions: {
        getWorkflow: async (request) => {
          calls.workflowRequest = request
          return { data: { path: workflowPath, state: 'active' } }
        },
      },
      pulls: {
        list: async (request) => {
          calls.listRequest = request
          return { data: associatedPulls ?? [defaultPull] }
        },
        get: async (request) => {
          calls.get.push(request)
          return { data: currentPull ?? defaultPull }
        },
      },
    },
  }
  const context = {
    repo: { owner: 'owner', repo: 'repo' },
    payload: { workflow_run: run },
  }
  const core = { notice: (message) => calls.notices.push(message) }
  return { calls, github, context, core, run: () => resolveWorkflowRunPullRequest({ github, context, core }) }
}

test('resolves a fork pull request only when the workflow run and live PR head match exactly', async () => {
  const testFixture = workflowRunResolverFixture()

  const resolved = await testFixture.run()

  assert.equal(testFixture.calls.listRequest.head, 'contributor:contrib/german')
  assert.equal(testFixture.calls.listRequest.state, 'open')
  assert.equal(testFixture.calls.workflowRequest.workflow_id, 321)
  assert.deepEqual(resolved, {
    number: 12,
    headSha: 'head-sha',
    headBranch: 'contrib/german',
    headRepository: { owner: 'contributor', name: 'locale-packs', fullName: 'contributor/locale-packs' },
    baseSha: 'base-sha',
    baseRef: 'main',
    draft: false,
  })
})

test('refuses a workflow run from a different workflow file with the same display name', async () => {
  const testFixture = workflowRunResolverFixture({ workflowPath: '.github/workflows/attacker.yml' })

  const resolved = await testFixture.run()

  assert.equal(resolved, null)
  assert.equal(testFixture.calls.listRequest, undefined)
  assert.match(testFixture.calls.notices.at(-1), /trusted locale-validation workflow file/i)
})

test('resolves pull_request workflow runs whose SHA is GitHub’s synthetic merge commit, then pins the actual PR head', async () => {
  const head = 'source-branch-head'
  const merge = 'synthetic-merge-commit'
  const testFixture = workflowRunResolverFixture({
    workflowRun: { head_sha: merge },
    associatedPulls: [{
      number: 12,
      head: { sha: head, ref: 'contrib/german', repo: { full_name: 'contributor/locale-packs' } },
      base: { ref: 'main' },
      merge_commit_sha: merge,
    }],
    currentPull: {
      number: 12,
      state: 'open',
      draft: false,
      head: { sha: head, ref: 'contrib/german', repo: { full_name: 'contributor/locale-packs', owner: { login: 'contributor' }, name: 'locale-packs' } },
      base: { sha: 'base-sha', ref: 'main' },
      merge_commit_sha: merge,
    },
  })

  const resolved = await testFixture.run()

  assert.equal(resolved.headSha, head)
  assert.equal(resolved.baseSha, 'base-sha')
})

test('resolves a PR retargeted away from main so the approval policy can withdraw its own review', async () => {
  const testFixture = workflowRunResolverFixture({
    associatedPulls: [{
      number: 12,
      head: { sha: 'head-sha', ref: 'contrib/german', repo: { full_name: 'contributor/locale-packs' } },
      base: { ref: 'release' },
    }],
    currentPull: {
      number: 12,
      state: 'open',
      draft: false,
      head: { sha: 'head-sha', ref: 'contrib/german', repo: { full_name: 'contributor/locale-packs', owner: { login: 'contributor' }, name: 'locale-packs' } },
      base: { sha: 'base-sha', ref: 'release' },
    },
  })

  const resolved = await testFixture.run()

  assert.equal(resolved.number, 12)
  assert.equal(resolved.baseRef, 'release')
})

test('refuses an ambiguous workflow run associated with multiple matching pull requests', async () => {
  const testFixture = workflowRunResolverFixture({ associatedPulls: [
    { number: 12, head: { sha: 'head-sha', ref: 'contrib/german', repo: { full_name: 'contributor/locale-packs' } }, base: { ref: 'main' } },
    { number: 13, head: { sha: 'head-sha', ref: 'contrib/german', repo: { full_name: 'contributor/locale-packs' } }, base: { ref: 'main' } },
  ] })

  const resolved = await testFixture.run()

  assert.equal(resolved, null)
  assert.equal(testFixture.calls.get.length, 0)
  assert.match(testFixture.calls.notices.at(-1), /ambiguous/i)
})

test('refuses missing fork metadata instead of falling back to workflow_run.pull_requests', async () => {
  const testFixture = workflowRunResolverFixture({
    workflowRun: { head_repository: null, pull_requests: [{ number: 12 }] },
  })

  const resolved = await testFixture.run()

  assert.equal(resolved, null)
  assert.equal(testFixture.calls.listRequest, undefined)
  assert.equal(testFixture.calls.get.length, 0)
})

test('refuses a stale workflow run head before checkout', async () => {
  const staleHead = workflowRunResolverFixture({
    currentPull: {
      number: 12,
      state: 'open',
      head: { sha: 'newer-sha', ref: 'contrib/german', repo: { full_name: 'contributor/locale-packs' } },
      base: { sha: 'base-sha', ref: 'main' },
    },
  })
  assert.equal(await staleHead.run(), null)
})

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

test('an obsolete review run cannot approve after the PR base commit changed', async (t) => {
  const testFixture = fixture({ currentBaseSha: 'newer-base-sha', reviews: [] })
  t.after(() => rmSync(testFixture.root, { recursive: true, force: true }))

  await testFixture.run()

  assert.equal(testFixture.calls.create.length, 0)
  assert.equal(testFixture.calls.dismiss.length, 0)
  assert.match(testFixture.calls.notices.at(-1), /changed after this run started/i)
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

test('the public pull-request validator is read-only and runs for every PR update', () => {
  const workflow = readFileSync(new URL('../.github/workflows/validate-locales.yml', import.meta.url), 'utf8')

  assert.match(workflow, /cancel-in-progress: true/)
  assert.match(workflow, /converted_to_draft/)
  assert.match(workflow, /auto_merge_enabled/)
  assert.match(workflow, /auto_merge_disabled/)
  assert.doesNotMatch(workflow, /paths:/)
  assert.match(workflow, /pull_request:/)
  assert.match(workflow, /contents: read/)
  assert.doesNotMatch(workflow, /pull_request_target|pull-requests: write|createReview|APPROVE/)
  assert.doesNotMatch(workflow, /allow-unsafe-pr-checkout: true/)
})

test('the privileged workflow revalidates JSON data from the associated PR head without executing PR code', () => {
  const workflow = readFileSync(new URL('../.github/workflows/approve-locales.yml', import.meta.url), 'utf8')
  const resolver = readFileSync(new URL('../lib/translation-pr-approval.cjs', import.meta.url), 'utf8')

  assert.match(workflow, /workflow_run:/)
  assert.match(workflow, /cancel-in-progress: false/)
  assert.match(resolver, /github\.rest\.pulls\.list/)
  assert.match(resolver, /head: `\$\{headRepository\.owner\}:\$\{run\.head_branch\}`/)
  assert.match(workflow, /sparse-checkout: contributions\/\*\*/)
  assert.match(workflow, /sparse-checkout-cone-mode: false/)
  assert.match(workflow, /fromJSON\(needs\.resolve\.outputs\.pull\)\.baseSha == steps\.trusted\.outputs\.sha/)
  assert.match(workflow, /group: locale-approval-pr-\$\{\{ .*fromJSON\(needs\.resolve\.outputs\.pull\)\.number/)
  assert.doesNotMatch(workflow, /ref: \$\{\{ fromJSON\(steps\.resolve\.outputs\.pull\)\.baseSha \}\}/)
  assert.doesNotMatch(workflow, /trusted-policy\/scripts.*checkout/i)
  assert.match(workflow, /node trusted-policy\/scripts\/validate-locales\.mjs candidate-data\/contributions/)
  assert.match(workflow, /steps\.validate\.outcome/)
  assert.match(workflow, /pull-requests: write/)
  assert.match(workflow, /actions: read/)
  assert.doesNotMatch(workflow, /workflow_run\.conclusion/)
  assert.doesNotMatch(workflow, /npm (?:install|ci|test)|node candidate-data\/|run: node candidate-data/)
  assert.doesNotMatch(workflow, /gh pr merge|mergePullRequest|enablePullRequestAutoMerge/)
})
