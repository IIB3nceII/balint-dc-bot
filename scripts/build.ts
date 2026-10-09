import { chmod, mkdir, rm } from 'node:fs/promises'
import { TARGETS, isTargetId, nativeTargetFor } from './targets.js'
import { TARGET_IDS, type TargetId, parseVersion } from './version.js'

const packageData: unknown = await Bun.file('package.json').json()
if (!isPackageData(packageData))
  throw new Error('package.json must contain a string version')
const { version } = parseVersion(packageData.version)
const requested = Bun.argv[2]
const targetIds: readonly TargetId[] =
  requested === 'all'
    ? TARGET_IDS
    : requested === undefined
      ? [nativeTarget()]
      : isTargetId(requested)
        ? [requested]
        : (() => {
            throw new Error(`Unknown build target: ${requested}`)
          })()

const outputRoot = 'dist'
await mkdir(outputRoot, { recursive: true })

for (const targetId of targetIds) {
  const basename = `balint-dc-bot-v${version}-${targetId}`
  const staging = `${outputRoot}/${basename}`
  await rm(staging, { recursive: true, force: true })
  await mkdir(staging, { recursive: true })
  const executable = targetId.startsWith('windows-')
    ? 'balint-dc-bot.exe'
    : 'balint-dc-bot'
  const result = await Bun.build({
    entrypoints: ['src/index.ts'],
    target: 'bun',
    env: 'disable',
    minify: true,
    compile: {
      target: TARGETS[targetId],
      outfile: `${staging}/${executable}`,
      autoloadDotenv: true,
      autoloadBunfig: false,
    },
  })
  if (!result.success) throw new Error(`Build failed for ${targetId}`)

  await Bun.write(`${staging}/.env.example`, Bun.file('.env.example'))
  await Bun.write(`${staging}/README.md`, Bun.file('README.md'))
  if (targetId.startsWith('windows-')) {
    await Bun.write(
      `${staging}/start.bat`,
      `@echo off\r\ncd /d "%~dp0"\r\nbalint-dc-bot.exe\r\npause\r\n`,
    )
  } else {
    const launcher =
      '#!/bin/sh\nset -eu\ncd -- "$(dirname -- "$0")"\nexec ./balint-dc-bot\n'
    const launcherPath = `${staging}/start.sh`
    await Bun.write(launcherPath, launcher)
    await chmod(launcherPath, 0o755)
    await chmod(`${staging}/${executable}`, 0o755)
  }
  console.log(staging)
}

function isPackageData(value: unknown): value is { version: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'version' in value &&
    typeof value.version === 'string'
  )
}

function nativeTarget(): TargetId {
  return nativeTargetFor(process.platform, process.arch)
}
