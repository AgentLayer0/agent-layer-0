import pino from "pino";
import { logBufferStream } from "./log-buffer";

const isProduction = process.env.NODE_ENV === "production";

const streams = pino.multistream([
  {
    stream: isProduction
      ? process.stdout
      : pino.transport({ target: "pino-pretty", options: { colorize: true } }),
  },
  { stream: logBufferStream, level: "info" },
]);

export const logger = pino(
  {
    level: process.env.LOG_LEVEL ?? "info",
    redact: [
      "req.headers.authorization",
      "req.headers.cookie",
      "res.headers['set-cookie']",
    ],
  },
  streams,
);
