import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const releaseWorkflow = readFileSync(new URL('../.github/workflows/release.yml', import.meta.url), 'utf8')

test('serializes release jobs by package version so different versions cannot replace each other', () => {
  assert.match(releaseWorkflow, /group:\s*release-\$\{\{\s*needs\.prepare\.outputs\.version\s*\}\}/)
  assert.doesNotMatch(releaseWorkflow, /group:\s*release-\$\{\{\s*github\.ref\s*\}\}/)
})

test('uploads the package archive on rerun when the GitHub Release exists without the asset', () => {
  assert.match(releaseWorkflow, /gh release view "\$tag" --json assets --jq '\.assets\[\]\.name'/)
  assert.match(releaseWorkflow, /gh release upload "\$tag" "\$tarball" --clobber/)
})
