import { useState } from 'react';
import { LIMITS, plural, presenceLabel, presenceOf, shownName } from '../lib.js';
import { Avatar } from './Avatar.jsx';
import { BackIcon, CopyIcon, UsersIcon } from './Icons.jsx';

const byOnlineThenName = (onlineIds) => (a, b) =>
  onlineIds.has(b.id) - onlineIds.has(a.id) || shownName(a).localeCompare(shownName(b));

function Person({ user, online, children, sub }) {
  return (
    <li className="person">
      <Avatar user={user} size={40} online={online} />
      <span className="person-text">
        <span className="person-name">
          {shownName(user)} <span className="person-handle">@{user.name}</span>
        </span>
        <span className={`person-sub ${sub === 'Online' ? 'online' : ''}`}>{sub}</span>
      </span>
      {children}
    </li>
  );
}

export default function FriendsPanel({ me, friends, onlineIds, onBack, onCopyName, onAdd, onRespond, onCancel, onRemove, onMessage }) {
  const [username, setUsername] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const list = [...friends.friends].sort(byOnlineThenName(onlineIds));
  const onlineCount = list.filter((f) => onlineIds.has(f.id)).length;
  const status = (user) => presenceLabel(presenceOf(user, onlineIds.has(user.id)));

  async function add(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onAdd(username.trim());
      setUsername('');
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
            <h2>Your username</h2>
            <p className="hint">Friends add you by typing it in.</p>
            <button className="username-chip" onClick={() => onCopyName(me.name)}>
              <span data-testid="my-username">@{me.name}</span>
              <CopyIcon />
            </button>
          </section>

          <section className="card">
            <h2>Add a friend</h2>
            <p className="hint">Type their username. You can also add people from a group's member list.</p>
            <form className="add-friend" onSubmit={add}>
              <input
                aria-label="Username to add"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                maxLength={LIMITS.userName}
                placeholder="Username"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
              />
              <button className="button primary" disabled={!username.trim() || busy}>
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
            <p className="empty-hint">No friends yet. Share your username, or add people from your groups.</p>
          ) : (
            <ul className="person-list">
              {list.map((user) => (
                <Person key={user.id} user={user} online={onlineIds.has(user.id)} sub={status(user)}>
                  <button className="button primary small" aria-label={`Message ${shownName(user)}`} onClick={() => onMessage(user.id)}>
                    Message
                  </button>
                  <button className="button small quiet" aria-label={`Remove ${shownName(user)}`} onClick={() => onRemove(user)}>
                    Remove friend
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
