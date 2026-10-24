import { useEffect, useState } from 'react';
import { COLORS, LIMITS, makeId, shownName, USERNAME_PATTERN, USERNAME_RULES } from '../lib.js';
import { Avatar } from './Avatar.jsx';
import Logo from './Logo.jsx';

// Asks the server if a username is free, a moment after you stop typing.
function useUsernameCheck(name) {
  const [check, setCheck] = useState({ state: 'idle' }); // idle | checking | ok | bad

  useEffect(() => {
    if (!name) return setCheck({ state: 'idle' });
    if (!USERNAME_PATTERN.test(name)) return setCheck({ state: 'bad', error: USERNAME_RULES });

    let cancelled = false;
    setCheck({ state: 'checking' });
    const timer = setTimeout(async () => {
      try {
        const reply = await (await fetch(`/api/username?name=${encodeURIComponent(name)}`)).json();
        if (!cancelled) setCheck(reply.available ? { state: 'ok' } : { state: 'bad', error: reply.error });
      } catch {
        // Can't check right now. The server checks again when you join anyway.
        if (!cancelled) setCheck({ state: 'ok' });
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [name]);

  return check;
}

export default function JoinScreen({ onJoin }) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(() => COLORS[Math.floor(Math.random() * COLORS.length)]);
  const [demoUsers, setDemoUsers] = useState([]);
  const trimmed = name.trim();
  const check = useUsernameCheck(trimmed);

  // Only filled in when the server runs with demo data (npm run demo).
  useEffect(() => {
    fetch('/api/demo-users')
      .then((res) => res.json())
      .then(setDemoUsers)
      .catch(() => {});
  }, []);

  function submit(event) {
    event.preventDefault();
    if (check.state === 'ok') onJoin({ id: makeId(), name: trimmed, color });
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
          <label htmlFor="join-name">Username</label>
          <input
            id="join-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={LIMITS.userName}
            placeholder="e.g. Ola"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            autoFocus
            aria-describedby="join-name-status"
          />
          <p id="join-name-status" className={`name-status ${check.state}`} aria-live="polite">
            {check.state === 'ok' && '✓ Available. Friends will add you with this name.'}
            {check.state === 'bad' && check.error}
            {check.state === 'checking' && 'Checking…'}
            {check.state === 'idle' && 'Pick a unique name. Friends add you by typing it.'}
          </p>

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

          <button className="button primary big" disabled={check.state !== 'ok'}>
            Start chatting
          </button>
        </form>

        {demoUsers.length > 0 && (
          <section className="demo-users" aria-label="Demo accounts">
            <p className="demo-title">Or jump in as someone from the demo</p>
            <div className="demo-list">
              {demoUsers.map((user) => (
                <button key={user.id} className="demo-user" onClick={() => onJoin(user)} aria-label={`Jump in as ${shownName(user)}`}>
                  <Avatar user={user} size={36} />
                  <span>{shownName(user)}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        <p className="fineprint">No password needed, this is a prototype. Chats are stored on the computer running Gjeng.</p>
      </div>
    </main>
  );
}
