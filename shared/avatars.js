// Built-in profile pictures, for people who can't or don't want to upload one.
// A user's avatar is then saved as "preset:<id>", and both sides draw it from this list.

export const AVATAR_PRESETS = [
  { id: 'lifter', emoji: '🏋️', from: '#ffb37a', to: '#e8590c' },
  { id: 'guitar', emoji: '🎸', from: '#74c0fc', to: '#1c7ed6' },
  { id: 'fox', emoji: '🦊', from: '#e599f7', to: '#ae3ec9' },
  { id: 'bike', emoji: '🚲', from: '#8ce99a', to: '#2f9e44' },
  { id: 'cat', emoji: '🐱', from: '#ffd8a8', to: '#f08c00' },
  { id: 'dog', emoji: '🐶', from: '#d0bfff', to: '#7048e8' },
  { id: 'rocket', emoji: '🚀', from: '#a5d8ff', to: '#1864ab' },
  { id: 'pizza', emoji: '🍕', from: '#ffc9c9', to: '#e03131' },
  { id: 'game', emoji: '🎮', from: '#99e9f2', to: '#0c8599' },
  { id: 'books', emoji: '📚', from: '#fcc2d7', to: '#d6336c' },
  { id: 'palette', emoji: '🎨', from: '#ffec99', to: '#e67700' },
  { id: 'ball', emoji: '⚽', from: '#b2f2bb', to: '#087f5b' },
  { id: 'coffee', emoji: '☕', from: '#e9d5c0', to: '#8a5a2b' },
  { id: 'headphones', emoji: '🎧', from: '#bac8ff', to: '#3b5bdb' },
  { id: 'plant', emoji: '🌱', from: '#d8f5a2', to: '#5c940d' },
  { id: 'robot', emoji: '🤖', from: '#dee2e6', to: '#495057' },
];

export const PRESET_PREFIX = 'preset:';

export function findPreset(avatar) {
  if (typeof avatar !== 'string' || !avatar.startsWith(PRESET_PREFIX)) return null;
  return AVATAR_PRESETS.find((p) => p.id === avatar.slice(PRESET_PREFIX.length)) ?? null;
}

// An emoji on a colour gradient, as SVG.
export function presetSvg({ emoji, from, to }) {
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
    `<defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs>` +
    '<rect width="100" height="100" fill="url(#g)"/>' +
    `<text x="50" y="56" font-size="54" text-anchor="middle" dominant-baseline="middle">${emoji}</text></svg>`
  );
}
