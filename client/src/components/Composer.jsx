import { useLayoutEffect, useRef, useState } from 'react';
import { LIMITS } from '../lib.js';
import { SendIcon } from './Icons.jsx';

// Tell the others we're typing at most this often.
const TYPING_EVERY_MS = 2000;
const MAX_HEIGHT = 160;

export default function Composer({ groupName, onSend, onTyping, onError }) {
  const [text, setText] = useState('');
  const fieldRef = useRef(null);
  const lastTyping = useRef(0);

  // Grow the box with the text, up to a limit.
  useLayoutEffect(() => {
    const field = fieldRef.current;
    field.style.height = 'auto';
    field.style.height = `${Math.min(field.scrollHeight, MAX_HEIGHT)}px`;
  }, [text]);

  function change(event) {
    setText(event.target.value);
    const now = Date.now();
    if (event.target.value.trim() && now - lastTyping.current > TYPING_EVERY_MS) {
      lastTyping.current = now;
      onTyping();
    }
  }

  async function send() {
    const value = text.trim();
    if (!value) return;
    // Clear straight away so it feels instant, and put the text back if sending fails.
    setText('');
    lastTyping.current = 0;
    try {
      await onSend(value);
    } catch (err) {
      setText(value);
      onError(err.message);
    }
    fieldRef.current?.focus();
  }

  function keyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      send();
    }
  }

  return (
    <form
      className="composer"
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
    >
      <textarea
        ref={fieldRef}
        rows={1}
        value={text}
        onChange={change}
        onKeyDown={keyDown}
        maxLength={LIMITS.message}
        placeholder={`Message ${groupName}`}
        aria-label={`Message ${groupName}`}
        autoFocus={window.matchMedia('(min-width: 721px)').matches}
      />
      <button className="send-button" aria-label="Send" disabled={!text.trim()}>
        <SendIcon />
      </button>
    </form>
  );
}
