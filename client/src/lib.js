import { COLORS } from '../../shared/constants.js';

export { COLORS, INVITE_CODE_LENGTH, LIMITS, REACTIONS, USERNAME_PATTERN, USERNAME_RULES } from '../../shared/constants.js';

// crypto.randomUUID only exists on https/localhost, and phones on the same Wi-Fi use plain http.
export function makeId() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

// localStorage can be blocked (private mode etc.), so never let it crash the app.
export const storage = {
  get(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value === null ? fallback : JSON.parse(value);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Not saved, but the app keeps working.
    }
  },
  remove(key) {
    try {
      localStorage.removeItem(key);
    } catch {
      // Same as above.
    }
  },
};

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // The clipboard API needs https, so fall back to the old way on plain http.
    const field = document.createElement('textarea');
    field.value = text;
    field.style.position = 'fixed';
    field.style.opacity = '0';
    document.body.append(field);
    field.select();
    const copied = document.execCommand('copy');
    field.remove();
    return copied;
  }
}

const segmenter = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter() : null;

function firstCharacter(word) {
  if (segmenter) return segmenter.segment(word)[Symbol.iterator]().next().value?.segment ?? '';
  return Array.from(word)[0] ?? '';
}

export function initials(name, max = 2) {
  const words = String(name).trim().split(/\s+/).filter(Boolean);
  return words.slice(0, max).map(firstCharacter).join('').toUpperCase() || '?';
}

// The same group always gets the same colour.
export function groupColor(id) {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return COLORS[hash % COLORS.length];
}

// The other person in a direct message.
export function dmPartner(group, meId) {
  return group.members.find((m) => m.id !== meId) ?? group.members[0];
}

export function plural(count, word) {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

export function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function formatDay(ts) {
  const day = new Date(ts).toDateString();
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (day === today.toDateString()) return 'Today';
  if (day === yesterday.toDateString()) return 'Yesterday';
  return new Date(ts).toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });
}

// Short time for the group list: "14:05" today, otherwise "Mon" or "12 Oct".
export function formatShort(ts) {
  const date = new Date(ts);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return formatTime(ts);
  if (now - date < 6 * 24 * 60 * 60 * 1000) return date.toLocaleDateString([], { weekday: 'short' });
  return date.toLocaleDateString([], { day: 'numeric', month: 'short' });
}

export function formatTypers(names) {
  if (names.length === 1) return `${names[0]} is typing…`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are typing…`;
  return 'Several people are typing…';
}
