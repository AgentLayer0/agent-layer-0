import { z } from "zod/v4";
import { AL0Error } from "./error.js";

export const RegisterAgentSchema = z.object({
  swarmId: z
    .string()
    .min(1, "swarmId must not be empty")
    .max(64, "swarmId must be at most 64 bytes"),
});

export const CreatePollSchema = z.object({
  swarmId: z
    .string()
    .min(1, "swarmId must not be empty")
    .max(64, "swarmId must be at most 64 bytes"),
  question: z.string().min(1, "question must not be empty"),
  options: z
    .array(z.string())
    .min(2, "must provide at least 2 options")
    .max(8, "cannot provide more than 8 options"),
  expiresAt: z
    .number()
    .int()
    .positive("expiresAt must be a positive Unix timestamp"),
});

export const VoteSchema = z.object({
  pollId: z.union([z.bigint(), z.number().int().nonnegative()]),
  optionIndex: z.number().int().nonnegative("optionIndex must be non-negative"),
});

export const PollIdSchema = z.union([
  z.bigint(),
  z.number().int().nonnegative(),
]);

export type RegisterAgentInput = z.infer<typeof RegisterAgentSchema>;
export type CreatePollInput = z.infer<typeof CreatePollSchema>;
export type VoteInput = z.infer<typeof VoteSchema>;

export function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    const message = z.prettifyError(result.error);
    throw AL0Error.invalidInput(message);
  }
  return result.data;
}
