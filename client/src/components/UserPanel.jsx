import { useEffect, useRef, useState } from 'react';
import { presenceLabel, presenceOf, shownName, STATUSES } from '../lib.js';
import { Avatar } from './Avatar.jsx';
import { HangUpIcon, HeadphonesIcon, HeadphonesOffIcon, MicIcon, MicOffIcon, SettingsIcon } from './Icons.jsx';

// Bottom-left corner, like Discord: you, your status, and your call buttons while you're in a call.
export default function UserPanel({ me, voice, callName, onOpenProfile, onSetStatus, onToggleMute, onToggleDeafen, onLeaveCall }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const panelRef = useRef(null);
  const presence = presenceOf(me, true);

  // Close the status menu when you click anywhere else.
  useEffect(() => {
    if (!menuOpen) return;
    const close = (event) => !panelRef.current?.contains(event.target) && setMenuOpen(false);
    const escape = (event) => event.key === 'Escape' && setMenuOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', escape);
    };
  }, [menuOpen]);

  return (
    <div className="user-panel" ref={panelRef}>
      {voice.groupId && (
        <div className="voice-connected">
          <span className="voice-text">
            <strong>Voice connected</strong>
            <span>{callName}</span>
          </span>
          <button className="icon-button hang-up-small" aria-label="Leave call" title="Leave call" onClick={onLeaveCall}>
            <HangUpIcon size={18} />
          </button>
        </div>
      )}

      {menuOpen && (
        <div className="status-menu" role="menu" aria-label="Set your status">
          {Object.entries(STATUSES).map(([value, { label }]) => (
            <button
              key={value}
              role="menuitemradio"
              aria-checked={presence === value}
              className="status-option"
              onClick={() => {
                onSetStatus(value);
                setMenuOpen(false);
              }}
            >
              <span className={`status-dot ${value}`} aria-hidden="true" />
              {label}
            </button>
          ))}
          <hr />
          <button
            role="menuitem"
            className="status-option"
            onClick={() => {
              setMenuOpen(false);
              onOpenProfile();
            }}
          >
            Edit profile
          </button>
        </div>
      )}

      <div className="user-row">
        <button
          className="me-button"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label={`You: ${shownName(me)}, ${presenceLabel(presence)}. Change status`}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <Avatar user={me} size={36} online />
          <span className="me-text">
            <span className="me-name">{shownName(me)}</span>
            <span className="me-status">{presenceLabel(presence)}</span>
          </span>
        </button>
        {voice.groupId && (
          <>
            <button
              className={`icon-button ${voice.muted ? 'danger' : ''}`}
              aria-label={voice.muted ? 'Unmute' : 'Mute'}
              title={voice.muted ? 'Unmute' : 'Mute'}
              aria-pressed={voice.muted}
              onClick={onToggleMute}
            >
              {voice.muted ? <MicOffIcon size={18} /> : <MicIcon size={18} />}
            </button>
            <button
              className={`icon-button ${voice.deafened ? 'danger' : ''}`}
              aria-label={voice.deafened ? 'Undeafen' : 'Deafen'}
              title={voice.deafened ? 'Undeafen' : 'Deafen'}
              aria-pressed={voice.deafened}
              onClick={onToggleDeafen}
            >
              {voice.deafened ? <HeadphonesOffIcon size={18} /> : <HeadphonesIcon size={18} />}
            </button>
          </>
        )}
        <button className="icon-button" aria-label="Profile settings" title="Profile settings" onClick={onOpenProfile}>
          <SettingsIcon size={18} />
        </button>
      </div>
    </div>
  );
}
