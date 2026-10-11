import { describe, expect, it } from "vitest";
import { buildThemeCss, PALETTE, TOKENS } from "@/lib/theme";

const lin = (c: number) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = (hex: string) => { const n = parseInt(hex.slice(1), 16); return 0.2126 * lin(n >> 16) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255); };
const ratio = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

describe("brand palette", () => {
  it("uses the supplied palette values", () => {
    expect(PALETTE).toMatchObject({ brick: "#843A26", beige: "#E8D5C0", ivory: "#F8F4EE", taupe: "#B6A79A", espresso: "#2D211D", olive: "#6B6F5A", sand: "#C9B8A3", charcoal: "#1A1A1A" });
  });
  const t = TOKENS;
  const checks: [string, string, string, number][] = [
    ["body text on page", t.fg, t.bg, 7],
    ["body text on surface", t.fg, t.surface, 7],
    ["muted text on page", t.muted, t.bg, 4.5],
    ["muted text on surface", t.muted, t.surface, 4.5],
    ["muted text on sunk", t.muted, t.sunk, 4.5],
    ["primary button text", t.primaryFg, t.primary, 4.5],
    ["accent badge text", t.accentFg, t.accent, 4.5],
    ["brick text on page", t.accentText, t.bg, 4.5],
    ["brick text on surface", t.accentText, t.surface, 4.5],
    ["brick text on sunk", t.accentText, t.sunk, 4.5],
    ["white on checkout colour", "#FFFFFF", t.checkout, 4.5],
    ["logo layer A on page (large graphic)", t.logoA, t.bg, 3],
    ["logo layer B on page (large graphic)", t.logoB, t.bg, 3],
  ];
  for (const [label, fg, bg, min] of checks) it(`${label} ≥ ${min}:1`, () => expect(ratio(fg, bg), `${fg} on ${bg}`).toBeGreaterThanOrEqual(min));
  it("emits every token as a CSS variable on :root", () => {
    const css = buildThemeCss();
    expect(css.startsWith(":root{")).toBe(true);
    for (const k of ["--bg:", "--fg:", "--sunk:", "--logo-a:", "--logo-b:", "--accent-text:", "--olive:"]) expect(css).toContain(k);
  });
});
