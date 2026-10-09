const USER_MENTION = /<@!?(\d+)>/g

export function parseUserMentions(input: string): string[] {
  const ids: string[] = []
  const seen = new Set<string>()
  for (const match of input.matchAll(USER_MENTION)) {
    const id = match[1]
    if (id !== undefined && !seen.has(id)) {
      seen.add(id)
      ids.push(id)
    }
  }
  return ids
}

export function reminderText(userIds: readonly string[]): string {
  return `${userIds.map((id) => `<@${id}>`).join(' ')} mondj nekem valamit légyszíves`
}
