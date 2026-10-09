import type { ChatInputCommandInteraction, Client } from 'discord.js'
import { parseUserMentions, reminderText } from './mentions.js'
import type { ReminderController, ReminderSender } from './reminders.js'

const allowedMentions = {
  parse: [],
  users: [] as string[],
  roles: [] as string[],
  repliedUser: false,
}

export function createDiscordSender(client: Client): ReminderSender {
  return {
    async send(channelId, userIds, isCurrent) {
      const channel = await client.channels.fetch(channelId)
      if (!isCurrent()) return
      if (
        !channel ||
        !('send' in channel) ||
        typeof channel.send !== 'function'
      ) {
        throw new Error(`Channel ${channelId} cannot receive messages`)
      }
      await channel.send({
        content: reminderText(userIds),
        allowedMentions: { ...allowedMentions, users: [...userIds] },
      })
    },
  }
}

export async function handleInteraction(
  interaction: ChatInputCommandInteraction,
  reminders: ReminderController,
): Promise<void> {
  if (interaction.commandName === 'start') {
    const userIds = parseUserMentions(
      interaction.options.getString('users', true),
    )
    if (userIds.length === 0) {
      await interaction.reply({
        content: 'Please provide at least one valid Discord user mention.',
        ephemeral: true,
      })
      return
    }
    reminders.start(interaction.channelId, userIds)
    await interaction.reply({
      content: 'Reminders started in this channel.',
      ephemeral: true,
    })
    return
  }
  if (interaction.commandName === 'stop') {
    const stopped = reminders.stop(interaction.channelId)
    await interaction.reply({
      content: stopped
        ? 'Reminders stopped in this channel.'
        : 'No reminders are running in this channel.',
      ephemeral: true,
    })
  }
}
