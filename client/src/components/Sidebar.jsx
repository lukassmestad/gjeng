import { dmPartner, formatShort, shownName } from '../lib.js';
import { Avatar, GroupAvatar } from './Avatar.jsx';
import { LinkIcon, PlusIcon, SpeakerIcon, UsersIcon } from './Icons.jsx';
import Logo from './Logo.jsx';

function preview(group, people) {
  const last = group.messages.at(-1);
  if (!last) return 'No messages yet';
  if (last.type === 'system') return last.text;
  const body = last.text || (last.attachment?.kind === 'image' ? '📷 Picture' : `📎 ${last.attachment?.name ?? 'File'}`);
  return `${shownName(people[last.userId] ?? last)}: ${body}`;
}

function ChatItem({ group, me, people, active, count, call, onlineIds, onSelect }) {
  const partnerInfo = group.type === 'dm' ? dmPartner(group, me.id) : null;
  const partner = partnerInfo ? (people[partnerInfo.id] ?? partnerInfo) : null;
  const last = group.messages.at(-1);
  const inCall = call?.participants.length ?? 0;

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
          <span className="group-item-name">{partner ? shownName(partner) : group.name}</span>
          {inCall > 0 ? (
            <span className="call-indicator" aria-label={`${inCall} in a call`} title="Call in progress">
              <SpeakerIcon size={14} /> {inCall}
            </span>
          ) : (
            last && <span className="group-item-time">{formatShort(last.ts)}</span>
          )}
        </span>
        <span className="group-item-bottom">
          <span className="group-item-preview">{preview(group, people)}</span>
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
  people,
  dms,
  groups,
  calls,
  activeId,
  unread,
  onlineIds,
  requestCount,
  footer,
  resizer,
  onSelect,
  onFriends,
  onNew,
  onJoin,
}) {
  const item = (group) => (
    <ChatItem
      key={group.id}
      group={group}
      me={me}
      people={people}
      active={group.id === activeId}
      count={unread[group.id]}
      call={calls[group.id]}
      onlineIds={onlineIds}
      onSelect={onSelect}
    />
  );

  return (
    <aside className="sidebar">
      <header className="sidebar-header">
        <Logo size={32} />
        <span className="brand">Gjeng</span>
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

      {footer}
      {resizer}
    </aside>
  );
}
