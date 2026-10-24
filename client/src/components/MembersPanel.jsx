import { plural } from '../lib.js';
import { Avatar } from './Avatar.jsx';
import { CopyIcon, XIcon } from './Icons.jsx';

// The button next to someone depends on how you know them.
function FriendAction({ member, relation, onAddFriend, onRespond, onMessage }) {
  if (relation === 'friend') {
    return (
      <button className="button small" aria-label={`Message ${member.name}`} onClick={() => onMessage(member.id)}>
        Message
      </button>
    );
  }
  if (relation === 'outgoing') return <span className="member-note">Request sent</span>;
  if (relation === 'incoming') {
    return (
      <button className="button primary small" aria-label={`Accept ${member.name}`} onClick={() => onRespond(member.id, true)}>
        Accept
      </button>
    );
  }
  return (
    <button className="button small" aria-label={`Add ${member.name} as friend`} onClick={() => onAddFriend(member.id)}>
      Add friend
    </button>
  );
}

export default function MembersPanel({ group, me, friends, onlineIds, onClose, onCopyCode, onLeave, onAddFriend, onRespond, onMessage }) {
  // Online people first, then alphabetical.
  const members = [...group.members].sort(
    (a, b) => onlineIds.has(b.id) - onlineIds.has(a.id) || a.name.localeCompare(b.name),
  );
  const ids = (list) => new Set(list.map((u) => u.id));
  const friendIds = ids(friends.friends);
  const incomingIds = ids(friends.incoming);
  const outgoingIds = ids(friends.outgoing);
  const relation = (id) =>
    friendIds.has(id) ? 'friend' : incomingIds.has(id) ? 'incoming' : outgoingIds.has(id) ? 'outgoing' : null;

  return (
    <aside className="members-panel" aria-label="Members">
      <header className="members-header">
        <h2>{plural(members.length, 'member')}</h2>
        <button className="icon-button" aria-label="Close members" onClick={onClose}>
          <XIcon />
        </button>
      </header>

      <ul className="member-list">
        {members.map((member) => {
          const online = onlineIds.has(member.id);
          return (
            <li key={member.id} className="member">
              <Avatar user={member} size={36} online={online} />
              <span className="member-text">
                <span className="member-name">
                  {member.name}
                  {member.id === me.id && <span className="you"> (you)</span>}
                </span>
                <span className={`member-status ${online ? 'online' : ''}`}>{online ? 'Online' : 'Offline'}</span>
              </span>
              {member.id !== me.id && (
                <FriendAction
                  member={member}
                  relation={relation(member.id)}
                  onAddFriend={onAddFriend}
                  onRespond={onRespond}
                  onMessage={onMessage}
                />
              )}
            </li>
          );
        })}
      </ul>

      <div className="invite-box">
        <p className="invite-box-label">Invite code</p>
        <button className="code-big" onClick={() => onCopyCode(group.code)}>
          {group.code}
          <CopyIcon />
        </button>
        <p className="hint">Friends tap "Join with code" and type this in.</p>
      </div>

      <button className="button danger" onClick={onLeave}>
        Leave group
      </button>
    </aside>
  );
}
