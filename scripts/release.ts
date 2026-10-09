import {
  planRelease,
  resolveTagCommit,
  type ReleaseSnapshot,
} from './release-plan.js'
import { outputLines, parseVersion } from './version.js'

interface JsonResponse {
  status: number
  body: unknown
}

const repository = Bun.env.GITHUB_REPOSITORY
const sha = Bun.env.GITHUB_SHA
const outputPath = Bun.env.GITHUB_OUTPUT
if (!repository || !sha || !outputPath)
  throw new Error(
    'GITHUB_REPOSITORY, GITHUB_SHA, and GITHUB_OUTPUT are required',
  )

const packageData: unknown = await Bun.file('package.json').json()
if (!isPackageData(packageData))
  throw new Error('package.json must contain a string version')
const metadata = parseVersion(packageData.version)
const headers: Record<string, string> = {
  accept: 'application/vnd.github+json',
}
if (Bun.env.GITHUB_TOKEN)
  headers.authorization = `Bearer ${Bun.env.GITHUB_TOKEN}`
const baseUrl = `https://api.github.com/repos/${repository}`
const release = await githubJson(
  `${baseUrl}/releases/tags/v${metadata.version}`,
  headers,
)
let plan: ReturnType<typeof planRelease>
let releaseSnapshot: ReleaseSnapshot | undefined

if (release.status === 404) {
  await verifyExistingTag(
    `${baseUrl}/git/ref/tags/v${metadata.version}`,
    baseUrl,
    headers,
    sha,
  )
  plan = planRelease(undefined, sha)
} else if (release.status === 200) {
  if (!isReleaseBody(release.body))
    throw new Error('GitHub release response was invalid')
  releaseSnapshot = release.body
  plan = planRelease(releaseSnapshot, sha)
  if (plan === 'resume-draft')
    await verifyExistingTag(
      `${baseUrl}/git/ref/tags/v${metadata.version}`,
      baseUrl,
      headers,
      sha,
    )
} else {
  throw new Error(`GitHub release lookup failed with HTTP ${release.status}`)
}

const lines = outputLines(metadata, plan !== 'skip-published', plan)
const prior = await Bun.file(outputPath)
  .text()
  .catch(() => '')
await Bun.write(
  outputPath,
  `${prior}${prior.length > 0 ? '\n' : ''}${lines.join('\n')}\n`,
)

async function verifyExistingTag(
  refUrl: string,
  baseUrl: string,
  requestHeaders: Record<string, string>,
  currentSha: string,
): Promise<void> {
  const ref = await githubJson(refUrl, requestHeaders)
  if (ref.status === 404) return
  if (ref.status !== 200 || !isTagRef(ref.body))
    throw new Error(`GitHub tag lookup failed with HTTP ${ref.status}`)
  const commitSha = await resolveTagCommit(async (tagSha) => {
    const response = await githubJson(
      `${baseUrl}/git/tags/${tagSha}`,
      requestHeaders,
    )
    if (response.status !== 200)
      throw new Error(
        `GitHub annotated tag lookup failed with HTTP ${response.status}`,
      )
    return response.body
  }, ref.body)
  if (commitSha !== currentSha)
    throw new Error('Existing version tag does not point to the current commit')
}

async function githubJson(
  url: string,
  requestHeaders: Record<string, string>,
): Promise<JsonResponse> {
  const response = await fetch(url, { headers: requestHeaders })
  let body: unknown
  try {
    body = await response.json()
  } catch {
    body = undefined
  }
  return { status: response.status, body }
}

function isPackageData(value: unknown): value is { version: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'version' in value &&
    typeof value.version === 'string'
  )
}

function isReleaseBody(value: unknown): value is ReleaseSnapshot {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    typeof value.id === 'number' &&
    'draft' in value &&
    typeof value.draft === 'boolean' &&
    'target_commitish' in value &&
    typeof value.target_commitish === 'string' &&
    'upload_url' in value &&
    typeof value.upload_url === 'string'
  )
}

function isTagRef(
  value: unknown,
): value is { object: { type: 'commit' | 'tag'; sha: string } } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'object' in value &&
    typeof value.object === 'object' &&
    value.object !== null &&
    'type' in value.object &&
    (value.object.type === 'commit' || value.object.type === 'tag') &&
    'sha' in value.object &&
    typeof value.object.sha === 'string'
  )
}
