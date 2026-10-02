import { z } from "zod";
import { apiRequest } from "./transport";

export const apiEnvelopeSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({ data: dataSchema });

export async function apiFetch<T>(
  path: string,
  options: RequestInit,
  parser: (raw: unknown) => T
): Promise<T> {
  const res = await apiRequest(path, {
    credentials: "include",
    headers: {
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...(options.headers ?? {})
    },
    ...options
  });

  const text = await res.text();
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Server returned non-JSON response (HTTP ${res.status}): ${text.slice(0, 200)}`);
  }

  if (!res.ok) {
    const message =
      typeof json === "object" &&
      json !== null &&
      "error" in json &&
      typeof json.error === "object" &&
      json.error !== null &&
      "message" in json.error &&
      typeof json.error.message === "string"
        ? json.error.message
        : `HTTP ${res.status}`;
    throw new Error(message);
  }

  return parser(json);
}

export function toLocalDateTimeValue(dateIso?: string, time?: string) {
  if (dateIso && time) {
    return `${dateIso}T${time}`;
  }
  const now = new Date();
  const localIso = new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  return localIso;
}

export function splitDateTime(localDateTime: string): { entryDate: string; entryTime: string } {
  const d = new Date(localDateTime);
  const iso = new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString();
  return { entryDate: iso.slice(0, 10), entryTime: iso.slice(11, 16) };
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
