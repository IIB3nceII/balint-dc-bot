# Balint Discord reminder bot

Balint is a small Discord bot built with Bun, strict TypeScript, and discord.js v14. It registers the `/start` and `/stop` guild commands and sends the exact reminder `mondj nekem valamit légyszíves` to selected users.

[Download the latest release](https://github.com/IIB3nceII/balint-dc-bot/releases/latest) to run the bot without installing Bun or dependencies. If you are setting it up from scratch, continue to [Create and install the bot from scratch](#b-create-and-install-the-bot-from-scratch).

## Contents

- [Run a downloaded release](#run-a-downloaded-release)
- [A. Run an existing bot](#a-run-an-existing-bot)
- [B. Create and install the bot from scratch](#b-create-and-install-the-bot-from-scratch)
- [Use and stop reminders](#use-and-stop-reminders)
- [Configuration](#configuration)
- [Scripts](#scripts)
- [Releases for maintainers](#releases-for-maintainers)
- [Troubleshooting](#troubleshooting)

## Run a downloaded release

Use this path when you want to run a published build without installing Bun, dependencies, or the source tree. The bot must already be installed in the target server, and hosting it still requires authorized access to its token and matching IDs. If it is already online elsewhere, just use its Discord commands. From scratch, you can choose either this downloaded release path or the source-based path below.

1. Open the repository's [latest release](https://github.com/IIB3nceII/balint-dc-bot/releases/latest) and download the archive matching your platform from the table below. Each archive includes the Bun-bundled executable, launcher, and `.env.example`.
2. Extract the entire archive into a private folder. Create `.env` beside the executable by copying `.env.example`; never upload, commit, or print it. Fill `DISCORD_TOKEN`, `CLIENT_ID`, `GUILD_ID`, and optional `INTERVAL_MINUTES` as described in [Configuration](#configuration).
3. Start it from the extracted folder. On Windows, double-click `start.bat` so the console remains visible. On macOS/Linux, run `./start.sh`; if extraction removed execute bits, run `chmod +x start.sh balint-dc-bot` first. The launcher sets its own folder as the working directory, so `.env` is found reliably. You may also run `./balint-dc-bot` directly from that folder.
4. Wait for `Logged in as ...`, then use `/start` and `/stop` in the configured server. Follow [Use and stop reminders](#use-and-stop-reminders); `Ctrl+C` stops the process and a restart does not restore targets.

| Release target     | Choose this when                                                 | Archive   |
| ------------------ | ---------------------------------------------------------------- | --------- |
| `windows-x64`      | Windows on Intel or AMD64                                        | `.zip`    |
| `windows-arm64`    | Windows on ARM64 hardware                                        | `.zip`    |
| `macos-x64`        | Intel Mac                                                        | `.tar.gz` |
| `macos-arm64`      | Apple Silicon Mac                                                | `.tar.gz` |
| `linux-x64`        | Linux on Intel or AMD64 with glibc, the usual distribution setup | `.tar.gz` |
| `linux-arm64`      | Linux on ARM64 with glibc                                        | `.tar.gz` |
| `linux-x64-musl`   | Linux x64 using musl, commonly Alpine                            | `.tar.gz` |
| `linux-arm64-musl` | Linux ARM64 using musl, commonly Alpine                          | `.tar.gz` |

The filename is `balint-dc-bot-vVERSION-TARGET` with the archive extension shown above. Intel and AMD64 are the x64 target; Apple Silicon is ARM64. Do not use a musl build on a normal glibc Linux installation or vice versa.

## A. Run an existing bot

This route assumes the bot is already installed in the target server. Server membership does not provide the bot token: obtain authorized bot-token access and the matching application and server IDs. If someone else already runs this application, you can simply use its commands; hosting a local process is a separate task.

1. Get the project source, then enter its directory. See GitHub's [cloning guide](https://docs.github.com/en/repositories/creating-and-managing-repositories/cloning-a-repository), or clone the repository:

   ```sh
   git clone https://github.com/IIB3nceII/balint-dc-bot.git balint-dc-bot
   cd balint-dc-bot
   ```

2. Install [Bun](https://bun.com/docs/installation), then verify it is available with `bun --version`.
3. Install dependencies: `bun install`.
4. Create `.env` only if it does not already exist. On macOS/Linux use `cp -n .env.example .env`; on PowerShell use `if (-not (Test-Path .env)) { Copy-Item .env.example .env }`. Set the authorized `DISCORD_TOKEN`, `CLIENT_ID`, and `GUILD_ID` values, plus optional `INTERVAL_MINUTES`. `DISCORD_TOKEN` comes from the existing maintainer; `CLIENT_ID` is **General Information → Application ID**; and `GUILD_ID` is the target server's ID from **User Settings → Advanced → Developer Mode**, then the server icon's **Copy Server ID** action. See Discord's [ID instructions](https://support.discord.com/hc/en-us/articles/206346498-Where-can-I-find-my-User-Server-Message-ID). Never commit or print `.env`.

   Use these placeholders as a starting point, then replace them in your local `.env` file and keep that file private:

   ```dotenv
   DISCORD_TOKEN=your-bot-token
   CLIENT_ID=application-id
   GUILD_ID=target-server-id
   # INTERVAL_MINUTES=5
   ```

5. Check and start one process for this application:

   ```sh
   bun run typecheck
   bun run start
   ```

   Leave it running and wait for console output beginning `Logged in as ...`. At startup, the bot registers `/start` and `/stop` for the configured guild; those commands are available only in that configured server. Run only one instance for an application to avoid duplicate loops.

## B. Create and install the bot from scratch

1. Open the [Discord Developer Portal](https://discord.com/developers/applications), choose **New Application**, enter a name, and create it. In **General Information**, copy **Application ID** for `CLIENT_ID`.
2. In **Bot**, use **Reset Token** to generate a new token and save it as `DISCORD_TOKEN`. A newly created application already has a bot user.
3. In **Installation**, enable **Guild Install**. Use the Discord-provided install link and set Guild Install scopes to `bot` and `applications.commands`. Request `View Channel` and `Send Messages`; add `Send Messages in Threads` when using threads. Authorizing the install requires Manage Server permission. See Discord's [getting-started guide](https://docs.discord.com/developers/quick-start/getting-started), [OAuth2 documentation](https://docs.discord.com/developers/topics/oauth2), and [application commands guide](https://docs.discord.com/developers/interactions/application-commands).
4. Open the install link and add the bot to the managed server. Check channel and thread permission overrides as well as server permissions.
5. Enable **Developer Mode** under **User Settings → Advanced**. Right-click the server icon and choose **Copy Server ID** for `GUILD_ID`; Discord's [ID instructions](https://support.discord.com/hc/en-us/articles/206346498-Where-can-I-find-my-User-Server-Message-ID) also explain copying user IDs.
6. Continue with [Run a downloaded release](#run-a-downloaded-release) or steps 1–5 in [A. Run an existing bot](#a-run-an-existing-bot), using the new token and IDs.

No privileged intents are needed: this bot uses only the Guilds gateway intent.

## Use and stop reminders

1. In a channel where the bot can send messages, run `/start` with real mentions, for example `/start users:@Balint @Anna`. Plain names are ignored because the option requires Discord mention syntax. A reliable raw form is `/start users:<@123456789012345678> <@987654321098765432>`; replace those IDs with real values. Duplicate mentions are removed.
2. The bot sends immediately, then repeats in that same channel every five minutes by default (or the configured interval), mentioning only the selected users.
3. Run `/start` again in the channel to replace its targets and restart its loop.
4. Anyone can run `/stop` in that channel. It stops only that channel and responds ephemerally, including when nothing is running.
5. Press `Ctrl+C` in the terminal to stop the whole bot and all loops. State is in memory: after a restart, targets are forgotten and `/start` must be run again. A failed send stops the affected loop and is logged. All bot replies are in English except the exact Hungarian reminder above.

## Configuration

| Variable           | Required | Meaning                                               |
| ------------------ | -------- | ----------------------------------------------------- |
| `DISCORD_TOKEN`    | Yes      | Bot token; keep it secret.                            |
| `CLIENT_ID`        | Yes      | Discord application ID, not a client secret.          |
| `GUILD_ID`         | Yes      | Target server ID where commands are registered.       |
| `INTERVAL_MINUTES` | No       | Finite positive interval in minutes; defaults to `5`. |

Bun automatically loads `.env`; no dotenv package is used. Use [.env.example](.env.example) as the template and never commit or print `.env`.

## Scripts

| Command                   | Purpose                                                                                        |
| ------------------------- | ---------------------------------------------------------------------------------------------- |
| `bun install`             | Install dependencies.                                                                          |
| `bun run start`           | Run the bot.                                                                                   |
| `bun run dev`             | Run with Bun's watch mode.                                                                     |
| `bun run typecheck`       | Run TypeScript without emitting files.                                                         |
| `bun run test`            | Run the test suite.                                                                            |
| `bun run build`           | Build the native release for the current platform.                                             |
| `bun run build TARGET`    | Build one release target.                                                                      |
| `bun run build:all`       | Build all eight release targets.                                                               |
| `bun run release:prepare` | CI helper: validate the version and decide whether the main-branch workflow should release.    |
| `bun run release:publish` | CI helper: upload the workflow's archives and checksum asset, then publish the GitHub Release. |
| `bun run format`          | Format the repository with Oxfmt.                                                              |
| `bun run format:check`    | Check repository formatting without writing changes.                                           |
| `bun run lint`            | Run Oxlint with warnings treated as failures.                                                  |
| `bun run lint:fix`        | Apply Oxlint's safe fixes.                                                                     |

For VS Code, install the recommended `oxc.oxc-vscode` extension from the [Visual Studio Code Marketplace](https://marketplace.visualstudio.com/items?itemName=oxc.oxc-vscode). Workspace settings select it as the default formatter and format files on save. CI runs `format:check` and `lint` before typechecking and tests.

## Releases for maintainers

The [GitHub Actions release workflow](.github/workflows/release.yml) checks typechecking and tests, then builds all eight targets and publishes a GitHub Release when a version change reaches `main` through a push or merge. The release tag and assets use the semantic version in [`package.json`](package.json); the initial version is `1.0.0`, and it is released when first published. A push with an unchanged version skips publication only when `vVERSION` is already published. Bump the version manually before pushing or merging: `1.0.1` for a bug fix, `1.1.0` for a backward-compatible feature, and `2.0.0` for a breaking change. A prerelease such as `1.1.0-beta.1` is published as a prerelease and is not the latest release.

CI installs with `bun install --frozen-lockfile`. Each archive contains the launcher, executable, and `.env.example`; `SHA256SUMS` is a separate release asset, not part of the archives. Verify the relevant downloaded archive with `sha256sum` (Linux), `shasum -a 256` (macOS), or `Get-FileHash -Algorithm SHA256` (Windows). The workflow builds without a bot token or other application secret and publishes with the repository's GitHub Actions token. See GitHub's [workflow syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax) and [release command reference](https://cli.github.com/manual/gh_release_create).

Pull requests targeting `main` run the reusable [Tests workflow](.github/workflows/tests.yml) on Ubuntu, Windows, and macOS. The release workflow calls that same workflow for the exact main-branch commit and cannot prepare a release until all three operating-system jobs pass. This follows GitHub's [reusable workflow guidance](https://docs.github.com/en/actions/how-tos/reuse-automations/reuse-workflows).

## Troubleshooting

- Missing environment variable errors mean a required `.env` value is empty or absent.
- If commands do not appear, confirm `CLIENT_ID`, `GUILD_ID`, the Guild Install, and `applications.commands` scope; restart after changing them.
- If messages fail, check View Channel, Send Messages, thread permissions, and channel-specific overrides.
- If the token was exposed, reset it in **Developer Portal → Bot** and update `.env`.
