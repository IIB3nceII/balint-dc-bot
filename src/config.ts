export interface Config {
  token: string;
  clientId: string;
  guildId: string;
  intervalMinutes: number;
}

const MAX_INTERVAL_MINUTES = 2_147_483_647 / 60_000;

export function loadConfig(env: Record<string, string | undefined>): Config {
  const required = ["DISCORD_TOKEN", "CLIENT_ID", "GUILD_ID"] as const;
  for (const key of required) {
    if (!env[key]?.trim()) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }

  const rawInterval = env.INTERVAL_MINUTES ?? "5";
  const intervalMinutes = Number(rawInterval);
  if (!Number.isFinite(intervalMinutes) || intervalMinutes <= 0 || intervalMinutes > MAX_INTERVAL_MINUTES) {
    throw new Error(`INTERVAL_MINUTES must be a finite positive number no greater than ${MAX_INTERVAL_MINUTES}`);
  }

  return {
    token: env.DISCORD_TOKEN as string,
    clientId: env.CLIENT_ID as string,
    guildId: env.GUILD_ID as string,
    intervalMinutes,
  };
}

export { MAX_INTERVAL_MINUTES };
