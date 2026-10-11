import { describe, expect, it } from "vitest";
import { clientIp } from "@/lib/security";

const r = (h: Record<string, string>) => new Request("http://x.test", { headers: h });

describe("clientIp", () => {
  it("ignores spoofed left-most x-forwarded-for entries", () => {
    expect(clientIp(r({ "x-forwarded-for": "6.6.6.6, 1.2.3.4" }))).toBe("1.2.3.4");
  });
  it("prefers platform headers", () => {
    expect(clientIp(r({ "x-forwarded-for": "6.6.6.6", "x-real-ip": "9.9.9.9" }))).toBe("9.9.9.9");
  });
  it("falls back to unknown", () => {
    expect(clientIp(r({}))).toBe("unknown");
  });
});
