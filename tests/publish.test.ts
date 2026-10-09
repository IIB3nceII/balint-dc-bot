import { describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  publishRelease,
  type HttpFetch,
  type PublishConfig,
} from '../scripts/publish.js'

const archiveNames = [
  'balint-dc-bot-v1.2.3-linux-x64.tar.gz',
  'balint-dc-bot-v1.2.3-linux-arm64.tar.gz',
  'balint-dc-bot-v1.2.3-linux-x64-musl.tar.gz',
  'balint-dc-bot-v1.2.3-linux-arm64-musl.tar.gz',
  'balint-dc-bot-v1.2.3-macos-x64.tar.gz',
  'balint-dc-bot-v1.2.3-macos-arm64.tar.gz',
  'balint-dc-bot-v1.2.3-windows-x64.zip',
  'balint-dc-bot-v1.2.3-windows-arm64.zip',
  'SHA256SUMS',
]
const assetContent = 'fixture asset'
const commit = 'current-commit'

interface Asset {
  id: number
  name: string
  size: number
}
interface Release {
  id: number
  draft: boolean
  target_commitish: string
  upload_url: string
  assets: Asset[]
}
interface Call {
  method: string
  path: string
  body: unknown
}
interface TagObject {
  type: 'tag' | 'commit'
  sha: string
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function objectBody(options: RequestInit): Record<string, unknown> {
  expect(new Headers(options.headers).get('content-type')).toBe(
    'application/json',
  )
  if (typeof options.body !== 'string')
    throw new Error('Expected a serialized JSON request')
  const value: unknown = JSON.parse(options.body)
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new Error('Expected a JSON object')
  return value as Record<string, unknown>
}

class GitHubFixture {
  release: Release | undefined
  tag: TagObject | undefined
  readonly annotations = new Map<string, TagObject>()
  readonly calls: Call[] = []
  readonly publications: string[][] = []
  failUploadName: string | undefined
  changeBeforeRead: ((release: Release) => void) | undefined
  changeAtRead = 1
  private releaseReads = 0
  private nextAssetId = 100

  constructor(readonly version = '1.2.3') {}

  draft(assets: Asset[] = []): Release {
    this.release = {
      id: 7,
      draft: true,
      target_commitish: commit,
      upload_url:
        'https://uploads.github.com/repos/example/bot/releases/7/assets{?name,label}',
      assets,
    }
    return this.release
  }

  get mutations(): Call[] {
    return this.calls.filter((call) => call.method !== 'GET')
  }

