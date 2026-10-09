import { describe, expect, test } from 'bun:test'
import { TARGETS } from '../scripts/targets.js'
import { nativeTargetFor } from '../scripts/targets.js'
import {
  assertTagCommit,
  classifyReleaseLookup,
  parseVersion,
  shouldPublishRelease,
} from '../scripts/version.js'
import { planRelease, resolveTagCommit } from '../scripts/release-plan.js'
import { requestOptions } from '../scripts/github.js'

describe('release metadata', () => {
  test('maps every supported target to a Bun compile target', () => {
    expect(Object.keys(TARGETS)).toEqual([
      'linux-x64',
      'linux-arm64',
      'linux-x64-musl',
      'linux-arm64-musl',
      'windows-x64',
      'windows-arm64',
      'macos-x64',
      'macos-arm64',
    ])
    expect(Object.values(TARGETS)).toEqual([
      'bun-linux-x64',
      'bun-linux-arm64',
      'bun-linux-x64-musl',
      'bun-linux-arm64-musl',
      'bun-windows-x64',
      'bun-windows-arm64',
      'bun-darwin-x64',
      'bun-darwin-arm64',
    ])
    expect(TARGETS['windows-arm64']).toBe('bun-windows-arm64')
    expect(TARGETS['macos-arm64']).toBe('bun-darwin-arm64')
    expect(nativeTargetFor('win32', 'x64')).toBe('windows-x64')
    expect(nativeTargetFor('darwin', 'arm64')).toBe('macos-arm64')
    expect(nativeTargetFor('linux', 'x64')).toBe('linux-x64')
  })

  test('accepts canonical SemVer and identifies prereleases', () => {
    expect(parseVersion('1.2.3')).toEqual({
      version: '1.2.3',
      prerelease: false,
    })
    expect(parseVersion('1.2.3-rc.1+build.7').prerelease).toBe(true)
  })

  test('rejects noncanonical versions', () => {
    for (const version of [
      '01.2.3',
      '1.02.3',
      '1.2',
      '1.2.3-01',
      'v1.2.3',
      '1.2.3+bad_',
      '1.2.3\n',
      '1.2.3\r\n',
      ' 1.2.3',
      '1.2.3 ',
    ]) {
      expect(() => parseVersion(version)).toThrow('Invalid canonical SemVer')
    }
  })

  test('skips an already published version without rewriting it', () => {
    expect(shouldPublishRelease('1.2.3', true)).toBe(false)
    expect(shouldPublishRelease('1.2.4', false)).toBe(true)
  })

  test('distinguishes an absent release from API failure', () => {
    expect(classifyReleaseLookup(404)).toBe('missing')
    expect(classifyReleaseLookup(200)).toBe('existing')
    for (const status of [401, 403, 500])
      expect(() => classifyReleaseLookup(status)).toThrow(`HTTP ${status}`)
  })

  test('rejects a version tag pointing at another commit', () => {
    expect(() => assertTagCommit('old-sha', 'current-sha')).toThrow(
      'current commit',
    )
    expect(() => assertTagCommit('same-sha', 'same-sha')).not.toThrow()
  })

  test('plans published skips and same-commit draft retries safely', () => {
    expect(planRelease(undefined, 'sha')).toBe('create-draft')
    expect(
      planRelease(
        { id: 1, draft: false, target_commitish: 'other', upload_url: '' },
        'sha',
      ),
    ).toBe('skip-published')
    expect(
      planRelease(
        { id: 1, draft: true, target_commitish: 'sha', upload_url: '' },
        'sha',
      ),
    ).toBe('resume-draft')
    expect(() =>
      planRelease(
        { id: 1, draft: true, target_commitish: 'other', upload_url: '' },
        'sha',
      ),
    ).toThrow('current commit')
  })

  test('peels annotated tags and surfaces malformed tag API responses', async () => {
    const calls: string[] = []
    const commit = await resolveTagCommit(
      async (sha) => {
        calls.push(sha)
        return { object: { type: 'commit', sha: 'current' } }
      },
      { object: { type: 'tag', sha: 'tag-object' } },
    )
    expect(commit).toBe('current')
    expect(calls).toEqual(['tag-object'])
    await expect(
      resolveTagCommit(async () => ({ nope: true }), {
        object: { type: 'tag', sha: 'bad' },
      }),
    ).rejects.toThrow('invalid')
    await expect(
      resolveTagCommit(
        async () => {
          throw new Error('HTTP 403')
        },
        { object: { type: 'tag', sha: 'forbidden' } },
      ),
    ).rejects.toThrow('HTTP 403')
  })

  test('serializes JSON and binary GitHub request bodies without phantom undefined bodies', async () => {
    const headers = { accept: 'application/vnd.github+json' }
    const get = requestOptions('GET', headers)
    expect(get.body).toBeUndefined()
    const json = requestOptions('POST', headers, {
      ref: 'refs/tags/v1.0.0',
      sha: 'commit',
    })
    expect(json.body).toBe(
      JSON.stringify({ ref: 'refs/tags/v1.0.0', sha: 'commit' }),
    )
    expect(json.headers).toMatchObject({ 'content-type': 'application/json' })
    const bytes = new ArrayBuffer(3)
    expect(requestOptions('POST', headers, { binary: bytes }).body).toBe(bytes)
  })
})
