import { useEffect, useId, useState } from 'react';
import { api, COLORS, LIMITS, PASSWORD_MIN, shownName, USERNAME_PATTERN, USERNAME_RULES } from '../lib.js';
import { usePrefs } from '../prefs.jsx';
import { Avatar } from './Avatar.jsx';
import { EyeIcon, EyeOffIcon } from './Icons.jsx';
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
        // Can't check right now. The server checks again when you sign up anyway.
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

// A password box with an eye button to show what you typed.
export function PasswordField({ label, value, onChange, autoComplete, hint }) {
  const [visible, setVisible] = useState(false);
  const id = useId();
  return (
    <>
      <label htmlFor={id}>{label}</label>
      <span className="password-field">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          aria-describedby={hint ? `${id}-hint` : undefined}
        />
        <button
          type="button"
          className="secret-button"
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          onClick={() => setVisible((v) => !v)}
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </span>
      {hint && (
        <p id={`${id}-hint`} className={`name-status ${hint.state ?? ''}`}>
          {hint.text}
        </p>
      )}
    </>
  );
}

export default function JoinScreen({ onSignIn }) {
  const [mode, setMode] = useState('create'); // 'create' | 'login'
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [color, setColor] = useState(() => COLORS[Math.floor(Math.random() * COLORS.length)]);
  const [demoUsers, setDemoUsers] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const { accessibility, turnOnAccessibilityMode, resetAll } = usePrefs();
  const accessibilityOn = accessibility.mode;
  const trimmed = name.trim();
  const creating = mode === 'create';
  const check = useUsernameCheck(creating ? trimmed : '');
  const passwordOk = password.length >= PASSWORD_MIN;

  // Only filled in when the server runs with demo data (npm run demo).
  useEffect(() => {
    fetch('/api/demo-users')
      .then((res) => res.json())
      .then(setDemoUsers)
      .catch(() => {});
  }, []);

  function switchMode(next) {
    setMode(next);
    setError(null);
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const reply = creating
        ? await api('/api/register', { username: trimmed, password, color })
        : await api('/api/login', { username: trimmed, password });
      onSignIn(reply);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  async function jumpIn(user) {
    try {
      onSignIn(await api('/api/demo-login', { userId: user.id }));
    } catch (err) {
      setError(err.message);
    }
  }

  const canSubmit = creating ? check.state === 'ok' && passwordOk : trimmed && password;

  return (
    <main className="join">
      <div className="join-card">
        <div className="join-brand">
          <Logo size={56} />
          <h1>Gjeng</h1>
        </div>
        <p className="join-tagline">Group chats for your crew. Make a group, share the code, start talking.</p>

        <div className="segmented join-tabs" role="tablist" aria-label="Account">
          <button type="button" role="tab" aria-selected={creating} onClick={() => switchMode('create')}>
            Create account
          </button>
          <button type="button" role="tab" aria-selected={!creating} onClick={() => switchMode('login')}>
            Log in
          </button>
        </div>

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
            aria-describedby={creating ? 'join-name-status' : undefined}
          />
          {creating && (
            <p id="join-name-status" className={`name-status ${check.state}`} aria-live="polite">
              {check.state === 'ok' && '✓ Available. Friends will add you with this name.'}
              {check.state === 'bad' && check.error}
              {check.state === 'checking' && 'Checking…'}
              {check.state === 'idle' && 'Pick a unique name. Friends add you by typing it.'}
            </p>
          )}

          <PasswordField
            label="Password"
            value={password}
            onChange={setPassword}
            autoComplete={creating ? 'new-password' : 'current-password'}
            hint={
              creating
                ? passwordOk
                  ? { state: 'ok', text: '✓ Long enough. Only a scrambled version is stored.' }
                  : { text: `At least ${PASSWORD_MIN} characters. A short sentence works well.` }
                : null
            }
          />

          {creating && (
            <>
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
            </>
          )}

          <label className="accessibility-check">
            <input
              type="checkbox"
              checked={accessibilityOn}
              onChange={(e) => (e.target.checked ? turnOnAccessibilityMode() : resetAll())}
            />
            <span>
              <strong>Turn on accessibility mode</strong>
              <span className="hint">Bigger text, high contrast, a simpler look and less motion. You can fine-tune it later in Settings.</span>
            </span>
          </label>

          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}

          <button className="button primary big" disabled={!canSubmit || busy}>
            {creating ? 'Create account' : 'Log in'}
          </button>
        </form>

        {demoUsers.length > 0 && (
          <section className="demo-users" aria-label="Demo accounts">
            <p className="demo-title">Or jump in as someone from the demo, no password needed</p>
            <div className="demo-list">
              {demoUsers.map((user) => (
                <button
                  key={user.id}
                  className="demo-user"
                  onClick={() => jumpIn(user)}
                  aria-label={`Jump in as ${shownName(user)}`}
                >
                  <Avatar user={user} size={36} />
                  <span>{shownName(user)}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        <p className="fineprint">Passwords are stored only as a salted scrypt hash. Chats are stored on the computer running Gjeng.</p>
      </div>
    </main>
  );
}
