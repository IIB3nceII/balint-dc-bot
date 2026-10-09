export interface Scheduler {
  setInterval(callback: () => void, milliseconds: number): unknown;
  clearInterval(timer: unknown): void;
}

export interface ReminderSender {
  send(channelId: string, userIds: readonly string[], isCurrent: () => boolean): Promise<void>;
}

interface ReminderEntry {
  userIds: string[];
  timer: unknown;
}

export interface ReminderController {
  start(channelId: string, userIds: readonly string[]): void;
  stop(channelId: string): boolean;
  clearAll(): void;
  has(channelId: string): boolean;
}

export function createReminderController(
  sender: ReminderSender,
  intervalMinutes: number,
  scheduler: Scheduler = globalThis,
  logger: Pick<Console, "error"> = console,
): ReminderController {
  const loops = new Map<string, ReminderEntry>();
  const inFlight = new WeakSet<ReminderEntry>();
  const intervalMs = intervalMinutes * 60_000;

  const clearEntry = (channelId: string, entry: ReminderEntry): void => {
    scheduler.clearInterval(entry.timer);
    if (loops.get(channelId) === entry) loops.delete(channelId);
  };

  const send = (channelId: string, entry: ReminderEntry): void => {
    if (loops.get(channelId) !== entry || inFlight.has(entry)) return;
    inFlight.add(entry);
    const isCurrent = (): boolean => loops.get(channelId) === entry;
    void Promise.resolve()
      .then(() => {
        if (!isCurrent()) return;
        return sender.send(channelId, entry.userIds, isCurrent);
      })
      .catch((error: unknown) => {
        if (isCurrent()) clearEntry(channelId, entry);
        logger.error(`Reminder send failed in channel ${channelId}`, error);
      })
      .finally(() => inFlight.delete(entry));
  };

  return {
    start(channelId, userIds) {
      const current = loops.get(channelId);
      if (current) clearEntry(channelId, current);
      const entry: ReminderEntry = { userIds: [...userIds], timer: undefined };
      loops.set(channelId, entry);
      entry.timer = scheduler.setInterval(() => send(channelId, entry), intervalMs);
      send(channelId, entry);
    },
    stop(channelId) {
      const entry = loops.get(channelId);
      if (!entry) return false;
      clearEntry(channelId, entry);
      return true;
    },
    clearAll() {
      for (const [channelId, entry] of loops) clearEntry(channelId, entry);
    },
    has(channelId) {
      return loops.has(channelId);
    },
  };
}
