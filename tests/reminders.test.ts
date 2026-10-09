import { describe, expect, test } from "bun:test";
import { createReminderController, type Scheduler } from "../src/reminders.js";

class FakeScheduler implements Scheduler {
  readonly callbacks = new Map<number, () => void>();
  readonly intervals: number[] = [];
  private nextId = 0;

  setInterval(callback: () => void, milliseconds: number): number {
    const id = this.nextId++;
    this.callbacks.set(id, callback);
    this.intervals.push(milliseconds);
    return id;
  }

  clearInterval(timer: unknown): void { this.callbacks.delete(timer as number); }
  tick(id: number): void { this.callbacks.get(id)?.(); }
}

async function flushAsyncWork(): Promise<void> {
  await new Promise<void>((resolve) => setImmediate(resolve));
}

describe("reminder controller", () => {
  test("sends immediately, repeats, and uses the configured interval", async () => {
    const scheduler = new FakeScheduler();
    const sent: string[][] = [];
    const reminders = createReminderController(
      { send: async (_channel, userIds) => { sent.push([...userIds]); } }, 2, scheduler,
    );
    reminders.start("a", ["1", "2"]);
    await flushAsyncWork();
    expect(sent).toEqual([["1", "2"]]);
    expect(scheduler.intervals).toEqual([120_000]);
    const timer = [...scheduler.callbacks.keys()][0]!;
    scheduler.tick(timer);
    await flushAsyncWork();
    expect(sent).toEqual([["1", "2"], ["1", "2"]]);
  });

  test("replaces a channel while isolating other channels", async () => {
    const scheduler = new FakeScheduler();
    const sent: string[][] = [];
    const reminders = createReminderController(
      { send: async (_channel, userIds) => { sent.push([...userIds]); } }, 1, scheduler,
    );
    reminders.start("a", ["1"]);
    const oldTimer = [...scheduler.callbacks.keys()][0]!;
    reminders.start("a", ["3"]);
    reminders.start("b", ["2"]);
    await flushAsyncWork();
    expect(scheduler.callbacks.has(oldTimer)).toBe(false);
    expect(reminders.has("a")).toBe(true);
    expect(reminders.has("b")).toBe(true);
    expect(sent).toEqual([["3"], ["2"]]);
  });

  test("stops a channel and reports whether a loop existed", () => {
    const scheduler = new FakeScheduler();
    const reminders = createReminderController({ send: async () => {} }, 1, scheduler);
    reminders.start("a", ["1"]);
    reminders.start("b", ["2"]);
    expect(reminders.stop("a")).toBe(true);
    expect(reminders.stop("a")).toBe(false);
    expect(reminders.has("a")).toBe(false);
    expect(reminders.has("b")).toBe(true);
  });

  test("does not dispatch a pending send after stop or replacement", async () => {
    const scheduler = new FakeScheduler();
    const sent: string[][] = [];
    const reminders = createReminderController(
      { send: async (_channel, userIds) => { sent.push([...userIds]); } }, 1, scheduler,
    );
    reminders.start("stopped", ["1"]);
    reminders.stop("stopped");
    reminders.start("replaced", ["2"]);
    reminders.start("replaced", ["3"]);
    await flushAsyncWork();
    expect(sent).toEqual([["3"]]);
  });

  test("clears a failed current send and logs the failure", async () => {
    const scheduler = new FakeScheduler();
    const errors: unknown[] = [];
    const reminders = createReminderController(
      { send: async () => { throw new Error("send failed"); } }, 1, scheduler,
      { error: (...args: unknown[]) => errors.push(args) },
    );
    reminders.start("a", ["1"]);
    await flushAsyncWork();
    expect(reminders.has("a")).toBe(false);
    expect(scheduler.callbacks.size).toBe(0);
    expect(errors).toHaveLength(1);
  });

  test("keeps the replacement alive when a stale send fails", async () => {
    const scheduler = new FakeScheduler();
    const sent: string[][] = [];
    const errors: unknown[] = [];
    let rejectOld!: (error: Error) => void;
    const reminders = createReminderController(
      { send: async (_channel, userIds) => {
        sent.push([...userIds]);
        if (userIds[0] === "1") await new Promise<void>((_resolve, reject) => { rejectOld = reject; });
      } }, 1, scheduler, { error: (...args: unknown[]) => errors.push(args) },
    );
    reminders.start("a", ["1"]);
    await flushAsyncWork();
    reminders.start("a", ["2"]);
    const replacementTimer = [...scheduler.callbacks.keys()][0]!;
    await flushAsyncWork();
    rejectOld(new Error("old send failed"));
    await flushAsyncWork();
    expect(reminders.has("a")).toBe(true);
    expect(scheduler.callbacks.has(replacementTimer)).toBe(true);
    expect(sent).toEqual([["1"], ["2"]]);
    expect(errors).toHaveLength(1);
  });

  test("does not overlap sends while a tick is in flight", async () => {
    const scheduler = new FakeScheduler();
    let resolveSend!: () => void;
    let active = 0;
    let peak = 0;
    let calls = 0;
    const reminders = createReminderController(
      { send: async () => {
        calls += 1;
        active += 1;
        peak = Math.max(peak, active);
        await new Promise<void>((resolve) => { resolveSend = resolve; });
        active -= 1;
      } }, 1, scheduler,
    );
    reminders.start("a", ["1"]);
    await flushAsyncWork();
    const timer = [...scheduler.callbacks.keys()][0]!;
    scheduler.tick(timer);
    await flushAsyncWork();
    expect(peak).toBe(1);
    resolveSend();
    await flushAsyncWork();
    scheduler.tick(timer);
    await flushAsyncWork();
    expect(calls).toBe(2);
    resolveSend();
    await flushAsyncWork();
  });

  test("clears all channels and timers", () => {
    const scheduler = new FakeScheduler();
    const reminders = createReminderController({ send: async () => {} }, 1, scheduler);
    reminders.start("a", ["1"]);
    reminders.start("b", ["2"]);
    reminders.clearAll();
    expect(scheduler.callbacks.size).toBe(0);
    expect(reminders.has("a")).toBe(false);
    expect(reminders.has("b")).toBe(false);
  });
});
