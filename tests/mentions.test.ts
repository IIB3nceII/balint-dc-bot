import { describe, expect, test } from 'bun:test'
import { parseUserMentions, reminderText } from '../src/mentions.js'

describe('mentions', () => {
  test('parses valid mentions, supports nicknames, and deduplicates in order', () => {
    expect(parseUserMentions('hi <@123> <@!456> <@123> nope @789')).toEqual([
      '123',
      '456',
    ])
  })

  test('formats the exact reminder content', () => {
    expect(reminderText(['123', '456'])).toBe(
      '<@123> <@456> mondj nekem valamit légyszíves',
    )
  })
})
