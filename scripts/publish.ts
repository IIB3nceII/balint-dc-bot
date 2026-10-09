import { readdir, stat } from 'node:fs/promises'
import {
  planRelease,
  resolveTagCommit,
  type ReleaseSnapshot,
} from './release-plan.js'
import { parseVersion } from './version.js'
import { requestOptions, type RequestBody } from './github.js'

interface AssetInfo {
  name: string
  size: number
  path: string
}
interface ApiResponse {
  status: number
  body: unknown
}
interface ReleaseBody extends ReleaseSnapshot {
  assets: unknown
}

export interface PublishConfig {
  repository: string
  token: string
  sha: string
  version: string
  assetsDirectory: string
}

export type HttpFetch = (url: string, options: RequestInit) => Promise<Response>
type ApiRequest = (
  url: string,
  headers: Record<string, string>,
  method?: string,
  body?: RequestBody,
) => Promise<ApiResponse>

export async function publishRelease(
  config: PublishConfig,
  http: HttpFetch,
): Promise<'published' | 'skipped'> {
  const { repository, token, sha, version, assetsDirectory } = config
  const request: ApiRequest = (url, headers, method = 'GET', body) =>
    apiRequest(http, url, headers, method, body)
  const metadata = parseVersion(version)

  const expected = await collectAssets(assetsDirectory, version)
  const headers: Record<string, string> = {
    accept: 'application/vnd.github+json',
    authorization: `Bearer ${token}`,
  }
  const baseUrl = `https://api.github.com/repos/${repository}`
  const tag = `v${version}`
  const found = await request(`${baseUrl}/releases/tags/${tag}`, headers)
  let release: ReleaseBody

  if (found.status === 200) {
    if (!isReleaseBody(found.body))
      throw new Error('Existing GitHub release response was invalid')
    release = found.body
    const plan = planRelease(release, sha)
    if (plan === 'skip-published') {
      console.log(`Release ${tag} is already published; leaving it unchanged`)
      return 'skipped'
    }
  } else if (found.status === 404) {
    const created = await request(`${baseUrl}/releases`, headers, 'POST', {
      tag_name: tag,
      target_commitish: sha,
      name: tag,
      draft: true,
      prerelease: metadata.prerelease,
      generate_release_notes: true,
      make_latest: metadata.prerelease ? 'false' : 'legacy',
    })
    if (created.status === 201 && isReleaseBody(created.body)) {
      release = created.body
    } else if (created.status === 422) {
      const raced = await request(`${baseUrl}/releases/tags/${tag}`, headers)
      if (raced.status !== 200 || !isReleaseBody(raced.body))
        throw new Error(
          'Release appeared during publication but could not be inspected',
        )
      release = raced.body
      if (planRelease(release, sha) === 'skip-published') {
        console.log(
          `Release ${tag} was published concurrently; leaving it unchanged`,
        )
        return 'skipped'
      }
    } else {
      throw new Error(
        `GitHub draft release creation failed with HTTP ${created.status}`,
      )
    }
  } else {
    throw new Error(`GitHub release lookup failed with HTTP ${found.status}`)
  }

  await ensureTag(baseUrl, tag, sha, headers, request)

  const uploadUrl = release.upload_url.replace(/\{\?name,label\}$/, '')
  const existingAssets = assetList(release.assets)
  for (const asset of expected) {
    await assertDraft(baseUrl, release.id, sha, headers, request)
    const existing = existingAssets.find(
      (candidate) => candidate.name === asset.name,
    )
    if (existing !== undefined) {
      const deleted = await request(
        `${baseUrl}/releases/assets/${existing.id}`,
        headers,
        'DELETE',
      )
      if (deleted.status !== 204)
        throw new Error(`Could not replace draft asset ${asset.name}`)
    }
    const uploaded = await request(
      `${uploadUrl}?name=${encodeURIComponent(asset.name)}`,
      {
        ...headers,
        'content-type': 'application/octet-stream',
      },
      'POST',
      { binary: await Bun.file(asset.path).arrayBuffer() },
    )
    if (uploaded.status !== 201)
      throw new Error(`Could not upload ${asset.name}: HTTP ${uploaded.status}`)
  }

  const refreshed = await request(`${baseUrl}/releases/${release.id}`, headers)
  if (refreshed.status !== 200 || !isReleaseBody(refreshed.body))
    throw new Error('Could not verify draft assets')
  if (planRelease(refreshed.body, sha) !== 'resume-draft')
    throw new Error('Release changed before publication')
  assertAssets(refreshed.body.assets, expected)
  await ensureTag(baseUrl, tag, sha, headers, request)
  const published = await request(
    `${baseUrl}/releases/${release.id}`,
    headers,
    'PATCH',
    {
      draft: false,
      prerelease: metadata.prerelease,
      make_latest: metadata.prerelease ? 'false' : 'legacy',
    },
  )
  if (published.status !== 200)
    throw new Error(`Could not publish draft release: HTTP ${published.status}`)
  console.log(`Published ${tag}`)

  return 'published'
}

