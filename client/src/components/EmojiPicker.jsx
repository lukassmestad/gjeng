import { useEffect, useRef, useState } from 'react';
import GifPanel from './GifPanel.jsx';

const EMOJI = [
  '😀', '😂', '🤣', '😊', '😍', '🥰', '😎', '🤩',
  '🤔', '😅', '😬', '🙃', '😴', '😭', '😡', '🤯',
  '👍', '👎', '👏', '🙌', '🙏', '💪', '👀', '🤝',
  '❤️', '🔥', '✨', '🎉', '💯', '✅', '❌', '⚡',
  '🍕', '🌮', '☕', '🍺', '🏋️', '⚽', '🎮', '🎸',
  '📚', '💻', '🚲', '🏠', '🌧️', '☀️', '🐶', '🦊',
];

// Pops up above the message box with two tabs: emoji (added to your message) and GIFs (sent straight away).
export default function EmojiPicker({ userId, recentGifs, onPick, onSendGif, onClose }) {
  const [tab, setTab] = useState('emoji');
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
    <div className={`emoji-picker ${tab}`} ref={ref} role="dialog" aria-label="Emoji and GIFs">
      <div className="picker-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'emoji'} onClick={() => setTab('emoji')}>
          Emoji
        </button>
        <button type="button" role="tab" aria-selected={tab === 'gifs'} onClick={() => setTab('gifs')}>
          GIFs
        </button>
      </div>
      {tab === 'emoji' ? (
        <div className="emoji-grid">
          {EMOJI.map((emoji) => (
            <button key={emoji} type="button" aria-label={`Add ${emoji}`} onClick={() => onPick(emoji)}>
              {emoji}
            </button>
          ))}
        </div>
      ) : (
        <GifPanel userId={userId} recentGifs={recentGifs} onSend={onSendGif} />
      )}
    </div>
  );
}
