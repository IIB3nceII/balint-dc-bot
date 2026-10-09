import { describe, expect, test } from "bun:test";
import { loadConfig, MAX_INTERVAL_MINUTES } from "../src/config.js";

const base = { DISCORD_TOKEN: "token", CLIENT_ID: "client", GUILD_ID: "guild" };

describe("configuration", () => {
  test("uses five minutes by default", () => expect(loadConfig(base).intervalMinutes).toBe(5));
  test("rejects missing required variables without exposing values", () => {
    expect(() => loadConfig({ ...base, DISCORD_TOKEN: undefined })).toThrow("DISCORD_TOKEN");
  });
  test("rejects non-finite, non-positive, and too-large intervals", () => {
    for (const value of ["NaN", "Infinity", "0", "-1", String(MAX_INTERVAL_MINUTES + 1)]) {
      expect(() => loadConfig({ ...base, INTERVAL_MINUTES: value })).toThrow("INTERVAL_MINUTES");
    }
  });
});
