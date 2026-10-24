import { useEffect, useId, useState } from 'react';
import { LogOutIcon, XIcon } from '../Icons.jsx';
import AccessibilitySettings from './AccessibilitySettings.jsx';
import AccountSettings from './AccountSettings.jsx';
import AppearanceSettings from './AppearanceSettings.jsx';
import PrivacySettings from './PrivacySettings.jsx';
import ProfileSettings from './ProfileSettings.jsx';

const TABS = [
  ['profile', 'My profile'],
  ['account', 'Account'],
  ['privacy', 'Privacy'],
  ['appearance', 'Appearance'],
  ['accessibility', 'Accessibility'],
];

// A big settings window with a menu on the left, like Discord's user settings.
export default function SettingsModal({ me, token, privacy, initialTab = 'profile', onSaveProfile, onUpdatePrivacy, onSignOut, onClose }) {
  const [tab, setTab] = useState(initialTab);
  const titleId = useId();

  useEffect(() => {
    const escape = (event) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [onClose]);

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="settings" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <nav className="settings-nav" aria-label="Settings sections">
          <h2 id={titleId}>Settings</h2>
          {TABS.map(([id, label]) => (
            <button
              key={id}
              className={`settings-tab ${tab === id ? 'active' : ''}`}
              aria-current={tab === id ? 'page' : undefined}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
          <button className="button quiet settings-signout" onClick={onSignOut}>
            <LogOutIcon size={16} /> Sign out
          </button>
        </nav>

        <div className="settings-body">
          <button className="icon-button settings-close" aria-label="Close settings" onClick={onClose}>
            <XIcon />
          </button>
          {tab === 'profile' && <ProfileSettings me={me} onSave={onSaveProfile} />}
          {tab === 'account' && <AccountSettings me={me} token={token} />}
          {tab === 'privacy' && <PrivacySettings privacy={privacy} onChange={onUpdatePrivacy} />}
          {tab === 'appearance' && <AppearanceSettings />}
          {tab === 'accessibility' && <AccessibilitySettings />}
        </div>
      </div>
    </div>
  );
}
