import { useState } from 'react';
import { COLORS, LIMITS, makeId } from '../lib.js';
import { Avatar } from './Avatar.jsx';
import Logo from './Logo.jsx';

export default function JoinScreen({ onJoin }) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(() => COLORS[Math.floor(Math.random() * COLORS.length)]);
  const trimmed = name.trim();

  function submit(event) {
    event.preventDefault();
    if (trimmed) onJoin({ id: makeId(), name: trimmed, color });
  }

  return (
    <main className="join">
      <div className="join-card">
        <div className="join-brand">
          <Logo size={56} />
          <h1>Gjeng</h1>
        </div>
        <p className="join-tagline">Group chats for your crew. Make a group, share the code, start talking.</p>

        <form onSubmit={submit} className="join-form">
          <label htmlFor="join-name">Your name</label>
          <input
            id="join-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={LIMITS.userName}
            placeholder="e.g. Ola"
            autoComplete="nickname"
            autoFocus
          />

          <fieldset className="color-picker">
            <legend>Pick a colour</legend>
            <div className="swatches">
              {COLORS.map((c, i) => (
                <button
                  key={c}
                  type="button"
                  className={`swatch ${c === color ? 'selected' : ''}`}
                  style={{ background: c }}
                  aria-label={`Colour ${i + 1}`}
                  aria-pressed={c === color}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </fieldset>

          <div className="join-preview">
            <Avatar user={{ name: trimmed || '?', color }} size={44} />
            <span>{trimmed || 'Your name'}</span>
          </div>

          <button className="button primary big" disabled={!trimmed}>
            Start chatting
          </button>
        </form>

        <p className="fineprint">No password needed, this is a prototype. Chats are stored on the computer running Gjeng.</p>
      </div>
    </main>
  );
}
