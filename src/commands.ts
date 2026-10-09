import { REST, Routes, SlashCommandBuilder } from 'discord.js'

export const commandData = [
  new SlashCommandBuilder()
    .setName('start')
    .setDescription('Start repeating reminders in this channel')
    .addStringOption((option) =>
      option
        .setName('users')
        .setDescription('Users to mention')
        .setRequired(true),
    ),
  new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Stop reminders in this channel'),
]

export async function registerCommands(
  token: string,
  clientId: string,
  guildId: string,
): Promise<void> {
  const rest = new REST({ version: '10' }).setToken(token)
  await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
    body: commandData.map((command) => command.toJSON()),
  })
}
