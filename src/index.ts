import { Client, Events, GatewayIntentBits } from "discord.js";
import { createDiscordSender, handleInteraction } from "./bot.js";
import { registerCommands } from "./commands.js";
import { loadConfig } from "./config.js";
import { createReminderController } from "./reminders.js";

const config = loadConfig(Bun.env);
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const reminders = createReminderController(createDiscordSender(client), config.intervalMinutes);
let shuttingDown = false;
let shutdownPromise: Promise<void> | undefined;

client.once(Events.ClientReady, (readyClient) => {
  console.log(`Logged in as ${readyClient.user.tag}`);
});
client.on(Events.Error, (error) => console.error("Discord client error", error));
client.on(Events.InteractionCreate, (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  void handleInteraction(interaction, reminders).catch((error: unknown) => {
    console.error("Interaction handling failed", error);
  });
});

function shutdown(): Promise<void> {
  shuttingDown = true;
  shutdownPromise ??= (async () => {
    reminders.clearAll();
    await client.destroy();
  })();
  return shutdownPromise;
}

const handleSignal = (): void => {
  void shutdown().then(
    () => process.exit(0),
    (error: unknown) => {
      console.error("Shutdown failed", error);
      process.exit(1);
    },
  );
};
process.once("SIGINT", handleSignal);
process.once("SIGTERM", handleSignal);

try {
  await registerCommands(config.token, config.clientId, config.guildId);
  if (!shuttingDown) await client.login(config.token);
  if (shuttingDown) await shutdown();
} catch (error: unknown) {
  if (!shuttingDown) {
    const message = error instanceof Error ? error.message : "unknown startup error";
    console.error(`Startup failed: ${message}`);
    await shutdown();
    process.exitCode = 1;
  }
}
