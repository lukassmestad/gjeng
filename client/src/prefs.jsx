import { createContext, useContext, useEffect, useState } from 'react';
import { buildTheme } from './color.js';
import { logoSvg } from './components/Logo.jsx';
import { storage } from './lib.js';

// Appearance and accessibility are saved on this device (like a browser setting), not on the server.
const APPEARANCE_KEY = 'gjeng.appearance';
const ACCESSIBILITY_KEY = 'gjeng.accessibility';

export const THEMES = {
  system: { label: 'Match my device' },
  light: { label: 'Light', dark: false, base: '#f7f4f0', accent: '#c2410c' },
  dark: { label: 'Dark', dark: true, base: '#16171c', accent: '#ff8a4c' },
  cream: { label: 'Cream', dark: false, base: '#f2e3c1', accent: '#9c4a1a' },
  retro: { label: 'Retro', dark: false, base: '#e3d9bd', accent: '#0f766e', font: 'retro' },
  'retro-dark': { label: 'Retro dark', dark: true, base: '#0b1a12', accent: '#3ddc84', text: '#b6f5c8', font: 'retro' },
  midnight: { label: 'Midnight', dark: true, base: '#101a33', accent: '#60a5fa' },
  forest: { label: 'Forest', dark: true, base: '#10251b', accent: '#86d993' },
  // Dark text on a light background reads best for most people (white on black can blur, e.g. with
  // astigmatism), so accessibility mode uses this one: near-black on a warm off-white, which keeps the
  // contrast very high without the glare of pure white. The dark one is for light-sensitive eyes.
  'high-contrast-light': { label: 'High contrast', dark: false, base: '#f7f3ea', accent: '#a33a00', text: '#111111', contrast: 'high' },
  'high-contrast': { label: 'High contrast dark', dark: true, base: '#000000', accent: '#ffd400', text: '#ffffff', contrast: 'high' },
};

export const DEFAULT_APPEARANCE = { theme: 'system', base: null, accent: null, text: null };

export const DEFAULT_ACCESSIBILITY = {
  textScale: 1,
  simpleLook: false,
  mode: false, // true while "accessibility mode" is on
  reduceMotion: 'system', // 'system' | 'on' | 'off'
  statusSymbols: false,
  strongFocus: false,
  readableText: false,
  alwaysShowTimes: false,
  announceMessages: true,
};

// "Accessibility mode": bigger text, high contrast (black on white), a simpler look,
// calm motion and clearer signals, all at once.
export const ACCESSIBILITY_MODE = {
  accessibility: {
    ...DEFAULT_ACCESSIBILITY,
    mode: true,
    textScale: 1.15,
    simpleLook: true,
    reduceMotion: 'on',
    statusSymbols: true,
    strongFocus: true,
    readableText: true,
    alwaysShowTimes: true,
  },
  appearance: { ...DEFAULT_APPEARANCE, theme: 'high-contrast-light' },
};

const prefersDark = () => window.matchMedia('(prefers-color-scheme: dark)').matches;

// The theme that's actually used: the chosen one with your own colours on top.
export function resolveTheme(appearance) {
  const name = appearance.theme === 'system' ? (prefersDark() ? 'dark' : 'light') : appearance.theme;
  const preset = THEMES[name] ?? THEMES.light;
  return {
    ...preset,
    base: appearance.base ?? preset.base,
    accent: appearance.accent ?? preset.accent,
    text: appearance.text ?? preset.text,
  };
}

const customised = (appearance) => Boolean(appearance.base || appearance.accent || appearance.text);

// Every colour a theme sets, so switching themes clears exactly these (and not e.g. the text size).
const THEME_VARS = Object.keys(buildTheme(THEMES.light).vars);

export function applyAppearance(appearance) {
  const root = document.documentElement;
  // "Match my device" with no own colours uses the hand-tuned light and dark colours in styles.css.
  const built = appearance.theme === 'system' && !customised(appearance) ? null : buildTheme(resolveTheme(appearance));
  const vars = built?.vars ?? {};
  for (const name of THEME_VARS) root.style.removeProperty(name);
  for (const [name, value] of Object.entries(vars)) root.style.setProperty(name, value);
  const theme = resolveTheme(appearance);
  root.dataset.font = theme.font ?? '';
  root.dataset.contrast = theme.contrast ?? '';
  // The browser tab icon gets the same colours as the logo in the app.
  const icon = document.querySelector('link[rel="icon"]');
  if (icon) icon.href = built ? `data:image/svg+xml,${encodeURIComponent(logoSvg(built.logo))}` : '/favicon.svg';
  document.querySelector('meta[name="theme-color"]:not([media])')?.remove();
  if (vars['--bg']) {
    const meta = document.createElement('meta');
    meta.name = 'theme-color';
    meta.content = vars['--bg'];
    document.head.append(meta);
  }
}

export function applyAccessibility(a) {
  const root = document.documentElement;
  root.style.setProperty('--text-scale', String(a.textScale));
  const reduce = a.reduceMotion === 'on' || (a.reduceMotion === 'system' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  root.classList.toggle('reduce-motion', reduce);
  root.classList.toggle('status-symbols', a.statusSymbols);
  root.classList.toggle('strong-focus', a.strongFocus);
  root.classList.toggle('simple-look', a.simpleLook);
  root.classList.toggle('readable-text', a.readableText);
  root.classList.toggle('always-times', a.alwaysShowTimes);
}

export function loadPrefs() {
  return {
    appearance: { ...DEFAULT_APPEARANCE, ...storage.get(APPEARANCE_KEY, {}) },
    accessibility: { ...DEFAULT_ACCESSIBILITY, ...storage.get(ACCESSIBILITY_KEY, {}) },
  };
}

// Called once before the first render, so the page never flashes the wrong colours.
export function applySavedPrefs() {
  const { appearance, accessibility } = loadPrefs();
  applyAppearance(appearance);
  applyAccessibility(accessibility);
}

const PrefsContext = createContext(null);

export function PrefsProvider({ children }) {
  const [prefs, setPrefs] = useState(loadPrefs);

  useEffect(() => {
    storage.set(APPEARANCE_KEY, prefs.appearance);
    applyAppearance(prefs.appearance);
  }, [prefs.appearance]);

  useEffect(() => {
    storage.set(ACCESSIBILITY_KEY, prefs.accessibility);
    applyAccessibility(prefs.accessibility);
  }, [prefs.accessibility]);

  // Follow the device when it switches between light and dark (for "Match my device").
  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => applyAppearance(prefs.appearance);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, [prefs.appearance]);

  const value = {
    ...prefs,
    setAppearance: (changes) => setPrefs((p) => ({ ...p, appearance: { ...p.appearance, ...changes } })),
    setAccessibility: (changes) => setPrefs((p) => ({ ...p, accessibility: { ...p.accessibility, ...changes } })),
    turnOnAccessibilityMode: () => setPrefs(ACCESSIBILITY_MODE),
    resetAll: () => setPrefs({ appearance: DEFAULT_APPEARANCE, accessibility: DEFAULT_ACCESSIBILITY }),
  };
  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

export const usePrefs = () => useContext(PrefsContext);
