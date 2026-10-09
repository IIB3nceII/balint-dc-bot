# Balint Discord reminder bot

Balint is a small Discord bot built with Bun, strict TypeScript, and discord.js v14. It registers the `/start` and `/stop` guild commands and sends the exact reminder `mondj nekem valamit légyszíves` to selected users.

## Contents

- [A. Run an existing bot](#a-run-an-existing-bot)
- [B. Create and install the bot from scratch](#b-create-and-install-the-bot-from-scratch)
- [Use and stop reminders](#use-and-stop-reminders)
- [Configuration](#configuration)
- [Scripts](#scripts)
- [Troubleshooting](#troubleshooting)

## A. Run an existing bot

This route assumes the bot is already installed in the target server. Server membership does not provide the bot token: obtain authorized bot-token access and the matching application and server IDs. If someone else already runs this application, you can simply use its commands; hosting a local process is a separate task.

1. Get the project source, then enter its directory. See GitHub's [cloning guide](https://docs.github.com/en/repositories/creating-and-managing-repositories/cloning-a-repository), then replace `YOUR_REPOSITORY_URL` with the repository URL (or download and extract a ZIP):

   ```sh
   git clone YOUR_REPOSITORY_URL balint-dc-bot
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
6. Continue with steps 1–5 in [A. Run an existing bot](#a-run-an-existing-bot), using the new token and IDs.

No privileged intents are needed: this bot uses only the Guilds gateway intent.

## Use and stop reminders

1. In a channel where the bot can send messages, run `/start` with real mentions, for example `/start users:@Balint @Anna`. Plain names are ignored because the option requires Discord mention syntax. A reliable raw form is `/start users:<@123456789012345678> <@987654321098765432>`; replace those IDs with real values. Duplicate mentions are removed.
2. The bot sends immediately, then repeats in that same channel every five minutes by default (or the configured interval), mentioning only the selected users.
3. Run `/start` again in the channel to replace its targets and restart its loop.
4. Anyone can run `/stop` in that channel. It stops only that channel and responds ephemerally, including when nothing is running.
5. Press `Ctrl+C` in the terminal to stop the whole bot and all loops. State is in memory: after a restart, targets are forgotten and `/start` must be run again. A failed send stops the affected loop and is logged. All bot replies are in English except the exact Hungarian reminder above.

## Configuration

| Variable | Required | Meaning |
| --- | --- | --- |
| `DISCORD_TOKEN` | Yes | Bot token; keep it secret. |
| `CLIENT_ID` | Yes | Discord application ID, not a client secret. |
| `GUILD_ID` | Yes | Target server ID where commands are registered. |
| `INTERVAL_MINUTES` | No | Finite positive interval in minutes; defaults to `5`. |

Bun automatically loads `.env`; no dotenv package is used. Use [.env.example](.env.example) as the template and never commit or print `.env`.

## Scripts

| Command | Purpose |
| --- | --- |
| `bun install` | Install dependencies. |
| `bun run start` | Run the bot. |
| `bun run dev` | Run with Bun's watch mode. |
| `bun run typecheck` | Run TypeScript without emitting files. |
| `bun run test` | Run the test suite. |

## Troubleshooting

- Missing environment variable errors mean a required `.env` value is empty or absent.
- If commands do not appear, confirm `CLIENT_ID`, `GUILD_ID`, the Guild Install, and `applications.commands` scope; restart after changing them.
- If messages fail, check View Channel, Send Messages, thread permissions, and channel-specific overrides.
- If the token was exposed, reset it in **Developer Portal → Bot** and update `.env`.
