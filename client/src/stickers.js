// Animated GIF stickers, drawn by the app itself and turned into real GIF files in the browser
// (with gifenc, which is open source). No GIF service, no API key, no copyright worries.
import { applyPalette, GIFEncoder, quantize } from 'gifenc';

export const STICKERS = [
  { id: 'gg', label: 'GG', emoji: '🎮', text: 'GG', motion: 'bounce', colors: ['#74c0fc', '#1c7ed6'], tags: 'good game win gaming' },
  { id: 'lol', label: 'LOL', emoji: '😂', text: 'LOL', motion: 'shake', colors: ['#ffe066', '#f08c00'], tags: 'laugh funny haha' },
  { id: 'leg-day', label: 'Leg day', emoji: '🏋️', text: 'LEG DAY', motion: 'bounce', colors: ['#ffb37a', '#e8590c'], tags: 'gym workout lift' },
  { id: 'lets-go', label: "Let's go", emoji: '🚀', text: "LET'S GO", motion: 'float', colors: ['#a5d8ff', '#1864ab'], tags: 'hype excited' },
  { id: 'yay', label: 'Yay', emoji: '🎉', text: 'YAY!', motion: 'spin', colors: ['#e599f7', '#ae3ec9'], tags: 'party celebrate' },
  { id: 'nope', label: 'Nope', emoji: '🙅', text: 'NOPE', motion: 'shake', colors: ['#ffc9c9', '#e03131'], tags: 'no' },
  { id: 'love', label: 'Love', emoji: '❤️', text: '<3', motion: 'pulse', colors: ['#fcc2d7', '#d6336c'], tags: 'heart love' },
  { id: 'fire', label: 'Fire', emoji: '🔥', text: 'FIRE', motion: 'pulse', colors: ['#ffd8a8', '#e8590c'], tags: 'hot lit' },
  { id: 'coffee', label: 'Coffee?', emoji: '☕', text: 'COFFEE?', motion: 'wave', colors: ['#e9d5c0', '#8a5a2b'], tags: 'break tired' },
  { id: 'study', label: 'Study mode', emoji: '📚', text: 'STUDY MODE', motion: 'bounce', colors: ['#b2f2bb', '#2f9e44'], tags: 'exam school read' },
  { id: 'pizza', label: 'Pizza?', emoji: '🍕', text: 'PIZZA?', motion: 'spin', colors: ['#ffec99', '#e67700'], tags: 'food dinner' },
  { id: 'thanks', label: 'Thanks', emoji: '🙏', text: 'THANKS!', motion: 'pulse', colors: ['#bac8ff', '#3b5bdb'], tags: 'thank you' },
  { id: 'hi', label: 'Hi', emoji: '👋', text: 'HI!', motion: 'wave', colors: ['#99e9f2', '#0c8599'], tags: 'hello wave hey' },
  { id: 'sleepy', label: 'Sleepy', emoji: '😴', text: 'ZZZ', motion: 'float', colors: ['#d0bfff', '#5f3dc4'], tags: 'tired sleep night' },
  { id: 'wow', label: 'Wow', emoji: '🤯', text: 'WOW', motion: 'shake', colors: ['#ffd43b', '#f76707'], tags: 'mind blown amazing' },
  { id: 'taco', label: 'Taco time', emoji: '🌮', text: 'TACO TIME', motion: 'bounce', colors: ['#d8f5a2', '#5c940d'], tags: 'food friday' },
];

const SIZE = 128;
const FRAMES = 16;
const DELAY_MS = 70;

// Where the emoji is in each frame. `t` goes from 0 to 1 over one loop, so every motion loops smoothly.
function motion(kind, t) {
  const turn = t * Math.PI * 2;
  switch (kind) {
    case 'bounce':
      return { y: -Math.abs(Math.sin(t * Math.PI)) * 18 };
    case 'shake':
      return { x: Math.sin(turn * 4) * 6, rotate: Math.sin(turn * 4) * 0.08 };
    case 'spin':
      return { rotate: turn };
    case 'pulse':
      return { scale: 1 + 0.14 * Math.sin(turn) };
    case 'wave':
      return { rotate: Math.sin(turn) * 0.4 };
    case 'float':
      return { y: Math.sin(turn) * 7 };
    default:
      return {};
  }
}

function drawFrame(ctx, sticker, t) {
  const gradient = ctx.createLinearGradient(0, 0, SIZE, SIZE);
  gradient.addColorStop(0, sticker.colors[0]);
  gradient.addColorStop(1, sticker.colors[1]);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, SIZE, SIZE);

  const { x = 0, y = 0, rotate = 0, scale = 1 } = motion(sticker.motion, t);
  ctx.save();
  ctx.translate(SIZE / 2 + x, SIZE * 0.42 + y);
  ctx.rotate(rotate);
  ctx.scale(scale, scale);
  ctx.font = `${SIZE * 0.42}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(sticker.emoji, 0, 0);
  ctx.restore();

  // The caption, made smaller if it's too wide.
  let fontSize = 22;
  ctx.font = `900 ${fontSize}px system-ui, sans-serif`;
  while (ctx.measureText(sticker.text).width > SIZE - 12 && fontSize > 12) {
    fontSize -= 1;
    ctx.font = `900 ${fontSize}px system-ui, sans-serif`;
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 5;
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.strokeText(sticker.text, SIZE / 2, SIZE - 14);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(sticker.text, SIZE / 2, SIZE - 14);
}

function toBase64(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

const cache = new Map();

// Makes the GIF for a sticker (once; after that it's remembered).
export function stickerGif(sticker) {
  if (!cache.has(sticker.id)) {
    cache.set(
      sticker.id,
      (async () => {
        const canvas = document.createElement('canvas');
        canvas.width = SIZE;
        canvas.height = SIZE;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        const gif = GIFEncoder();
        for (let i = 0; i < FRAMES; i++) {
          drawFrame(ctx, sticker, i / FRAMES);
          const { data } = ctx.getImageData(0, 0, SIZE, SIZE);
          const palette = quantize(data, 128);
          gif.writeFrame(applyPalette(data, palette), SIZE, SIZE, { palette, delay: DELAY_MS, repeat: 0 });
          if (i % 4 === 3) await new Promise((resolve) => setTimeout(resolve)); // keep the page responsive
        }
        gif.finish();
        return { data: `data:image/gif;base64,${toBase64(gif.bytes())}`, width: SIZE, height: SIZE };
      })(),
    );
  }
  return cache.get(sticker.id);
}
