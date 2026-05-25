import { Writable } from "node:stream";

export interface LogEntry {
  time: number;
  level: number;
  levelLabel: string;
  msg: string;
  [key: string]: unknown;
}

const MAX = 500;
const entries: LogEntry[] = [];

const LEVEL_LABELS: Record<number, string> = {
  10: "trace",
  20: "debug",
  30: "info",
  40: "warn",
  50: "error",
  60: "fatal",
};

export function getRecentLogs(n = 200): LogEntry[] {
  return entries.slice(-Math.min(n, MAX));
}

export const logBufferStream = new Writable({
  write(chunk: Buffer, _enc: BufferEncoding, cb: (err?: Error | null) => void) {
    try {
      const lines = chunk.toString().trim().split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const entry = JSON.parse(trimmed) as LogEntry;
        entry.levelLabel = LEVEL_LABELS[entry.level] ?? String(entry.level);
        if (entries.length >= MAX) entries.shift();
        entries.push(entry);
      }
    } catch {
      // non-JSON output (pino-pretty in dev) — ignored
    }
    cb();
  },
});
