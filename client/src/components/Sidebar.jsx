import { dmPartner, formatShort } from '../lib.js';
import { Avatar, GroupAvatar } from './Avatar.jsx';
import { LinkIcon, LogOutIcon, PlusIcon, UsersIcon } from './Icons.jsx';
import Logo from './Logo.jsx';

function preview(group) {
  const last = group.messages.at(-1);
  if (!last) return 'No messages yet';
  if (last.type === 'system') return last.text;
  return `${last.name}: ${last.text}`;
}

function ChatItem({ group, me, active, count, onlineIds, onSelect }) {
  const partner = group.type === 'dm' ? dmPartner(group, me.id) : null;
  const last = group.messages.at(-1);

  return (
    <button
      className={`group-item ${active ? 'active' : ''} ${count ? 'has-unread' : ''}`}
      aria-current={active ? 'true' : undefined}
      onClick={() => onSelect(group.id)}
    >
      {partner ? (
        <Avatar user={partner} size={44} online={onlineIds.has(partner.id)} />
      ) : (
        <GroupAvatar group={group} size={44} />
      )}
      <span className="group-item-text">
        <span className="group-item-top">
          <span className="group-item-name">{partner ? partner.name : group.name}</span>
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
}

export default function Sidebar({
  me,
  dms,
  groups,
  activeId,
  unread,
  onlineIds,
  requestCount,
  onSelect,
  onFriends,
  onNew,
  onJoin,
  onSignOut,
}) {
  const item = (group) => (
    <ChatItem
      key={group.id}
      group={group}
      me={me}
      active={group.id === activeId}
      count={unread[group.id]}
      onlineIds={onlineIds}
      onSelect={onSelect}
    />
  );

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

      <nav className="group-list" aria-label="Chats">
        <button
          className={`group-item friends-item ${activeId === 'friends' ? 'active' : ''}`}
          aria-current={activeId === 'friends' ? 'true' : undefined}
          onClick={onFriends}
        >
          <span className="friends-icon" aria-hidden="true">
            <UsersIcon />
          </span>
          <span className="group-item-text">
            <span className="group-item-name">Friends</span>
          </span>
          {requestCount > 0 && (
            <span className="badge" aria-label={`${requestCount} friend requests`}>
              {requestCount}
            </span>
          )}
        </button>

        <h2 className="sidebar-title">Direct messages</h2>
        {dms.map(item)}
        {dms.length === 0 && <p className="empty-hint">Add friends to message them one-on-one.</p>}

        <h2 className="sidebar-title">Groups</h2>
        {groups.map(item)}
        {groups.length === 0 && <p className="empty-hint">No groups yet. Create one, or join with a code from a friend.</p>}
      </nav>
    </aside>
  );
}
