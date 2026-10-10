import { describe, expect, test } from "bun:test";
import { resolveClientIp } from "./rate-limit.ts";

const SOCKET = "192.0.2.1";

describe("resolveClientIp", () => {
  test.each([
    ["no proxy declared: the header is ignored", "198.51.100.1", 0, SOCKET],
    ["one proxy: the entry it appended", "198.51.100.1, 203.0.113.5", 1, "203.0.113.5"],
    ["two proxies: the entry the outer one appended", "198.51.100.1, 203.0.113.5, 10.0.0.2", 2, "203.0.113.5"],
    ["fewer entries than proxies: the socket", "203.0.113.5", 2, SOCKET],
    ["proxy declared but no header: the socket", undefined, 1, SOCKET],
  ])("%s", (_case, forwardedFor, trustedHops, expected) => {
    expect(resolveClientIp(forwardedFor, SOCKET, trustedHops)).toBe(expected);
  });

  test("no socket and no trusted entry gives no address", () => {
    expect(resolveClientIp("198.51.100.1", null, 0)).toBeNull();
  });
});
