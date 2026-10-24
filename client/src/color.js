// Colour maths for themes: turn a few chosen colours into the full set of app colours,
// and make sure text and buttons always stay readable (WCAG contrast ratios).

export function hexToRgb(hex) {
  const value = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16) / 255);
}

export function rgbToHex(rgb) {
  return `#${rgb.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0')).join('')}`;
}

export function rgbToHsl([r, g, b]) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h * 60, s, l];
}

export function hslToRgb([h, s, l]) {
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)];
}

export const hexToHsl = (hex) => rgbToHsl(hexToRgb(hex));
export const hslToHex = (hsl) => rgbToHex(hslToRgb(hsl));

export function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// Mixes two colours: amount 0 = all `a`, 1 = all `b`.
export function mix(a, b, amount) {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  return rgbToHex(x.map((v, i) => v + (y[i] - v) * amount));
}

// Moves a colour lighter or darker, step by step, until it reaches `ratio` against every background.
// Returns the colour and whether it had to change.
export function ensureContrast(hex, backgrounds, ratio) {
  const ok = (color) => backgrounds.every((bg) => contrast(color, bg) >= ratio);
  if (ok(hex)) return { color: hex, adjusted: false };
  const [h, s, l] = hexToHsl(hex);
  const darkBackground = luminance(backgrounds[0]) < 0.2;
  // Try the natural direction first (lighter on dark backgrounds), then the other way.
  for (const direction of darkBackground ? [1, -1] : [-1, 1]) {
    for (let step = 1; step <= 50; step++) {
      const candidate = hslToHex([h, s, Math.min(1, Math.max(0, l + direction * step * 0.02))]);
      if (ok(candidate)) return { color: candidate, adjusted: true };
    }
  }
  return { color: darkBackground ? '#ffffff' : '#000000', adjusted: true };
}

// Builds every CSS colour the app uses from a theme: dark or light, a background colour,
// an accent colour (the orange details by default), and optionally a text colour.
export function buildTheme({ dark, base, accent, text, contrast: contrastLevel }) {
  const high = contrastLevel === 'high';
  const [h, rawS] = hexToHsl(base);
  // Backgrounds stay calm: their tint is capped, so a bright pick doesn't make the app garish.
  const s = Math.min(rawS, dark ? 0.35 : 0.45);
  const shade = (l, sat = s) => hslToHex([h, sat, l]);

  const levels = high
    ? { bg: 0, sidebar: 0.03, surface: 0.06, surface2: 0.12, border: 0.85 }
    : dark
      ? { bg: 0.075, sidebar: 0.09, surface: 0.115, surface2: 0.155, border: 0.21 }
      : { bg: 0.955, sidebar: 0.975, surface: 0.995, surface2: 0.92, border: 0.86 };
  const bg = shade(levels.bg);
  const surface = shade(levels.surface);
  const surface2 = shade(levels.surface2);
  const backgrounds = [bg, surface, surface2];

  const minText = high ? 7 : 4.5;
  const textResult = ensureContrast(text ?? shade(dark ? 0.92 : 0.12, Math.min(s, 0.15)), backgrounds, minText);
  const muted = ensureContrast(mix(textResult.color, bg, high ? 0.15 : 0.38), [bg, surface], 4.5).color;

  // The accent has to stand out from the background, and its text (white or black) has to be readable.
  const [ah, as] = hexToHsl(accent);
  let accentColor = ensureContrast(hslToHex([ah, as, dark ? 0.66 : 0.42]), [bg, surface], 3).color;
  const onAccent = contrast('#ffffff', accentColor) >= contrast('#111111', accentColor) ? '#ffffff' : '#111111';
  accentColor = ensureContrast(accentColor, [onAccent], 4.5).color;

  return {
    vars: {
      'color-scheme': dark ? 'dark' : 'light',
      '--bg': bg,
      '--surface': surface,
      '--surface-2': surface2,
      '--sidebar': shade(levels.sidebar),
      '--hover': dark ? 'rgb(255 255 255 / 0.06)' : 'rgb(0 0 0 / 0.05)',
      '--text': textResult.color,
      '--muted': muted,
      '--border': high ? mix(textResult.color, bg, 0.35) : shade(levels.border),
      '--accent': accentColor,
      '--accent-hover': mix(accentColor, dark ? '#ffffff' : '#000000', 0.12),
      '--accent-soft': mix(accentColor, bg, dark ? 0.8 : 0.86),
      '--on-accent': onAccent,
      '--danger': dark ? '#ff6b6b' : '#c92a2a',
      '--danger-soft': mix(dark ? '#ff6b6b' : '#c92a2a', bg, 0.85),
      '--shadow': dark ? '0 12px 40px rgb(0 0 0 / 0.5)' : '0 12px 40px rgb(34 32 28 / 0.16)',
    },
    textAdjusted: Boolean(text) && textResult.adjusted,
  };
}
