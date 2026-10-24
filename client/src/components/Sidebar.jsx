import { formatShort } from '../lib.js';
import { Avatar, GroupAvatar } from './Avatar.jsx';
import { LinkIcon, LogOutIcon, PlusIcon } from './Icons.jsx';
import Logo from './Logo.jsx';

function preview(group) {
  const last = group.messages.at(-1);
  if (!last) return 'No messages yet';
  if (last.type === 'system') return last.text;
  return `${last.name}: ${last.text}`;
}

export default function Sidebar({ me, groups, activeId, unread, onSelect, onNew, onJoin, onSignOut }) {
  return (
    <aside className="sidebar">
      <header className="sidebar-header">
        <Logo size={32} />
        <span className="brand">Gjeng</span>
        <div className="me" title={`Signed in as ${me.name}`}>
          <Avatar user={me} size={32} />
          <button className="icon-button" aria-label="Sign out" title="Sign out" onClick={onSignOut}>
            <LogOutIcon />
          </button>
        </div>
      </header>

      <div className="sidebar-actions">
        <button className="button primary" onClick={onNew}>
          <PlusIcon /> New group
        </button>
        <button className="button" onClick={onJoin}>
          <LinkIcon /> Join with code
        </button>
      </div>

      <h2 className="sidebar-title">Your groups</h2>
      <nav className="group-list" aria-label="Your groups">
        {groups.map((group) => {
          const count = unread[group.id];
          const last = group.messages.at(-1);
          return (
            <button
              key={group.id}
              className={`group-item ${group.id === activeId ? 'active' : ''} ${count ? 'has-unread' : ''}`}
              aria-current={group.id === activeId ? 'true' : undefined}
              onClick={() => onSelect(group.id)}
            >
              <GroupAvatar group={group} size={44} />
              <span className="group-item-text">
                <span className="group-item-top">
                  <span className="group-item-name">{group.name}</span>
                  {last && <span className="group-item-time">{formatShort(last.ts)}</span>}
                </span>
                <span className="group-item-bottom">
                  <span className="group-item-preview">{preview(group)}</span>
                  {count > 0 && (
                    <span className="badge" aria-label={`${count} unread`}>
                      {count > 99 ? '99+' : count}
                    </span>
                  )}
                </span>
              </span>
            </button>
          );
        })}
        {groups.length === 0 && <p className="empty-hint">No groups yet. Create one, or join with a code from a friend.</p>}
      </nav>
    </aside>
  );
}
