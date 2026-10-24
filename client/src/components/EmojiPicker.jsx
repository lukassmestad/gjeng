import { useEffect, useRef } from 'react';

const EMOJI = [
  '😀', '😂', '🤣', '😊', '😍', '🥰', '😎', '🤩',
  '🤔', '😅', '😬', '🙃', '😴', '😭', '😡', '🤯',
  '👍', '👎', '👏', '🙌', '🙏', '💪', '👀', '🤝',
  '❤️', '🔥', '✨', '🎉', '💯', '✅', '❌', '⚡',
  '🍕', '🌮', '☕', '🍺', '🏋️', '⚽', '🎮', '🎸',
  '📚', '💻', '🚲', '🏠', '🌧️', '☀️', '🐶', '🦊',
];

// A small grid of emoji above the message box. Clicking one adds it to your message.
export default function EmojiPicker({ onPick, onClose }) {
  const ref = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  // Clicking outside the picker (or its button) or pressing Escape closes it.
  useEffect(() => {
    const close = (event) => !ref.current?.parentElement?.contains(event.target) && closeRef.current();
    const escape = (event) => event.key === 'Escape' && closeRef.current();
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', escape);
    };
  }, []);

  return (
    <div className="emoji-picker" ref={ref} role="dialog" aria-label="Pick an emoji">
      {EMOJI.map((emoji) => (
        <button key={emoji} type="button" aria-label={`Add ${emoji}`} onClick={() => onPick(emoji)}>
          {emoji}
        </button>
      ))}
    </div>
  );
}
