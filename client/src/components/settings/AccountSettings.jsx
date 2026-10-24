import { useState } from 'react';
import { api, PASSWORD_MIN } from '../../lib.js';
import { PasswordField } from '../JoinScreen.jsx';

// Your username and password. Changing the password logs out every other device.
export default function AccountSettings({ me, token }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setStatus(null);
    try {
      await api('/api/password', { currentPassword: current, newPassword: next }, token);
      setCurrent('');
      setNext('');
      setStatus({ saved: true });
    } catch (err) {
      setStatus({ error: err.message });
    }
    setBusy(false);
  }

  return (
    <div className="settings-page">
      <h3>Account</h3>

      <fieldset className="settings-group">
        <legend>Username</legend>
        <p className="account-username">@{me.name}</p>
        <p className="hint">Usernames can't be changed, because friends add you by it. Your display name can.</p>
      </fieldset>

      <form className="settings-group account-password" onSubmit={save}>
        <fieldset className="settings-group">
          <legend>Change password</legend>
          <PasswordField label="Current password" value={current} onChange={setCurrent} autoComplete="current-password" />
          <PasswordField
            label="New password"
            value={next}
            onChange={setNext}
            autoComplete="new-password"
            hint={{ text: `At least ${PASSWORD_MIN} characters. Your other devices will be logged out.` }}
          />
        </fieldset>
        {status?.error && (
          <p className="form-error" role="alert">
            {status.error}
          </p>
        )}
        {status?.saved && (
          <p className="saved-note" role="status">
            Password changed ✓ Other devices have been logged out.
          </p>
        )}
        <div>
          <button className="button primary" disabled={busy || next.length < PASSWORD_MIN}>
            Change password
          </button>
        </div>
      </form>
    </div>
  );
}
