import { TARGET_IDS, type TargetId } from './version.js'

export const TARGETS = {
  'linux-x64': 'bun-linux-x64',
  'linux-arm64': 'bun-linux-arm64',
  'linux-x64-musl': 'bun-linux-x64-musl',
  'linux-arm64-musl': 'bun-linux-arm64-musl',
  'windows-x64': 'bun-windows-x64',
  'windows-arm64': 'bun-windows-arm64',
  'macos-x64': 'bun-darwin-x64',
  'macos-arm64': 'bun-darwin-arm64',
} as const satisfies Record<TargetId, Bun.Build.CompileTarget>

export function isTargetId(value: string): value is TargetId {
  return (TARGET_IDS as readonly string[]).includes(value)
}

export function nativeTargetFor(
  platform: string,
  architecture: string,
): TargetId {
  const normalizedPlatform =
    platform === 'darwin'
      ? 'macos'
      : platform === 'win32'
        ? 'windows'
        : platform
  const normalizedArchitecture =
    architecture === 'arm64' || architecture === 'x64'
      ? architecture
      : undefined
  const target =
    normalizedArchitecture === undefined
      ? undefined
      : `${normalizedPlatform}-${normalizedArchitecture}`
  if (target !== undefined && isTargetId(target)) return target
  throw new Error(
    `Unsupported native build platform: ${platform}/${architecture}`,
  )
}
