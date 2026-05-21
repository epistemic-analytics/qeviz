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

  desaturate(alpha = 1): { r: number; g: number; b: number } {
    const rgbWhite = { r: 255, g: 255, b: 255 };
    const rgbVal = Color.parseColor(this.base);

    return {
      r: Math.round(rgbWhite.r + (rgbVal.r - rgbWhite.r) * (alpha * Math.abs(this.weight))),
      g: Math.round(rgbWhite.g + (rgbVal.g - rgbWhite.g) * (alpha * Math.abs(this.weight))),
      b: Math.round(rgbWhite.b + (rgbVal.b - rgbWhite.b) * (alpha * Math.abs(this.weight))),
    };
  }

  toString(alpha = 1): string {
    const desaturated = this.desaturate(alpha);
    return Color.rgb(desaturated.r, desaturated.g, desaturated.b);
  }
}