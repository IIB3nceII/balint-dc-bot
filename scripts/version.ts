export interface VersionMetadata {
  version: string
  prerelease: boolean
}

const CORE = '(?:0|[1-9]\\d*)'
const IDENTIFIER = '(?:0|[1-9]\\d*|[0-9A-Za-z-]*[A-Za-z-][0-9A-Za-z-]*)'
const VERSION_PATTERN = new RegExp(
  `^(${CORE})\\.(${CORE})\\.(${CORE})(?:-(${IDENTIFIER}(?:\\.${IDENTIFIER})*))?(?:\\+([0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*))?$`,
)

export function parseVersion(version: string): VersionMetadata {
  const match = VERSION_PATTERN.exec(version)
  if (!match || match[0].length !== version.length)
    throw new Error(`Invalid canonical SemVer version: ${version}`)
  return { version, prerelease: match[4] !== undefined }
}

export function shouldPublishRelease(
  version: string,
  existingRelease: boolean,
): boolean {
  parseVersion(version)
  return !existingRelease
}

export function classifyReleaseLookup(status: number): 'existing' | 'missing' {
  if (status === 200) return 'existing'
  if (status === 404) return 'missing'
  throw new Error(`GitHub release lookup failed with HTTP ${status}`)
}

export function assertTagCommit(tagSha: string, currentSha: string): void {
  if (tagSha !== currentSha)
    throw new Error('Existing version tag does not point to the current commit')
}

export function outputLines(
  metadata: VersionMetadata,
  shouldRelease: boolean,
  releaseMode: string,
): string[] {
  return [
    `version=${metadata.version}`,
    `tag=v${metadata.version}`,
    `prerelease=${metadata.prerelease}`,
    `should_release=${shouldRelease}`,
    `release_mode=${releaseMode}`,
    `matrix=${JSON.stringify({ target: TARGET_IDS })}`,
  ]
}

export const TARGET_IDS = [
  'linux-x64',
  'linux-arm64',
  'linux-x64-musl',
  'linux-arm64-musl',
  'windows-x64',
  'windows-arm64',
  'macos-x64',
  'macos-arm64',
] as const

export type TargetId = (typeof TARGET_IDS)[number]
