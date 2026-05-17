import { z } from "zod";

export const INSTANCE_NAME_MAX_LENGTH = 60;
const INSTANCE_NAME_REGEX = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,58}[A-Za-z0-9])?$/;

export const INSTANCE_NAME_REQUIRED_MESSAGE = "Instance name is required.";
export const INSTANCE_NAME_INVALID_MESSAGE =
  "Instance name is invalid. Use letters, numbers, and hyphens only.";

export function normalizeInstanceName(value: string) {
  return value.trim();
}

export function getInstanceNameError(value: string) {
  const normalized = normalizeInstanceName(value);

  if (!normalized) return INSTANCE_NAME_REQUIRED_MESSAGE;
  if (normalized.length > INSTANCE_NAME_MAX_LENGTH) {
    return `Instance name is invalid. Maximum ${INSTANCE_NAME_MAX_LENGTH} characters allowed.`;
  }
  if (!INSTANCE_NAME_REGEX.test(normalized)) return INSTANCE_NAME_INVALID_MESSAGE;
  return null;
}

export const instanceNameSchema = z
  .string()
  .transform(normalizeInstanceName)
  .superRefine((value, ctx) => {
    const error = getInstanceNameError(value);
    if (!error) return;
    ctx.addIssue({ code: "custom", message: error });
  });
