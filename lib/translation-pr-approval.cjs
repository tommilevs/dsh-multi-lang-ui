'use strict'

const fs = require('node:fs')
const path = require('node:path')

const {
  evaluateTranslationPullRequest,
  parseLocalePackPath,
  MAX_CHANGED_FILES,
} = require('./translation-pr-policy.cjs')

const AUTOMATED_APPROVAL_PREFIX = 'Automatically approved: trusted validation passed'
const VALIDATION_WORKFLOW_NAME = 'Validate community locale packs'

function getFullRepositoryName(repository) {
  if (typeof repository?.full_name !== 'string') return null
  const parts = repository.full_name.split('/')
  if (parts.length !== 2 || parts.some((part) => !part)) return null
  return { fullName: repository.full_name, owner: parts[0], name: parts[1] }
}

async function resolveWorkflowRunPullRequest({ github, context, core } = {}) {
  const run = context?.payload?.workflow_run
  const repository = context?.repo
  const headRepository = getFullRepositoryName(run?.head_repository)
  const runRepository = getFullRepositoryName(run?.repository)
  if (
    !run || !repository?.owner || !repository?.repo ||
    run.event !== 'pull_request' || run.name !== VALIDATION_WORKFLOW_NAME ||
    !Number.isInteger(run.id) || !Number.isInteger(run.workflow_id) ||
    !run.head_sha || !run.head_branch || !headRepository ||
    runRepository?.fullName.toLowerCase() !== `${repository.owner}/${repository.repo}`.toLowerCase()
  ) {
    core?.notice('Automatic approval skipped: workflow run metadata is incomplete or does not identify the trusted locale validator.')
    return null
  }

  const workflow = (await github.rest.actions.getWorkflow({
    owner: repository.owner,
    repo: repository.repo,
    workflow_id: run.workflow_id,
  })).data
  if (workflow.path !== '.github/workflows/validate-locales.yml' || workflow.state !== 'active') {
    core?.notice('Automatic approval skipped: the run did not come from the active trusted locale-validation workflow file.')
    return null
  }

  const associated = await github.paginate(github.rest.pulls.list, {
    owner: repository.owner,
    repo: repository.repo,
    state: 'open',
    head: `${headRepository.owner}:${run.head_branch}`,
    per_page: 100,
  })
  const matches = associated.filter((pull) =>
    Number.isInteger(pull.number) &&
    pull.head?.ref === run.head_branch &&
    pull.head?.repo?.full_name?.toLowerCase() === headRepository.fullName.toLowerCase() &&
    (pull.head?.sha === run.head_sha || pull.merge_commit_sha === run.head_sha)
  )
  if (matches.length !== 1) {
    core?.notice(matches.length
      ? 'Automatic approval skipped: this workflow run is ambiguously associated with multiple matching pull requests.'
      : 'Automatic approval skipped: this workflow run has no associated pull request matching its exact head repository, branch, and commit.')
    return null
  }

  const associatedPull = matches[0]
  const current = (await github.rest.pulls.get({
    owner: repository.owner,
    repo: repository.repo,
    pull_number: associatedPull.number,
  })).data
  const currentHeadRepository = getFullRepositoryName(current.head?.repo)
  if (
    current.state !== 'open' ||
    current.head?.sha !== associatedPull.head?.sha ||
    current.head?.ref !== run.head_branch ||
    currentHeadRepository?.fullName.toLowerCase() !== headRepository.fullName.toLowerCase() ||
    (current.head?.sha !== run.head_sha && current.merge_commit_sha !== run.head_sha) ||
    !current.base?.sha
  ) {
    core?.notice('Automatic approval skipped: the associated pull request is closed, stale, retargeted, or no longer matches the exact workflow-run head.')
    return null
  }

  return {
    number: current.number,
    headSha: current.head.sha,
    headBranch: run.head_branch,
    headRepository,
    baseSha: current.base.sha,
    baseRef: current.base.ref,
    draft: Boolean(current.draft),
  }
}

function readTrustedPacks(directory) {
  if (!fs.existsSync(directory)) return []
  const packs = []
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name)
    if (entry.isDirectory()) packs.push(...readTrustedPacks(fullPath))
    else if (entry.isFile() && entry.name.endsWith('.json')) packs.push(JSON.parse(fs.readFileSync(fullPath, 'utf8')))
    else if (entry.isSymbolicLink()) throw new Error(`Trusted base contribution contains a symlink: ${fullPath}`)
  }
  return packs
}