  readonly fetch: HttpFetch = async (url, options) => {
    const parsed = new URL(url)
    const path = parsed.pathname
    const method = options.method ?? 'GET'
    const body =
      options.body === undefined || options.body instanceof ArrayBuffer
        ? undefined
        : objectBody(options)
    this.calls.push({ method, path, body })
    expect(new Headers(options.headers).get('accept')).toBe(
      'application/vnd.github+json',
    )
    expect(new Headers(options.headers).has('authorization')).toBe(true)

    if (
      parsed.hostname === 'uploads.github.com' &&
      path === '/repos/example/bot/releases/7/assets' &&
      method === 'POST'
    ) {
      expect(new Headers(options.headers).get('content-type')).toBe(
        'application/octet-stream',
      )
      if (!(options.body instanceof ArrayBuffer))
        throw new Error('Expected binary ArrayBuffer upload')
      expect(new TextDecoder().decode(options.body)).toBe(assetContent)
      const name = parsed.searchParams.get('name')
      if (name === null || this.release === undefined)
        throw new Error('Upload missing name or release')
      if (!this.release.draft)
        throw new Error('Attempted to upload to a published release')
      if (name === this.failUploadName)
        return json({ message: 'Transient upload failure' }, 503)
      if (this.release.assets.some((asset) => asset.name === name))
        return json({ message: 'Asset already exists' }, 422)
      const asset = {
        id: this.nextAssetId++,
        name,
        size: options.body.byteLength,
      }
      this.release.assets.push(asset)
      return json(asset, 201)
    }
    if (parsed.hostname !== 'api.github.com')
      throw new Error('Unexpected HTTP host')
    if (
      path === `/repos/example/bot/releases/tags/v${this.version}` &&
      method === 'GET'
    ) {
      return this.release === undefined
        ? json({ message: 'Not found' }, 404)
        : json(this.release)
    }
    if (path === '/repos/example/bot/releases' && method === 'POST') {
      expect(body).toMatchObject({
        tag_name: `v${this.version}`,
        target_commitish: commit,
        name: `v${this.version}`,
        draft: true,
        generate_release_notes: true,
      })
      if (this.release !== undefined)
        return json({ message: 'Already exists' }, 422)
      return json(this.draft(), 201)
    }
    if (
      path === `/repos/example/bot/git/ref/tags/v${this.version}` &&
      method === 'GET'
    ) {
      return this.tag === undefined
        ? json({ message: 'Not found' }, 404)
        : json({ ref: `refs/tags/v${this.version}`, object: this.tag })
    }
    if (path === '/repos/example/bot/git/refs' && method === 'POST') {
      expect(body).toEqual({ ref: `refs/tags/v${this.version}`, sha: commit })
      if (this.tag !== undefined)
        throw new Error('Attempted to move an existing tag')
      this.tag = { type: 'commit', sha: commit }
      return json({ object: this.tag }, 201)
    }
    if (path.startsWith('/repos/example/bot/git/tags/') && method === 'GET') {
      const sha = path.slice('/repos/example/bot/git/tags/'.length)
      const object = this.annotations.get(sha)
      if (object === undefined) return json({ message: 'Not found' }, 404)
      // GitHub's annotated-tag resource wraps its target in `object`.
      return json({ sha, tag: `v${this.version}`, object })
    }
    if (path === '/repos/example/bot/releases/7' && method === 'GET') {
      if (this.release === undefined) return json({ message: 'Not found' }, 404)
      this.releaseReads += 1
      if (this.releaseReads === this.changeAtRead) {
        const change = this.changeBeforeRead
        this.changeBeforeRead = undefined
        change?.(this.release)
      }
      return json(this.release)
    }
    if (
      path.startsWith('/repos/example/bot/releases/assets/') &&
      method === 'DELETE'
    ) {
      if (this.release === undefined || !this.release.draft)
        throw new Error('Attempted to mutate published assets')
      const id = Number(
        path.slice('/repos/example/bot/releases/assets/'.length),
      )
      const index = this.release.assets.findIndex((asset) => asset.id === id)
      if (index === -1) return json({ message: 'Not found' }, 404)
      this.release.assets.splice(index, 1)
      return new Response(null, { status: 204 })
    }
    if (path === '/repos/example/bot/releases/7' && method === 'PATCH') {
      if (this.release === undefined || !this.release.draft)
        throw new Error('Attempted to patch a published release')
      expect(body?.draft).toBe(false)
      this.publications.push(
        this.release.assets.map((asset) => asset.name).sort(),
      )
      this.release.draft = false
      return json(this.release)
    }
    throw new Error(`Unexpected fixture request: ${method} ${path}`)
  }
}

async function withAssets(
  run: (config: PublishConfig, names: string[]) => Promise<void>,
  version = '1.2.3',
): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), 'bot-publisher-test-'))
  const names = archiveNames.map((name) => name.replace('1.2.3', version))
  try {
    await Promise.all(
      names.map((name) => Bun.write(join(directory, name), assetContent)),
    )
    await run(
      {
        repository: 'example/bot',
        token: 'fixture-token',
        sha: commit,
        version,
        assetsDirectory: directory,
      },
      names,
    )
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

describe('GitHub release publisher', () => {
  test('creates a draft and verifies all eight archives plus checksums before publishing', async () => {
    await withAssets(async (config, names) => {
      const github = new GitHubFixture()
      expect(await publishRelease(config, github.fetch)).toBe('published')
      expect(github.publications).toEqual([[...names].sort()])
      expect(github.release?.assets.map((asset) => asset.size)).toEqual(
        Array(9).fill(13),
      )
      const creates = github.calls.filter(
        (call) =>
          call.method === 'POST' && call.path === '/repos/example/bot/releases',
      )
      expect(creates).toHaveLength(1)
      expect(creates[0]?.body).toMatchObject({
        draft: true,
        prerelease: false,
        make_latest: 'legacy',
      })
      const patchIndex = github.calls.findIndex(
        (call) => call.method === 'PATCH',
      )
      const beforePatch = github.calls.slice(0, patchIndex)
      expect(
        beforePatch.filter(
          (call) => call.method === 'POST' && call.path.endsWith('/assets'),
        ),
      ).toHaveLength(9)
      expect(beforePatch.at(-1)?.path).toBe(
        '/repos/example/bot/git/ref/tags/v1.2.3',
      )
      expect(
        beforePatch.filter(
          (call) =>
            call.path === '/repos/example/bot/releases/7' &&
            call.method === 'GET',
        ),
      ).toHaveLength(10)
      expect(github.calls[patchIndex]?.body).toEqual({
        draft: false,
        prerelease: false,
        make_latest: 'legacy',
      })
    })
  })

  test('skips an already published release with zero HTTP mutations', async () => {
    await withAssets(async (config) => {
      const github = new GitHubFixture()
      const release = github.draft()
      release.draft = false
      release.target_commitish = 'older-commit'
      expect(await publishRelease(config, github.fetch)).toBe('skipped')
      expect(github.calls).toHaveLength(1)
      expect(github.mutations).toEqual([])
    })
  })

  test('an upload failure preserves a draft and a same-SHA retry replaces partial assets', async () => {
    await withAssets(async (config, names) => {
      const github = new GitHubFixture()
      github.failUploadName = 'balint-dc-bot-v1.2.3-linux-arm64.tar.gz'
      await expect(publishRelease(config, github.fetch)).rejects.toThrow(
        'HTTP 503',
      )
      expect(github.release?.draft).toBe(true)
      expect(github.publications).toEqual([])
      const partial =
        github.release?.assets.map((asset) => ({ ...asset })) ?? []
      expect(partial).toHaveLength(2)
      github.failUploadName = undefined
      expect(await publishRelease(config, github.fetch)).toBe('published')
      expect(github.publications).toEqual([[...names].sort()])
      expect(
        github.calls.filter((call) => call.method === 'DELETE'),
      ).toHaveLength(2)
      for (const asset of partial) {
        expect(
          github.release?.assets.find(
            (candidate) => candidate.name === asset.name,
          )?.id,
        ).not.toBe(asset.id)
      }
      expect(
        github.calls.filter(
          (call) =>
            call.method === 'POST' &&
            call.path === '/repos/example/bot/releases',
        ),
      ).toHaveLength(1)
    })
  })

  test('refuses an existing tag at another commit without uploads or tag movement', async () => {
    await withAssets(async (config) => {
      const github = new GitHubFixture()
      github.draft()
      github.tag = { type: 'commit', sha: 'older-commit' }
      await expect(publishRelease(config, github.fetch)).rejects.toThrow(
        'tag does not point to the current commit',
      )
      expect(github.mutations).toEqual([])
      expect(github.tag).toEqual({ type: 'commit', sha: 'older-commit' })
    })
  })

  test('publishes prereleases with prerelease true and make_latest false', async () => {
    await withAssets(async (config) => {
      const github = new GitHubFixture('1.2.3-rc.1')
      expect(await publishRelease(config, github.fetch)).toBe('published')
      expect(
        github.calls.find(
          (call) =>
            call.method === 'POST' &&
            call.path === '/repos/example/bot/releases',
        )?.body,
      ).toMatchObject({ draft: true, prerelease: true, make_latest: 'false' })
      expect(
        github.calls.find((call) => call.method === 'PATCH')?.body,
      ).toEqual({
        draft: false,
        prerelease: true,
        make_latest: 'false',
      })
    }, '1.2.3-rc.1')
  })

  test('peels the full nested annotated-tag API response before uploading', async () => {
    await withAssets(async (config) => {
      const github = new GitHubFixture()
      github.draft()
      github.tag = { type: 'tag', sha: 'annotation-sha' }
      github.annotations.set('annotation-sha', { type: 'commit', sha: commit })
      expect(await publishRelease(config, github.fetch)).toBe('published')
      expect(
        github.calls.filter(
          (call) => call.path === '/repos/example/bot/git/tags/annotation-sha',
        ),
      ).toHaveLength(2)
      expect(
        github.calls.some(
          (call) => call.path === '/repos/example/bot/git/refs',
        ),
      ).toBe(false)
    })
  })

  test('stops when a matching draft is published or changed concurrently', async () => {
    await withAssets(async (config, names) => {
      for (const change of [
        (release: Release) => {
          release.draft = false
        },
        (release: Release) => {
          release.target_commitish = 'concurrent-commit'
        },
      ]) {
        const github = new GitHubFixture()
        const assets = names.map((name, index) => ({
          id: index + 1,
          name,
          size: 13,
        }))
        github.draft(assets.map((asset) => ({ ...asset })))
        github.tag = { type: 'commit', sha: commit }
        github.changeBeforeRead = change
        await expect(publishRelease(config, github.fetch)).rejects.toThrow()
        expect(github.mutations).toEqual([])
        expect(github.release?.assets).toEqual(assets)
        expect(github.publications).toEqual([])
      }
    })
  })

  test('rejects a missing platform archive before any HTTP publication work', async () => {
    await withAssets(async (config) => {
      await rm(
        join(config.assetsDirectory, 'balint-dc-bot-v1.2.3-windows-arm64.zip'),
      )
      const github = new GitHubFixture()
      await expect(publishRelease(config, github.fetch)).rejects.toThrow(
        'expected nine files',
      )
      expect(github.calls).toEqual([])
    })
  })

  test('the final verification rejects lost assets and concurrent publication', async () => {
    await withAssets(async (config) => {
      for (const change of [
        (release: Release) => {
          release.assets.pop()
        },
        (release: Release) => {
          release.draft = false
        },
      ]) {
        const github = new GitHubFixture()
        github.changeAtRead = 10
        github.changeBeforeRead = change
        await expect(publishRelease(config, github.fetch)).rejects.toThrow()
        expect(
          github.calls.filter(
            (call) => call.method === 'POST' && call.path.endsWith('/assets'),
          ),
        ).toHaveLength(9)
        expect(github.calls.some((call) => call.method === 'PATCH')).toBe(false)
        expect(github.publications).toEqual([])
      }
    })
  })
})
