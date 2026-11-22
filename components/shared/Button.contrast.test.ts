// Issue #1376 — WCAG AA contrast checks for Button variants.
// Dashboard surfaces use #020D08 / #042413 backgrounds; secondary/ghost text
// must reach 4.5:1 for normal text.

function lum(hex: string): number {
  const c = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16) / 255);
  const f = (v: number) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export function contrastRatio(fg: string, bg: string): number {
  const [l1, l2] = [lum(fg), lum(bg)].sort((a, b) => b - a);
  return (l1 + 0.05) / (l2 + 0.05);
}

const BG = "#042413"; // dashboard card background
const BG_DEEP = "#020D08"; // app background

// Mirrors components/shared/Button.tsx variantClasses.
const VARIANTS: Record<string, { fg: string; bg: string }> = {
  primary:   { fg: "#020D08", bg: "#B6FF4A" },
  secondary: { fg: "#F4F7EF", bg: "#06351C" },
  outline:   { fg: "#B6FF4A", bg: BG },
  ghost:     { fg: "#DCE8E0", bg: BG },
  danger:    { fg: "#f87171", bg: "#1f0d0d" }, // red-500/10 over dark
  link:      { fg: "#B6FF4A", bg: BG_DEEP },
};

describe("Button variant contrast (WCAG AA)", () => {
  for (const [name, v] of Object.entries(VARIANTS)) {
    it(`${name} text meets 4.5:1 on its background`, () => {
      expect(contrastRatio(v.fg, v.bg)).toBeGreaterThanOrEqual(4.5);
    });
  }

  it("ghost text also passes on the deeper app background", () => {
    expect(contrastRatio(VARIANTS.ghost.fg, BG_DEEP)).toBeGreaterThanOrEqual(4.5);
  });
});