async function approveTranslationPullRequest({
  github,
  context,
  core,
  validationResult,
  trustedPolicyDirectory = 'trusted-policy',
} = {}) {
  const { owner, repo } = context.repo
  const pullNumber = context.payload.pull_request.number
  const pull = context.payload.pull_request
  let botApprovals = []
  let createdReview
  let createReviewAttempted = false
  const dismissalAttempted = new Set()

  function skip(message) {
    core.notice(message)
  }

  async function dismissAutomationApproval(reviewId, message) {
    if (!Number.isInteger(reviewId)) throw new Error('Cannot dismiss the automated approval because GitHub did not return its review id.')
    if (dismissalAttempted.has(reviewId)) return
    dismissalAttempted.add(reviewId)
    await github.rest.pulls.dismissReview({
      owner,
      repo,
      pull_number: pullNumber,
      review_id: reviewId,
      message,
    })
  }

  async function dismissAutomationApprovals(reviews, message) {
    const approvals = reviews.filter((review) =>
      review.user?.login === 'github-actions[bot]' &&
      review.state === 'APPROVED' &&
      typeof review.body === 'string' &&
      review.body.startsWith(AUTOMATED_APPROVAL_PREFIX) &&
      !dismissalAttempted.has(review.id)
    )
    for (const review of approvals) await dismissAutomationApproval(review.id, message)
    if (approvals.length) core.notice(`Dismissed ${approvals.length} previous automated translation approval(s).`)
  }

  try {
    const reviews = await github.paginate(github.rest.pulls.listReviews, {
      owner,
      repo,
      pull_number: pullNumber,
      per_page: 100,
    })
    botApprovals = reviews.filter((review) =>
      review.user?.login === 'github-actions[bot]' && review.state === 'APPROVED'
    )

    const currentPull = await github.rest.pulls.get({ owner, repo, pull_number: pullNumber })
    if (currentPull.data.head.sha !== pull.head.sha || currentPull.data.base.sha !== pull.base.sha) {
      skip('Automatic approval skipped because the pull request changed after this run started.')
      return
    }
    if (validationResult !== 'success') {
      await dismissAutomationApprovals(botApprovals, 'Trusted translation validation did not pass for the current pull request revision.')
      skip('Automatic approval skipped because trusted locale validation did not succeed.')
      return
    }
    if (pull.base.ref !== 'main' || currentPull.data.base.ref !== 'main') {
      await dismissAutomationApprovals(botApprovals, 'The automated translation approval is withdrawn because this pull request no longer targets main.')
      skip('Automatic approval skipped: the current pull request target must be main.')
      return
    }
    if (currentPull.data.draft || currentPull.data.auto_merge) {
      await dismissAutomationApprovals(botApprovals, 'The automated translation approval is withdrawn because this pull request is a draft or has auto-merge enabled.')
      skip('Automatic approval skipped: only ready pull requests targeting main with GitHub auto-merge disabled are eligible.')
      return
    }

    const comparison = await github.rest.repos.compareCommitsWithBasehead({
      owner,
      repo,
      basehead: `${pull.base.sha}...${pull.head.sha}`,
      per_page: 100,
    })
    const changedFiles = comparison.data.files || []
    if (changedFiles.length > MAX_CHANGED_FILES) {
      await dismissAutomationApprovals(botApprovals, 'The automated translation approval is withdrawn because the pull request exceeds the translation-only file limit.')
      skip(`Automatic approval skipped: pull request changes more than ${MAX_CHANGED_FILES} files.`)
      return
    }

    const safePaths = changedFiles.every((file) =>
      parseLocalePackPath(file.filename) && (file.status === 'added' || file.status === 'modified')
    )
    if (!safePaths) {
      await dismissAutomationApprovals(botApprovals, 'The automated translation approval is withdrawn because this pull request changes files outside the translation-only policy.')
      skip('Automatic approval skipped: the pinned commit changes files outside the translation-only policy.')
      return
    }

    const basePacks = readTrustedPacks(path.join(trustedPolicyDirectory, 'contributions'))
    const headRepository = pull.head.repo
    if (!headRepository?.owner?.login || !headRepository.name) {
      await dismissAutomationApprovals(botApprovals, 'The automated translation approval is withdrawn because the pull request source repository is unavailable.')
      skip('Automatic approval skipped: the pull request source repository is unavailable.')
      return
    }

    const candidatePacks = {}
    for (const file of changedFiles) {
      const response = await github.rest.repos.getContent({
        owner: headRepository.owner.login,
        repo: headRepository.name,
        path: file.filename,
        ref: pull.head.sha,
      })
      const content = response.data
      if (Array.isArray(content) || content.type !== 'file' || content.encoding !== 'base64' || content.size > 1024 * 1024) {
        await dismissAutomationApprovals(botApprovals, 'The automated translation approval is withdrawn because a changed locale file could not be read as regular JSON data.')
        skip(`Automatic approval skipped: ${file.filename} is not a regular locale JSON file.`)
        return
      }
      candidatePacks[file.filename] = JSON.parse(Buffer.from(content.content, 'base64').toString('utf8'))
    }

    const policy = evaluateTranslationPullRequest({
      baseRef: pull.base.ref,
      isDraft: pull.draft,
      changedFiles,
      basePacks,
      candidatePacks,
    })
    if (!policy.eligible) {
      await dismissAutomationApprovals(botApprovals, `The automated translation approval is withdrawn because this pull request is no longer eligible: ${policy.reasons.join('; ')}.`)
      skip(`Automatic approval skipped: ${policy.reasons.join('; ')}.`)
      return
    }

    const finalPull = await github.rest.pulls.get({ owner, repo, pull_number: pullNumber })
    if (finalPull.data.head.sha !== pull.head.sha || finalPull.data.base.sha !== pull.base.sha || finalPull.data.draft) {
      skip('Automatic approval skipped because the pull request changed during review.')
      return
    }
    if (finalPull.data.base.ref !== 'main') {
      await dismissAutomationApprovals(botApprovals, 'The automated translation approval is withdrawn because this pull request no longer targets main.')
      skip('Automatic approval skipped: the current pull request target changed away from main during review.')
      return
    }
    if (finalPull.data.auto_merge) {
      await dismissAutomationApprovals(botApprovals, 'The automated translation approval is withdrawn because GitHub auto-merge was enabled during review.')
      skip('Automatic approval skipped because GitHub auto-merge was enabled during this review.')
      return
    }
    if (botApprovals.some((review) => review.commit_id === pull.head.sha)) {
      core.notice('This exact head commit already has an approval from github-actions[bot].')
      return
    }

    createReviewAttempted = true
    createdReview = await github.rest.pulls.createReview({
      owner,
      repo,
      pull_number: pullNumber,
      commit_id: pull.head.sha,
      event: 'APPROVE',
      body: `${AUTOMATED_APPROVAL_PREFIX} and every changed pack only translates source strings and DOM mappings already cataloged for an existing plugin. This approval does not merge the pull request.`,
    })

    const postApprovalPull = await github.rest.pulls.get({ owner, repo, pull_number: pullNumber })
    if (postApprovalPull.data.head.sha !== pull.head.sha || postApprovalPull.data.base.sha !== pull.base.sha || postApprovalPull.data.draft || postApprovalPull.data.auto_merge) {
      await dismissAutomationApproval(createdReview.data?.id, 'The automated translation approval was withdrawn because the pull request changed during the final review check.')
      skip('A review was submitted for the validated commit, but the pull request changed during the final check. Configure GitHub branch protection to dismiss stale approvals when new commits are pushed.')
      return
    }
    if (postApprovalPull.data.base.ref !== 'main') {
      await dismissAutomationApproval(createdReview.data?.id, 'The automated translation approval was withdrawn because the pull request no longer targets main.')
      skip('A review was submitted for the validated commit, but the pull request target changed from main during the final check. Configure GitHub branch protection to dismiss stale approvals when new commits are pushed.')
    }
  } catch (error) {
    const dismissalErrors = []
    if (createReviewAttempted && !createdReview) {
      try {
        const latestReviews = await github.paginate(github.rest.pulls.listReviews, {
          owner,
          repo,
          pull_number: pullNumber,
          per_page: 100,
        })
        const acceptedReviews = latestReviews.filter((review) => review.commit_id === pull.head.sha)
        await dismissAutomationApprovals(acceptedReviews, 'The automated translation approval is withdrawn because GitHub may have accepted a review request whose response was lost.')
      } catch (dismissError) {
        dismissalErrors.push(`ambiguous new approval: ${dismissError.message}`)
      }
    }
    if (createdReview) {
      try {
        await dismissAutomationApproval(createdReview.data?.id, 'The automated translation approval is withdrawn because the final review check could not complete safely.')
      } catch (dismissError) {
        dismissalErrors.push(`new approval: ${dismissError.message}`)
      }
    }
    try {
      await dismissAutomationApprovals(botApprovals, 'The automated translation approval is withdrawn because the current review could not complete safely.')
    } catch (dismissError) {
      dismissalErrors.push(`previous approval: ${dismissError.message}`)
    }
    if (dismissalErrors.length) {
      core.setFailed(`Automatic translation review failed closed: ${error.message}; revoking ${dismissalErrors.join(' and ')} also failed.`)
      return
    }
    core.setFailed(`Automatic translation review failed closed: ${error.message}`)
  }
}

module.exports = { approveTranslationPullRequest, resolveWorkflowRunPullRequest }
