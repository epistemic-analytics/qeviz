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
    const c = String(color).trim();
    // "#RRGGBB" (fast path), "#RGB", "#RRGGBBAA" (alpha dropped)
    if (/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(c)) {
      const n = parseInt(c.slice(1, 7), 16);
      return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
    }
    if (/^#[0-9a-f]{3}$/i.test(c)) {
      const [r, g, b] = [1, 2, 3].map(i => parseInt(c[i] + c[i], 16));
      return { r, g, b };
    }
    const m = c.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i);
    if (m) return { r: Math.round(+m[1]), g: Math.round(+m[2]), b: Math.round(+m[3]) };
    // Anything else CSS understands ("red", "steelblue", hsl(), …), as the
    // adapters pass colour names through: let the browser resolve it.
    const resolved = Color.resolveCss(c);
    if (resolved) return Color.parseColor(resolved);
    throw new Error(`Unsupported color format: ${color}`);
  }

  private static _ctx: CanvasRenderingContext2D | null | undefined;
  private static _cssCache = new Map<string, string | null>();

  /** A CSS colour as "#rrggbb" / "rgba(...)", or null if it isn't one. */
  static resolveCss(color: string): string | null {
    if (Color._cssCache.has(color)) return Color._cssCache.get(color)!;
    if (Color._ctx === undefined) {
      Color._ctx = typeof document !== 'undefined'
        ? document.createElement('canvas').getContext('2d') : null;
    }
    let out: string | null = null;
    const ctx = Color._ctx;
    if (ctx) {
      // An invalid value leaves fillStyle unchanged, so test against two sentinels.
      ctx.fillStyle = '#000000'; ctx.fillStyle = color; const a = ctx.fillStyle;
      ctx.fillStyle = '#ffffff'; ctx.fillStyle = color; const b = ctx.fillStyle;
      if (a === b) out = String(a);
    }
    Color._cssCache.set(color, out);
    return out;
  }

  static rgb(r: number, g: number, b: number): string {
    return `rgb(${r}, ${g}, ${b})`;
  }
}

export class WeightedColor extends Color {
  weight: number;
  /** Optional alpha; defaults to `weight` (saturation and alpha together). */
  alpha: number | undefined;

  constructor(base: Color | string, weight: number, alpha?: number) {
    super(base);
    this.weight = weight;
    this.alpha = alpha;
  }

  // Parse hex → HSV (h in [0, 360), s/v in [0, 1]).
  static toHSV(hex: string): { h: number; s: number; v: number } {
    const { r, g, b } = Color.parseColor(hex);
    const rn = r / 255, gn = g / 255, bn = b / 255;
    const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
    const d = max - min;
    const v = max;
    const s = max === 0 ? 0 : d / max;
    let h = 0;
    if (d > 0) {
      switch (max) {
        case rn: h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6; break;
        case gn: h = ((bn - rn) / d + 2) / 6; break;
        default:  h = ((rn - gn) / d + 4) / 6;
      }
    }
    return { h: h * 360, s, v };
  }

  // Convert HSV + alpha → rgba() CSS string.
  static hsvToRgba(h: number, s: number, v: number, a: number): string {
    const c = v * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = v - c;
    let r = 0, g = 0, b = 0;
    if      (h < 60)  { r = c; g = x; b = 0; }
    else if (h < 120) { r = x; g = c; b = 0; }
    else if (h < 180) { r = 0; g = c; b = x; }
    else if (h < 240) { r = 0; g = x; b = c; }
    else if (h < 300) { r = x; g = 0; b = c; }
    else              { r = c; g = 0; b = x; }
    return `rgba(${Math.round((r + m) * 255)},${Math.round((g + m) * 255)},${Math.round((b + m) * 255)},${a.toFixed(4)})`;
  }

  // Returns rgba(...) matching rENA's edge-color convention (ena.plot.network):
  //   • hue and value (brightness) are preserved from the base color
  //   • HSV saturation is set to |weight| directly (0 = grey, 1 = fully vivid)
  //   • alpha is also set to |weight|
  //
  // rENA converts the input color to HSV, replaces the S component with the
  // normalized edge weight, and additionally sets plotly element opacity to the
  // same value.  Working in HSV (not HSL) is essential: palette colors like
  // #EE6677 have HSL lightness ≈ 67%, so 100% HSL saturation still looks
  // washed-out, whereas HSV value ≈ 0.93 gives the expected vivid output.
  toString(): string {
    const { h, v } = WeightedColor.toHSV(this.base);
    const w = Math.min(1, Math.abs(this.weight));
    const a = this.alpha === undefined ? w : Math.min(1, Math.max(0, this.alpha));
    return WeightedColor.hsvToRgba(h, w, v, a);
  }
}