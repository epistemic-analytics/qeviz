export class Color {
  base: string;

  constructor(base: Color | string) {
    this.base = typeof base === "string" ? base : base.base;

    // Return a Proxy to allow 0-based indexing for r, g, b
    return new Proxy(this, {
      get(target, prop) {
        if (typeof prop === "string" && /^[0-2]$/.test(prop)) {
          const { r, g, b } = Color.parseColor(target.base);
          return [r, g, b][Number(prop)];
        }
        return (target as any)[prop];
      }
    });
  }

  toString(): string {
    return this.base;
  }

  setBase(base: string): void {
    this.base = base;
  }

  static parseColor(color: string): { r: number; g: number; b: number } {
    // Parse hex color (e.g., "#RRGGBB")
    if (color.startsWith("#")) {
      const bigint = parseInt(color.slice(1), 16);
      return {
        r: (bigint >> 16) & 255,
        g: (bigint >> 8) & 255,
        b: bigint & 255,
      };
    }
    throw new Error("Unsupported color format");
  }

  static rgb(r: number, g: number, b: number): string {
    return `rgb(${r}, ${g}, ${b})`;
  }
}

export class WeightedColor extends Color {
  weight: number;

  constructor(base: Color | string, weight: number) {
    super(base);
    this.weight = weight;
  }

  // Parse hex → HSL (h in degrees, s/l as percentages 0–100).
  static toHSL(hex: string): { h: number; s: number; l: number } {
    const { r, g, b } = Color.parseColor(hex);
    const rn = r / 255, gn = g / 255, bn = b / 255;
    const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
    const l = (max + min) / 2;
    if (max === min) return { h: 0, s: 0, l: l * 100 };
    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h: number;
    switch (max) {
      case rn: h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6; break;
      case gn: h = ((bn - rn) / d + 2) / 6; break;
      default:  h = ((rn - gn) / d + 4) / 6;
    }
    return { h: h * 360, s: s * 100, l: l * 100 };
  }

  // Returns hsla(...) with saturation and alpha both scaled by |weight|,
  // matching the Web ENA visual convention: hue and lightness stay constant
  // while heavy edges are vivid/opaque and light edges fade toward transparent.
  toString(): string {
    const { h, s, l } = WeightedColor.toHSL(this.base);
    const w = Math.min(1, Math.abs(this.weight));
    return `hsla(${h.toFixed(2)}, ${(s * w).toFixed(2)}%, ${l.toFixed(2)}%, ${w.toFixed(4)})`;
  }
}