async function collectAssets(
  directory: string,
  releaseVersion: string,
): Promise<AssetInfo[]> {
  const names = (await readdir(directory))
    .filter(
      (name) =>
        name.endsWith('.tar.gz') ||
        name.endsWith('.zip') ||
        name === 'SHA256SUMS',
    )
    .sort()
  const expectedNames = [
    ...[
      'linux-x64',
      'linux-arm64',
      'linux-x64-musl',
      'linux-arm64-musl',
      'macos-x64',
      'macos-arm64',
    ].map((target) => `balint-dc-bot-v${releaseVersion}-${target}.tar.gz`),
    ...['windows-x64', 'windows-arm64'].map(
      (target) => `balint-dc-bot-v${releaseVersion}-${target}.zip`,
    ),
    'SHA256SUMS',
  ].sort()
  if (
    names.length !== expectedNames.length ||
    names.some((name, index) => name !== expectedNames[index])
  )
    throw new Error(
      'Release assets do not contain exactly the expected nine files',
    )
  return Promise.all(
    names.map(async (name) => ({
      name,
      size: (await stat(`${directory}/${name}`)).size,
      path: `${directory}/${name}`,
    })),
  )
}

async function apiRequest(
  http: HttpFetch,
  url: string,
  requestHeaders: Record<string, string>,
  method = 'GET',
  body?: RequestBody,
): Promise<ApiResponse> {
  const options = requestOptions(method, requestHeaders, body)
  const response = await http(url, options)
  let responseBody: unknown
  try {
    responseBody = await response.json()
  } catch {
    responseBody = undefined
  }
  return { status: response.status, body: responseBody }
}

async function ensureTag(
  baseUrl: string,
  tag: string,
  currentSha: string,
  requestHeaders: Record<string, string>,
  request: ApiRequest,
): Promise<void> {
  const refUrl = `${baseUrl}/git/ref/tags/${tag}`
  const ref = await request(refUrl, requestHeaders)
  if (ref.status === 404) {
    const created = await request(
      `${baseUrl}/git/refs`,
      requestHeaders,
      'POST',
      {
        ref: `refs/tags/${tag}`,
        sha: currentSha,
      },
    )
    if (created.status !== 201 && created.status !== 422)
      throw new Error(`Could not create release tag: HTTP ${created.status}`)
  } else if (ref.status !== 200) {
    throw new Error(`GitHub tag lookup failed with HTTP ${ref.status}`)
  }
  const verified = await request(refUrl, requestHeaders)
  if (verified.status !== 200 || !isTagRef(verified.body))
    throw new Error(`Could not verify release tag: HTTP ${verified.status}`)
  const commit = await resolveTagCommit(async (tagSha) => {
    const response = await request(
      `${baseUrl}/git/tags/${tagSha}`,
      requestHeaders,
    )
    if (response.status !== 200)
      throw new Error(
        `GitHub annotated tag lookup failed with HTTP ${response.status}`,
      )
    return response.body
  }, verified.body)
  if (commit !== currentSha)
    throw new Error('Release tag does not point to the current commit')
}

async function assertDraft(
  baseUrl: string,
  releaseId: number,
  currentSha: string,
  requestHeaders: Record<string, string>,
  request: ApiRequest,
): Promise<void> {
  const response = await request(
    `${baseUrl}/releases/${releaseId}`,
    requestHeaders,
  )
  if (
    response.status !== 200 ||
    !isReleaseBody(response.body) ||
    planRelease(response.body, currentSha) !== 'resume-draft'
  ) {
    throw new Error('Release is no longer a matching draft')
  }
}

function isReleaseBody(value: unknown): value is ReleaseBody {
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
    typeof value.upload_url === 'string' &&
    'assets' in value
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

function assetList(
  value: unknown,
): Array<{ id: number; name: string; size: number }> {
  if (!Array.isArray(value))
    throw new Error('GitHub release assets response was invalid')
  return value.filter(isAsset)
}

function isAsset(
  value: unknown,
): value is { id: number; name: string; size: number } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    typeof value.id === 'number' &&
    'name' in value &&
    typeof value.name === 'string' &&
    'size' in value &&
    typeof value.size === 'number'
  )
}

function assertAssets(value: unknown, expected: readonly AssetInfo[]): void {
  const actual = assetList(value)
  if (
    actual.length !== expected.length ||
    expected.some(
      (asset) =>
        !actual.some(
          (candidate) =>
            candidate.name === asset.name && candidate.size === asset.size,
        ),
    )
  ) {
    throw new Error(
      'Published draft assets did not match the expected names and sizes',
    )
  }
}

if (import.meta.main) {
  const repository = Bun.env.GITHUB_REPOSITORY
  const token = Bun.env.GITHUB_TOKEN
  const sha = Bun.env.GITHUB_SHA
  const version = Bun.env.RELEASE_VERSION
  const assetsDirectory = Bun.env.RELEASE_ASSETS ?? 'release-assets'
  if (!repository || !token || !sha || !version)
    throw new Error(
      'GITHUB_REPOSITORY, GITHUB_TOKEN, GITHUB_SHA, and RELEASE_VERSION are required',
    )
  await publishRelease(
    { repository, token, sha, version, assetsDirectory },
    (url, options) => fetch(url, options),
  )
}
