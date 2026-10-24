import { useState } from 'react';
import { INVITE_CODE_LENGTH, plural } from '../lib.js';
import { Avatar } from './Avatar.jsx';
import { BackIcon, CopyIcon, UsersIcon, XIcon } from './Icons.jsx';

const byOnlineThenName = (onlineIds) => (a, b) =>
  onlineIds.has(b.id) - onlineIds.has(a.id) || a.name.localeCompare(b.name);

function Person({ user, online, children, sub }) {
  return (
    <li className="person">
      <Avatar user={user} size={40} online={online} />
      <span className="person-text">
        <span className="person-name">{user.name}</span>
        <span className={`person-sub ${sub === 'Online' ? 'online' : ''}`}>{sub}</span>
      </span>
      {children}
    </li>
  );
}

export default function FriendsPanel({ me, friends, onlineIds, onBack, onCopyCode, onAdd, onRespond, onCancel, onRemove, onMessage }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const list = [...friends.friends].sort(byOnlineThenName(onlineIds));
  const onlineCount = list.filter((f) => onlineIds.has(f.id)).length;
  const status = (user) => (onlineIds.has(user.id) ? 'Online' : 'Offline');

  async function add(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onAdd(code);
      setCode('');
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  }

  return (
    <section className="chat friends-view" aria-label="Friends">
      <header className="chat-header">
        <button className="icon-button back-button" aria-label="Back to chats" onClick={onBack}>
          <BackIcon />
        </button>
        <span className="friends-icon" aria-hidden="true">
          <UsersIcon />
        </span>
        <div className="chat-title">
          <h1>Friends</h1>
          <p>
            {plural(list.length, 'friend')} · {onlineCount} online
          </p>
        </div>
      </header>

      <div className="friends-scroll">
        <div className="friends-cards">
          <section className="card">
            <h2>Your friend code</h2>
            <p className="hint">Share it so people can add you.</p>
            <button className="code-big" onClick={() => onCopyCode(me.friendCode, 'Friend code')}>
              <span data-testid="friend-code">{me.friendCode}</span>
              <CopyIcon />
            </button>
          </section>

          <section className="card">
            <h2>Add a friend</h2>
            <p className="hint">Type in their friend code. You can also add people from your groups' member lists.</p>
            <form className="add-friend" onSubmit={add}>
              <input
                className="code-input small"
                aria-label="Friend code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                maxLength={INVITE_CODE_LENGTH}
                placeholder="CODE"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
              />
              <button className="button primary" disabled={code.length !== INVITE_CODE_LENGTH || busy}>
                Send request
              </button>
            </form>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
          </section>
        </div>

        {friends.incoming.length > 0 && (
          <section aria-label="Friend requests">
            <h2 className="section-title">Friend requests</h2>
            <ul className="person-list">
              {friends.incoming.map((user) => (
                <Person key={user.id} user={user} online={onlineIds.has(user.id)} sub="Wants to be your friend">
                  <button className="button primary small" onClick={() => onRespond(user.id, true)}>
                    Accept
                  </button>
                  <button className="button small" onClick={() => onRespond(user.id, false)}>
                    Decline
                  </button>
                </Person>
              ))}
            </ul>
          </section>
        )}

        <section aria-label="Your friends">
          <h2 className="section-title">Your friends</h2>
          {list.length === 0 ? (
            <p className="empty-hint">No friends yet. Share your code, or add people from your groups.</p>
          ) : (
            <ul className="person-list">
              {list.map((user) => (
                <Person key={user.id} user={user} online={onlineIds.has(user.id)} sub={status(user)}>
                  <button className="button primary small" aria-label={`Message ${user.name}`} onClick={() => onMessage(user.id)}>
                    Message
                  </button>
                  <button className="icon-button" aria-label={`Remove ${user.name}`} title="Remove friend" onClick={() => onRemove(user)}>
                    <XIcon />
                  </button>
                </Person>
              ))}
            </ul>
          )}
        </section>

        {friends.outgoing.length > 0 && (
          <section aria-label="Sent requests">
            <h2 className="section-title">Sent requests</h2>
            <ul className="person-list">
              {friends.outgoing.map((user) => (
                <Person key={user.id} user={user} online={onlineIds.has(user.id)} sub="Waiting for an answer">
                  <button className="button small" onClick={() => onCancel(user.id)}>
                    Cancel
                  </button>
                </Person>
              ))}
            </ul>
          </section>
        )}
      </div>
    </section>
  );
}
