# Agent instructions

This bot uses `/start` to parse and deduplicate real Discord mentions, send an immediate reminder, then send the default five-minute same-channel reminder with the exact text `mondj nekem valamit légyszíves`. It keeps one in-memory loop per channel: starting again replaces that channel's targets and restarts its loop, while anyone can use `/stop`; guild commands register at startup. The stack is Bun, strict TypeScript, and discord.js v14.

## Commands

- `bun install` — install dependencies
- `bun run start` — run the bot
- `bun run dev` — run the development script
- `bun run typecheck` — run `tsc --noEmit`
- `bun run test` — optional test run

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
- `CLAUDE.md` — pointer to this file

## Conventions

Use Bun APIs and `bun` commands instead of Node or npm; never use dotenv. Keep TypeScript strict and never use `any`. Required environment variables are `DISCORD_TOKEN`, `CLIENT_ID`, and `GUILD_ID`; `INTERVAL_MINUTES` is optional and defaults to 5. Bun auto-loads `.env`. Never commit or print `.env` contents, and preserve the ignored `.env`. State stays in memory with no database. Restrict `allowedMentions` to targeted user IDs; never ping roles or everyone. Use only the Guilds gateway intent, and clean up timers on send failure and process signals. Write all bot output in English except the exact Hungarian reminder text above.
