import { timingSafeEqual } from "node:crypto";

const HEALTH_PATH = "/api/health";

export function requestNeedsPassword(method: string, url: string): boolean {
  const path = url.split("?")[0] ?? url;
  return !(method === "GET" && path === HEALTH_PATH);
}

export function passwordFromBasicHeader(header: string | undefined): string | null {
  if (header === undefined || !header.startsWith("Basic ")) {
    return null;
  }
  const decoded = Buffer.from(header.slice("Basic ".length).trim(), "base64").toString("utf8");
  const separator = decoded.indexOf(":");
  if (separator < 0) {
    return null;
  }
  return decoded.slice(separator + 1);
}

export function passwordsMatch(provided: string, expected: string): boolean {
  const providedBytes = Buffer.from(provided);
  const expectedBytes = Buffer.from(expected);
  const length = Math.max(providedBytes.length, expectedBytes.length);
  const left = Buffer.alloc(length);
  const right = Buffer.alloc(length);
  providedBytes.copy(left);
  expectedBytes.copy(right);
  return providedBytes.length === expectedBytes.length && timingSafeEqual(left, right);
}
