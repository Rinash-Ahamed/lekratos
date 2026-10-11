/**
 * le.kratos brand palette (single theme): Brick × Beige, from the supplied colour-palette board.
 *   Brick Brown #843A26 · Warm Beige #E8D5C0 · Ivory #F8F4EE · Taupe #B6A79A
 *   Espresso #2D211D · Olive Green #6B6F5A · Sand #C9B8A3 · Charcoal #1A1A1A
 * Tokens become CSS variables on :root (see buildThemeCss) and are consumed through Tailwind's @theme in globals.css.
 */
export const PALETTE = {
  brick: "#843A26",
  beige: "#E8D5C0",
  ivory: "#F8F4EE",
  taupe: "#B6A79A",
  espresso: "#2D211D",
  olive: "#6B6F5A",
  sand: "#C9B8A3",
  charcoal: "#1A1A1A",
} as const;

export interface ThemeTokens {
  /** Page background */ bg: string;
  /** Primary text */ fg: string;
  /** Raised surfaces: cards, drawers, inputs */ surface: string;
  /** Recessed surfaces: image wells, table headers */ sunk: string;
  /** Brand block colour (buttons, footer) */ primary: string;
  /** Text on --primary */ primaryFg: string;
  /** Accent fill (badges, highlights) */ accent: string;
  /** Text on --accent */ accentFg: string;
  /** Accent used as TEXT on --bg / --surface */ accentText: string;
  /** Secondary text */ muted: string;
  /** Hairlines and borders */ line: string;
  /** Supporting natural tone (success, small details) */ olive: string;
  /** Logo layers: "le.k" and "ratos" */ logoA: string; logoB: string;
  /** Colour handed to Razorpay checkout (white text on it) */ checkout: string;
}

export const TOKENS: ThemeTokens = {
  bg: PALETTE.ivory,
  fg: PALETTE.espresso,
  surface: "#FFFDFA",
  sunk: "#EFE4D6",
  primary: PALETTE.brick,
  primaryFg: PALETTE.ivory,
  accent: PALETTE.beige,
  accentFg: PALETTE.espresso,
  accentText: PALETTE.brick,
  muted: "#6A5A51",
  line: "rgba(45,33,29,0.18)",
  olive: PALETTE.olive,
  logoA: PALETTE.brick,
  logoB: "#9C7F61",
  checkout: PALETTE.brick,
};

const kebab = (s: string) => s.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase());

/** `:root{--bg:…;}` generated from TOKENS, rendered once in <head>. */
export function buildThemeCss(): string {
  return `:root{${Object.entries(TOKENS).map(([k, v]) => `--${kebab(k)}:${v};`).join("")}color-scheme:light;}`;
}
