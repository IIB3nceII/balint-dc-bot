# Agent instructions

This bot uses `/start` to parse and deduplicate real Discord mentions, send an immediate reminder, then send the default five-minute same-channel reminder with the exact text `mondj nekem valamit légyszíves`. It keeps one in-memory loop per channel: starting again replaces that channel's targets and restarts its loop, while anyone can use `/stop`; guild commands register at startup. The stack is Bun, strict TypeScript, and discord.js v14.

## Commands

- `bun install` — install dependencies
- `bun run start` — run the bot
- `bun run dev` — run the development script
- `bun run typecheck` — run `tsc --noEmit`
- `bun run test` — optional test run
- `bun run build` — build the native executable for the current platform
- `bun run build TARGET` — build one release target
- `bun run build:all` — build all eight release targets
- `bun run format` — format the repository with Oxfmt
- `bun run format:check` — check formatting without writing
- `bun run lint` — run Oxlint with warnings denied
- `bun run lint:fix` — apply Oxlint fixes

## Layout

- `src/index.ts` — startup, events, and shutdown
- `src/config.ts` — environment validation
- `src/commands.ts` — command definitions and guild registration
- `src/bot.ts` — interaction handling and Discord sends
- `src/mentions.ts` — mention parsing and text
- `src/reminders.ts` — in-memory timer control
- `tests/*.test.ts` — tests
- `package.json`, `tsconfig.json`, `bun.lock` — scripts, types, and dependencies
- `.env.example` — configuration template; `README.md` — setup
- `scripts/build.ts` — release executable and archive builder; `.github/workflows/release.yml` — main-branch release automation
- `.github/workflows/tests.yml` — reusable Ubuntu, Windows, and macOS typecheck/test workflow
- `.oxfmtrc.json`, `.oxlintrc.json` — repository formatter and linter configuration
- `.vscode/settings.json`, `.vscode/extensions.json` — Oxc formatter editor defaults and recommendation
- `CLAUDE.md` — pointer to this file

## Conventions

Use Bun APIs and `bun` commands instead of Node or npm; never use dotenv. Keep TypeScript strict and never use `any`. Required environment variables are `DISCORD_TOKEN`, `CLIENT_ID`, and `GUILD_ID`; `INTERVAL_MINUTES` is optional and defaults to 5. Bun auto-loads `.env`. Never commit or print `.env` contents, and preserve the ignored `.env`. State stays in memory with no database. Restrict `allowedMentions` to targeted user IDs; never ping roles or everyone. Use only the Guilds gateway intent, and clean up timers on send failure and process signals. Write all bot output in English except the exact Hungarian reminder text above.

Release conventions: [`package.json`](package.json) is the source of the semantic release version; maintainers bump it manually before a main push or merge. The [release workflow](.github/workflows/release.yml) uses `release:prepare` and `release:publish` as CI helpers. Keep the Bun pin at `1.4.2`, use frozen-lockfile installs in CI, build targets for Windows x64/ARM64, macOS x64/ARM64, Linux x64/ARM64 glibc, and Linux x64/ARM64 musl, and keep `.env` out of release archives. Release archives include the launcher, executable, and `.env.example`; `SHA256SUMS` is published as a separate release asset.
Pull requests targeting `main` use the reusable `.github/workflows/tests.yml` workflow on Ubuntu, Windows, and macOS. Main-branch release preparation calls the same workflow for the exact commit and is gated on all three jobs; keep this gate read-only and credential-free. See GitHub's [reusable workflow guidance](https://docs.github.com/en/actions/how-tos/reuse-automations/reuse-workflows).
Use Oxfmt and Oxlint for repository formatting and linting; CI runs `bun run format:check` and `bun run lint` before typechecking and tests. Keep `.oxfmtrc.json` and `.oxlintrc.json` aligned with the strict TypeScript conventions and keep generated files and secrets ignored.
