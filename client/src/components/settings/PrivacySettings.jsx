import { useEffect, useState } from 'react';
import { PRIVACY_OPTIONS } from '../../lib.js';
import Switch from './Switch.jsx';

const REQUEST_CHOICES = {
  everyone: ['Everyone', 'Anyone who knows your username.'],
  'friends-of-friends': ['Friends of friends', 'Only people who already share a friend with you.'],
  nobody: ['No one', "Nobody can send you requests. You can still add other people."],
};

const VISIBILITY_CHOICES = {
  everyone: ['Everyone', 'Anyone who opens your profile.'],
  'friends-of-friends': ['Friends of friends', 'Your friends, and people who share a friend with you.'],
  friends: ['Only friends', 'Only people you are friends with.'],
  nobody: ['No one', 'Nobody sees your friends or mutual friends.'],
};

function Choices({ legend, name, value, options, labels, onChange }) {
  return (
    <fieldset className="settings-group">
      <legend>{legend}</legend>
      <div className="choice-list">
        {options.map((option) => (
          <label key={option} className={`choice ${value === option ? 'selected' : ''}`}>
            <input type="radio" name={name} value={option} checked={value === option} onChange={() => onChange(option)} />
            <span>
              <strong>{labels[option][0]}</strong>
              <span className="hint">{labels[option][1]}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

// Changes are saved straight away; the server enforces them for everyone else.
export default function PrivacySettings({ privacy: saved, onChange }) {
  // Shown as chosen immediately, and put back if the server says no.
  const [privacy, setPrivacy] = useState(saved);
  const [status, setStatus] = useState(null);

  useEffect(() => setPrivacy(saved), [saved]);

  async function change(changes) {
    setStatus(null);
    setPrivacy((current) => ({ ...current, ...changes }));
    try {
      await onChange(changes);
      setStatus({ saved: true });
    } catch (err) {
      setPrivacy(saved);
      setStatus({ error: err.message });
    }
  }

  if (!privacy) return null;
  return (
    <div className="settings-page">
      <h3>Privacy</h3>
      <p className="hint settings-intro">These are checked by the server, so they apply no matter which app or device people use.</p>

      <Choices
        legend="Who can send you friend requests"
        name="friend-requests"
        value={privacy.friendRequests}
        options={PRIVACY_OPTIONS.friendRequests}
        labels={REQUEST_CHOICES}
        onChange={(friendRequests) => change({ friendRequests })}
      />

      <Choices
        legend="Who can see your friends"
        name="friends-visibility"
        value={privacy.friendsVisibility}
        options={PRIVACY_OPTIONS.friendsVisibility}
        labels={VISIBILITY_CHOICES}
        onChange={(friendsVisibility) => change({ friendsVisibility })}
      />
      <p className="hint">This decides who sees your mutual friends and how many friends you have on your profile card.</p>

      <fieldset className="settings-group">
        <legend>Online status</legend>
        <Switch
          title="Show others when I'm online"
          description="Turn off to always look offline. You can still chat and call as normal."
          checked={privacy.showOnline}
          onChange={(showOnline) => change({ showOnline })}
        />
      </fieldset>

      {status?.error && (
        <p className="form-error" role="alert">
          {status.error}
        </p>
      )}
      {status?.saved && (
        <p className="saved-note" role="status">
          Saved ✓
        </p>
      )}
    </div>
  );
}
